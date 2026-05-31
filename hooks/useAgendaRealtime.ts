'use client'

import { useEffect, useRef } from 'react'

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
    const handleInsert = (e: any) => {
      const payload = e.detail;
      if (onInsertRef.current) onInsertRef.current({ new: payload.new as T, old: null })
    }

    const handleUpdate = (e: any) => {
      const payload = e.detail;
      if (onUpdateRef.current) onUpdateRef.current({ new: payload.new as T, old: payload.old as T })
    }

    const handleDelete = (e: any) => {
      const payload = e.detail;
      if (onDeleteRef.current) onDeleteRef.current({ new: null, old: payload.old as T })
    }

    const eventPrefix = `ad:${table}-`
    
    window.addEventListener(`${eventPrefix}insert`, handleInsert)
    window.addEventListener(`${eventPrefix}update`, handleUpdate)
    window.addEventListener(`${eventPrefix}delete`, handleDelete)

    return () => {
      window.removeEventListener(`${eventPrefix}insert`, handleInsert)
      window.removeEventListener(`${eventPrefix}update`, handleUpdate)
      window.removeEventListener(`${eventPrefix}delete`, handleDelete)
    }
  }, [table])
}
