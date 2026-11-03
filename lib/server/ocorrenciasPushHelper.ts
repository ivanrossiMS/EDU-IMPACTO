import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveCollaboratorUsers, CollaboratorUser } from '@/lib/server/collaboratorLookup'
import { getColaboradorIds, getInstitutionalMasterAdminIds } from '@/lib/server/notificationHelper'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const OCORRENCIAS_PUSH_CONFIG_KEY = 'ocorrencias_push_config'

export interface OcorrenciasPushConfig {
  /** Habilita globalmente o envio de notificações push de ocorrências para colaboradores selecionados */
  enabled: boolean
  /** Envia push aos colaboradores marcados quando uma nova ocorrência é registrada */
  notifyOnNewOcorrencia: boolean
  /** Envia push aos colaboradores marcados quando a família confirma ciência de uma ocorrência */
  notifyOnCienciaConfirmada: boolean
  /** Emite alerta em tempo real (banner/som) nas telas abertas dos colaboradores marcados */
  notifyRealtimeSound: boolean
  /** IDs dos colaboradores selecionados (system_users.id) */
  selectedUserIds: string[]
  /** Indica se a configuração já foi salva manualmente pelo menos uma vez */
  configured: boolean
  updatedAt?: string
}

export const DEFAULT_OCORRENCIAS_PUSH_CONFIG: OcorrenciasPushConfig = {
  enabled: true,
  notifyOnNewOcorrencia: true,
  notifyOnCienciaConfirmada: true,
  notifyRealtimeSound: true,
  selectedUserIds: [],
  configured: false,
}

/**
 * Busca inscrições e dispositivos ativos de um usuário no OneSignal (iOS, Android, Web Push)
 */
