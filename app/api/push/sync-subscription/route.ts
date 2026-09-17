import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/push/sync-subscription
 * 
 * Endpoint de dupla garantia (Server-to-Server) para vincular a Subscription do aparelho
 * ao external_id do usuário no OneSignal, garantindo:
 * 1. Associação imediata do owner via OneSignal REST API v5 mesmo se o SDK cliente falhar.
 * 2. Atualização de tags e aliases no perfil do usuário na nuvem do OneSignal.
 * 3. Limpeza automática de subscrições mortas/desinstaladas (enabled === false, sem token),
 *    evitando que a conta atinja o teto de 20 subscrições do OneSignal.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { subscriptionId, userId, aliases, tags } = body

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return NextResponse.json({ error: 'subscriptionId é obrigatório' }, { status: 400 })
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }

    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const apiKey = process.env.ONESIGNAL_REST_API_KEY

    if (!appId || !apiKey) {
      console.warn('⚠️ [sync-subscription] OneSignal API Key ou App ID não configurados no servidor.')
      return NextResponse.json({ success: false, warning: 'OneSignal não configurado no servidor' }, { status: 200 })
    }

    const cleanSubId = subscriptionId.trim()
    const cleanUserId = userId.trim()

    // 1. Transferir / associar a subscription ao external_id do usuário
    const identityPayload: Record<string, string> = {
      external_id: cleanUserId,
    }

    if (aliases && typeof aliases === 'object') {
      for (const [k, v] of Object.entries(aliases)) {
        if (typeof v === 'string' && v.trim()) {
          identityPayload[k] = v.trim()
        }
      }
    }

    const ownerRes = await fetch(`https://api.onesignal.com/apps/${appId}/subscriptions/${cleanSubId}/owner`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        identity: identityPayload,
      }),
    })

    const ownerData = await ownerRes.json().catch(() => ({}))
    if (!ownerRes.ok) {
      console.warn(`⚠️ [sync-subscription] Aviso ao associar owner da subscription ${cleanSubId}:`, ownerData)
    } else {
      console.log(`✅ [sync-subscription] Subscription ${cleanSubId} associada com sucesso ao external_id ${cleanUserId}`)
    }

    // 2. Atualizar tags do usuário se fornecidas
    if (tags && typeof tags === 'object' && Object.keys(tags).length > 0) {
      fetch(`https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${apiKey}`,
        },
        body: JSON.stringify({
          properties: {
            tags,
          },
        }),
      }).catch(err => {
        console.warn('⚠️ [sync-subscription] Erro ao sincronizar tags:', err)
      })
    }

    // 3. Limpeza proativa de subscrições mortas para prevenir o teto de 20 subscrições do OneSignal
    let cleanedCount = 0
    try {
      const userRes = await fetch(`https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}`, {
        headers: {
          Authorization: `Basic ${apiKey}`,
        },
      })

      if (userRes.ok) {
        const userData = await userRes.json()
        const subs: any[] = Array.isArray(userData.subscriptions) ? userData.subscriptions : []

        if (subs.length >= 6) {
          const deadSubs = subs.filter(
            s => s.id !== cleanSubId && s.enabled === false && (!s.token || s.token === '')
          )

          for (const dead of deadSubs) {
            try {
              const delRes = await fetch(`https://api.onesignal.com/apps/${appId}/subscriptions/${dead.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Basic ${apiKey}`,
                },
              })
              if (delRes.ok || delRes.status === 202) {
                cleanedCount++
              }
            } catch {}
          }

          if (cleanedCount > 0) {
            console.log(`🧹 [sync-subscription] ${cleanedCount} subscrições mortas podadas para o usuário ${cleanUserId}`)
          }
        }
      }
    } catch (cleanErr) {
      console.warn('⚠️ [sync-subscription] Erro na rotina de poda de subscrições:', cleanErr)
    }

    return NextResponse.json({
      success: true,
      subscriptionId: cleanSubId,
      userId: cleanUserId,
      cleanedCount,
    })
  } catch (err: any) {
    console.error('❌ [sync-subscription] Erro inesperado:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao sincronizar subscrição' }, { status: 500 })
  }
}
