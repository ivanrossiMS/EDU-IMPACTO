/**
 * pushService.ts — Serviço de envio de Push Notifications via OneSignal
 * 
 * SEGURANÇA: Este módulo roda APENAS no servidor (API Routes/Edge).
 * A REST API Key do OneSignal NUNCA é exposta no frontend.
 * 
 * Arquitetura:
 * - Suporta segmentação por ExternalUserIds (IDs do banco de dados)
 * - Suporta segmentação por tags (turma, perfil, aluno_id, etc.)
 * - Implementa retry automático em falhas de rede (503, 429)
 * - Registra logs detalhados de sucesso e falha
 * - Respeita LGPD: sem dados sensíveis no corpo da notificação
 */

export interface PushPayload {
  title: string
  body: string
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

    // Sucesso ou erro de negócio (4xx) — não retentar
    if (response.ok) {
      console.log(`✅ [PushService] Push enviado com sucesso! ID: ${parsedBody.id || 'N/A'} | Recipients: ${parsedBody.recipients || 0}`)
      return { success: true, data: parsedBody, statusCode: response.status }
    }

    // Erro de negócio (ex: invalid_player_ids) — sem retry
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
    // Erro de rede — tentar retry
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
 * 
 * @param params - Parâmetros do push (título, corpo, destinatários, URL de deep link)
 * @returns Resultado do envio com detalhes de sucesso ou erro
 * 
 * IMPORTANTE:
 * - targetUserIds devem ser os IDs externos do banco de dados (External User IDs)
 * - Os usuários precisam ter feito login com OneSignal.login(userId) no frontend
 * - URLs de deep link devem ser absolutas ou relativas à origem configurada no OneSignal
 */
export async function sendPushNotification(params: PushPayload): Promise<PushResult> {
  // ── Validação de credenciais ──────────────────────────────────────────────
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

  // ── Validação de destinatários ────────────────────────────────────────────
  if (!params.targetUserIds || params.targetUserIds.length === 0) {
    console.log('[PushService] Nenhum destinatário informado. Push ignorado.')
    return { success: true, skipped: true }
  }

  // Limitar a 2000 destinatários por chamada (limite do OneSignal)
  const maxChunkSize = 2000
  if (params.targetUserIds.length > maxChunkSize) {
    console.warn(`⚠️ [PushService] ${params.targetUserIds.length} destinatários excedem o limite. Enviando em lotes...`)
    const chunks = []
    for (let i = 0; i < params.targetUserIds.length; i += maxChunkSize) {
      chunks.push(params.targetUserIds.slice(i, i + maxChunkSize))
    }
    const results = await Promise.all(
      chunks.map(chunk =>
        sendPushNotification({ ...params, targetUserIds: chunk })
      )
    )
    const allOk = results.every(r => r.success)
    return { success: allOk, data: results }
  }

  // ── Construção do Payload ─────────────────────────────────────────────────
  const payload: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: {
      external_id: params.targetUserIds,
      responsavel_id: params.targetUserIds,
      aluno_id: params.targetUserIds
    },
    target_channel: 'push',
    headings: { en: params.title, pt: params.title },
    contents: { en: params.body, pt: params.body },
    // Data de deep link — abre a página correta ao clicar na notificação
    ...(params.url && { url: params.url }),
    // Dados extras para o service worker processar (ex: tipo, aluno_id, rota)
    ...(params.data && { data: params.data }),
    // Agendamento
    ...(params.sendAfter && { send_after: params.sendAfter }),
    // Ícone (usa o ícone do app por padrão)
    ...(params.smallIcon && { small_icon: params.smallIcon }),
    ...(params.largeIcon && { large_icon: params.largeIcon }),
    ...(params.imageUrl && { big_picture: params.imageUrl, ios_attachments: { id1: params.imageUrl } }),
    // Configurações de entrega
    priority: 10, // Alta prioridade
    ttl: 86400, // Expira em 24h se não entregue
  }

  console.log(`🔔 [PushService] Enviando para ${params.targetUserIds.length} usuário(s)...`, {
    title: params.title,
    url: params.url,
  })

  return attemptSend(payload, ONESIGNAL_REST_API_KEY)
}
