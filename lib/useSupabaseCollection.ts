'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '@/lib/api/apiClient'

// ─── Shared in-memory cache (survives route navigations) ──────────────────────
// Key: endpoint string → { data, timestamp, inflightPromise }
interface CacheEntry<T> {
  data: T
  timestamp: number
  inflightPromise?: Promise<T>
}

const CACHE_TTL_MS = 60_000   // 60 seconds stale-while-revalidate window
const MAX_MEMCACHE_SIZE = 80
const memCache = new Map<string, CacheEntry<any>>()

if (typeof window !== 'undefined') {
  window.addEventListener('edu:logout-start', () => {
    memCache.clear()
  })
}

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return memCache.get(key)
}

function setCacheEntry<T>(key: string, data: T): void {
  memCache.set(key, { data, timestamp: Date.now() })
  if (memCache.size > MAX_MEMCACHE_SIZE) {
    let count = 0
    for (const k of memCache.keys()) {
      memCache.delete(k)
      count++
      if (count >= 20) break
    }
  }
}

function isStale(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS
}

export function hasDataChanged(prev: any, next: any): boolean {
  if (prev === next) return false
  if (!prev || !next) return true
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return true
    for (let i = 0; i < prev.length; i++) {
      const p = prev[i]
      const n = next[i]
      if (p?.id !== n?.id) return true
      if (p?.status !== n?.status) return true
      if (p?.confirmedAt !== n?.confirmedAt) return true
      if (p?.calledAt !== n?.calledAt) return true
      if (p?.updated_at !== n?.updated_at) return true
    }
    return JSON.stringify(prev) !== JSON.stringify(next)
  }
  return JSON.stringify(prev) !== JSON.stringify(next)
}

const lastAttemptMap = new Map<string, number>()

/** Manually invalidate a cache entry (call after write operations) */
export function invalidateCache(endpoint: string, clearInflight = false): void {
  const existing = memCache.get(endpoint)
  if (!clearInflight && existing?.inflightPromise) {
    // Mantém a inflightPromise ativa para não quebrar a deduplicação entre múltiplos hooks/eventos
    existing.timestamp = 0
    return
  }
  memCache.delete(endpoint)
}

/** Invalidate all entries (call on wipeAll / logout) */
export function invalidateAllCache(): void {
  memCache.clear()
  lastAttemptMap.clear()
}

// ─── Fetch with in-flight deduplication ──────────────────────────────────────
async function fetchWithDedup<T>(
  endpoint: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = memCache.get(endpoint)

  // Reuse in-flight promise (deduplication — prevents parallel identical fetches)
  if (existing?.inflightPromise) {
    return existing.inflightPromise as Promise<T>
  }

  lastAttemptMap.set(endpoint, Date.now())

  const promise = fetcher().then(data => {
    // Do NOT call setCacheEntry here — the hook caller decides if it should update
    // the cache (it may be holding an optimistic lock)
    const entry = memCache.get(endpoint)
    if (entry) delete entry.inflightPromise
    return data
  }).catch(err => {
    const entry = memCache.get(endpoint)
    if (entry) {
      delete entry.inflightPromise
      // Se a entrada ainda não tinha dados válidos (timestamp === 0), remove do memCache para nunca bloquear novas tentativas
      if (!entry.timestamp || entry.data === undefined) {
        memCache.delete(endpoint)
      }
    }
    throw err
  })

  memCache.set(endpoint, { ...existing, data: existing?.data, timestamp: existing?.timestamp ?? 0, inflightPromise: promise } as any)
  return promise
}

/**
 * useSupabaseCollection<T>
 *
 * Drop-in replacement for useLocalStorage that persists data in Supabase
 * through the generic /api/colecoes endpoint.
 *
 * Performance & Resilience:
 * - Uses apiFetch (Bearer token + proactive refresh + 401 forced refresh + network retry)
 * - Never caches error responses in memCache
 * - Auto-heals on network reconnect ('online'), tab focus ('visibilitychange'), and auth recovery ('edu:auth-recovered')
 */
