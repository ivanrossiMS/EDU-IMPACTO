import { NextResponse, type NextRequest } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  isStudentInactiveStatus,
  deleteOneSignalSubscriptionById,
  deleteOneSignalUserByAlias,
} from '@/lib/server/pushService'

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
      platform,
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
      supabase.from('alunos').select('id, status, matricula, dados').or(`id.eq.${user.id},dados->>auth_id.eq.${user.id},dados->>user_id.eq.${user.id},dados->>email.ilike.${userEmail || '__none__'}`),
    ])

    const respIds: string[] = []
    const linkedStudentIdCandidates = new Set<string>()
    for (const r of respRows || []) {
      addId(r.id)
      addId(r.dados?.auth_id)
      addId(r.dados?.user_id)
      addEmail(r.email || r.dados?.email)
      if (r.id) respIds.push(String(r.id))
      if (Array.isArray(r.dados?.alunosVinculados)) {
        r.dados.alunosVinculados.forEach((aid: unknown) => {
          addId(aid)
          if (aid && typeof aid === 'string' && aid.trim()) linkedStudentIdCandidates.add(aid.trim())
        })
      }
    }
    if (user.user_metadata?.responsavel_id) {
      respIds.push(String(user.user_metadata.responsavel_id))
    }
    if (user.user_metadata?.aluno_id) {
      linkedStudentIdCandidates.add(String(user.user_metadata.aluno_id).trim())
    }
    if (alunoId) {
      linkedStudentIdCandidates.add(String(alunoId).trim())
    }

    if (respIds.length > 0) {
      const { data: vinculos } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id')
        .in('responsavel_id', Array.from(new Set(respIds)))
      for (const v of vinculos || []) {
        addId(v.aluno_id)
        addId(v.responsavel_id)
        if (v.aluno_id) linkedStudentIdCandidates.add(String(v.aluno_id).trim())
      }
    }

    const allLinkedStudentMap = new Map<string, any>()
    for (const a of alunoRows || []) {
      addId(a.id)
      addEmail(a.dados?.email)
      if (a.id) allLinkedStudentMap.set(String(a.id).trim(), a)
    }

    const missingStudentIds = Array.from(linkedStudentIdCandidates).filter(id => !allLinkedStudentMap.has(id))
    if (missingStudentIds.length > 0) {
      const { data: extraAlunos } = await supabase
        .from('alunos')
        .select('id, status, matricula, dados')
        .or(`id.in.(${missingStudentIds.join(',')}),matricula.in.(${missingStudentIds.join(',')})`)
      for (const ea of extraAlunos || []) {
        addId(ea.id)
        if (ea.id) allLinkedStudentMap.set(String(ea.id).trim(), ea)
      }
    }

    const allLinkedStudents = Array.from(allLinkedStudentMap.values())
    const activeLinkedStudents = allLinkedStudents.filter(s => !isStudentInactiveStatus(s))
    const inactiveLinkedStudents = allLinkedStudents.filter(s => isStudentInactiveStatus(s))

    // Se o usuário NÃO é colaborador da escola e todos os alunos vinculados a ele estão INATIVOS,
    // bloqueia o registro no OneSignal e exclui imediatamente o aparelho para evitar cobrança.
    if (!isStaff && !colabIdent && allLinkedStudents.length > 0 && activeLinkedStudents.length === 0) {
      await Promise.all([
        deleteOneSignalSubscriptionById(cleanSubId, appId, apiKey),
        deleteOneSignalUserByAlias('external_id', cleanUserId, appId, apiKey),
        ...(responsavelId ? [deleteOneSignalUserByAlias('responsavel_id', String(responsavelId).trim(), appId, apiKey)] : []),
      ]).catch(() => {})

      console.log(`🧹 [Push Sync] Bloqueado e removido aparelho ${cleanSubId} do usuário inativo ${cleanUserId} (0 alunos ativos).`)
      return NextResponse.json({
        success: false,
        inactiveCleanup: true,
        subscriptionId: cleanSubId,
        userId: cleanUserId,
        message: 'Todos os alunos vinculados estão inativos. Aparelho removido do OneSignal.',
      })
    }

    // Se o responsável possui tanto filho ativo quanto inativo, garante que o alias aluno_id aponte para o filho ativo
    let effectiveAlunoId = alunoId ? String(alunoId).trim() : undefined
    if (
      effectiveAlunoId &&
      activeLinkedStudents.length > 0 &&
      inactiveLinkedStudents.some(
        s => String(s.id).trim() === effectiveAlunoId || String(s.matricula || '').trim() === effectiveAlunoId
      )
    ) {
      effectiveAlunoId = String(activeLinkedStudents[0].id).trim()
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

    // 0. Verifica o estado atual do player para detectar external_user_id ausente ou subscrição excluída
    let playerCurrentExtId: string | null = null
    let playerNotFound = false
    try {
      const checkRes = await fetch(`https://onesignal.com/api/v1/players/${cleanSubId}?app_id=${appId}`, {
        headers: { Authorization: authHeader },
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        playerCurrentExtId = checkData?.external_user_id || null
        console.log(`🔍 [Push Sync] Player ${cleanSubId} estado atual — external_user_id: "${playerCurrentExtId}"`)
      } else if (checkRes.status === 404) {
        playerNotFound = true
      }
    } catch {}

    const sanitizedIncomingTags = { ...(tags || {}) }
    for (const inact of inactiveLinkedStudents) {
      const inactId = String(inact.id).trim()
      delete sanitizedIncomingTags[`aluno_${inactId}`]
      delete sanitizedIncomingTags[`turma_${inactId}`]
    }

    const tagPayload = {
      ...sanitizedIncomingTags,
      ...(responsavelId ? { responsavel_id: String(responsavelId) } : {}),
      ...(effectiveAlunoId ? { aluno_id: String(effectiveAlunoId) } : {}),
      ...(colabIdent ? { colaborador_id: String(colabIdent) } : {}),
    }

    const hasValidPushToken = Boolean(pushToken && String(pushToken).trim().length > 0)

    // 1. Atualizar o player no OneSignal diretamente com external_user_id e tags
    // (apenas envia notification_types: 1 quando há pushToken válido para reativar em caso de rematrícula)
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
        ...(hasValidPushToken
          ? {
              notification_types: 1,
              identifier: String(pushToken).trim(),
            }
          : {}),
      }),
    })

    const playerData = await playerUpdateRes.json().catch(() => ({}))
    const wasPlayerMissing =
      playerNotFound ||
      playerUpdateRes.status === 404 ||
      (Array.isArray(playerData?.errors) &&
        playerData.errors.some((e: any) => typeof e === 'string' && e.toLowerCase().includes('not found')))

    // 1b. Se a assinatura havia sido excluída na limpeza ("Liberar Acessos") mas o aparelho enviou seu pushToken,
    // recriamos imediatamente o registro do aparelho no OneSignal via POST /api/v1/players para restaurar o push na hora!
    let effectiveSubId = cleanSubId
    let recreatedSubscriptionId: string | null = null
    if (wasPlayerMissing && hasValidPushToken) {
      try {
        const platLower = String(platform || '').toLowerCase()
        const deviceType = platLower === 'ios' ? 0 : platLower === 'android' ? 1 : 5
        const createRes = await fetch('https://onesignal.com/api/v1/players', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            app_id: appId,
            device_type: deviceType,
            identifier: String(pushToken).trim(),
            external_user_id: cleanUserId,
            tags: tagPayload,
            notification_types: 1,
          }),
        })
        const createData = await createRes.json().catch(() => ({}))
        if (createRes.ok && createData?.id) {
          recreatedSubscriptionId = String(createData.id)
          effectiveSubId = recreatedSubscriptionId
          console.log(
            `🔄 [Push Sync] Aparelho anteriormente limpo foi re-registrado automaticamente no OneSignal! Novo ID: ${recreatedSubscriptionId} (usuário: ${cleanUserId})`
          )
        }
      } catch (recreateErr: any) {
        console.warn('[Push Sync] Aviso ao recriar player excluído:', recreateErr?.message)
      }
    }

    // Só sinaliza reset no cliente se o aparelho tinha token válido mas não pôde ser recriado no servidor
    const subscriptionDeletedNeedsReset = Boolean(wasPlayerMissing && hasValidPushToken && !recreatedSubscriptionId)

    // 2. Se o player estava sem external_user_id, força re-vínculo adicional via Identity API
    // Isso corrige o estado após OneSignal.logout() que deixa o player como "anonymous"
    const needsForceRelink = !playerCurrentExtId || playerCurrentExtId !== cleanUserId
    let identityData: any = {}

    const aliases: Record<string, string> = {
      external_id: cleanUserId,
    }
    if (responsavelId) {
      aliases['responsavel_id'] = String(responsavelId).trim()
    } else if (effectiveAlunoId && !colabIdent) {
      // No OneSignal v5, aliases de identidade são 1-para-1 globalmente únicos no app.
      // Registra 'aluno_id' como alias de identidade apenas para login direto de aluno/responsável virtual
      // sem responsavel_id, evitando conflito 409 entre pai/mãe do mesmo aluno ou múltiplos filhos.
      aliases['aluno_id'] = String(effectiveAlunoId).trim()
    }
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

    // 2b. Vincular a subscrição existente ao usuário via Subscription Owner API (OneSignal v5)
    // IMPORTANTE: Nunca chamar POST /users/by/external_id/{id}/subscriptions aqui, pois esse endpoint
    // é para criar uma NOVA subscrição (e sem type/token gera registros fantasmas device_type=0 sdk=null).
    let subscriptionPatchData: any = {}
    if (!wasPlayerMissing || recreatedSubscriptionId) {
      try {
        const subPatchRes = await fetch(
          `https://onesignal.com/api/v1/apps/${appId}/subscriptions/${effectiveSubId}/owner`,
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

        console.log(`✅ [Push Sync] Vínculo via Subscription Owner API concluído:`, subPatchRes.status)
      } catch (subPatchErr: any) {
        console.warn('[Push Sync] Falha no PATCH por subscrição (não crítico):', subPatchErr?.message)
      }
    }

    console.log(`✅ [Push Sync Subscription] Aparelho ${effectiveSubId} associado ao usuário ${cleanUserId}`, {
      playerStatus: playerUpdateRes.status,
      recreatedSubscriptionId,
      identityStatus: identityRes.status,
      needsForceRelink,
      previousExtId: playerCurrentExtId || '(vazio)',
    })

    return NextResponse.json({
      success: true,
      subscriptionId: effectiveSubId,
      recreatedSubscriptionId,
      userId: cleanUserId,
      needsForceRelink,
      subscriptionDeletedNeedsReset,
      playerUpdate: playerData,
      identity: identityData,
      subscriptionPatch: subscriptionPatchData,
    })
  } catch (err: any) {
    console.error('[Push Sync Subscription Error]:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno ao sincronizar' }, { status: 500 })
  }
}
