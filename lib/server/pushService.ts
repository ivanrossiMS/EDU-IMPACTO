/**
 * pushService.ts — Serviço de envio de Push Notifications via OneSignal
 * 
 * SEGURANÇA: Este módulo roda APENAS no servidor (API Routes/Edge).
 * A REST API Key do OneSignal NUNCA é exposta no frontend.
 * 
 * Arquitetura:
 * - Suporta segmentação por Aliases do User Model (external_id, responsavel_id, aluno_id)
 * - Suporta fallback automático para legacy include_external_user_ids (v1 API)
 * - Garante 100% de entrega para Web Push, Android (Capacitor/Cordova) e iOS
 * - Implementa retry automático em falhas de rede (503, 429)
 * - Respeita LGPD: sem dados sensíveis no corpo da notificação
 */

export interface PushPayload {
  title: string
  body: string
  /**
   * IDs dos usuários no banco de dados.
   * Devem corresponder ao que foi passado em OneSignal.login(userId) no frontend.
   * O OneSignal busca por external_id, responsavel_id e aluno_id.
   */
  targetUserIds?: string[]
  /**
   * Subscription IDs diretos (ou Player IDs do OneSignal) para teste direcionado ao aparelho.
   */
  targetSubscriptionIds?: string[]
  collapseId?: string
  url?: string
  data?: Record<string, any>
  sendAfter?: string // formato: "2024-01-01 20:00:00 GMT-0300"
  smallIcon?: string
  largeIcon?: string
  imageUrl?: string
  /** Se true, dispara mesmo com notificações pausadas (para testes manuais no painel) */
  bypassPause?: boolean
}

export interface PushResult {
  success: boolean
  mock?: boolean
  skipped?: boolean
  paused?: boolean
  noSubscribers?: boolean
  data?: any
  error?: string
  statusCode?: number
  retriesUsed?: number
  recipients?: number
  notificationId?: string
}

const MAX_RETRIES = 2
const RETRY_DELAYS_MS = [1000, 3000] // 1s, 3s

/**
 * Tenta enviar a notificação para a API do OneSignal com retry automático.
 */
