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

  if (!options?.forceRefresh && memoryCache && memoryCache.data.length > 0 && now - memoryCache.timestamp < 4000) {
    return memoryCache.data
  }

  if (inFlightPromise && !options?.forceRefresh) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    const maxAttempts = 3
    let lastError: unknown = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await apiFetch('/api/agenda/meus-alunos', { credentials: 'include' })
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`)
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, attempt * 600))
            continue
          }
          throw lastError
        }
        const data = await res.json()
        if (Array.isArray(data)) {
          if (data.length > 0) {
            memoryCache = { data, timestamp: Date.now() }
          }
          return data
        }
        return []
      } catch (err) {
        lastError = err
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 600))
          continue
        }
      }
    }

    console.warn('[meusAlunosClient] Erro ao buscar alunos deduplicado após retentativas:', lastError)
    throw lastError instanceof Error ? lastError : new Error('Falha ao buscar alunos vinculados')
  })().finally(() => {
    inFlightPromise = null
  })

  return inFlightPromise
}

export function clearMeusAlunosCache(): void {
  memoryCache = null
  inFlightPromise = null
}
