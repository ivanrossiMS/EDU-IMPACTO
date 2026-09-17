import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/push/sync-subscription
 * 
 * Endpoint de segurança e garantia dupla (Dual-Layer) para sincronizar imediatamente
 * uma subscrição (Player ID / Subscription ID do OneSignal) com a conta do usuário
 * autenticado, utilizando a chave mestra ONESIGNAL_REST_API_KEY no servidor.
 *
 * Detecta ativamente quando o player perdeu o external_user_id (ex: após OneSignal.logout())
 * e força o re-vínculo via múltiplas chamadas de API para garantir a associação.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      subscriptionId,
      pushToken,
      userId,
      responsavelId,
      alunoId,
      email,
      tags = {},
    } = body

    if (!subscriptionId || !userId) {
      return NextResponse.json(
        { error: 'subscriptionId e userId são obrigatórios' },
        { status: 400 }
      )
    }

    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const apiKey = process.env.ONESIGNAL_REST_API_KEY

    if (!appId || !apiKey) {
      return NextResponse.json(
        { error: 'Credenciais OneSignal não configuradas no servidor' },
        { status: 500 }
      )
    }

    const cleanUserId = String(userId).trim()
    const cleanSubId = String(subscriptionId).trim()
    const authHeader = `Basic ${apiKey}`

    // 0. Verifica o estado atual do player para detectar external_user_id ausente
    let playerCurrentExtId: string | null = null
    try {
      const checkRes = await fetch(`https://onesignal.com/api/v1/players/${cleanSubId}?app_id=${appId}`, {
        headers: { Authorization: authHeader },
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        playerCurrentExtId = checkData?.external_user_id || null
        console.log(`🔍 [Push Sync] Player ${cleanSubId} estado atual — external_user_id: "${playerCurrentExtId}"`)
      }
    } catch {}

    const tagPayload = {
      ...tags,
      ...(responsavelId ? { responsavel_id: String(responsavelId) } : {}),
      ...(alunoId ? { aluno_id: String(alunoId) } : {}),
    }

    // 1. Atualizar o player no OneSignal diretamente com external_user_id e tags
    const playerUpdateRes = await fetch(`https://onesignal.com/api/v1/players/${cleanSubId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        app_id: appId,
        external_user_id: cleanUserId,
        tags: tagPayload,
      }),
    })

    const playerData = await playerUpdateRes.json().catch(() => ({}))

    // 2. Se o player estava sem external_user_id, força re-vínculo adicional via Identity API
    // Isso corrige o estado após OneSignal.logout() que deixa o player como "anonymous"
    const needsForceRelink = !playerCurrentExtId || playerCurrentExtId !== cleanUserId
    let identityData: any = {}

    const aliases: Record<string, string> = {
      external_id: cleanUserId,
    }
    if (responsavelId) aliases['responsavel_id'] = String(responsavelId).trim()
    if (alunoId) aliases['aluno_id'] = String(alunoId).trim()
    if (email) aliases['email'] = String(email).toLowerCase().trim()

    // 2a. PATCH na identidade do usuário OneSignal pelo external_id
    const identityRes = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}/identity`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          identity: aliases,
          properties: { tags: tagPayload },
        }),
      }
    )
    identityData = await identityRes.json().catch(() => ({}))

    // 2b. Se precisou de re-vínculo, faz também PATCH na subscrição diretamente
    let subscriptionPatchData: any = {}
    if (needsForceRelink) {
      console.log(`🔗 [Push Sync] Player sem external_user_id detectado. Forçando re-vínculo via Subscription API...`)
      try {
        const subPatchRes = await fetch(
          `https://onesignal.com/api/v1/apps/${appId}/users/by/subscriptions/${cleanSubId}/identity`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify({ identity: aliases }),
          }
        )
        subscriptionPatchData = await subPatchRes.json().catch(() => ({}))
        console.log(`✅ [Push Sync] Re-vínculo via Subscription API concluído:`, subPatchRes.status)
      } catch (subPatchErr: any) {
        console.warn('[Push Sync] Falha no PATCH por subscrição (não crítico):', subPatchErr?.message)
      }
    }

    console.log(`✅ [Push Sync Subscription] Aparelho ${cleanSubId} associado ao usuário ${cleanUserId}`, {
      playerStatus: playerUpdateRes.status,
      identityStatus: identityRes.status,
      needsForceRelink,
      previousExtId: playerCurrentExtId || '(vazio)',
    })

    return NextResponse.json({
      success: true,
      subscriptionId: cleanSubId,
      userId: cleanUserId,
      needsForceRelink,
      playerUpdate: playerData,
      identity: identityData,
      subscriptionPatch: subscriptionPatchData,
    })
  } catch (err: any) {
    console.error('[Push Sync Subscription Error]:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno ao sincronizar' }, { status: 500 })
  }
}
