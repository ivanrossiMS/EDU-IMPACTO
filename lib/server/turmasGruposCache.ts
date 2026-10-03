import { supabaseServer } from '@/lib/supabaseServer'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 60 * 1000 // 60 segundos
const ALUNOS_CACHE_TTL_MS = 45 * 1000 // 45 segundos

let turmasCache: CacheEntry<any[]> | null = null
let gruposCache: CacheEntry<any[]> | null = null
let activeAlunosCache: CacheEntry<any[]> | null = null

/**
 * Retorna todas as turmas e grupos da agenda com cache em memória (TTL 60s).
 * Evita que dezenas de requisições simultâneas varram repetidamente as tabelas turmas e agenda_grupos.
 */
export async function getCachedTurmasAndGrupos(): Promise<{ allTurmas: any[]; allGrupos: any[] }> {
  const now = Date.now()

  const shouldFetchTurmas = !turmasCache || (now - turmasCache.timestamp > CACHE_TTL_MS)
  const shouldFetchGrupos = !gruposCache || (now - gruposCache.timestamp > CACHE_TTL_MS)

  const fetchTurmas = shouldFetchTurmas
    ? supabaseServer.from('turmas').select('id, nome, codigo, ano, turno, serie, capacidade, dados')
    : Promise.resolve({ data: turmasCache!.data, error: null })

  const fetchGrupos = shouldFetchGrupos
    ? supabaseServer.from('agenda_grupos').select('id, dados')
    : Promise.resolve({ data: gruposCache!.data, error: null })

  const [tRes, gRes] = await Promise.all([fetchTurmas, fetchGrupos])

  if (tRes.data && shouldFetchTurmas) {
    turmasCache = { data: tRes.data, timestamp: now }
  }
  if (gRes.data && shouldFetchGrupos) {
    gruposCache = { data: gRes.data, timestamp: now }
  }

  return {
    allTurmas: turmasCache?.data || [],
    allGrupos: gruposCache?.data || []
  }
}

/**
 * Retorna os alunos ativos para cálculos de vínculos, KPIs e turmas com cache em memória (TTL 45s).
 */
export async function getCachedActiveAlunos(): Promise<any[]> {
  const now = Date.now()

  if (activeAlunosCache && (now - activeAlunosCache.timestamp <= ALUNOS_CACHE_TTL_MS)) {
    return activeAlunosCache.data
  }

  const { data } = await supabaseServer
    .from('alunos')
    .select('id, turma, status, dados')
    .or('status.neq.inativo,status.is.null')

  const result = data || []
  activeAlunosCache = { data: result, timestamp: now }
  return result
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
}

/**
 * Invalida o cache de alunos ativos.
 */
export function invalidateAlunosCache() {
  activeAlunosCache = null
}
