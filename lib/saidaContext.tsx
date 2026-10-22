'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useSupabaseArray, useSupabaseCollection, invalidateCache } from '@/lib/useSupabaseCollection'
import { supabase } from '@/lib/supabase'
import { fetchSingleStudentPhoto } from '@/lib/studentPhotoCache'
import { apiFetch } from '@/lib/api/apiClient'

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
  validDays?: number         // Quantidade de dias de validade da autorização especial (padrão: 1)
  validFrom?: string         // Data inicial YYYY-MM-DD (America/Campo_Grande)
  validUntil?: string        // Data final YYYY-MM-DD inclusiva (America/Campo_Grande)
  confirmedDates?: Record<string, string> // Mapa YYYY-MM-DD -> ISO timestamp de confirmação diária
  confirmedOut?: boolean     // Indicador de saída confirmada na data de referência
  tipo?: string
  origem?: string
  dispositivoNome?: string
  horaSaida?: string
}

// ─── Date & Multi-Day Validity Helpers (America/Campo_Grande) ─────────────────
export function getCampoGrandeDateStr(dateInput?: Date | string | number | null): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Campo_Grande',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  if (!dateInput) return formatter.format(new Date())
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const safeIso =
      trimmed.includes('T') && !trimmed.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(trimmed)
        ? `${trimmed}-04:00`
        : trimmed
    const d = new Date(safeIso)
    if (!isNaN(d.getTime())) return formatter.format(d)
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    return formatter.format(new Date())
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return formatter.format(new Date())
  return formatter.format(d)
}

export function addCalendarDays(ymd: string, daysToAdd: number): string {
  const parts = String(ymd || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return getCampoGrandeDateStr()
  }
  const [year, month, day] = parts
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(daysToAdd))
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diffCalendarDays(fromYmd: string, toYmd: string): number {
  const p1 = String(fromYmd || '').split('-').map(Number)
  const p2 = String(toYmd || '').split('-').map(Number)
  if (p1.length !== 3 || p2.length !== 3 || p1.some(isNaN) || p2.some(isNaN)) return 0
  const utc1 = Date.UTC(p1[0], p1[1] - 1, p1[2], 12, 0, 0)
  const utc2 = Date.UTC(p2[0], p2[1] - 1, p2[2], 12, 0, 0)
  return Math.round((utc2 - utc1) / 86400000)
}

export function formatShortDateBR(ymd?: string | null): string {
  if (!ymd) return ''
  const parts = String(ymd).slice(0, 10).split('-')
  if (parts.length !== 3) return String(ymd)
  return `${parts[2]}/${parts[1]}`
}

export function resolveSpecialAuthValidity(call: any, referenceTodayYmd?: string) {
  const todayYmd = referenceTodayYmd || getCampoGrandeDateStr()
  const rawDays = Number(call?.validDays ?? call?.valid_days ?? call?.dados?.validDays ?? call?.dados?.valid_days ?? 1)
  const validDays = Number.isFinite(rawDays) && rawDays >= 1 ? Math.min(365, Math.trunc(rawDays)) : 1

  const rawFrom = call?.validFrom || call?.valid_from || call?.dados?.validFrom || call?.dados?.valid_from
  const validFrom = (typeof rawFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom.trim()))
    ? rawFrom.trim()
    : getCampoGrandeDateStr(call?.calledAt)

  const rawUntil = call?.validUntil || call?.valid_until || call?.dados?.validUntil || call?.dados?.valid_until
  const validUntil = (typeof rawUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawUntil.trim()))
    ? rawUntil.trim()
    : addCalendarDays(validFrom, validDays - 1)

  const totalDays = Math.max(1, diffCalendarDays(validFrom, validUntil) + 1)
  const currentDayNumber = Math.min(totalDays, Math.max(1, diffCalendarDays(validFrom, todayYmd) + 1))
  const remainingDays = Math.max(0, diffCalendarDays(todayYmd, validUntil) + 1)
  const isActiveToday = todayYmd >= validFrom && todayYmd <= validUntil

  const rawConfirmedDates = call?.confirmedDates || call?.dados?.confirmedDates
  const confirmedDates: Record<string, string> =
    rawConfirmedDates && typeof rawConfirmedDates === 'object' && !Array.isArray(rawConfirmedDates)
      ? { ...rawConfirmedDates }
      : {}

  if (call?.confirmedOut && call?.confirmedAt) {
    const legDate = getCampoGrandeDateStr(call.confirmedAt)
    if (legDate && !confirmedDates[legDate]) {
      confirmedDates[legDate] = call.confirmedAt
    }
  }

  const confirmedAtToday = confirmedDates[todayYmd] || undefined
  const isConfirmedToday = Boolean(confirmedAtToday)

  return {
    validDays: totalDays,
    validFrom,
    validUntil,
    currentDayNumber,
    dayIndex: currentDayNumber,
    remainingDays,
    isActiveToday,
    confirmedDates,
    isConfirmedToday,
    confirmedAtToday,
  }
}

export function isSaiuSozinhoCall(call: any): boolean {
  if (!call) return false
  const raw = call.dados && typeof call.dados === 'object' ? { ...call.dados, ...call } : call
  const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const gName = stripAccents(String(raw.guardianName || '').toLowerCase().trim())
  const gId = stripAccents(String(raw.guardianId || '').toLowerCase().trim())
  const tipo = stripAccents(String(raw.tipo || '').toLowerCase().trim())
  const origem = stripAccents(String(raw.origem || '').toLowerCase().trim())
  const source = stripAccents(String(raw.source || '').toLowerCase().trim())
  const dispNome = stripAccents(String(raw.dispositivoNome || '').toLowerCase().trim())

  // 1. Marcados como saiu sozinho
  if (
    gId === 'sozinho' ||
    gId === 'solo' ||
    gId === 'saida-sozinho' ||
    tipo === 'sozinho' ||
    tipo === 'saida_sozinho' ||
    tipo === 'solo' ||
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
  addSpecialAuth: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, operatorName: string, studentPhoto?: string | null, targetTime?: string | null, validDays?: number) => PickupCall
  confirmSpecialExit: (studentId: string, studentName: string, studentClass: string, authorizedPerson: string, studentPhoto?: string | null, targetTime?: string | null) => PickupCall
  confirmSoloExit: (studentId: string, studentName: string, studentClass: string, studentPhoto?: string | null) => PickupCall | null
  broadcastAnnouncement: (phrase: string, options?: { repeat?: number, chime?: boolean, title?: string, operatorName?: string, rate?: number, pitch?: number }) => void
  cancelAnnouncement: () => void
  updateConfig: (patch: Partial<SaidaConfig>) => Promise<void>
  clearLog: () => void
  clearCalls: () => void
  refreshCalls: () => Promise<void>
  ensureRealtimeConnected: () => void
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
  const existingCtx = useContext(Ctx)
  // Se já existe um SaidaProvider ancestral montado (ex: layout.tsx + page.tsx),
  // reutiliza o contexto pai evitando canais Realtime e fetches duplicados.
  if (existingCtx) {
    return <>{children}</>
  }
  return <SaidaProviderInner enabled={enabled}>{children}</SaidaProviderInner>
}

