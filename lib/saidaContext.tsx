'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'

// ─── Types ────────────────────────────────────────────────────────────────────
export type GuardianType = 'mae' | 'pai' | 'avo' | 'motorista' | 'outro'
export type CallStatus = 'called' | 'waiting' | 'confirmed' | 'cancelled' | 'recalled' | 'blocked'
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
  voiceVolume: number
  voiceRepeatCount: number
  tvDisplayTime: number   // seconds to keep on TV after confirm
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
  voiceVolume: 1.0,
  voiceRepeatCount: 0,
  tvDisplayTime: 30,
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
  // actions
  readRFID: (code: string) => { guardian: Guardian | null; error?: string }
  callStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, source?: CallSource, rfidCode?: string, studentPhoto?: string | null) => PickupCall | null
  blockAttempt: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, rfidCode: string | undefined, blockType: 'proibido' | 'dia_restrito', blockReason: string, studentPhoto?: string | null) => PickupCall
  confirmPickup: (callId: string) => void
  cancelCall: (callId: string) => void
  recallStudent: (callId: string, speakFn: (text: string) => void) => void
  revertCall: (callId: string) => void
  addGuardian: (g: Omit<Guardian, 'id'>) => Guardian
  updateGuardian: (id: string, data: Partial<Guardian>) => void
  removeGuardian: (id: string) => void
  addRFID: (guardianId: string, rfidCode: string) => GuardianRFID
  removeRFID: (id: string) => void
  linkStudentGuardian: (studentId: string, guardianId: string, canPickup?: boolean) => void
  unlinkStudentGuardian: (id: string) => void
  getGuardiansForStudent: (studentId: string) => (Guardian & { canPickup: boolean })[]
  getStudentsForGuardian: (guardianId: string) => string[]
  updateConfig: (patch: Partial<SaidaConfig>) => void
  clearLog: () => void
}

const Ctx = createContext<SaidaCtx | null>(null)

