import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  getAuditSettings,
  isProfileEligibleForAudit,
  computeSmartDiff,
  deleteLogsByRange,
  purgeLegacyPerformanceLogs,
} from '@/lib/server/auditLogger'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function checkIsAdmin(userId: string, userMetadata: any) {
  const supabase = await createProtectedClient()
  const { data: dbUser } = await supabase
    .from('system_users')
    .select('perfil, cargo')
    .eq('id', userId)
    .maybeSingle()

  const perfil = dbUser?.perfil || userMetadata?.perfil || ''
  const cargo = dbUser?.cargo || userMetadata?.cargo || ''

  return (
    perfil === 'Administrador' ||
    perfil === 'Diretor Geral' ||
    perfil === 'Admin' ||
    perfil === 'Master' ||
    cargo === 'Administrador Master' ||
    cargo === 'Diretor Geral'
  )
}

// ── GET: Consulta filtrada e paginada de logs de auditoria ───────────────────
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const isAdmin = await checkIsAdmin(user.id, user.user_metadata)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores podem visualizar os logs de auditoria.' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 200)
  const modulo = searchParams.get('modulo')?.trim() || ''
  const acao = searchParams.get('acao')?.trim() || ''
  const perfil = searchParams.get('perfil')?.trim() || ''
  const search = searchParams.get('search')?.trim() || ''
  const registroIdParam = searchParams.get('registroId')?.trim()
  const beforeDateParam = searchParams.get('beforeDate')?.trim()
  const periodo = searchParams.get('periodo') || (registroIdParam ? 'todos' : '30') // 'hoje' | '7' | '30' | '90' | 'todos' | 'custom'
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')
  const includePerformance = searchParams.get('includePerformance') === 'true'

  const supabase = getAdminClient()
  let query = supabase.from('system_logs').select('*', { count: 'exact' })

  // 1. Oculta telemetria legada de Web Vitals por padrão para manter a tela limpa
  if (!includePerformance) {
    query = query.neq('modulo', 'Performance').neq('acao', 'WEB_VITALS')
  }

  // 2. Filtro de Módulo
  if (modulo && modulo !== 'todos') {
    query = query.eq('modulo', modulo)
  }

  // 3. Filtro de Ação
  if (acao && acao !== 'todos') {
    query = query.eq('acao', acao)
  }

  // 4. Filtro de Perfil
  if (perfil && perfil !== 'todos') {
    query = query.ilike('perfil', `%${perfil}%`)
  }

  // 5. Filtro de Período / Datas
  const now = new Date()
  if (periodo === 'hoje') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    query = query.gte('data_hora', startOfDay)
  } else if (periodo === '7') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    query = query.gte('data_hora', d.toISOString())
  } else if (periodo === '30') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    query = query.gte('data_hora', d.toISOString())
  } else if (periodo === '90') {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    query = query.gte('data_hora', d.toISOString())
  } else if (periodo === 'custom' || (startDateParam && endDateParam)) {
    if (startDateParam) {
      query = query.gte('data_hora', new Date(startDateParam).toISOString())
    }
    if (endDateParam) {
      const end = new Date(endDateParam)
      end.setHours(23, 59, 59, 999)
      query = query.lte('data_hora', end.toISOString())
    }
  }

  // 6. Filtro por Registro ID e Data Anterior (para resolução de histórico de diffs)
  if (registroIdParam) {
    query = query.eq('registro_id', registroIdParam)
  }
  if (beforeDateParam) {
    query = query.lt('data_hora', new Date(beforeDateParam).toISOString())
  }

  // 7. Busca textual inteligente
  if (search) {
    query = query.or(
      `usuario_nome.ilike.%${search}%,descricao.ilike.%${search}%,nome_relacionado.ilike.%${search}%,registro_id.ilike.%${search}%`
    )
  }

  // 7. Paginação e ordenação cronológica decrescente
  const from = (page - 1) * limit
  const to = from + limit - 1

  query = query.order('data_hora', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 8. Estatísticas rápidas de resumo
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const [todayRes, settings] = await Promise.all([
    supabase
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
      .gte('data_hora', startOfToday)
      .neq('modulo', 'Performance')
      .neq('acao', 'WEB_VITALS'),
    getAuditSettings(),
  ])

  // Normalização snake_case -> camelCase para o frontend
  const formattedLogs = (data || []).map(row => ({
    id: row.id,
    dataHora: row.data_hora,
    usuarioNome: row.usuario_nome,
    perfil: row.perfil,
    modulo: row.modulo,
    acao: row.acao,
    descricao: row.descricao,
    status: row.status,
    origem: row.origem,
    registroId: row.registro_id,
    nomeRelacionado: row.nome_relacionado,
    detalhesAntes: row.detalhes_antes,
    detalhesDepois: row.detalhes_depois,
  }))

  return NextResponse.json({
    logs: formattedLogs,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1,
    },
    stats: {
      totalLogs: count || 0,
      todayCount: todayRes.count || 0,
      isPaused: settings.paused,
      autoDeleteEnabled: settings.auto_delete_enabled,
      autoDeleteDays: settings.auto_delete_days,
      lastCleanupAt: settings.last_cleanup_at,
    },
    settings,
  })
}

