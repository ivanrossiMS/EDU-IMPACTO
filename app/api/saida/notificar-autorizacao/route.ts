import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { resolveCollaboratorUsers } from '@/lib/server/collaboratorLookup'

export const dynamic = 'force-dynamic'

/**
 * Helper para buscar inscrições e dispositivos ativos de um usuário no OneSignal
 */
async function fetchUserOneSignalSubscriptions(
  appId: string,
  apiKey: string,
  identifiers: string[]
): Promise<Array<{ id: string; type: string; enabled: boolean }>> {
  const activeSubs: Array<{ id: string; type: string; enabled: boolean }> = []
  const seenSubIds = new Set<string>()

  for (const ident of identifiers) {
    if (!ident) continue
    try {
      // 1. Tentar por external_id
      const res = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(ident)}`,
        {
          headers: { Authorization: `Basic ${apiKey}` },
          cache: 'no-store'
        }
      )
      if (res.ok) {
        const data = await res.json()
        const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
        for (const s of subs) {
          if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
            seenSubIds.add(s.id)
            activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
          }
        }
        if (activeSubs.length > 0) return activeSubs
      }
    } catch {}

    // 2. Se for alias colaborador_id / system_user_id
    try {
      const colabRes = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/colaborador_id/${encodeURIComponent(ident)}`,
        {
          headers: { Authorization: `Basic ${apiKey}` },
          cache: 'no-store'
        }
      )
      if (colabRes.ok) {
        const data = await colabRes.json()
        const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
        for (const s of subs) {
          if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
            seenSubIds.add(s.id)
            activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
          }
        }
        if (activeSubs.length > 0) return activeSubs
      }
    } catch {}

    // 3. Se for e-mail
    if (ident.includes('@')) {
      try {
        const emailRes = await fetch(
          `https://onesignal.com/api/v1/apps/${appId}/users/by/email/${encodeURIComponent(ident.toLowerCase().trim())}`,
          {
            headers: { Authorization: `Basic ${apiKey}` },
            cache: 'no-store'
          }
        )
        if (emailRes.ok) {
          const data = await emailRes.json()
          const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
          for (const s of subs) {
            if (s.id && !seenSubIds.has(s.id) && s.enabled !== false && s.notification_types !== -99) {
              seenSubIds.add(s.id)
              activeSubs.push({ id: s.id, type: s.type || 'Push', enabled: true })
            }
          }
          if (activeSubs.length > 0) return activeSubs
        }
      } catch {}
    }
  }

  return activeSubs
}