function SaidaProviderInner({ children, enabled = true }: { children: React.ReactNode, enabled?: boolean }) {
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

  const emitRef = useRef(emit)
  useEffect(() => {
    emitRef.current = emit
  }, [emit])

  const getTodayStr = useCallback(() => {
    return getCampoGrandeDateStr()
  }, [])

  const [currentTodayStr, setCurrentTodayStr] = useState<string>(() => getCampoGrandeDateStr())

  const isFromToday = useCallback((isoString?: string) => {
    if (!isoString) return false
    try {
      const todayStr = getCampoGrandeDateStr()
      return getCampoGrandeDateStr(isoString) === todayStr
    } catch {
      return true
    }
  }, [])

  const isFromTodayRef = useRef(isFromToday)
  useEffect(() => {
    isFromTodayRef.current = isFromToday
  }, [isFromToday])

  const channelRef = useRef<any>(null)
  const processedBroadcasts = useRef<Set<string>>(new Set())
  const reconnectRealtimeRef = useRef<(() => void) | null>(null)
  const refreshCallsRef = useRef<(() => Promise<void>) | null>(null)
  const pendingBroadcastsRef = useRef<Array<{ event: string; data: any; eventId: string; queuedAt: number }>>([])

  const ensureRealtimeConnected = useCallback(() => {
    const ch = channelRef.current
    if (!ch || ch.state !== 'joined') {
      reconnectRealtimeRef.current?.()
    }
  }, [])

  const persistSingleCall = useCallback(async (call: PickupCall) => {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        invalidateCache('saida/calls')
        const res = await apiFetch('/api/saida/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(call)
        })
        if (res.ok) {
          // Se o HTTP funcionou, temos rede ativa: aproveita para curar o canal Realtime se estiver caído
          if (!channelRef.current || channelRef.current.state !== 'joined') {
            reconnectRealtimeRef.current?.()
          }
          return
        }
        const errData = await res.json().catch(() => ({}))
        console.warn(`[saidaContext] Falha ao persistir chamada no banco (tentativa ${attempt}/${maxAttempts}):`, res.status, errData)
        if (attempt < maxAttempts && [408, 429, 500, 502, 503, 504].includes(res.status)) {
          await new Promise(r => setTimeout(r, 1200 * attempt))
          continue
        }
        return
      } catch (e) {
        console.warn(`[saidaContext] Oscilação de rede ao salvar chamada (tentativa ${attempt}/${maxAttempts}):`, e)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500 * attempt))
          continue
        }
        console.error('Failed to persist call after retries', e)
      }
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
      // Enfileira o evento para ser disparado assim que o canal reconectar (janela de 25s)
      const nowMs = Date.now()
      pendingBroadcastsRef.current = [
        ...pendingBroadcastsRef.current.filter(item => nowMs - item.queuedAt < 25000).slice(-19),
        { event, data, eventId, queuedAt: nowMs }
      ]
      // Aciona reconexão imediata do canal Realtime se não estiver conectado
      reconnectRealtimeRef.current?.()
      setTimeout(doSend, 300)
    }
  }, [])

  // ── Listen to Supabase Realtime changes and Broadcast Room ──────────────────
  useEffect(() => {
    let isMounted = true
    let channel: any = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let connectingWatchdogTimer: ReturnType<typeof setTimeout> | null = null
    let retryCount = 0
    let wasDisconnected = false
    let lastReconnectAttemptAt = 0

    const clearTimers = () => {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      if (connectingWatchdogTimer) {
        clearTimeout(connectingWatchdogTimer)
        connectingWatchdogTimer = null
      }
    }

    const destroyChannelCleanly = (ch: any) => {
      if (!ch) return
      try {
        const wasJoined = ch.state === 'joined'
        if (typeof ch.teardown === 'function') {
          ch.teardown()
        }
        const rt = (supabase as any)?.realtime
        if (rt && Array.isArray(rt.channels)) {
          rt.channels = rt.channels.filter((item: any) => item !== ch && item?.topic !== ch?.topic)
        }
        if (wasJoined) {
          supabase.removeChannel(ch).catch(() => {})
        }
      } catch (_) {}
    }

    const scheduleReconnect = () => {
      if (!isMounted || retryTimer) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      retryCount += 1
      const backoffMs = Math.min(5000 * Math.pow(1.4, retryCount - 1), 25000)
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (!isMounted) return
        if (!channel || channel.state !== 'joined') {
          setupRealtime()
        }
      }, backoffMs)
    }

    const setupRealtime = async () => {
      if (!isMounted) return
      clearTimers()
      lastReconnectAttemptAt = Date.now()
      setRealtimeStatus('connecting')

      if (channel) {
        const prevCh = channel
        channel = null
        destroyChannelCleanly(prevCh)
      }
      
      // Clean up any stale channel from React Strict Mode / HMR re-mounts synchronously
      try {
        for (const existing of supabase.getChannels()) {
          if (existing?.topic === 'realtime:saida_calls_shared_room') {
            destroyChannelCleanly(existing)
          }
        }
      } catch (_) {}

      if (!isMounted) return

      // Use a stable, shared channel room for network-wide broadcasts
      const currentChannel = supabase.channel('saida_calls_shared_room')
      channel = currentChannel
      channelRef.current = currentChannel

      // Watchdog: se ficar preso em 'connecting' por mais de 14s, força recriação limpa
      connectingWatchdogTimer = setTimeout(() => {
        connectingWatchdogTimer = null
        if (!isMounted || channel !== currentChannel) return
        if (currentChannel.state !== 'joined') {
          wasDisconnected = true
          setRealtimeStatus('offline')
          scheduleReconnect()
        }
      }, 14000)

      currentChannel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'saida_calls' },
          (payload: any) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('saida_calls:postgres_change', { detail: payload }))
            }
            const { eventType, new: newRow, old: oldRow } = payload
            
            if (eventType === 'INSERT') {
              let rawDados = newRow.dados || {}
              if (typeof rawDados === 'string') {
                try { rawDados = JSON.parse(rawDados) } catch (e) {}
              }
              const call = { id: newRow.id, ...rawDados } as PickupCall
              if (call.status === 'special_auth') {
                const calledAtMs = call.calledAt ? new Date(call.calledAt).getTime() : Date.now()
                if (!isNaN(calledAtMs) && Math.abs(Date.now() - calledAtMs) < 30000) {
                  emitRef.current('SPECIAL_AUTH_NOTIFY', { ...call })
                }
              }
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
                    const validDays = call.validDays || (call as any).dados?.validDays || existingCall.validDays || undefined
                    const validFrom = call.validFrom || (call as any).dados?.validFrom || existingCall.validFrom || undefined
                    const validUntil = call.validUntil || (call as any).dados?.validUntil || existingCall.validUntil || undefined
                    const confirmedDates = { ...(existingCall.confirmedDates || {}), ...((call as any).dados?.confirmedDates || {}), ...(call.confirmedDates || {}) }
                    updated[idx] = { ...existingCall, ...call, targetTime, validDays, validFrom, validUntil, confirmedDates, status: 'special_auth' }
                    return updated
                  }
                  return [call, ...arr]
                }
                // Se a nova chamada já chega confirmada (ex: catraca de saída ou saiu sozinho), confirma também chamadas anteriores em aberto do mesmo aluno hoje
                if (call.status === 'confirmed' && callStudentId && isFromTodayRef.current(call.confirmedAt || call.calledAt)) {
                  const confirmIso = call.confirmedAt || call.calledAt
                  const todayKey = getCampoGrandeDateStr(confirmIso)
                  const synced = arr.map(c => {
                    if (c.studentId == null || String(c.studentId) !== callStudentId) return c
                    if (c.status === 'special_auth') {
                      return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: confirmIso } }
                    }
                    if ((c.status === 'waiting' || c.status === 'called') && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
                      return { ...c, status: 'confirmed' as const, confirmedAt: c.confirmedAt || confirmIso }
                    }
                    return c
                  })
                  const idx = synced.findIndex(c => c.id === call.id)
                  if (idx >= 0) {
                    const updated = [...synced]
                    updated[idx] = { ...updated[idx], ...call }
                    return updated
                  }
                  return [call, ...synced]
                }
                // Protect confirmed students from being set back to waiting/called via DB triggers/inserts unless isRevert is set
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed' && isFromTodayRef.current(c.confirmedAt || c.calledAt)) : false
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
                    const validDays = call.validDays || (call as any).dados?.validDays || existingCall.validDays || undefined
                    const validFrom = call.validFrom || (call as any).dados?.validFrom || existingCall.validFrom || undefined
                    const validUntil = call.validUntil || (call as any).dados?.validUntil || existingCall.validUntil || undefined
                    const confirmedDates = { ...(existingCall.confirmedDates || {}), ...((call as any).dados?.confirmedDates || {}), ...(call.confirmedDates || {}) }
                    updated[idx] = { ...existingCall, ...call, targetTime, validDays, validFrom, validUntil, confirmedDates, status: 'special_auth' }
                    return updated
                  }
                  return [call, ...arr]
                }
                if (call.status === 'confirmed' && callStudentId && isFromTodayRef.current(call.confirmedAt || call.calledAt)) {
                  const confirmIso = call.confirmedAt || call.calledAt
                  const todayKey = getCampoGrandeDateStr(confirmIso)
                  const synced = arr.map(c => {
                    if (c.studentId == null || String(c.studentId) !== callStudentId) return c
                    if (c.status === 'special_auth') {
                      return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: confirmIso } }
                    }
                    if ((c.status === 'waiting' || c.status === 'called') && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
                      return { ...c, status: 'confirmed' as const, confirmedAt: c.confirmedAt || confirmIso }
                    }
                    return c
                  })
                  const idx = synced.findIndex(c => c.id === call.id)
                  if (idx >= 0) {
                    return synced.map(c => c.id === call.id ? { ...c, ...call } : c)
                  }
                  return [call, ...synced]
                }
                const isAlreadyConfirmed = callStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === callStudentId && c.status === 'confirmed' && isFromTodayRef.current(c.confirmedAt || c.calledAt)) : false
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
          { event: 'SPECIAL_AUTH_NOTIFY' },
          (payload: any) => {
            const d = payload?.payload?.data || payload?.data || payload?.payload
            if (d) {
              emitRef.current('SPECIAL_AUTH_NOTIFY', d)
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
            if (event === 'SPECIAL_AUTH_NOTIFY') {
              emitRef.current('SPECIAL_AUTH_NOTIFY', data || {})
            } else if (event === 'CALL_STUDENT') {
              if (data?.status === 'special_auth') {
                emitRef.current('SPECIAL_AUTH_NOTIFY', data)
              }
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                // special_auth entries must ALWAYS stay as special_auth — never auto-confirm them
                if (data.status === 'special_auth') {
                  const idx = arr.findIndex(c => c.id === data.id)
                  if (idx >= 0) {
                    const updated = [...arr]
                    const existingCall = updated[idx]
                    const targetTime = data.targetTime || (data as any).target_time || (data as any).dados?.targetTime || (data as any).dados?.target_time || existingCall.targetTime || undefined
                    const validDays = data.validDays || (data as any).dados?.validDays || existingCall.validDays || undefined
                    const validFrom = data.validFrom || (data as any).dados?.validFrom || existingCall.validFrom || undefined
                    const validUntil = data.validUntil || (data as any).dados?.validUntil || existingCall.validUntil || undefined
                    const confirmedDates = { ...(existingCall.confirmedDates || {}), ...((data as any).dados?.confirmedDates || {}), ...(data.confirmedDates || {}) }
                    updated[idx] = { ...existingCall, ...data, targetTime, validDays, validFrom, validUntil, confirmedDates, status: 'special_auth' }
                    return updated
                  }
                  return [data, ...arr]
                }
                if (data.status === 'confirmed' && dataStudentId && isFromTodayRef.current(data.confirmedAt || data.calledAt)) {
                  const confirmIso = data.confirmedAt || data.calledAt
                  const todayKey = getCampoGrandeDateStr(confirmIso)
                  const synced = arr.map(c => {
                    if (c.studentId == null || String(c.studentId) !== dataStudentId) return c
                    if (c.status === 'special_auth') {
                      return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: confirmIso } }
                    }
                    if ((c.status === 'waiting' || c.status === 'called') && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
                      return { ...c, status: 'confirmed' as const, confirmedAt: c.confirmedAt || confirmIso }
                    }
                    return c
                  })
                  const idx = synced.findIndex(c => c.id === data.id)
                  if (idx >= 0) {
                    const updated = [...synced]
                    updated[idx] = { ...updated[idx], ...data }
                    return updated
                  }
                  return [data, ...synced]
                }
                const isAlreadyConfirmed = dataStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === dataStudentId && c.status === 'confirmed' && isFromTodayRef.current(c.confirmedAt || c.calledAt)) : false
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
              const todayKey = getCampoGrandeDateStr(data?.confirmedAt)
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => {
                if (c.status === 'special_auth') {
                  if (dataStudentId && c.studentId != null && String(c.studentId) === dataStudentId) {
                    return {
                      ...c,
                      confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: data.confirmedAt || new Date().toISOString() }
                    }
                  }
                  return c
                }
                if ((c.id === data.callId || (dataStudentId && c.studentId != null && String(c.studentId) === dataStudentId)) && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
                  return {
                    ...c,
                    ...(data.guardianId ? { guardianId: data.guardianId } : {}),
                    ...(data.guardianName ? { guardianName: data.guardianName } : {}),
                    ...(data.tipo ? { tipo: data.tipo } : {}),
                    ...(data.origem ? { origem: data.origem } : {}),
                    status: 'confirmed',
                    confirmedAt: data.confirmedAt
                  }
                }
                return c
              }))
            } else if (event === 'CANCEL_CALL') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'cancelled' } : c))
            } else if (event === 'RECALL_STUDENT') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).map(c => c.id === data.callId ? { ...c, status: 'waiting', calledAt: data.calledAt } : c))
            } else if (event === 'REVERT_CALL') {
              const todayKey = getCampoGrandeDateStr()
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => {
                const arr = prev || []
                const dataStudentIdStr = dataStudentId
                return arr.map(c => {
                  const cId = c.studentId ? String(c.studentId) : null
                  const matchesStudent = dataStudentIdStr && cId && cId === dataStudentIdStr
                  if (c.status === 'special_auth') {
                    if (matchesStudent && c.confirmedDates?.[todayKey]) {
                      const nextDates = { ...c.confirmedDates }
                      delete nextDates[todayKey]
                      return { ...c, confirmedDates: nextDates }
                    }
                    return c
                  }
                  if (c.status === 'cancelled') return c
                  if (!matchesStudent) return c
                  if (c.id === data.callId) return { ...c, status: 'waiting', calledAt: data.calledAt || new Date().toISOString(), confirmedAt: undefined, isRevert: true }
                  // Remove other calls for same student (dedup)
                  return null
                }).filter(Boolean) as PickupCall[]
              })
            } else if (event === 'DELETE_CALL') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).filter(c => c.id !== data.callId))
            } else if (event === 'CLEAR_ALL_CALLS') {
              setActiveCallsLocalRef.current?.((prev: PickupCall[]) => (prev || []).filter(c => c.status === 'special_auth' && resolveSpecialAuthValidity(c).isActiveToday))
            } else if (event === 'ANNOUNCEMENT_VOICE') {
              emit('ANNOUNCEMENT_VOICE', data || {})
            } else if (event === 'CANCEL_ANNOUNCEMENT') {
              emit('CANCEL_ANNOUNCEMENT', data || {})
            }
          }
        )
        .subscribe((status: string) => {
          if (!isMounted || channel !== currentChannel) return
          if (status === 'SUBSCRIBED') {
            clearTimers()
            const shouldSyncAfterReconnect = wasDisconnected || retryCount > 0
            retryCount = 0
            wasDisconnected = false
            setRealtimeStatus('online')

            // Descarrega broadcasts pendentes enfileirados durante reconexão (ex: leitura de Tag RFID)
            if (pendingBroadcastsRef.current.length > 0) {
              const nowMs = Date.now()
              const toFlush = pendingBroadcastsRef.current.filter(item => nowMs - item.queuedAt < 25000)
              pendingBroadcastsRef.current = []
              toFlush.forEach(item => {
                currentChannel.send({
                  type: 'broadcast',
                  event: 'CALL_EVENT',
                  payload: { event: item.event, data: item.data, eventId: item.eventId }
                }).catch(() => {})
              })
            }

            if (shouldSyncAfterReconnect) {
              refreshCallsRef.current?.()
            }
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimers()
            wasDisconnected = true
            setRealtimeStatus('offline')
            scheduleReconnect()
          } else {
            setRealtimeStatus('connecting')
          }
        })
    }

    reconnectRealtimeRef.current = () => {
      if (!isMounted) return
      const nowMs = Date.now()
      // Throttle de 2.5s para evitar tempestade de reconexões simultâneas
      if (nowMs - lastReconnectAttemptAt < 2500) return
      const isHealthy = channel && (channel.state === 'joined' || channel.state === 'joining')
      if (!isHealthy) {
        retryCount = 0
        setupRealtime()
      }
    }

    const handleNetworkOrFocusRecovery = () => {
      if (!isMounted) return
      const isHealthy = channel && channel.state === 'joined'
      if (!isHealthy) {
        retryCount = 0
        wasDisconnected = true
        setupRealtime()
      } else {
        refreshCallsRef.current?.()
      }
    }

    const handleVisibilityRecovery = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleNetworkOrFocusRecovery()
      }
    }

    setupRealtime()

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleNetworkOrFocusRecovery)
      window.addEventListener('focus', handleNetworkOrFocusRecovery)
      window.addEventListener('edu:network-reconnected', handleNetworkOrFocusRecovery)
      window.addEventListener('edu:auth-recovered', handleNetworkOrFocusRecovery)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityRecovery)
    }

    return () => {
      isMounted = false
      reconnectRealtimeRef.current = null
      clearTimers()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleNetworkOrFocusRecovery)
        window.removeEventListener('focus', handleNetworkOrFocusRecovery)
        window.removeEventListener('edu:network-reconnected', handleNetworkOrFocusRecovery)
        window.removeEventListener('edu:auth-recovered', handleNetworkOrFocusRecovery)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityRecovery)
      }
      if (channel) {
        destroyChannelCleanly(channel)
        channel = null
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
              const validDays = d.validDays || (d as any).dados?.validDays || existingCall.validDays || undefined
              const validFrom = d.validFrom || (d as any).dados?.validFrom || existingCall.validFrom || undefined
              const validUntil = d.validUntil || (d as any).dados?.validUntil || existingCall.validUntil || undefined
              const confirmedDates = { ...(existingCall.confirmedDates || {}), ...((d as any).dados?.confirmedDates || {}), ...(d.confirmedDates || {}) }
              updated[idx] = { ...existingCall, ...d, targetTime, validDays, validFrom, validUntil, confirmedDates, status: 'special_auth' }
              return updated
            }
            return [d, ...arr]
          }
          if (d.status === 'confirmed' && dStudentId && isFromTodayRef.current(d.confirmedAt || d.calledAt)) {
            const confirmIso = d.confirmedAt || d.calledAt
            const todayKey = getCampoGrandeDateStr(confirmIso)
            const synced = arr.map(c => {
              if (c.studentId == null || String(c.studentId) !== dStudentId) return c
              if (c.status === 'special_auth') {
                return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: confirmIso } }
              }
              if ((c.status === 'waiting' || c.status === 'called') && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
                return { ...c, status: 'confirmed' as const, confirmedAt: c.confirmedAt || confirmIso }
              }
              return c
            })
            if (synced.find(c => c.id === d.id)) return synced
            return [d, ...synced]
          }
          const isAlreadyConfirmed = dStudentId ? arr.some(c => c.studentId != null && String(c.studentId) === dStudentId && c.status === 'confirmed' && isFromTodayRef.current(c.confirmedAt || c.calledAt)) : false
          if (isAlreadyConfirmed && d.status !== 'confirmed' && !(d as any).isRevert) {
            return arr.map(c => (c.studentId != null && String(c.studentId) === dStudentId && c.status !== 'special_auth') ? { ...c, status: 'confirmed' } : c)
          }
          if (arr.find(c => c.id === d.id)) return arr
          return [d, ...arr]
        })

      }
      if (payload.event === 'CONFIRM_PICKUP' && (d.callId || dStudentId)) {
        const confirmIso = d.confirmedAt || now()
        const todayKey = getCampoGrandeDateStr(confirmIso)
        setActiveCallsLocal?.(prev => (prev || []).map(c => {
          if (c.status === 'special_auth') {
            if (dStudentId && c.studentId != null && String(c.studentId) === dStudentId) {
              return {
                ...c,
                confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: confirmIso }
              }
            }
            return c
          }
          if ((c.id === d.callId || (dStudentId && c.studentId != null && String(c.studentId) === dStudentId)) && isFromTodayRef.current(c.confirmedAt || c.calledAt)) {
            return {
              ...c,
              ...(d.guardianId ? { guardianId: d.guardianId } : {}),
              ...(d.guardianName ? { guardianName: d.guardianName } : {}),
              ...(d.tipo ? { tipo: d.tipo } : {}),
              ...(d.origem ? { origem: d.origem } : {}),
              status: 'confirmed',
              confirmedAt: confirmIso
            }
          }
          return c
        }))
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'cancelled' } : c))
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setActiveCallsLocal?.(prev => (prev || []).map(c => c.id === d.callId ? { ...c, status: 'waiting', calledAt: now() } : c))
      }
      if (payload.event === 'REVERT_CALL' && d.callId) {
        const todayKey = getCampoGrandeDateStr()
        setActiveCallsLocal?.(prev => {
          const arr = prev || []
          return arr.map(c => {
            const cId = c.studentId ? String(c.studentId) : null
            const matchesStudent = dStudentId && cId && cId === dStudentId
            if (c.status === 'special_auth') {
              if (matchesStudent && c.confirmedDates?.[todayKey]) {
                const nextDates = { ...c.confirmedDates }
                delete nextDates[todayKey]
                return { ...c, confirmedDates: nextDates }
              }
              return c
            }
            if (c.status === 'cancelled') return c
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
        setActiveCallsLocal?.(prev => (prev || []).filter(c => c.status === 'special_auth' && resolveSpecialAuthValidity(c).isActiveToday))
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
    
    // Check for existing active call (waiting or called) today
    const existingActive = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr &&
      (c.status === 'waiting' || c.status === 'called') &&
      isFromToday(c.calledAt)
    )
    if (existingActive) {
      return existingActive
    }

    // Check for existing confirmed call today
    const existingConfirmed = activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sIdStr && c.status === 'confirmed' &&
      isFromToday(c.confirmedAt || c.calledAt)
    )

    // Se o aluno já foi confirmado hoje, mas for uma autorização especial ou força nova chamada,
    // permite criar a nova chamada ativa com status 'waiting'
    if (existingConfirmed && !forceNewCall && guardianId !== 'special-auth') {
      console.warn(`[SaidaContext] Call blocked: student ${studentName} already confirmed departure today.`)
      return null
    }

    const currentNow = now()
    const isSoloCall = isSaiuSozinhoCall({ guardianId, guardianName })
    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId: isSoloCall ? 'sozinho' : guardianId,
      guardianName: isSoloCall ? 'Saiu Sozinho' : guardianName,
      rfidCode,
      calledAt: currentNow,
      confirmedAt: isSoloCall ? currentNow : undefined,
      status: isSoloCall ? 'confirmed' : 'waiting',
      tipo: isSoloCall ? 'sozinho' : undefined,
      origem: isSoloCall ? 'manual' : undefined,
      source,
      isRevert: existingConfirmed && !isSoloCall ? true : undefined,
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
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, isFromToday])

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
    const todayKey = getCampoGrandeDateStr(currentNow)
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return

    const studentIdToConfirm = callToUpdate.studentId ? String(callToUpdate.studentId) : null
    const studentNameToConfirm = callToUpdate.studentName ? callToUpdate.studentName.trim().toLowerCase() : ''

    // Compute updated call objects BEFORE scheduling state update so persistSingleCall is guaranteed to execute
    // IMPORTANTE: Ignora registros de autorizacao especial (status: 'special_auth') para que o card permaneça no quadro Lançados Hoje
    const callsToConfirm = activeCalls.filter(c =>
      c.status !== 'special_auth' && c.status !== 'cancelled' &&
      isFromToday(c.confirmedAt || c.calledAt) &&
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

    // Also update confirmedDates[todayKey] on any matching special_auth entry
    const specialAuthsToUpdate: PickupCall[] = activeCalls
      .filter(c => {
        if (c.status !== 'special_auth') return false
        const cStudentId = c.studentId ? String(c.studentId) : null
        const cStudentName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        return (studentIdToConfirm && cStudentId === studentIdToConfirm) ||
               (studentNameToConfirm && cStudentName === studentNameToConfirm)
      })
      .map(c => ({
        ...c,
        confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow }
      }))

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      return arr.map(c => {
        const cStudentId = c.studentId ? String(c.studentId) : null
        const cStudentName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        const matchesStudent =
          (studentIdToConfirm && cStudentId === studentIdToConfirm) ||
          (studentNameToConfirm && cStudentName === studentNameToConfirm)
        if (c.status === 'special_auth') {
          if (matchesStudent) {
            return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow } }
          }
          return c
        }
        if (c.status !== 'cancelled' && isFromToday(c.confirmedAt || c.calledAt) &&
            (c.id === callId || matchesStudent)) {
          return fixCall(c)
        }
        return c
      })
    })
    
    updatedCalls.forEach(uCall => persistSingleCall(uCall))
    specialAuthsToUpdate.forEach(saCall => persistSingleCall(saCall))
    emit('CONFIRM_PICKUP', { callId, studentId: studentIdToConfirm, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId, studentId: studentIdToConfirm, confirmedAt: currentNow })
    addLog('CONFIRM', `Saída confirmada: ${callToUpdate.studentName ?? callId}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, isFromToday])

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
    const todayKey = getCampoGrandeDateStr(currentNow)
    const callToUpdate = activeCalls.find(c => c.id === callId)
    if (!callToUpdate) return
    const sIdStr = callToUpdate.studentId ? String(callToUpdate.studentId) : null
    const sNameNorm = callToUpdate.studentName ? callToUpdate.studentName.trim().toLowerCase() : ''

    // Reverts ALL non-special_auth calls for this student from today back to 'waiting'
    // and deduplicates so only ONE waiting call remains (avoiding duplicate cards)
    const revertedMain = { ...callToUpdate, status: 'waiting' as const, calledAt: currentNow, confirmedAt: undefined, isRevert: true }

    const specialAuthsToRevert: PickupCall[] = []
    activeCalls.forEach(c => {
      if (c.status !== 'special_auth') return
      const cId = c.studentId ? String(c.studentId) : null
      const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
      const matchesStudent = (sIdStr && cId && cId === sIdStr) || (sNameNorm && cName && cName === sNameNorm)
      if (matchesStudent && c.confirmedDates?.[todayKey]) {
        const nextDates = { ...c.confirmedDates }
        delete nextDates[todayKey]
        specialAuthsToRevert.push({ ...c, confirmedDates: nextDates })
      }
    })

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      // 1. Mark all non-special_auth confirmed calls for this student today as reverted
      const updated = arr.map(c => {
        const cId = c.studentId ? String(c.studentId) : null
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        const matchesStudent = (sIdStr && cId && cId === sIdStr) || (sNameNorm && cName && cName === sNameNorm)
        if (c.status === 'special_auth') {
          if (matchesStudent && c.confirmedDates?.[todayKey]) {
            const nextDates = { ...c.confirmedDates }
            delete nextDates[todayKey]
            return { ...c, confirmedDates: nextDates }
          }
          return c
        }
        if (c.status === 'cancelled') return c
        if (!matchesStudent) return c
        if (!isFromToday(c.confirmedAt || c.calledAt) && c.id !== callId) return c
        // Keep the target call as the main reverted waiting call; remove duplicates from today
        if (c.id === callId) return revertedMain
        // All other confirmed/waiting/called calls for this student today → remove (return null)
        return null
      }).filter(Boolean) as typeof arr
      return updated
    })

    persistSingleCall(revertedMain)
    specialAuthsToRevert.forEach(saCall => persistSingleCall(saCall))
    emit('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow, _remote: false })
    sendBroadcast('REVERT_CALL', { callId, studentId: sIdStr, calledAt: currentNow })
    addLog('REVERT', `Chamada revertida: ${callToUpdate.studentName}`)
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, isFromToday])

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
    targetTime?: string | null, validDaysParam?: number
  ): PickupCall => {
    const sIdStr = studentId ? String(studentId) : ''
    const currentNow = now()
    const validDays = Number.isFinite(Number(validDaysParam)) && Number(validDaysParam) >= 1
      ? Math.min(365, Math.trunc(Number(validDaysParam)))
      : 1
    const validFrom = getCampoGrandeDateStr(currentNow)
    const validUntil = addCalendarDays(validFrom, validDays - 1)

    const call: PickupCall = {
      id: uid(), studentId: sIdStr, studentName, studentClass,
      studentPhoto: studentPhoto ?? null,
      guardianId: 'special', guardianName: authorizedPerson,
      operatorId: operatorName,
      calledAt: currentNow, status: 'special_auth', source: 'manual',
      targetTime: targetTime || undefined,
      validDays,
      validFrom,
      validUntil,
      confirmedDates: {},
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

    const daysLabel = validDays > 1 ? ` · Válido por ${validDays} dias (até ${formatShortDateBR(validUntil)})` : ''
    addLog('SPECIAL_AUTH', `Autorização Especial: ${studentName} liberado para ${authorizedPerson}${targetTime ? ` (${targetTime})` : ''}${daysLabel}`)
    return call
  }, [setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, config])

  // ─── confirmSpecialExit ────────────────────────────────────────────────────
  const confirmSpecialExit = useCallback((
    studentId: string, studentName: string, studentClass: string, authorizedPerson: string, studentPhoto?: string | null,
    _targetTime?: string | null
  ): PickupCall => {
    const sIdStr = studentId ? String(studentId) : ''
    const sNameNorm = studentName ? studentName.trim().toLowerCase() : ''
    const currentNow = now()
    const todayKey = getCampoGrandeDateStr(currentNow)

    // Encontrar ou atualizar a chamada de saída do aluno DE HOJE para 'confirmed'
    // (não cria novo registro special_auth ao apenas confirmar a saída)
    const existingCall = activeCalls.find(c =>
      c.status !== 'special_auth' && c.status !== 'cancelled' &&
      isFromToday(c.confirmedAt || c.calledAt) &&
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

    // Atualiza confirmedDates[todayKey] nos registros special_auth ativos deste aluno
    const specialAuthsToUpdate: PickupCall[] = activeCalls
      .filter(c => {
        if (c.status !== 'special_auth') return false
        const cId = c.studentId ? String(c.studentId) : ''
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        return (sIdStr && cId === sIdStr) || (sNameNorm && cName === sNameNorm)
      })
      .map(c => ({
        ...c,
        confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow }
      }))

    setActiveCallsLocal?.(prev => {
      const arr = prev || []
      let next = arr.map(c => {
        const cId = c.studentId ? String(c.studentId) : ''
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        const matchesStudent = (sIdStr && cId === sIdStr) || (sNameNorm && cName === sNameNorm)
        if (c.status === 'special_auth') {
          if (matchesStudent) {
            return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow } }
          }
          return c
        }
        if (c.status !== 'cancelled' && isFromToday(c.confirmedAt || c.calledAt) && matchesStudent) {
          return { ...c, status: 'confirmed' as const, confirmedAt: currentNow }
        }
        return c
      })
      const existsConfirmed = next.some(c => c.id === confirmedCall.id)
      if (!existsConfirmed) {
        next = [confirmedCall, ...next]
      }
      return next
    })

    persistSingleCall(confirmedCall)
    specialAuthsToUpdate.forEach(saCall => persistSingleCall(saCall))

    emit('CONFIRM_PICKUP', { callId: confirmedCall.id, studentId: sIdStr, confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: confirmedCall.id, studentId: sIdStr, confirmedAt: currentNow })
    addLog('CONFIRM', `Saída confirmada (Autorização Especial): ${studentName}`)

    return confirmedCall
  }, [activeCalls, setActiveCallsLocal, emit, addLog, sendBroadcast, persistSingleCall, isFromToday])

            // ─── confirmSoloExit ───────────────────────────────────────────────────────
  const confirmSoloExit = useCallback((
    studentId: string, studentName: string, studentClass: string, studentPhoto?: string | null
  ): PickupCall | null => {
    const currentNow = now()
    const todayKey = getCampoGrandeDateStr(currentNow)
    const sIdStr = studentId ? String(studentId) : ''
    const sNameNorm = studentName ? studentName.trim().toLowerCase() : ''

    // Atualiza confirmedDates[todayKey] nos registros special_auth ativos deste aluno
    const specialAuthsToUpdate: PickupCall[] = activeCalls
      .filter(c => {
        if (c.status !== 'special_auth') return false
        const cId = c.studentId ? String(c.studentId) : ''
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        return (sIdStr && cId === sIdStr) || (sNameNorm && cName === sNameNorm)
      })
      .map(c => ({
        ...c,
        confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow }
      }))

    // 1. Se o aluno já tem chamada aguardando/chamado hoje, atualiza e confirma a chamada existente
    const existingWaiting = activeCalls.find(c =>
      ((sIdStr && c.studentId != null && String(c.studentId) === sIdStr) ||
       (sNameNorm && c.studentName && c.studentName.trim().toLowerCase() === sNameNorm)) &&
      (c.status === 'waiting' || c.status === 'called') &&
      isFromToday(c.calledAt)
    )

    if (existingWaiting) {
      const matchingCalls = activeCalls.filter(c =>
        ((sIdStr && c.studentId != null && String(c.studentId) === sIdStr) ||
         (sNameNorm && c.studentName && c.studentName.trim().toLowerCase() === sNameNorm)) &&
        c.status !== 'cancelled' && c.status !== 'special_auth' && isFromToday(c.confirmedAt || c.calledAt)
      )
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

      setActiveCallsLocal?.(prev => (prev || []).map(c => {
        const cId = c.studentId ? String(c.studentId) : ''
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        const matchesStudent = (sIdStr && cId === sIdStr) || (sNameNorm && cName === sNameNorm)
        if (!matchesStudent) return c
        if (c.status === 'special_auth') {
          return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow } }
        }
        if (c.status !== 'cancelled' && isFromToday(c.confirmedAt || c.calledAt)) {
          return { ...c, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', status: 'confirmed', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow }
        }
        return c
      }))
      updatedCalls.forEach(uCall => persistSingleCall(uCall))
      specialAuthsToUpdate.forEach(saCall => persistSingleCall(saCall))
      emit('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId: sIdStr, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow, _remote: false })
      sendBroadcast('CONFIRM_PICKUP', { callId: existingWaiting.id, studentId: sIdStr, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow })
      addLog('CONFIRM', `Saída confirmada (Saiu Sozinho): ${studentName}`)
      return primaryUpdated
    }

    // 2. Se o aluno já teve uma saída confirmada hoje, retorna a chamada confirmada
    const existingConfirmed = activeCalls.find(c =>
      ((sIdStr && c.studentId != null && String(c.studentId) === sIdStr) ||
       (sNameNorm && c.studentName && c.studentName.trim().toLowerCase() === sNameNorm)) &&
      c.status === 'confirmed' &&
      isFromToday(c.confirmedAt || c.calledAt)
    )
    if (existingConfirmed) {
      return existingConfirmed
    }

    // 3. Caso contrário, cria uma nova chamada já com status 'confirmed' (sem acionar chamada na TV/som)
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

    setActiveCallsLocal?.(prev => {
      const arr = (prev || []).map(c => {
        if (c.status !== 'special_auth') return c
        const cId = c.studentId ? String(c.studentId) : ''
        const cName = c.studentName ? c.studentName.trim().toLowerCase() : ''
        if ((sIdStr && cId === sIdStr) || (sNameNorm && cName === sNameNorm)) {
          return { ...c, confirmedDates: { ...(c.confirmedDates || {}), [todayKey]: currentNow } }
        }
        return c
      })
      return [newCall, ...arr]
    })
    persistSingleCall(newCall)
    specialAuthsToUpdate.forEach(saCall => persistSingleCall(saCall))
    emit('CALL_STUDENT', { ...newCall })
    sendBroadcast('CALL_STUDENT', newCall)
    emit('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow, _remote: false })
    sendBroadcast('CONFIRM_PICKUP', { callId: newCall.id, studentId: sIdStr, guardianId: 'sozinho', guardianName: 'Saiu Sozinho', tipo: 'sozinho', origem: 'manual', confirmedAt: currentNow })

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
  }, [activeCalls, setActiveCallsLocal, emit, sendBroadcast, persistSingleCall, addLog, isFromToday])

  // ─── Config ───────────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<SaidaConfig>) => {
    return setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const clearLog = useCallback(() => setLogs([]), [])

  const clearCalls = useCallback(async () => {
    setActiveCallsLocal?.(prev => (prev || []).filter(c => c.status === 'special_auth' && resolveSpecialAuthValidity(c).isActiveToday))
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
  }, [emit, addLog, sendBroadcast, setActiveCallsLocal])

  const isLoadingCallsRef = useRef(isLoadingCalls)
  useEffect(() => {
    isLoadingCallsRef.current = isLoadingCalls
  }, [isLoadingCalls])
  const inFlightRefreshRef = useRef<Promise<void> | null>(null)

  const refreshCalls = useCallback(async () => {
    // Se a carga inicial do useSupabaseArray('saida/calls') já está em voo, evita disparar requisição duplicada concorrente
    if (isLoadingCallsRef.current) return
    if (inFlightRefreshRef.current) return inFlightRefreshRef.current

    const promise = (async () => {
      try {
        invalidateCache('saida/calls')
        const todayYmd = getTodayStr()
        const res = await fetch(`/api/saida/calls?date=${todayYmd}&_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        if (res.ok) {
          // Ponte HTTP -> Realtime: se o polling HTTP funcionou, a rede está ativa!
          // Caso o canal WebSocket esteja offline/fechado, força a reconexão imediata.
          if (!channelRef.current || channelRef.current.state !== 'joined') {
            reconnectRealtimeRef.current?.()
          }
          const data = await res.json()
          const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
          
          // Normalize array: Ensure that if any entry for a studentId is 'confirmed' today,
          // all non-reverted waiting/called entries for that same studentId today are also marked as 'confirmed'.
          const confirmedSet = new Set(
            arr.filter((c: PickupCall) => c.status === 'confirmed' && c.studentId != null && getCampoGrandeDateStr(c.confirmedAt || c.calledAt) === todayYmd).map((c: PickupCall) => String(c.studentId))
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
                prevArr.filter(c => c.status === 'confirmed' && c.studentId != null && getCampoGrandeDateStr(c.confirmedAt || c.calledAt) === todayYmd).map(c => String(c.studentId))
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
      } finally {
        inFlightRefreshRef.current = null
      }
    })()

    inFlightRefreshRef.current = promise
    return promise
  }, [getTodayStr, setActiveCalls, setActiveCallsLocal])

  useEffect(() => {
    refreshCallsRef.current = refreshCalls
  }, [refreshCalls])

  // ── Virada automática de dia (meia-noite ou retorno de suspensão) ──
  // Preserva autorizações especiais de múltiplos dias vigentes e reseta confirmações do dia anterior
  useEffect(() => {
    const checkDateRollover = () => {
      const latestToday = getTodayStr()
      setCurrentTodayStr(prevDate => {
        if (prevDate !== latestToday) {
          setActiveCallsLocal?.(prevCalls =>
            (prevCalls || []).filter(c => {
              if (c.status === 'special_auth') {
                return resolveSpecialAuthValidity(c, latestToday).isActiveToday
              }
              return getCampoGrandeDateStr(c.confirmedAt || c.calledAt) === latestToday
            })
          )
          setTimeout(() => {
            refreshCalls()
          }, 150)
          return latestToday
        }
        return prevDate
      })

      const d = new Date()
      if (d.getHours() === 23 && d.getMinutes() === 59) {
        const lastCleared = localStorage.getItem('lastClearedDate')
        if (lastCleared !== latestToday) {
          setActiveCallsLocal?.(prevCalls =>
            (prevCalls || []).filter(c => c.status === 'special_auth' && resolveSpecialAuthValidity(c, latestToday).isActiveToday)
          )
          localStorage.setItem('lastClearedDate', latestToday)
        }
      }
    }

    const interval = setInterval(checkDateRollover, 30000)
    const onVisChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkDateRollover()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisChange)
    }
    return () => {
      clearInterval(interval)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisChange)
      }
    }
  }, [getTodayStr, setActiveCallsLocal, refreshCalls])

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
    const todayCalls = (activeCalls || []).filter(c => {
      if (c.status === 'special_auth') {
        return resolveSpecialAuthValidity(c, currentTodayStr).isActiveToday
      }
      return getCampoGrandeDateStr(c.confirmedAt || c.calledAt) === currentTodayStr
    })

    const confirmedIdsToday = new Set(
      todayCalls
        .filter(c => c.status === 'confirmed' && c.studentId != null)
        .map(c => String(c.studentId))
    )

    return todayCalls.map(c => {
      if (
        (c.status === 'waiting' || c.status === 'called') &&
        !(c as any).isRevert &&
        c.studentId != null &&
        confirmedIdsToday.has(String(c.studentId))
      ) {
        return { ...c, status: 'confirmed' as const }
      }
      return c
    })
  }, [activeCalls, currentTodayStr])

  return (
    <Ctx.Provider value={{
      guardians: [], rfidMap: [], studentGuardians: [], activeCalls: filteredActiveCalls, logs,
      config,
      isConfigLoading,
      realtimeStatus, isLoadingCalls,
      callStudent, blockAttempt, confirmPickup, cancelCall, recallStudent, revertCall, deleteCall, addSpecialAuth, confirmSpecialExit, confirmSoloExit,
      broadcastAnnouncement, cancelAnnouncement,
      updateConfig, clearLog, clearCalls, refreshCalls, ensureRealtimeConnected,
    }}>
      {children}
    </Ctx.Provider>
  )
}
