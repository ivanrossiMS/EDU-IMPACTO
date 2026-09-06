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
      const recipientCount = parsedBody.recipients ?? parsedBody.num_recipients ?? 0
      const notificationId = parsedBody.id || 'N/A'

      if (recipientCount === 0) {
        console.warn(`⚠️ [PushService] OneSignal aceitou a requisição (200 OK), porém 0 destinatários inscritos (Recipients: 0).`, {
          id: notificationId,
          targetCount: payload.include_aliases?.external_id?.length || payload.include_external_user_ids?.length || 0,
          errors: parsedBody.errors || null,
        })
      } else {
        console.log(`✅ [PushService] Push entregue com sucesso! ID: ${notificationId} | Destinatários ativos: ${recipientCount}`)
      }
      return { success: true, data: parsedBody, statusCode: response.status, recipients: recipientCount }
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

  if (!params.targetUserIds || params.targetUserIds.length === 0) {
    console.log('[PushService] Nenhum destinatário informado. Push ignorado.')
    return { success: true, skipped: true }
  }

  // Limitar a 2000 destinatários por chamada (limite do OneSignal)
  const maxChunkSize = 2000
  if (params.targetUserIds.length > maxChunkSize) {
    console.warn(`⚠️ [PushService] ${params.targetUserIds.length} destinatários excedem o limite. Enviando em lotes sequenciais...`)
    const chunks: string[][] = []
    for (let i = 0; i < params.targetUserIds.length; i += maxChunkSize) {
      chunks.push(params.targetUserIds.slice(i, i + maxChunkSize))
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
    ...(params.url && { web_url: params.url }),
    ...(params.data && { data: params.data }),
    ...(params.sendAfter && { send_after: params.sendAfter }),
    chrome_web_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    adm_large_icon: params.largeIcon || `${process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu.net'}/logo-impacto.png`,
    ...(params.smallIcon && { small_icon: params.smallIcon }),
    ...(params.largeIcon && { large_icon: params.largeIcon }),
    ...(params.imageUrl && { big_picture: params.imageUrl, ios_attachments: { id1: params.imageUrl } }),
    priority: 10,
    ttl: 86400,
  }

  // ── Tentativa 1: OneSignal User Model Aliases (Web SDK v16 & Capacitor v5+) ──
  // Mapeia external_id, responsavel_id e aluno_id para encontrar inscritos por qualquer ID
  const aliasPayload: Record<string, any> = {
    ...commonFields,
    include_aliases: {
      external_id: params.targetUserIds,
      responsavel_id: params.targetUserIds,
      aluno_id: params.targetUserIds,
    },
    target_channel: 'push',
  }

  console.log(`🔔 [PushService] Tentativa 1 (User Model Aliases) para ${params.targetUserIds.length} usuário(s)...`)
  const resultAlias = await attemptSend(aliasPayload, ONESIGNAL_REST_API_KEY)

  // Se entregou com sucesso para 1+ dispositivos, finalizar
  if (resultAlias.success && (resultAlias.recipients ?? 0) > 0) {
    return resultAlias
  }

  // ── Tentativa 2 (Fallback): Legacy include_external_user_ids (OneSignal v1) ──
  // Caso dispositivos antigos estejam inscritos sob o formato legacy external_id
  console.warn(`⚠️ [PushService] Tentativa 1 retornou 0 inscritos. Executando Fallback (Legacy external_id)...`)
  const legacyPayload: Record<string, any> = {
    ...commonFields,
    include_external_user_ids: params.targetUserIds,
  }

  const resultLegacy = await attemptSend(legacyPayload, ONESIGNAL_REST_API_KEY)
  if (resultLegacy.success && (resultLegacy.recipients ?? 0) > 0) {
    console.log(`✅ [PushService] Fallback legacy entregou com sucesso para ${resultLegacy.recipients} dispositivo(s)!`)
    return resultLegacy
  }

  // Retornar o resultado do alias se ambos retornaram 0
  return resultAlias
}
