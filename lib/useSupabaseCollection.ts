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
  }
): [T, (value: T | ((prev: T) => T)) => void, { loading: boolean; error: string | null }] {
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
          const sep = endpoint.includes('?') ? '&' : '?';
          return fetch(`/api/${endpoint}${sep}_t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, cache: 'no-store' })
            .then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
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
          normalized = initialValueRef.current
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

    // Setup polling if refreshIntervalMs is provided
    if (options?.refreshIntervalMs && options.refreshIntervalMs > 0) {
      const intervalId = setInterval(() => {
        if (cancelled || !isMounted.current) return
        fetchWithDedup<T>(endpoint, doFetch)
          .then(data => {
            if (cancelled || !isMounted.current) return
            let normalized: T = data
            if (data === undefined || data === null) {
              normalized = initialValueRef.current
            } else if (Array.isArray(initialValueRef.current) && !Array.isArray(data)) {
              normalized = initialValueRef.current
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
      }, options.refreshIntervalMs)
      
      return () => {
        cancelled = true
        clearInterval(intervalId)
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
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error(`[useSupabaseCollection] API sync failed for ${endpoint}:`, res.status, body)
          if (isMounted.current) setError(`Erro ao salvar: ${body?.error || res.status}`)
          return
        }
      }
      if (isMounted.current) setError(null)
    } catch (e: any) {
      console.warn(`[useSupabaseCollection] API sync failed for ${endpoint}:`, e?.message)
      if (isMounted.current) setError(`Erro de rede ao salvar`)
    }
  }, [endpoint, lsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync latest state to allow synchronous derivation without React's impure setState updater
  const latestState = useRef<T>(state);
  useEffect(() => { latestState.current = state; }, [state]);

  // ── Setter — optimistic update then persist ────────────────────────────────
  const set = useCallback((valOrFn: T | ((prev: T) => T)) => {
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
    persist(next);
  }, [persist, endpoint]);

  const returnedState = state !== undefined && state !== null ? state : initialValueRef.current;
  return [returnedState, set, { loading, error }]
}

/**
 * useSupabaseArray<T>
 *
 * Specialized version for array endpoints that support full CRUD.
 */
export function useSupabaseArray<T>(
  endpoint: string,
  initialValue: T[] = [],
  options?: { refreshIntervalMs?: number }
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, { loading: boolean; error: string | null }] {
  const safeInitial = initialValue !== undefined && initialValue !== null ? initialValue : [];
  return useSupabaseCollection<T[]>(endpoint, safeInitial, {
    ...options,
    fetcher: () => {
      const sep = endpoint.includes('?') ? '&' : '?';
      return fetch(`/api/${endpoint}${sep}_t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, cache: 'no-store' })
        .then(async r => {
            if (!r.ok) {
              if (r.status === 404 || r.status === 500) {
                console.warn(`[useSupabaseArray] Endpoint /${endpoint} is not implemented yet or table is missing (HTTP ${r.status}). Returning [].`);
                return [];
              }
              throw new Error(`HTTP ${r.status}`);
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
            console.warn(`[useSupabaseArray] Fetch failed for /${endpoint}:`, err)
            throw err
        })
    },
    persister: async (arr) => {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr),
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
    },
  })
}
