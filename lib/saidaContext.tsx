'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useSupabaseArray, useSupabaseCollection, invalidateCache } from '@/lib/useSupabaseCollection'
import { supabase } from '@/lib/supabase'
import { fetchSingleStudentPhoto } from '@/lib/studentPhotoCache'

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
  blockReason?: string       // human-readable reason when status === 'blocked'
  blockType?: 'proibido' | 'dia_restrito'  // machine-readable block type
  targetTime?: string | null // Horário previsto para retirada ou "Indefinido"
  tipo?: string
  origem?: string
  dispositivoNome?: string
  horaSaida?: string
}

export function isSaiuSozinhoCall(call: any): boolean {
  if (!call) return false
  const gName = (call.guardianName || '').toLowerCase().trim()
  const gId = (call.guardianId || '').toLowerCase().trim()
  const tipo = (call.tipo || '').toLowerCase().trim()
  const origem = (call.origem || '').toLowerCase().trim()
  const source = (call.source || '').toLowerCase().trim()
  const dispNome = (call.dispositivoNome || '').toLowerCase().trim()

  // 1. Marcados como saiu sozinho
  if (
    gId === 'sozinho' ||
    gId === 'solo' ||
    tipo === 'sozinho' ||
    gName === 'saiu sozinho' ||
    gName.startsWith('saiu sozinho') ||
    gName.includes('sozinho')
  ) {
    return true
  }

  // 2. Passaram pela catraca de saída
  if (
    gId === 'catraca-saida' ||
    gId === 'catraca' ||
    origem === 'catraca_idface' ||
    origem === 'catraca' ||
    source === 'catraca' ||
    dispNome.includes('saida') ||
    dispNome.includes('catraca') ||
    gName.includes('catraca')
  ) {
    return true
  }

  return false
}

export interface SaidaLog {
  id: string
  type: string
  description: string
  userId?: string
  createdAt: string
}

export interface SchoolAnnouncement {
  id: string
  title: string
  phrase: string
  category: 'portaria' | 'intervalo' | 'comunicado' | 'veiculos' | 'emergencia' | 'geral'
  isFavorite?: boolean
  playChime?: boolean
  repeatCount?: number
  createdAt: string
  lastUsedAt?: string
  tags?: string[]
}

export interface AnnouncementHistoryItem {
  id: string
  phrase: string
  title?: string
  category?: string
  playedAt: string
  operatorName?: string
  repeatCount?: number
  withChime?: boolean
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
  specialAuthNotificationUserIds?: string[]
  specialAuthNotificationsEnabled?: boolean
  specialAuthNotifyPush?: boolean
  specialAuthNotifySound?: boolean
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
  specialAuthNotificationUserIds: [],
  specialAuthNotificationsEnabled: true,
  specialAuthNotifyPush: true,
  specialAuthNotifySound: true,
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
async function fetchStudentPhotoFromDb(studentId: string): Promise<string | null> {
  return fetchSingleStudentPhoto(studentId)
}

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
  callStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, source?: CallSource, rfidCode?: string, studentPhoto?: string | null, forceNewCall?: boolean, targetTime?: string | null) => PickupCall | null
  blockAttempt: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, rfidCode: string | undefined, blockType: 'proibido' | 'dia_restrito', blockReason: string, studentPhoto?: string | null) => PickupCall
  confirmPickup: (callId: string) => void
  cancelCall: (callId: string) => void
  recallStudent: (callId: string, speakFn: (text: string) => void) => void
  revertCall: (callId: string) => void
  deleteCall: (callId: string) => void
  addSpecialAuth: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, operatorName: string, studentPhoto?: string | null, targetTime?: string | null) => PickupCall
  confirmSpecialExit: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, studentPhoto?: string | null, targetTime?: string | null) => PickupCall
  confirmSoloExit: (studentId: string, studentName: string, studentClass: string, studentPhoto?: string | null) => PickupCall | null
  broadcastAnnouncement: (phrase: string, options?: { repeat?: number, chime?: boolean, title?: string, operatorName?: string, rate?: number, pitch?: number }) => void
  cancelAnnouncement: () => void
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

