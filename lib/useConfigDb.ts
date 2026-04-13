'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Shared in-memory cache for all config keys ───────────────────────────────
// Survives React navigation — configs rarely change during a session
interface ConfigCacheState {
  data: Record<string, any[]>    // keyed by chave
  timestamp: number
  promise: Promise<Record<string, any[]>> | null
  resolved: boolean
}

const CONFIG_TTL_MS = 60_000  // 1 minute — configs are stable within a session
let configCache: ConfigCacheState = {
  data: {},
  timestamp: 0,
  promise: null,
  resolved: false,
}

function isConfigCacheFresh(): boolean {
  return configCache.resolved && (Date.now() - configCache.timestamp < CONFIG_TTL_MS)
}

// All known config chaves — updated centrally so we batch them
const ALL_CONFIG_CHAVES = [
  'cfgTurnos', 'cfgSituacaoAluno', 'cfgGruposAlunos',
  'cfgDisciplinas', 'cfgNiveisEnsino', 'cfgTiposOcorrencia', 'cfgEsquemasAvaliacao',
  'cfgCentrosCusto', 'cfgMetodosPagamento', 'cfgCartoes', 'cfgEventos',
  'cfgGruposDesconto', 'cfgPadroesPagamento', 'cfgPlanoContas', 'cfgTiposDocumento'
]

/**
 * Fetches all configuration keys in a SINGLE request.
 * Uses in-memory cache with 1 minute TTL.
 * Deduplicates concurrent calls — all hooks await the same Promise.
 */
function fetchAllConfigs(): Promise<Record<string, any[]>> {
  // Already fresh → return immediately
  if (isConfigCacheFresh()) {
    return Promise.resolve(configCache.data)
  }

  // In-flight → reuse existing promise (deduplication)
  if (configCache.promise) {
    return configCache.promise
  }

  // Fire single bulk request
  const chavesList = ALL_CONFIG_CHAVES.join(',')
  configCache.promise = fetch(`/api/configuracoes?chaves=${encodeURIComponent(chavesList)}`)
    .then(r => r.ok ? r.json() : Promise.resolve({}))
    .then((result: Record<string, any>) => {
      configCache.data = {}
      for (const key of ALL_CONFIG_CHAVES) {
        if (result[key] !== undefined && result[key] !== null) {
          let arr = Array.isArray(result[key]) ? result[key] : []
          
          // Deduplicate items on-the-fly to prevent UI duplicate key errors
          if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null && 'id' in arr[0]) {
            const seen = new Set<string>()
            arr = arr.filter((item: any) => {
              if (!item.id) return true
              if (seen.has(item.id)) return false
              seen.add(item.id)
              return true
            })
          }
          
          configCache.data[key] = arr
        }
      }
      configCache.timestamp = Date.now()
      configCache.resolved = true
      configCache.promise = null
      return configCache.data
    })
    .catch(() => {
      configCache.promise = null
      return configCache.data  // return whatever we have (possibly empty)
    })

  return configCache.promise
}

/** Call this after saving a config to invalidate cache */
export function invalidateConfigCache(chave?: string): void {
  if (chave) {
    delete configCache.data[chave]
  } else {
    configCache = { data: {}, timestamp: 0, promise: null, resolved: false }
  }
}

/**
 * useConfigDb<T>
 * Supabase-first hook for configuration arrays stored in the `configuracoes` table.
 *
 * Performance improvements over original:
 * - ALL configs fetched in a SINGLE bulk request (instead of 16 separate requests)
 * - Results cached in shared memory (TTL = 60s) — instant on navigation
 * - Stale-while-revalidate pattern
 * - Falls back gracefully to defaultValue on error or empty DB
 */
export function useConfigDb<T>(chave: string, defaultValue: T[] = []) {
  // Start with cached value if available — avoids any loading flash
  const getCachedOrDefault = (): T[] => {
    const cached = configCache.data[chave]
    if (cached && cached.length > 0) return cached as T[]
    return defaultValue
  }

  const [data, setDataState] = useState<T[]>(getCachedOrDefault)
  const [loading, setLoading] = useState(!configCache.resolved)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Fetch from shared bulk cache on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Already fresh in cache → update state and return
    if (isConfigCacheFresh()) {
      const cachedVal = configCache.data[chave]
      if (cachedVal && cachedVal.length > 0 && isMounted.current) {
        setDataState(cachedVal as T[])
      }
      setLoading(false)
      return
    }

    fetchAllConfigs().then(allConfigs => {
      if (cancelled || !isMounted.current) return

      const val = allConfigs[chave]
      if (val && Array.isArray(val) && val.length > 0) {
        setDataState(val as T[])
      } else if (defaultValue.length > 0) {
        // Empty in DB → seed with default and persist
        setDataState(defaultValue)
        fetch('/api/configuracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave, valor: defaultValue }),
        }).catch(() => {})
        // Store default in cache too
        configCache.data[chave] = defaultValue as any[]
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled && isMounted.current) setLoading(false)
    })

    return () => { cancelled = true }
  }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to Supabase + update local state + invalidate cache ────────────
  const persist = useCallback(async (next: T[]) => {
    setDataState(next)
    // Optimistically update shared cache
    configCache.data[chave] = next as any[]
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor: next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setError(err?.error ?? 'Erro ao salvar')
      } else {
        setError(null)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro de rede')
    }
  }, [chave])

  // Keep a ref to the latest data to allow synchronous derivation without React's setState updater
  const latestData = useRef<T[]>(data);
  useEffect(() => { latestData.current = data; }, [data]);

  const setData = useCallback((valOrFn: T[] | ((prev: T[]) => T[])) => {
    const next = typeof valOrFn === 'function' ? (valOrFn as (p: T[]) => T[])(latestData.current) : valOrFn;
    latestData.current = next;
    setDataState(next);
    persist(next);
  }, [persist]);

  return { data, setData, loading, error }
}
