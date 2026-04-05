'use client'

/**
 * useLocalStorage — hook that syncs React state with localStorage.
 * SSR-safe (no hydration mismatch): always initializes with `initialValue`
 * on first render (matching server), then syncs from localStorage in useEffect.
 */
import { useState, useCallback, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // After mount, read the real value from localStorage (client only)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T)
      }
    } catch {
      // ignore parse errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch { /* ignore quota errors */ }
      }
      return next
    })
  }, [key])

  return [storedValue, setValue]
}
