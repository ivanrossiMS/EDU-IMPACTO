'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useSupabaseArray, useSupabaseCollection } from '@/lib/useSupabaseCollection'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
export type GuardianType = 'mae' | 'pai' | 'avo' | 'motorista' | 'outro'
export type CallStatus = 'called' | 'waiting' | 'confirmed' | 'cancelled' | 'recalled' | 'blocked' | 'special_auth'
export type CallSource = 'rfid' | 'manual'

export interface Guardian {
  id: string
  name: string
  type: GuardianType
  document?: string
  phone?: string
  photoUrl?: string
  active: boolean
}

export interface GuardianRFID {
  id: string
  guardianId: string
  rfidCode: string
  active: boolean
}

export interface StudentGuardian {
  id: string
  studentId: string
  guardianId: string
  canPickup: boolean
}

export interface PickupCall {
  id: string
  studentId: string
  studentName: string
  studentClass: string
  studentPhoto?: string | null
  guardianId: string
  guardianName: string
  rfidCode?: string
  operatorId?: string
  calledAt: string
  confirmedAt?: string
  status: CallStatus
  source: CallSource
  // Access control fields
  blockReason?: string       // human-readable reason when status === 'blocked'
  blockType?: 'proibido' | 'dia_restrito'  // machine-readable block type
}

export interface SaidaLog {
  id: string
  type: string
  description: string
  userId?: string
  createdAt: string
}

export interface SaidaConfig {
  rfidEnabled: boolean
  voiceEnabled: boolean
  voiceURI: string
  voiceTruncateTurma: boolean
  voiceTruncateChar: string
  voiceRate: number
  voicePitch: number
  voiceVolume: number
  voiceRepeatCount: number
  tvDisplayTime: number   // seconds to keep on TV after confirm
  tvUrgentTime: number    // minutes to flag a student as late/urgent
  requireConfirmation: boolean
  allowMultiRFID: boolean
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: SaidaConfig = {
  rfidEnabled: true,
  voiceEnabled: true,
  voiceURI: '',
  voiceTruncateTurma: false,
  voiceTruncateChar: '-',
  voiceRate: 0.9,
  voicePitch: 1.0,
  voiceVolume: 1.0,
  voiceRepeatCount: 0,
  tvDisplayTime: 30,
  tvUrgentTime: 5,
  requireConfirmation: true,
  allowMultiRFID: true,
}

// ─── localStorage helpers ──────────────────────────────────────────────────────
const LS = {
  guardians:       'edu-saida-guardians',
  rfid:            'edu-saida-rfid',
  studentGuardians:'edu-saida-student-guardians',
  calls:           'edu-saida-calls',
  logs:            'edu-saida-logs',
  config:          'edu-saida-config',
}
function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}
function save(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) }
function now() { return new Date().toISOString() }

// ─── Context shape ─────────────────────────────────────────────────────────────
interface SaidaCtx {
  // state
  guardians: Guardian[]
  rfidMap: GuardianRFID[]
  studentGuardians: StudentGuardian[]
  activeCalls: PickupCall[]
  logs: SaidaLog[]
  config: SaidaConfig
  isConfigLoading: boolean
  realtimeStatus: 'online' | 'connecting' | 'offline'
  isLoadingCalls: boolean
  // actions
  callStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, source?: CallSource, rfidCode?: string, studentPhoto?: string | null) => PickupCall | null
  blockAttempt: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, rfidCode: string | undefined, blockType: 'proibido' | 'dia_restrito', blockReason: string, studentPhoto?: string | null) => PickupCall
  confirmPickup: (callId: string) => void
  cancelCall: (callId: string) => void
  recallStudent: (callId: string, speakFn: (text: string) => void) => void
  revertCall: (callId: string) => void
  deleteCall: (callId: string) => void
  addSpecialAuth: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, operatorName: string, studentPhoto?: string | null) => PickupCall
  updateConfig: (patch: Partial<SaidaConfig>) => Promise<void>
  clearLog: () => void
  clearCalls: () => void
  refreshCalls: () => Promise<void>
}

const Ctx = createContext<SaidaCtx | null>(null)