async function attemptSend(
  payload: Record<string, any>,
  apiKey: string,
  attempt: number = 0
): Promise<PushResult> {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const responseBody = await response.text()
    let parsedBody: any = {}

    try {
      parsedBody = JSON.parse(responseBody)
    } catch {
      parsedBody = { raw: responseBody }
    }

    if (response.ok) {
      const notificationId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : ''
      const hasValidId = notificationId.length > 0

      // Checar se a API retornou erro explícito de ausência total de inscritos
      let allUnsubscribed = false
      let onlyInvalidAliases = false
      if (parsedBody.errors) {
        if (Array.isArray(parsedBody.errors)) {
          allUnsubscribed = parsedBody.errors.some((e: any) =>
            typeof e === 'string' && e.toLowerCase().includes('not subscribed')
          )
        } else if (typeof parsedBody.errors === 'string') {
          allUnsubscribed = parsedBody.errors.toLowerCase().includes('not subscribed')
        } else if (typeof parsedBody.errors === 'object' && parsedBody.errors.invalid_aliases) {
          onlyInvalidAliases = true
        }
      }

      // No OneSignal v1 API com include_aliases, a contagem de destinatários é assíncrona
      // e o campo 'recipients' pode não vir na resposta HTTP síncrona.
      // Se 'id' for um UUID válido e não houver erro explícito de ausência total de inscritos,
      // a notificação foi aceita e enfileirada com sucesso pelo OneSignal.
      let recipientCount = parsedBody.recipients ?? parsedBody.num_recipients
      if (recipientCount === undefined) {
        recipientCount = (hasValidId && !allUnsubscribed) ? 1 : 0
      }

      if (!hasValidId || (recipientCount === 0 && (allUnsubscribed || onlyInvalidAliases))) {
        const isNoSubscribers = allUnsubscribed || onlyInvalidAliases
        const errorDetail = allUnsubscribed
          ? 'All included players are not subscribed'
          : (parsedBody.errors ? JSON.stringify(parsedBody.errors) : 'No subscribed recipients found')
        console.warn(`⚠️ [PushService] OneSignal retornou 0 destinatários inscritos (Recipients: 0).`, {
          id: notificationId || 'N/A',
          targetCount: payload.include_aliases?.external_id?.length || payload.include_aliases?.colaborador_id?.length || payload.include_aliases?.responsavel_id?.length || payload.include_external_user_ids?.length || 0,
          errors: parsedBody.errors || null,
        })
        return {
          success: false,
          noSubscribers: isNoSubscribers,
          data: parsedBody,
          statusCode: response.status,
          recipients: 0,
          error: errorDetail,
        }
      } else {
        console.log(`✅ [PushService] Push aceito pelo OneSignal com sucesso! ID: ${notificationId} | Destinatários ativos: ${recipientCount}`)
      }
      return {
        success: true,
        data: parsedBody,
        statusCode: response.status,
        recipients: recipientCount,
        notificationId: notificationId || undefined,
      }
    }

    // Auto-recuperação: se o OneSignal rejeitar porque o android_channel_id ou existing_android_channel_id
    // não existe no dashboard/aparelho, reenvia imediatamente sem o canal para garantir 100% de entrega a todos os aparelhos
    const isChannelError =
      response.status === 400 &&
      (Boolean(payload.android_channel_id) || Boolean(payload.existing_android_channel_id)) &&
      (
        (Array.isArray(parsedBody.errors) && parsedBody.errors.some((e: any) => typeof e === 'string' && (e.includes('android_channel_id') || e.includes('channel')))) ||
        (typeof parsedBody.errors === 'string' && (parsedBody.errors.includes('android_channel_id') || parsedBody.errors.includes('channel'))) ||
        (typeof responseBody === 'string' && (responseBody.includes('android_channel_id') || responseBody.includes('channel')))
      )

    if (isChannelError) {
      console.warn(`⚠️ [PushService] OneSignal rejeitou canal android. Reenviando automaticamente sem canal para garantir a entrega aos dispositivos...`)
      const payloadWithoutChannel = { ...payload }
      delete payloadWithoutChannel.android_channel_id
      delete payloadWithoutChannel.existing_android_channel_id
      return attemptSend(payloadWithoutChannel, apiKey, attempt)
    }

    // Erro de negócio (400) — sem retry
    if (response.status === 400) {
      console.error(`❌ [PushService] Erro 400 (Bad Request) - Verifique o payload:`, parsedBody)
      return { success: false, error: responseBody, statusCode: 400 }
    }

    // Erro de autenticação — sem retry
    if (response.status === 401 || response.status === 403) {
      console.error(`❌ [PushService] Erro de autenticação (${response.status}) - Verifique a REST API Key do OneSignal`)
      return { success: false, error: 'Authentication failed. Check ONESIGNAL_REST_API_KEY.', statusCode: response.status }
    }

    // Erros temporários (rate limit / servidor) — fazer retry
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt] || 3000
      console.warn(`⚠️ [PushService] Erro ${response.status} — Retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return attemptSend(payload, apiKey, attempt + 1)
    }

    console.error(`❌ [PushService] Erro ${response.status} após ${attempt} retries:`, parsedBody)
    return { success: false, error: responseBody, statusCode: response.status, retriesUsed: attempt }

  } catch (networkErr: any) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt] || 3000
      console.warn(`⚠️ [PushService] Erro de rede — Retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms:`, networkErr.message)
      await new Promise(resolve => setTimeout(resolve, delay))
      return attemptSend(payload, apiKey, attempt + 1)
    }

    console.error(`❌ [PushService] Falha de rede crítica após ${attempt} retries:`, networkErr.message)
    return { success: false, error: networkErr.message, retriesUsed: attempt }
  }
}

/**
 * Envia um push notification via API do OneSignal.
 * Usa estratégia híbrida (User Model Aliases + Fallback Legacy) para garantir 100% de entrega.
 */
export async function sendPushNotification(params: PushPayload): Promise<PushResult> {
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || ''
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || ''

  if (!params.bypassPause) {
    try {
      const { getPushPauseStatus, isNotificationExemptFromPause } = await import('@/lib/server/pushPauseService')
      const pauseStatus = await getPushPauseStatus()
      if (pauseStatus.paused) {
        const exemption = isNotificationExemptFromPause(pauseStatus, {
          alunoId: params.data?.aluno_id || params.data?.alunoId || params.data?.student_id,
          targetUserIds: params.targetUserIds,
        })
        if (exemption.exempt && exemption.matchedTargetIds.length > 0) {
          params.targetUserIds = exemption.matchedTargetIds
        } else {
          console.log('⏸️ [PushService] Envio interceptado: Notificações push estão pausadas globalmente no sistema.')
          return {
            success: true,
            skipped: true,
            paused: true,
            error: 'Notificações push estão pausadas globalmente pelo administrador.',
          }
        }
      }
    } catch (pauseErr) {
      console.warn('⚠️ [PushService] Falha ao verificar status de pausa:', pauseErr)
    }
  }

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn('⚠️ [PushService] MODO MOCK: Variáveis ONESIGNAL_APP_ID e/ou ONESIGNAL_REST_API_KEY não configuradas.')
    console.log('📋 [PushService] Payload simulado:', {
      title: params.title,
      body: params.body,
      targetCount: params.targetUserIds?.length ?? 0,
      url: params.url,
    })
    return { success: true, mock: true }
  }

  const rawTargetUserIds = Array.from(
    new Set(
      (params.targetUserIds || [])
        .filter(id => id && typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim())
        .filter(id => id !== 'undefined' && id !== 'null')
    )
  )

  const hasSubscriptionTargets = Boolean(params.targetSubscriptionIds && params.targetSubscriptionIds.length > 0)

  if (rawTargetUserIds.length === 0 && !hasSubscriptionTargets) {
    console.log('[PushService] Nenhum destinatário válido informado. Push ignorado.')
    return { success: true, skipped: true }
  }

  // Expandir com IDs sem prefixos (ex: remove 'f_', 'a_', 'func_') para garantir matching com UUIDs canônicos e aliases
  const uniqueTargetUserIds = Array.from(
    new Set(
      rawTargetUserIds
        .flatMap(id => {
          const cleaned = id.replace(/^(?:f_|func_|eq_|g_|a_|_ALU)/i, '').trim()
          return cleaned && cleaned !== id ? [id, cleaned] : [id]
        })
        .map(id => id.trim())
        .filter(id => id.length > 0 && id !== 'undefined' && id !== 'null')
    )
  )

  if (uniqueTargetUserIds.length === 0 && !hasSubscriptionTargets) {
    console.log('[PushService] Nenhum destinatário válido após sanitização. Push ignorado.')
    return { success: true, skipped: true }
  }

  // Limitar a 300 destinatários por chamada:
  // O OneSignal impõe limite máximo de 2.000 aliases somando todas as chaves de include_aliases.
  // Como enviamos até 6 chaves por ID (external_id, colaborador_id, system_user_id, responsavel_id, aluno_id, email),
  // 300 IDs × 6 chaves = 1.800 aliases <= 2.000.
  const maxChunkSize = 300
  if (uniqueTargetUserIds.length > maxChunkSize) {
    console.warn(`⚠️ [PushService] ${uniqueTargetUserIds.length} destinatários excedem o limite por lote (${maxChunkSize}). Enviando em lotes sequenciais...`)
    const chunks: string[][] = []
    for (let i = 0; i < uniqueTargetUserIds.length; i += maxChunkSize) {
      chunks.push(uniqueTargetUserIds.slice(i, i + maxChunkSize))
    }

    const results: PushResult[] = []
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx]
      const result = await sendPushNotification({ ...params, targetUserIds: chunk })
      results.push(result)
      if (idx < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 350))
      }
    }
    const anyOk = results.some(r => r.success)
    return { success: anyOk, data: results }
  }

  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net').replace(/\/$/, '')

  // Extrair rota interna relativa para uso no aplicativo móvel
  const relativeRoute = (() => {
    if (!params.url) return undefined
    try {
      if (params.url.startsWith('http://') || params.url.startsWith('https://')) {
        const p = new URL(params.url)
        return p.pathname + p.search
      }
    } catch {}
    return params.url.replace(/^[a-zA-Z0-9._-]+:\/*/, '/')
  })()

  // web_url para OneSignal: OBRIGATORIAMENTE deve começar com http:// ou https://
  const absoluteWebUrl = params.url
    ? (params.url.startsWith('http://') || params.url.startsWith('https://')
        ? params.url
        : `${appBaseUrl}${params.url.startsWith('/') ? '' : '/'}${params.url}`)
    : undefined

  // app_url no OneSignal: Apenas schemes customizados (ex: impactoedu://).
  // NUNCA passar caminhos relativos (/...) nem URLs http(s) no app_url para evitar erro 400 no OneSignal.
  const customSchemeAppUrl = Boolean(
    params.url &&
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(params.url) &&
    !params.url.startsWith('http://') &&
    !params.url.startsWith('https://')
  ) ? params.url : undefined

  const resolvedCollapseId = (() => {
    const rawBase = params.collapseId || params.data?.call_id || params.data?.item_id
    if (!rawBase) return undefined
    const baseStr = String(rawBase).trim()
    if (!baseStr) return undefined

    const rawAlunoId = params.data?.aluno_id || params.data?.alunoId || params.data?.student_id
    const rawPerfil = params.data?.perfil_destino || params.data?.context
    const cleanAlunoId = rawAlunoId ? String(rawAlunoId).trim().replace(/[^a-zA-Z0-9_-]/g, '') : ''
    const cleanPerfil = rawPerfil ? String(rawPerfil).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) : ''

    const scopePrefix = cleanAlunoId
      ? `alu_${cleanAlunoId}_`
      : cleanPerfil
        ? `prf_${cleanPerfil}_`
        : ''

    const combined =
      scopePrefix && !baseStr.startsWith(scopePrefix) && !(cleanAlunoId && baseStr.includes(`_${cleanAlunoId}`))
        ? `${scopePrefix}${baseStr}`
        : baseStr

    if (combined.length <= 64) return combined

    if (scopePrefix && combined.startsWith(scopePrefix)) {
      const remaining = 64 - scopePrefix.length
      if (remaining > 8) {
        return `${scopePrefix}${baseStr.slice(-remaining)}`
      }
    }
    return combined.slice(0, 64)
  })()

  const commonFields = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: params.title, pt: params.title },
    contents: { en: params.body, pt: params.body },
    ...(absoluteWebUrl && {
      web_url: absoluteWebUrl,
      ...(customSchemeAppUrl ? { app_url: customSchemeAppUrl } : {}),
    }),
    data: {
      ...(params.data || {}),
      ...(params.url && {
        targetUrl: params.url,
        target_url: params.url,
        url: params.url,
        route: relativeRoute,
      }),
    },
    ...(resolvedCollapseId ? { collapse_id: resolvedCollapseId } : {}),
    ...(params.sendAfter && { send_after: params.sendAfter }),
    chrome_web_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    adm_large_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    ...(params.smallIcon && { small_icon: params.smallIcon }),
    ...(params.largeIcon && { large_icon: params.largeIcon }),
    ...(params.imageUrl && { big_picture: params.imageUrl, ios_attachments: { id1: params.imageUrl } }),
    // Configurações para entrega prioritária com app fechado (iOS e Android)
    priority: 10,
    content_available: true,
    ios_sound: 'default',
    ios_badgeType: 'Increase',
    ios_badgeCount: 1,
    android_sound: 'default',
    existing_android_channel_id: process.env.ONESIGNAL_ANDROID_CHANNEL_ID?.trim() || 'impacto_edu_default',
    ...(process.env.ONESIGNAL_DASHBOARD_CHANNEL_ID ? { android_channel_id: process.env.ONESIGNAL_DASHBOARD_CHANNEL_ID.trim() } : {}),
    android_accent_color: 'FF4F46E5',
    android_visibility: 1,
    ttl: 86400,
  }

  const validSubIds = (params.targetSubscriptionIds || [])
    .filter(id => id && typeof id === 'string' && id.trim().length > 0)
    .map(id => id.trim())

  // ── CASO 1: Envio direcionado exclusivamente a Subscription IDs (ex: teste unitário de aparelho) ──
  if (validSubIds.length > 0 && uniqueTargetUserIds.length === 0) {
    console.log(`🎯 [PushService] Envio direcionado exclusivamente a ${validSubIds.length} Subscription ID(s):`, validSubIds)
    const directSubPayload: Record<string, any> = {
      ...commonFields,
      include_subscription_ids: validSubIds,
    }
    let directSubResult = await attemptSend(directSubPayload, ONESIGNAL_REST_API_KEY)
    if (!directSubResult.success && directSubResult.statusCode === 400) {
      console.warn(`⚠️ [PushService] Tentando fallback para include_player_ids...`)
      const playerPayload = { ...commonFields, include_player_ids: validSubIds }
      directSubResult = await attemptSend(playerPayload, ONESIGNAL_REST_API_KEY)
    }
    return directSubResult
  }

  // ── CASO 2: Envio primário consolidado por Usuário no OneSignal (include_aliases) ──
  console.log(`🔔 [PushService] Envio consolidado (include_aliases) para ${uniqueTargetUserIds.length} destinatários (expandidos)...`)
  const emailAliases = uniqueTargetUserIds.filter(id => id.includes('@')).map(e => e.toLowerCase())
  const externalIdPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      external_id: uniqueTargetUserIds,
      colaborador_id: uniqueTargetUserIds,
      system_user_id: uniqueTargetUserIds,
      responsavel_id: uniqueTargetUserIds,
      aluno_id: uniqueTargetUserIds,
      ...(emailAliases.length > 0 ? { email: emailAliases } : {}),
    },
    target_channel: 'push',
  }
  const resultExternalId = await attemptSend(externalIdPayload, ONESIGNAL_REST_API_KEY)
  const externalIdSucceeded = resultExternalId.success &&
    Boolean(resultExternalId.data?.id && typeof resultExternalId.data.id === 'string' && resultExternalId.data.id.trim() !== '') &&
    (resultExternalId.recipients ?? 0) > 0

  if (externalIdSucceeded) {
    return resultExternalId
  }

  // Se Subscription IDs explícitos foram informados e o envio por aliases não entregou, tenta envio direto por Subscription IDs
  if (validSubIds.length > 0) {
    console.warn(`⚠️ [PushService] Tentando fallback explícito para ${validSubIds.length} Subscription ID(s)...`)
    const directSubPayload: Record<string, any> = {
      ...commonFields,
      include_subscription_ids: validSubIds,
    }
    const directSubResult = await attemptSend(directSubPayload, ONESIGNAL_REST_API_KEY)
    if (directSubResult.success && (directSubResult.recipients ?? 0) > 0) {
      return directSubResult
    }
  }

  // Apenas se houve erro de formato/schema (HTTP 400) no include_aliases, faz no máximo 1 fallback para include_external_user_ids.
  // Se a API já respondeu 200 com 0 inscritos ("All included players are not subscribed"), não repete chamadas HTTP redundantes.
  if (!resultExternalId.success && resultExternalId.statusCode === 400) {
    console.warn(`⚠️ [PushService] Erro 400 em include_aliases. Executando fallback único (include_external_user_ids)...`)
    const legacyPayload: Record<string, any> = {
      ...commonFields,
      include_external_user_ids: uniqueTargetUserIds,
    }
    return await attemptSend(legacyPayload, ONESIGNAL_REST_API_KEY)
  }

  return resultExternalId
}

/**
 * Consulta o status e estatísticas de entrega reais de uma notificação diretamente no OneSignal.
 * Permite obter a contagem exata de entregas por plataforma (iOS, Android, Web).
 */
export async function getNotificationStats(notificationId: string): Promise<any | null> {
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || ''
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY || !notificationId) return null

  try {
    const res = await fetch(`https://onesignal.com/api/v1/notifications/${encodeURIComponent(notificationId)}?app_id=${ONESIGNAL_APP_ID}`, {
      headers: {
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── GESTÃO DE CICLO DE VIDA: LIMPEZA DE INATIVOS NO ONESIGNAL ───────────────

const INACTIVE_STUDENT_STATUSES = new Set([
  'inativo',
  'inativa',
  'evadido',
  'transferido',
  'cancelado',
])

/**
 * Verifica se um registro de aluno está com status inativo/desligado.
 */
export function isStudentInactiveStatus(student: any): boolean {
  if (!student) return false
  if (student.inativo === true) return true
  const rawStatus = String(student.status ?? student.dados?.status ?? '')
    .trim()
    .toLowerCase()
  return INACTIVE_STUDENT_STATUSES.has(rawStatus)
}

/**
 * Verifica se um registro de system_users pertence exclusivamente a perfil Família/Aluno
 * (ou seja, NÃO é colaborador/professor/administrativo da escola).
 */
export function isFamilyOnlySystemUserRole(sysRow: any): boolean {
  if (!sysRow) return true
  const rawRole = String(
    sysRow.perfil || sysRow.cargo || sysRow.dados?.perfil || sysRow.dados?.cargo || ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!rawRole) return true
  return ['responsavel', 'aluno', 'pai', 'mae', 'familia'].includes(rawRole)
}

interface OneSignalUserLookupResult {
  found: boolean
  onesignalId: string | null
  externalId: string | null
  identity: Record<string, string>
  subscriptionIds: string[]
  tags: Record<string, string>
}

async function fetchOneSignalUserByAlias(
  appId: string,
  apiKey: string,
  aliasLabel: string,
  aliasValue: string
): Promise<OneSignalUserLookupResult> {
  const empty: OneSignalUserLookupResult = {
    found: false,
    onesignalId: null,
    externalId: null,
    identity: {},
    subscriptionIds: [],
    tags: {},
  }
  if (!aliasValue || !aliasValue.trim()) return empty

  try {
    const url = `https://onesignal.com/api/v1/apps/${appId}/users/by/${encodeURIComponent(aliasLabel)}/${encodeURIComponent(aliasValue.trim())}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return empty
    const data = await res.json().catch(() => null)
    if (!data) return empty

    const identity: Record<string, string> = {}
    if (data.identity && typeof data.identity === 'object') {
      for (const [k, v] of Object.entries(data.identity)) {
        if (typeof v === 'string' && v.trim()) {
          identity[k] = v.trim()
        }
      }
    }

    const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
    const subscriptionIds = subs
      .map((s: any) => (typeof s?.id === 'string' ? s.id.trim() : ''))
      .filter(Boolean)

    const tags: Record<string, string> = {}
    if (data.properties?.tags && typeof data.properties.tags === 'object') {
      for (const [k, v] of Object.entries(data.properties.tags)) {
        if (v !== undefined && v !== null) {
          tags[k] = String(v)
        }
      }
    }

    return {
      found: true,
      onesignalId: identity.onesignal_id || null,
      externalId: identity.external_id || null,
      identity,
      subscriptionIds,
      tags,
    }
  } catch {
    return empty
  }
}

/**
 * Exclui definitivamente uma subscrição/aparelho no OneSignal (v1 Player API + v5 Subscription API).
 */
export async function deleteOneSignalSubscriptionById(
  subId: string,
  appIdOverride?: string,
  apiKeyOverride?: string
): Promise<boolean> {
  const appId = appIdOverride || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = apiKeyOverride || process.env.ONESIGNAL_REST_API_KEY || ''
  if (!appId || !apiKey || !subId) return false

  const cleanSubId = subId.trim()
  let ok = false

  try {
    const resPlayer = await fetch(
      `https://onesignal.com/api/v1/players/${encodeURIComponent(cleanSubId)}?app_id=${encodeURIComponent(appId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
    if (resPlayer.ok || resPlayer.status === 404) ok = true
  } catch {}

  try {
    const resSub = await fetch(
      `https://onesignal.com/api/v1/apps/${encodeURIComponent(appId)}/users/by/subscriptions/${encodeURIComponent(cleanSubId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
    if (resSub.ok || resSub.status === 404) ok = true
  } catch {}

  try {
    await fetch(
      `https://onesignal.com/api/v1/apps/${encodeURIComponent(appId)}/subscriptions/${encodeURIComponent(cleanSubId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
  } catch {}

  return ok
}

/**
 * Exclui o registro de Usuário (User Model v5) no OneSignal por um alias.
 */
export async function deleteOneSignalUserByAlias(
  aliasLabel: string,
  aliasValue: string,
  appIdOverride?: string,
  apiKeyOverride?: string
): Promise<boolean> {
  const appId = appIdOverride || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = apiKeyOverride || process.env.ONESIGNAL_REST_API_KEY || ''
  if (!appId || !apiKey || !aliasLabel || !aliasValue) return false

  try {
    const res = await fetch(
      `https://onesignal.com/api/v1/apps/${encodeURIComponent(appId)}/users/by/${encodeURIComponent(aliasLabel)}/${encodeURIComponent(aliasValue.trim())}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

export interface InactiveStudentCleanupResult {
  success: boolean
  skipped?: boolean
  studentId: string
  studentName?: string
  deletedSubscriptionsCount: number
  deletedUsersCount: number
  deletedSubscriptionIds: string[]
  cleanedGuardianIds: string[]
  protectedGuardianIds: string[]
}

/**
 * Remove do OneSignal todos os aparelhos/subscrições de um aluno inativado (ou excluído)
 * e de seus responsáveis, preservando automaticamente:
 * 1. Responsáveis que possuam outro(s) filho(s) ATIVO(S) na escola;
 * 2. Responsáveis que também sejam colaboradores ativos da escola (Duplo Papel).
 */
export async function cleanupOneSignalForInactiveStudent(
  studentId: string,
  options?: {
    forceTreatAsInactive?: boolean
    extraResponsavelIds?: string[]
  }
): Promise<InactiveStudentCleanupResult> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''

  const baseResult: InactiveStudentCleanupResult = {
    success: true,
    studentId: String(studentId || ''),
    deletedSubscriptionsCount: 0,
    deletedUsersCount: 0,
    deletedSubscriptionIds: [],
    cleanedGuardianIds: [],
    protectedGuardianIds: [],
  }

  if (!appId || !apiKey || !studentId) {
    return { ...baseResult, skipped: true }
  }

  try {
    const { getAdminClient, findAuthUserByEmail } = await import('@/lib/server/supabaseAdminSingleton')
    const supabase = getAdminClient()

    const { data: student } = await supabase
      .from('alunos')
      .select('id, nome, matricula, status, email, dados')
      .eq('id', String(studentId).trim())
      .maybeSingle()

    if (student?.nome) {
      baseResult.studentName = student.nome
    }

    const treatStudentAsInactive =
      options?.forceTreatAsInactive === true ||
      (student ? isStudentInactiveStatus(student) : false)

    const hasExtraResps = Array.isArray(options?.extraResponsavelIds) && options!.extraResponsavelIds!.length > 0
    if (!treatStudentAsInactive && !hasExtraResps) {
      return { ...baseResult, skipped: true }
    }

    const studentRefs = Array.from(
      new Set(
        [
          studentId,
          student?.id,
          student?.matricula,
          student?.dados?.codigo,
          student?.dados?.id,
          student?.dados?.matricula,
        ]
          .filter(Boolean)
          .map(v => String(v).trim())
          .filter(Boolean)
      )
    )
    const studentRefsSet = new Set(studentRefs)

    // 1. Buscar todos os vínculos de responsáveis deste aluno
    const { data: studentLinks } = studentRefs.length > 0
      ? await supabase
          .from('aluno_responsavel')
          .select('aluno_id, responsavel_id')
          .in('aluno_id', studentRefs)
      : { data: [] as any[] }

    const candidateRespIds = new Set<string>()
    for (const l of studentLinks || []) {
      if (l?.responsavel_id) candidateRespIds.add(String(l.responsavel_id).trim())
    }
    for (const extraId of options?.extraResponsavelIds || []) {
      if (extraId && String(extraId).trim()) candidateRespIds.add(String(extraId).trim())
    }

    // Identificadores protegidos (responsáveis com outro filho ativo ou colaboradores)
    const protectedIdentifiers = new Set<string>()
    const addProtected = (val: unknown) => {
      if (val && typeof val === 'string' && val.trim()) {
        protectedIdentifiers.add(val.trim())
        protectedIdentifiers.add(val.trim().toLowerCase())
      }
    }

    // Alvos elegíveis para exclusão completa no OneSignal
    const targetAliasesToDelete: Array<{ label: string; id: string }> = []
    const addTargetAlias = (label: string, val: unknown) => {
      if (!val || typeof val !== 'string' || !val.trim()) return
      const clean = label === 'email' ? val.trim().toLowerCase() : val.trim()
      if (protectedIdentifiers.has(clean) || protectedIdentifiers.has(clean.toLowerCase())) return
      if (!targetAliasesToDelete.some(t => t.label === label && t.id === clean)) {
        targetAliasesToDelete.push({ label, id: clean })
      }
    }

    // 2. Avaliar cada responsável vinculado
    for (const respId of Array.from(candidateRespIds)) {
      const [{ data: guardian }, { data: allRespLinks }] = await Promise.all([
        supabase
          .from('responsaveis')
          .select('id, nome, email, auth_id, dados')
          .eq('id', respId)
          .maybeSingle(),
        supabase
          .from('aluno_responsavel')
          .select('aluno_id')
          .eq('responsavel_id', respId),
      ])

      const linkedAlunoIds = new Set<string>()
      for (const rl of allRespLinks || []) {
        if (rl?.aluno_id) linkedAlunoIds.add(String(rl.aluno_id).trim())
      }
      if (Array.isArray(guardian?.dados?.alunosVinculados)) {
        for (const aid of guardian.dados.alunosVinculados) {
          if (aid) linkedAlunoIds.add(String(aid).trim())
        }
      }

      // Se o aluno atual está sendo inativado/excluído, desconsideramos ele na busca de irmãos ativos
      const otherAlunoIds = Array.from(linkedAlunoIds).filter(aid =>
        treatStudentAsInactive ? !studentRefsSet.has(aid) : true
      )

      let activeSiblings: any[] = []
      if (otherAlunoIds.length > 0) {
        const { data: otherStudents } = await supabase
          .from('alunos')
          .select('id, nome, matricula, status, dados')
          .or(`id.in.(${otherAlunoIds.join(',')}),matricula.in.(${otherAlunoIds.join(',')})`)

        activeSiblings = (otherStudents || []).filter(s => {
          if (treatStudentAsInactive && studentRefsSet.has(String(s.id).trim())) return false
          return !isStudentInactiveStatus(s)
        })
      }

      const guardianEmail = String(guardian?.email || guardian?.dados?.email || '')
        .trim()
        .toLowerCase()
      const guardianAuthId = String(
        guardian?.auth_id || guardian?.dados?.auth_id || guardian?.dados?.user_id || ''
      ).trim()

      // Verificar se o responsável é colaborador ativo da escola
      const sysOrConds = [`dados->>responsavel_id.eq.${respId}`, `id.eq.${respId}`]
      if (guardianAuthId) sysOrConds.push(`id.eq.${guardianAuthId}`, `auth_id.eq.${guardianAuthId}`)
      if (guardianEmail) sysOrConds.push(`email.ilike.${guardianEmail}`)

      const [{ data: sysRows }, { data: funcRows }] = await Promise.all([
        supabase
          .from('system_users')
          .select('id, auth_id, email, status, perfil, cargo, dados')
          .or(sysOrConds.join(',')),
        guardianEmail
          ? supabase
              .from('funcionarios')
              .select('id, email, status')
              .ilike('email', guardianEmail)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const isStaffMember =
        (sysRows || []).some(
          r => !isFamilyOnlySystemUserRole(r) && String(r.status || '').toLowerCase() !== 'inativo'
        ) ||
        (funcRows || []).some(f => String(f.status || '').toLowerCase() !== 'inativo')

      const hasOtherActiveChildren = activeSiblings.length > 0

      if (hasOtherActiveChildren || isStaffMember) {
        // PROTEGIDO: Não excluir os aparelhos deste responsável!
        baseResult.protectedGuardianIds.push(respId)
        addProtected(respId)
        addProtected(guardianAuthId)
        addProtected(guardianEmail)
        for (const sr of sysRows || []) {
          addProtected(sr.id)
          addProtected(sr.auth_id)
          addProtected(sr.email)
        }

        // Se o responsável continua ativo por causa de outro filho, atualizamos o alias aluno_id
        // para apontar para o filho ativo e limpamos a tag do filho inativado
        if (treatStudentAsInactive) {
          const lookupId = guardianAuthId || respId
          const lookupLabel = guardianAuthId ? 'external_id' : 'responsavel_id'
          try {
            if (hasOtherActiveChildren) {
              const activeSiblingId = String(activeSiblings[0].id).trim()
              await fetch(
                `https://onesignal.com/api/v1/apps/${appId}/users/by/${encodeURIComponent(lookupLabel)}/${encodeURIComponent(lookupId)}/identity`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${apiKey}`,
                  },
                  body: JSON.stringify({ identity: { aluno_id: activeSiblingId } }),
                }
              ).catch(() => {})
            } else if (isStaffMember) {
              // Colaborador que não tem mais filhos ativos: remove apenas aliases familiares
              await fetch(
                `https://onesignal.com/api/v1/apps/${appId}/users/by/${encodeURIComponent(lookupLabel)}/${encodeURIComponent(lookupId)}/identity/aluno_id`,
                { method: 'DELETE', headers: { Authorization: `Basic ${apiKey}` } }
              ).catch(() => {})
              await fetch(
                `https://onesignal.com/api/v1/apps/${appId}/users/by/${encodeURIComponent(lookupLabel)}/${encodeURIComponent(lookupId)}/identity/responsavel_id`,
                { method: 'DELETE', headers: { Authorization: `Basic ${apiKey}` } }
              ).catch(() => {})
            }
          } catch {}
        }
      } else {
        // ELEGÍVEL PARA EXCLUSÃO TOTAL NO ONESIGNAL: Sem filhos ativos e não é colaborador
        baseResult.cleanedGuardianIds.push(respId)
        addTargetAlias('responsavel_id', respId)
        addTargetAlias('external_id', respId)
        if (guardianAuthId) addTargetAlias('external_id', guardianAuthId)
        if (guardianEmail) {
          addTargetAlias('email', guardianEmail)
          const foundAuth = await findAuthUserByEmail(guardianEmail).catch(() => null)
          if (foundAuth?.id) addTargetAlias('external_id', foundAuth.id)
        }
        for (const sr of sysRows || []) {
          addTargetAlias('external_id', sr.id)
          addTargetAlias('external_id', sr.auth_id)
          if (sr.email) addTargetAlias('email', sr.email)
        }
      }
    }

    // 3. Coletar identificadores do próprio aluno se ele estiver inativo/excluído
    if (treatStudentAsInactive) {
      for (const ref of studentRefs) {
        addTargetAlias('aluno_id', ref)
        addTargetAlias('external_id', ref)
        const stripped = ref.replace(/^(?:a_|_ALU)/i, '').trim()
        if (stripped && stripped !== ref) {
          addTargetAlias('aluno_id', stripped)
          addTargetAlias('external_id', stripped)
        }
      }

      const studentAuthId = String(
        (student as any)?.auth_id || student?.dados?.auth_id || student?.dados?.user_id || ''
      ).trim()
      if (studentAuthId) addTargetAlias('external_id', studentAuthId)

      const studentEmail = String(
        student?.email || student?.dados?.email || student?.dados?.emailAluno || ''
      )
        .trim()
        .toLowerCase()

      if (studentEmail && !protectedIdentifiers.has(studentEmail)) {
        addTargetAlias('email', studentEmail)
        const foundStudentAuth = await findAuthUserByEmail(studentEmail).catch(() => null)
        if (foundStudentAuth?.id && !protectedIdentifiers.has(foundStudentAuth.id)) {
          addTargetAlias('external_id', foundStudentAuth.id)
        }
      }

      const matricula = student?.matricula || student?.dados?.codigo || studentId
      if (matricula) {
        const virtualEmail = `aluno.${String(matricula).trim().toLowerCase()}@impactoedu.local`
        addTargetAlias('email', virtualEmail)
        const foundVirtualAuth = await findAuthUserByEmail(virtualEmail).catch(() => null)
        if (foundVirtualAuth?.id) {
          addTargetAlias('external_id', foundVirtualAuth.id)
        }
      }

      const { data: studentSysRows } = await supabase
        .from('system_users')
        .select('id, auth_id, email, perfil, cargo, dados')
        .filter('dados->>aluno_id', 'eq', String(studentId).trim())

      for (const sRow of studentSysRows || []) {
        if (isFamilyOnlySystemUserRole(sRow)) {
          addTargetAlias('external_id', sRow.id)
          addTargetAlias('external_id', sRow.auth_id)
          if (sRow.email) addTargetAlias('email', sRow.email)
        }
      }
    }

    // 4. Consultar OneSignal para todos os aliases alvo e coletar subscrições com trava de proteção
    const subscriptionsToDelete = new Set<string>()
    const usersToDelete = new Map<string, { label: string; id: string }>()

    const lookups = await Promise.all(
      targetAliasesToDelete.map(async target => {
        const res = await fetchOneSignalUserByAlias(appId, apiKey, target.label, target.id)
        return { target, res }
      })
    )

    for (const { target, res } of lookups) {
      if (!res.found) continue

      // Trava de segurança: Verifica se o usuário retornado pelo OneSignal possui algum vínculo
      // com um responsável protegido (que tem outro filho ativo) ou colaborador
      const identityValues = Object.values(res.identity)
      const isProtectedOneSignalUser =
        Boolean(res.identity.colaborador_id) ||
        Boolean(res.identity.system_user_id && protectedIdentifiers.has(res.identity.system_user_id)) ||
        identityValues.some(
          val => protectedIdentifiers.has(val) || protectedIdentifiers.has(val.toLowerCase())
        )

      if (isProtectedOneSignalUser) {
        continue
      }

      for (const subId of res.subscriptionIds) {
        subscriptionsToDelete.add(subId)
      }

      if (res.externalId) {
        usersToDelete.set(`external_id:${res.externalId}`, {
          label: 'external_id',
          id: res.externalId,
        })
      }
      usersToDelete.set(`${target.label}:${target.id}`, target)
    }

    // 5. Excluir todas as subscrições/aparelhos encontrados
    const subIdsArray = Array.from(subscriptionsToDelete)
    const subDeleteResults = await Promise.all(
      subIdsArray.map(subId => deleteOneSignalSubscriptionById(subId, appId, apiKey))
    )
    const deletedSubsCount = subDeleteResults.filter(Boolean).length

    // 6. Excluir as identidades de usuário elegíveis no OneSignal
    const usersArray = Array.from(usersToDelete.values())
    const userDeleteResults = await Promise.all(
      usersArray.map(u => deleteOneSignalUserByAlias(u.label, u.id, appId, apiKey))
    )
    const deletedUsersCount = userDeleteResults.filter(Boolean).length

    baseResult.deletedSubscriptionsCount = deletedSubsCount
    baseResult.deletedUsersCount = deletedUsersCount
    baseResult.deletedSubscriptionIds = subIdsArray

    console.log(
      `🧹 [OneSignal Inactive Cleanup] Aluno ${student?.nome || studentId} (${studentId}): ` +
        `${deletedSubsCount} aparelho(s) excluído(s), ${baseResult.cleanedGuardianIds.length} responsável(is) limpo(s), ` +
        `${baseResult.protectedGuardianIds.length} responsável(is) preservado(s) (outro filho ativo ou colaborador).`
    )

    return baseResult
  } catch (err: any) {
    console.error('[OneSignal Inactive Cleanup Error]:', err?.message)
    return { ...baseResult, success: false }
  }
}

