import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { APIListQuerySchema, ZodTituloFinanceiro } from '@/lib/server/zodSchemas'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
    
    // 2. Supabase Authenticated (RLS Enforced)
    const supabase = await createProtectedClient()

    let query = supabase.from('titulos').select('*', { count: 'exact' })

    const accessStartDate = await getLoggedUserAccessStartDate()
    if (accessStartDate) {
      query = query.gte('created_at', accessStartDate.toISOString())
    }

    if (status && status !== 'todos') query = query.eq('status', status)
    if (aluno) {
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

    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    
    return NextResponse.json({
      data: result,
      meta: { total: count || 0, page, limit }
    })
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    const { data: { user } } = await supabase.auth.getUser()
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
      const { error } = await supabase.from('titulos').upsert(rows)
      if (error) throw new Error(error.message)
      
      return NextResponse.json({ ok: true, count: rows.length })
    }

    // Zod Validation Única com injeção de auditoria
    const row = processItem(body)
    const { data, error } = await supabase.from('titulos').upsert(row).select().single()
    
    if (error) throw new Error(error.message)
    
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    // Retorna os erros estritos de tipagem do Zod
    return NextResponse.json({ error: e.errors || e.message }, { status: 400 })
  }
}

function buildRowAuth(t: any) {
  const { id, aluno, responsavel, descricao, valor, vencimento, pagamento, status, metodo, parcela, eventoId, eventoDescricao, ...rest } = t
  return {
    id: id || crypto.randomUUID(), // Usando spec nativa segura
    aluno: aluno || '',
    responsavel: responsavel || '',
    descricao: descricao || '',
    valor: Number(valor) || 0,
    vencimento: vencimento || '',
    pagamento: pagamento || null,
    status: status || 'pendente',
    metodo: metodo || null,
    parcela: parcela || '',
    evento_id: eventoId || null,
    evento_descricao: eventoDescricao || null,
    dados: rest,
    updated_at: new Date().toISOString(),
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID faltando' }, { status: 400 })

    const supabase = await createProtectedClient()
    const { error } = await supabase.from('titulos').delete().eq('id', id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