export function useSaida() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSaida must be used within SaidaProvider')
  return c
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SaidaProvider({ children, enabled = true }: { children: React.ReactNode, enabled?: boolean }) {
  // `enabled` gates heavy data fetching (calls list, config) but Realtime channel
  // is ALWAYS active so all clients (including Família/mobile) receive live updates.
  const [activeCalls, setActiveCalls, { loading: isLoadingCalls, setLocal: setActiveCallsLocal }] = useSupabaseArray<PickupCall>('saida/calls', [], { enabled })
  const [logs, setLogs] = useState<SaidaLog[]>([])
  const [config, setConfig, { loading: isConfigLoading }] = useSupabaseCollection<SaidaConfig>('saida/config', DEFAULT_CONFIG, { enabled })

  const { emit, on } = useBroadcastRealtime()
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'connecting' | 'offline'>('connecting')

  const getTodayStr = useCallback(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const channelRef = useRef<any>(null)
  const processedBroadcasts = useRef<Set<string>>(new Set())

  const sendBroadcast = useCallback((event: string, data: any) => {
    if (channelRef.current) {
      const eventId = Math.random().toString(36).substring(2, 15);
      processedBroadcasts.current.add(eventId);
      channelRef.current.send({
        type: 'broadcast',
        event: 'CALL_EVENT',
        payload: { event, data, eventId }
      })
    }
  }, [])

  // ── Listen to Supabase Realtime changes and Broadcast Room ──────────────────
  useEffect(() => {
    let isMounted = true
    let channel: any = null

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // Allow connection even without auth so Monitor TV can receive broadcasts
      
      setRealtimeStatus('connecting')
      
      // Clean up any stale channel from React Strict Mode re-mounts fully
      const existingChannels = supabase.getChannels().filter(c => c.topic === 'realtime:saida_calls_shared_room')
      for (const c of existingChannels) {
        await supabase.removeChannel(c)
      }

      if (!isMounted) return

      // Use a stable, shared channel room for network-wide broadcasts
      channel = supabase.channel('saida_calls_shared_room')
      channelRef.current = channel

      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'saida_calls' },
          (payload: any) => {
            const { eventType, new: newRow, old: oldRow } = payload
            
            if (eventType === 'INSERT') {
              const call = { id: newRow.id, ...(newRow.dados || {}) } as PickupCall
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                if (arr.some(c => c.id === call.id)) return arr
                return [call, ...arr]
              })
            } else if (eventType === 'UPDATE') {
              const call = { id: newRow.id, ...(newRow.dados || {}) } as PickupCall
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === call.id ? call : c))
            } else if (eventType === 'DELETE') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).filter(c => c.id !== oldRow.id))
            }
          }
        )
        .on(
          'broadcast',
          { event: 'CALL_EVENT' },
          (payload: any) => {
            const { event, data, eventId } = payload.payload || {}
            if (eventId) {
              if (processedBroadcasts.current.has(eventId)) return;
              processedBroadcasts.current.add(eventId);
              if (processedBroadcasts.current.size > 200) processedBroadcasts.current.clear();
            }
            if (event === 'CALL_STUDENT') {
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                if (arr.some(c => c.id === data.id)) return arr
                return [data, ...arr]
              })
            } else if (event === 'CONFIRM_PICKUP') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'confirmed', confirmedAt: data.confirmedAt } : c))
            } else if (event === 'CANCEL_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'cancelled' } : c))
            } else if (event === 'RECALL_STUDENT') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt } : c))
            } else if (event === 'REVERT_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt || new Date().toISOString(), confirmedAt: undefined } : c))
            } else if (event === 'CLEAR_ALL_CALLS') {
              setActiveCallsLocal?.([])
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            if (isMounted) setRealtimeStatus('online')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (isMounted) setRealtimeStatus('offline')
          } else {
            if (isMounted) setRealtimeStatus('connecting')
          }
        })
    }

    setupRealtime()

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [setActiveCalls])

  // ── Listen for remote updates (Monitor TV / same-browser tab sync) ─────────────────
  useEffect(() => {
    const unsub = on('*', payload => {
      if ((payload.data as any)._remote) return  // avoid loops
      const d = payload.data as unknown as PickupCall & { callId?: string }
      if (payload.event === 'CALL_STUDENT') {
        setActiveCallsLocal?.(prev => {
          const arr = prev || []
          if (arr.find(c => c.id === d.id)) return arr
          return [d, ...arr]
        })
      }
      if (payload.event === 'CONFIRM_PICKUP' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'confirmed', confirmedAt: now() } : c))
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'cancelled' } : c))
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now() } : c))
      }
      if (payload.event === 'REVERT_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: d.calledAt || now(), confirmedAt: undefined } : c))
      }
      if (payload.event === 'CLEAR_ALL_CALLS') {
        setActiveCallsLocal?.([])
      }
    })
    return () => { unsub() }
  }, [on])

  // ── Logging helper ────────────────────────────────────────────────────────
  const addLog = useCallback((type: string, description: string) => {
    const entry: SaidaLog = { id: uid(), type, description, createdAt: now() }
    setLogs(prev => [entry, ...prev].slice(0, 500))
  }, [])


  // ─── callStudent ──────────────────────────────────────────────────────────
  const callStudent = useCallback((
    studentId: string, studentName: string, studentClass: string,
    guardianId: string, guardianName: string,
    source: CallSource = 'manual', rfidCode?: string, studentPhoto?: string | null
  ): PickupCall | null => {
    // Prevent duplicate active call for the same student, unless it was cancelled
    const existing = activeCalls.find(c =>
      c.studentId === studentId &&
      c.status !== 'cancelled' &&
      c.guardianId !== 'special' &&
      c.guardianId !== 'special-auth'
    )
    if (existing) return null

    const call: PickupCall = {
      id: uid(), studentId, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId, guardianName, rfidCode,
      calledAt: now(), status: 'waiting', source,
    }
    setActiveCalls(prev => [call, ...prev])
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    addLog('CALL', `Chamada: ${studentName} (${studentClass}) — por ${guardianName}`)
    return call
  }, [activeCalls, emit, addLog, sendBroadcast])

  // ─── blockAttempt ──────────────────────────────────────────────────
  // Logs a BLOCKED access attempt (proibido or wrong day) without creating an
  // active call — appears in chamadas with a PROIBIDO/RESTRITO badge.
  const blockAttempt = useCallback((
    studentId: string, studentName: string, studentClass: string,
    guardianId: string, guardianName: string,
    rfidCode: string | undefined,
    blockType: 'proibido' | 'dia_restrito',
    blockReason: string,
    studentPhoto?: string | null,
  ): PickupCall => {
    const call: PickupCall = {
      id: uid(), studentId, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId, guardianName, rfidCode,
      calledAt: now(), status: 'blocked', source: 'rfid',
      blockType, blockReason,
    }
    setActiveCalls(prev => [call, ...prev])
    emit('CALL_STUDENT', { ...call, _remote: false })
    sendBroadcast('CALL_STUDENT', call)
    addLog('BLOCKED', `Acesso bloqueado (${blockType}): ${guardianName} tentou retirar ${studentName} — ${blockReason}`)
    return call
  }, [addLog, emit, sendBroadcast])

  // ─── confirmPickup ────────────────────────────────────────────────────────
  const confirmPickup = useCallback((callId: string) => {
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'confirmed', confirmedAt: now() } : c
    ))
    const call = activeCalls.find(c => c.id === callId)
    emit('CONFIRM_PICKUP', { callId, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId, confirmedAt: now() })
    addLog('CONFIRM', `Saída confirmada: ${call?.studentName ?? callId}`)
  }, [activeCalls, emit, addLog, sendBroadcast])

  // ─── cancelCall ───────────────────────────────────────────────────────────
  const cancelCall = useCallback((callId: string) => {
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'cancelled' } : c
    ))
    const call = activeCalls.find(c => c.id === callId)
    emit('CANCEL_CALL', { callId, _remote: false })
    sendBroadcast('CANCEL_CALL', { callId })
    addLog('CANCEL', `Chamada cancelada: ${call?.studentName ?? callId}`)
  }, [activeCalls, emit, addLog, sendBroadcast])

  // ─── recallStudent ────────────────────────────────────────────────────────
  const recallStudent = useCallback((callId: string, speakFn: (text: string) => void) => {
    const call = activeCalls.find(c => c.id === callId)
    if (!call) return
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'waiting', calledAt: now() } : c
    ))
    emit('RECALL_STUDENT', { callId, _remote: false })
    sendBroadcast('RECALL_STUDENT', { callId, calledAt: now() })
    const cName = config?.voiceTruncateTurma && config?.voiceTruncateChar 
      ? call.studentClass.split(config.voiceTruncateChar)[0].trim() 
      : call.studentClass
    speakFn(`${call.studentName}, turma ${cName}`)
    addLog('RECALL', `Rechamada: ${call.studentName}`)
  }, [activeCalls, emit, addLog, config, sendBroadcast])

  // ─── revertCall ───────────────────────────────────────────────────────────
  const revertCall = useCallback((callId: string) => {
    const call = activeCalls.find(c => c.id === callId)
    if (!call) return
    const currentNow = now()
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'waiting', calledAt: currentNow, confirmedAt: undefined } : c
    ))
    emit('REVERT_CALL', { callId, calledAt: currentNow, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, calledAt: currentNow })
    addLog('REVERT', `Chamada revertida: ${call.studentName}`)
  }, [activeCalls, emit, addLog, sendBroadcast])

  // ─── deleteCall ───────────────────────────────────────────────────────────
  const deleteCall = useCallback(async (callId: string) => {
    const call = activeCalls.find(c => c.id === callId)
    if (!call) return
    // Remove from local state
    setActiveCalls(prev => prev.filter(c => c.id !== callId))
    // Also delete from DB directly
    try {
      await fetch('/api/saida/calls', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: callId })
      })
    } catch (e) {
      console.error('Failed to delete call', e)
    }
    // We don't need a custom broadcast because Supabase Realtime will send a DELETE event
    addLog('DELETE', `Autorização especial deletada: ${call.studentName}`)
  }, [activeCalls, setActiveCalls, addLog])

  // ─── addSpecialAuth ───────────────────────────────────────────────────────
  const addSpecialAuth = useCallback((
    studentId: string, studentName: string, studentClass: string,
    authorizedPerson: string, operatorName: string, studentPhoto?: string | null
  ): PickupCall => {
    const call: PickupCall = {
      id: uid(), studentId, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId: 'special', guardianName: authorizedPerson,
      operatorId: operatorName,
      calledAt: now(), status: 'special_auth', source: 'manual',
    }
    setActiveCalls(prev => [call, ...prev])
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    addLog('SPECIAL_AUTH', `Autorização Especial: ${studentName} liberado para ${authorizedPerson}`)
    return call
  }, [emit, addLog, sendBroadcast])



  // ─── Config ───────────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<SaidaConfig>) => {
    return setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const clearLog = useCallback(() => setLogs([]), [])

  const clearCalls = useCallback(() => {
    setActiveCalls([])
    emit('CLEAR_ALL_CALLS', { _remote: false })
    sendBroadcast('CLEAR_ALL_CALLS', {})
    addLog('CLEAR_CALLS', `Todas as chamadas foram zeradas.`)
  }, [emit, addLog, sendBroadcast])

  // ── Zerar lista diariamente às 23:59 ────────────────────────────────────────
  useEffect(() => {
    const checkTimeAndClear = () => {
      const d = new Date()
      if (d.getHours() === 23 && d.getMinutes() === 59) {
        const lastCleared = localStorage.getItem('lastClearedDate')
        const todayStr = getTodayStr()
        // Prevents triggering multiple times in the same minute
        if (lastCleared !== todayStr) {
          clearCalls()
          localStorage.setItem('lastClearedDate', todayStr)
        }
      }
    }
    const interval = setInterval(checkTimeAndClear, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [clearCalls, getTodayStr])

  const refreshCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/saida/calls')
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        if (setActiveCallsLocal) {
          setActiveCallsLocal(arr)
        } else {
          setActiveCalls(arr) // fallback
        }
      }
    } catch (e) {
      console.error('Erro ao recarregar chamadas:', e)
    }
  }, [setActiveCalls, setActiveCallsLocal])

  return (
    <Ctx.Provider value={{
      guardians: [], rfidMap: [], studentGuardians: [], activeCalls, logs,
      config,
      isConfigLoading,
      realtimeStatus, isLoadingCalls,
      callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall, deleteCall, addSpecialAuth,
      updateConfig, clearLog, clearCalls, refreshCalls,
    }}>
      {children}
    </Ctx.Provider>
  )
}
