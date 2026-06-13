/**
 * agendaNotifications.ts — Central de Notificações da Agenda Digital
 * 
 * Responsável por:
 * 1. Enviar pushes via OneSignal (backend seguro)
 * 2. Controlar duplicidade (evita disparar o mesmo push duas vezes)
 * 3. Gravar logs de auditoria na tabela `agenda_push_logs`
 * 4. Suportar todos os tipos de evento: comunicados, momentos, calendário, etc.
 * 
 * LGPD: Notificações não contêm dados sensíveis — apenas avisos genéricos.
 * O conteúdo real só é acessível após login autenticado.
 */

import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendPushNotification } from './pushService'

export type AgendaPushType =
  | 'comunicados'
  | 'momentos'
  | 'calendario'
  | 'frequencia'
  | 'ocorrencias'
  | 'notas'
  | 'cobrancas'

interface SendAgendaPushParams {
  type: AgendaPushType
  itemId: string
  title: string
  message: string
  /** URL absoluta ou relativa ao domínio base. Abre ao clicar na notificação. */
  targetUrl: string
  /** IDs externos dos usuários (responsáveis/colaboradores) no banco de dados */
  targetUserIds: string[]
  senderUserId?: string
  metadata?: Record<string, any>
  /** ISO string para agendamento: "2024-01-01 20:00:00 GMT-0300" */
  sendAfter?: string
}

interface PushResult {
  success: boolean
  skipped?: boolean
  reason?: string
  mock?: boolean
  data?: any
  error?: string
}

/**
 * Envia uma notificação push para os usuários da Agenda Digital.
 * Controla duplicidade por itemId + type.
 * Grava logs de auditoria independente do resultado.
 */
export async function sendAgendaPushNotification({
  type,
  itemId,
  title,
  message,
  targetUrl,
  targetUserIds,
  senderUserId,
  metadata,
  sendAfter,
}: SendAgendaPushParams): Promise<PushResult> {
  const logPrefix = `[Push Central][${type}][${itemId}]`

  try {
    // ── Validação básica ────────────────────────────────────────────────────
    if (!targetUserIds || targetUserIds.length === 0) {
      console.log(`${logPrefix} Nenhum destinatário. Push ignorado.`)
      return { success: true, skipped: true, reason: 'no_targets' }
    }

    // Filtrar IDs vazios/inválidos
    const cleanTargetIds = targetUserIds.filter(id => id && typeof id === 'string' && id.trim().length > 0)
    if (cleanTargetIds.length === 0) {
      console.log(`${logPrefix} Todos os IDs eram inválidos. Push ignorado.`)
      return { success: true, skipped: true, reason: 'invalid_target_ids' }
    }

    const supabase = await createProtectedClient()

    // ── Verificação de duplicidade ──────────────────────────────────────────
    // Evita disparar o mesmo push duas vezes para o mesmo itemId+type
    const { data: existingLog } = await supabase
      .from('agenda_push_logs')
      .select('id, status')
      .eq('item_id', itemId)
      .eq('type', type)
      .eq('status', 'sent')
      .maybeSingle()

    if (existingLog) {
      console.log(`${logPrefix} Push duplicado interceptado (já enviado). Ignorando.`)
      return { success: true, skipped: true, reason: 'already_sent' }
    }

    // ── Disparo via OneSignal ───────────────────────────────────────────────
    console.log(`${logPrefix} Disparando para ${cleanTargetIds.length} usuário(s)...`)

    // Construir URL completa (deep link)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu-app.vercel.app'
    let fullUrl = targetUrl.startsWith('http') ? targetUrl : `${appUrl}${targetUrl}`
    if (itemId && !fullUrl.includes('id=')) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + `id=${itemId}`
    }

    const pushResponse = await sendPushNotification({
      title,
      body: message,
      targetUserIds: cleanTargetIds,
      url: fullUrl,
      data: {
        type,
        item_id: itemId,
        ...metadata,
      },
      sendAfter,
    })

    // ── Log de auditoria ────────────────────────────────────────────────────
    const logStatus = pushResponse.success ? 'sent' : 'failed'
    const errorMsg = pushResponse.success ? null : (pushResponse.error || 'Unknown error')

    const { error: logError } = await supabase.from('agenda_push_logs').insert({
      user_id: senderUserId || null,
      type,
      item_id: itemId,
      title,
      message,
      target_url: fullUrl,
      target_count: cleanTargetIds.length,
      status: logStatus,
      error_message: errorMsg,
      onesignal_response: pushResponse.data ? JSON.stringify(pushResponse.data) : null,
      created_at: new Date().toISOString(),
    })

    if (logError) {
      // Falha no log NÃO deve bloquear o fluxo — apenas registrar no console do servidor
      console.error(`${logPrefix} Erro ao gravar log de auditoria:`, logError.message)
    }

    if (!pushResponse.success) {
      console.error(`${logPrefix} Falha no envio do push:`, pushResponse.error)
    } else if (pushResponse.mock) {
      console.log(`${logPrefix} [MODO MOCK] Push simulado com sucesso (sem credenciais reais).`)
    } else {
      console.log(`${logPrefix} Push enviado com sucesso!`)
    }

    return pushResponse

  } catch (error: any) {
    console.error(`${logPrefix} Erro crítico ao processar push:`, error.message)
    return { success: false, error: error.message }
  }
}
