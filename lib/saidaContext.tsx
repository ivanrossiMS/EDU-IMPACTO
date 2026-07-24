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
  callStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, source?: CallSource, rfidCode?: string, studentPhoto?: string | null, forceNewCall?: boolean) => PickupCall | null
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
              const callStudentId = call.studentId ? String(call.studentId) : null
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                // Protect confirmed students from being set back to waiting/called via DB triggers/inserts unless isRevert is set
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === callStudentId) ? { ...c, status: 'confirmed' } : c)
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
              const callStudentId = call.studentId ? String(call.studentId) : null
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === callStudentId) ? { ...c, status: 'confirmed' } : c)
                }
                const idx = arr.findIndex(c => c.id === call.id)
                if (idx >= 0) {
                  return arr.map(c => c.id === call.id ? { ...c, ...call } : c)
                }
                return [call, ...arr]
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
            const dataStudentId = data?.studentId ? String(data.studentId) : null
            if (event === 'CALL_STUDENT') {
              setActiveCallsLocal?.((prev: PickupCall[]) => {
                const arr = prev || []
                const isAlreadyConfirmed = dataStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === dataStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && data.status !== 'confirmed' && !data.isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === dataStudentId) ? { ...c, status: 'confirmed' } : c)
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
              setActiveCallsLocal?.((prev: PickupCall[]) => (prev || []).map(c => (c.id === data.callId || (dataStudentId && c.studentId != null && String(c.studentId) === dataStudentId)) ? { ...c, status: 'confirmed', confirmedAt: data.confirmedAt } : c))
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
      const dStudentId = d?.studentId ? String(d.studentId) : null
      if (payload.event === 'CALL_STUDENT') {
        setActiveCallsLocal?.(prev => {
          const arr = prev || []
          const isAlreadyConfirmed = dStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === dStudentId && c.status === 'confirmed') : false
          if (isAlreadyConfirmed && d.status !== 'confirmed' && !(d as any).isRevert) {
            return arr.map(c => (c.studentId != null && String(c.studentId) === dStudentId) ? { ...c, status: 'confirmed' } : c)
          }
          if (arr.find(c => c.id === d.id)) return arr
          return [d, ...arr]
        })
      }
      if (payload.event === 'CONFIRM_PICKUP' && (d.callId || dStudentId)) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => (c.id === d.callId || (dStudentId && c.studentId != null && String(c.studentId) === dStudentId)) ? { ...c, status: 'confirmed', confirmedAt: now() } : c))
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
    source: CallSource = 'manual', rfidCode?: string, studentPhoto?: string | null,
    forceNewCall = false
  ): PickupCall | null => {
    const sIdStr = studentId ? String(studentId) : ''
    
    // Check for existing active call (waiting or called)
    const existingActive = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr &&
      (c.status === 'waiting' || c.status === 'called')
    )
    if (existingActive) {
      return existingActive
    }

    // Check for existing confirmed call today
    const existingConfirmed = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr && c.status === 'confirmed'
    )

    // Se o aluno já foi confirmado hoje, mas for uma autorização especial ou força nova chamada,
    // permite criar a nova chamada ativa com status 'waiting'
    if (existingConfirmed && !forceNewCall && guardianId !== 'special-auth') {
      console.warn(`[SaidaContext] Call blocked: student ${studentName} already confirmed departure today.`)
      return null
    }

    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId, guardianName, rfidCode,
      calledAt: now(), status: 'waiting', source,
      isRevert: existingConfirmed ? true : undefined
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
    const sIdStr = studentId ? String(studentId) : ''
    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
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

    const studentIdToConfirm = callToUpdate.studentId ? String(callToUpdate.studentId) : null

    // Apenas chamadas ativas (waiting, called, confirmed) devem ter seu status alterado para confirmed.
    // Registros com status 'special_auth' NUNCA devem ter seu status alterado para 'confirmed', para não sumirem de Lançados Hoje.
    const callsToConfirm = activeCalls.filter(c =>
      c.status !== 'special_auth' && c.status !== 'cancelled' &&
      (c.id === callId || (studentIdToConfirm && c.studentId != null && String(c.studentId) === studentIdToConfirm))
    )

    let updatedCalls: PickupCall[] = []

    if (callsToConfirm.length > 0) {
      updatedCalls = callsToConfirm.map(c => ({ ...c, status: 'confirmed' as const, confirmedAt: currentNow }))
    } else {
      // Se não havia uma chamada ativa no estado (ex: confirmação direta via botão no card de autorização especial),
      // cria um registro de chamada confirmada para este aluno
      const newConfirmedCall: PickupCall = {
        id: uid(),
        studentId: studentIdToConfirm || '',
        studentName: callToUpdate.studentName,
        studentClass: callToUpdate.studentClass,
        studentPhoto: callToUpdate.studentPhoto,
        guardianId: callToUpdate.guardianId || 'special-auth',
        guardianName: callToUpdate.guardianName,
        calledAt: callToUpdate.calledAt || currentNow,
        confirmedAt: currentNow,
        status: 'confirmed',
        source: callToUpdate.source || 'manual'
      }
      updatedCalls = [newConfirmedCall]
    }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      const existingIds = new Set(callsToConfirm.map(c => c.id))
      const newCallsToAdd = updatedCalls.filter(u => !existingIds.has(u.id))
      
      const updatedArr = arr.map(c => {
        // NUNCA altera o status de um registro special_auth!
        if (c.status !== 'special_auth' && (existingIds.has(c.id) || (studentIdToConfirm && c.studentId != null && String(c.studentId) === studentIdToConfirm && c.status !== 'cancelled'))) {
          return { ...c, status: 'confirmed' as const, confirmedAt: currentNow }
        }
        return c
      })
      return [...newCallsToAdd, ...updatedArr]
    })
    
    invalidateCache('saida/calls')
    updatedCalls.forEach(uCall => persistSingleCall(uCall))
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
    const sIdStr = callToUpdate.studentId ? String(callToUpdate.studentId) : null
    const updatedCall = { ...callToUpdate, status: 'waiting' as const, calledAt: currentNow, confirmedAt: undefined, isRevert: true }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => c.id === callId ? updatedCall : c)
    })
    
    invalidateCache('saida/calls')
    persistSingleCall(updatedCall)
    emit('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow })
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
    const sIdStr = studentId ? String(studentId) : ''
    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
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
    const sIdStr = studentId ? String(studentId) : ''

    // 1. Se o aluno já tem chamada aguardando/chamado, atualiza e confirma a chamada existente
    const existingWaiting = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr && (c.status === 'waiting' || c.status === 'called')
    )

    if (existingWaiting) {
      const matchingCalls = activeCalls.filter(c => c.studentId != null && String(c.studentId) === sIdStr && c.status !== 'cancelled' && c.status !== 'special_auth')
      const updatedCalls = matchingCalls.map(c => ({
        ...c,
        guardianId: 'sozinho',
        guardianName: 'Saiu Sozinho',
        status: 'confirmed' as const,
        confirmedAt: currentNow
      }))
      const primaryUpdated = updatedCalls.find(c => c.id === existingWaiting.id) || updatedCalls[0]

      setActiveCallsLocal?.(prev => (prev || []).map(c => (c.studentId != null && String(c.studentId) === sIdStr && c.status !== 'cancelled' && c.status !== 'special_auth') ? { ...c, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', status: 'confirmed', confirmedAt: currentNow } : c))
      invalidateCache('saida/calls')
      updatedCalls.forEach(uCall => persistSingleCall(uCall))
      emit('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId: sIdStr, confirmedAt: currentNow, _remote: false })
      sendBroadcast('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId: sIdStr, confirmedAt: currentNow })
      addLog('CONFIRM', `Saída confirmada (Saiu Sozinho): ${studentName}`)
      return primaryUpdated
    }

    // 2. Se o aluno já teve uma saída confirmada hoje, retorna a chamada confirmada
    const existingConfirmed = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr && c.status === 'confirmed'
    )
    if (existingConfirmed) {
      return existingConfirmed
    }

    // 3. Caso contrário, cria uma nova chamada já com status 'confirmed'
    const newCall: PickupCall = {
      id: uid(),
      studentId: sIdStr,
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
    emit('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, confirmedAt: currentNow })
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
        
        // Normalize array: Ensure that if any entry for a studentId is 'confirmed',
        // all non-reverted entries for that same studentId are also marked as 'confirmed'.
        const confirmedSet = new Set(
          arr.filter((c: PickupCall) => c.status === 'confirmed' && c.studentId != null).map((c: PickupCall) => String(c.studentId))
        )
        const normalized = arr.map((c: PickupCall) => {
          if (c.studentId != null && confirmedSet.has(String(c.studentId)) && (c.status === 'waiting' || c.status === 'called') && !(c as any).isRevert) {
            return { ...c, status: 'confirmed' as const }
          }
          return c
        })

        if (setActiveCallsLocal) {
          setActiveCallsLocal(prev => {
            const prevArr = prev || []
            const prevConfirmedSet = new Set(
              prevArr.filter(c => c.status === 'confirmed' && c.studentId != null).map(c => String(c.studentId))
            )
            return normalized.map((c: PickupCall) => {
              if (c.studentId != null && prevConfirmedSet.has(String(c.studentId)) && (c.status === 'waiting' || c.status === 'called') && !(c as any).isRevert) {
                return { ...c, status: 'confirmed' as const }
              }
              return c
            })
          })
        } else {
          setActiveCalls(normalized) // fallback
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
