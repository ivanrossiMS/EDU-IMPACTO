/**
 * colaboradoresCache.ts
 * Cache em memória para lista de colaboradores (dropdowns e selects).
 * TTL: 2 minutos. Invalidado ao criar, editar ou excluir colaboradores ou sincronizar funcionários.
 */

const _colaboradoresCache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutos

let _fullUsersReportCache: { data: any[]; stats: any; expires: number } | null = null

export function getFullUsersReportCache() {
  if (_fullUsersReportCache && _fullUsersReportCache.expires > Date.now()) {
    return _fullUsersReportCache
  }
  return null
}

export function setFullUsersReportCache(entry: { data: any[]; stats: any; expires: number }) {
  _fullUsersReportCache = entry
}

export function invalidateFullUsersReportCache() {
  _fullUsersReportCache = null
}

export function getCachedColaboradores(key: string) {
  const entry = _colaboradoresCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _colaboradoresCache.delete(key)
    return null
  }
  return entry.data
}

export function setCachedColaboradores(key: string, data: any) {
  _colaboradoresCache.set(key, { data, ts: Date.now() })
}

import { invalidateAccessStartDateCache } from '@/lib/server/visibility'
import { invalidateUsersCache } from '@/lib/server/turmasGruposCache'

export function invalidateColaboradoresCache() {
  _colaboradoresCache.clear()
  _fullUsersReportCache = null
  invalidateAccessStartDateCache()
  invalidateUsersCache()
}
