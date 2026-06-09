import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendPushNotification } from '@/lib/server/pushService'

export const dynamic = 'force-dynamic'

/**
 * GET /api/push/diagnostico
 * 
 * Retorna estatísticas do sistema de push:
 * - Total de logs de notificação
 * - Logs recentes de sucesso e falha
 * - Configuração atual (sem expor chaves)
 * 
 * Acesso: apenas Administradores
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer

    // Verificar se é admin
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('perfil')
      .eq('id', user.id)
      .maybeSingle()

    if (!dbUser || dbUser.perfil !== 'Administrador') {
      return NextResponse.json({ error: 'Acesso negado. Apenas Administradores.' }, { status: 403 })
    }

    // Buscar logs recentes
    const { data: recentLogs } = await supabase
      .from('agenda_push_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    const { count: totalSent } = await supabase
      .from('agenda_push_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')

    const { count: totalFailed } = await supabase
      .from('agenda_push_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')

    const { count: totalSkipped } = await supabase
      .from('agenda_push_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'skipped')

    // Verificar configuração (sem expor chaves)
    const hasAppId = !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_APP_ID.length > 10)
    const hasRestKey = !!(process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_REST_API_KEY.length > 10)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'N/A'

    return NextResponse.json({
      config: {
        hasAppId,
        hasRestKey,
        isMockMode: !hasAppId || !hasRestKey,
        appId: hasAppId ? `${process.env.ONESIGNAL_APP_ID!.slice(0, 8)}...` : null,
        appUrl,
      },
      stats: {
        totalSent: totalSent || 0,
        totalFailed: totalFailed || 0,
        totalSkipped: totalSkipped || 0,
      },
      recentLogs: (recentLogs || []).map(log => ({
        id: log.id,
        type: log.type,
        title: log.title,
        status: log.status,
        targetCount: log.target_count || 0,
        errorMessage: log.error_message,
        createdAt: log.created_at,
        targetUrl: log.target_url,
      })),
    })
  } catch (err: any) {
    console.error('[Push Diagnostico] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/push/diagnostico
 * 
 * Body: { action: 'test-push' | 'clear-logs' }
 * 
 * test-push: Envia uma notificação de teste para o usuário logado
 * clear-logs: Limpa logs antigos (mais de 30 dias)
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer

    // Verificar se é admin
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('perfil')
      .eq('id', user.id)
      .maybeSingle()

    if (!dbUser || dbUser.perfil !== 'Administrador') {
      return NextResponse.json({ error: 'Acesso negado. Apenas Administradores.' }, { status: 403 })
    }

    const { action, userId } = await request.json()

    if (action === 'test-push') {
      const targetId = userId || String(user.id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

      console.log(`[Push Diagnostico] Enviando push de teste para: ${targetId}`)

      const result = await sendPushNotification({
        title: '🔔 Teste de Notificação',
        body: 'Sistema de Push funcionando! Esta é uma notificação de teste do EDU-IMPACTO.',
        targetUserIds: [targetId],
        url: `${appUrl}/agenda-digital`,
        data: { type: 'test', timestamp: new Date().toISOString() },
      })

      // Registrar no log
      await supabase.from('agenda_push_logs').insert({
        user_id: user.id,
        type: 'test',
        item_id: `test-${Date.now()}`,
        title: '🔔 Teste de Notificação',
        message: 'Notificação de teste enviada pelo admin.',
        target_url: `${appUrl}/agenda-digital`,
        target_count: 1,
        status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ ok: result.success, mock: result.mock, error: result.error })
    }

    if (action === 'clear-logs') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Primeiro conta quantos serão deletados, depois apaga
      const { count } = await supabase
        .from('agenda_push_logs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', thirtyDaysAgo.toISOString())

      await supabase
        .from('agenda_push_logs')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      return NextResponse.json({ ok: true, deleted: count || 0 })
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
  } catch (err: any) {
    console.error('[Push Diagnostico] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