// ── POST: Gravação segura com verificação de perfil e pausa ─────────────────
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // 1. Verifica se a auditoria do sistema está pausada
    const settings = await getAuditSettings()
    if (settings.paused) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'audit_paused' })
    }

    // 2. Busca perfil real do usuário autenticado no sistema
    const supabase = getAdminClient()
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('nome, perfil, cargo')
      .eq('id', user.id)
      .maybeSingle()

    const sessionUserNome = dbUser?.nome || user.user_metadata?.nome || user.email || 'Colaborador'
    const sessionPerfil = dbUser?.perfil || dbUser?.cargo || user.user_metadata?.perfil || 'Colaborador'

    // 3. Regra de Negócio Crucial: Alunos e Famílias NUNCA geram logs
    if (!isProfileEligibleForAudit(sessionPerfil)) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'profile_not_tracked' })
    }

    const body = await request.json()
    const rawLogs = Array.isArray(body) ? body : [body]

    if (rawLogs.length > 100) {
      return NextResponse.json({ error: 'Limite máximo de 100 logs por requisição excedido.' }, { status: 400 })
    }

    // 4. Filtra e processa os logs aplicando Smart Diff e sanitização
    const rowsToInsert = []

    for (const log of rawLogs) {
      // Rejeita telemetria e web vitals
      if (log.modulo === 'Performance' || log.acao === 'WEB_VITALS') {
        continue
      }

      let detalhesAntesFinal = log.detalhesAntes
      if (!detalhesAntesFinal && log.registroId && (log.acao === 'Edição' || log.acao === 'Alteração')) {
        const { data: prevLog } = await supabase
          .from('system_logs')
          .select('detalhes_depois')
          .eq('registro_id', String(log.registroId))
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (prevLog && prevLog.detalhes_depois) {
          detalhesAntesFinal = prevLog.detalhes_depois
        }
      }

      const { antesDiff, depoisDiff } = computeSmartDiff(detalhesAntesFinal, log.detalhesDepois)

      rowsToInsert.push({
        id: log.id || `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data_hora: log.dataHora || new Date().toISOString(),
        usuario_nome: sessionUserNome,
        perfil: sessionPerfil,
        modulo: log.modulo || 'Geral',
        acao: log.acao || 'Ação',
        descricao: log.descricao || '',
        status: log.status || 'sucesso',
        origem: log.origem || 'sistema',
        registro_id: log.registroId ? String(log.registroId) : null,
        nome_relacionado: log.nomeRelacionado || null,
        detalhes_antes: antesDiff,
        detalhes_depois: depoisDiff,
      })
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }

    const { error } = await supabase.from('system_logs').insert(rowsToInsert)
    if (error) {
      console.error('[API system-logs] Insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, count: rowsToInsert.length })
  } catch (err: any) {
    console.error('[API system-logs] Unexpected error:', err?.message || err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── DELETE: Exclusão manual por data / período / purga ─────────────────────
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const isAdmin = await checkIsAdmin(user.id, user.user_metadata)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores podem excluir logs do sistema.' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    let body: any = {}
    try {
      body = await request.json()
    } catch {}

    const olderThanDays =
      body.olderThanDays !== undefined
        ? Number(body.olderThanDays)
        : searchParams.has('olderThanDays')
        ? parseInt(searchParams.get('olderThanDays') || '0')
        : undefined

    const beforeDate = body.beforeDate || searchParams.get('beforeDate')
    const startDate = body.startDate || searchParams.get('startDate')
    const endDate = body.endDate || searchParams.get('endDate')
    const purgePerformance = body.purgePerformance || searchParams.get('purgePerformance') === 'true'

    if (purgePerformance) {
      const res = await purgeLegacyPerformanceLogs()
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
      return NextResponse.json({ ok: true, message: 'Logs de telemetria legados foram expurgados com sucesso.' })
    }

    const res = await deleteLogsByRange({
      olderThanDays,
      beforeDate,
      startDate,
      endDate,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Registros de log excluídos com sucesso.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
