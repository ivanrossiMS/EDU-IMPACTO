/**
 * pushPauseService.ts — Serviço Central de Pausa / Silenciamento Global de Notificações Push
 *
 * Requisito de Negócio:
 * 1. Permite pausar todas as notificações push do sistema em caso de manutenção, testes ou contingência.
 * 2. Suporta EXCEÇÕES (Whitelist): alunos selecionados cujas notificações e de seus responsáveis
 *    CONTINUARÃO sendo enviadas normalmente mesmo com a pausa global ativa.
 * 3. O sistema continua operando normalmente: chamada de frequência, catraca/portaria, notas,
 *    comunicados, momentos e chat continuam gravando dados no banco de dados sem nenhum bloqueio.
 * 4. NENHUMA notificação push é enviada aos celulares dos usuários pausados enquanto a pausa estiver ativa.
 * 5. Ao despausar, as notificações que ocorreram durante o período de pausa NÃO são reenviadas
 *    (sem acúmulo de fila ou enxurrada de notificações tardias).
 * 6. Possui cache de curtíssima duração (2.5s) na memória do servidor para suportar picos de tráfego
 *    sem sobrecarregar o banco de dados.
 */

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export interface PushPauseExceptionStudent {
  id: string
  nome: string
  turma?: string
  foto?: string | null
  matricula?: string | null
  responsaveisCount?: number
}

export interface PushPauseStatus {
  paused: boolean
  pausedAt: string | null
  pausedBy: string | null
  pauseReason: string | null
  unpausedAt?: string | null
  unpausedBy?: string | null
  /** Alunos selecionados como exceção (não pausados, recebem notificações normalmente junto com seus responsáveis) */
  exemptStudents?: PushPauseExceptionStudent[]
  /** Lista pré-calculada de IDs (alunos + responsáveis vinculados) para verificação ultra-rápida (0.01ms) */
  exemptUserIds?: string[]
}

const DEFAULT_PAUSE_STATUS: PushPauseStatus = {
  paused: false,
  pausedAt: null,
  pausedBy: null,
  pauseReason: null,
  unpausedAt: null,
  unpausedBy: null,
  exemptStudents: [],
  exemptUserIds: [],
}

// Cache persistente em memória intra-processo para performance em horários de pico
let _cachedStatus: PushPauseStatus | null = null
let _lastCacheTime = 0
const CACHE_TTL_MS = 2500 // 2.5 segundos de TTL

/**
 * Resolve todos os IDs relacionados aos alunos de exceção e aos seus responsáveis vinculados.
 * Isso inclui variações com/sem zero à esquerda, prefixos e emails para garantir matching com o OneSignal.
 */
