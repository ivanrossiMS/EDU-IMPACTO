'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * useLocalStorage — localStorage-first with optional Supabase background sync
 *
 * Data is ALWAYS read from and written to the browser's localStorage.
 * The Supabase API is used as a secondary background sync (best-effort).
 * If the API fails, data remains safe in localStorage.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const readFromStorage = (): T => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = localStorage.getItem(key)
      if (item !== null) return JSON.parse(item) as T
    } catch {}
    return initialValue
  }

  const [storedValue, setStoredValue] = useState<T>(readFromStorage)

  // On mount, sync from Supabase if API is available (background only)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/configuracoes?chave=${encodeURIComponent(key)}`)
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (json && json.valor !== null && json.valor !== undefined) {
          // API has data — use it and sync to localStorage
          setStoredValue(json.valor as T)
          try { localStorage.setItem(key, JSON.stringify(json.valor)) } catch {}
        } else {
          // API doesn't have this key — seed it from localStorage / initialValue
          const current = readFromStorage()
          if (current !== null && current !== undefined) {
            fetch('/api/configuracoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chave: key, valor: current }),
            }).catch(() => {})
          }
        }
      })
      .catch(() => {
        // API unavailable — localStorage already has the data, nothing to do
      })
    return () => { cancelled = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      // 1. Write to localStorage first (guaranteed persistence)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      }
      // 2. Background sync to Supabase (best-effort)
      fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: key, valor: next }),
      }).catch(() => {})
      return next
    })
  }, [key])

  return [storedValue, setValue]
}
