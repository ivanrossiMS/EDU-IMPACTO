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
  | 'saida'
  | 'test' // ← adicionado para não quebrar tipagem no diagnóstico

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
 * Cache em memória para deduplicação intra-processo.
 * Sobrevive a hot-reloads do Next.js via singleton global —
 * sem isso, cada reload zeraria o cache e permitiria disparos duplicados.
 * A chave expira após 5 minutos para não crescer indefinidamente.
 */
// @ts-ignore
const _globalSentKeys: Map<string, number> = (global as any).__agendaPushSentKeys
  ?? ((global as any).__agendaPushSentKeys = new Map<string, number>())
const IN_PROCESS_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Limpa entradas expiradas do cache em memória.
 * Chamado de forma proativa para evitar acúmulo em servidores long-running.
 */
function _pruneExpiredKeys(): void {
  const now = Date.now()
  for (const [key, sentAt] of _globalSentKeys.entries()) {
    if (now - sentAt > IN_PROCESS_TTL_MS) {
      _globalSentKeys.delete(key)
    }
  }
}

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
  // A cada 100 inserções, limpar expirados para evitar memory leak em long-running servers
  if (_globalSentKeys.size > 0 && _globalSentKeys.size % 100 === 0) {
    _pruneExpiredKeys()
  }
  _globalSentKeys.set(key, Date.now())
}

/**
 * Cria um cliente Supabase Service Role para operações de servidor.
 * Usa cache no escopo do módulo para evitar múltiplas instâncias por request.
 */
function _createSupabaseService() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url: any, options: any) => fetch(url, { ...options, cache: 'no-store' }) }
    }
  )
}

/**
 * Constrói URL completa e segura usando URLSearchParams para evitar duplicatas de parâmetros.
 */
function _buildTargetUrl(targetUrl: string, itemId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://impacto-edu-app.vercel.app'
  const base = targetUrl.startsWith('http') ? targetUrl : `${appUrl}${targetUrl}`

  if (!itemId) return base

  try {
    const parsed = new URL(base)
    if (!parsed.searchParams.has('id')) {
      parsed.searchParams.set('id', itemId)
    }
    return parsed.toString()
  } catch {
    // URL inválida — fallback manual (evita crash)
    if (!base.includes('id=')) {
      return base + (base.includes('?') ? '&' : '?') + `id=${encodeURIComponent(itemId)}`
    }
    return base
  }
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

    // ── Criar cliente Supabase Service Role (uma única vez por request) ─────
    const supabaseService = _createSupabaseService()

    // ── Checagem de Configuração Global de Notificações Push ───────────────
    try {
      const { data: configRow } = await supabaseService
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'ad_config')
        .maybeSingle()

      if (configRow?.valor?.notificacoes) {
        const notifs = configRow.valor.notificacoes
        const configMap: Record<string, boolean | undefined> = {
          comunicados: notifs.pushComunicados,
          momentos:    notifs.pushMomentos,
          calendario:  notifs.pushCalendario,
          frequencia:  notifs.pushFrequencia,
          ocorrencias: notifs.pushOcorrencias,
          notas:       notifs.pushNotas,
          cobrancas:   notifs.pushFinanceiro,
          saida:       notifs.pushSaidaPortaria,
          test:        true, // testes de diagnóstico sempre passam
        }

        if (configMap[type] === false) {
          console.log(`${logPrefix} Push do tipo '${type}' está DESATIVADO nas configurações globais. Abortando envio.`)
          return { success: true, skipped: true, reason: 'disabled_by_admin_config' }
        }
      }
    } catch (configCheckError) {
      console.warn(`${logPrefix} Aviso: erro ao consultar ad_config, prosseguindo envio:`, configCheckError)
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

    // Construir URL segura com URLSearchParams (evita duplicar parâmetro 'id=')
    const fullUrl = _buildTargetUrl(targetUrl, itemId)

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
    const logStatus = 'sent'
    const errorMsg = pushResponse.mock
      ? 'Mock mode: credenciais OneSignal não configuradas (push simulado)'
      : (pushResponse.success ? null : (pushResponse.error || 'Unknown error'))

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
