'use client'

/**
 * useLocalStorage -> MIGRADO PARA SUPABASE
 * 
 * Para evitar refatorar o destructuring [data, setData] em mais de 20 páginas
 * secundárias, e para garantir a migração de 100% dos dados para nuvem,
 * este hook agora utiliza a tabela "configuracoes" do Supabase silenciosamente.
 */
import { useState, useCallback, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Fetch initial data from Supabase
  useEffect(() => {
    let cancelled = false
    fetch(`/api/configuracoes?chave=${encodeURIComponent(key)}`)
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (json && json.valor !== null) {
          setStoredValue(json.valor as T)
        } else {
          // If key doesn't exist, seed the DB with initialValue so other devices see it
          if (initialValue !== null && initialValue !== undefined) {
             try {
               fetch('/api/configuracoes', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ chave: key, valor: initialValue }),
               })
             } catch {}
          }
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      if (typeof window !== 'undefined') {
        try {
           fetch('/api/configuracoes', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ chave: key, valor: next }),
           }).catch(() => {})
        } catch {}
      }
      return next
    })
  }, [key])

  return [storedValue, setValue]
}
