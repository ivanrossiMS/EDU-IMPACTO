import { getAdminClient } from './supabaseAdminSingleton'

export interface AuditSettings {
  paused: boolean
  auto_delete_enabled: boolean
  auto_delete_days: number
  last_cleanup_at?: string
}

export interface AuditLogInput {
  usuarioId?: string | null
  usuarioNome?: string | null
  perfil?: string | null
  modulo: string
  acao: string
  descricao: string
  registroId?: string | number | null
  nomeRelacionado?: string | null
  detalhesAntes?: any
  detalhesDepois?: any
  status?: 'sucesso' | 'erro' | 'aviso'
  origem?: 'web' | 'mobile' | 'api' | 'sistema'
  ip?: string | null
}

const DEFAULT_SETTINGS: AuditSettings = {
  paused: false,
  auto_delete_enabled: true,
  auto_delete_days: 90,
  last_cleanup_at: undefined,
}

// ── In-memory cache for audit settings to achieve 0-overhead checks ─────────
let cachedSettings: AuditSettings | null = null
let settingsCacheTimestamp = 0
const SETTINGS_CACHE_TTL_MS = 30_000 // 30 seconds

// ── Perfis expressamente excluídos da auditoria escolar (Alunos e Famílias) ──
const EXCLUDED_PROFILES_LOWER = [
  'aluno',
  'alunos',
  'estudante',
  'estudantes',
  'responsavel',
  'responsável',
  'responsaveis',
  'responsáveis',
  'familia',
  'família',
  'pais',
  'pai',
  'mae',
  'mãe'
]

/**
 * Verifica se um perfil deve ser auditado.
 * Regra: Alunos e famílias NUNCA são auditados no log da gestão escolar.
 * Apenas administradores, professores e colaboradores/funcionários são rastreados.
 */
export function isProfileEligibleForAudit(perfil?: string | null): boolean {
  if (!perfil) return true // Se indefinido, mas em rota interna protegida, mantém por precaução
  const normalized = perfil.toLowerCase().trim()
  return !EXCLUDED_PROFILES_LOWER.some(excluded => normalized.includes(excluded))
}

/**
 * Busca as configurações de auditoria persistidas no Supabase (tabela configuracoes).
 */
export async function getAuditSettings(): Promise<AuditSettings> {
  const now = Date.now()
  if (cachedSettings && now - settingsCacheTimestamp < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings
  }

  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'audit_settings')
      .maybeSingle()

    if (data && data.valor && typeof data.valor === 'object') {
      cachedSettings = {
        paused: Boolean(data.valor.paused),
        auto_delete_enabled: data.valor.auto_delete_enabled ?? true,
        auto_delete_days: Number(data.valor.auto_delete_days) || 90,
        last_cleanup_at: data.valor.last_cleanup_at,
      }
    } else {
      cachedSettings = { ...DEFAULT_SETTINGS }
    }
  } catch (err) {
    console.warn('[AuditLogger] Falha ao carregar configurações de auditoria:', err)
    if (!cachedSettings) cachedSettings = { ...DEFAULT_SETTINGS }
  }

  settingsCacheTimestamp = now
  return cachedSettings
}

/**
 * Atualiza as configurações de auditoria e invalida o cache.
 */
export async function updateAuditSettings(newSettings: Partial<AuditSettings>): Promise<AuditSettings> {
  const current = await getAuditSettings()
  const updated: AuditSettings = {
    ...current,
    ...newSettings,
  }

  const supabase = getAdminClient()
  await supabase
    .from('configuracoes')
    .upsert({
      chave: 'audit_settings',
      valor: updated,
      updated_at: new Date().toISOString(),
    })

  cachedSettings = updated
  settingsCacheTimestamp = Date.now()
  return updated
}

/**
 * Sanitiza valores complexos e omite dados binários/pesados (fotos, base64, PDFs).
 */
function sanitizeValue(value: any, depth = 0): any {
  if (value === null || value === undefined) return value
  if (depth > 4) return '[PROFUNDIDADE_MAXIMA]'

  if (typeof value === 'string') {
    if (value.startsWith('data:image') || value.startsWith('data:application')) {
      return '[ARQUIVO_BINARIO_OMITIDO]'
    }
    if (value.length > 500) {
      return value.slice(0, 500) + '... [TRUNCADO_PELA_AUDITORIA]'
    }
    return value
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length > 20) {
        return value.slice(0, 20).map(v => sanitizeValue(v, depth + 1)).concat(['[...itens_adicionais_omitidos]'] as any)
      }
      return value.map(v => sanitizeValue(v, depth + 1))
    }

    const cleaned: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase()
      if (lower.includes('senha') || lower.includes('password') || lower.includes('token') || lower.includes('secret')) {
        cleaned[k] = '[CONFIDENCIAL_OCULTO]'
      } else if (lower.includes('foto') || lower.includes('base64') || lower.includes('documentobase64')) {
        cleaned[k] = '[ARQUIVO_OMITIDO]'
      } else {
        cleaned[k] = sanitizeValue(v, depth + 1)
      }
    }
    return cleaned
  }

  return value
}

/**
 * Smart Diff: Identifica apenas os campos que realmente foram alterados entre antes e depois,
 * reduzindo o consumo de armazenamento no Supabase em até 95%.
 */
