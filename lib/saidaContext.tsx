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
  readRFID: (code: string) => { guardian: Guardian | null; error?: string }
  callStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, source?: CallSource, rfidCode?: string, studentPhoto?: string | null) => PickupCall | null
  blockAttempt: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, rfidCode: string | undefined, blockType: 'proibido' | 'dia_restrito', blockReason: string, studentPhoto?: string | null) => PickupCall
  confirmPickup: (callId: string) => void
  cancelCall: (callId: string) => void
  recallStudent: (callId: string, speakFn: (text: string) => void) => void
  revertCall: (callId: string) => void
  addSpecialAuth: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, operatorName: string, studentPhoto?: string | null) => PickupCall
  addGuardian: (g: Omit<Guardian, 'id'>) => Guardian
  updateGuardian: (id: string, data: Partial<Guardian>) => void
  removeGuardian: (id: string) => void
  addRFID: (guardianId: string, rfidCode: string) => GuardianRFID
  removeRFID: (id: string) => void
  linkStudentGuardian: (studentId: string, guardianId: string, canPickup?: boolean) => void
  unlinkStudentGuardian: (id: string) => void
  getGuardiansForStudent: (studentId: string) => (Guardian & { canPickup: boolean })[]
  getStudentsForGuardian: (guardianId: string) => string[]
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
export function SaidaProvider({ children }: { children: React.ReactNode }) {
  const [guardians, setGuardians] = useSupabaseArray<Guardian>('saida/guardians', [])
  const [rfidMap, setRfidMap] = useSupabaseArray<GuardianRFID>('saida/rfid', [])
  const [studentGuardians, setStudentGuardians] = useSupabaseArray<StudentGuardian>('saida/student_guardians', [])
  const [activeCalls, setActiveCalls, { loading: isLoadingCalls, setLocal: setActiveCallsLocal }] = useSupabaseArray<PickupCall>('saida/calls', [])
  const [logs, setLogs] = useState<SaidaLog[]>([])
  const [config, setConfig, { loading: isConfigLoading }] = useSupabaseCollection<SaidaConfig>('saida/config', DEFAULT_CONFIG)

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
                if (prev.some(c => c.id === call.id)) return prev
                return [call, ...prev]
              })
            } else if (eventType === 'UPDATE') {
              const call = { id: newRow.id, ...(newRow.dados || {}) } as PickupCall
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.map(c => c.id === call.id ? call : c))
            } else if (eventType === 'DELETE') {
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.filter(c => c.id !== oldRow.id))
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
                if (prev.some(c => c.id === data.id)) return prev
                return [data, ...prev]
              })
            } else if (event === 'CONFIRM_PICKUP') {
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.map(c => c.id === data.callId ? { ...c, status: 'confirmed', confirmedAt: data.confirmedAt } : c))
            } else if (event === 'CANCEL_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.map(c => c.id === data.callId ? { ...c, status: 'cancelled' } : c))
            } else if (event === 'RECALL_STUDENT') {
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt } : c))
            } else if (event === 'REVERT_CALL') {
              setActiveCallsLocal?.((prev: PickupCall[]) => prev.map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt, confirmedAt: undefined } : c))
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
          if (prev.find(c => c.id === d.id)) return prev
          return [d, ...prev]
        })
      }
      if (payload.event === 'CONFIRM_PICKUP' && d.callId) {
        setActiveCallsLocal?.(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'confirmed', confirmedAt: now() } : c))
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'cancelled' } : c))
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setActiveCallsLocal?.(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now() } : c))
      }
      if (payload.event === 'REVERT_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now(), confirmedAt: undefined } : c))
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

  // ─── readRFID ─────────────────────────────────────────────────────────────
  const readRFID = useCallback((code: string) => {
    const rfid = rfidMap.find(r => r.rfidCode === code && r.active)
    if (!rfid) return { guardian: null, error: 'RFID não encontrado.' }
    const g = guardians.find(g => g.id === rfid.guardianId)
    if (!g) return { guardian: null, error: 'Responsável não vinculado ao RFID.' }
    if (!g.active) return { guardian: null, error: 'Responsável inativo. Acesso bloqueado.' }
    addLog('RFID_READ', `Leitura RFID: ${code} → ${g.name}`)
    return { guardian: g }
  }, [rfidMap, guardians, addLog])

  // ─── callStudent ──────────────────────────────────────────────────────────
  const callStudent = useCallback((
    studentId: string, studentName: string, studentClass: string,
    guardianId: string, guardianName: string,
    source: CallSource = 'manual', rfidCode?: string, studentPhoto?: string | null
  ): PickupCall | null => {
    // Prevent duplicate active call
    const existing = activeCalls.find(c =>
      c.studentId === studentId &&
      (c.status === 'called' || c.status === 'waiting')
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
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'waiting', calledAt: now(), confirmedAt: undefined } : c
    ))
    emit('REVERT_CALL', { callId, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, calledAt: now() })
    addLog('REVERT', `Chamada revertida: ${call.studentName}`)
  }, [activeCalls, emit, addLog, sendBroadcast])

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

  // ─── Guardian CRUD ────────────────────────────────────────────────────────
  const addGuardian = useCallback((g: Omit<Guardian, 'id'>): Guardian => {
    const newG = { ...g, id: uid() }
    setGuardians(prev => [...prev, newG])
    addLog('GUARDIAN_ADD', `Responsável cadastrado: ${newG.name}`)
    return newG
  }, [addLog])
  const updateGuardian = useCallback((id: string, data: Partial<Guardian>) => {
    setGuardians(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
  }, [])
  const removeGuardian = useCallback((id: string) => {
    setGuardians(prev => prev.filter(g => g.id !== id))
    setRfidMap(prev => prev.filter(r => r.guardianId !== id))
    setStudentGuardians(prev => prev.filter(sg => sg.guardianId !== id))
  }, [])

  // ─── RFID CRUD ────────────────────────────────────────────────────────────
  const addRFID = useCallback((guardianId: string, rfidCode: string): GuardianRFID => {
    const entry: GuardianRFID = { id: uid(), guardianId, rfidCode: rfidCode.trim(), active: true }
    setRfidMap(prev => [...prev, entry])
    addLog('RFID_ADD', `RFID ${rfidCode} vinculado`)
    return entry
  }, [addLog])
  const removeRFID = useCallback((id: string) => {
    setRfidMap(prev => prev.filter(r => r.id !== id))
  }, [])

  // ─── Student-Guardian links ───────────────────────────────────────────────
  const linkStudentGuardian = useCallback((studentId: string, guardianId: string, canPickup = true) => {
    const exists = studentGuardians.find(sg => sg.studentId === studentId && sg.guardianId === guardianId)
    if (exists) return
    const entry: StudentGuardian = { id: uid(), studentId, guardianId, canPickup }
    setStudentGuardians(prev => [...prev, entry])
  }, [studentGuardians])
  const unlinkStudentGuardian = useCallback((id: string) => {
    setStudentGuardians(prev => prev.filter(sg => sg.id !== id))
  }, [])

  const getGuardiansForStudent = useCallback((studentId: string) =>
    studentGuardians
      .filter(sg => sg.studentId === studentId && sg.canPickup)
      .map(sg => {
        const g = guardians.find(g => g.id === sg.guardianId)
        return g ? { ...g, canPickup: sg.canPickup } : null
      })
      .filter(Boolean) as (Guardian & { canPickup: boolean })[],
  [studentGuardians, guardians])

  const getStudentsForGuardian = useCallback((guardianId: string) =>
    studentGuardians
      .filter(sg => sg.guardianId === guardianId && sg.canPickup)
      .map(sg => sg.studentId),
  [studentGuardians])

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
      guardians, rfidMap, studentGuardians, activeCalls, logs,
      config,
      isConfigLoading,
      realtimeStatus, isLoadingCalls,
      readRFID, callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall, addSpecialAuth,
      addGuardian, updateGuardian, removeGuardian,
      addRFID, removeRFID,
      linkStudentGuardian, unlinkStudentGuardian,
      getGuardiansForStudent, getStudentsForGuardian,
      updateConfig, clearLog, clearCalls, refreshCalls,
    }}>
      {children}
    </Ctx.Provider>
  )
}
