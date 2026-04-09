'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Shared in-memory cache (survives route navigations) ──────────────────────
// Key: endpoint string → { data, timestamp, inflightPromise }
interface CacheEntry<T> {
  data: T
  timestamp: number
  inflightPromise?: Promise<T>
}

const CACHE_TTL_MS = 30_000   // 30 seconds stale-while-revalidate window
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
  }
): [T, (value: T | ((prev: T) => T)) => void, { loading: boolean; error: string | null }] {
  const lsKey = `edu-ls-${endpoint}`
  // Store initialValue in a ref so it stays stable across Fast Refresh / re-renders
  const initialValueRef = useRef<T>(initialValue)

  // Initialization priority: 1. mem-cache, 2. localStorage, 3. initialValue
  const getBootValue = (): T => {
    const cached = getCacheEntry<T>(endpoint)
    if (cached) {
      if (Array.isArray(initialValueRef.current) && !Array.isArray(cached.data)) return initialValueRef.current
      return cached.data
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(lsKey)
        if (stored) {
          const parsed = JSON.parse(stored) as T
          if (Array.isArray(initialValueRef.current) && !Array.isArray(parsed)) return initialValueRef.current
          return parsed
        }
      } catch {}
    }
    return initialValueRef.current
  }

  const [state, setState] = useState<T>(getBootValue)
  const [loading, setLoading] = useState(true)
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
      : () => fetch(`/api/${endpoint}`)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<T>
          })

    fetchWithDedup<T>(endpoint, doFetch)
      .then(data => {
        if (cancelled || !isMounted.current) return
        if (data !== undefined && data !== null) {
          if (Array.isArray(initialValueRef.current) && !Array.isArray(data)) {
             data = initialValueRef.current
          }
          setState(data)
          // Persist successful API response to localStorage too
          if (typeof window !== 'undefined') {
            try { localStorage.setItem(lsKey, JSON.stringify(data)) } catch {}
          }
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled || !isMounted.current) return
        // API failed - try localStorage as fallback
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(lsKey)
            if (stored) {
              const parsed = JSON.parse(stored) as T
              if (Array.isArray(initialValueRef.current) && !Array.isArray(parsed)) {
                 setState(initialValueRef.current)
                 setCacheEntry(endpoint, initialValueRef.current)
              } else {
                 setState(parsed)
                 setCacheEntry(endpoint, parsed)
              }
            }
          } catch {}
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [endpoint]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist helper ─────────────────────────────────────────────────────────
  const persist = useCallback(async (next: T) => {
    // 1. Invalidate mem-cache
    invalidateCache(endpoint)
    // 2. ALWAYS save to localStorage first (permanent fallback)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(lsKey, JSON.stringify(next)) } catch {}
    }
    // 3. Update mem-cache
    setCacheEntry(endpoint, next)
    // 4. Sync to API (best effort — won't revert localStorage on failure)
    try {
      if (options?.persister) {
        await options.persister(next)
      } else {
        await fetch(`/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
      }
      if (isMounted.current) setError(null)
    } catch (e: any) {
      // API failed but localStorage is already saved — data is safe
      console.warn(`[useSupabaseCollection] API sync failed for ${endpoint}, data preserved in localStorage`)
    }
  }, [endpoint, lsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setter — optimistic update then persist ────────────────────────────────
  const set = useCallback((valOrFn: T | ((prev: T) => T)) => {
    setState(prev => {
      // Guard: prev can be undefined after Fast Refresh or race conditions
      const safePrev: T = prev !== undefined ? prev : initialValueRef.current
      const next = typeof valOrFn === 'function'
        ? (valOrFn as (p: T) => T)(safePrev)
        : valOrFn
      // Optimistically update cache too
      setCacheEntry(endpoint, next)
      persist(next)
      return next
    })
  }, [persist, endpoint])

  return [state, set, { loading, error }]
}

/**
 * useSupabaseArray<T>
 *
 * Specialized version for array endpoints that support full CRUD.
 */
export function useSupabaseArray<T>(
  endpoint: string,
  initialValue: T[] = []
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, { loading: boolean; error: string | null }] {
  return useSupabaseCollection<T[]>(endpoint, initialValue, {
    fetcher: () =>
      fetch(`/api/${endpoint}`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        }),
    persister: async (arr) => {
      await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr),
      })
    },
  })
}
