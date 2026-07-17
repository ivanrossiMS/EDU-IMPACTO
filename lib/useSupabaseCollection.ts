'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Shared in-memory cache (survives route navigations) ──────────────────────
// Key: endpoint string → { data, timestamp, inflightPromise }
interface CacheEntry<T> {
  data: T
  timestamp: number
  inflightPromise?: Promise<T>
}

const CACHE_TTL_MS = 60_000   // 60 seconds stale-while-revalidate window
const memCache = new Map<string, CacheEntry<any>>()

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return memCache.get(key)
}

function setCacheEntry<T>(key: string, data: T): void {
  memCache.set(key, { data, timestamp: Date.now() })
}

function isStale(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS
}

/** Manually invalidate a cache entry (call after write operations) */
export function invalidateCache(endpoint: string): void {
  memCache.delete(endpoint)
}

/** Invalidate all entries (call on wipeAll / logout) */
export function invalidateAllCache(): void {
  memCache.clear()
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

  const promise = fetcher().then(data => {
    setCacheEntry(endpoint, data)
    // Clear inflight reference
    const entry = memCache.get(endpoint)
    if (entry) delete entry.inflightPromise
    return data
  }).catch(err => {
    const entry = memCache.get(endpoint)
    if (entry) delete entry.inflightPromise
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
 * Performance improvements:
 * - In-memory cache shared between all hook instances (survives navigation)
 * - Stale-While-Revalidate: renders cached data instantly, revalidates in background
 * - In-flight deduplication: multiple components requesting same endpoint → 1 fetch
 * - Optimistic updates: state is updated before network confirmation
 */
export function useSupabaseCollection<T>(
  endpoint: string,
  initialValue: T,
  options?: {
    fetcher?: () => Promise<T>
    persister?: (value: T) => Promise<void>
    refreshIntervalMs?: number
    enabled?: boolean
  }
): [T, (value: T | ((prev: T) => T)) => Promise<void>, { loading: boolean; error: string | null; setLocal?: React.Dispatch<React.SetStateAction<T>>; refresh?: () => void }] {
  const lsKey = `edu-ls-${endpoint}`
  // Make sure initialValue is never undefined
  const safeInitialValue = initialValue !== undefined ? initialValue : ([] as any);
  
  // Store initialValue in a ref so it stays stable across Fast Refresh / re-renders
  const initialValueRef = useRef<T>(safeInitialValue)

  // Initialization priority: 1. mem-cache, 2. initialValue (localStorage removed for security/UX)
  const getBootValue = (): T => {
    const cached = getCacheEntry<T>(endpoint)
    if (cached && cached.data !== undefined && cached.data !== null) {
      if (Array.isArray(initialValueRef.current) && !Array.isArray(cached.data)) return initialValueRef.current
      return cached.data
    }
    // Fallback: initial value (usually empty array). Loading flag will be TRUE.
    return initialValueRef.current
  }

  const [state, setState] = useState<T>(getBootValue)
  // If we don't have memory cache, we are actively loading. Prevents empty screen flashes.
  const [loading, setLoading] = useState(!getCacheEntry<T>(endpoint))
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Fetch with SWR ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (options?.enabled === false) {
      setLoading(false)
      return
    }

    let cancelled = false
    const existing = getCacheEntry<T>(endpoint)

    // Cache HIT and still fresh → skip fetch entirely
    if (existing && !isStale(existing)) {
      if (isMounted.current && !cancelled) {
        setState(existing.data)
        setLoading(false)
      }
      return
    }

    // Cache HIT but stale → show cached data immediately, revalidate in background
    if (existing) {
      setState(existing.data)
      setLoading(false)
    } else {
      setLoading(true)
    }

    const doFetch = options?.fetcher
      ? () => options.fetcher!()
      : () => {
          return fetch(`/api/${endpoint}`, { 
            headers: { 'Cache-Control': 'default' }, 
            cache: 'default',
            credentials: 'include',
            redirect: 'error'
          })
            .then(async r => {
              const contentType = r.headers.get('content-type')
              if (r.ok && contentType && contentType.includes('text/html')) {
                console.error(`[useSupabaseCollection] Endpoint /${endpoint} returned HTML on success (likely auth redirect).`)
                throw new Error(`Auth Redirect`)
              }
              if (!r.ok) {
                let errText = '';
                try { errText = await r.text(); } catch(e) {}
                console.error(`[useSupabaseCollection] API Error for /${endpoint}: HTTP ${r.status} - ${errText}`);
                throw new Error(`HTTP ${r.status} - ${errText}`);
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
        }

    fetchWithDedup<T>(endpoint, doFetch)
      .then(data => {
        if (cancelled || !isMounted.current) return
        // Normalize: if result is not usable, fall back to initial value
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
          // Merge defaults with API data to avoid undefined fields
          normalized = { ...initialValueRef.current, ...data }
        } else if (!Array.isArray(initialValueRef.current) && Array.isArray(data)) {
          // Expected Object but received Array — use first element or default
          const first = data[0]
          normalized = (first && typeof first === 'object') ? { ...initialValueRef.current, ...first } : initialValueRef.current
        }
        setState(normalized)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled || !isMounted.current) return
        setError(`Falha ao carregar dados: ${err?.message || 'erro de rede'}`)
        setLoading(false)
      })

    // Setup polling with Visibility API — pauses when tab is hidden to save egress
    if (options?.refreshIntervalMs && options.refreshIntervalMs > 0) {
      let intervalId: ReturnType<typeof setInterval> | null = null

      const doPoll = () => {
        if (cancelled || !isMounted.current) return
        // Skip fetch entirely if the page is hidden (user switched tabs / minimized window)
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        fetchWithDedup<T>(endpoint, doFetch)
          .then(data => {
            if (cancelled || !isMounted.current) return
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
            // Only update if data actually changed to avoid unnecessary re-renders
            if (JSON.stringify(latestState.current) !== JSON.stringify(normalized)) {
              setState(normalized)
            }
          })
          .catch(() => { /* silent fail on polling */ })
      }

      // When the user returns to the tab, fetch immediately so data feels fresh
      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          doPoll()
        }
      }

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }

      intervalId = setInterval(doPoll, options.refreshIntervalMs)

      return () => {
        cancelled = true
        if (intervalId) clearInterval(intervalId)
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
      }
    }

    return () => { cancelled = true }
  }, [endpoint]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist helper ─────────────────────────────────────────────────────────
  const persist = useCallback(async (next: T) => {
    // 1. Invalidate mem-cache
    invalidateCache(endpoint)
    // 2. Update mem-cache optimistically
    setCacheEntry(endpoint, next)
    // 3. Sync to API FIRST (source of truth)
    try {
      if (options?.persister) {
        await options.persister(next)
      } else {
        const res = await fetch(`/api/${endpoint}`, {
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

  // Sync latest state to allow synchronous derivation without React's impure setState updater
  const latestState = useRef<T>(state);
  useEffect(() => { latestState.current = state; }, [state]);

  // ── Setter — optimistic update then persist ────────────────────────────────
  const set = useCallback(async (valOrFn: T | ((prev: T) => T)) => {
    const safePrev: T = latestState.current !== undefined ? latestState.current : initialValueRef.current;
    const next = typeof valOrFn === 'function'
      ? (valOrFn as (p: T) => T)(safePrev)
      : valOrFn;
    
    // Check if nothing changed to prevent redundant network writes / database resets
    if (safePrev === next || JSON.stringify(safePrev) === JSON.stringify(next)) {
      return;
    }
    
    // Update ref immediately for sequential setter calls
    latestState.current = next;
    
    // React state update (Pure)
    setState(next);
    
    // Side effects (Run exactly once outside setState)
    setCacheEntry(endpoint, next);
    await persist(next);
  }, [persist, endpoint]);

  const setLocalWrapped = useCallback((valOrFn: any) => {
    setState((prev: any) => {
      const safePrev = prev !== undefined && prev !== null ? prev : initialValueRef.current;
      if (typeof valOrFn === 'function') {
        return valOrFn(safePrev);
      }
      return valOrFn;
    });
  }, []);

  const returnedState = state !== undefined && state !== null ? state : initialValueRef.current;
  return [returnedState, set, { loading, error, setLocal: setLocalWrapped }]
}

/**
 * useSupabaseArray<T>
 *
 * Specialized version for array endpoints that support full CRUD.
 */
export function useSupabaseArray<T>(
  endpoint: string,
  initialValue: T[] = [],
  options?: { refreshIntervalMs?: number, noCache?: boolean, enabled?: boolean }
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
        // Usa as configs default do browser e cabeçalhos enviados pelo servidor Next.js
        fetchOpts.cache = 'default';
      }

      return (() => {
        // AbortController com timeout de 30s — evita fetch pendente por minutos no cliente
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 30_000)

        return fetch(url, { ...fetchOpts, signal: ctrl.signal })
              .then(async r => {
                clearTimeout(tid)
                const contentType = r.headers.get('content-type')
                if (r.ok && contentType && contentType.includes('text/html')) {
                  r.text().then(html => console.error(`[useSupabaseArray] HTML returned from /${endpoint}:`, html.substring(0, 300)));
                  throw new Error(`Auth Redirect`)
                }
                if (!r.ok) {
                if (r.status === 404) {
                  console.warn(`[useSupabaseArray] Endpoint /${endpoint} is not implemented yet or table is missing (HTTP ${r.status}). Returning [].`);
                  return [];
                }
                if (r.status === 504) {
                  // Timeout da rota — tentar novamente em 3s
                  console.warn(`[useSupabaseArray] Timeout (504) em /${endpoint}. Retentando em 3s...`)
                  await new Promise(res => setTimeout(res, 3000))
                  throw new Error('Retry after 504')
                }
                if (r.status === 500) {
                  console.warn(`[useSupabaseArray] Endpoint /${endpoint} retornou erro 500. Returning [].`);
                  return [];
                }
                if (r.status === 401 || r.status === 403) {
                  console.warn(`[useSupabaseArray] Access Denied for /${endpoint} (HTTP ${r.status}). Returning [].`);
                  return [];
                }
                let errText = '';
                try { errText = await r.text(); } catch(e) {}
                console.error(`[useSupabaseArray] API Error for /${endpoint}: HTTP ${r.status} - ${errText}`);
                throw new Error(`HTTP ${r.status} - ${errText}`);
              }
              const text = await r.text();
              if (!text) return [];
              try {
                const payload = JSON.parse(text);
                // Always return an array — never return an object or null
                if (Array.isArray(payload)) return payload
                if (Array.isArray(payload?.data)) return payload.data
                // API returned error object or unexpected shape — return empty array
                console.warn(`[useSupabaseArray] Unexpected response shape for /${endpoint}:`, payload)
                return []
              } catch (err) {
                console.warn(`[useSupabaseArray] JSON parse failed for /${endpoint}:`, err)
                return []
              }
          })
          .catch(err => {
              clearTimeout(tid)
              if (err?.name === 'AbortError') {
                console.warn(`[useSupabaseArray] Fetch abortado por timeout (30s) em /${endpoint}`)
                throw new Error('Fetch timeout')
              }
              console.warn(`[useSupabaseArray] Fetch failed for /${endpoint}:`, err)
              throw err
          })
      })()
    }, [endpoint, options?.noCache]),
    persister: useCallback(async (arr: T[]) => {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr),
        credentials: 'include',
        redirect: 'error'
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 404) {
           console.warn(`[useSupabaseArray] API POST 404 (Not Found) para o endpoint: /api/${endpoint}. Ignorando salvamento (pode ser coleção somente-leitura).`)
           return
        }
        console.error(`[useSupabaseArray] API POST failed for /api/${endpoint}:`, res.status, body)
        throw new Error(body?.error || `Erro ${res.status} ao salvar em ${endpoint}`)
      }
    }, [endpoint]),
  })
}