export function useSupabaseCollection<T>(
  endpoint: string,
  initialValue: T,
  options?: {
    fetcher?: () => Promise<T>
    persister?: (value: T) => Promise<void>
    refreshIntervalMs?: number
    enabled?: boolean
    mergeLocal?: boolean
  }
): [T, (value: T | ((prev: T) => T)) => Promise<void>, { loading: boolean; error: string | null; setLocal?: React.Dispatch<React.SetStateAction<T>>; refresh?: () => void }] {
  const lsKey = `edu-ls-${endpoint}`
  // Make sure initialValue is never undefined
  const safeInitialValue = initialValue !== undefined ? initialValue : ([] as any);
  
  // Store initialValue in a ref so it stays stable across Fast Refresh / re-renders
  const initialValueRef = useRef<T>(safeInitialValue)

  // Initialization priority: 1. mem-cache, 2. initialValue
  const getBootValue = (): T => {
    const cached = getCacheEntry<T>(endpoint)
    if (cached && cached.timestamp > 0 && cached.data !== undefined && cached.data !== null) {
      if (Array.isArray(initialValueRef.current) && !Array.isArray(cached.data)) return initialValueRef.current
      return cached.data
    }
    return initialValueRef.current
  }

  const [state, setState] = useState<T>(getBootValue)
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getCacheEntry<T>(endpoint)
    const hasValidData = Boolean(cached && cached.timestamp > 0 && cached.data !== undefined && cached.data !== null)
    return !hasValidData
  })
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  const hadErrorRef = useRef(false)
  const autoHealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Optimistic lock: timestamp until which server responses should be merged, not replaced
  const optimisticLockUntil = useRef<number>(0)

  // Sync latest state to allow synchronous derivation without React's impure setState updater
  const latestState = useRef<T>(state)
  useEffect(() => { latestState.current = state }, [state])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (autoHealTimerRef.current) clearTimeout(autoHealTimerRef.current)
    }
  }, [])

  // Safety timeout: garante que o flag loading nunca fique preso como true por mais de 15 segundos
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (isMounted.current) setLoading(false)
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [loading])

  const normalizeData = useCallback((data: any): T => {
    let normalized: T = data
    if (data === undefined || data === null) {
      normalized = initialValueRef.current
    } else if (Array.isArray(initialValueRef.current) && !Array.isArray(data)) {
      if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        normalized = (data as any).data
      } else {
        normalized = initialValueRef.current
      }
    } else if (
      typeof data === 'object' && !Array.isArray(data) &&
      initialValueRef.current && typeof initialValueRef.current === 'object' && !Array.isArray(initialValueRef.current)
    ) {
      normalized = { ...initialValueRef.current, ...data }
    } else if (!Array.isArray(initialValueRef.current) && Array.isArray(data)) {
      const first = data[0]
      normalized = (first && typeof first === 'object') ? { ...initialValueRef.current, ...first } : initialValueRef.current
    }

    const isLocked = Date.now() < optimisticLockUntil.current
    if (isLocked && Array.isArray(latestState.current) && Array.isArray(normalized)) {
      const serverMap = new Map<string, any>((normalized as any[]).map((item: any) => [item?.id, item]))
      const localArr = latestState.current as any[]
      const merged: any[] = localArr.map((localItem: any) => {
        const serverVersion = serverMap.get(localItem?.id)
        return serverVersion ? { ...localItem, ...serverVersion } : localItem
      })
      const localIds = new Set(localArr.map((i: any) => i?.id))
      for (const serverItem of (normalized as any[])) {
        if (serverItem?.id && !localIds.has(serverItem.id)) {
          merged.push(serverItem)
        }
      }
      normalized = merged as any
    } else if (!isLocked && Array.isArray(latestState.current) && Array.isArray(normalized) && options?.mergeLocal === true) {
      const serverIds = new Set((normalized as any[]).map((item: any) => item?.id).filter(Boolean))
      const localOnly = (latestState.current as any[]).filter((item: any) => item && item.id && !serverIds.has(item.id))
      if (localOnly.length > 0) {
        normalized = [...localOnly, ...(normalized as any[])] as any
      }
      setCacheEntry(endpoint, normalized)
    } else if (!isLocked) {
      setCacheEntry(endpoint, normalized)
    }
    return normalized
  }, [endpoint, options?.mergeLocal])

  const buildDefaultFetcher = useCallback(() => {
    if (options?.fetcher) return options.fetcher()
    return apiFetch(`/api/${endpoint}`, {
      headers: { 'Cache-Control': 'default' },
      cache: 'default',
      credentials: 'include',
      redirect: 'error'
    }).then(async r => {
      const contentType = r.headers.get('content-type')
      if (r.ok && contentType && contentType.includes('text/html')) {
        console.error(`[useSupabaseCollection] Endpoint /${endpoint} returned HTML on success (likely auth redirect).`)
        throw new Error(`Auth Redirect`)
      }
      if (!r.ok) {
        let errText = ''
        try { errText = await r.text() } catch {}
        console.error(`[useSupabaseCollection] API Error for /${endpoint}: HTTP ${r.status} - ${errText}`)
        throw new Error(`HTTP ${r.status} - ${errText}`)
      }
      const text = await r.text()
      if (!text) return initialValueRef.current
      try {
        return JSON.parse(text) as T
      } catch (err) {
        console.warn(`[useSupabaseCollection] JSON parse failed for /${endpoint}:`, err)
        return initialValueRef.current
      }
    })
  }, [endpoint, options?.fetcher])

  const autoHealAttemptsRef = useRef(0)

  const refresh = useCallback(() => {
    if (options?.enabled === false) return
    invalidateCache(endpoint, false)
    fetchWithDedup<T>(endpoint, buildDefaultFetcher)
      .then(data => {
        if (!isMounted.current) return
        hadErrorRef.current = false
        autoHealAttemptsRef.current = 0
        const normalized = normalizeData(data)
        if (hasDataChanged(latestState.current, normalized)) {
          setState(normalized)
        }
        setError(null)
        setLoading(false)
      })
      .catch(err => {
        if (!isMounted.current) return
        hadErrorRef.current = true
        setError(`Falha ao carregar dados: ${err?.message || 'erro de rede'}`)
        setLoading(false)
      })
  }, [endpoint, options?.enabled, buildDefaultFetcher, normalizeData])

  // ── Fetch with SWR & Self-Healing Reconnection ─────────────────────────────
  useEffect(() => {
    if (options?.enabled === false) {
      setLoading(false)
      return
    }

    let cancelled = false
    const existing = getCacheEntry<T>(endpoint)
    const hasValidCache = Boolean(existing && existing.timestamp > 0 && existing.data !== undefined && existing.data !== null)
    const isCacheEmptyArray = hasValidCache && Array.isArray(existing!.data) && existing!.data.length === 0

    // Cache HIT and still fresh (and not an empty array from an unpopulated initial load) → skip fetch
    if (hasValidCache && !isStale(existing!) && !isCacheEmptyArray && !hadErrorRef.current) {
      if (isMounted.current && !cancelled) {
        if (Date.now() >= optimisticLockUntil.current) {
          setState(existing!.data)
        }
        setLoading(false)
      }
    } else {
      if (hasValidCache) {
        setState(existing!.data)
        const isCacheEmpty = Array.isArray(existing!.data) ? existing!.data.length === 0 : !existing!.data
        setLoading(isCacheEmpty)
      } else {
        setLoading(true)
      }

      fetchWithDedup<T>(endpoint, buildDefaultFetcher)
        .then(data => {
          if (cancelled || !isMounted.current) return
          hadErrorRef.current = false
          autoHealAttemptsRef.current = 0
          if (autoHealTimerRef.current) {
            clearTimeout(autoHealTimerRef.current)
            autoHealTimerRef.current = null
          }
          const normalized = normalizeData(data)
          setState(normalized)
          setError(null)
          setLoading(false)
        })
        .catch((err) => {
          if (cancelled || !isMounted.current) return
          const errMsg = String(err?.message || '')
          if (errMsg.includes('HTTP 403') || errMsg.includes('HTTP 401')) {
            hadErrorRef.current = false
            setLoading(false)
            return
          }
          hadErrorRef.current = true
          // NUNCA salva [] no cache quando ocorre erro!
          setError(`Falha ao carregar dados: ${err?.message || 'erro de rede'}`)
          setLoading(false)

          // Auto-healing em segundo plano com backoff exponencial + jitter (máximo 2 tentativas)
          if ((typeof navigator === 'undefined' || navigator.onLine) && autoHealAttemptsRef.current < 2) {
            autoHealAttemptsRef.current += 1
            const attemptNum = autoHealAttemptsRef.current
            const baseDelay = attemptNum === 1 ? 5000 : 15000
            const jitter = Math.floor(Math.random() * 2500)
            if (autoHealTimerRef.current) clearTimeout(autoHealTimerRef.current)
            autoHealTimerRef.current = setTimeout(() => {
              if (!cancelled && isMounted.current && hadErrorRef.current) {
                console.log(`[useSupabaseCollection] Auto-healing (tentativa ${attemptNum}/2) após falha transitória em /${endpoint}...`)
                refresh()
              }
            }, baseDelay + jitter)
          }
        })
    }

    // ── Listeners de Auto-Reconexão (Online, Auth Recovered, Visibility) ─────
    const handleReconnectionOrRecovery = () => {
      if (cancelled || !isMounted.current) return
      const currentEntry = getCacheEntry<T>(endpoint)
      if (currentEntry?.inflightPromise) return
      const lastAttempt = lastAttemptMap.get(endpoint) || 0
      if (Date.now() - lastAttempt < 5_000) return

      const isCurrentEmpty = Array.isArray(latestState.current)
        ? latestState.current.length === 0
        : !latestState.current
      const shouldRefetch =
        hadErrorRef.current ||
        isCurrentEmpty ||
        !currentEntry ||
        isStale(currentEntry)

      if (shouldRefetch) {
        refresh()
      }
    }

    const handleVisibilityRecovery = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleReconnectionOrRecovery()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleReconnectionOrRecovery)
      window.addEventListener('edu:auth-recovered', handleReconnectionOrRecovery)
      window.addEventListener('edu:network-reconnected', handleReconnectionOrRecovery)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityRecovery)
    }

    // Setup polling with Visibility API — pauses when tab is hidden to save egress
    let intervalId: ReturnType<typeof setInterval> | null = null
    if (options?.refreshIntervalMs && options.refreshIntervalMs > 0) {
      const doPoll = () => {
        if (cancelled || !isMounted.current) return
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        fetchWithDedup<T>(endpoint, buildDefaultFetcher)
          .then(data => {
            if (cancelled || !isMounted.current) return
            hadErrorRef.current = false
            const normalized = normalizeData(data)
            if (hasDataChanged(latestState.current, normalized)) {
              setState(normalized)
            }
            setError(null)
          })
          .catch(() => { /* silent fail on polling */ })
      }
      intervalId = setInterval(doPoll, options.refreshIntervalMs)
    }

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      if (autoHealTimerRef.current) clearTimeout(autoHealTimerRef.current)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleReconnectionOrRecovery)
        window.removeEventListener('edu:auth-recovered', handleReconnectionOrRecovery)
        window.removeEventListener('edu:network-reconnected', handleReconnectionOrRecovery)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityRecovery)
      }
    }
  }, [endpoint, options?.enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist helper ─────────────────────────────────────────────────────────
  const persist = useCallback(async (next: T) => {
    invalidateCache(endpoint)
    setCacheEntry(endpoint, next)
    try {
      if (options?.persister) {
        await options.persister(next)
      } else {
        const res = await apiFetch(`/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
          credentials: 'include',
          redirect: 'error'
        })
        const contentType = res.headers.get('content-type')
        if (contentType && contentType.includes('text/html')) {
          const errMsg = `Erro de autenticação ao salvar`
          console.error(`[useSupabaseCollection] API sync failed for ${endpoint}: Returned HTML (likely redirect to login)`)
          if (isMounted.current) setError(errMsg)
          throw new Error(errMsg)
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const errMsg = body?.error || res.statusText || 'Erro ao salvar'
          console.error(`[useSupabaseCollection] API sync failed for ${endpoint}:`, res.status, body)
          if (isMounted.current) setError(`Erro ao salvar: ${errMsg}`)
          throw new Error(errMsg)
        }
      }
      if (isMounted.current) setError(null)
    } catch (e: any) {
      console.warn(`[useSupabaseCollection] API sync failed for ${endpoint}:`, e?.message)
      if (isMounted.current) setError(e.message || `Erro de rede ao salvar`)
      throw e
    }
  }, [endpoint, lsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setter — optimistic update then persist (with rollback on error) ───────
  const set = useCallback(async (valOrFn: T | ((prev: T) => T)) => {
    const safePrev: T = latestState.current !== undefined ? latestState.current : initialValueRef.current;
    const next = typeof valOrFn === 'function'
      ? (valOrFn as (p: T) => T)(safePrev)
      : valOrFn;
    
    if (!hadErrorRef.current && (safePrev === next || JSON.stringify(safePrev) === JSON.stringify(next))) {
      return;
    }
    
    latestState.current = next;
    setState(next);
    setCacheEntry(endpoint, next);
    try {
      await persist(next);
      hadErrorRef.current = false;
    } catch (err) {
      hadErrorRef.current = true;
      latestState.current = safePrev;
      if (isMounted.current) setState(safePrev);
      setCacheEntry(endpoint, safePrev);
      throw err;
    }
  }, [persist, endpoint]);

  const setLocalWrapped = useCallback((valOrFn: any) => {
    optimisticLockUntil.current = Date.now() + 5000
    setState((prev: any) => {
      const safePrev = prev !== undefined && prev !== null ? prev : initialValueRef.current;
      const next = typeof valOrFn === 'function' ? valOrFn(safePrev) : valOrFn;
      latestState.current = next;
      setCacheEntry(endpoint, next);
      return next;
    });
  }, [endpoint]);

  const returnedState = state !== undefined && state !== null ? state : initialValueRef.current;
  return [returnedState, set, { loading, error, setLocal: setLocalWrapped, refresh }]
}

/**
 * useSupabaseArray<T>
 *
 * Specialized version for array endpoints that support full CRUD.
 * Uses apiFetch for automatic Bearer authentication, 401 token refresh, and network drop retry.
 * NEVER returns [] on 401/403/500 so memCache is never poisoned with empty arrays on failure.
 */
export function useSupabaseArray<T>(
  endpoint: string,
  initialValue: T[] = [],
  options?: { refreshIntervalMs?: number, noCache?: boolean, enabled?: boolean, mergeLocal?: boolean }
): [T[], (value: T[] | ((prev: T[]) => T[])) => Promise<void>, { loading: boolean; error: string | null; setLocal?: React.Dispatch<React.SetStateAction<T[]>>; refresh?: () => void }] {
  const safeInitial = initialValue !== undefined && initialValue !== null ? initialValue : [];
  return useSupabaseCollection<T[]>(endpoint, safeInitial, {
    ...options,
    fetcher: useCallback(() => {
      const noCache = options?.noCache ?? false;
      const url = noCache ? `/api/${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}` : `/api/${endpoint}`;
      
      const fetchOpts: RequestInit = {
        credentials: 'include',
        redirect: 'error',
      };
      if (noCache) {
        fetchOpts.headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
        fetchOpts.cache = 'no-store';
      } else {
        fetchOpts.cache = 'default';
      }

      return (() => {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 30_000)

        return apiFetch(url, { ...fetchOpts, signal: ctrl.signal })
          .then(async r => {
            clearTimeout(tid)
            const contentType = r.headers.get('content-type')
            if (r.ok && contentType && contentType.includes('text/html')) {
              r.text().then(html => console.error(`[useSupabaseArray] HTML returned from /${endpoint}:`, html.substring(0, 300)));
              throw new Error(`Auth Redirect`)
            }
            if (!r.ok) {
              if (r.status === 404 || r.status === 403) {
                if (r.status === 404) {
                  console.warn(`[useSupabaseArray] Endpoint /${endpoint} is not implemented yet or table is missing (HTTP ${r.status}). Returning [].`);
                }
                return [];
              }
              let errText = '';
              try { errText = await r.text(); } catch(e) {}
              console.warn(`[useSupabaseArray] API Error for /${endpoint}: HTTP ${r.status} - ${errText.substring(0, 200)}`);
              // Lança erro para que o useSupabaseCollection NÃO salve [] no memCache e acione o auto-healing!
              throw new Error(`HTTP ${r.status}`);
            }
            const text = await r.text();
            if (!text) return [];
            try {
              const payload = JSON.parse(text);
              if (Array.isArray(payload)) return payload
              if (Array.isArray(payload?.data)) return payload.data
              console.warn(`[useSupabaseArray] Unexpected response shape for /${endpoint}:`, payload)
              return []
            } catch (err) {
              console.warn(`[useSupabaseArray] JSON parse failed for /${endpoint}:`, err)
              throw new Error('JSON parse error')
            }
          })
          .catch(err => {
            clearTimeout(tid)
            if (err?.name === 'AbortError') {
              console.warn(`[useSupabaseArray] Fetch abortado por timeout (30s) em /${endpoint}`)
              throw new Error('Fetch timeout')
            }
            throw err
          })
      })()
    }, [endpoint, options?.noCache]),
    persister: useCallback(async (arr: T[]) => {
      const res = await apiFetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr),
        credentials: 'include',
        redirect: 'error'
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 404 || res.status === 405) {
          console.warn(`[useSupabaseArray] API POST ${res.status} para o endpoint: /api/${endpoint}. Ignorando salvamento (coleção somente-leitura).`)
          return
        }
        console.error(`[useSupabaseArray] API POST failed for /api/${endpoint}:`, res.status, body)
        throw new Error(body?.error || `Erro ${res.status} ao salvar em ${endpoint}`)
      }
    }, [endpoint]),
  })
}

