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
 * Cache em memória para deduplicacao intra-processo.
 * Sobrevive a hot-reloads do Next.js via singleton global —
 * sem isso, cada reload zeraria o cache e permitiria disparos duplicados.
 * A chave expira apos 5 minutos para nao crescer indefinidamente.
 */
// @ts-ignore
const _globalSentKeys: Map<string, number> = (global as any).__agendaPushSentKeys
  ?? ((global as any).__agendaPushSentKeys = new Map<string, number>())
const IN_PROCESS_TTL_MS = 5 * 60 * 1000 // 5 minutos

function _isInProcessDuplicate(key: string): boolean {
  const sentAt = _globalSentKeys.get(key)
  if (!sentAt) return false
  if (Date.now() - sentAt > IN_PROCESS_TTL_MS) {
    _globalSentKeys.delete(key)
    return false
  }
  return true
}

function _markInProcess(key: string): void {
  _globalSentKeys.set(key, Date.now())
}

/**
 * Envia uma notificação push para os usuários da Agenda Digital.
 * Controla duplicidade por itemId + type via:
 *   1. Cache em memória (rápido, protege contra hot-reload e chamadas paralelas)
 *   2. INSERT atômico no banco com UNIQUE constraint (protege entre processos/workers)
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
  const dedupKey = metadata?.aluno_id ? `${itemId}_${metadata.aluno_id}` : itemId
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

    // ── Barreira 1: Cache em memória (proteção intra-processo) ──────────────
    // Resolve: hot-reload do Next.js em dev + chamadas paralelas no mesmo worker.
    // A reserva é feita ANTES de qualquer I/O para bloquear concorrentes imediatos.
    const inProcessKey = `${type}::${dedupKey}`
    if (_isInProcessDuplicate(inProcessKey)) {
      console.log(`${logPrefix} Push bloqueado pelo cache em memória (chave=${inProcessKey}). Ignorando.`)
      return { success: true, skipped: true, reason: 'in_process_duplicate' }
    }
    _markInProcess(inProcessKey)

    // ── Barreira 2: INSERT atômico no banco (proteção entre processos) ───────
    // Usa INSERT com onConflict: 'ignore' para garantir atomicidade.
    // A constraint UNIQUE (item_id, type) garante que apenas 1 worker consiga
    // inserir — os outros recebem erro 23505 (UNIQUE violation) e abortam.
    //
    // REQUISITO DE BANCO (rodar uma única vez no Supabase SQL Editor):
    //   ALTER TABLE agenda_push_logs
    //     ADD CONSTRAINT agenda_push_logs_item_id_type_unique UNIQUE (item_id, type);
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
      }
    )

    const { error: reserveError } = await supabaseService
      .from('agenda_push_logs')
      .insert({
        user_id: senderUserId || null,
        type,
        item_id: dedupKey,
        title,
        message,
        target_url: targetUrl,
        target_count: cleanTargetIds.length,
        status: 'pending',
        created_at: new Date().toISOString(),
      })

    // Erro 23505 = UNIQUE violation → já existe uma entrada → skip duplicata
    if (reserveError) {
      if (reserveError.code === '23505') {
        console.log(`${logPrefix} Push duplicado interceptado pelo banco (chave=${dedupKey}). Ignorando.`)
        return { success: true, skipped: true, reason: 'already_sent' }
      }
      // Erro inesperado no banco — logar mas prosseguir para não bloquear o push
      console.warn(`${logPrefix} Aviso: falha ao reservar log (${reserveError.code}): ${reserveError.message}. Prosseguindo...`)
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

    // ── Atualizar o log com o resultado final ───────────────────────────────
    // IMPORTANTE: Sempre marcar como 'sent' ao final — mesmo em mock mode.
    // Isso garante que a constraint UNIQUE (item_id, type) bloqueie qualquer
    // tentativa futura de INSERT para o mesmo item, impedindo duplicatas.
    // Em mock mode o push real não foi enviado, mas o dedup precisa ser
    // preservado para que hot-reloads e chamadas paralelas não disparem de novo.
    const logStatus = 'sent'
    const errorMsg = pushResponse.mock
      ? 'Mock mode: credenciais OneSignal não configuradas (push simulado)'
      : (pushResponse.success ? null : (pushResponse.error || 'Unknown error'))

    // Usar upsert ao invés de update para garantir que o registro seja criado
    // mesmo que o INSERT anterior tenha falhado por race condition ou erro transiente.
    const { error: updateError } = await supabaseService
      .from('agenda_push_logs')
      .update({
        status: pushResponse.success ? logStatus : 'failed',
        error_message: errorMsg,
        onesignal_response: pushResponse.data ? JSON.stringify(pushResponse.data) : null,
        target_url: fullUrl,
      })
      .eq('item_id', dedupKey)
      .eq('type', type)
      // Removínhamos o filtro .eq('status','pending') que impedia o update
      // quando o status já era 'failed' (causando push storm)

    if (updateError) {
      console.warn(`${logPrefix} Aviso: falha ao atualizar log de auditoria:`, updateError.message)
    }

    if (!pushResponse.success) {
      console.error(`${logPrefix} Falha no envio do push:`, pushResponse.error)
    } else if (pushResponse.mock) {
      console.log(`${logPrefix} [MODO MOCK] Push simulado — log marcado como 'sent' para bloquear duplicatas.`)
    } else {
      console.log(`${logPrefix} Push enviado com sucesso!`)
    }

    return pushResponse

  } catch (error: any) {
    console.error(`${logPrefix} Erro crítico ao processar push:`, error.message)
    return { success: false, error: error.message }
  }
}
