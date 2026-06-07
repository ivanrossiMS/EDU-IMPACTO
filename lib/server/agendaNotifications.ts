import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendPushNotification } from './pushService'

export type AgendaPushType = 'comunicados' | 'momentos' | 'calendario' | 'frequencia' | 'ocorrencias' | 'notas'

interface SendAgendaPushParams {
  type: AgendaPushType
  itemId: string
  title: string
  message: string
  targetUrl: string
  targetUserIds: string[]
  senderUserId?: string
  metadata?: any
  sendAfter?: string
}

/**
 * Central de notificações da Agenda Digital.
 * Gerencia envio de push, controle de duplicidade e gravação de logs de auditoria.
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
  sendAfter
}: SendAgendaPushParams) {
  try {
    if (!targetUserIds || targetUserIds.length === 0) {
      console.log(`[Push Central] Nenhum destinatário para ${type} (ID: ${itemId}). Skip.`)
      return { success: true, skipped: true, reason: 'no_targets' }
    }

    const supabase = await createProtectedClient()

    // 1. Verificar duplicidade (Evitar enviar Push do mesmo evento duas vezes)
    const { data: existingLog } = await supabase
      .from('agenda_push_logs')
      .select('id, status')
      .eq('item_id', itemId)
      .eq('type', type)
      .limit(1)
      .single()

    if (existingLog && existingLog.status === 'sent') {
      console.log(`[Push Central] Disparo duplicado interceptado para ${type} (ID: ${itemId}). Ignorando.`)
      return { success: true, skipped: true, reason: 'already_sent' }
    }

    // 2. Disparar via OneSignal (Push Service)
    const pushResponse = await sendPushNotification({
      title,
      body: message,
      targetUserIds,
      url: targetUrl,
      data: metadata,
      sendAfter
    })

    // 3. Salvar no Log de Auditoria
    const logStatus = pushResponse.success ? 'sent' : 'failed'
    const errorMsg = pushResponse.success ? null : (pushResponse.error || 'Unknown error')

    const { error: logError } = await supabase.from('agenda_push_logs').insert({
      user_id: senderUserId || null,
      type,
      item_id: itemId,
      title,
      message,
      target_url: targetUrl,
      status: logStatus,
      error_message: errorMsg,
      onesignal_response: pushResponse.data || null
    })

    if (logError) {
      // Falha ao salvar log não deve estourar erro na UI, mas registramos no console server-side
      console.error(`[Push Central] Erro ao salvar log no banco para ${type}:`, logError.message)
    }

    return pushResponse
  } catch (error: any) {
    console.error(`[Push Central] Erro crítico ao processar push de ${type}:`, error.message)
    return { success: false, error: error.message }
  }
}