function addProcessedBroadcast(set: Set<string>, id: string) {
  set.add(id)
  if (set.size > 260) {
    let count = 0
    for (const item of set) {
      set.delete(item)
      count++
      if (count >= 100) break
    }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SaidaProvider({ children, enabled = true }: { children: React.ReactNode, enabled?: boolean }) {
  // `enabled` gates heavy data fetching (calls list, config) but Realtime channel
  // is ALWAYS active so all clients (including Família/mobile) receive live updates.
  // Polling é 0 pois o canal Realtime Supabase entrega as alterações de forma instantânea.
  const [activeCalls, setActiveCalls, { loading: isLoadingCalls, setLocal: setActiveCallsLocal }] = useSupabaseArray<PickupCall>('saida/calls', [], { enabled, mergeLocal: false, refreshIntervalMs: 0 })
  const [logs, setLogs] = useState<SaidaLog[]>([])
  const [config, setConfig, { loading: isConfigLoading }] = useSupabaseCollection<SaidaConfig>('saida/config', DEFAULT_CONFIG, { enabled })

  const { emit, on } = useBroadcastRealtime()
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'connecting' | 'offline'>('connecting')

  const setActiveCallsLocalRef = useRef(setActiveCallsLocal)
  useEffect(() => {
    setActiveCallsLocalRef.current = setActiveCallsLocal
  }, [setActiveCallsLocal])

  const getTodayStr = useCallback(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date())
  }, [])

  const isFromToday = useCallback((isoString?: string) => {
    if (!isoString) return false
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date())
      const callDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date(isoString))
      return callDateStr >= todayStr
    } catch {
      return true
    }
  }, [])

  const channelRef = useRef<any>(null)
  const processedBroadcasts = useRef<Set<string>>(new Set())

  const persistSingleCall = useCallback(async (call: PickupCall) => {
    try {
      invalidateCache('saida/calls')
      const res = await fetch('/api/saida/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(call)
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.warn('[saidaContext] Falha ao persistir chamada no banco:', res.status, errData)
      }
    } catch (e) {
      console.error('Failed to persist call', e)
    }
  }, [])

  const sendBroadcast = useCallback((event: string, data: any) => {
    const eventId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    addProcessedBroadcast(processedBroadcasts.current, eventId)

    const doSend = () => {
      if (channelRef.current && channelRef.current.state === 'joined') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'CALL_EVENT',
          payload: { event, data, eventId }
        }).catch((e: any) => {
          console.warn('Realtime send ignored:', e)
        })
        return true
      }
      return false
    }

    const sent = doSend()
    if (!sent) {
      // Se canal ainda não estava no estado 'joined', tenta enviar uma vez após 200ms
      setTimeout(doSend, 200)
    }
  }, [])

  // ── Listen to Supabase Realtime changes and Broadcast Room ──────────────────
  useEffect(() => {
    let isMounted = true
    let channel: any = null

    const setupRealtime = async () => {
      setRealtimeStatus('connecting')
      
      // Clean up any stale channel from React Strict Mode re-mounts
      const existingChannels = supabase.getChannels().filter(c => c.topic === 'realtime:saida_calls_shared_room')
      if (existingChannels.length > 0) {
        await Promise.all(existingChannels.map(c => supabase.removeChannel(c)))
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
              let rawDados = newRow.dados || {}
              if (typeof rawDados === 'string') {
                try { rawDados = JSON.parse(rawDados) } catch (e) {}
              }
              const call = { id: newRow.id, ...rawDados } as PickupCall
              const callStudentId = call.studentId ? String(call.studentId) : null
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                // special_auth entries must ALWAYS stay as special_auth — never auto-confirm them
                if (call.status === 'special_auth') {
                  const idx = arr.findIndex(c => c.id === call.id)
                  if (idx >= 0) {
                    const updated = [...arr]
                    const existingCall = updated[idx]
                    const targetTime = call.targetTime || (call as any).target_time || (call as any).dados?.targetTime || (call as any).dados?.target_time || existingCall.targetTime || undefined
                    updated[idx] = { ...existingCall, ...call, targetTime, status: 'special_auth' }
                    return updated
                  }
                  return [call, ...arr]
                }
                // Protect confirmed students from being set back to waiting/called via DB triggers/inserts unless isRevert is set
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === callStudentId && c.status !== 'special_auth') ? { ...c, status: 'confirmed' } : c)
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
              let rawDados = newRow.dados || {}
              if (typeof rawDados === 'string') {
                try { rawDados = JSON.parse(rawDados) } catch (e) {}
              }
              const call = { id: newRow.id, ...rawDados } as PickupCall
              const callStudentId = call.studentId ? String(call.studentId) : null
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                if (call.status === 'special_auth') {
                  const idx = arr.findIndex(c => c.id === call.id)
                  if (idx >= 0) {
                    const updated = [...arr]
                    const existingCall = updated[idx]
                    const targetTime = call.targetTime || (call as any).target_time || (call as any).dados?.targetTime || (call as any).dados?.target_time || existingCall.targetTime || undefined
                    updated[idx] = { ...existingCall, ...call, targetTime, status: 'special_auth' }
                    return updated
                  }
                  return [call, ...arr]
                }
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && (call.status === 'waiting' || call.status === 'called') && !(call as any).isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === callStudentId && c.status !== 'special_auth') ? { ...c, status: 'confirmed' } : c)
                }
                const idx = arr.findIndex(c => c.id === call.id)
                if (idx >= 0) {
                  return arr.map(c => c.id === call.id ? { ...c, ...call } : c)
                }
                return [call, ...arr]
              })
            } else if (eventType === 'DELETE') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).filter(c => c.id !== oldRow.id))
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
              addProcessedBroadcast(processedBroadcasts.current, eventId);
            }
            const dataStudentId = data?.studentId ? String(data.studentId) : null
            if (event === 'CALL_STUDENT') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                // special_auth entries must ALWAYS stay as special_auth — never auto-confirm them
                if (data.status === 'special_auth') {
                  const idx = arr.findIndex(c => c.id === data.id)
                  if (idx >= 0) {
                    const updated = [...arr]
                    const existingCall = updated[idx]
                    const targetTime = data.targetTime || (data as any).target_time || (data as any).dados?.targetTime || (data as any).dados?.target_time || existingCall.targetTime || undefined
                    updated[idx] = { ...existingCall, ...data, targetTime, status: 'special_auth' }
                    return updated
                  }
                  return [data, ...arr]
                }
                const isAlreadyConfirmed = dataStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === dataStudentId && c.status === 'confirmed') : false
                if (isAlreadyConfirmed && data.status !== 'confirmed' && !data.isRevert) {
                  return arr.map(c => (c.studentId != null && String(c.studentId) === dataStudentId && c.status !== 'special_auth') ? { ...c, status: 'confirmed' } : c)
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
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => ((c.id === data.callId || (dataStudentId && c.studentId != null && String(c.studentId) === dataStudentId)) && c.status !== 'special_auth') ? { ...c, status: 'confirmed', confirmedAt: data.confirmedAt } : c))
            } else if (event === 'CANCEL_CALL') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'cancelled' } : c))
            } else if (event === 'RECALL_STUDENT') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt } : c))
            } else if (event === 'REVERT_CALL') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                const dataStudentIdStr = dataStudentId
                const revertedEntry = arr.find(c => c.id === data.callId)
                return arr.map(c => {
                  if (c.status === 'special_auth' || c.status === 'cancelled') return c
                  const cId = c.studentId ? String(c.studentId) : null
                  const matchesStudent = dataStudentIdStr && cId && cId === dataStudentIdStr
                  if (!matchesStudent) return c
                  if (c.id === data.callId) return { ...c, status: 'waiting', calledAt: data.calledAt || new Date().toISOString(), confirmedAt: undefined, isRevert: true }
                  // Remove other calls for same student (dedup)
                  return null
                }).filter(Boolean) as PickupCall[]
              })
            } else if (event === 'DELETE_CALL') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).filter(c => c.id !== data.callId))
            } else if (event === 'CLEAR_ALL_CALLS') {
              setActiveCallsLocalRef.current?.([])
            } else if (event === 'ANNOUNCEMENT_VOICE') {
              emit('ANNOUNCEMENT_VOICE', data || {})
            } else if (event === 'CANCEL_ANNOUNCEMENT') {
              emit('CANCEL_ANNOUNCEMENT', data || {})
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
  }, [])

  // ── Listen for remote updates (Monitor TV / same-browser tab sync) ─────────────────
  useEffect(() => {
    const unsub = on('*', payload => {
      if ((payload.data as any)._remote) return  // avoid loops
      const d = payload.data as unknown as PickupCall & { callId?: string }
      const dStudentId = d?.studentId ? String(d.studentId) : null
      if (payload.event === 'CALL_STUDENT') {
        setActiveCallsLocal?.(prev => {
          const arr = prev || []
          if (d.status === 'special_auth') {
            const idx = arr.findIndex(c => c.id === d.id)
            if (idx >= 0) {
              const updated = [...arr]
              const existingCall = updated[idx]
              const targetTime = d.targetTime || (d as any).target_time || (d as any).dados?.targetTime || (d as any).dados?.target_time || existingCall.targetTime || undefined
              updated[idx] = { ...existingCall, ...d, targetTime, status: 'special_auth' }
              return updated
            }
            return [d, ...arr]
          }
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
        setActiveCallsLocal?.(prev => {
          const arr = prev || []
          return arr.map(c => {
            if (c.status === 'special_auth' || c.status === 'cancelled') return c
            const cId = c.studentId ? String(c.studentId) : null
            const matchesStudent = dStudentId && cId && cId === dStudentId
            if (!matchesStudent) return c
            if (c.id === d.callId) return { ...c, status: 'waiting', calledAt: d.calledAt || now(), confirmedAt: undefined, isRevert: true }
            return null // remove duplicates
          }).filter(Boolean) as typeof arr
        })
      }
      if (payload.event === 'DELETE_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).filter(c => c.id !== d.callId))
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
    forceNewCall = false, targetTime?: string | null
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
      isRevert: existingConfirmed ? true : undefined,
      targetTime: targetTime || undefined,
    }
    setActiveCallsLocal?.(prev => [call, ...(prev || [])])
    persistSingleCall(call)
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    addLog('CALL', `Chamada: ${studentName} (${studentClass}) — por ${guardianName}`)

    // Se a chamada foi feita sem foto mas temos o studentId, resolve em background
    if (!studentPhoto && sIdStr) {
      fetchStudentPhotoFromDb(sIdStr).then(photo => {
        if (photo) {
          setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === call.id ? { ...c, studentPhoto: photo } : c))
          persistSingleCall({ ...call, studentPhoto: photo })
          sendBroadcast('CALL_STUDENT', { ...call, studentPhoto: photo })
        }
      })
    }

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

    if (!studentPhoto && sIdStr) {
      fetchStudentPhotoFromDb(sIdStr).then(photo => {
        if (photo) {
          setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === call.id ? { ...c, studentPhoto: photo } : c))
          persistSingleCall({ ...call, studentPhoto: photo })
          sendBroadcast('CALL_STUDENT', { ...call, studentPhoto: photo })
        }
      })
    }

    return call
  }, [setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── confirmPickup ────────────────────────────────────────────────────────
  const confirmPickup = useCallback((callId: string) => {
    const currentNow = now()
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return

    const studentIdToConfirm = callToUpdate.studentId ? String(callToUpdate.studentId) : null
    const studentNameToConfirm = callToUpdate.studentName ? callToUpdate.studentName.trim().toLowerCase() : ''

    // Compute updated call objects BEFORE scheduling state update so persistSingleCall is guaranteed to execute
    // IMPORTANTE: Ignora registros de autorizacao especial (status: 'special_auth') para que o card permaneça no quadro Lançados Hoje
    const callsToConfirm = activeCalls.filter(c =>
      c.status !== 'special_auth' && c.status !== 'cancelled' &&
      (c.id === callId ||
       (studentIdToConfirm && c.studentId != null && String(c.studentId) === studentIdToConfirm) ||
       (studentNameToConfirm && c.studentName && c.studentName.trim().toLowerCase() === studentNameToConfirm))
    )
    const fixCall = (c: PickupCall) => {
      const conf = currentNow
      const cTime = (c.calledAt && new Date(c.calledAt).getTime() > new Date(conf).getTime()) ? conf : c.calledAt
      return { ...c, calledAt: cTime, status: 'confirmed' as const, confirmedAt: conf }
    }

    const updatedCalls: PickupCall[] = callsToConfirm.length > 0
      ? callsToConfirm.map(fixCall)
      : [fixCall(callToUpdate)]

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => {
        const cStudentId = c.studentId ? String(c.studentId) : null
        const cStudentName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        if (c.status !== 'special_auth' && c.status !== 'cancelled' &&
            (c.id === callId ||
             (studentIdToConfirm && cStudentId === studentIdToConfirm) ||
             (studentNameToConfirm && cStudentName === studentNameToConfirm))) {
          return fixCall(c)
        }
        return c
      })
    })
    
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
    const sNameNorm = callToUpdate.studentName ? callToUpdate.studentName.trim().toLowerCase() : ''

    // Reverts ALL non-special_auth calls for this student back to 'waiting'
    // and deduplicates so only ONE waiting call remains (avoiding duplicate cards)
    const revertedMain = { ...callToUpdate, status: 'waiting' as const, calledAt: currentNow, confirmedAt: undefined, isRevert: true }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      // 1. Mark all non-special_auth confirmed calls for this student as reverted
      const updated = arr.map(c => {
        if (c.status === 'special_auth' || c.status === 'cancelled') return c
        const cId = c.studentId ? String(c.studentId) : null
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        const matchesStudent = (sIdStr && cId && cId === sIdStr) || (sNameNorm && cName && cName === sNameNorm)
        if (!matchesStudent) return c
        // Keep the target call as the main reverted waiting call; remove duplicates
        if (c.id === callId) return revertedMain
        // All other confirmed/waiting/called calls for this student → remove (return null)
        return null
      }).filter(Boolean) as typeof arr
      return updated
    })

    persistSingleCall(revertedMain)
    emit('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow })
    addLog('REVERT', `Chamada revertida: ${callToUpdate.studentName}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

  // ─── deleteCall ───────────────────────────────────────────────────────────
  const deleteCall = useCallback(async (callId: string) => {
    let callName = callId;
    let targetStudentId: string | undefined = undefined;
    // Remove from local state
    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      const call = arr.find(c => c.id === callId)
      if (call) {
        callName = call.studentName
        targetStudentId = call.studentId ? String(call.studentId) : undefined
      }
      return arr.filter(c => c.id !== callId)
    })
    invalidateCache('saida/calls')
    emit('DELETE_CALL', { callId, studentId: targetStudentId, _remote: false })
    sendBroadcast('DELETE_CALL', { callId, studentId: targetStudentId })
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
    addLog('DELETE', `Autorização especial deletada: ${callName}`)
  }, [setActiveCallsLocal, emit, sendBroadcast, addLog])

  // ─── addSpecialAuth ───────────────────────────────────────────────────────
  const addSpecialAuth = useCallback((
    studentId: string, studentName: string, studentClass: string,
    authorizedPerson: string, operatorName: string, studentPhoto?: string | null,
    targetTime?: string | null
  ): PickupCall => {
    const sIdStr = studentId ? String(studentId) : ''
    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId: 'special', guardianName: authorizedPerson,
      operatorId: operatorName,
      calledAt: now(), status: 'special_auth', source: 'manual',
      targetTime: targetTime || undefined,
    }
    invalidateCache('saida/calls')
    setActiveCallsLocal?.(prev => [call, ...(prev || [])])
    persistSingleCall(call)
    emit('CALL_STUDENT', { ...call })
    sendBroadcast('CALL_STUDENT', call)
    
    // Dispara evento em tempo real para os colaboradores notificados
    const targetUserIds = config?.specialAuthNotificationUserIds || []
    emit('SPECIAL_AUTH_NOTIFY', { ...call, targetUserIds })
    sendBroadcast('SPECIAL_AUTH_NOTIFY', { ...call, targetUserIds })

    addLog('SPECIAL_AUTH', `Autorização Especial: ${studentName} liberado para ${authorizedPerson}${targetTime ? ` (${targetTime})` : ''}`)
    return call
  }, [setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, config])

  // ─── confirmSpecialExit ────────────────────────────────────────────────────
  const confirmSpecialExit = useCallback((
    studentId: string, studentName: string, studentClass: string, authorizedPerson: string, studentPhoto?: string | null,
    targetTime?: string | null
  ): PickupCall => {
    const sIdStr = studentId ? String(studentId) : ''
    const sNameNorm = studentName ? studentName.trim().toLowerCase() : ''
    const currentNow = now()

    // 1. Garantir que exista o registro de Autorização Especial (status: 'special_auth') para o aluno
    const hasSpecialAuth = activeCalls.some(c =>
      c.status === 'special_auth' &&
      ((c.studentId != null && String(c.studentId) === sIdStr) ||
       (c.studentName && sNameNorm && c.studentName.trim().toLowerCase() === sNameNorm))
    )

    let specialAuthCall: PickupCall | null = null
    if (!hasSpecialAuth) {
      specialAuthCall = {
        id: uid(),
        studentId: sIdStr,
        studentName,
        studentClass,
        studentPhoto: studentPhoto ?? null,
        guardianId: 'special',
        guardianName: authorizedPerson,
        calledAt: currentNow,
        status: 'special_auth',
        source: 'manual',
        targetTime: targetTime || undefined,
      }
    }

    // 2. Encontrar ou atualizar a chamada de saída do aluno para 'confirmed'
    const existingCall = activeCalls.find(c =>
      c.status !== 'special_auth' && c.status !== 'cancelled' &&
      ((c.studentId != null && String(c.studentId) === sIdStr) ||
       (c.studentName && sNameNorm && c.studentName.trim().toLowerCase() === sNameNorm))
    )

    let confirmedCall: PickupCall

    if (existingCall) {
      confirmedCall = {
        ...existingCall,
        guardianName: authorizedPerson || existingCall.guardianName,
        status: 'confirmed',
        confirmedAt: currentNow
      }
    } else {
      confirmedCall = {
        id: uid(),
        studentId: sIdStr,
        studentName,
        studentClass,
        studentPhoto: studentPhoto ?? null,
        guardianId: 'special-auth',
        guardianName: authorizedPerson,
        calledAt: currentNow,
        confirmedAt: currentNow,
        status: 'confirmed',
        source: 'manual'
      }
    }

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      let next = arr.map(c => {
        if (c.status !== 'special_auth' && c.status !== 'cancelled' &&
            ((c.studentId != null && String(c.studentId) === sIdStr) ||
             (c.studentName && sNameNorm && c.studentName.trim().toLowerCase() === sNameNorm))) {
          return { ...c, status: 'confirmed' as const, confirmedAt: currentNow }
        }
        return c
      })
      const existsConfirmed = next.some(c => c.id === confirmedCall.id)
      if (!existsConfirmed) {
        next = [confirmedCall, ...next]
      }
      if (specialAuthCall) {
        const existsSpecial = next.some(c => c.id === specialAuthCall!.id)
        if (!existsSpecial) {
          next = [specialAuthCall, ...next]
        }
      }
      return next
    })

    if (specialAuthCall) persistSingleCall(specialAuthCall)
    persistSingleCall(confirmedCall)

    emit('CONFIRM_PICKUP', { callId: confirmedCall.id, studentId: sIdStr, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: confirmedCall.id, studentId: sIdStr, confirmedAt: currentNow })
    addLog('CONFIRM', `Saída confirmada (Autorização Especial): ${studentName}`)

    return confirmedCall
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall])

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
        tipo: 'sozinho',
        origem: 'manual',
        confirmedAt: currentNow
      }))
      const primaryUpdated = updatedCalls.find(c => c.id === existingWaiting.id) || updatedCalls[0]

      setActiveCallsLocal?.(prev => (prev || []).map(c => (c.studentId != null && String(c.studentId) === sIdStr && c.status !== 'cancelled' && c.status !== 'special_auth') ? { ...c, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', status: 'confirmed', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow } : c))
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
      tipo: 'sozinho',
      origem: 'manual',
      source: 'manual',
    }

    setActiveCallsLocal?.(prev => [newCall, ...(prev || [])])
    persistSingleCall(newCall)
    emit('CALL_STUDENT', { ...newCall })
    sendBroadcast('CALL_STUDENT', newCall)
    emit('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, confirmedAt: currentNow })

    if (!studentPhoto && sIdStr) {
      fetchStudentPhotoFromDb(sIdStr).then(photo => {
        if (photo) {
          setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === newCall.id ? { ...c, studentPhoto: photo } : c))
          persistSingleCall({ ...newCall, studentPhoto: photo })
          sendBroadcast('CALL_STUDENT', { ...newCall, studentPhoto: photo })
        }
      })
    }
    addLog('CONFIRM', `Saída confirmada (Saiu Sozinho): ${studentName}`)
    return newCall
  }, [activeCalls, setActiveCallsLocal, emit, sendBroadcast, persistSingleCall, addLog])

  // ─── Config ───────────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<SaidaConfig>) => {
    return setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const clearLog = useCallback(() => setLogs([]), [])

  const clearCalls = useCallback(async () => {
    setActiveCalls([])
    emit('CLEAR_ALL_CALLS', { _remote: false })
    sendBroadcast('CLEAR_ALL_CALLS', {})
    addLog('CLEAR_CALLS', `Todas as chamadas foram zeradas.`)

    try {
      await fetch('/api/saida/calls', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearToday: true }),
      })
      invalidateCache('saida/calls')
    } catch (err) {
      console.error('[saidaContext] Erro ao zerar chamadas no DB:', err)
    }
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
      const res = await fetch(`/api/saida/calls?date=${getTodayStr()}&_t=${Date.now()}`, {
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

  const broadcastAnnouncement = useCallback((phrase: string, options?: { repeat?: number, chime?: boolean, title?: string, operatorName?: string, rate?: number, pitch?: number }) => {
    if (!phrase || !phrase.trim()) return
    const payloadData = {
      phrase: phrase.trim(),
      repeatCount: options?.repeat ?? 0,
      chime: options?.chime ?? true,
      title: options?.title || '',
      operatorName: options?.operatorName || 'Portaria',
      rate: options?.rate ?? config?.voiceRate ?? 0.9,
      pitch: options?.pitch ?? config?.voicePitch ?? 1.0,
      sentAt: new Date().toISOString(),
    }
    // 1. Send to Supabase network shared room
    sendBroadcast('ANNOUNCEMENT_VOICE', payloadData)
    // 2. Send to local broadcast channel
    emit('ANNOUNCEMENT_VOICE', payloadData)
  }, [sendBroadcast, emit, config])

  const cancelAnnouncement = useCallback(() => {
    sendBroadcast('CANCEL_ANNOUNCEMENT', {})
    emit('CANCEL_ANNOUNCEMENT', {})
  }, [sendBroadcast, emit])

  const filteredActiveCalls = useMemo(() => {
    return (activeCalls || []).filter(c => isFromToday(c.calledAt))
  }, [activeCalls, isFromToday])

  return (
    <Ctx.Provider value={{
      guardians: [], rfidMap: [], studentGuardians: [], activeCalls: filteredActiveCalls, logs,
      config,
      isConfigLoading,
      realtimeStatus, isLoadingCalls,
      callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall, deleteCall, addSpecialAuth, confirmSpecialExit, confirmSoloExit,
      broadcastAnnouncement, cancelAnnouncement,
      updateConfig, clearLog, clearCalls, refreshCalls,
    }}>
      {children}
    </Ctx.Provider>
  )
}