export interface BatchInactiveCleanupResult {
  success: boolean
  inactiveStudentsTotal: number
  eligibleGuardiansTotal: number
  protectedGuardiansTotal: number
  deletedSubscriptionsCount: number
  deletedUsersCount: number
  deletedSubscriptionIds: string[]
}

/**
 * Varredura completa em lote: Identifica todos os alunos atualmente com status inativo no banco,
 * cruza com todos os responsáveis (protegendo pais com outros filhos ativos e colaboradores)
 * e exclui do OneSignal todos os aparelhos e registros de usuários inativos para zerar cobranças.
 */
export async function cleanupAllInactiveStudentsOneSignal(): Promise<BatchInactiveCleanupResult> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''

  const result: BatchInactiveCleanupResult = {
    success: true,
    inactiveStudentsTotal: 0,
    eligibleGuardiansTotal: 0,
    protectedGuardiansTotal: 0,
    deletedSubscriptionsCount: 0,
    deletedUsersCount: 0,
    deletedSubscriptionIds: [],
  }

  if (!appId || !apiKey) return result

  try {
    const { getAdminClient, getAllAuthUsersCached } = await import('@/lib/server/supabaseAdminSingleton')
    const supabase = getAdminClient()

    async function fetchAllRows(table: string, cols: string): Promise<any[]> {
      const all: any[] = []
      let from = 0
      const step = 1000
      while (from < 10000) {
        const { data, error } = await supabase
          .from(table)
          .select(cols)
          .range(from, from + step - 1)
        if (error || !data || data.length === 0) break
        all.push(...data)
        if (data.length < step) break
        from += step
      }
      return all
    }

    const [
      allAlunos,
      allLinks,
      allResponsaveis,
      allSysUsers,
      allFuncionarios,
      authUsers,
    ] = await Promise.all([
      fetchAllRows('alunos', 'id, nome, matricula, status, email, dados'),
      fetchAllRows('aluno_responsavel', 'aluno_id, responsavel_id'),
      fetchAllRows('responsaveis', 'id, nome, email, auth_id, dados'),
      fetchAllRows('system_users', 'id, auth_id, email, status, perfil, cargo, dados'),
      fetchAllRows('funcionarios', 'id, email, status'),
      getAllAuthUsersCached().catch(() => [] as any[]),
    ])

    const activeStudentRefs = new Set<string>()
    const inactiveStudentRefs = new Set<string>()
    const inactiveStudents: any[] = []

    for (const a of allAlunos || []) {
      const refs = [a.id, a.matricula, a.dados?.codigo, a.dados?.id]
        .filter(Boolean)
        .map(v => String(v).trim())
      if (isStudentInactiveStatus(a)) {
        inactiveStudents.push(a)
        refs.forEach(r => inactiveStudentRefs.add(r))
      } else {
        refs.forEach(r => activeStudentRefs.add(r))
      }
    }

    result.inactiveStudentsTotal = inactiveStudents.length

    // Construir conjunto de identificadores protegidos (colaboradores ativos + responsáveis com filhos ativos)
    const protectedIds = new Set<string>()
    const addProt = (val: unknown) => {
      if (val && typeof val === 'string' && val.trim()) {
        protectedIds.add(val.trim())
        protectedIds.add(val.trim().toLowerCase())
      }
    }

    for (const f of allFuncionarios || []) {
      if (String(f.status || '').toLowerCase() !== 'inativo') {
        addProt(f.id)
        addProt(f.email)
      }
    }

    for (const su of allSysUsers || []) {
      if (!isFamilyOnlySystemUserRole(su) && String(su.status || '').toLowerCase() !== 'inativo') {
        addProt(su.id)
        addProt(su.auth_id)
        addProt(su.email)
      }
    }

    // Mapear vínculos por responsável
    const linksByResp = new Map<string, Set<string>>()
    for (const l of allLinks || []) {
      const rId = String(l?.responsavel_id || '').trim()
      const aId = String(l?.aluno_id || '').trim()
      if (!rId || !aId) continue
      if (!linksByResp.has(rId)) linksByResp.set(rId, new Set())
      linksByResp.get(rId)!.add(aId)
    }

    // Mapear authUsers por email e por responsavel_id / aluno_id
    const authByEmail = new Map<string, string>()
    const authByRespId = new Map<string, string>()
    const authByAlunoId = new Map<string, string>()
    for (const au of authUsers || []) {
      if (!au?.id) continue
      const em = String(au.email || '').trim().toLowerCase()
      if (em) authByEmail.set(em, String(au.id))
      const mResp = String(au.user_metadata?.responsavel_id || au.user_metadata?.responsavelId || '').trim()
      if (mResp) authByRespId.set(mResp, String(au.id))
      const mAluno = String(au.user_metadata?.aluno_id || au.user_metadata?.alunoId || '').trim()
      if (mAluno) authByAlunoId.set(mAluno, String(au.id))
    }

    const eligibleAliases: Array<{ label: string; id: string }> = []
    const eligibleFlatIds = new Set<string>()
    const addEligible = (label: string, val: unknown) => {
      if (!val || typeof val !== 'string' || !val.trim()) return
      const clean = label === 'email' ? val.trim().toLowerCase() : val.trim()
      if (protectedIds.has(clean) || protectedIds.has(clean.toLowerCase())) return
      eligibleFlatIds.add(clean)
      eligibleFlatIds.add(clean.toLowerCase())
      eligibleAliases.push({ label, id: clean })
    }

    // Classificar responsáveis: primeiro passa para registrar todos os protegidos
    const guardianClassification: Array<{ resp: any; isProtected: boolean; hasInactiveLink: boolean }> = []
    for (const resp of allResponsaveis || []) {
      const rId = String(resp.id || '').trim()
      if (!rId) continue
      const linkedSet = linksByResp.get(rId) || new Set<string>()
      if (Array.isArray(resp.dados?.alunosVinculados)) {
        resp.dados.alunosVinculados.forEach((aid: any) => {
          if (aid) linkedSet.add(String(aid).trim())
        })
      }

      const hasActiveChild = Array.from(linkedSet).some(aid => activeStudentRefs.has(aid))
      const hasInactiveChild = Array.from(linkedSet).some(aid => inactiveStudentRefs.has(aid))
      const rEmail = String(resp.email || resp.dados?.email || '').trim().toLowerCase()
      const rAuthId = String(
        resp.auth_id || resp.dados?.auth_id || resp.dados?.user_id || authByRespId.get(rId) || (rEmail ? authByEmail.get(rEmail) : '') || ''
      ).trim()

      const isAlreadyStaff =
        protectedIds.has(rId) ||
        (Boolean(rAuthId) && protectedIds.has(rAuthId)) ||
        (Boolean(rEmail) && protectedIds.has(rEmail))

      if (hasActiveChild || isAlreadyStaff) {
        result.protectedGuardiansTotal++
        addProt(rId)
        addProt(rAuthId)
        addProt(rEmail)
        guardianClassification.push({ resp, isProtected: true, hasInactiveLink: hasInactiveChild })
      } else if (hasInactiveChild || linkedSet.size === 0) {
        guardianClassification.push({ resp, isProtected: false, hasInactiveLink: true })
      }
    }

    // Segunda passada: registrar responsáveis elegíveis (que não têm nenhum filho ativo nem são colaboradores)
    for (const item of guardianClassification) {
      if (item.isProtected || !item.hasInactiveLink) continue
      const resp = item.resp
      const rId = String(resp.id || '').trim()
      const rEmail = String(resp.email || resp.dados?.email || '').trim().toLowerCase()
      const rAuthId = String(
        resp.auth_id || resp.dados?.auth_id || resp.dados?.user_id || authByRespId.get(rId) || (rEmail ? authByEmail.get(rEmail) : '') || ''
      ).trim()

      if (
        protectedIds.has(rId) ||
        (Boolean(rAuthId) && protectedIds.has(rAuthId)) ||
        (Boolean(rEmail) && protectedIds.has(rEmail))
      ) {
        continue
      }

      result.eligibleGuardiansTotal++
      addEligible('responsavel_id', rId)
      addEligible('external_id', rId)
      if (rAuthId) addEligible('external_id', rAuthId)
      if (rEmail) addEligible('email', rEmail)
    }

    // Registrar alunos inativos
    for (const st of inactiveStudents) {
      const sId = String(st.id || '').trim()
      const mat = String(st.matricula || st.dados?.codigo || '').trim()
      const sEmail = String(st.email || st.dados?.email || '').trim().toLowerCase()
      const sAuthId = String(
        st.auth_id || st.dados?.auth_id || st.dados?.user_id || authByAlunoId.get(sId) || (sEmail ? authByEmail.get(sEmail) : '') || ''
      ).trim()

      addEligible('aluno_id', sId)
      addEligible('external_id', sId)
      if (mat) {
        addEligible('aluno_id', mat)
        const vEmail = `aluno.${mat.toLowerCase()}@impactoedu.local`
        const vAuth = authByEmail.get(vEmail)
        if (vAuth) addEligible('external_id', vAuth)
      }
      if (sAuthId) addEligible('external_id', sAuthId)
      if (sEmail) addEligible('email', sEmail)
    }

    const subscriptionsToDelete = new Set<string>()
    const usersToDelete = new Map<string, { label: string; id: string }>()

    // 1. Varredura rápida de todos os players registrados no OneSignal (paginado de 200 em 200 — limite máximo da API v1)
    for (let offset = 0; offset < 3000; offset += 200) {
      try {
        const rList = await fetch(
          `https://onesignal.com/api/v1/players?app_id=${encodeURIComponent(appId)}&limit=200&offset=${offset}`,
          { headers: { Authorization: `Basic ${apiKey}` }, cache: 'no-store' }
        )
        if (!rList.ok) break
        const listData = await rList.json().catch(() => ({}))
        const players: any[] = Array.isArray(listData.players) ? listData.players : []
        if (players.length === 0) break

        for (const p of players) {
          const pId = String(p.id || '').trim()
          if (!pId) continue
          const extId = String(p.external_user_id || '').trim()
          const tags = p.tags && typeof p.tags === 'object' ? p.tags : {}
          const tagRespId = String(tags.responsavel_id || '').trim()
          const tagAlunoId = String(tags.aluno_id || tags.aluno_db_id || '').trim()
          const tagColabId = String(tags.colaborador_id || tags.system_user_id || '').trim()

          // Nunca tocar em aparelhos de colaboradores ou responsáveis protegidos
          if (
            Boolean(tagColabId) ||
            tags.isMasterAdmin === 'true' ||
            (extId && (protectedIds.has(extId) || protectedIds.has(extId.toLowerCase()))) ||
            (tagRespId && protectedIds.has(tagRespId)) ||
            (tagAlunoId && activeStudentRefs.has(tagAlunoId))
          ) {
            continue
          }

          // Checar se possui tag de algum filho ativo (ex: aluno_1234 = "true")
          const dynamicAlunoTags = Object.keys(tags)
            .filter(k => k.startsWith('aluno_') && k !== 'aluno_id' && k !== 'aluno_db_id' && tags[k] === 'true')
            .map(k => k.replace(/^aluno_/, ''))
          if (dynamicAlunoTags.some(aid => activeStudentRefs.has(aid))) {
            continue
          }

          const matchesInactive =
            (extId && (eligibleFlatIds.has(extId) || eligibleFlatIds.has(extId.toLowerCase()))) ||
            (tagRespId && eligibleFlatIds.has(tagRespId)) ||
            (tagAlunoId && inactiveStudentRefs.has(tagAlunoId)) ||
            dynamicAlunoTags.some(aid => inactiveStudentRefs.has(aid))

          if (matchesInactive) {
            subscriptionsToDelete.add(pId)
            if (extId) {
              usersToDelete.set(`external_id:${extId}`, { label: 'external_id', id: extId })
            }
          }
        }

        const totalCount = Number(listData.total_count || 0)
        if (players.length < 200 || (totalCount > 0 && offset + players.length >= totalCount)) break
      } catch {
        break
      }
    }

    // 2. Consultar também via User Model API v5 para usuários que possuem conta Auth (UUID) ou vínculo direto
    const priorityAliases = eligibleAliases.filter(
      a => a.label === 'external_id' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(a.id)
    )
    const uniquePriority = Array.from(
      new Map(priorityAliases.map(a => [`${a.label}:${a.id}`, a])).values()
    )

    const CHUNK = 10
    for (let i = 0; i < uniquePriority.length; i += CHUNK) {
      const batch = uniquePriority.slice(i, i + CHUNK)
      const batchRes = await Promise.all(
        batch.map(async target => ({
          target,
          res: await fetchOneSignalUserByAlias(appId, apiKey, target.label, target.id),
        }))
      )
      for (const { target, res } of batchRes) {
        if (!res.found) continue
        const identityValues = Object.values(res.identity)
        const isProt =
          Boolean(res.identity.colaborador_id) ||
          identityValues.some(v => protectedIds.has(v) || protectedIds.has(v.toLowerCase()))
        if (isProt) continue
        res.subscriptionIds.forEach(s => subscriptionsToDelete.add(s))
        usersToDelete.set(`${target.label}:${target.id}`, target)
      }
    }

    // 3. Executar exclusões em lotes paralelos de 10
    const subIdsList = Array.from(subscriptionsToDelete)
    let deletedSubs = 0
    for (let i = 0; i < subIdsList.length; i += CHUNK) {
      const chunk = subIdsList.slice(i, i + CHUNK)
      const r = await Promise.all(chunk.map(id => deleteOneSignalSubscriptionById(id, appId, apiKey)))
      deletedSubs += r.filter(Boolean).length
    }

    const usersList = Array.from(usersToDelete.values())
    let deletedUsers = 0
    for (let i = 0; i < usersList.length; i += CHUNK) {
      const chunk = usersList.slice(i, i + CHUNK)
      const r = await Promise.all(chunk.map(u => deleteOneSignalUserByAlias(u.label, u.id, appId, apiKey)))
      deletedUsers += r.filter(Boolean).length
    }

    result.deletedSubscriptionsCount = deletedSubs
    result.deletedUsersCount = deletedUsers
    result.deletedSubscriptionIds = subIdsList

    console.log(
      `🧹 [OneSignal Batch Inactive Cleanup] ${inactiveStudents.length} alunos inativos verificados -> ` +
        `${deletedSubs} aparelho(s) e ${deletedUsers} usuário(s) removidos do OneSignal.`
    )

    return result
  } catch (err: any) {
    console.error('[OneSignal Batch Inactive Cleanup Error]:', err?.message)
    return { ...result, success: false }
  }
}

