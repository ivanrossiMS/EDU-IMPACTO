'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useSupabaseArray, useSupabaseCollection, invalidateCache } from '@/lib/useSupabaseCollection'
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
  isRevert?: boolean
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
  confirmSoloExit: (studentId: string, studentName: string, studentClass: string, studentPhoto?: string | null) => PickupCall | null
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

  const persistSingleCall = useCallback(async (call: PickupCall) => {
    try {
      invalidateCache('saida/calls')
      await fetch('/api/saida/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(call)
      })
    } catch (e) {
      console.error('Failed to persist call', e)
    }
  }, [])

  const sendBroadcast = useCallback((event: string, data: any) => {
    const eventId = Math.random().toString(36).substring(2, 15);
    processedBroadcasts.current.add(eventId);

    const doSend = () => {
      if (channelRef.current && channelRef.current.state === 'joined') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'CALL_EVENT',
          payload: { event, data, eventId }
        }).catch((e: any) => {
          console.warn('Realtime send ignored:', e)
        })
      }
    }

    doSend()
    setTimeout(doSend, 350)
  }, [])

  // ── Listen to Supabase Realtime changes and Broadcast Room ──────────────────
  useEffect(() => {
    let isMounted = true
    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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
                // Protect confirmed students from being set back to waiting/called via DB triggers/inserts unless isRevert is set
                const isAlreadyConfirmed = arr.some(c => c.studentId === call.studentId && c.status === 'confirmed' && c.id !== call.id)
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => c.studentId === call.studentId ? { ...c, status: 'confirmed' } : c)
                }
                const idx = arr.findIndex(c => c.id === call.id)
                if (idx >= 0) {
                  const updated = [...arr]
                  updated[idx] = { ...updated[idx], ...call }
                  return updated
                }
                return [call, ...arr]
              })
            } else if (eventType === 'UPDATE') {
              const call = { id: newRow.id, ...(newRow.dados || {}) } as PickupCall
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                const isAlreadyConfirmed = arr.some(c => c.studentId === call.studentId && c.status === 'confirmed' && c.id !== call.id)
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => c.studentId === call.studentId ? { ...c, status: 'confirmed' } : c)
                }
                return arr.map(c => c.id === call.id ? call : c)
              })
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
                const isAlreadyConfirmed = arr.some(c => c.studentId === data.studentId && c.status === 'confirmed')
                if (isAlreadyConfirmed && data.status !== 'confirmed' && !data.isRevert) {
                  return arr
                }
                const idx = arr.findIndex(c => c.id === data.id)
                if (idx >= 0) {
                  const updated = [...arr]
                  updated[idx] = { ...updated[idx], ...data }
                  return updated
                }
                return [data, ...arr]
              })
            } else if (event === 'CONFIRM_PICKUP') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => (c.id === data.callId || (data.studentId && c.studentId === data.studentId)) ? { ...c, status: 'confirmed', confirmedAt: data.confirmedAt } : c))
            } else if (event === 'CANCEL_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'cancelled' } : c))
            } else if (event === 'RECALL_STUDENT') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt } : c))
            } else if (event === 'REVERT_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt || new Date().toISOString(), confirmedAt: undefined, isRevert: true } : c))
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
          const isAlreadyConfirmed = arr.some(c => c.studentId === d.studentId && c.status === 'confirmed')
          if (isAlreadyConfirmed && d.status !== 'confirmed' && !(d as any).isRevert) {
            return arr
          }
          if (arr.find(c => c.id === d.id)) return arr
          return [d, ...arr]
        })
      }
      if (payload.event === 'CONFIRM_PICKUP' && (d.callId || d.studentId)) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => (c.id === d.callId || (d.studentId && c.studentId === d.studentId)) ? { ...c, status: 'confirmed', confirmedAt: now() } : c))
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'cancelled' } : c))
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now() } : c))
      }
      if (payload.event === 'REVERT_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: d.calledAt || now(), confirmedAt: undefined, isRevert: true } : c))
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
    // Prevent duplicate active call for the same student, or calling a student whose exit is already confirmed today
    const existing = activeCalls.find(c =>
      c.studentId === studentId &&
      c.status !== 'cancelled'
    )
    if (existing) {
      if (existing.status === 'confirmed') {
        console.warn(`[SaidaContext] Call blocked: student ${studentName} already confirmed departure today.`)
      }
      return null
    }

    const call: PickupCall = {
      id: uid(), studentId, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId, guardianName, rfidCode,
      calledAt: now(), status: 'waiting', source,
    }
    setActiveCallsLocal?.(prev => [call, ...(prev || [])])
    persistSingleCall(call)
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    addLog('CALL', `Chamada: ${studentName} (${studentClass}) — por ${guardianName}`)
    return call
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

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
    setActiveCallsLocal?.(prev => [call, ...(prev || [])])
    persistSingleCall(call)
    emit('CALL_STUDENT', { ...call, _remote: false })
    sendBroadcast('CALL_STUDENT', call)
    addLog('BLOCKED', `Acesso bloqueado (${blockType}): ${guardianName} tentou retirar ${studentName} — ${blockReason}`)
    return call
  }, [setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── confirmPickup ────────────────────────────────────────────────────────
  const confirmPickup = useCallback((callId: string) => {
    const currentNow = now()
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return

    const studentIdToConfirm = callToUpdate.studentId
    const updatedCallsForStudent: PickupCall[] = []

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => {
        if (c.id === callId || (studentIdToConfirm && c.studentId === studentIdToConfirm && c.status !== 'cancelled')) {
          const updated = { ...c, status: 'confirmed' as const, confirmedAt: currentNow }
          updatedCallsForStudent.push(updated)
          return updated
        }
        return c
      })
    })
    
    invalidateCache('saida/calls')
    updatedCallsForStudent.forEach(uCall => persistSingleCall(uCall))
    emit('CONFIRM_PICKUP', { callId, studentId: studentIdToConfirm, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId, studentId: studentIdToConfirm, confirmedAt: currentNow })
    addLog('CONFIRM', `Saída confirmada: ${callToUpdate.studentName ?? callId}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── cancelCall ───────────────────────────────────────────────────────────
  const cancelCall = useCallback((callId: string) => {
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return
    const updatedCall = { ...callToUpdate, status: 'cancelled' as const }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => c.id === callId ? updatedCall : c)
    })
    
    persistSingleCall(updatedCall)
    emit('CANCEL_CALL', { callId, _remote: false })
    sendBroadcast('CANCEL_CALL', { callId })
    addLog('CANCEL', `Chamada cancelada: ${updatedCall.studentName ?? callId}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── recallStudent ────────────────────────────────────────────────────────
  const recallStudent = useCallback((callId: string, speakFn: (text: string) => void) => {
    const currentNow = now()
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return
    const updatedCall = { ...callToUpdate, status: 'waiting' as const, calledAt: currentNow }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => c.id === callId ? updatedCall : c)
    })
    
    persistSingleCall(updatedCall)
    emit('RECALL_STUDENT', { callId, calledAt: currentNow, _remote: false })
    sendBroadcast('RECALL_STUDENT', { callId, calledAt: currentNow })
    const cName = config?.voiceTruncateTurma && config?.voiceTruncateChar 
      ? updatedCall.studentClass.split(config.voiceTruncateChar)[0].trim() 
      : updatedCall.studentClass
    speakFn(`${updatedCall.studentName}, turma ${cName}`)
    addLog('RECALL', `Rechamada: ${updatedCall.studentName}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, config, sendBroadcast, persistSingleCall])

  // ─── revertCall ───────────────────────────────────────────────────────────
  const revertCall = useCallback((callId: string) => {
    const currentNow = now()
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return
    const updatedCall = { ...callToUpdate, status: 'waiting' as const, calledAt: currentNow, confirmedAt: undefined, isRevert: true }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => c.id === callId ? updatedCall : c)
    })
    
    invalidateCache('saida/calls')
    persistSingleCall(updatedCall)
    emit('REVERT_CALL', { callId, studentId: callToUpdate.studentId, calledAt: currentNow, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, studentId: callToUpdate.studentId, calledAt: currentNow })
    addLog('REVERT', `Chamada revertida: ${updatedCall.studentName}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── deleteCall ───────────────────────────────────────────────────────────
  const deleteCall = useCallback(async (callId: string) => {
    let callName = callId;
    // Remove from local state
    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      const call = arr.find(c => c.id === callId)
      if (call) callName = call.studentName
      return arr.filter(c => c.id !== callId)
    })
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
    addLog('DELETE', `Autorização especial deletada: ${callName}`)
  }, [setActiveCallsLocal, addLog])

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
    setActiveCallsLocal?.(prev => [call, ...(prev || [])])
    persistSingleCall(call)
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    addLog('SPECIAL_AUTH', `Autorização Especial: ${studentName} liberado para ${authorizedPerson}`)
    return call
  }, [setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── confirmSoloExit ───────────────────────────────────────────────────────
  const confirmSoloExit = useCallback((
    studentId: string, studentName: string, studentClass: string, studentPhoto?: string | null
  ): PickupCall | null => {
    const currentNow = now()

    // 1. Se o aluno já tem chamada aguardando/chamado, atualiza e confirma a chamada existente
    const existingWaiting = activeCalls.find(c =>
      c.studentId === studentId && (c.status === 'waiting' || c.status === 'called')
    )

    if (existingWaiting) {
      const updatedCall: PickupCall = {
        ...existingWaiting,
        guardianId: 'sozinho',
        guardianName: 'Saiu Sozinho',
        status: 'confirmed',
        confirmedAt: currentNow
      }
      setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === existingWaiting.id ? updatedCall : c))
      persistSingleCall(updatedCall)
      emit('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId, confirmedAt: currentNow, _remote: false })
      sendBroadcast('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId, confirmedAt: currentNow })
      addLog('CONFIRM', `Saída confirmada (Saiu Sozinho): ${studentName}`)
      return updatedCall
    }

    // 2. Se o aluno já teve uma saída confirmada hoje, retorna a chamada confirmada
    const existingConfirmed = activeCalls.find(c =>
      c.studentId === studentId && c.status === 'confirmed'
    )
    if (existingConfirmed) {
      return existingConfirmed
    }

    // 3. Caso contrário, cria uma nova chamada já com status 'confirmed'
    const newCall: PickupCall = {
      id: uid(),
      studentId,
      studentName,
      studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId: 'sozinho',
      guardianName: 'Saiu Sozinho',
      calledAt: currentNow,
      confirmedAt: currentNow,
      status: 'confirmed',
      source: 'manual',
    }

    setActiveCallsLocal?.(prev => [newCall, ...(prev || [])])
    persistSingleCall(newCall)
    emit('CALL_STUDENT', { ...newCall })
    sendBroadcast('CALL_STUDENT', newCall)
    emit('CONFIRM_PICKUP', { callId: newCall.id, studentId, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: newCall.id, studentId, confirmedAt: currentNow })
    addLog('CONFIRM', `Saída confirmada (Saiu Sozinho): ${studentName}`)
    return newCall
  }, [activeCalls, setActiveCallsLocal, emit, sendBroadcast, persistSingleCall, addLog])

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
      invalidateCache('saida/calls')
      const res = await fetch(`/api/saida/calls?_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })
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
      callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall, deleteCall, addSpecialAuth, confirmSoloExit,
      updateConfig, clearLog, clearCalls, refreshCalls,
    }}>
      {children}
    </Ctx.Provider>
  )
}
