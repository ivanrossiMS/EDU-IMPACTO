import { NextResponse } from 'next/server'
import { requireStaff, resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  const { user, isStaff } = roleCtx

  let allowedAlunoIds: Set<string> | null = null
  if (!isStaff) {
    allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
    if (allowedAlunoIds.size === 0) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'private, no-cache',
          'X-Total-Count': '0',
          'X-Page': '1',
          'X-Limit': '1000',
        },
      })
    }
  }

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const alunoId = searchParams.get('alunoId')
  const q = searchParams.get('q')

  if (allowedAlunoIds && alunoId && !allowedAlunoIds.has(String(alunoId))) {
    return NextResponse.json({ error: 'Acesso negado aos títulos deste aluno.' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limitParam = searchParams.get('limit')
  const all = searchParams.get('all') === 'true'
  const limit = all ? 10000 : (limitParam ? Math.min(10000, Math.max(1, parseInt(limitParam, 10))) : 1000)

  let query = supabase.from('titulos').select('*', { count: 'exact' })
  
  const accessStartDate = await getLoggedUserAccessStartDate()
  if (accessStartDate && !alunoId) {
    query = query.gte('created_at', accessStartDate.toISOString())
  }

  if (status && status !== 'Todos' && status !== 'todos') query = query.eq('status', status)
  if (alunoId) {
    const safeId = alunoId.replace(/[^A-Za-z0-9_-]/g, '')
    if (safeId) {
      query = query.or(`aluno.eq.${safeId},aluno_id.eq.${safeId},dados->>alunoId.eq.${safeId},dados->>aluno_id.eq.${safeId}`)
    }
  } else if (allowedAlunoIds) {
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
  }
  if (q) {
    const safeQ = q.replace(/[%_().,]/g, '')
    if (safeQ) query = query.or(`aluno.ilike.%${safeQ}%,descricao.ilike.%${safeQ}%,codigo.ilike.%${safeQ}%`)
  }

  query = query.order('vencimento', { ascending: false })
  if (!all) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (data || []).map(row => ({
    ...row,
    ...(row.dados_bancarios || {}),
    ...(row.dados || {}),
    // map snake_case back to camelCase for frontend
    alunoId: row.aluno_id ?? row.dados?.alunoId ?? row.dados?.aluno_id,
    eventoId: row.evento_id ?? row.dados?.eventoId ?? row.dados?.evento_id,
    eventoDescricao: row.evento_descricao ?? row.dados?.eventoDescricao ?? row.dados?.evento_descricao,
    dataNascimento: row.data_nascimento ?? row.dados?.dataNascimento,
  }))
  const result = allowedAlunoIds
    ? mapped.filter(r => {
        const candidateId = String(r.alunoId || r.aluno_id || r.aluno || '')
        return candidateId && allowedAlunoIds!.has(candidateId)
      })
    : mapped
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, no-cache',
      'X-Total-Count': String(allowedAlunoIds ? result.length : (count ?? result.length)),
      'X-Page': String(page),
      'X-Limit': String(limit)
    }
  })
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const {
      id, codigo, aluno, alunoId, responsavel, descricao, categoria, valor,
      vencimento, pagamento, data_pagamento, status, metodo, forma_pagamento,
      parcela, turma, ano, eventoId, eventoDescricao,
      nossonumero, codigo_barras, linha_digitavel, dados,
      ...dadosBancarios
    } = body

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

    const codigoFinal = codigo || `TIT-${Math.floor(Math.random() * 90000) + 10000}`
    const dadosPayload = {
      ...(typeof dados === 'object' && dados !== null ? dados : {}),
      codigo: codigoFinal,
      alunoId: alunoId || '',
      responsavel: responsavel || '',
      metodo: metodo || forma_pagamento || null,
      pagamento: pagamento || data_pagamento || null,
      parcela: parcela || '',
      turma: turma || '',
      ano: ano || new Date().getFullYear(),
      eventoId: eventoId || '',
      eventoDescricao: eventoDescricao || '',
      dadosBancarios: {
        ...dadosBancarios,
        dataLancamento: dadosBancarios.dataLancamento || new Date().toISOString(),
        usuarioLancamento: dadosBancarios.usuarioLancamento || usuarioNome,
      },
      dataLancamento: dadosBancarios.dataLancamento || new Date().toISOString(),
      usuarioLancamento: dadosBancarios.usuarioLancamento || usuarioNome,
    }

    const row = {
      id: id || `TIT${Date.now()}`,
      descricao: descricao || '',
      categoria: categoria || eventoDescricao || 'Mensalidade',
      aluno: aluno || '',
      valor: Number(valor) || 0,
      vencimento: vencimento || '',
      status: status || 'pendente',
      forma_pagamento: forma_pagamento || metodo || null,
      data_pagamento: data_pagamento || pagamento || null,
      nossonumero: nossonumero || dadosBancarios.nossoNumero || dadosBancarios.nossonumero || null,
      codigo_barras: codigo_barras || dadosBancarios.codigoBarras || dadosBancarios.codigo_barras || null,
      linha_digitavel: linha_digitavel || dadosBancarios.linhaDigitavel || dadosBancarios.linha_digitavel || null,
      dados: dadosPayload,
    }

    const { data, error } = await supabase.from('titulos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data?.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
