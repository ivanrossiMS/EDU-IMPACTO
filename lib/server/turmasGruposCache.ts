import { supabaseServer } from '@/lib/supabaseServer'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 60 * 1000 // 60 segundos
const ALUNOS_CACHE_TTL_MS = 45 * 1000 // 45 segundos

let turmasCache: CacheEntry<any[]> | null = null
let gruposCache: CacheEntry<any[]> | null = null
let equipesCache: CacheEntry<any[]> | null = null
let activeAlunosCache: CacheEntry<any[]> | null = null
let systemUsersCache: CacheEntry<any[]> | null = null
let funcionariosCache: CacheEntry<any[]> | null = null

let inflightTurmasGrupos: Promise<{ allTurmas: any[]; allGrupos: any[] }> | null = null
let inflightActiveAlunos: Promise<any[]> | null = null
let inflightEquipes: Promise<any[]> | null = null
let inflightSystemUsers: Promise<any[]> | null = null
let inflightFuncionarios: Promise<any[]> | null = null

/**
 * Retorna todas as turmas e grupos da agenda com cache em memória (TTL 60s) e deduplicação in-flight.
 * Evita que dezenas de requisições simultâneas varram repetidamente as tabelas turmas e agenda_grupos.
 */
export async function getCachedTurmasAndGrupos(): Promise<{ allTurmas: any[]; allGrupos: any[] }> {
  const now = Date.now()

  const shouldFetchTurmas = !turmasCache || (now - turmasCache.timestamp > CACHE_TTL_MS)
  const shouldFetchGrupos = !gruposCache || (now - gruposCache.timestamp > CACHE_TTL_MS)

  if (!shouldFetchTurmas && !shouldFetchGrupos) {
    return {
      allTurmas: turmasCache?.data || [],
      allGrupos: gruposCache?.data || []
    }
  }

  if (inflightTurmasGrupos) {
    return inflightTurmasGrupos
  }

  inflightTurmasGrupos = (async () => {
    try {
      const fetchTurmas = shouldFetchTurmas
        ? supabaseServer.from('turmas').select('id, nome, codigo, ano, turno, serie, capacidade, dados')
        : Promise.resolve({ data: turmasCache!.data, error: null })

      const fetchGrupos = shouldFetchGrupos
        ? supabaseServer.from('agenda_grupos').select('id, dados')
        : Promise.resolve({ data: gruposCache!.data, error: null })

      const [tRes, gRes] = await Promise.all([fetchTurmas, fetchGrupos])

      const finishedAt = Date.now()
      if (tRes.data && shouldFetchTurmas) {
        turmasCache = { data: tRes.data, timestamp: finishedAt }
      }
      if (gRes.data && shouldFetchGrupos) {
        gruposCache = { data: gRes.data, timestamp: finishedAt }
      }

      return {
        allTurmas: turmasCache?.data || [],
        allGrupos: gruposCache?.data || []
      }
    } finally {
      inflightTurmasGrupos = null
    }
  })()

  return inflightTurmasGrupos
}

/**
 * Retorna todas as equipes da agenda com cache em memória (TTL 60s) e deduplicação in-flight.
 */
export async function getCachedEquipes(): Promise<any[]> {
  const now = Date.now()
  if (equipesCache && (now - equipesCache.timestamp <= CACHE_TTL_MS)) {
    return equipesCache.data
  }
  if (inflightEquipes) {
    return inflightEquipes
  }
  inflightEquipes = (async () => {
    try {
      const { data, error } = await supabaseServer.from('agenda_equipes').select('id, dados')
      if (error) throw error
      const result = data || []
      equipesCache = { data: result, timestamp: Date.now() }
      return result
    } finally {
      inflightEquipes = null
    }
  })()
  return inflightEquipes
}

/**
 * Retorna os alunos ativos para cálculos de vínculos, KPIs e turmas com cache em memória (TTL 45s) e deduplicação in-flight.
 */
export async function getCachedActiveAlunos(): Promise<any[]> {
  const now = Date.now()

  if (activeAlunosCache && (now - activeAlunosCache.timestamp <= ALUNOS_CACHE_TTL_MS)) {
    return activeAlunosCache.data
  }

  if (inflightActiveAlunos) {
    return inflightActiveAlunos
  }

  inflightActiveAlunos = (async () => {
    try {
      const { data } = await supabaseServer
        .from('alunos')
        .select('id, nome, matricula, turma, serie, turno, unidade, status, dados')
        .or('status.neq.inativo,status.is.null')

      const result = data || []
      activeAlunosCache = { data: result, timestamp: Date.now() }
      return result
    } finally {
      inflightActiveAlunos = null
    }
  })()

  return inflightActiveAlunos
}

/**
 * Invalida o cache de turmas (por exemplo após inserção, edição ou exclusão de turma).
 */
export function invalidateTurmasCache() {
  turmasCache = null
}

/**
 * Invalida o cache de grupos da agenda.
 */
export function invalidateGruposCache() {
  gruposCache = null
  equipesCache = null
}

/**
 * Invalida o cache de equipes da agenda.
 */
export function invalidateEquipesCache() {
  equipesCache = null
}

/**
 * Invalida o cache de alunos ativos.
 */
export function invalidateAlunosCache() {
  activeAlunosCache = null
}

/**
 * Retorna os usuários do sistema (system_users) com cache em memória (TTL 45s) e deduplicação in-flight.
 * Evita varreduras repetidas de 5000 linhas em loops de notificações e relatórios em lote.
 */
export async function getCachedSystemUsers(): Promise<any[]> {
  const now = Date.now()
  if (systemUsersCache && (now - systemUsersCache.timestamp <= ALUNOS_CACHE_TTL_MS)) {
    return systemUsersCache.data
  }
  if (inflightSystemUsers) {
    return inflightSystemUsers
  }
  inflightSystemUsers = (async () => {
    try {
      const { data } = await supabaseServer
        .from('system_users')
        .select('id, auth_id, email, nome, cargo, perfil, status, dados')
        .limit(5000)
      const result = data || []
      systemUsersCache = { data: result, timestamp: Date.now() }
      return result
    } finally {
      inflightSystemUsers = null
    }
  })()
  return inflightSystemUsers
}

/**
 * Retorna os funcionários com cache em memória (TTL 45s) e deduplicação in-flight.
 */
export async function getCachedFuncionarios(): Promise<any[]> {
  const now = Date.now()
  if (funcionariosCache && (now - funcionariosCache.timestamp <= ALUNOS_CACHE_TTL_MS)) {
    return funcionariosCache.data
  }
  if (inflightFuncionarios) {
    return inflightFuncionarios
  }
  inflightFuncionarios = (async () => {
    try {
      const { data } = await supabaseServer
        .from('funcionarios')
        .select('id, codigo, email, nome, cargo, status, dados')
        .limit(3000)
      const result = data || []
      funcionariosCache = { data: result, timestamp: Date.now() }
      return result
    } finally {
      inflightFuncionarios = null
    }
  })()
  return inflightFuncionarios
}

/**
 * Invalida o cache de usuários e funcionários.
 */
export function invalidateUsersCache() {
  systemUsersCache = null
  funcionariosCache = null
}