export async function fetchUserOneSignalSubscriptions(
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
          cache: 'no-store',
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

    // 2. Se for alias colaborador_id
    try {
      const colabRes = await fetch(
        `https://onesignal.com/api/v1/apps/${appId}/users/by/colaborador_id/${encodeURIComponent(ident)}`,
        {
          headers: { Authorization: `Basic ${apiKey}` },
          cache: 'no-store',
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
            cache: 'no-store',
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
 * Obtém os IDs primários (system_users.id) dos Administradores Master ativos
 * para servir como seleção inicial caso a configuração ainda não tenha sido salva no banco.
 */
async function getInitialMasterAdminPrimaryIds(supabaseService: any): Promise<string[]> {
  try {
    const { data: adminUsers, error } = await supabaseService
      .from('system_users')
      .select('id, cargo, perfil, status')
      .or('status.neq.inativo,status.is.null')
      .limit(100)

    if (error || !adminUsers) return []

    const masterRoles = [
      'administrador master',
      'administrador',
      'admin',
      'diretor geral',
      'diretora geral',
      'master',
    ]

    const ids: string[] = []
    adminUsers.forEach((u: any) => {
      const cargo = String(u.cargo || '').toLowerCase().trim()
      const perfil = String(u.perfil || '').toLowerCase().trim()
      if ((masterRoles.includes(cargo) || masterRoles.includes(perfil)) && u.id) {
        ids.push(String(u.id))
      }
    })
    return Array.from(new Set(ids))
  } catch {
    return []
  }
}

/**
 * Lê a configuração de notificações push de ocorrências da tabela `configuracoes`.
 * Se ainda não houver configuração salva, pré-popula com os Administradores Master ativos.
 */
export async function getOcorrenciasPushConfig(): Promise<OcorrenciasPushConfig> {
  try {
    const supabaseService = getAdminClient()
    const { data: row } = await supabaseService
      .from('configuracoes')
      .select('valor, updated_at')
      .eq('chave', OCORRENCIAS_PUSH_CONFIG_KEY)
      .maybeSingle()

    const val = row?.valor
    if (val && typeof val === 'object') {
      const selectedUserIds: string[] = Array.isArray(val.selectedUserIds)
        ? Array.from(new Set<string>(val.selectedUserIds.map((id: any) => String(id || '').trim()).filter(Boolean)))
        : []

      return {
        enabled: val.enabled ?? true,
        notifyOnNewOcorrencia: val.notifyOnNewOcorrencia ?? true,
        notifyOnCienciaConfirmada: val.notifyOnCienciaConfirmada ?? true,
        notifyRealtimeSound: val.notifyRealtimeSound ?? true,
        selectedUserIds,
        configured: Boolean(val.configured ?? true),
        updatedAt: val.updatedAt || row?.updated_at || undefined,
      }
    }

    // Fallback inicial antes do primeiro salvamento: pré-seleciona os Administradores Master
    const initialIds = await getInitialMasterAdminPrimaryIds(supabaseService)
    return {
      ...DEFAULT_OCORRENCIAS_PUSH_CONFIG,
      selectedUserIds: initialIds,
      configured: false,
    }
  } catch (err) {
    console.warn('[OcorrenciasPushHelper] Erro ao carregar ocorrencias_push_config:', err)
    return { ...DEFAULT_OCORRENCIAS_PUSH_CONFIG }
  }
}

/**
 * Salva a configuração de notificações push de ocorrências na tabela `configuracoes`.
 */
export async function saveOcorrenciasPushConfig(
  partial: Partial<OcorrenciasPushConfig>
): Promise<OcorrenciasPushConfig> {
  const supabaseService = getAdminClient()
  const current = await getOcorrenciasPushConfig()

  const selectedUserIds = Array.isArray(partial.selectedUserIds)
    ? Array.from(new Set(partial.selectedUserIds.map(id => String(id || '').trim()).filter(Boolean)))
    : current.selectedUserIds

  const nextConfig: OcorrenciasPushConfig = {
    enabled: partial.enabled ?? current.enabled ?? true,
    notifyOnNewOcorrencia: partial.notifyOnNewOcorrencia ?? current.notifyOnNewOcorrencia ?? true,
    notifyOnCienciaConfirmada: partial.notifyOnCienciaConfirmada ?? current.notifyOnCienciaConfirmada ?? true,
    notifyRealtimeSound: partial.notifyRealtimeSound ?? current.notifyRealtimeSound ?? true,
    selectedUserIds,
    configured: true,
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabaseService
    .from('configuracoes')
    .upsert({
      chave: OCORRENCIAS_PUSH_CONFIG_KEY,
      valor: nextConfig,
      updated_at: nextConfig.updatedAt,
    })

  if (error) {
    throw new Error(error.message)
  }

  // Invalidar cache global de /api/configuracoes se existir no processo
  const globalCache = (globalThis as any).configCache
  if (globalCache && typeof globalCache.clear === 'function') {
    globalCache.clear()
  }

  return nextConfig
}

/**
 * Resolve os colaboradores selecionados em todos os seus aliases do OneSignal e busca suas subscriptions diretas.
 */
export async function resolveOcorrenciasCollaboratorTargets(customUserIds?: string[]): Promise<{
  config: OcorrenciasPushConfig
  effectiveUsers: CollaboratorUser[]
  pushTargets: string[]
  targetSubscriptionIds: string[]
  deviceBreakdown: Record<string, string[]>
}> {
  const supabaseService = getAdminClient()
  const config = await getOcorrenciasPushConfig()

  const rawTargetIds = Array.isArray(customUserIds)
    ? customUserIds.map(id => String(id || '').trim()).filter(Boolean)
    : config.selectedUserIds

  if (rawTargetIds.length === 0) {
    // Se ainda não foi configurado manualmente e a lista veio vazia por algum motivo, fallback seguro
    if (!customUserIds && !config.configured) {
      const masterIds = await getInstitutionalMasterAdminIds()
      return {
        config,
        effectiveUsers: [],
        pushTargets: masterIds,
        targetSubscriptionIds: [],
        deviceBreakdown: {},
      }
    }
    return {
      config,
      effectiveUsers: [],
      pushTargets: [],
      targetSubscriptionIds: [],
      deviceBreakdown: {},
    }
  }

  const [effectiveUsers, expandedColabIds] = await Promise.all([
    resolveCollaboratorUsers(supabaseService, rawTargetIds),
    getColaboradorIds(rawTargetIds),
  ])

  const pushTargetsSet = new Set<string>(expandedColabIds)
  effectiveUsers.forEach(u => {
    if (u.id) pushTargetsSet.add(String(u.id))
    if (u.auth_id) pushTargetsSet.add(String(u.auth_id))
    if (u.email) pushTargetsSet.add(String(u.email).toLowerCase().trim())
  })

  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''
  const targetSubscriptionIds: string[] = []
  const deviceBreakdown: Record<string, string[]> = {}

  if (appId && apiKey && effectiveUsers.length > 0) {
    await Promise.allSettled(
      effectiveUsers.map(async u => {
        const idCandidates = [u.id, u.auth_id, u.email].filter(Boolean).map(String)
        const subs = await fetchUserOneSignalSubscriptions(appId, apiKey, idCandidates)
        if (subs.length > 0) {
          deviceBreakdown[u.nome] = subs.map(s => s.type)
          subs.forEach(s => targetSubscriptionIds.push(s.id))
        }
      })
    )
  }

  return {
    config,
    effectiveUsers,
    pushTargets: Array.from(pushTargetsSet).filter(Boolean),
    targetSubscriptionIds: Array.from(new Set(targetSubscriptionIds)),
    deviceBreakdown,
  }
}

export interface NotifyOcorrenciaColaboradoresParams {
  action: 'nova_ocorrencia' | 'ciencia_confirmada' | 'teste'
  ocorrenciaId: string
  alunoId?: string
  alunoNome?: string
  turmaNome?: string
  senderUserId?: string
  senderId?: string
  senderName?: string
  senderEmail?: string | null
  senderCargo?: string
  senderFoto?: string | null
  customUserIds?: string[]
}

/**
 * Envia notificação push e broadcast Realtime sobre ocorrência exclusivamente para os colaboradores
 * marcados nas configurações de ocorrências (`ocorrencias_push_config`).
 */
export async function notifyOcorrenciaToColaboradores(params: NotifyOcorrenciaColaboradoresParams) {
  const {
    action,
    ocorrenciaId,
    alunoId,
    alunoNome,
    turmaNome,
    senderUserId,
    senderId,
    senderName,
    senderEmail,
    senderCargo,
    senderFoto,
    customUserIds,
  } = params

  const isTest = action === 'teste'
  const {
    config,
    effectiveUsers,
    pushTargets,
    targetSubscriptionIds,
    deviceBreakdown,
  } = await resolveOcorrenciasCollaboratorTargets(customUserIds)

  if (!isTest) {
    if (!config.enabled) {
      return {
        ok: true,
        skipped: true,
        reason: 'ocorrencias_colab_push_disabled',
        notifiedCount: 0,
      }
    }
    if (action === 'nova_ocorrencia' && !config.notifyOnNewOcorrencia) {
      return {
        ok: true,
        skipped: true,
        reason: 'notify_on_new_ocorrencia_disabled',
        notifiedCount: 0,
      }
    }
    if (action === 'ciencia_confirmada' && !config.notifyOnCienciaConfirmada) {
      return {
        ok: true,
        skipped: true,
        reason: 'notify_on_ciencia_disabled',
        notifiedCount: 0,
      }
    }
  }

  if (pushTargets.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: 'no_collaborators_selected',
      notifiedCount: 0,
      error: 'Nenhum colaborador está selecionado para receber notificações de ocorrências.',
    }
  }

  const cleanNomeAluno = alunoNome?.trim() || 'o aluno'
  const turmaSuffix = turmaNome?.trim() ? ` (${turmaNome.trim()})` : ''

  let title = '⚠️ Nova Ocorrência Escolar'
  let message = `Uma nova ocorrência foi registrada para ${cleanNomeAluno}${turmaSuffix}.`
  let pushItemId = `colab_${ocorrenciaId}`

  if (isTest) {
    title = '🔔 Teste de Notificação: Ocorrências Escolares'
    message = 'Notificação de teste recebida com sucesso! Você está configurado(a) para receber alertas de ocorrências disciplinares.'
    pushItemId = `test_ocorr_${Date.now()}`
  } else if (action === 'ciencia_confirmada') {
    title = '✍️ Ciência de Ocorrência Confirmada'
    message = `A família de ${cleanNomeAluno}${turmaSuffix} confirmou ciência da ocorrência.`
    pushItemId = `ciencia_${ocorrenciaId}`
  } else if (senderName && senderName !== 'Colaborador') {
    message = `${senderName} registrou uma nova ocorrência para ${cleanNomeAluno}${turmaSuffix}.`
  }

  const targetUrl = ocorrenciaId && !isTest
    ? `/academico/ocorrencias?id=${encodeURIComponent(String(ocorrenciaId))}`
    : '/academico/ocorrencias'

  const pushResult = await sendAgendaPushNotification({
    type: isTest ? 'test' : 'ocorrencias',
    itemId: pushItemId,
    senderUserId,
    title,
    message,
    targetUserIds: pushTargets,
    targetSubscriptionIds: targetSubscriptionIds.length > 0 ? targetSubscriptionIds : undefined,
    collapseId: isTest ? `test_oc_${Date.now()}` : `oc_colab_${ocorrenciaId}`,
    targetUrl,
    metadata: {
      item_id: String(ocorrenciaId || pushItemId),
      ocorrencia_id: String(ocorrenciaId || ''),
      rota: 'ocorrencias',
      action,
      is_test: isTest,
      perfil_destino: 'colaborador',
      context: 'colaborador',
      isColab: true,
      targetUrl,
      sender_id: senderId || senderUserId || null,
      sender_auth_id: senderUserId || null,
      sender_name: senderName || 'Sistema',
      sender_email: senderEmail || null,
      sender_cargo: senderCargo || 'Equipe Escolar',
      sender_foto: senderFoto || null,
      ...(alunoId ? { student_ref_id: String(alunoId) } : {}),
    },
  })

  // Broadcast Realtime para exibir banner imediato e alerta sonoro nas telas conectadas dos colaboradores selecionados
  if (isTest || config.notifyRealtimeSound !== false) {
    try {
      const supabaseService = getAdminClient()
      const channel = supabaseService.channel('ocorrencias_push_shared_room')
      await channel.send({
        type: 'broadcast',
        event: 'OCORRENCIA_PUSH_NOTIFY',
        payload: {
          data: {
            id: ocorrenciaId || pushItemId,
            title,
            message,
            action,
            studentName: cleanNomeAluno,
            studentClass: turmaNome || '',
            targetUserIds: pushTargets,
            targetUrl,
            notifySound: config.notifyRealtimeSound !== false,
            isTest,
          },
        },
      })
      await supabaseService.removeChannel(channel)
    } catch (rtErr) {
      console.warn('[OcorrenciasPushHelper] Aviso no broadcast Realtime:', rtErr)
    }
  }

  return {
    ok: true,
    isTest,
    notifiedCount: effectiveUsers.length || rawCountFallback(pushTargets),
    users: effectiveUsers.map(u => ({ id: u.id, nome: u.nome, email: u.email })),
    directDevicesReached: targetSubscriptionIds.length,
    deviceBreakdown,
    pushResult,
  }
}

function rawCountFallback(targets: string[]): number {
  return Math.max(1, Math.ceil(targets.length / 2))
}
