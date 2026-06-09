'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface UseAgendaRealtimeProps<T = any> {
  table: string
  event?: RealtimeEvent
  filter?: string
  onInsert?: (payload: { new: T; old: T | null }) => void
  onUpdate?: (payload: { new: T; old: T | null }) => void
  onDelete?: (payload: { new: T | null; old: T }) => void
  toastConfig?: {
    enabled?: boolean
    insertMessage?: (data: T) => string
    updateMessage?: (data: T) => string
    icon?: React.ReactNode
  }
}

export function useAgendaRealtime<T = any>({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter
}: UseAgendaRealtimeProps<T>) {
  // Refs para manter os callbacks atualizados sem causar re-render ou re-subscription
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)

  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
  }, [onInsert, onUpdate, onDelete])

  useEffect(() => {
    // 1. Manter eventos locais para Optimistic UI
    const handleLocalInsert = (e: any) => {
      const payload = e.detail;
      if (onInsertRef.current) onInsertRef.current({ new: payload.new as T, old: null })
    }

    const handleLocalUpdate = (e: any) => {
      const payload = e.detail;
      if (onUpdateRef.current) onUpdateRef.current({ new: payload.new as T, old: payload.old as T })
    }

    const handleLocalDelete = (e: any) => {
      const payload = e.detail;
      if (onDeleteRef.current) onDeleteRef.current({ new: null, old: payload.old as T })
    }

    const eventPrefix = `ad:${table}-`
    window.addEventListener(`${eventPrefix}insert`, handleLocalInsert)
    window.addEventListener(`${eventPrefix}update`, handleLocalUpdate)
    window.addEventListener(`${eventPrefix}delete`, handleLocalDelete)

    

    return () => {
      window.removeEventListener(`${eventPrefix}insert`, handleLocalInsert)
      window.removeEventListener(`${eventPrefix}update`, handleLocalUpdate)
      window.removeEventListener(`${eventPrefix}delete`, handleLocalDelete)
      
    }
  }, [table, filter])
}
