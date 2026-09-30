'use client'

import { apiFetch } from '@/lib/api/apiClient'

let inFlightPromise: Promise<any[]> | null = null
let memoryCache: { data: any[]; timestamp: number } | null = null

/**
 * Busca a lista de alunos do usuário autenticado de forma deduplicada e ultrarrápida.
 * - Múltiplas chamadas simultâneas (ex: montagem concorrente de componentes)
 *   compartilham a MESMA Promise em voo, emitindo exatamente 1 requisição HTTP ao servidor.
 * - Cache em memória de curto prazo (4s) para eliminar re-fetches instantâneos durante transição de telas.
 */
export async function getMeusAlunosDedup(options?: { forceRefresh?: boolean }): Promise<any[]> {
  const now = Date.now()

  if (!options?.forceRefresh && memoryCache && now - memoryCache.timestamp < 4000) {
    return memoryCache.data
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    try {
      const res = await apiFetch('/api/agenda/meus-alunos', { credentials: 'include' })
      if (!res.ok) {
        return []
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        memoryCache = { data, timestamp: Date.now() }
        return data
      }
      return []
    } catch (err) {
      console.warn('[meusAlunosClient] Erro ao buscar alunos deduplicado:', err)
      return []
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}
