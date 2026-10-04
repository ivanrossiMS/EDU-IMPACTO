import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  getAuditSettings,
  updateAuditSettings,
  deleteLogsByRange,
  purgeLegacyPerformanceLogs,
} from '@/lib/server/auditLogger'

export const dynamic = 'force-dynamic'

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

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const isAdmin = await checkIsAdmin(user.id, user.user_metadata)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Acesso restrito a administradores.' },
      { status: 403 }
    )
  }

  try {
    const supabase = getAdminClient()
    const settings = await getAuditSettings()

    // Métricas rápidas da tabela
    const [totalRes, perfRes, oldestRes] = await Promise.all([
      supabase.from('system_logs').select('*', { count: 'exact', head: true }),
      supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .or('modulo.eq.Performance,acao.eq.WEB_VITALS'),
      supabase
        .from('system_logs')
        .select('data_hora')
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    return NextResponse.json({
      settings,
      stats: {
        totalLogs: totalRes.count || 0,
        performanceLogs: perfRes.count || 0,
        businessLogs: Math.max(0, (totalRes.count || 0) - (perfRes.count || 0)),
        oldestLogDate: oldestRes.data?.data_hora || null,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const isAdmin = await checkIsAdmin(user.id, user.user_metadata)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Apenas administradores podem alterar configurações de auditoria.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    // 1. Purga explícita de telemetria legada
    if (body.purgePerformanceNow) {
      const res = await purgeLegacyPerformanceLogs()
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 })
      }
      return NextResponse.json({ ok: true, message: 'Logs legados de performance limpos com sucesso.' })
    }

    // 2. Executar limpeza imediata com base nos dias configurados
    if (body.runCleanupNow) {
      const current = await getAuditSettings()
      const days = body.days || current.auto_delete_days || 90
      const res = await deleteLogsByRange({ olderThanDays: days })
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 })
      }
      await updateAuditSettings({ last_cleanup_at: new Date().toISOString() })
      return NextResponse.json({ ok: true, message: `Limpeza de logs anteriores a ${days} dias concluída.` })
    }

    // 3. Atualizar configurações normais
    const updated = await updateAuditSettings({
      paused: typeof body.paused === 'boolean' ? body.paused : undefined,
      auto_delete_enabled:
        typeof body.auto_delete_enabled === 'boolean' ? body.auto_delete_enabled : undefined,
      auto_delete_days:
        typeof body.auto_delete_days === 'number' ? body.auto_delete_days : undefined,
    })

    return NextResponse.json({ ok: true, settings: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
