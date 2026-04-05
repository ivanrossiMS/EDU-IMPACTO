'use client'
import { useEffect, useRef, useCallback } from 'react'

export type RealtimeEvent =
  | 'CALL_STUDENT'
  | 'CONFIRM_PICKUP'
  | 'CANCEL_CALL'
  | 'RECALL_STUDENT'
  | 'REVERT_CALL'
  | 'CALL_UPDATE'

export interface RealtimePayload {
  event: RealtimeEvent
  data: Record<string, unknown>
  ts: number
}

type Handler = (payload: RealtimePayload) => void

const CHANNEL = 'edu-pickup-realtime'

export function useBroadcastRealtime() {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const handlers = useRef<Map<RealtimeEvent | '*', Set<Handler>>>(new Map())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const bc = new BroadcastChannel(CHANNEL)
    channelRef.current = bc

    bc.onmessage = (ev: MessageEvent<RealtimePayload>) => {
      const { event } = ev.data
      // notify exact handlers
      handlers.current.get(event)?.forEach(h => h(ev.data))
      // notify wildcard handlers
      handlers.current.get('*')?.forEach(h => h(ev.data))
    }

    // Also listen to localStorage events for same-tab fallback
    const onStorage = (e: StorageEvent) => {
      if (e.key !== `__bc_${CHANNEL}` || !e.newValue) return
      try {
        const payload = JSON.parse(e.newValue) as RealtimePayload
        handlers.current.get(payload.event)?.forEach(h => h(payload))
        handlers.current.get('*')?.forEach(h => h(payload))
      } catch {}
    }
    window.addEventListener('storage', onStorage)

    return () => {
      bc.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const emit = useCallback((event: RealtimeEvent, data: Record<string, unknown>) => {
    const payload: RealtimePayload = { event, data, ts: Date.now() }
    channelRef.current?.postMessage(payload)
    // fallback: trigger storage event so same-tab listeners also fire via a different mechanism
    try {
      localStorage.setItem(`__bc_${CHANNEL}`, JSON.stringify(payload))
      // immediate notify for same tab (BroadcastChannel doesn't fire for sender)
      handlers.current.get(event)?.forEach(h => h(payload))
      handlers.current.get('*')?.forEach(h => h(payload))
    } catch {}
  }, [])

  const on = useCallback((event: RealtimeEvent | '*', handler: Handler) => {
    if (!handlers.current.has(event)) handlers.current.set(event, new Set())
    handlers.current.get(event)!.add(handler)
    return () => handlers.current.get(event)?.delete(handler)
  }, [])

  return { emit, on }
}
