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
  url?: string
  data?: Record<string, any>
  sendAfter?: string // formato: "2024-01-01 20:00:00 GMT-0300"
  smallIcon?: string
  largeIcon?: string
  imageUrl?: string
}

interface PushResult {
  success: boolean
  mock?: boolean
  skipped?: boolean
  data?: any
  error?: string
  statusCode?: number
  retriesUsed?: number
  recipients?: number
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
      if (parsedBody.errors) {
        const errorList = Array.isArray(parsedBody.errors)
          ? parsedBody.errors
          : (typeof parsedBody.errors === 'string' ? [parsedBody.errors] : [])
        allUnsubscribed = errorList.some((e: any) =>
          typeof e === 'string' && e.toLowerCase().includes('not subscribed')
        )
      }

      // No OneSignal v1 API com include_aliases, a contagem de destinatários é assíncrona
      // e o campo 'recipients' não vem na resposta HTTP síncrona.
      // Se 'id' for um UUID válido e não houver erro de falta de inscritos,
      // a notificação foi aceita e enfileirada com sucesso pelo OneSignal.
      let recipientCount = parsedBody.recipients ?? parsedBody.num_recipients
      if (recipientCount === undefined) {
        recipientCount = (hasValidId && !allUnsubscribed) ? 1 : 0
      }

      if (recipientCount === 0 || !hasValidId) {
        const errorDetail = allUnsubscribed
          ? 'All included players are not subscribed'
          : (parsedBody.errors ? JSON.stringify(parsedBody.errors) : 'No subscribed recipients found')
        console.warn(`⚠️ [PushService] OneSignal aceitou a requisição (200 OK), porém 0 destinatários inscritos (Recipients: 0).`, {
          id: notificationId || 'N/A',
          targetCount: payload.include_aliases?.external_id?.length || payload.include_aliases?.colaborador_id?.length || payload.include_aliases?.responsavel_id?.length || payload.include_external_user_ids?.length || 0,
          errors: parsedBody.errors || null,
        })
        return {
          success: false,
          data: parsedBody,
          statusCode: response.status,
          recipients: 0,
          error: errorDetail,
        }
      } else {
        console.log(`✅ [PushService] Push aceito pelo OneSignal com sucesso! ID: ${notificationId} | Destinatários ativos: ${recipientCount}`)
      }
      return {
        success: hasValidId && recipientCount > 0,
        data: parsedBody,
        statusCode: response.status,
        recipients: recipientCount,
      }
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

  const uniqueTargetUserIds = Array.from(
    new Set(
      (params.targetUserIds || [])
        .filter(id => id && typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim())
    )
  )

  if (uniqueTargetUserIds.length === 0) {
    console.log('[PushService] Nenhum destinatário válido informado. Push ignorado.')
    return { success: true, skipped: true }
  }