export async function resolveExemptUserIds(
  supabase: any,
  studentIds: string[]
): Promise<string[]> {
  const cleanStudentIds = studentIds
    .filter(id => id && typeof id === 'string' && id.trim().length > 0)
    .map(id => id.trim())

  if (cleanStudentIds.length === 0) return []

  const searchAlunoIds = Array.from(
    new Set([
      ...cleanStudentIds,
      ...cleanStudentIds.map(id => id.replace(/^0+/, '')),
      ...cleanStudentIds.map(id => (!isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')),
    ].filter(Boolean))
  )

  // 1. Buscar vínculos de responsáveis na tabela aluno_responsavel
  const { data: vinculos } = await supabase
    .from('aluno_responsavel')
    .select('aluno_id, responsavel_id')
    .in('aluno_id', searchAlunoIds)

  const respIds: string[] = Array.from(
    new Set<string>((vinculos || []).map((v: any) => String(v.responsavel_id).trim()).filter(Boolean))
  )

  // 2. Buscar emails e telefones dos responsáveis
  let respEmails: string[] = []
  if (respIds.length > 0) {
    const searchRespIds = Array.from(
      new Set<string>([
        ...respIds,
        ...respIds.map((id: string) => id.replace(/^0+/, '')),
        ...respIds.map((id: string) => (!isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')),
      ].filter(Boolean))
    )

    const { data: resps } = await supabase
      .from('responsaveis')
      .select('id, email')
      .in('id', searchRespIds)

    if (resps) {
      respEmails = resps.map((r: any) => r.email?.trim().toLowerCase()).filter(Boolean)
    }
  }

  // 3. Montar conjunto expandido com todos os identificadores possíveis
  const allIdentifiers = new Set<string>()

  // Alunos
  for (const sId of searchAlunoIds) {
    allIdentifiers.add(sId)
    allIdentifiers.add(`a_${sId}`)
    allIdentifiers.add(`_ALU${sId}`)
  }

  // Responsáveis
  for (const rId of respIds) {
    const unpadded = rId.replace(/^0+/, '')
    const padded = !isNaN(Number(rId)) ? String(Number(rId)).padStart(6, '0') : ''
    allIdentifiers.add(rId)
    if (unpadded) allIdentifiers.add(unpadded)
    if (padded) allIdentifiers.add(padded)
    allIdentifiers.add(`f_${rId}`)
    allIdentifiers.add(`resp_${rId}`)
    allIdentifiers.add(`func_${rId}`)
  }

  // Emails dos responsáveis
  for (const email of respEmails) {
    allIdentifiers.add(email)
  }

  return Array.from(allIdentifiers)
}

/**
 * Consulta o status atual de pausa das notificações push.
 */
export async function getPushPauseStatus(): Promise<PushPauseStatus> {
  const now = Date.now()
  if (_cachedStatus && (now - _lastCacheTime < CACHE_TTL_MS)) {
    return _cachedStatus
  }

  try {
    const supabase = getAdminClient()

    // 1. Tentar ler da chave dedicada 'push_pause_status'
    const { data: dedicatedRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'push_pause_status')
      .maybeSingle()

    if (dedicatedRow?.valor && typeof dedicatedRow.valor === 'object') {
      const v = dedicatedRow.valor
      const status: PushPauseStatus = {
        paused: Boolean(v.paused),
        pausedAt: v.pausedAt || null,
        pausedBy: v.pausedBy || null,
        pauseReason: v.pauseReason || null,
        unpausedAt: v.unpausedAt || null,
        unpausedBy: v.unpausedBy || null,
        exemptStudents: Array.isArray(v.exemptStudents) ? v.exemptStudents : [],
        exemptUserIds: Array.isArray(v.exemptUserIds) ? v.exemptUserIds : [],
      }
      _cachedStatus = status
      _lastCacheTime = now
      return status
    }

    // 2. Fallback para ad_config.valor.notificacoes.pausarNotificacoes
    const { data: adConfigRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'ad_config')
      .maybeSingle()

    const notifs = adConfigRow?.valor?.notificacoes
    if (notifs) {
      const isPaused = Boolean(notifs.pausarNotificacoes || notifs.notificacoesPausadas)
      const status: PushPauseStatus = {
        paused: isPaused,
        pausedAt: notifs.pausadoEm || null,
        pausedBy: notifs.pausadoPor || null,
        pauseReason: notifs.pausadoMotivo || null,
        unpausedAt: notifs.despausadoEm || null,
        unpausedBy: notifs.despausadoPor || null,
        exemptStudents: Array.isArray(notifs.exemptStudents) ? notifs.exemptStudents : [],
        exemptUserIds: Array.isArray(notifs.exemptUserIds) ? notifs.exemptUserIds : [],
      }
      _cachedStatus = status
      _lastCacheTime = now
      return status
    }

    _cachedStatus = DEFAULT_PAUSE_STATUS
    _lastCacheTime = now
    return DEFAULT_PAUSE_STATUS
  } catch (err: any) {
    console.warn('⚠️ [PushPauseService] Erro ao consultar status de pausa:', err?.message || err)
    return _cachedStatus || DEFAULT_PAUSE_STATUS
  }
}

/**
 * Retorna true se os envios de notificação push estiverem pausados.
 */
export async function isPushNotificationsPaused(): Promise<boolean> {
  const status = await getPushPauseStatus()
  return status.paused
}

/**
 * Verifica se um disparo específico se enquadra na lista de EXCEÇÕES da pausa.
 * Retorna se está liberado e a lista filtrada de destinatários liberados.
 */
export function isNotificationExemptFromPause(
  pauseStatus: PushPauseStatus,
  params: {
    alunoId?: string | number | null
    targetUserIds?: string[]
  }
): { exempt: boolean; matchedTargetIds: string[] } {
  // Se não estiver pausado, tudo está liberado
  if (!pauseStatus.paused) {
    return { exempt: true, matchedTargetIds: params.targetUserIds || [] }
  }

  const exemptStudents = pauseStatus.exemptStudents || []
  const exemptUserIds = pauseStatus.exemptUserIds || []

  // Se não houver alunos de exceção cadastrados, nada está liberado
  if (exemptStudents.length === 0 && exemptUserIds.length === 0) {
    return { exempt: false, matchedTargetIds: [] }
  }

  const exemptStudentIdSet = new Set(
    exemptStudents.map(s => String(s.id).toLowerCase().trim().replace(/^0+/, ''))
  )
  const exemptUserSet = new Set(
    exemptUserIds.map(id => id.toLowerCase().trim())
  )

  // 1. Checar se o alunoId passado diretamente corresponde a um aluno liberado
  if (params.alunoId !== undefined && params.alunoId !== null && String(params.alunoId).trim().length > 0) {
    const cleanAlunoId = String(params.alunoId).toLowerCase().trim().replace(/^0+/, '')
    if (exemptStudentIdSet.has(cleanAlunoId)) {
      // O aluno está liberado: todos os destinatários informados (responsáveis dele) devem receber o push
      return { exempt: true, matchedTargetIds: params.targetUserIds || [] }
    }
  }

  // 2. Checar se algum dos targetUserIds corresponde a alunos ou responsáveis liberados
  if (params.targetUserIds && params.targetUserIds.length > 0) {
    const matched = params.targetUserIds.filter(id => {
      if (!id) return false
      const cleanId = String(id).toLowerCase().trim()
      const unpadded = cleanId.replace(/^0+/, '')
      const withoutPrefix = cleanId.replace(/^(?:f_|func_|eq_|g_|a_|_ALU|resp_)/i, '')
      return (
        exemptUserSet.has(cleanId) ||
        exemptUserSet.has(unpadded) ||
        exemptUserSet.has(withoutPrefix) ||
        exemptStudentIdSet.has(unpadded)
      )
    })

    if (matched.length > 0) {
      return { exempt: true, matchedTargetIds: matched }
    }
  }

  return { exempt: false, matchedTargetIds: [] }
}

/**
 * Ativa ou desativa a pausa global de notificações push, opcionalmente definindo alunos de exceção.
 */
export async function setPushNotificationsPaused(
  paused: boolean,
  user?: { id?: string; nome?: string; email?: string } | null,
  motivo?: string | null,
  exemptStudents?: PushPauseExceptionStudent[] | null
): Promise<PushPauseStatus> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()
  const userName = user?.nome || user?.email || (user?.id ? `Usuário (${user.id.slice(0, 8)})` : 'Administrador')

  const current = await getPushPauseStatus()

  // Se exemptStudents não foi informado, mantém o atual se estiver pausando, ou limpa se for passado array vazio
  const finalExemptStudents = exemptStudents !== undefined
    ? (exemptStudents || [])
    : (current.exemptStudents || [])

  // Resolver identificadores completos dos alunos e responsáveis de exceção
  let finalExemptUserIds: string[] = []
  if (finalExemptStudents.length > 0) {
    const studentIds = finalExemptStudents.map(s => String(s.id))
    finalExemptUserIds = await resolveExemptUserIds(supabase, studentIds)
  }

  const updatedStatus: PushPauseStatus = {
    paused,
    pausedAt: paused ? now : current.pausedAt,
    pausedBy: paused ? userName : current.pausedBy,
    pauseReason: paused ? (motivo !== undefined ? (motivo?.trim() || null) : current.pauseReason) : current.pauseReason,
    unpausedAt: !paused ? now : current.unpausedAt,
    unpausedBy: !paused ? userName : current.unpausedBy,
    exemptStudents: finalExemptStudents,
    exemptUserIds: finalExemptUserIds,
  }

  // 1. Atualizar chave dedicada 'push_pause_status'
  const { error: upsertErr } = await supabase
    .from('configuracoes')
    .upsert({
      chave: 'push_pause_status',
      valor: updatedStatus,
      updated_at: now,
    })

  if (upsertErr) {
    console.error('❌ [PushPauseService] Erro ao salvar push_pause_status:', upsertErr)
  }

  // 2. Sincronizar também com ad_config para manter consistência nos painéis
  try {
    const { data: adConfigRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'ad_config')
      .maybeSingle()

    if (adConfigRow?.valor) {
      const updatedAdConfig = {
        ...adConfigRow.valor,
        notificacoes: {
          ...(adConfigRow.valor.notificacoes || {}),
          pausarNotificacoes: paused,
          pausadoEm: updatedStatus.pausedAt,
          pausadoPor: updatedStatus.pausedBy,
          pausadoMotivo: updatedStatus.pauseReason,
          despausadoEm: updatedStatus.unpausedAt,
          despausadoPor: updatedStatus.unpausedBy,
          exemptStudents: updatedStatus.exemptStudents,
          exemptUserIds: updatedStatus.exemptUserIds,
        },
      }
      await supabase
        .from('configuracoes')
        .upsert({
          chave: 'ad_config',
          valor: updatedAdConfig,
          updated_at: now,
        })
    }
  } catch (err: any) {
    console.warn('⚠️ [PushPauseService] Erro ao sincronizar ad_config:', err?.message || err)
  }

  // 3. Atualizar cache de memória instantaneamente
  _cachedStatus = updatedStatus
  _lastCacheTime = Date.now()

  console.log(
    `🔔 [PushPauseService] Notificações push ${paused ? 'PAUSADAS ⏸️' : 'RETOMADAS ▶️'} por ${userName}.${
      paused && motivo ? ` Motivo: "${motivo}".` : ''
    } Exceções liberadas: ${finalExemptStudents.length} aluno(s).`
  )

  return updatedStatus
}
