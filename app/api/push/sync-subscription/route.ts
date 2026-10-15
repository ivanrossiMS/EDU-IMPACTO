import { NextResponse, type NextRequest } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

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
    const { user, dbUser, isStaff, errorResponse } = await resolveUserRole(request)
    if (errorResponse || !user) {
      return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      subscriptionId,
      pushToken,
      userId,
      responsavelId,
      alunoId,
      colaboradorId,
      systemUserId,
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
    const colabIdent = colaboradorId || systemUserId

    // Validar que os identificadores pertencem ao usuário autenticado
    const allowedIds = new Set<string>()
    const allowedEmails = new Set<string>()
    const addId = (val: unknown) => {
      if (val && typeof val === 'string' && val.trim()) allowedIds.add(val.trim())
    }
    const addEmail = (val: unknown) => {
      if (val && typeof val === 'string' && val.trim()) {
        allowedEmails.add(val.trim().toLowerCase())
        allowedIds.add(val.trim().toLowerCase())
      }
    }

    addId(user.id)
    addId(dbUser?.id)
    addId(dbUser?.auth_id)
    addId(user.user_metadata?.responsavel_id)
    addId(user.user_metadata?.aluno_id)
    addId(user.user_metadata?.colaborador_id)
    addId(user.user_metadata?.system_user_id)
    addId(user.user_metadata?.uid_legacy)
    addId(dbUser?.dados?.responsavel_id)
    addId(dbUser?.dados?.aluno_id)
    addId(dbUser?.dados?.colaborador_id)
    addEmail(user.email)
    addEmail(dbUser?.email)

    const supabase = getAdminClient()
    const userEmail = (user.email || dbUser?.email || '').trim().toLowerCase()

    // Resolver vínculos reais no banco para responsáveis, alunos e colaboradores
    const orFilters = [
      `id.eq.${user.id}`,
      `dados->>auth_id.eq.${user.id}`,
      `dados->>user_id.eq.${user.id}`,
    ]
    if (userEmail) orFilters.push(`email.ilike.${userEmail}`)

    const [{ data: respRows }, { data: alunoRows }] = await Promise.all([
      supabase.from('responsaveis').select('id, email, dados').or(orFilters.join(',')),
      supabase.from('alunos').select('id, dados').or(`id.eq.${user.id},dados->>email.ilike.${userEmail || '__none__'}`),
    ])

    const respIds: string[] = []
    for (const r of respRows || []) {
      addId(r.id)
      addId(r.dados?.auth_id)
      addId(r.dados?.user_id)
      addEmail(r.email || r.dados?.email)
      if (r.id) respIds.push(String(r.id))
      if (Array.isArray(r.dados?.alunosVinculados)) {
        r.dados.alunosVinculados.forEach((aid: unknown) => addId(aid))
      }
    }
    if (user.user_metadata?.responsavel_id) {
      respIds.push(String(user.user_metadata.responsavel_id))
    }

    if (respIds.length > 0) {
      const { data: vinculos } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id')
        .in('responsavel_id', Array.from(new Set(respIds)))
      for (const v of vinculos || []) {
        addId(v.aluno_id)
        addId(v.responsavel_id)
      }
    }

    for (const a of alunoRows || []) {
      addId(a.id)
      addEmail(a.dados?.email)
    }

    const isAdmin = isStaff && ['administrador', 'administrador master', 'admin', 'diretor', 'diretor geral', 'master'].includes(
      String(dbUser?.perfil || dbUser?.cargo || user.user_metadata?.perfil || '').toLowerCase().trim()
    )

    if (!isAdmin) {
      if (!allowedIds.has(cleanUserId) && !allowedIds.has(cleanUserId.toLowerCase())) {
        return NextResponse.json(
          { error: 'Acesso negado: userId não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
      if (responsavelId && !allowedIds.has(String(responsavelId).trim())) {
        return NextResponse.json(
          { error: 'Acesso negado: responsavelId não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
      if (alunoId && !allowedIds.has(String(alunoId).trim())) {
        return NextResponse.json(
          { error: 'Acesso negado: alunoId não está vinculado ao usuário autenticado.' },
          { status: 403 }
        )
      }
      if (colabIdent && (!isStaff || !allowedIds.has(String(colabIdent).trim()))) {
        return NextResponse.json(
          { error: 'Acesso negado: colaboradorId inválido para o usuário autenticado.' },
          { status: 403 }
        )
      }
      if (email && !allowedEmails.has(String(email).trim().toLowerCase())) {
        return NextResponse.json(
          { error: 'Acesso negado: email não pertence ao usuário autenticado.' },
          { status: 403 }
        )
      }
    }

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
      ...(colabIdent ? { colaborador_id: String(colabIdent) } : {}),
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
    if (colabIdent) {
      aliases['colaborador_id'] = String(colabIdent).trim()
      aliases['system_user_id'] = String(colabIdent).trim()
    }
    if (email) aliases['email'] = String(email).toLowerCase().trim()

    // 2a. PATCH na identidade do usuário OneSignal pelo external_id
    let identityRes = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}/identity`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          identity: aliases,
        }),
      }
    )
    identityData = await identityRes.json().catch(() => ({}))

    // Se houver conflito de aliases (409 - One or more Aliases claimed by another User):
    if (identityRes.status === 409 && Array.isArray(identityData?.errors)) {
      console.warn(`⚠️ [Push Sync] Conflito de aliases no OneSignal detectado (409). Auto-recuperando...`, identityData.errors)
      for (const err of identityData.errors) {
        if (err.meta && typeof err.meta === 'object') {
          for (const [conflictLabel, conflictVal] of Object.entries(err.meta)) {
            try {
              const holderRes = await fetch(
                `https://onesignal.com/api/v1/apps/${appId}/users/by/${encodeURIComponent(conflictLabel)}/${encodeURIComponent(String(conflictVal))}`,
                { headers: { Authorization: authHeader } }
              )
              if (holderRes.ok) {
                const holderData = await holderRes.json()
                const holderExtId = holderData.identity?.external_id
                if (holderExtId && holderExtId !== cleanUserId) {
                  const hasActiveSubs = Array.isArray(holderData.subscriptions) && holderData.subscriptions.some((s: any) => s.enabled !== false && s.notification_types !== -99)
                  if (!hasActiveSubs || !holderData.subscriptions || holderData.subscriptions.length === 0) {
                    console.log(`🧹 [Push Sync] Deletando usuário órfão que segurava alias ${conflictLabel}=${conflictVal} (ext_id: ${holderExtId})...`)
                    await fetch(`https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(holderExtId)}`, {
                      method: 'DELETE',
                      headers: { Authorization: authHeader }
                    })
                  } else {
                    console.log(`✂️ [Push Sync] Removendo alias conflitante ${conflictLabel} do usuário anterior ${holderExtId}...`)
                    await fetch(`https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(holderExtId)}/identity/${encodeURIComponent(conflictLabel)}`, {
                      method: 'DELETE',
                      headers: { Authorization: authHeader }
                    })
                  }
                }
              }
            } catch (cleanupErr: any) {
              console.warn(`[Push Sync] Falha ao liberar alias ${conflictLabel}:`, cleanupErr?.message)
            }
          }
        }
      }

      // Re-tentar o PATCH após a liberação dos aliases órfãos
      try {
        identityRes = await fetch(
          `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}/identity`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify({ identity: aliases }),
          }
        )
        identityData = await identityRes.json().catch(() => ({}))
        console.log(`✅ [Push Sync] Re-tentativa de vínculo pós-resolução de conflito:`, identityRes.status)
      } catch {}
    }

    // 2b. Sempre vincular a subscrição ao usuário via Subscription Owner API e Users Subscriptions API (OneSignal v5)
    let subscriptionPatchData: any = {}
    try {
      // 1. PATCH /subscriptions/{sub_id}/owner transfere ou vincula a subscrição diretamente ao external_id
      const subPatchRes = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/subscriptions/${cleanSubId}/owner`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ identity: { external_id: cleanUserId } }),
        }
      )
      subscriptionPatchData = await subPatchRes.json().catch(() => ({}))

      // 2. Adicionalmente associa a subscrição ao usuário via POST /users/by/external_id/{id}/subscriptions
      await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(cleanUserId)}/subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ subscription: { id: cleanSubId } }),
        }
      ).catch(() => {})

      console.log(`✅ [Push Sync] Vínculo via Subscription Owner API concluído:`, subPatchRes.status)
    } catch (subPatchErr: any) {
      console.warn('[Push Sync] Falha no PATCH por subscrição (não crítico):', subPatchErr?.message)
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
