import { NextResponse } from 'next/server'
import { requireStaff, resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { APIListQuerySchema, ZodTituloFinanceiro } from '@/lib/server/zodSchemas'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  const { user, isStaff } = roleCtx

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const aluno = searchParams.get('aluno')

    // 1. Zod Validation for queries
    const qParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined
    }
    const { page, limit, search } = APIListQuerySchema.parse(qParams)

    let allowedAlunoIds: Set<string> | null = null
    if (!isStaff) {
      allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
      if (allowedAlunoIds.size === 0) {
        return NextResponse.json({
          data: [],
          meta: { total: 0, page, limit }
        })
      }
    }
    
    // 2. Supabase Admin Client (role & student access already validated above)
    const supabase = getAdminClient()

    let query = supabase.from('titulos').select('*', { count: 'exact' })

    const accessStartDate = await getLoggedUserAccessStartDate()
    if (accessStartDate) {
      query = query.gte('created_at', accessStartDate.toISOString())
    }

    if (status && status !== 'todos') query = query.eq('status', status)
    const origemLanca = searchParams.get('origemLanca')
    if (origemLanca) {
      query = query.filter('dados->>origemLanca', 'eq', origemLanca)
    }
    if (allowedAlunoIds) {
      const safeIds = Array.from(allowedAlunoIds)
        .map(id => id.replace(/[^A-Za-z0-9_-]/g, ''))
        .filter(Boolean)
      if (safeIds.length > 0) {
        const orParts = safeIds.flatMap(id => [
          `aluno.eq.${id}`,
          `aluno_id.eq.${id}`,
          `dados->>alunoId.eq.${id}`,
          `dados->>aluno_id.eq.${id}`,
        ])
        query = query.or(orParts.join(','))
      }
    } else if (aluno) {
      const safeAluno = aluno.replace(/[%_().,]/g, '')
      if (safeAluno) query = query.ilike('aluno', `%${safeAluno}%`)
    }
    if (search) {
      const safeSearch = search.replace(/[%_().,]/g, '')
      if (safeSearch) query = query.or(`descricao.ilike.%${safeSearch}%,aluno.ilike.%${safeSearch}%`)
    }

    // Paginação forced on Database Level (Zero Memory Leaks)
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order('vencimento', { ascending: false })

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    const mapped = (data || []).map(row => {
      const merged = { ...row, ...(row.dados || {}) }
      const rawDesc = String(merged.descricao || '').trim()
      const rawCod = String(merged.codigo || merged.id || '').trim()
      const isReneg =
        Boolean(merged.acordoId) ||
        merged.origemLanca === 'renegociacao' ||
        rawCod.startsWith('RNG') ||
        /^(Acordo\s+Renegocia[cç][aã]o|Entrada\s+Acordo)\b/i.test(rawDesc)
      if (isReneg) {
        if (!merged.parcela) {
          const descMatch = rawDesc.match(/\((\d+\s*\/\s*\d+)\)/)
          if (descMatch) merged.parcela = descMatch[1].replace(/\s+/g, '')
        }
        merged.descricao = rawDesc.includes('(Saldo Residual)')
          ? 'Acordo Renegociação (Saldo Residual)'
          : 'Acordo Renegociação'
      }
      return merged
    })
    const result = allowedAlunoIds
      ? mapped.filter(r => {
          const candidateId = String(r.aluno_id || r.alunoId || r.aluno || '')
          return candidateId && allowedAlunoIds!.has(candidateId)
        })
      : mapped
    
    return NextResponse.json({
      data: result,
      meta: { total: allowedAlunoIds ? result.length : (count || 0), page, limit }
    })
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()

    let usuarioNome = 'Sistema'
    if (user) {
      usuarioNome = user.user_metadata?.nome || user.user_metadata?.name || user.email || 'Sistema'
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle()
      if (dbUser?.nome) usuarioNome = dbUser.nome
    }

    const processItem = (t: any) => {
      const updated = {
        ...t,
        dataLancamento: t.dataLancamento || new Date().toISOString(),
        usuarioLancamento: t.usuarioLancamento || usuarioNome,
      }
      return ZodTituloFinanceiro.parse(buildRowAuth(updated))
    }

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      // Zod Validation para Múltiplos com injeção de auditoria
      const rows = body.map(processItem)
      
      // Upsert Seguro Assíncrono
      const { error } = await supabase.from('titulos').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      
      return NextResponse.json({ ok: true, count: rows.length })
    }

    // Zod Validation Única com injeção de auditoria
    const row = processItem(body)
    const { data, error } = await supabase.from('titulos').upsert(row, { onConflict: 'id' }).select().single()
    
    if (error) throw new Error(error.message)
    
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    const errMsg = Array.isArray(e?.errors)
      ? e.errors.map((err: any) => err.message).join('; ')
      : e?.message || 'Erro ao salvar título'
    return NextResponse.json({ error: errMsg }, { status: 400 })
  }
}

function buildRowAuth(t: any) {
  const {
    id,
    aluno,
    responsavel,
    descricao,
    valor,
    vencimento,
    pagamento,
    status,
    metodo,
    parcela,
    eventoId,
    eventoDescricao,
    evento_id,
    evento_descricao,
    created_at,
    updated_at,
    dados: prevDados,
    _parcDisplay,
    _parcCur,
    _parcTot,
    _parcCodigo,
    ...rest
  } = t

  const cleanDados = {
    ...(typeof prevDados === 'object' && prevDados !== null ? prevDados : {}),
    ...rest,
  }
  delete (cleanDados as any).dados

  return {
    id: id || crypto.randomUUID(),
    aluno: aluno || '',
    responsavel: responsavel || '',
    descricao: descricao || '',
    valor: Number(valor) || 0,
    vencimento: String(vencimento || '').slice(0, 10),
    pagamento: pagamento ? String(pagamento).slice(0, 10) : null,
    status: status || 'pendente',
    metodo: metodo || null,
    parcela: parcela || '',
    evento_id: eventoId || evento_id || null,
    evento_descricao: eventoDescricao || evento_descricao || null,
    dados: cleanDados,
    updated_at: new Date().toISOString(),
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')
    let ids: string[] = []
    const idsParam = searchParams.get('ids')
    if (idsParam) {
      ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    }

    if (!id && ids.length === 0) {
      const body = await request.json().catch(() => null)
      if (body?.id) id = String(body.id)
      if (Array.isArray(body?.ids)) {
        ids = body.ids.map((x: any) => String(x)).filter(Boolean)
      }
    }

    const targetIds = ids.length > 0 ? ids : (id ? [id] : [])
    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'ID faltando' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from('titulos').delete().in('id', targetIds)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, deletedCount: targetIds.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