export function computeSmartDiff(antes: any, depois: any): { antesDiff: any; depoisDiff: any } {
  if (!antes && !depois) return { antesDiff: null, depoisDiff: null }
  if (!antes && depois) return { antesDiff: null, depoisDiff: sanitizeValue(depois) }
  if (antes && !depois) return { antesDiff: sanitizeValue(antes), depoisDiff: null }

  // Se ambos forem objetos primitivos ou não-objetos
  if (typeof antes !== 'object' || typeof depois !== 'object') {
    if (antes !== depois) {
      return { antesDiff: sanitizeValue(antes), depoisDiff: sanitizeValue(depois) }
    }
    return { antesDiff: null, depoisDiff: null }
  }

  const diffAntes: Record<string, any> = {}
  const diffDepois: Record<string, any> = {}
  const allKeys = new Set([...Object.keys(antes), ...Object.keys(depois)])

  for (const key of allKeys) {
    const valA = antes[key]
    const valB = depois[key]

    // Ignora metadados voláteis
    if (key === 'updated_at' || key === 'updatedAt' || key === 'lastModified') continue

    const strA = JSON.stringify(valA)
    const strB = JSON.stringify(valB)

    if (strA !== strB) {
      diffAntes[key] = sanitizeValue(valA)
      diffDepois[key] = sanitizeValue(valB)
    }
  }

  return {
    antesDiff: Object.keys(diffAntes).length > 0 ? diffAntes : null,
    depoisDiff: Object.keys(diffDepois).length > 0 ? diffDepois : null,
  }
}

/**
 * Registra um evento de auditoria no sistema de forma ultra-rápida, segura e econômica.
 * Retorna true se gravado, false se descartado (ex: pausado ou perfil de aluno/família).
 */
export async function recordAuditLog(input: AuditLogInput): Promise<boolean> {
  try {
    // 1. Rejeita imediatamente logs de Performance / Web Vitals
    if (input.modulo === 'Performance' || input.acao === 'WEB_VITALS') {
      return false
    }

    // 2. Filtro estrito de público: Alunos e Famílias não são auditados
    if (!isProfileEligibleForAudit(input.perfil)) {
      return false
    }

    // 3. Verifica se a auditoria está pausada
    const settings = await getAuditSettings()
    if (settings.paused) {
      return false
    }

    // 4. Executa Smart Diff para economizar armazenamento
    const { antesDiff, depoisDiff } = computeSmartDiff(input.detalhesAntes, input.detalhesDepois)

    const row = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data_hora: new Date().toISOString(),
      usuario_nome: input.usuarioNome || 'Colaborador',
      perfil: input.perfil || 'Colaborador',
      modulo: input.modulo || 'Geral',
      acao: input.acao || 'Ação',
      descricao: input.descricao || '',
      status: input.status || 'sucesso',
      origem: input.origem || 'sistema',
      registro_id: input.registroId ? String(input.registroId) : null,
      nome_relacionado: input.nomeRelacionado || null,
      detalhes_antes: antesDiff,
      detalhes_depois: depoisDiff,
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from('system_logs').insert(row)
    if (error) {
      console.error('[AuditLogger] Erro ao gravar log:', error.message)
      return false
    }

    // 5. Aciona auto-cleanup em background sem bloquear o retorno
    checkAndTriggerAutoCleanup(settings).catch(() => {})

    return true
  } catch (err: any) {
    console.error('[AuditLogger] Exceção inesperada:', err?.message || err)
    return false
  }
}

/**
 * Limpeza automática periódica (executada no máximo 1 vez a cada 24 horas).
 */
async function checkAndTriggerAutoCleanup(settings: AuditSettings) {
  if (!settings.auto_delete_enabled || !settings.auto_delete_days || settings.auto_delete_days <= 0) {
    return
  }

  const now = Date.now()
  const lastCleanupTime = settings.last_cleanup_at ? new Date(settings.last_cleanup_at).getTime() : 0
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  // Se já rodou nas últimas 24h, pula
  if (now - lastCleanupTime < ONE_DAY_MS) {
    return
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - settings.auto_delete_days)

    const supabase = getAdminClient()
    await supabase
      .from('system_logs')
      .delete()
      .lt('data_hora', cutoff.toISOString())

    await updateAuditSettings({
      last_cleanup_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[AuditLogger] Falha na auto-limpeza de logs:', err)
  }
}

/**
 * Exclusão manual de logs por intervalo de datas ou anterior a uma data específica.
 */
export async function deleteLogsByRange({
  beforeDate,
  startDate,
  endDate,
  olderThanDays,
}: {
  beforeDate?: string
  startDate?: string
  endDate?: string
  olderThanDays?: number
}): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const supabase = getAdminClient()
    let query = supabase.from('system_logs').delete()

    if (olderThanDays && olderThanDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - olderThanDays)
      query = query.lt('data_hora', cutoff.toISOString())
    } else if (beforeDate) {
      const cutoff = new Date(beforeDate)
      query = query.lt('data_hora', cutoff.toISOString())
    } else if (startDate && endDate) {
      const s = new Date(startDate).toISOString()
      const e = new Date(endDate).toISOString()
      query = query.gte('data_hora', s).lte('data_hora', e)
    } else {
      return { ok: false, error: 'Parâmetros de data insuficientes para exclusão segura.' }
    }

    const { error } = await query
    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message || 'Erro ao deletar registros de log.' }
  }
}

/**
 * Utilitário especializado para purgar logs de telemetria / Web Vitals legados.
 */
export async function purgeLegacyPerformanceLogs(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .or('modulo.eq.Performance,acao.eq.WEB_VITALS')

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