export function useSaida() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSaida must be used within SaidaProvider')
  return c
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SaidaProvider({ children }: { children: React.ReactNode }) {
  const [guardians, setGuardians] = useState<Guardian[]>(() => load(LS.guardians, []))
  const [rfidMap, setRfidMap] = useState<GuardianRFID[]>(() => load(LS.rfid, []))
  const [studentGuardians, setStudentGuardians] = useState<StudentGuardian[]>(() => load(LS.studentGuardians, []))
  const getTodayStr = useCallback(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const [activeCalls, setActiveCalls] = useState<PickupCall[]>(() => {
    const list = load<PickupCall[]>(LS.calls, [])
    const d = new Date()
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return list.filter(c => {
      const cd = new Date(c.calledAt)
      const callStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`
      return callStr === todayStr
    })
  })
  const [logs, setLogs] = useState<SaidaLog[]>(() => load<SaidaLog[]>(LS.logs, []).slice(0, 500))
  const [config, setConfig] = useState<SaidaConfig>(() => ({ ...DEFAULT_CONFIG, ...load(LS.config, {}) }))

  const { emit, on } = useBroadcastRealtime()

  // Persist
  useEffect(() => { save(LS.guardians, guardians) }, [guardians])
  useEffect(() => { save(LS.rfid, rfidMap) }, [rfidMap])
  useEffect(() => { save(LS.studentGuardians, studentGuardians) }, [studentGuardians])
  useEffect(() => { save(LS.calls, activeCalls) }, [activeCalls])
  useEffect(() => { save(LS.logs, logs) }, [logs])
  useEffect(() => { save(LS.config, config) }, [config])

  // ── Zerar lista diariamente à 00:00 ────────────────────────────────────────
  useEffect(() => {
    const filterTodayOnly = () => {
      const todayStr = getTodayStr()
      setActiveCalls(prev => prev.filter(c => {
        const cd = new Date(c.calledAt)
        const callStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`
        return callStr === todayStr
      }))
    }
    const interval = setInterval(filterTodayOnly, 60000)
    return () => clearInterval(interval)
  }, [getTodayStr])

  // ── Listen for remote updates (Monitor TV) ────────────────────────────────
  useEffect(() => {
    const unsub = on('*', payload => {
      if ((payload.data as any)._remote) return  // avoid loops
      const d = payload.data as unknown as PickupCall & { callId?: string }
      if (payload.event === 'CALL_STUDENT') {
        setActiveCalls(prev => {
          if (prev.find(c => c.id === d.id)) return prev
          return [d, ...prev]
        })
      }
      if (payload.event === 'CONFIRM_PICKUP' && d.callId) {
        setActiveCalls(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'confirmed', confirmedAt: now() } : c))
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setActiveCalls(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'cancelled' } : c))
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setActiveCalls(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now() } : c))
      }
      if (payload.event === 'REVERT_CALL' && d.callId) {
        setActiveCalls(prev => prev.map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now(), confirmedAt: undefined } : c))
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
    addLog('CALL', `Chamada: ${studentName} (${studentClass}) — por ${guardianName}`)
    return call
  }, [activeCalls, emit, addLog])

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
    addLog('BLOCKED', `Acesso bloqueado (${blockType}): ${guardianName} tentou retirar ${studentName} — ${blockReason}`)
    return call
  }, [addLog])

  // ─── confirmPickup ────────────────────────────────────────────────────────
  const confirmPickup = useCallback((callId: string) => {
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'confirmed', confirmedAt: now() } : c
    ))
    const call = activeCalls.find(c => c.id === callId)
    emit('CONFIRM_PICKUP', { callId, _remote: false })
    addLog('CONFIRM', `Saída confirmada: ${call?.studentName ?? callId}`)
  }, [activeCalls, emit, addLog])

  // ─── cancelCall ───────────────────────────────────────────────────────────
  const cancelCall = useCallback((callId: string) => {
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'cancelled' } : c
    ))
    const call = activeCalls.find(c => c.id === callId)
    emit('CANCEL_CALL', { callId, _remote: false })
    addLog('CANCEL', `Chamada cancelada: ${call?.studentName ?? callId}`)
  }, [activeCalls, emit, addLog])

  // ─── recallStudent ────────────────────────────────────────────────────────
  const recallStudent = useCallback((callId: string, speakFn: (text: string) => void) => {
    const call = activeCalls.find(c => c.id === callId)
    if (!call) return
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'waiting', calledAt: now() } : c
    ))
    emit('RECALL_STUDENT', { callId, _remote: false })
    const cName = config.voiceTruncateTurma && config.voiceTruncateChar ? call.studentClass.split(config.voiceTruncateChar)[0].trim() : call.studentClass
    speakFn(`${call.studentName}, turma ${cName}`)
    addLog('RECALL', `Rechamada: ${call.studentName}`)
  }, [activeCalls, emit, addLog])

  // ─── revertCall ───────────────────────────────────────────────────────────
  const revertCall = useCallback((callId: string) => {
    const call = activeCalls.find(c => c.id === callId)
    if (!call) return
    setActiveCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, status: 'waiting', calledAt: now(), confirmedAt: undefined } : c
    ))
    emit('REVERT_CALL', { callId, _remote: false })
    addLog('REVERT', `Chamada revertida: ${call.studentName}`)
  }, [activeCalls, emit, addLog])

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
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const clearLog = useCallback(() => setLogs([]), [])

  return (
    <Ctx.Provider value={{
      guardians, rfidMap, studentGuardians, activeCalls, logs, config,
      readRFID, callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall,
      addGuardian, updateGuardian, removeGuardian,
      addRFID, removeRFID,
      linkStudentGuardian, unlinkStudentGuardian,
      getGuardiansForStudent, getStudentsForGuardian,
      updateConfig, clearLog,
    }}>
      {children}
    </Ctx.Provider>
  )
}