/**
 * GET /api/saida/notificar-autorizacao
 * Retorna o status de conexão de dispositivos no OneSignal para os colaboradores configurados
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabaseService = getAdminClient()
    const url = new URL(request.url)
    const userIdsParam = url.searchParams.get('userIds')

    let targetIds: string[] = []
    if (userIdsParam) {
      targetIds = userIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    } else {
      const { data: configRow } = await supabaseService
        .from('saida_config')
        .select('dados')
        .eq('id', 'default')
        .maybeSingle()
      const configDados = (configRow?.dados && typeof configRow.dados === 'object') ? configRow.dados : {}
      targetIds = Array.isArray(configDados.specialAuthNotificationUserIds)
        ? configDados.specialAuthNotificationUserIds.filter(Boolean)
        : []
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, status: {} })
    }

    const targetUsers = await resolveCollaboratorUsers(supabaseService, targetIds)

    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
    const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''

    const statusMap: Record<string, {
      hasActiveDevice: boolean
      deviceCount: number
      devices: Array<{ type: string; id: string }>
    }> = {}

    if (appId && apiKey && targetUsers.length > 0) {
      await Promise.allSettled(
        targetUsers.map(async u => {
          const idCandidates = [u.id, u.auth_id, u.email].filter(Boolean).map(String)
          const subs = await fetchUserOneSignalSubscriptions(appId, apiKey, idCandidates)
          const entry = {
            hasActiveDevice: subs.length > 0,
            deviceCount: subs.length,
            devices: subs.map(s => ({ type: s.type, id: s.id }))
          }
          if (u.id) statusMap[String(u.id)] = entry
          if (u.auth_id && u.auth_id !== u.id) statusMap[String(u.auth_id)] = entry
        })
      )
    }

    return NextResponse.json({ ok: true, status: statusMap })
  } catch (err: any) {
    console.error('[API Notificar Autorizacao GET] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/saida/notificar-autorizacao
 * Envia notificação push e emite evento Realtime para os colaboradores selecionados
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { test, userIds, callId, studentName, studentClass, authorizedPerson, targetTime } = body

    const supabaseService = getAdminClient()

    // 1. Obter a lista de IDs de colaboradores selecionados
    let targetIds: string[] = []
    if (Array.isArray(userIds) && userIds.length > 0) {
      targetIds = userIds.filter(Boolean).map(id => String(id).trim())
    } else {
      const { data: configRow } = await supabaseService
        .from('saida_config')
        .select('dados')
        .eq('id', 'default')
        .maybeSingle()
      const configDados = (configRow?.dados && typeof configRow.dados === 'object') ? configRow.dados : {}
      targetIds = Array.isArray(configDados.specialAuthNotificationUserIds)
        ? configDados.specialAuthNotificationUserIds.filter(Boolean).map((id: any) => String(id).trim())
        : []
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhum colaborador foi selecionado para receber notificações.'
      }, { status: 400 })
    }

    // 2. Buscar dados dos colaboradores com segurança contra UUID cast errors
    const effectiveUsers = await resolveCollaboratorUsers(supabaseService, targetIds)

    if (effectiveUsers.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhum dos colaboradores selecionados foi encontrado no banco de dados.'
      }, { status: 404 })
    }

    // 3. Montar lista de identificadores para o OneSignal (User Model Aliases)
    const pushTargets = new Set<string>()
    effectiveUsers.forEach(u => {
      if (u.id) pushTargets.add(String(u.id))
      if (u.auth_id) pushTargets.add(String(u.auth_id))
      if (u.email) pushTargets.add(String(u.email).toLowerCase().trim())
    })

    // 4. Buscar Subscriptions diretas no OneSignal para garantir entrega física imediata aos aparelhos
    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
    const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''
    const targetSubscriptionIds: string[] = []
    const deviceBreakdown: Record<string, string[]> = {}

    if (appId && apiKey) {
      const subQueries = effectiveUsers.map(async u => {
        const idCandidates = [u.id, u.auth_id, u.email].filter(Boolean).map(String)
        const subs = await fetchUserOneSignalSubscriptions(appId, apiKey, idCandidates)
        if (subs.length > 0) {
          deviceBreakdown[u.nome] = subs.map(s => s.type)
          subs.forEach(s => targetSubscriptionIds.push(s.id))
        }
      })
      await Promise.allSettled(subQueries)
    }

    const isTest = Boolean(test)
    const title = isTest
      ? '🔔 Teste de Notificação: Autorização Especial'
      : '📝 Nova Autorização Especial do Dia'

    const message = isTest
      ? `Notificação de teste recebida com sucesso! Você está configurado(a) para receber alertas da Portaria.`
      : `${studentName || 'Aluno'}${studentClass ? ` (${studentClass})` : ''} liberado(a) para ${authorizedPerson || 'Pessoa Autorizada'}${targetTime && targetTime !== 'Indefinido' ? ` às ${targetTime}` : ''}.`

    const pushItemId = `manual_special_auth_${Date.now()}`

    // 5. Enviar push notification (usando type 'test' quando for teste para não sofrer bloqueio de admin)
    const pushResult = await sendAgendaPushNotification({
      type: isTest ? 'test' : 'saida',
      itemId: pushItemId,
      title,
      message,
      targetUserIds: Array.from(pushTargets),
      targetSubscriptionIds: targetSubscriptionIds.length > 0 ? Array.from(new Set(targetSubscriptionIds)) : undefined,
      targetUrl: '/saida-alunos/chamadas',
      metadata: {
        tipo: 'autorizacao_especial',
        is_test: isTest,
        targetUrl: '/saida-alunos/chamadas',
        perfil_destino: 'colaborador'
      }
    })

    // 6. Emitir evento Realtime via Supabase para exibir banners imediatamente em todas as telas conectadas
    try {
      const channel = supabaseService.channel('saida_calls_shared_room')
      await channel.send({
        type: 'broadcast',
        event: 'SPECIAL_AUTH_NOTIFY',
        payload: {
          data: {
            id: callId || pushItemId,
            studentName: studentName || 'Aluno',
            studentClass: studentClass || '',
            authorizedPerson: authorizedPerson || 'Pessoa Autorizada',
            targetTime: targetTime || '',
            targetUserIds: Array.from(pushTargets),
            isTest
          }
        }
      })
      await supabaseService.removeChannel(channel)
    } catch (realtimeErr) {
      console.warn('[API Notificar Autorizacao] Falha no broadcast Realtime:', realtimeErr)
    }

    return NextResponse.json({
      ok: true,
      isTest,
      notifiedCount: effectiveUsers.length,
      users: effectiveUsers.map(u => ({ id: u.id, nome: u.nome, email: u.email })),
      directDevicesReached: targetSubscriptionIds.length,
      deviceBreakdown,
      pushResult
    })
  } catch (err: any) {
    console.error('[API Notificar Autorizacao] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