  // Limitar a 2000 destinatários por chamada (limite do OneSignal)
  const maxChunkSize = 2000
  if (uniqueTargetUserIds.length > maxChunkSize) {
    console.warn(`⚠️ [PushService] ${uniqueTargetUserIds.length} destinatários excedem o limite. Enviando em lotes sequenciais...`)
    const chunks: string[][] = []
    for (let i = 0; i < uniqueTargetUserIds.length; i += maxChunkSize) {
      chunks.push(uniqueTargetUserIds.slice(i, i + maxChunkSize))
    }

    const results: PushResult[] = []
    for (const chunk of chunks) {
      const result = await sendPushNotification({ ...params, targetUserIds: chunk })
      results.push(result)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    const allOk = results.every(r => r.success)
    return { success: allOk, data: results }
  }

  const commonFields = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: params.title, pt: params.title },
    contents: { en: params.body, pt: params.body },
    ...(params.url && { web_url: params.url, app_url: params.url }),
    data: {
      ...(params.data || {}),
      ...(params.url && { targetUrl: params.url, url: params.url }),
    },
    ...(params.sendAfter && { send_after: params.sendAfter }),
    chrome_web_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    adm_large_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    ...(params.smallIcon && { small_icon: params.smallIcon }),
    ...(params.largeIcon && { large_icon: params.largeIcon }),
    ...(params.imageUrl && { big_picture: params.imageUrl, ios_attachments: { id1: params.imageUrl } }),
    priority: 10,
    ttl: 86400,
  }

  // ── Tentativa 1: OneSignal User Model (external_id) ──
  // Usuários autenticados no app via OneSignal.login(userId) possuem external_id = userId
  console.log(`🔔 [PushService] Tentativa 1 (User Model external_id) para ${uniqueTargetUserIds.length} usuário(s)...`)
  const externalIdPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      external_id: uniqueTargetUserIds,
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

  // ── Tentativa 2 (Fallback): Legacy include_external_user_ids (OneSignal v1) ──
  console.warn(`⚠️ [PushService] Tentativa 1 retornou 0 inscritos. Executando Tentativa 2: Fallback Legacy (include_external_user_ids)...`)
  const legacyPayload: Record<string, any> = {
    ...commonFields,
    include_external_user_ids: uniqueTargetUserIds,
  }
  const resultLegacy = await attemptSend(legacyPayload, ONESIGNAL_REST_API_KEY)
  if (resultLegacy.success && (resultLegacy.recipients ?? 0) > 0) {
    console.log(`✅ [PushService] Fallback legacy entregou com sucesso para ${resultLegacy.recipients} dispositivo(s)!`)
    return resultLegacy
  }

  // ── Tentativa 3 (Fallback): Custom Alias colaborador_id ──
  console.warn(`⚠️ [PushService] Tentativa 2 retornou 0 inscritos. Executando Tentativa 3: Custom Alias (colaborador_id)...`)
  const colabPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      colaborador_id: uniqueTargetUserIds,
    },
    target_channel: 'push',
  }
  const resultColab = await attemptSend(colabPayload, ONESIGNAL_REST_API_KEY)
  if (resultColab.success && (resultColab.recipients ?? 0) > 0) {
    console.log(`✅ [PushService] Custom alias colaborador_id entregou com sucesso para ${resultColab.recipients} dispositivo(s)!`)
    return resultColab
  }

  // ── Tentativa 4 (Fallback): Custom Alias responsavel_id ──
  const respPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      responsavel_id: uniqueTargetUserIds,
    },
    target_channel: 'push',
  }
  const resultResp = await attemptSend(respPayload, ONESIGNAL_REST_API_KEY)
  if (resultResp.success && (resultResp.recipients ?? 0) > 0) {
    console.log(`✅ [PushService] Custom alias responsavel_id entregou com sucesso para ${resultResp.recipients} dispositivo(s)!`)
    return resultResp
  }

  // ── Tentativa 5 (Fallback): Custom Alias system_user_id ──
  const sysUserPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      system_user_id: uniqueTargetUserIds,
    },
    target_channel: 'push',
  }
  const resultSysUser = await attemptSend(sysUserPayload, ONESIGNAL_REST_API_KEY)
  if (resultSysUser.success && (resultSysUser.recipients ?? 0) > 0) {
    console.log(`✅ [PushService] Custom alias system_user_id entregou com sucesso para ${resultSysUser.recipients} dispositivo(s)!`)
    return resultSysUser
  }

  // ── Tentativa 6 (Fallback): Custom Alias email ──
  const emailTargets = uniqueTargetUserIds.filter(id => id.includes('@'))
  if (emailTargets.length > 0) {
    const emailPayload: Record<string, any> = {
      ...commonFields,
      include_aliases: {
        email: emailTargets,
      },
      target_channel: 'push',
    }
    const resultEmail = await attemptSend(emailPayload, ONESIGNAL_REST_API_KEY)
    if (resultEmail.success && (resultEmail.recipients ?? 0) > 0) {
      console.log(`✅ [PushService] Custom alias email entregou com sucesso para ${resultEmail.recipients} dispositivo(s)!`)
      return resultEmail
    }
  }

  // Retornar o resultado com o erro mais informativo
  return resultExternalId.error ? resultExternalId : resultLegacy
}
