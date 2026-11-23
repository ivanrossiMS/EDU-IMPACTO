'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { supabase } from '@/lib/supabase';

const normalizeStr = (str: string) => {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

const getInitials = (name: string) => {
  if (!name) return ''
  return name.trim().split(/\s+/).map(n => n[0]).join('').toLowerCase()
}

const abbreviateStudentName = (name?: string, maxLen = 22): string => {
  if (!name) return ''
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= maxLen) return cleaned

  const parts = cleaned.split(' ')
  if (parts.length <= 2) return cleaned

  const connectors = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  const first = parts[0]
  const last = parts[parts.length - 1]
  const middleInitials = parts
    .slice(1, -1)
    .filter(p => !connectors.has(p.toLowerCase()))
    .map(p => `${p.charAt(0).toUpperCase()}.`)

  const fullAbbrev = [first, ...middleInitials, last].join(' ')
  if (fullAbbrev.length <= maxLen || middleInitials.length <= 1) {
    return fullAbbrev
  }

  return [first, middleInitials[0], last].join(' ')
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { formatFirstAndSecondName } from '@/lib/utils'
import {
  SaidaProvider,
  useSaida,
  PickupCall,
  isSaiuSozinhoCall,
  getCampoGrandeDateStr,
  formatShortDateBR,
  resolveSpecialAuthValidity,
  addCalendarDays,
} from '@/lib/saidaContext'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'
import {
  CheckCircle2, CheckCheck, Clock, Search, Megaphone, X, GraduationCap,
  UserCheck, ChevronRight, RotateCcw, RefreshCw, Trash2, Pin,
  Users, Sparkles, AlertCircle, Volume2, VolumeX, History, Calendar
} from 'lucide-react'

type FilterType = 'all' | 'waiting' | 'confirmed' | 'saiu_sozinho' | 'cancelled' | 'blocked'

// ── Helper ────────────────────────────────────────────────────────────────────
function statusMeta(call: PickupCall) {
  if (call.status === 'waiting' || call.status === 'called')
    return { color: '#f59e0b', label: 'AGUARDANDO' }
  if (call.status === 'confirmed') {
    const isSolo = isSaiuSozinhoCall(call)
    if (isSolo) {
      const isCatraca = (call.guardianId === 'catraca-saida' || (call as any).origem === 'catraca_idface' || (call.guardianName || '').toLowerCase().includes('catraca'))
      return {
        color: '#06b6d4',
        label: isCatraca ? 'CATRACA SAÍDA' : 'SAIU SOZINHO'
      }
    }
    return { color: '#10b981', label: 'CONFIRMADO'  }
  }
  if (call.status === 'blocked')
    return {
      color: call.blockType === 'dia_restrito' ? '#f97316' : '#ef4444',
      label: call.blockType === 'dia_restrito' ? 'DIA RESTRITO' : 'PROIBIDO',
    }
  return { color: '#94a3b8', label: 'CANCELADO' }
}

function elapsedSec(since: string, nowTime?: number) {
  const current = nowTime !== undefined ? nowTime : Date.now()
  if (!since) return 0
  let str = String(since).trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    str += '-04:00'
  }
  const t = new Date(str).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, Math.floor((current - t) / 1000))
}

const CAMPO_GRANDE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Campo_Grande',
  hour: '2-digit',
  minute: '2-digit',
})

function fmtTime(iso?: string) {
  if (!iso) return ''
  try {
    let str = String(iso).trim()
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const parts = str.split(':')
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      str += '-04:00'
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    return CAMPO_GRANDE_TIME_FORMATTER.format(d)
  } catch {
    return String(iso)
  }
}

import { fetchSingleStudentPhoto, getCachedStudentPhoto, setCachedStudentPhoto } from '@/lib/studentPhotoCache'

// ── Unified call card (Ultra Modern TV-Monitor style) ─────────────────────────
const CallCard = React.memo(function CallCard({ call, displayClass, urgentLimit, onConfirm, onCancel, onRecall, onRevert, onOpenIrmaos }: {
  call:         PickupCall
  displayClass?: string
  urgentLimit:  number
  onConfirm:    (id: string) => void
  onCancel:     (id: string) => void
  onRecall:     (id: string) => void
  onRevert:     (id: string) => void
  onOpenIrmaos: (call: PickupCall) => void
}) {
  const [recalling, setRecalling] = useState(false)
  const isActive   = call.status === 'waiting' || call.status === 'called'
  const isFinished = call.status === 'confirmed' || call.status === 'cancelled'
  const isBlocked  = call.status === 'blocked'
  const [localNowTime, setLocalNowTime] = useState(() => isActive ? Date.now() : 0)
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(call.studentPhoto || null)
  const [photoError, setPhotoError] = useState(false)
  
  useEffect(() => {
    if (!isActive) return
    setLocalNowTime(Date.now())
    const iv = setInterval(() => setLocalNowTime(Date.now()), 10000)
    return () => clearInterval(iv)
  }, [isActive])

  // Auto-resolve photo if call was created without photo but student has photo in database
  useEffect(() => {
    if (call.studentPhoto) {
      setResolvedPhoto(call.studentPhoto)
      setPhotoError(false)
      return
    }
    if (!call.studentId) return

    let isMounted = true
    fetchSingleStudentPhoto(call.studentId).then(p => {
      if (!isMounted) return
      if (p) {
        setResolvedPhoto(p)
        setPhotoError(false)
      }
    })

    return () => { isMounted = false }
  }, [call.studentPhoto, call.studentId])
  
  const secs = isActive ? elapsedSec(call.calledAt, localNowTime || Date.now()) : 0
  const isSolo     = isSaiuSozinhoCall(call)
  const isCatraca  = isSolo && (call.guardianId === 'catraca-saida' || (call as any).origem === 'catraca_idface' || (call.guardianName || '').toLowerCase().includes('catraca'))
  
  const urgent = isActive && secs > urgentLimit
  const meta = statusMeta(call)
  const color = urgent ? '#ef4444' : meta.color // Override with red if urgent

  const initials = call.studentName
    .split(' ').slice(0, 2)
    .map((n: string) => n[0]).join('').toUpperCase()

  const handleRecall = () => {
    setRecalling(true)
    onRecall(call.id)
    setTimeout(() => setRecalling(false), 2500)
  }

  const mins = Math.floor(secs / 60)

  const displayCalledAt = (call.confirmedAt && new Date(call.calledAt).getTime() > new Date(call.confirmedAt).getTime())
    ? call.confirmedAt
    : call.calledAt

  return (
    <div className="chamada-card-perf" style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'hsl(var(--bg-elevated))',
      border: `1px solid ${color}${isFinished ? '20' : '40'}`,
      boxShadow: urgent ? '0 4px 14px rgba(239,68,68,0.22)' : '0 2px 10px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      opacity: isFinished ? 0.85 : 1,
      minHeight: 235,
      aspectRatio: '1 / 1.32',
    }}>

      {/* ── BACKGROUND PHOTO ─────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'hsl(var(--bg-muted))' }}>
        {(resolvedPhoto && !photoError) ? (
          <img
            src={resolvedPhoto}
            alt={call.studentName}
            onError={() => setPhotoError(true)}
            decoding="async" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${color}80, ${color}30)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 42, fontWeight: 900, color: '#fff',
            letterSpacing: '-1px',
          }}>
            {initials}
          </div>
        )}

        {/* Cinematic Gradient Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 20%, rgba(15,23,42,0.8) 65%, #0f172a 100%)'
        }} />
      </div>

      {/* Floating Status Tag */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          padding: '4px 8px', borderRadius: 50,
          background: color,
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 900, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          boxShadow: `0 4px 12px ${color}80`,
          zIndex: 10,
        }}>
          {isActive ? <Clock size={9} className={urgent ? 'tv-pulse-icon' : ''} /> : 
           isSolo ? <span style={{ fontSize: 9 }}>🚶‍♂️</span> :
           call.status === 'confirmed' ? <CheckCircle2 size={9} /> : <X size={9} />}
          {urgent ? 'ATRASADO' : meta.label}
        </div>

        {/* Live Timer (if active) */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            padding: '3px 8px', borderRadius: 50,
            background: 'rgba(15,23,42,0.78)',
            border: '1px solid rgba(255,255,255,0.14)',
            fontSize: 9, fontWeight: 900, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 10,
          }}>
            {mins} MIN
          </div>
        )}
      {/* ── CONTENT AREA ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 5, marginTop: 'auto',
        padding: '12px 14px 14px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 13.5, fontWeight: 900, color: '#fff',
          lineHeight: 1.2, marginBottom: 3, textTransform: 'uppercase',
          fontFamily: 'Outfit, sans-serif', textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={call.studentName}>
          {abbreviateStudentName(call.studentName, 22)}
        </div>
        
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase',
          letterSpacing: '0.02em', marginBottom: 10,
        }}>
          <GraduationCap size={11} />
          {displayClass || call.studentClass}
        </div>

        {/* Block Reason Banner */}
        {isBlocked && call.blockReason && (
          <div style={{
            padding: '6px 10px', borderRadius: 8, marginBottom: 10,
            background: `rgba(${call.blockType === 'proibido' ? '239,68,68' : '249,115,22'}, 0.15)`,
            border: `1px solid ${color}40`, fontSize: 9, color: '#cbd5e1', lineHeight: 1.3,
          }}>
            <strong style={{ color }}>{call.blockType === 'proibido' ? '🚫 PROIBIDO: ' : '📅 DIA RESTRITO: '}</strong>
            {call.blockReason}
          </div>
        )}

        {/* Footer info (Guardian & Time) */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginBottom: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          {/* Left: Guardian */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, paddingRight: 6 }}>
            <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isSolo ? (isCatraca ? 'Catraca de Saída' : 'Saída Autônoma') : 'Responsável'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: isSolo ? '#38bdf8' : '#f8fafc', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>
              {isSolo ? <span style={{ fontSize: 10 }}>🚶‍♂️</span> : <UserCheck size={10} color="#cbd5e1" style={{ flexShrink: 0 }} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {call.guardianName || (isSolo ? 'Saiu Sozinho' : 'Não Informado')}
              </span>
            </div>
            {call.targetTime && (
              <span style={{
                fontSize: 8.5,
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '1px 5px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                width: 'fit-content',
                marginTop: 2
              }}>
                <Clock size={8.5} /> {call.targetTime === 'Indefinido' ? 'Indefinido' : `Horário: ${call.targetTime}`}
              </span>
            )}
          </div>
          
          {/* Right: Times */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 9, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
               <Megaphone size={9} color={color} />
               {fmtTime(displayCalledAt)}
             </div>
             {call.confirmedAt && (
               <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#10b981' }}>
                 <CheckCircle2 size={9} />
                 {fmtTime(call.confirmedAt)}
               </div>
             )}
          </div>
        </div>

        {/* ── ACTION BUTTONS ─────────────────────────────────────────────── */}
        {isActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-modern btn-chamar" onClick={handleRecall} disabled={recalling} style={{
                flex: 1, height: 34, borderRadius: 10,
                fontWeight: 800, fontSize: 10, cursor: recalling ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                textTransform: 'uppercase',
              }}>
                <Megaphone size={11}/> {recalling ? 'Chamando...' : 'CHAMAR'}
              </button>

              <button className="btn-modern btn-confirmar" onClick={() => onConfirm(call.id)} style={{
                flex: 1.4, height: 34, borderRadius: 10,
                fontWeight: 800, fontSize: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                textTransform: 'uppercase',
              }}>
                <CheckCircle2 size={11}/> Confirmar
              </button>

              <button className="btn-modern btn-cancelar" onClick={() => onCancel(call.id)} style={{
                width: 34, height: 34, flexShrink: 0, borderRadius: 10,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={13}/>
              </button>
            </div>

            {/* ── BOTÃO CHAMAR IRMÃOS (EMBAIXO DO CHAMAR) ── */}
            <button
              type="button"
              className="btn-modern btn-irmaos"
              onMouseEnter={() => prefetchSiblings(call)}
              onClick={(e) => {
                e.stopPropagation()
                onOpenIrmaos(call)
              }}
              title="Chamar irmãos e outros dependentes vinculados a este responsável"
              style={{
                width: '100%', height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.18))',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#c084fc',
                fontWeight: 800, fontSize: 9.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.12)',
              }}
            >
              <Users size={12} /> Chamar Irmãos
            </button>
          </div>
        )}

        {isFinished && (
          <button onClick={() => onRevert(call.id)} style={{
            width: '100%', height: 34, borderRadius: 10,
            background: 'hsl(var(--bg-overlay))', border: '1px solid hsl(var(--border-subtle))',
            color: 'hsl(var(--text-muted))', fontWeight: 700, fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'all 0.2s', textTransform: 'uppercase',
          }}>
            <RotateCcw size={11}/> Reverter para Aguardando
          </button>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.call.id === next.call.id &&
         prev.call.status === next.call.status &&
         prev.call.calledAt === next.call.calledAt &&
         prev.call.confirmedAt === next.call.confirmedAt &&
         prev.call.guardianName === next.call.guardianName &&
         prev.call.blockType === next.call.blockType &&
         prev.call.studentPhoto === next.call.studentPhoto &&
         prev.displayClass === next.displayClass &&
         prev.urgentLimit === next.urgentLimit
})

// ── Client-side Ultra Fast Cache & Prefetching ─────────────────────────────────
const globalSiblingsCache = new Map<string, { data: SiblingStudent[]; timestamp: number }>()

function getSiblingsCacheKey(call: PickupCall): string {
  return `${call.guardianId || ''}|${(call.guardianName || '').toLowerCase().trim()}|${call.studentId || ''}`
}

function prefetchSiblings(call: PickupCall) {
  if (!call) return
  const key = getSiblingsCacheKey(call)
  const cached = globalSiblingsCache.get(key)
  if (cached && Date.now() - cached.timestamp < 45000) return

  const params = new URLSearchParams()
  if (call.guardianId) params.set('guardianId', call.guardianId)
  if (call.guardianName) params.set('guardianName', call.guardianName)
  if (call.studentId) params.set('studentId', call.studentId)

  fetch(`/api/saida/irmaos?${params.toString()}`)
    .then(res => res.ok ? res.json() : null)
    .then(json => {
      if (json?.siblings) {
        globalSiblingsCache.set(key, { data: json.siblings, timestamp: Date.now() })
      }
    })
    .catch(() => {})
}

// ── Modal Ultra Moderno de Chamada de Irmãos ──────────────────────────────────
interface SiblingStudent {
  id: string
  nome: string
  matricula?: string
  turma?: string
  turmaNome: string
  turno?: string
  foto?: string | null
  autorizadoSairSozinho?: boolean
  parentescoVinculo?: string
  isCurrentStudent?: boolean
  responsaveis?: any[]
}

function ModalChamarIrmaos({
  call,
  onClose,
  activeCalls,
  onCallStudent,
  onRecallStudent,
  showToast,
}: {
  call: PickupCall
  onClose: () => void
  activeCalls: PickupCall[]
  onCallStudent: (studentId: string, studentName: string, studentClass: string, guardianId: string, guardianName: string, studentPhoto?: string | null) => void
  onRecallStudent: (callId: string) => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  const cacheKey = useMemo(() => getSiblingsCacheKey(call), [call])
  const cachedEntry = useMemo(() => globalSiblingsCache.get(cacheKey), [cacheKey])

  const [siblings, setSiblings] = useState<SiblingStudent[]>(cachedEntry?.data || [])
  const [loading, setLoading] = useState(!cachedEntry)
  const [callingIds, setCallingIds] = useState<Set<string>>(new Set())
  const [callingAll, setCallingAll] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    let isMounted = true
    const fetchSiblings = async () => {
      // If we already have fresh cached data, don't show loading spinner
      if (!cachedEntry) {
        setLoading(true)
      }
      try {
        const params = new URLSearchParams()
        if (call.guardianId) params.set('guardianId', call.guardianId)
        if (call.guardianName) params.set('guardianName', call.guardianName)
        if (call.studentId) params.set('studentId', call.studentId)

        const res = await fetch(`/api/saida/irmaos?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted) {
            const list = json.siblings || []
            setSiblings(list)
            globalSiblingsCache.set(cacheKey, { data: list, timestamp: Date.now() })
          }
        }
      } catch (err) {
        console.error('Erro ao buscar irmãos:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchSiblings()
    return () => { isMounted = false }
  }, [call, cacheKey, cachedEntry])

  // Esc key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const otherSiblings = useMemo(() => {
    return siblings.filter(s => String(s.id) !== String(call.studentId))
  }, [siblings, call.studentId])

  // Helper to check live status of any sibling in activeCalls
  const getSiblingCallStatus = useCallback((sId: string) => {
    const sIdStr = String(sId).trim()
    const active = activeCalls.find(c => c.studentId != null && String(c.studentId).trim() === sIdStr && (c.status === 'waiting' || c.status === 'called'))
    if (active) return { status: 'waiting' as const, call: active }
    const confirmed = activeCalls.find(c => c.studentId != null && String(c.studentId).trim() === sIdStr && c.status === 'confirmed')
    if (confirmed) return { status: 'confirmed' as const, call: confirmed }
    const blocked = activeCalls.find(c => c.studentId != null && String(c.studentId).trim() === sIdStr && c.status === 'blocked')
    if (blocked) return { status: 'blocked' as const, call: blocked }
    return { status: 'uncalled' as const, call: null }
  }, [activeCalls])

  // Uncalled other siblings (ready to be called)
  const uncalledCount = useMemo(() => {
    return otherSiblings.filter(s => {
      const { status } = getSiblingCallStatus(s.id)
      return status === 'uncalled'
    }).length
  }, [otherSiblings, getSiblingCallStatus])

  const handleCallSingle = (s: SiblingStudent) => {
    if (callingIds.has(s.id)) return
    setCallingIds(prev => new Set(prev).add(s.id))
    onCallStudent(
      s.id,
      s.nome,
      s.turmaNome || s.turma || '',
      call.guardianId,
      call.guardianName,
      s.foto
    )
    showToast(`Aluno(a) ${s.nome} chamado(a) na TV!`, true)
    setTimeout(() => {
      setCallingIds(prev => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
    }, 1500)
  }

  const handleCallAll = async () => {
    const targets = otherSiblings.filter(s => {
      const { status } = getSiblingCallStatus(s.id)
      return status === 'uncalled'
    })

    if (targets.length === 0) {
      showToast('Todos os irmãos já foram chamados ou liberados!', false)
      return
    }

    setCallingAll(true)
    for (let i = 0; i < targets.length; i++) {
      const s = targets[i]
      setCallingIds(prev => new Set(prev).add(s.id))
      onCallStudent(
        s.id,
        s.nome,
        s.turmaNome || s.turma || '',
        call.guardianId,
        call.guardianName,
        s.foto
      )
      if (i < targets.length - 1) {
        await new Promise(r => setTimeout(r, 350))
      }
    }
    showToast(`⚡ ${targets.length} irmão(s) chamado(s) na TV com sucesso!`, true)
    setTimeout(() => {
      setCallingAll(false)
      setCallingIds(new Set())
    }, 1500)
  }

  return (
    <div
      className="chamada-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.84)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="chamada-modal-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #18182b 0%, #0c0e18 100%)',
          borderRadius: 24,
          border: '1.5px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(168,85,247,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* TOP GLOW BAR */}
        <div style={{
          height: 3,
          width: '100%',
          background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
        }} />

        {/* MODAL HEADER */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.35))',
              border: '1px solid rgba(168,85,247,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              boxShadow: '0 4px 16px rgba(168,85,247,0.25)',
              flexShrink: 0,
            }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: 18,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                Alunos do Responsável
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 100,
                  background: 'rgba(168,85,247,0.2)',
                  color: '#d8b4fe',
                  border: '1px solid rgba(168,85,247,0.35)',
                }}>
                  {siblings.length} {siblings.length === 1 ? 'aluno vinculado' : 'alunos vinculados'}
                </span>
              </div>
              <div style={{
                fontSize: 12,
                color: '#94a3b8',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8', fontWeight: 700 }}>
                  <UserCheck size={13} color="#38bdf8" />
                  {call.guardianName || 'Responsável'}
                </span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ color: '#cbd5e1', fontSize: 11.5 }}>
                  Chamada iniciada com <strong style={{ color: '#fff' }}>{call.studentName}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#cbd5e1'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* QUICK ACTION BANNER (CALL ALL SIBLINGS) */}
        {uncalledCount > 1 && (
          <div style={{
            padding: '10px 24px',
            background: 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
            borderBottom: '1px solid rgba(168,85,247,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 12, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Sparkles size={14} color="#c084fc" />
              <span>Há <strong>{uncalledCount}</strong> irmãos prontos para serem chamados juntos.</span>
            </div>
            <button
              type="button"
              onClick={handleCallAll}
              disabled={callingAll}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: 10.5,
                cursor: callingAll ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!callingAll) {
                  e.currentTarget.style.filter = 'brightness(1.15)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <Megaphone size={12} />
              {callingAll ? 'Chamando Todos...' : `Chamar Todos (${uncalledCount})`}
            </button>
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE LIST) */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          maxHeight: 'calc(90vh - 160px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-shimmer" style={{
                  height: 80,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }} />
              ))}
            </div>
          ) : siblings.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(168,85,247,0.1)',
                border: '1px solid rgba(168,85,247,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
                fontSize: 26,
              }}>
                👥
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>
                  Nenhum irmão encontrado
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8', maxWidth: 380, lineHeight: 1.5 }}>
                  Não localizamos outros alunos ativos no sistema vinculados ao mesmo responsável ({call.guardianName || 'não informado'}).
                </p>
              </div>
            </div>
          ) : (
            siblings.map(s => {
              const { status, call: activeCall } = getSiblingCallStatus(s.id)
              const isCurrent = s.isCurrentStudent || String(s.id) === String(call.studentId)
              const isBeingCalled = callingIds.has(s.id)
              const initials = s.nome ? s.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() : 'AL'

              return (
                <div
                  key={s.id}
                  style={{
                    background: isCurrent
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(15,23,42,0.6))'
                      : status === 'confirmed'
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(15,23,42,0.6))'
                        : status === 'waiting'
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(15,23,42,0.6))'
                          : 'rgba(255,255,255,0.03)',
                    border: isCurrent
                      ? '1px solid rgba(99,102,241,0.45)'
                      : status === 'confirmed'
                        ? '1px solid rgba(16,185,129,0.35)'
                        : status === 'waiting'
                          ? '1px solid rgba(245,158,11,0.35)'
                          : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* LEFT: STUDENT PHOTO & INFO */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: s.foto ? 'none' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                      border: '1.5px solid rgba(255,255,255,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 18,
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {s.foto ? (
                        <img
                          src={s.foto}
                          alt={s.nome}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: 14.5,
                          color: '#fff',
                          fontFamily: 'Outfit, sans-serif',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {s.nome}
                        </span>
                        {isCurrent && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: 100,
                            background: 'rgba(99,102,241,0.25)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99,102,241,0.4)',
                            textTransform: 'uppercase',
                          }}>
                            Aluno Desta Chamada
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#38bdf8', fontWeight: 700 }}>
                        <GraduationCap size={13} />
                        <span>{s.turmaNome || s.turma} {s.turno ? `· ${s.turno.toUpperCase()}` : ''}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {s.parentescoVinculo && (
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            color: '#cbd5e1',
                          }}>
                            {s.parentescoVinculo}
                          </span>
                        )}
                        {s.autorizadoSairSozinho ? (
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(16,185,129,0.12)',
                            color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.25)',
                          }}>
                            Pode sair sozinho
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: ACTION / STATUS BUTTON */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {isCurrent ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          background: call.status === 'confirmed' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.18)',
                          border: call.status === 'confirmed' ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(99,102,241,0.4)',
                          color: call.status === 'confirmed' ? '#10b981' : '#a5b4fc',
                          fontSize: 10.5,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {call.status === 'confirmed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {call.status === 'confirmed' ? 'Saída Confirmada' : 'Em Chamada'}
                        </div>
                        {call.status !== 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => onRecallStudent(call.id)}
                            title="Rechamar aluno na TV"
                            style={{
                              height: 32,
                              padding: '0 10px',
                              borderRadius: 10,
                              background: 'rgba(168,85,247,0.15)',
                              border: '1px solid rgba(168,85,247,0.35)',
                              color: '#c084fc',
                              fontWeight: 800,
                              fontSize: 10,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Megaphone size={11} /> Rechamar
                          </button>
                        )}
                      </div>
                    ) : status === 'confirmed' ? (
                      <div style={{
                        padding: '6px 14px',
                        borderRadius: 10,
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        color: '#10b981',
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        textTransform: 'uppercase',
                      }}>
                        <CheckCircle2 size={13} />
                        Saída Confirmada
                      </div>
                    ) : status === 'waiting' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          background: 'rgba(245,158,11,0.15)',
                          border: '1px solid rgba(245,158,11,0.35)',
                          color: '#f59e0b',
                          fontSize: 10.5,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          textTransform: 'uppercase',
                        }}>
                          <Clock size={12} />
                          Aguardando
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeCall) onRecallStudent(activeCall.id)
                          }}
                          title="Rechamar aluno na TV"
                          style={{
                            height: 32,
                            padding: '0 10px',
                            borderRadius: 10,
                            background: 'rgba(168,85,247,0.15)',
                            border: '1px solid rgba(168,85,247,0.35)',
                            color: '#c084fc',
                            fontWeight: 800,
                            fontSize: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Megaphone size={11} /> Rechamar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCallSingle(s)}
                        disabled={isBeingCalled || callingAll}
                        style={{
                          height: 38,
                          padding: '0 18px',
                          borderRadius: 12,
                          background: isBeingCalled
                            ? 'rgba(99,102,241,0.3)'
                            : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 900,
                          fontSize: 11.5,
                          cursor: isBeingCalled || callingAll ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          boxShadow: isBeingCalled ? 'none' : '0 4px 14px rgba(59,130,246,0.35)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          if (!isBeingCalled && !callingAll) {
                            e.currentTarget.style.filter = 'brightness(1.15)'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = '0 6px 18px rgba(59,130,246,0.45)'
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.filter = 'none'
                          e.currentTarget.style.transform = 'none'
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)'
                        }}
                      >
                        <Megaphone size={13} />
                        {isBeingCalled ? 'Chamando...' : 'Chamar Aluno'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* SINGLE STUDENT HELPER NOTICE */}
          {!loading && siblings.length === 1 && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: '#c7d2fe',
              marginTop: 4,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
              <span><strong>{call.guardianName}</strong> possui apenas 1 dependente cadastrado no sistema (não há irmãos para chamar).</span>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            💡 Ao chamar, o aluno é anunciado imediatamente no Monitor TV e na portaria.
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Student search row with inline guardian buttons & solo exit button ─────────
const StudentSearchRow = React.memo(function StudentSearchRow({ student, activeCalls, onCall, showToast }: {
  student: any
  activeCalls: PickupCall[]
  onCall: (sId: string, sName: string, sClass: string, gId: string, gName: string, foto?: string | null) => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  const { confirmSoloExit } = useSaida()

  // Read autorizados directly from aluno.saude / dados
  const saude: any = student.saude || student.dados?.saude || {}
  const autorizados: any[] = saude.autorizados || student.autorizados || student.dados?.autorizados || []
  const autorizaSaida: boolean = (() => {
    const candidates = [
      student.autorizadoSairSozinho,
      student.dados?.autorizadoSairSozinho,
      student.sairSozinho,
      student.dados?.sairSozinho,
      saude.autorizaSaida,
    ]
    for (const c of candidates) {
      if (typeof c === 'boolean') return c
      if (typeof c === 'number') return c === 1
      if (typeof c === 'string') {
        const s = c.trim().toLowerCase()
        if (['true', 'sim', 's', '1', 'autorizado'].includes(s)) return true
        if (['false', 'nao', 'não', 'n', '0', 'nao autorizado', 'não autorizado'].includes(s)) return false
      }
    }
    return false
  })()

  const [showProibidoAlert, setShowProibidoAlert] = useState<{ name: string, message: string } | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isCalling, setIsCalling] = useState(false)

  // Day-of-week check
  const DIAS_LABEL = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
  const todayIdx = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
  const todayLabel = [DIAS_LABEL[6], ...DIAS_LABEL].at(todayIdx)! // remap: 0→Dom
  const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const todayKey = remap[todayIdx]

  // Also include responsáveis ERP as fallback if no autorizados defined
  const respList = useMemo(() => {
    const list: { id: string; name: string; role: string; rfid?: string; proibido?: boolean; diasSemana?: string[] }[] = []
    const seen = new Set<string>()

    const addRes = (id: string, nameVal: any, roleVal: string, rfid?: string, proibido?: boolean, dias?: string[]) => {
      if (!nameVal || typeof nameVal !== 'string') return
      const cleaned = nameVal.trim()
      if (!cleaned) return
      const key = cleaned.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push({ id, name: cleaned, role: roleVal, rfid, proibido: proibido === true, diasSemana: dias || [] })
      }
    }

    // 1. Autorizados do módulo Saúde & Obs
    const saudeAuts = Array.isArray(autorizados) ? autorizados : []
    saudeAuts.forEach((aut: any, i: number) => {
      addRes(`saude-aut-${i}`, aut.nome || aut.name, aut.parentesco || aut.role || 'Autorizado', aut.rfid, aut.proibido, aut.diasSemana || aut.diasAcesso)
    })
    
    // 2. Responsáveis cadastrados na aba Responsáveis
    const resps: any[] = []
    const pushArray = (arr: any) => { if (Array.isArray(arr)) resps.push(...arr) }
    pushArray(student.responsaveis)
    pushArray(student.dados?.responsaveis)
    pushArray(student.responsaveis_lista)
    pushArray(student.outrosResponsaveis)
    pushArray(student.dados?.outrosResponsaveis)
    pushArray(student.responsaveisOutros)
    pushArray(student.dados?.responsaveisOutros)

    resps.forEach((r: any, i: number) => {
      const name = r.nome || r.name || r.nomeCompleto
      if (!name) return

      let rawRole = r.parentesco || r.role || r.tipo || ''
      const isPed = r.isPedagogico === true || r.respPedagogico === true || rawRole.toLowerCase().includes('pedag')
      const isFin = r.isFinanceiro === true || r.respFinanceiro === true || rawRole.toLowerCase().includes('finan')
      const isOut = r.isOutro === true || r.resp_outro === true || r.respOutro === true || rawRole.toLowerCase() === 'outro' || rawRole.toLowerCase() === 'outros'

      let finalRole = rawRole
      if (isPed) finalRole = 'Resp. Pedagógico'
      else if (isFin) finalRole = 'Resp. Financeiro'
      else if (isOut) finalRole = (rawRole && rawRole.toLowerCase() !== 'outro' && rawRole.toLowerCase() !== 'outros') ? `Outros (${rawRole})` : 'Outros'
      else if (!finalRole) finalRole = 'Responsável'

      addRes(`resp-${i}`, name, finalRole, r.rfid, r.proibido, r.diasAcesso || r.dias_acesso || r.diasSemana)
    })

    // 3. Fallback to ERP fields
    addRes('erp-ped', student.responsavelPedagogico || student.responsavel_pedagogico || student.dados?.responsavelPedagogico, 'Pedagógico')
    addRes('erp-fin', student.responsavelFinanceiro || student.responsavel_financeiro || student.dados?.responsavelFinanceiro, 'Financeiro')
    addRes('erp-out', student.responsavelOutro || student.responsavel_outro || student.dados?.responsavelOutro, 'Outros')
    addRes('erp-resp', student.responsavel || student.dados?.responsavel, 'Responsável')
    addRes('erp-mae', student.mae || student.dados?.mae, 'Mãe')
    addRes('erp-pai', student.pai || student.dados?.pai, 'Pai')

    return list
  }, [autorizados, student])

  const alreadyCalled = useMemo(() => {
    const sId = String(student.id || '')
    return activeCalls.some(c =>
      c.studentId != null && String(c.studentId) === sId && (c.status === 'waiting' || c.status === 'called')
    )
  }, [activeCalls, student.id])

  const confirmedCall = useMemo(() => {
    const sId = String(student.id || '')
    return activeCalls.find(c =>
      c.studentId != null && String(c.studentId) === sId && c.status === 'confirmed'
    )
  }, [activeCalls, student.id])
  const alreadyConfirmed = !!confirmedCall

  const studentPhoto = useMemo(() => {
    const p = student.foto || student.foto_url || student.fotoUrl || student.avatarUrl || student.imagem1 || student.dados?.foto || student.dados?.foto_url || student.dados?.fotoUrl || student.dados?.avatarUrl || null
    if (p && student.id) setCachedStudentPhoto(student.id, p)
    return p
  }, [student])
  const [imgError, setImgError] = useState(false)

  const initials = useMemo(() => student.nome?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(), [student.nome])

  const executeSoloExit = useCallback(() => {
    confirmSoloExit(
      student.id,
      student.nome,
      student.turmaNome || student.turma,
      studentPhoto
    )
    showToast(`Saída de ${student.nome} confirmada (Saiu Sozinho)!`, true)
  }, [confirmSoloExit, student.id, student.nome, student.turmaNome, student.turma, studentPhoto, showToast])
  const handleSoloExitClick = useCallback(() => {
    if (alreadyConfirmed) {
      showToast(`Saída de ${student.nome} já foi confirmada hoje.`, false)
      return
    }
    if (!autorizaSaida) {
      setShowConfirmModal(true)
      return
    }
    executeSoloExit()
  }, [alreadyConfirmed, autorizaSaida, executeSoloExit, showToast, student.nome])

  const blocked = alreadyCalled || alreadyConfirmed || isCalling

  const handleCallRespClick = useCallback(() => {
    if (blocked) return
    
    // Find first permitted guardian
    const firstPermitted = respList.find((g: any) => {
      const isProibido = g.proibido === true
      const dias: string[] = g.diasSemana || []
      const remap2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
      const todayK = remap2[new Date().getDay()]
      const diaRestrito = dias.length > 0 && !dias.includes(todayK)
      return !isProibido && !diaRestrito
    })

    if (firstPermitted) {
      setIsCalling(true)
      onCall(student.id, student.nome, student.turmaNome || student.turma, firstPermitted.id, firstPermitted.name, studentPhoto)
      setTimeout(() => setIsCalling(false), 2000)
      showToast(`Chamando via ${firstPermitted.name}...`)
    } else {
      showToast('Nenhum responsável autorizado para hoje!', false)
    }
  }, [blocked, respList, student, studentPhoto, onCall, showToast])

  const hasAside = alreadyConfirmed || alreadyCalled || autorizaSaida

  return (
    <article
      className="search-student-card"
      style={{
        borderColor: alreadyConfirmed
          ? 'rgba(16, 185, 129, 0.4)'
          : alreadyCalled
            ? 'rgba(245, 158, 11, 0.5)'
            : undefined,
      }}
    >
      {/* 1. PROFILE: Photo + Name + Class + Autonomy/Status */}
      <div className="search-student-profile" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, flexShrink: 0,
          background: (studentPhoto && !imgError) ? 'none' : 'linear-gradient(135deg, #06b6d450, #6366f130)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, color: '#fff', fontFamily: 'Outfit, sans-serif',
          position: 'relative', overflow: 'hidden',
          border: (studentPhoto && !imgError) ? '1px solid hsl(var(--border-subtle))' : 'none',
        }}>
          {(studentPhoto && !imgError) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studentPhoto}
              alt={student.nome}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <div style={{
            fontWeight: 800,
            fontSize: 15,
            lineHeight: 1.25,
            color: 'hsl(var(--text-primary))',
            overflowWrap: 'break-word',
            textWrap: 'balance',
          }}>
            {student.nome}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px', fontSize: 11.5 }}>
            <span style={{ color: '#0891b2', fontWeight: 800 }}>
              {student.turmaNome || student.turma}{student.turno ? ` · ${student.turno.toUpperCase()}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
            {autorizaSaida ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '2px 9px', borderRadius: 100,
                background: 'rgba(16, 185, 129, 0.12)', color: '#059669',
                fontWeight: 800, border: '1px solid rgba(16, 185, 129, 0.28)',
              }}>
                Pode sair sozinho
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '2px 9px', borderRadius: 100,
                background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626',
                fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.22)',
              }}>
                Não pode sair sozinho
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. GUARDIANS: Responsive 1-2 col grid */}
      <div className="search-student-guardians" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Responsáveis autorizados
          </span>
          {respList.length > 0 && !blocked && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
              Toque para chamar
            </span>
          )}
        </div>

        {respList.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontStyle: 'italic', padding: '6px 0' }}>
            Nenhum responsável configurado.
          </div>
        ) : (
          <div className="search-student-guardians-grid">
            {respList.map((g: any) => {
              const isProibido = g.proibido === true
              const dias: string[] = g.diasSemana || []
              const remap2 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
              const todayK = remap2[new Date().getDay()]
              const diaRestrito = dias.length > 0 && !dias.includes(todayK)
              const isProibidoHoje = isProibido || diaRestrito
              const pickedUpByThis = alreadyConfirmed && (
                (confirmedCall?.guardianId && String(confirmedCall.guardianId) === String(g.id)) ||
                (confirmedCall?.guardianName && normalizeStr(confirmedCall.guardianName) === normalizeStr(g.name))
              )

              return (
                <button
                  key={g.id}
                  type="button"
                  className={`search-guardian-btn${blocked ? ' is-blocked' : ''}${isProibidoHoje ? ' is-restricted' : ''}${pickedUpByThis ? ' is-picked' : ''}`}
                  onClick={() => {
                    if (isProibido) {
                      setShowProibidoAlert({ name: g.name, message: 'está PROIBIDO(A) de retirar o aluno!' })
                      setTimeout(() => setShowProibidoAlert(null), 3000)
                      return
                    }
                    if (diaRestrito) {
                      setShowProibidoAlert({ name: g.name, message: 'não tem autorização para retirar HOJE!' })
                      setTimeout(() => setShowProibidoAlert(null), 3000)
                      return
                    }
                    if (!blocked) {
                      setIsCalling(true)
                      onCall(student.id, student.nome, student.turmaNome || student.turma, g.id, g.name, studentPhoto)
                      setTimeout(() => setIsCalling(false), 2000)
                    }
                  }}
                  disabled={blocked}
                  title={isProibido ? '🚫 Proibido de retirar este aluno' : diaRestrito ? `⚠ Dias permitidos: ${dias.join(', ')}` : pickedUpByThis ? '✅ Retirou o aluno hoje' : alreadyConfirmed ? 'Aluno já retirado hoje' : `Chamar ${student.nome} via ${g.name}`}
                  style={{
                    background: pickedUpByThis
                      ? 'rgba(16, 185, 129, 0.12)'
                      : alreadyConfirmed || blocked
                        ? 'hsl(var(--bg-elevated))'
                        : isProibidoHoje
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(59, 130, 246, 0.07)',
                    border: pickedUpByThis
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : alreadyConfirmed || blocked
                        ? '1px solid hsl(var(--border-subtle))'
                        : isProibidoHoje
                          ? '1px solid rgba(239, 68, 68, 0.28)'
                          : '1px solid rgba(59, 130, 246, 0.24)',
                    color: pickedUpByThis
                      ? '#059669'
                      : blocked
                        ? 'hsl(var(--text-muted))'
                        : isProibidoHoje
                          ? '#dc2626'
                          : '#1d4ed8',
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    opacity: (blocked && !pickedUpByThis) ? 0.65 : 1,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 13, flexShrink: 0, opacity: 0.85 }}>
                    {pickedUpByThis ? '✅' : isProibidoHoje ? '🚫' : '👤'}
                  </span>

                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      color: pickedUpByThis ? '#065f46' : isProibidoHoje ? '#b91c1c' : 'hsl(var(--text-primary))',
                      fontWeight: 700,
                      fontSize: 12.5,
                      lineHeight: 1.25,
                      overflowWrap: 'break-word',
                    }}>
                      {g.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                        background: 'rgba(148, 163, 184, 0.16)',
                        color: pickedUpByThis ? '#047857' : 'hsl(var(--text-secondary))',
                        whiteSpace: 'nowrap',
                      }}>
                        {g.role}
                      </span>
                      {g.rfid && (
                        <span style={{ fontSize: 9.5, color: '#2563eb', fontWeight: 700 }}>
                          📡 RFID
                        </span>
                      )}
                      {isProibido && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.14)', color: '#dc2626' }}>
                          PROIBIDO
                        </span>
                      )}
                      {!isProibido && diaRestrito && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(249, 115, 22, 0.14)', color: '#ea580c' }}>
                          DIA RESTRITO
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {pickedUpByThis ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#059669' }}>Retirou</span>
                    ) : isProibidoHoje ? (
                      <AlertCircle size={14} style={{ color: '#ef4444' }} />
                    ) : (
                      <ChevronRight size={14} style={{ opacity: blocked ? 0.35 : 0.65 }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. ASIDE: Confirmed / Waiting / Solo Exit (only rendered when relevant) */}
      {hasAside && (
        <div className="search-student-aside" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0 }}>
          {alreadyConfirmed ? (
            <div className="search-status-card" style={{
              background: 'rgba(16, 185, 129, 0.07)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}>
              <div className="search-aside-icon" style={{
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
              }}>
                {isSaiuSozinhoCall(confirmedCall) ? <UserCheck size={15} /> : <CheckCircle2 size={15} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.04em', color: '#059669', textTransform: 'uppercase' }}>
                    {isSaiuSozinhoCall(confirmedCall) ? 'Saiu sozinho' : 'Retirado por'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#047857',
                    background: 'rgba(16, 185, 129, 0.13)', padding: '1px 6px', borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}>
                    às {confirmedCall?.confirmedAt ? fmtTime(confirmedCall.confirmedAt) : fmtTime(confirmedCall?.calledAt)}
                  </span>
                </div>
                <span style={{
                  fontWeight: 700, fontSize: 12, color: '#065f46',
                  overflowWrap: 'break-word', lineHeight: 1.25,
                }}>
                  {isSaiuSozinhoCall(confirmedCall)
                    ? 'Saída autônoma confirmada'
                    : (confirmedCall?.guardianName || 'Autorizado')}
                </span>
              </div>
            </div>
          ) : alreadyCalled ? (
            <div className="search-status-card" style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}>
              <div className="search-aside-icon" style={{
                background: 'rgba(245, 158, 11, 0.16)',
                color: '#d97706',
              }}>
                <Megaphone size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.03em', color: '#b45309', textTransform: 'uppercase' }}>
                  Chamado na TV
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', lineHeight: 1.25 }}>
                  Aguardando confirmação
                </span>
              </div>
            </div>
          ) : autorizaSaida ? (
            <button
              type="button"
              onClick={handleSoloExitClick}
              disabled={blocked}
              className="search-solo-btn"
              style={{
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked ? 0.55 : 1,
              }}
            >
              <div className="search-aside-icon search-solo-icon">
                <UserCheck size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>
                  Registrar saiu sozinho
                </span>
                <span className="search-solo-sub" style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>
                  Confirmar saída autônoma
                </span>
              </div>
              <ChevronRight size={15} style={{ flexShrink: 0, opacity: 0.75 }} />
            </button>
          ) : null}
        </div>
      )}

      {/* Warning Alert Screens & Modals */}
      {showProibidoAlert && (
        <div
          className="chamada-modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(220, 38, 38, 0.95)',
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', animation: 'blink 0.5s ease-in-out infinite' }}>
            <h1 style={{ fontSize: 64, fontWeight: 900, marginBottom: 20 }}>🚫 ACESSO NEGADO</h1>
            <p style={{ fontSize: 32, fontWeight: 700 }}>{showProibidoAlert.name} {showProibidoAlert.message}</p>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div
          className="chamada-modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.78)',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="chamada-modal-panel"
            style={{
              background: 'hsl(var(--bg-elevated))',
              border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 24, padding: 24, width: '90%', maxWidth: 420,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(245, 158, 11, 0.15)',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 24,
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#000000', fontFamily: 'Outfit, sans-serif' }}>
                  Confirmar Saída Sozinho?
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  O(a) aluno(a) <strong style={{ color: '#000000' }}>{student.nome}</strong> <span style={{ color: '#ef4444', fontWeight: 800 }}>NÃO tem autorização cadastrada</span> para sair sozinho(a).
                  <br/><br/>
                  Deseja confirmar a saída sozinho(a) mesmo assim?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                  color: '#000000', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false)
                  executeSoloExit()
                }}
                style={{
                  flex: 1.4, height: 42, borderRadius: 12,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none',
                  color: '#fff', fontWeight: 800, fontSize: 12,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <CheckCircle2 size={14} /> Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}, (prev, next) => {
  return prev.student.id === next.student.id && 
         prev.activeCalls === next.activeCalls
})
function CallCardSkeleton() {
  return (
    <div className="skeleton-shimmer" style={{
      borderRadius: 16,
      background: 'hsl(var(--bg-elevated))',
      border: '1px solid hsl(var(--border-subtle))',
      minHeight: 220,
      aspectRatio: '1 / 1.3',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Background/Photo area placeholder */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)' }} />
      
      {/* Content Area */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Name */}
        <div style={{ width: '80%', height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }} />
        {/* Class */}
        <div style={{ width: '40%', height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
        
        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }} />
        
        {/* Footer info placeholder */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '50%', height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ width: '20%', height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
        </div>
        
        {/* Action Buttons placeholder */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ flex: 1.5, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Special Exit Sticker Component ──────────────────────────────────────────
interface SpecialLaunch {
  id: string
  studentId: string
  studentName: string
  studentClass: string
  studentPhoto?: string | null
  authorizedPerson: string
  loggedBy: string
  date: string
  time: string
  targetTime?: string | null
  validDays: number
  validFrom: string
  validUntil: string
  dayIndex: number
  remainingDays: number
  confirmedOut?: boolean
  confirmedAt?: string
}

const SPECIAL_AUTH_PRESET_TIMES: string[] = [
  'Indefinido',
  ...Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 15
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  })
]

const SPECIAL_AUTH_PRESET_DAYS: { value: number; label: string }[] = [
  { value: 1, label: '1 dia (Hoje)' },
  { value: 2, label: '2 dias' },
  { value: 3, label: '3 dias' },
  { value: 4, label: '4 dias' },
  { value: 5, label: '5 dias (1 sem. útil)' },
  { value: 7, label: '7 dias (1 semana)' },
  { value: 10, label: '10 dias' },
  { value: 14, label: '14 dias (2 semanas)' },
  { value: 15, label: '15 dias (Quinzena)' },
  { value: 20, label: '20 dias' },
  { value: 30, label: '30 dias (1 mês)' },
  { value: 60, label: '60 dias (2 meses)' },
  { value: 90, label: '90 dias (3 meses)' },
]

// ── Web Audio Chime para Novas Autorizações Especiais ────────────────────────
let sharedSpecialAuthAudioCtx: AudioContext | null = null

function getSpecialAuthAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedSpecialAuthAudioCtx || sharedSpecialAuthAudioCtx.state === 'closed') {
    sharedSpecialAuthAudioCtx = new AudioContextClass()
  }
  if (sharedSpecialAuthAudioCtx.state === 'suspended') {
    sharedSpecialAuthAudioCtx.resume().catch(() => {})
  }
  return sharedSpecialAuthAudioCtx
}

function playSpecialAuthChime(): void {
  try {
    const ctx = getSpecialAuthAudioCtx()
    if (!ctx) return
    const now = ctx.currentTime

    // Sequência melódica chamativa e elegante estilo aviso escolar / aeroporto (~2.2s total):
    // Frase 1 (Aviso/Atenção): Sol4 (392Hz) -> Dó5 (523Hz) -> Mi5 (659Hz)
    // Frase 2 (Destaque Principal): Sol5 (784Hz) -> Dó6 (1046.5Hz) com ressonância de sino
    const pattern = [
      { time: 0.00, freq: 392.00, duration: 0.36, gain: 0.28 }, // G4
      { time: 0.24, freq: 523.25, duration: 0.36, gain: 0.30 }, // C5
      { time: 0.48, freq: 659.25, duration: 0.40, gain: 0.32 }, // E5
      { time: 0.74, freq: 783.99, duration: 0.46, gain: 0.34 }, // G5
      { time: 1.02, freq: 1046.50, duration: 1.25, gain: 0.38 }, // C6 (Sino principal agudo sustentado)
      { time: 1.04, freq: 523.25, duration: 1.20, gain: 0.22 },  // C5 (Corpo harmônico de apoio)
    ]

    pattern.forEach(({ time, freq, duration, gain: maxGain }) => {
      const startTime = now + time
      const endTime = startTime + duration

      // Oscilador 1: Tom fundamental limpo e encorpado
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, startTime)

      gain1.gain.setValueAtTime(0.0001, startTime)
      gain1.gain.exponentialRampToValueAtTime(maxGain, startTime + 0.025)
      gain1.gain.exponentialRampToValueAtTime(0.0001, endTime)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(startTime)
      osc1.stop(endTime + 0.05)

      // Oscilador 2: Brilho metálico tipo sino (triangle na oitava superior)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2, startTime)

      gain2.gain.setValueAtTime(0.0001, startTime)
      gain2.gain.exponentialRampToValueAtTime(maxGain * 0.24, startTime + 0.02)
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(duration, 0.42))

      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(startTime)
      osc2.stop(startTime + Math.min(duration, 0.42) + 0.05)
    })
  } catch (err) {
    console.warn('[SpecialAuthChime] Não foi possível reproduzir som:', err)
  }
}

function hasSpecialAuthChanged(a: PickupCall, b: PickupCall): boolean {
  if (a === b) return false
  if (
    a.status !== b.status ||
    a.guardianName !== b.guardianName ||
    a.studentName !== b.studentName ||
    a.studentClass !== b.studentClass ||
    a.studentPhoto !== b.studentPhoto ||
    a.targetTime !== b.targetTime ||
    a.validDays !== b.validDays ||
    a.validFrom !== b.validFrom ||
    a.validUntil !== b.validUntil ||
    a.confirmedOut !== b.confirmedOut ||
    a.confirmedAt !== b.confirmedAt ||
    a.confirmedBy !== b.confirmedBy
  ) {
    return true
  }
  const aKeys = a.confirmedDates ? Object.keys(a.confirmedDates) : []
  const bKeys = b.confirmedDates ? Object.keys(b.confirmedDates) : []
  if (aKeys.length !== bKeys.length) return true
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i]
    if (a.confirmedDates![k] !== b.confirmedDates?.[k]) return true
  }
  return false
}

const SpecialExitSticker = React.memo(function SpecialExitSticker({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const { addSpecialAuth, confirmSpecialExit, deleteCall, cancelCall, callStudent, confirmPickup, recallStudent, activeCalls = [], realtimeStatus } = useSaida()
  const { on: onRealtime } = useBroadcastRealtime()
  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const { currentUser } = useApp()
  const isMobile = useIsMobile()

  // Form State
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [authorizedPerson, setAuthorizedPerson] = useState('')
  const [specialAuthTime, setSpecialAuthTime] = useState('Indefinido')
  const [specialAuthDays, setSpecialAuthDays] = useState<number>(1)
  const [isCustomDays, setIsCustomDays] = useState<boolean>(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [currentTodayStr, setCurrentTodayStr] = useState<string>(() => getCampoGrandeDateStr())

  // ── Alerta Sonoro de Autorização Especial ──
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem('saida_special_auth_sound')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev
      try {
        localStorage.setItem('saida_special_auth_sound', String(next))
      } catch {}
      return next
    })
  }, [])

  // Desbloqueia o AudioContext no primeiro gesto do usuário na página
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = getSpecialAuthAudioCtx()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
    window.addEventListener('click', unlockAudio, { passive: true })
    window.addEventListener('keydown', unlockAudio, { passive: true })
    window.addEventListener('touchstart', unlockAudio, { passive: true })
    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [])

  // Registro permanente de IDs de autorizações especiais que já existiam ou já tocaram som nesta sessão
  const playedSoundIdsRef = useRef<Set<string>>(new Set())

  const triggerSpecialAuthSound = useCallback((callId?: string) => {
    if (!soundEnabled) return
    if (callId) {
      if (playedSoundIdsRef.current.has(callId)) return
      playedSoundIdsRef.current.add(callId)
    }
    playSpecialAuthChime()
  }, [soundEnabled])

  // ── Persistent accumulator: stores special_auth entries active today ──
  const seenSpecialAuthsRef = useRef<Map<string, PickupCall>>(new Map())
  const [seenSpecialAuthsVersion, setSeenSpecialAuthsVersion] = useState(0)

  // Detecção automática de virada de dia (meia-noite): reseta o estado diário ("verde/confirmado")
  // para o novo dia sem perder autorizações multi-dias ainda dentro da validade!
  useEffect(() => {
    const checkRollover = () => {
      const nextToday = getCampoGrandeDateStr()
      setCurrentTodayStr(prevToday => {
        if (prevToday !== nextToday) {
          let changed = false
          for (const [id, call] of seenSpecialAuthsRef.current.entries()) {
            const val = resolveSpecialAuthValidity(call, nextToday)
            if (!val.isActiveToday) {
              seenSpecialAuthsRef.current.delete(id)
              changed = true
            }
          }
          if (changed) setSeenSpecialAuthsVersion(v => v + 1)
          return nextToday
        }
        return prevToday
      })
    }
    const timer = setInterval(checkRollover, 30000)
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkRollover()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // Escuta imediata de eventos broadcast (DELETE_CALL, CANCEL_CALL, CONFIRM_PICKUP, REVERT_CALL, SPECIAL_AUTH_NOTIFY e CALL_STUDENT)
  useEffect(() => {
    const unsub = onRealtime('*', payload => {
      const d = payload.data as any
      const todayKey = getCampoGrandeDateStr()
      if (payload.event === 'DELETE_CALL' && d?.callId) {
        if (seenSpecialAuthsRef.current.has(d.callId)) {
          seenSpecialAuthsRef.current.delete(d.callId)
          setSeenSpecialAuthsVersion(v => v + 1)
        }
      } else if (payload.event === 'CANCEL_CALL' && d?.callId) {
        if (seenSpecialAuthsRef.current.has(d.callId)) {
          seenSpecialAuthsRef.current.delete(d.callId)
          setSeenSpecialAuthsVersion(v => v + 1)
        }
      } else if (payload.event === 'CONFIRM_PICKUP') {
        const targetStudentId = d?.studentId ? String(d.studentId).trim() : ''
        const confIso = d?.confirmedAt || new Date().toISOString()
        let updated = false
        for (const [id, entry] of seenSpecialAuthsRef.current.entries()) {
          if (id === d?.callId || (targetStudentId && String(entry.studentId || '').trim() === targetStudentId)) {
            const nextDates = { ...(entry.confirmedDates || {}), [todayKey]: confIso }
            seenSpecialAuthsRef.current.set(id, {
              ...entry,
              confirmedDates: nextDates,
              confirmedOut: true,
              confirmedAt: confIso,
            })
            updated = true
          }
        }
        if (updated) setSeenSpecialAuthsVersion(v => v + 1)
      } else if (payload.event === 'REVERT_CALL') {
        const targetStudentId = d?.studentId ? String(d.studentId).trim() : ''
        let updated = false
        for (const [id, entry] of seenSpecialAuthsRef.current.entries()) {
          if (id === d?.callId || (targetStudentId && String(entry.studentId || '').trim() === targetStudentId)) {
            const nextDates = { ...(entry.confirmedDates || {}) }
            if (nextDates[todayKey] || entry.confirmedOut) {
              delete nextDates[todayKey]
              seenSpecialAuthsRef.current.set(id, {
                ...entry,
                confirmedDates: nextDates,
                confirmedOut: false,
                confirmedAt: undefined,
              })
              updated = true
            }
          }
        }
        if (updated) setSeenSpecialAuthsVersion(v => v + 1)
      } else if (
        (payload.event === 'SPECIAL_AUTH_NOTIFY' && !d?.isTest) ||
        (payload.event === 'CALL_STUDENT' && d?.status === 'special_auth')
      ) {
        const incomingId = d?.id || d?.callId
        if (incomingId && !seenSpecialAuthsRef.current.has(incomingId)) {
          const alreadyKnown = playedSoundIdsRef.current.has(incomingId)
          const calledAtMs = d?.calledAt ? new Date(d.calledAt).getTime() : Date.now()
          const isNewlyInserted = !isNaN(calledAtMs) && Math.abs(Date.now() - calledAtMs) < 30000

          const incomingTargetTime = d.targetTime || d.target_time || d.dados?.targetTime || d.dados?.target_time || d.horarioPrevisto || d.scheduledTime || null
          seenSpecialAuthsRef.current.set(incomingId, {
            ...d,
            id: incomingId,
            status: 'special_auth',
            targetTime: incomingTargetTime || undefined
          })
          setSeenSpecialAuthsVersion(v => v + 1)

          if (!alreadyKnown && isNewlyInserted) {
            triggerSpecialAuthSound(incomingId)
          } else {
            playedSoundIdsRef.current.add(incomingId)
          }
        }
      }
    })
    return () => { unsub() }
  }, [onRealtime, triggerSpecialAuthSound])

  // Sincronização fallback com /api/saida/calls?onlySpecialAuth=true apenas quando o Realtime estiver fora do ar
  // (em operação normal online, SaidaProvider já carrega e mantém activeCalls sincronizado em tempo real)
  useEffect(() => {
    if (realtimeStatus === 'online') return
    let isSubscribed = true
    const fetchSpecialAuths = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const res = await fetch(`/api/saida/calls?onlySpecialAuth=true&_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        if (!res.ok) return
        const data = await res.json()
        const arr: PickupCall[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        if (!isSubscribed) return
        let changed = false
        const todayYmd = getCampoGrandeDateStr()

        const dbCallMap = new Map(arr.map(c => [c.id, c]))

        // Prunar autorizações que não existem mais, expiraram ou foram canceladas no banco
        for (const [id, seenCall] of seenSpecialAuthsRef.current.entries()) {
          const dbCall = dbCallMap.get(id)
          if (!dbCall) {
            const isVeryRecent = Date.now() - new Date(seenCall.calledAt).getTime() < 5000
            if (!isVeryRecent) {
              seenSpecialAuthsRef.current.delete(id)
              changed = true
            }
          } else if (dbCall.status === 'cancelled' || dbCall.status !== 'special_auth' || !resolveSpecialAuthValidity(dbCall, todayYmd).isActiveToday) {
            seenSpecialAuthsRef.current.delete(id)
            changed = true
          }
        }

        for (const c of arr) {
          if (c.status === 'special_auth' && resolveSpecialAuthValidity(c, todayYmd).isActiveToday) {
            playedSoundIdsRef.current.add(c.id)
            const existing = seenSpecialAuthsRef.current.get(c.id)
            const incomingTargetTime = c.targetTime || (c as any).target_time || (c as any).dados?.targetTime || (c as any).dados?.target_time || (c as any).horarioPrevisto || (c as any).scheduledTime || null
            if (!existing) {
              seenSpecialAuthsRef.current.set(c.id, {
                ...c,
                targetTime: incomingTargetTime || undefined
              })
              changed = true
            } else if (existing.targetTime !== incomingTargetTime || hasSpecialAuthChanged(existing, c)) {
              seenSpecialAuthsRef.current.set(c.id, {
                ...existing,
                ...c,
                targetTime: incomingTargetTime || existing?.targetTime || undefined
              })
              changed = true
            }
          }
        }
        if (changed) setSeenSpecialAuthsVersion(v => v + 1)
      } catch (err) {
        console.warn('[SpecialExitSticker] Falha ao sincronizar autorizações especiais:', err)
      }
    }
    if (realtimeStatus === 'offline') {
      fetchSpecialAuths()
    }
    const timer = setInterval(fetchSpecialAuths, 60000)
    return () => {
      isSubscribed = false
      clearInterval(timer)
    }
  }, [realtimeStatus])

  // Whenever activeCalls changes, absorb any special_auth entries into the accumulator,
  // e remove aquelas canceladas ou expiradas (apenas sincroniza estado — NUNCA dispara som aqui)
  useEffect(() => {
    let changed = false
    const activeMap = new Map(activeCalls.map(c => [c.id, c]))

    // 1. Prunar apenas se explicitamente cancelado ou expirado
    for (const [id, seenCall] of seenSpecialAuthsRef.current.entries()) {
      if (!resolveSpecialAuthValidity(seenCall, currentTodayStr).isActiveToday) {
        seenSpecialAuthsRef.current.delete(id)
        changed = true
        continue
      }
      const liveCall = activeMap.get(id)
      if (liveCall && (liveCall.status === 'cancelled' || (liveCall.status !== 'special_auth' && liveCall.status !== 'confirmed'))) {
        seenSpecialAuthsRef.current.delete(id)
        changed = true
      }
    }

    // 2. Absorver special_auth vigentes hoje sem disparar som
    for (const c of activeCalls) {
      if (c.status === 'special_auth' && resolveSpecialAuthValidity(c, currentTodayStr).isActiveToday) {
        playedSoundIdsRef.current.add(c.id)
        const existing = seenSpecialAuthsRef.current.get(c.id)
        const incomingTargetTime = c.targetTime || (c as any).target_time || (c as any).dados?.targetTime || (c as any).dados?.target_time || (c as any).horarioPrevisto || (c as any).scheduledTime || null
        if (!existing) {
          seenSpecialAuthsRef.current.set(c.id, {
            ...c,
            targetTime: incomingTargetTime || undefined
          })
          changed = true
        } else if (existing.targetTime !== incomingTargetTime || hasSpecialAuthChanged(existing, c)) {
          seenSpecialAuthsRef.current.set(c.id, {
            ...existing,
            ...c,
            targetTime: incomingTargetTime || existing?.targetTime || undefined
          })
          changed = true
        }
      }
    }
    // Force a re-render if entries changed
    if (changed) setSeenSpecialAuthsVersion(v => v + 1)
  }, [activeCalls, currentTodayStr])

  // Remove a specific special_auth from the accumulator (called from the delete handler)
  const removeFromAccumulator = useCallback((callId: string) => {
    seenSpecialAuthsRef.current.delete(callId)
    setSeenSpecialAuthsVersion(v => v + 1)
  }, [])

  // Computed Launches — uses the ACCUMULATOR (persistent) as source + activeCalls for today's confirmed status
  const launches = useMemo(() => {
    // seenSpecialAuthsVersion is referenced here only to trigger re-computation when accumulator changes
    void seenSpecialAuthsVersion
    const specialAuthEntries = Array.from(seenSpecialAuthsRef.current.values())
      .filter(c => resolveSpecialAuthValidity(c, currentTodayStr).isActiveToday)

    return specialAuthEntries.map(c => {
      const sId = c.studentId ? String(c.studentId).trim() : ''
      const sName = c.studentName ? c.studentName.trim().toLowerCase() : ''
      const validity = resolveSpecialAuthValidity(c, currentTodayStr)

      // Encontra a chamada confirmada do aluno ESTRITAMENTE NO DIA DE HOJE (currentTodayStr)
      // Isso garante que se foi confirmada ontem, hoje (novo dia dentro da validade) volte a aparecer não-confirmada!
      const pickUpCallToday = activeCalls.find(ac => {
        if (ac.status !== 'confirmed') return false
        const acDate = getCampoGrandeDateStr(ac.confirmedAt || ac.calledAt)
        if (acDate !== currentTodayStr) return false
        const acId = ac.studentId ? String(ac.studentId).trim() : ''
        const acName = ac.studentName ? ac.studentName.trim().toLowerCase() : ''
        return (sId && acId && sId === acId) || (sName && acName && sName === acName)
      })

      const isConfirmedToday = Boolean(pickUpCallToday) || validity.isConfirmedToday
      const confirmedIsoToday = pickUpCallToday?.confirmedAt || pickUpCallToday?.calledAt || validity.confirmedAtToday

      // Resolução inteligente do horário inserido (targetTime)
      let resolvedTargetTime = 
        c.targetTime ||
        (c as any).target_time ||
        (c as any).dados?.targetTime ||
        (c as any).dados?.target_time ||
        (c as any).horarioPrevisto ||
        (c as any).horario_previsto ||
        (c as any).scheduledTime ||
        (c as any).scheduled_time ||
        (c as any).horario ||
        (c as any).dados?.horario ||
        null

      if (!resolvedTargetTime && c.guardianName) {
        // Fallback para autorizações lançadas anteriormente onde o horário veio no texto
        const match = c.guardianName.match(/(?:às|as|horário|horario|ás)?\s*(\b[0-2]?\d[h:][0-5]\d\b|\b[0-2]?\dh\b)/i)
        if (match) {
          resolvedTargetTime = match[1].replace('h', ':').replace(/:$/, ':00')
          if (resolvedTargetTime.length === 4 && resolvedTargetTime.indexOf(':') === 1) {
            resolvedTargetTime = '0' + resolvedTargetTime
          }
        }
      }

      return {
        id: c.id,
        studentId: c.studentId,
        studentName: c.studentName,
        studentClass: c.studentClass,
        studentPhoto: c.studentPhoto,
        authorizedPerson: c.guardianName,
        loggedBy: c.operatorId || 'Sistema',
        date: validity.validFrom,
        time: fmtTime(c.calledAt),
        targetTime: resolvedTargetTime,
        validDays: validity.validDays,
        validFrom: validity.validFrom,
        validUntil: validity.validUntil,
        dayIndex: validity.dayIndex,
        remainingDays: validity.remainingDays,
        calledAtMs: new Date(c.calledAt).getTime(),
        confirmedOut: isConfirmedToday,
        confirmedAt: confirmedIsoToday ? fmtTime(confirmedIsoToday) : undefined
      }
    })
    // Mais recente primeiro
    .sort((a, b) => b.calledAtMs - a.calledAtMs)
  }, [activeCalls, seenSpecialAuthsVersion, currentTodayStr])



  // Search autocomplete debounced
  useEffect(() => {
    const q = search.trim()
    if (q.length < 3 || selectedStudent) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=5&page=1&withPhoto=true&lightweight=true`, {
          cache: 'no-store'
        })
        if (!res.ok) throw new Error('Falha ao buscar')
        const json = await res.json()
        const data = json.data || []

        const filtered = data.filter((a: any) =>
          ['ativo', 'matriculado'].includes(String(a.status || '').trim().toLowerCase())
        )

        const mapped = filtered.map((a: any) => {
          const turmaObj = (todasTurmas || []).find((t: any) => 
            String(t.id) === String(a.turma) || t.codigo === a.turma || t.nome === a.turma
          )
          return { ...a, turmaNome: turmaObj?.nome || a.turma }
        })
        setResults(mapped)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, selectedStudent, todasTurmas])

  const handleConfirm = () => {
    if (!selectedStudent || !authorizedPerson.trim()) return

    const operatorName = currentUser?.nome || 'Admin Logado'
    const sId = String(selectedStudent.id)
    const sName = selectedStudent.nome
    const sClass = selectedStudent.turmaNome || selectedStudent.turma
    const sPhoto = selectedStudent.foto || selectedStudent.foto_url || selectedStudent.fotoUrl || selectedStudent.avatarUrl || selectedStudent.imagem1 || selectedStudent.dados?.foto || selectedStudent.dados?.avatarUrl || null
    const authPerson = authorizedPerson.trim()
    const validDaysToUse = Math.max(1, Math.min(365, Math.round(Number(specialAuthDays) || 1)))
    
    // Registra no histórico de lançamentos de autorização especial (com quantidade de dias de validade)
    const createdCall = addSpecialAuth(
      sId,
      sName,
      sClass,
      authPerson,
      operatorName,
      sPhoto,
      specialAuthTime || 'Indefinido',
      validDaysToUse
    )

    if (createdCall?.id) {
      seenSpecialAuthsRef.current.set(createdCall.id, createdCall)
      setSeenSpecialAuthsVersion(v => v + 1)
      triggerSpecialAuthSound(createdCall.id)
    } else {
      triggerSpecialAuthSound()
    }

    if (validDaysToUse > 1) {
      const untilDateBR = formatShortDateBR(addCalendarDays(currentTodayStr, validDaysToUse - 1))
      showToast(`Autorização lançada para ${sName} por ${validDaysToUse} dias (válida até ${untilDateBR})!`, true)
    } else {
      showToast(`Autorização lançada no card para ${sName}! Clique no alto-falante 📣 para chamar.`, true)
    }

    // Reset Form
    setSelectedStudent(null)
    setSearch('')
    setAuthorizedPerson('')
    setSpecialAuthTime('Indefinido')
    setSpecialAuthDays(1)
    setIsCustomDays(false)
  }


  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.04) 100%)',
      border: '1.5px solid rgba(245, 158, 11, 0.35)',
      borderRadius: 24,
      padding: '14px 18px',
      boxShadow: 'var(--shadow-lg), inset 0 0 20px rgba(245,158,11,0.03)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      height: '100%',
      minHeight: 0,
      maxHeight: isMobile ? undefined : 410,
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}
    >
      {/* 📌 Floating Pushpin */}
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        fontSize: 22, zIndex: 10, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
      }}>
        📌
      </div>

      <div style={{
        fontWeight: 900,
        fontSize: 13,
        color: '#d97706',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        fontFamily: 'Outfit, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          📝 Autorização Especial do Dia
        </span>
        <button
          type="button"
          onClick={toggleSound}
          title={soundEnabled ? 'Alerta sonoro ativado para novas autorizações (clique para silenciar)' : 'Alerta sonoro desativado (clique para ativar)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            border: soundEnabled ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(148, 163, 184, 0.3)',
            background: soundEnabled ? 'rgba(245, 158, 11, 0.16)' : 'rgba(148, 163, 184, 0.12)',
            color: soundEnabled ? '#d97706' : '#94a3b8',
            transition: 'all 0.15s ease',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.04)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {soundEnabled ? (
            <>
              <Volume2 size={13} style={{ color: '#d97706' }} />
              <span>Som Ativo</span>
            </>
          ) : (
            <>
              <VolumeX size={13} style={{ color: '#94a3b8' }} />
              <span>Mudo</span>
            </>
          )}
        </button>
      </div>

      {/* COMPACT FORM GRID (SEARCH, AUTHORIZED PERSON, TIME, DAYS, SUBMIT BUTTON) - SINGLE LINE ON DESKTOP */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        flexShrink: 0,
      }}>
        {/* COLUMN 1: STUDENT SEARCH OR SELECTION */}
        <div style={{ flex: isMobile ? '1 1 100%' : '1.1 1 0%', minWidth: 0, position: 'relative' }}>
          {!selectedStudent ? (
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#d97706' }}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar aluno..."
                className="form-input"
                style={{
                  width: '100%', padding: '6px 8px 6px 26px',
                  borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.45)',
                  background: 'hsl(var(--bg-surface))', fontSize: 11.5,
                  color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
                  height: 36,
                }}
              />

              {isSearching ? (
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={12} className="spin" color="#f59e0b" />
                </div>
              ) : search.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSearch(''); }}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d97706' }}
                >
                  <X size={13} />
                </button>
              ) : null}

              {/* Autocomplete Results */}
              {results.length > 0 && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
                  minWidth: 220,
                  background: 'hsl(var(--bg-surface))', border: '1px solid rgba(245, 158, 11, 0.45)',
                  borderRadius: 12, overflow: 'hidden', zIndex: 50,
                  boxShadow: 'var(--shadow-xl)',
                }}>
                  {results.map(a => (
                    <div
                      key={a.id}
                      onClick={() => { setSelectedStudent(a); setResults([]); setSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', cursor: 'pointer',
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, overflow: 'hidden',
                        background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900, color: '#f59e0b',
                      }}>
                        {(() => {
                          const aPhoto = a.foto || a.foto_url || a.fotoUrl || a.avatarUrl || a.imagem1 || a.dados?.foto || a.dados?.avatarUrl || null
                          return aPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={aPhoto} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          ) : (
                            a.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                          )
                        })()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.nome}>
                          {abbreviateStudentName(a.nome, 24)}
                        </div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.turmaNome || a.turma}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected Student Badge */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 6px', borderRadius: 10, height: 36,
              background: 'hsl(var(--bg-surface))', border: '1.5px dashed rgba(245, 158, 11, 0.45)',
              position: 'relative', boxSizing: 'border-box',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, overflow: 'hidden',
                background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8.5, fontWeight: 900, color: '#f59e0b', flexShrink: 0,
              }}>
                {(() => {
                  const selPhoto = selectedStudent.foto || selectedStudent.foto_url || selectedStudent.fotoUrl || selectedStudent.avatarUrl || selectedStudent.imagem1 || selectedStudent.dados?.foto || selectedStudent.dados?.avatarUrl || null
                  return selPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selPhoto} alt={selectedStudent.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  ) : (
                    selectedStudent.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                  )
                })()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }} title={selectedStudent.nome}>
                <div style={{ fontWeight: 800, fontSize: 10, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {abbreviateStudentName(selectedStudent.nome, 18)}
                </div>
                <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudent.turmaNome || selectedStudent.turma}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedStudent(null); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'hsl(var(--text-muted))', display: 'flex', padding: 2, flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'hsl(var(--text-muted))'}
              >
                <X size={12}/>
              </button>
            </div>
          )}
        </div>

        {/* COLUMN 2: AUTHORIZED PERSON */}
        <div style={{ flex: isMobile ? '1 1 100%' : '0.95 1 0%', minWidth: 0 }}>
          <input
            value={authorizedPerson}
            onChange={e => setAuthorizedPerson(e.target.value)}
            placeholder="Autorizado..."
            disabled={!selectedStudent}
            className="form-input"
            style={{
              width: '100%', padding: '6px 8px',
              borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'hsl(var(--bg-surface))', fontSize: 11.5,
              color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
              opacity: selectedStudent ? 1 : 0.5,
              height: 36,
            }}
          />
        </div>

        {/* COLUMN 3: SCHEDULED TIME */}
        <div style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '0.9 1 0%', minWidth: 0, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, height: 36, width: '100%', minWidth: 0,
            padding: '0 6px', borderRadius: 10,
            border: '1px solid rgba(245, 158, 11, 0.45)',
            background: 'hsl(var(--bg-surface))',
            boxSizing: 'border-box',
            opacity: selectedStudent ? 1 : 0.5,
          }}
          title="Horário previsto para retirada"
          >
            <Clock size={12} color="#d97706" style={{ flexShrink: 0 }} />
            <select
              value={specialAuthTime}
              onChange={e => setSpecialAuthTime(e.target.value)}
              disabled={!selectedStudent}
              style={{
                border: 'none', background: 'transparent',
                fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-primary))',
                outline: 'none', flex: 1, width: '100%', minWidth: 0, cursor: selectedStudent ? 'pointer' : 'not-allowed',
              }}
            >
              {SPECIAL_AUTH_PRESET_TIMES.map(t => (
                <option key={t} value={t}>{t === 'Indefinido' ? 'Indefinido' : t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* COLUMN 4: VALIDITY DAYS (QUANTIDADE DE DIAS DE VALIDADE) */}
        <div style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '0.95 1 0%', minWidth: 0, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, height: 36, width: '100%', minWidth: 0,
            padding: '0 6px', borderRadius: 10,
            border: specialAuthDays > 1 ? '1.5px solid #d97706' : '1px solid rgba(245, 158, 11, 0.45)',
            background: specialAuthDays > 1 ? 'rgba(245, 158, 11, 0.08)' : 'hsl(var(--bg-surface))',
            boxSizing: 'border-box',
            opacity: selectedStudent ? 1 : 0.5,
            transition: 'all 0.2s',
          }}
          title={
            specialAuthDays > 1
              ? `Autorização válida por ${specialAuthDays} dias (de ${formatShortDateBR(currentTodayStr)} até ${formatShortDateBR(addCalendarDays(currentTodayStr, Math.max(1, specialAuthDays) - 1))})`
              : 'Quantidade de dias que esta autorização ficará válida'
          }
          >
            <Calendar size={12} color="#d97706" style={{ flexShrink: 0 }} />
            {!isCustomDays ? (
              <select
                value={SPECIAL_AUTH_PRESET_DAYS.some(d => d.value === specialAuthDays) ? String(specialAuthDays) : 'custom'}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    setIsCustomDays(true)
                  } else {
                    setSpecialAuthDays(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                }}
                disabled={!selectedStudent}
                style={{
                  border: 'none', background: 'transparent',
                  fontSize: 11, fontWeight: 700, color: specialAuthDays > 1 ? '#b45309' : 'hsl(var(--text-primary))',
                  outline: 'none', flex: 1, width: '100%', minWidth: 0, cursor: selectedStudent ? 'pointer' : 'not-allowed',
                }}
              >
                {SPECIAL_AUTH_PRESET_DAYS.map(d => (
                  <option key={d.value} value={String(d.value)}>{d.label}</option>
                ))}
                <option value="custom">Outro (digitar dias)...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%', minWidth: 0 }}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={specialAuthDays}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10)
                    setSpecialAuthDays(isNaN(val) ? 1 : Math.max(1, Math.min(365, val)))
                  }}
                  disabled={!selectedStudent}
                  style={{
                    border: 'none', background: 'transparent',
                    fontSize: 11.5, fontWeight: 800, color: '#b45309',
                    outline: 'none', width: 34, padding: 0,
                  }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', whiteSpace: 'nowrap' }}>
                  {specialAuthDays === 1 ? 'dia' : 'dias'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDays(false)
                    if (!SPECIAL_AUTH_PRESET_DAYS.some(d => d.value === specialAuthDays)) {
                      setSpecialAuthDays(7)
                    }
                  }}
                  title="Voltar para lista de opções"
                  style={{
                    background: 'none', border: 'none', padding: 1, cursor: 'pointer',
                    color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT BUTTON: LANÇAR */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirm(); }}
          disabled={!selectedStudent || !authorizedPerson.trim()}
          style={{
            flex: isMobile ? '1 0 100%' : '0 0 auto',
            height: 36, padding: '0 11px', borderRadius: 10,
            background: (!selectedStudent || !authorizedPerson.trim())
              ? 'hsl(var(--bg-elevated))'
              : 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: (!selectedStudent || !authorizedPerson.trim()) ? '1px solid hsl(var(--border-subtle))' : 'none',
            color: (!selectedStudent || !authorizedPerson.trim()) ? 'hsl(var(--text-muted))' : '#fff',
            fontWeight: 800, fontSize: 10.5, cursor: (!selectedStudent || !authorizedPerson.trim()) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
            boxShadow: (!selectedStudent || !authorizedPerson.trim()) ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.25)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!selectedStudent || !authorizedPerson.trim()) return
            e.currentTarget.style.filter = 'brightness(1.1)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.filter = 'none'
            e.currentTarget.style.transform = 'none'
          }}
        >
          <CheckCircle2 size={12}/> Lançar
        </button>
      </div>

      {/* TIMELINE LOG OF TODAY'S RELEASES */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ borderTop: '1px solid rgba(245,158,11,0.22)', paddingTop: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚡ Autorizações Ativas Hoje ({formatShortDateBR(currentTodayStr)})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {launches.some(l => l.confirmedOut) && (
              <span style={{ fontSize: 9, color: '#10b981', fontWeight: 800 }}>
                {launches.filter(l => l.confirmedOut).length} confirmada(s) hoje
              </span>
            )}
            <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{launches.length} total</span>
          </div>
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          alignContent: 'start',
          alignItems: 'start',
          gap: 8,
          paddingRight: 4,
        }}>
          {launches.map(l => (
            <div
              key={l.id}
              className="chamada-mini-card"
              style={{
                background: l.confirmedOut
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.08) 100%)'
                  : 'hsl(var(--bg-surface))', 
                border: l.confirmedOut
                  ? '1.5px solid rgba(16, 185, 129, 0.55)'
                  : '1px solid rgba(245, 158, 11, 0.22)',
                borderRadius: 12,
                padding: '6px 9px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                boxShadow: l.confirmedOut
                  ? '0 2px 8px rgba(16, 185, 129, 0.12)'
                  : 'var(--shadow-sm)',
                minWidth: 0,
              }}
            >
              {/* TOP ROW: AVATAR + INFO + ACTION BUTTONS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, overflow: 'hidden',
                  background: l.confirmedOut ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.12)', 
                  border: l.confirmedOut ? '1.5px solid #10b981' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 900, color: l.confirmedOut ? '#059669' : '#f59e0b', flexShrink: 0,
                }}>
                  {l.studentPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.studentPhoto} alt={l.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  ) : (
                    l.studentName.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 800,
                    fontSize: 11,
                    color: l.confirmedOut ? '#065f46' : 'hsl(var(--text-primary))',
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={l.studentName}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {abbreviateStudentName(l.studentName, 22)}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: l.confirmedOut ? '#047857' : 'hsl(var(--text-muted))', marginTop: 1, lineHeight: 1.25, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    retirado por: <span style={{ color: l.confirmedOut ? '#059669' : '#d97706', fontWeight: 800 }}>{l.authorizedPerson}</span>
                  </div>
                  <div style={{ fontSize: 8.5, color: l.confirmedOut ? '#047857' : 'hsl(var(--text-muted))', marginTop: 2, lineHeight: 1.15, display: 'flex', gap: 4, fontWeight: 500, flexWrap: 'wrap' }}>
                    <span>{l.time}</span>
                    <span>·</span>
                    <span title={l.loggedBy}>por: <span style={{ color: l.confirmedOut ? '#065f46' : 'hsl(var(--text-secondary))', fontWeight: 700 }}>{formatFirstAndSecondName(l.loggedBy)}</span></span>
                  </div>
                </div>
                
                {/* MICRO ACTION BUTTONS (STACKED: TOP LINE = CHAMAR + CONFIRMAR, BOTTOM LINE = EXCLUIR) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2.5, flexShrink: 0 }}>
                  {/* LINE 1: CHAMAR & CONFIRMAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {/* 1. BUTTON: CALL / RECALL STUDENT */}
                    {(() => {
                      const lStudentId = l.studentId ? String(l.studentId) : ''
                      const isCalling = (activeCalls || []).some(c => c.studentId != null && String(c.studentId) === lStudentId && (c.status === 'waiting' || c.status === 'called'))
                      const btnColor = isCalling ? '#f59e0b' : '#818cf8'
                      const btnBg = isCalling ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)'
                      const btnHoverColor = '#fff'
                      const btnHoverBg = isCalling ? '#f59e0b' : '#6366f1'
                      const btnShadow = isCalling ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)'

                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const existingCall = (activeCalls || []).find(c => c.studentId != null && String(c.studentId) === lStudentId && (c.status === 'waiting' || c.status === 'called'))
                            if (existingCall) {
                              recallStudent(existingCall.id, () => {})
                              showToast(`Aluno ${l.studentName} chamado novamente!`, true)
                            } else {
                              callStudent(
                                l.studentId,
                                l.studentName,
                                l.studentClass,
                                'special-auth',
                                l.authorizedPerson,
                                'manual',
                                undefined,
                                l.studentPhoto,
                                false,
                                l.targetTime || undefined
                              )
                              showToast(`Aluno ${l.studentName} chamado na TV!`, true)
                            }
                          }}
                          title={isCalling ? "Aluno sendo chamado na TV. Clique para rechamar" : "Chamar Aluno na TV"}
                          style={{
                            background: btnBg, border: 'none', cursor: 'pointer',
                            borderRadius: 6, width: 24, height: 21, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: btnColor, transition: 'all 0.2s', flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = btnHoverBg
                            e.currentTarget.style.color = btnHoverColor
                            e.currentTarget.style.boxShadow = `0 0 6px ${btnShadow}`
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = btnBg
                            e.currentTarget.style.color = btnColor
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <Megaphone size={12} />
                        </button>
                      )
                    })()}

                    {/* 2. BUTTON: CONFIRM PICKUP / EXIT */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (l.confirmedOut) {
                          showToast(`Saída de ${l.studentName} já foi confirmada hoje!`, false)
                          return
                        }
                        const nowIso = new Date().toISOString()
                        const existingEntry = seenSpecialAuthsRef.current.get(l.id)
                        if (existingEntry) {
                          const nextDates = { ...(existingEntry.confirmedDates || {}), [currentTodayStr]: nowIso }
                          seenSpecialAuthsRef.current.set(l.id, {
                            ...existingEntry,
                            confirmedDates: nextDates,
                            confirmedOut: true,
                            confirmedAt: nowIso,
                          })
                          setSeenSpecialAuthsVersion(v => v + 1)
                        }
                        confirmSpecialExit(
                          l.studentId,
                          l.studentName,
                          l.studentClass,
                          l.authorizedPerson,
                          l.studentPhoto,
                          l.targetTime || undefined
                        )
                        showToast(`Saída de ${l.studentName} confirmada hoje!`, true)
                      }}
                      disabled={l.confirmedOut}
                      title={l.confirmedOut ? `Saída confirmada hoje às ${l.confirmedAt}` : "Confirmar Saída do Aluno Hoje"}
                      style={{
                        background: l.confirmedOut ? '#10b981' : 'rgba(16,185,129,0.12)',
                        border: 'none',
                        cursor: l.confirmedOut ? 'default' : 'pointer',
                        borderRadius: 6, width: 24, height: 21,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: l.confirmedOut ? '#fff' : '#10b981', transition: 'all 0.2s', flexShrink: 0,
                        boxShadow: l.confirmedOut ? '0 2px 6px rgba(16,185,129,0.35)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (l.confirmedOut) return
                        e.currentTarget.style.background = '#10b981'
                        e.currentTarget.style.color = '#fff'
                        e.currentTarget.style.boxShadow = '0 0 6px rgba(16,185,129,0.4)'
                      }}
                      onMouseLeave={e => {
                        if (l.confirmedOut) return
                        e.currentTarget.style.background = 'rgba(16,185,129,0.12)'
                        e.currentTarget.style.color = '#10b981'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </div>

                  {/* LINE 2: EXCLUIR */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setConfirmDeleteId(l.id)
                    }}
                    title="Excluir Autorização Especial"
                    style={{
                      background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer',
                      borderRadius: 6, width: '100%', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#ef4444', transition: 'all 0.2s', flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#ef4444'
                      e.currentTarget.style.color = '#fff'
                      e.currentTarget.style.boxShadow = '0 0 6px rgba(239,68,68,0.4)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                      e.currentTarget.style.color = '#ef4444'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <Trash2 size={11.5}/>
                  </button>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR: HORÁRIO PREVISTO + VALIDADE (ESQUERDA) E CONFIRMAÇÃO (DIREITA) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 4,
                flexWrap: 'wrap',
                paddingTop: 4,
                borderTop: l.confirmedOut
                  ? '1px solid rgba(16, 185, 129, 0.22)'
                  : '1px solid rgba(245, 158, 11, 0.16)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0 }}>
                  {l.targetTime && l.targetTime !== 'Indefinido' ? (
                    <span
                      title={`Horário previsto para retirada: ${l.targetTime}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 5,
                        background: l.confirmedOut
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.12))',
                        color: l.confirmedOut ? '#047857' : '#b45309',
                        border: l.confirmedOut
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : '1px solid rgba(245, 158, 11, 0.35)',
                        letterSpacing: '0.01em',
                        lineHeight: 1.3,
                      }}
                    >
                      <Clock size={8.5} strokeWidth={2.5} color={l.confirmedOut ? '#059669' : '#d97706'} />
                      <span>Prev. <strong>{l.targetTime}</strong></span>
                    </span>
                  ) : (
                    <span
                      title="Horário previsto para retirada: Indefinido"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 8.5,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 5,
                        background: l.confirmedOut ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.1)',
                        color: l.confirmedOut ? '#047857' : '#475569',
                        border: l.confirmedOut ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(100, 116, 139, 0.2)',
                        letterSpacing: '0.01em',
                        lineHeight: 1.3,
                      }}
                    >
                      <Clock size={8.5} strokeWidth={2.4} color={l.confirmedOut ? '#059669' : '#64748b'} />
                      <span>Indefinido</span>
                    </span>
                  )}

                  {l.validDays > 1 && (
                    <span
                      title={`Autorização válida por ${l.validDays} dias: de ${formatShortDateBR(l.validFrom)} até ${formatShortDateBR(l.validUntil)} (Hoje: Dia ${l.dayIndex} de ${l.validDays})`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 5,
                        background: l.confirmedOut ? 'rgba(16, 185, 129, 0.16)' : 'rgba(59, 130, 246, 0.1)',
                        color: l.confirmedOut ? '#047857' : '#1d4ed8',
                        border: l.confirmedOut ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.26)',
                        letterSpacing: '0.01em',
                        lineHeight: 1.3,
                      }}
                    >
                      <Calendar size={8.5} strokeWidth={2.4} color={l.confirmedOut ? '#059669' : '#2563eb'} />
                      <span>{l.dayIndex}/{l.validDays} · até {formatShortDateBR(l.validUntil)}</span>
                    </span>
                  )}
                </div>

                {l.confirmedOut && (
                  <div
                    title={`Saída confirmada hoje${l.confirmedAt ? ` às ${l.confirmedAt}` : ''}`}
                    style={{
                      fontSize: 8.5,
                      color: '#047857',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.38)',
                      borderRadius: 5,
                      padding: '1px 6px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      lineHeight: 1.3,
                      marginLeft: 'auto',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckCircle2 size={9} strokeWidth={2.5} style={{ flexShrink: 0, color: '#059669' }} />
                    <span>{l.confirmedAt ? `Saída ${l.confirmedAt}` : 'Confirmado'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {launches.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(245,158,11,0.5)', fontSize: 11, fontStyle: 'italic' }}>
              Nenhuma saída especial registrada hoje.
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO (REMOVER AUTORIZAÇÃO) ───────────────────────── */}
      {confirmDeleteId && (
        <div
          className="chamada-modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.74)',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            className="chamada-modal-panel"
            style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 24, padding: 24, width: '90%', maxWidth: 400,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#000000' }}>Remover autorização?</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>
                  Tem certeza que deseja remover esta autorização especial? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                  color: '#000000', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'}
                onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteCall(confirmDeleteId)
                  removeFromAccumulator(confirmDeleteId)
                  setConfirmDeleteId(null)
                }}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: '#ef4444', border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#dc2626'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ef4444'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// ── Proibidos Retirada Component ──────────────────────────────────────────
const ProibidosRetiradaCard = React.memo(function ProibidosRetiradaCard() {
  const [restritos, setRestritos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    const fetchRestritos = async () => {
      try {
        const d = new Date()
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const res = await fetch(`/api/portaria/restritos-hoje?date=${localDateStr}`)
        if (res.ok) {
          const json = await res.json()
          setRestritos(json.data || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchRestritos()
  }, [])

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.02) 100%)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: 20, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
      height: '100%',
      minHeight: 0,
      maxHeight: isMobile ? 360 : 410,
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🚫</span> Proibidos Retirada Hoje
        </div>
        {restritos.length > 0 && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            {restritos.length} {restritos.length === 1 ? 'aluno' : 'alunos'}
          </span>
        )}
      </div>
      
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 4 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 12, padding: '20px 0', opacity: 0.7 }}>Buscando restrições...</div>
        ) : restritos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 11, padding: '20px 0', opacity: 0.6, fontStyle: 'italic' }}>
            Nenhuma restrição encontrada para hoje.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}>
            {restritos.map(aluno => (
              <div key={aluno.id} style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 12, padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, overflow: 'hidden',
                  background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 900, color: '#ef4444', flexShrink: 0,
                }}>
                  {aluno.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={aluno.foto} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  ) : (
                    aluno.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={aluno.nome}>
                    {abbreviateStudentName(aluno.nome, 22)}
                  </div>
                  {aluno.restritos.map((r: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
                      <span style={{ 
                        fontSize: 8, 
                        fontWeight: 700, 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        textTransform: 'uppercase',
                        backgroundColor: 'rgba(156, 163, 175, 0.15)',
                        color: '#6b7280',
                        border: '1px solid rgba(156, 163, 175, 0.3)',
                        flexShrink: 0,
                      }}>
                        {r.parentesco ? r.parentesco : 'Resp.'}
                      </span>
                      <span
                        title={r.nome}
                        style={{
                          fontWeight: 700,
                          color: '#ef4444',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {abbreviateStudentName(r.nome, 18)}
                      </span>
                      <span style={{ 
                        fontSize: 8, 
                        fontWeight: 800, 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        textTransform: 'uppercase',
                        backgroundColor: r.motivo === 'Proibido' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                        color: r.motivo === 'Proibido' ? '#ef4444' : '#f97316',
                        border: `1px solid ${r.motivo === 'Proibido' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)'}`,
                        flexShrink: 0,
                      }}>
                        {r.motivo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// ── Main Page ─────────────────────────────────────────────────────────────────
const CALLS_BATCH_SIZE = 36

function ChamadasContent() {

  const { activeCalls = [], config, confirmPickup, confirmAllWaiting, cancelCall, recallStudent, revertCall, callStudent, clearCalls, realtimeStatus, refreshCalls, isLoadingCalls } = useSaida()
  const { currentUser, currentUserPerfil } = useApp()
  const [turmas] = useSupabaseArray<any>('turmas');
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const urgentLimit = (config?.tvUrgentTime ?? 5) * 60

  const turmaNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of (turmas || [])) {
      if (t.id) map.set(String(t.id), t.nome)
      if (t.codigo) map.set(String(t.codigo), t.nome)
      if (t.nome) map.set(String(t.nome), t.nome)
    }
    return map
  }, [turmas])

  const isAdmin = useMemo(() => {
    const perfil = (currentUserPerfil || currentUser?.perfil || '').toLowerCase().trim()
    const cargo = (currentUser?.cargo || '').toLowerCase().trim()

    return (
      perfil === 'diretor geral' ||
      perfil === 'administrador' ||
      perfil === 'admin' ||
      perfil === 'administrador master' ||
      cargo === 'administrador master' ||
      cargo === 'administrador' ||
      cargo === 'diretor geral' ||
      cargo.includes('admin')
    )
  }, [currentUser, currentUserPerfil])

  const [filter,        setFilter]        = useState<FilterType>('waiting')
  const [callSearch,    setCallSearch]    = useState('')
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [confirmModalAllWaiting, setConfirmModalAllWaiting] = useState(false)
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)
  const [selectedCallForIrmaos, setSelectedCallForIrmaos] = useState<PickupCall | null>(null)

  // -- Busca de Alunos Refatorada Direct Supabase --
  const [studentSearch, setStudentSearch] = useState('')
  const [schoolResults, setSchoolResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const topSearchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut (Ctrl+K or Cmd+K) to focus top search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        topSearchInputRef.current?.focus()
        setSearchFocused(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside listener to close search results dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleRecall = useCallback((id: string) => {
    recallStudent(id, () => {})
  }, [recallStudent])

  // Fallback Polling 30s se o Supabase Realtime falhar ou desconectar
  useEffect(() => {
    if (realtimeStatus !== 'online') {
      if (realtimeStatus === 'offline') {
        refreshCalls() // Dispara imediatamente apenas se caiu para offline (no mount 'connecting', SaidaProvider já busca)
      }
      const iv = setInterval(() => {
        refreshCalls()
      }, 30000)
      return () => clearInterval(iv)
    }
  }, [realtimeStatus, refreshCalls])

  // Debounced search on secure server API (bypassing client RLS limitations!)
  useEffect(() => {
    const q = studentSearch.trim()
    if (q.length < 3) {
      setSchoolResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=10&page=1&withPhoto=true&lightweight=true`, {
          signal: controller.signal,
          cache: 'no-store'
        })
        if (!res.ok) throw new Error('Falha ao buscar alunos')
        const json = await res.json()
        const data = json.data || []

        // Filtra apenas alunos ativos/matriculados
        const filtered = data.filter((a: any) =>
          ['ativo', 'matriculado'].includes(String(a.status || '').trim().toLowerCase())
        )

        const mapped = filtered.map((a: any) => {
          const tName = turmaNameMap.get(String(a.turma)) || a.turma_nome || a.turma
          const p = a.foto || a.foto_url || a.fotoUrl || a.avatarUrl || a.imagem1 || a.dados?.foto || a.dados?.avatarUrl || null
          const rawSair = a.autorizadoSairSozinho ?? a.dados?.autorizadoSairSozinho ?? a.saude?.autorizaSaida ?? a.dados?.saude?.autorizaSaida
          const isAutSair = rawSair === true || (typeof rawSair === 'string' && ['true', 'sim', 's', '1', 'autorizado'].includes(rawSair.trim().toLowerCase()))
          return { ...a, foto: p, turmaNome: tName, autorizadoSairSozinho: isAutSair }
        })

        setSchoolResults(mapped)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Erro ao buscar alunos:', err)
          setSchoolResults([])
        }
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [studentSearch, turmaNameMap])

  const handleCall = useCallback((
    studentId: string, studentName: string, studentClass: string,
    guardianId: string, guardianName: string,
    studentPhoto?: string | null,
  ) => {
    const sIdStr = String(studentId || '')
    const isConfirmedToday = activeCalls.some(c => c.studentId != null && String(c.studentId) === sIdStr && c.status === 'confirmed')
    if (isConfirmedToday) {
      showToast(`${studentName} já teve a saída confirmada hoje!`, false);
      return;
    }
    const hasActive = activeCalls.some(c =>
      c.studentId != null && String(c.studentId) === sIdStr && (c.status === 'waiting' || c.status === 'called')
    )
    if (hasActive) { showToast(`${studentName} já está em chamada ativa.`, false); return }
    const effectivePhoto = studentPhoto || (studentId ? getCachedStudentPhoto(studentId) : null) || null
    const res = callStudent(studentId, studentName, studentClass, guardianId, guardianName, 'manual', undefined, effectivePhoto)
    if (!res) {
      showToast(`Não foi possível chamar ${studentName}.`, false)
      return
    }
    showToast(`${studentName} chamado(a)!`)
    setStudentSearch('')
  }, [activeCalls, callStudent, showToast])

  // Single-pass aggregation & pre-sorting of all buckets to avoid 7+ passes and per-render object cloning
  const callsSummary = useMemo(() => {
    const confirmedStudentIds = new Set<string>()
    const soloCallIds = new Set<string>()
    const parsedItems: Array<{ call: PickupCall; _parsedTime: number; _searchStr: string; _isSolo: boolean }> = []

    for (let i = 0; i < activeCalls.length; i++) {
      const c = activeCalls[i]
      if (c.status === 'confirmed' && c.studentId != null) {
        confirmedStudentIds.add(String(c.studentId))
      }
      const isSolo = isSaiuSozinhoCall(c)
      if (isSolo) soloCallIds.add(c.id)
      const t = c.calledAt ? new Date(c.calledAt).getTime() : 0
      parsedItems.push({
        call: c,
        _parsedTime: Number.isNaN(t) ? 0 : t,
        _searchStr: `${c.studentName || ''} ${c.studentClass || ''} ${c.guardianName || ''}`.toLowerCase(),
        _isSolo: isSolo,
      })
    }

    parsedItems.sort((a, b) => b._parsedTime - a._parsedTime)

    const allCalls: typeof parsedItems = []
    const waiting: typeof parsedItems = []
    const confirmed: typeof parsedItems = []
    const saiuSozinho: typeof parsedItems = []
    const cancelled: typeof parsedItems = []

    const seenAllConfirmed = new Set<string>()
    const seenConfirmed = new Set<string>()
    const seenSolo = new Set<string>()

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i]
      const c = item.call
      const sIdTrim = c.studentId != null ? String(c.studentId).trim() : ''
      const studentKey = sIdTrim || (c.studentName ? c.studentName.trim().toLowerCase() : c.id)

      if (c.status === 'cancelled') {
        cancelled.push(item)
        allCalls.push(item)
        continue
      }

      if (c.status === 'special_auth') {
        continue
      }

      const isWaitingStatus = c.status === 'waiting' || c.status === 'called'
      const isConfirmedElsewhere = isWaitingStatus && c.studentId != null && confirmedStudentIds.has(String(c.studentId))

      if (c.status === 'confirmed') {
        if (!seenConfirmed.has(studentKey)) {
          seenConfirmed.add(studentKey)
          confirmed.push(item)
        }
        if (!seenAllConfirmed.has(studentKey)) {
          seenAllConfirmed.add(studentKey)
          allCalls.push(item)
        }
      } else if (!isConfirmedElsewhere) {
        allCalls.push(item)
        if (isWaitingStatus && !item._isSolo && c.studentId != null) {
          waiting.push(item)
        }
      }

      if (item._isSolo && !seenSolo.has(studentKey)) {
        seenSolo.add(studentKey)
        saiuSozinho.push(item)
      }
    }

    return {
      allCalls,
      waiting,
      confirmed,
      saiuSozinho,
      cancelled,
      waitingCalls: waiting.map(item => item.call),
    }
  }, [activeCalls])

  const waiting = callsSummary.waitingCalls

  const filtered = useMemo(() => {
    let sourceList = callsSummary.allCalls
    if (filter === 'waiting') sourceList = callsSummary.waiting
    else if (filter === 'confirmed') sourceList = callsSummary.confirmed
    else if (filter === 'saiu_sozinho') sourceList = callsSummary.saiuSozinho
    else if (filter === 'cancelled') sourceList = callsSummary.cancelled

    const q = callSearch.trim().toLowerCase()
    if (!q) return sourceList.map(item => item.call)
    return sourceList.filter(item => item._searchStr.includes(q)).map(item => item.call)
  }, [callsSummary, filter, callSearch])

  const [visibleLimit, setVisibleLimit] = useState(CALLS_BATCH_SIZE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleLimit(CALLS_BATCH_SIZE)
  }, [filter, callSearch])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || visibleLimit >= filtered.length) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleLimit(prev => Math.min(filtered.length, prev + CALLS_BATCH_SIZE))
        }
      },
      { rootMargin: '320px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleLimit, filtered.length])

  const visibleCalls = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit])
  const remainingCallsCount = Math.max(0, filtered.length - visibleCalls.length)

  const FILTERS = [
    { key: 'all'          as FilterType, label: 'Todos',        color: '#6366f1', gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', glow: '0 4px 14px rgba(79, 70, 229, 0.35)', count: mounted ? callsSummary.allCalls.length    : 0 },
    { key: 'waiting'      as FilterType, label: 'Aguardando',   color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: '0 4px 14px rgba(245, 158, 11, 0.35)', count: mounted ? callsSummary.waiting.length     : 0 },
    { key: 'confirmed'    as FilterType, label: 'Confirmados',  color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', glow: '0 4px 14px rgba(16, 185, 129, 0.35)', count: mounted ? callsSummary.confirmed.length   : 0 },
    { key: 'saiu_sozinho' as FilterType, label: 'Saiu Sozinho', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', glow: '0 4px 14px rgba(6, 182, 212, 0.35)', count: mounted ? callsSummary.saiuSozinho.length : 0 },
    { key: 'cancelled'    as FilterType, label: 'Cancelados',   color: '#64748b', gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', glow: '0 4px 14px rgba(100, 116, 139, 0.35)', count: mounted ? callsSummary.cancelled.length   : 0 },
  ]

  if (isLoadingCalls) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, fontWeight: 500 }}>Carregando chamadas...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="chamada-toast" style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 700, zIndex: 9999,
          background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'slideDown 0.3s ease',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10, color: '#000000' }}>
            📢 Gestão de Chamadas
          </h1>
          <p style={{ fontSize: 13, color: '#334155', margin: 0 }}>
            Histórico e controle em tempo real
          </p>
        </div>

        {/* Connection Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.05em',
          background: realtimeStatus === 'online' ? 'rgba(16,185,129,0.12)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${realtimeStatus === 'online' ? 'rgba(16,185,129,0.25)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444',
            boxShadow: `0 0 6px ${realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444'}`,
            animation: realtimeStatus !== 'online' ? 'pulseUrgent 1.5s infinite' : 'none'
          }} />
          <span style={{ textTransform: 'uppercase' }}>
            {realtimeStatus === 'online' ? 'ONLINE' : realtimeStatus === 'connecting' ? 'CONECTANDO' : 'OFFLINE'}
          </span>
        </div>
      </div>



      {/* ── TOP BAR (CHARMAR ALUNO - MATCHING IMAGEM 2) ─────────────────── */}
      <div
        ref={searchContainerRef}
        style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 20,
          padding: isMobile ? '10px 12px' : '12px 18px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 10 : 14,
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 20,
          position: 'relative',
        }}
      >
        {/* Left: Blue Megaphone Circle + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}>
            <Megaphone size={isMobile ? 16 : 18} />
          </div>
          <span style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: isMobile ? 14 : 15,
            color: '#2563eb', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>
            Chamar aluno
          </span>
        </div>

        {/* Middle: Search Input */}
        <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}/>
          <input
            ref={topSearchInputRef}
            value={studentSearch}
            onChange={e => {
              setStudentSearch(e.target.value)
              setSearchFocused(true)
            }}
            onFocus={() => setSearchFocused(true)}
            placeholder="Buscar aluno por nome (mínimo 3 letras)..."
            style={{
              width: '100%', padding: '10px 36px 10px 40px',
              borderRadius: 14, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-surface))', fontSize: 13,
              color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              height: 42,
            }}
          />
          {studentSearch && (
            <button
              type="button"
              aria-label="Limpar busca de aluno"
              onClick={() => { setStudentSearch(''); }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'hsl(var(--text-muted))', padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <X size={15}/>
            </button>
          )}
        </div>

        {/* OVERLAY DROPDOWN FOR RESULTS (ANCHORED TO FULL TOP BAR WIDTH) */}
        {searchFocused && studentSearch.trim().length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
            background: 'hsl(var(--bg-elevated))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 20,
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.24)',
            zIndex: 1000,
            maxHeight: isMobile ? '70dvh' : '65vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            display: 'flex', flexDirection: 'column',
            padding: isMobile ? 4 : 6,
          }}>
            {studentSearch.trim().length < 3 && (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px' }}>
                Digite pelo menos 3 letras do nome do aluno.
              </div>
            )}
            
            {isSearching && (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <RefreshCw size={14} className="spin" /> Buscando alunos...
              </div>
            )}

            {!isSearching && studentSearch.trim().length >= 3 && schoolResults.length > 0 && (
              <div className="search-results-list">
                {schoolResults.map((a: any) => (
                  <StudentSearchRow key={a.id} student={a} activeCalls={activeCalls} onCall={handleCall} showToast={showToast}/>
                ))}
              </div>
            )}
            
            {!isSearching && studentSearch.trim().length >= 3 && schoolResults.length === 0 && (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px' }}>
                Nenhum aluno encontrado com esse nome.
              </div>
            )}
          </div>
        )}

        {/* Right: Keyboard Shortcut Badge (Ctrl + K) */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, userSelect: 'none' }}>
            <kbd style={{
              padding: '3px 7px', borderRadius: 6,
              background: 'hsl(var(--bg-surface))',
              border: '1px solid hsl(var(--border-subtle))',
              fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}>Ctrl</kbd>
            <span style={{ color: 'hsl(var(--text-muted))', fontSize: 11, fontWeight: 600 }}>+</span>
            <kbd style={{
              padding: '3px 7px', borderRadius: 6,
              background: 'hsl(var(--bg-surface))',
              border: '1px solid hsl(var(--border-subtle))',
              fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}>K</kbd>
          </div>
        )}
      </div>

      {/* ── 2 CARDS GRID (PROIBIDOS RETIRADA & AUTORIZAÇÃO ESPECIAL - 50% EACH) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
        marginBottom: 28,
        alignItems: 'stretch',
      }}>
        {/* ── PROIBIDOS RETIRADA (50% WIDTH, INTERNAL 2-COLUMNS) ────────────── */}
        <ProibidosRetiradaCard />

        {/* ── AUTORIZAÇÃO ESPECIAL DO DIA (50% WIDTH, INTERNAL 2-COLUMNS) ────── */}
        <SpecialExitSticker showToast={showToast} />
      </div>

      {/* ── CARD ULTRA MODERNO DO HISTÓRICO COM GRADIENTE E CORES COMBINADAS ── */}
      <div style={{
        position: 'relative',
        backgroundColor: 'hsl(var(--bg-elevated))',
        backgroundImage: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.05) 45%, rgba(168, 85, 247, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 18,
        padding: isMobile ? '10px 12px' : '9px 14px',
        marginBottom: 20,
        boxShadow: '0 8px 32px -4px rgba(99, 102, 241, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 10 : 8,
        flexWrap: 'wrap',
        overflow: 'hidden',
      }}>
        {/* Subtle top edge gradient shimmer */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
          opacity: 0.85,
        }} />

        {/* Left: Histórico Label + Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          flex: isMobile ? '1 1 100%' : '0 0 auto',
          minWidth: 0,
        }}>
          {/* Brand/Section Badge with Gradient Icon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingRight: 8,
            borderRight: '1px solid rgba(99, 102, 241, 0.2)',
            marginRight: 2,
            userSelect: 'none',
            flexShrink: 0,
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 3px 10px rgba(99, 102, 241, 0.35)',
              flexShrink: 0,
            }}>
              <History size={13.5} strokeWidth={2.4} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.07em',
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textTransform: 'uppercase',
                lineHeight: 1.1,
              }}>
                Histórico
              </span>
              <span style={{
                fontSize: 8.5,
                fontWeight: 700,
                color: 'hsl(var(--text-muted))',
                letterSpacing: '0.04em',
              }}>
                CHAMADAS
              </span>
            </div>
          </div>

          {/* Filter Dropdown List */}
          {(() => {
            const activeFilter = FILTERS.find(f => f.key === filter) || FILTERS[0]
            return (
              <select
                aria-label="Filtrar histórico de chamadas"
                name="historico-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="historico-filter-select"
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 100,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: '1px solid transparent',
                  background: activeFilter.gradient,
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activeFilter.glow,
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label} ({f.count})
                  </option>
                ))}
              </select>
            )
          })()}
        </div>

        {/* Right: Search Input + Confirmar Todos + Zerar Chamadas */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: isMobile ? '1 1 100%' : '1 1 260px',
          minWidth: 0,
          marginLeft: isMobile ? 0 : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}>
          {/* Search Input with Gradient Accent */}
          <div style={{
            position: 'relative',
            flex: isMobile ? '1 1 100%' : '1 1 150px',
            minWidth: isMobile ? 0 : 120,
            maxWidth: isMobile ? '100%' : 240,
          }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6366f1',
                pointerEvents: 'none',
              }}
            />
            <input
              value={callSearch}
              onChange={e => setCallSearch(e.target.value)}
              placeholder="Filtrar histórico..."
              style={{
                width: '100%',
                height: 32,
                padding: '0 24px 0 28px',
                borderRadius: 10,
                fontSize: 11,
                border: '1px solid rgba(99, 102, 241, 0.25)',
                background: 'hsl(var(--bg-surface))',
                color: 'hsl(var(--text-primary))',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#6366f1'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.18)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            {callSearch && (
              <button
                type="button"
                onClick={() => setCallSearch('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--text-muted))',
                  padding: 3,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Botão Organizado: Confirmar Todos Que Estão Aguardando */}
          <button
            type="button"
            className="btn-confirmar-todos"
            disabled={waiting.length === 0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (waiting.length > 0) {
                setConfirmModalAllWaiting(true)
              }
            }}
            title={waiting.length > 0 ? `Confirmar saída de todos os ${waiting.length} alunos aguardando` : 'Nenhum aluno aguardando no momento'}
          >
            <CheckCheck size={13} strokeWidth={2.4} />
            <span>Confirmar Todos</span>
            {waiting.length > 0 && (
              <span className="badge-count">
                {waiting.length}
              </span>
            )}
          </button>

          {/* Zerar Chamadas with Gradient Danger Theme */}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConfirmClearAll(true)
              }}
              style={{
                height: 32,
                padding: '0 10px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: 4.5,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.08)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                el.style.color = '#fff'
                el.style.borderColor = 'transparent'
                el.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.35)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)'
                el.style.color = '#ef4444'
                el.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                el.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.08)'
              }}
            >
              <Trash2 size={12} />
              <span>Zerar Chamadas</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CALL GRID ────────────────────────────────────────────────── */}
      {isLoadingCalls ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(195px, 1fr))', gap: isMobile ? 10 : 14 }}>
          <CallCardSkeleton />
          <CallCardSkeleton />
          <CallCardSkeleton />
          <CallCardSkeleton />
          <CallCardSkeleton />
          <CallCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
          <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }}/>
          <div>Nenhuma chamada {filter !== 'all' ? 'com este filtro' : 'registrada'}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(195px, 1fr))', gap: isMobile ? 10 : 14 }}>
            {visibleCalls.map(rawCall => {
              const turmaNome = turmaNameMap.get(String(rawCall.studentClass)) || rawCall.studentClass
              return (
                <CallCard
                  key={rawCall.id}
                  call={rawCall}
                  displayClass={turmaNome}
                  urgentLimit={urgentLimit}
                  onConfirm={confirmPickup}
                  onCancel={cancelCall}
                  onRecall={handleRecall}
                  onRevert={revertCall}
                  onOpenIrmaos={setSelectedCallForIrmaos}
                />
              )
            })}
          </div>

          {remainingCallsCount > 0 && (
            <div
              ref={loadMoreRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '20px 0 8px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => setVisibleLimit(prev => Math.min(filtered.length, prev + CALLS_BATCH_SIZE))}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-primary))',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Carregar mais ({Math.min(CALLS_BATCH_SIZE, remainingCallsCount)} de {remainingCallsCount} restantes)
              </button>
              <button
                type="button"
                onClick={() => setVisibleLimit(filtered.length)}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'transparent',
                  color: 'hsl(var(--text-muted))',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mostrar todas ({filtered.length})
              </button>
            </div>
          )}
        </>
      )}

      {/* ── MODAL ULTRA MODERNO DE CHAMAR IRMÃOS ────────────────────────── */}
      {selectedCallForIrmaos && (
        <ModalChamarIrmaos
          call={selectedCallForIrmaos}
          onClose={() => setSelectedCallForIrmaos(null)}
          activeCalls={activeCalls}
          onCallStudent={handleCall}
          onRecallStudent={handleRecall}
          showToast={showToast}
        />
      )}

      {/* ── MODAL DE CONFIRMAÇÃO (CONFIRMAR TODOS OS AGUARDANDO) ───────── */}
      {confirmModalAllWaiting && (
        <div
          className="chamada-modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.74)',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            if (!isConfirmingAll) setConfirmModalAllWaiting(false)
          }}
        >
          <div
            className="chamada-modal-panel"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 24, padding: 24, width: '100%', maxWidth: 440,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}
          >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <CheckCheck size={26} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                    Confirmar todos que estão aguardando?
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.45 }}>
                    Deseja confirmar a saída de <strong style={{ color: '#059669' }}>{waiting.length} {waiting.length === 1 ? 'aluno' : 'alunos'}</strong> que {waiting.length === 1 ? 'está aguardando' : 'estão aguardando'} na portaria?
                  </p>
                </div>
              </div>

              {/* Lista dos alunos que serão confirmados */}
              {waiting.length > 0 && (
                <div style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  borderRadius: 14,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  {waiting.map((c, idx) => {
                    const turmaNome = turmaNameMap.get(String(c.studentClass)) || c.studentClass
                    return (
                      <div
                        key={c.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: 'hsl(var(--bg-elevated))',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: '#f59e0b', flexShrink: 0,
                          }} />
                          <span style={{
                            fontWeight: 700, color: 'hsl(var(--text-primary))',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {c.studentName}
                          </span>
                        </div>
                        {turmaNome && (
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: 'hsl(var(--text-muted))',
                            padding: '2px 7px',
                            background: 'hsl(var(--bg-overlay))',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {turmaNome}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={isConfirmingAll}
                  onClick={() => setConfirmModalAllWaiting(false)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-secondary))', fontWeight: 700, fontSize: 13,
                    cursor: isConfirmingAll ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (!isConfirmingAll) e.currentTarget.style.background = 'hsl(var(--bg-overlay))'
                  }}
                  onMouseLeave={e => {
                    if (!isConfirmingAll) e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isConfirmingAll || waiting.length === 0}
                  onClick={async () => {
                    try {
                      setIsConfirmingAll(true)
                      const count = await confirmAllWaiting(waiting)
                      showToast(`${count} ${count === 1 ? 'saída confirmada' : 'saídas confirmadas'} com sucesso!`, true)
                      setConfirmModalAllWaiting(false)
                    } catch (err: any) {
                      console.error('Erro ao confirmar todas as chamadas:', err)
                      showToast('Ocorreu um erro ao confirmar as saídas.', false)
                    } finally {
                      setIsConfirmingAll(false)
                    }
                  }}
                  style={{
                    flex: 1.4, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: isConfirmingAll ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: isConfirmingAll ? 0.75 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!isConfirmingAll) {
                      e.currentTarget.style.filter = 'brightness(1.08)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isConfirmingAll) {
                      e.currentTarget.style.filter = 'none'
                      e.currentTarget.style.transform = 'none'
                    }
                  }}
                >
                  {isConfirmingAll ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Confirmando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck size={16} strokeWidth={2.4} />
                      <span>Confirmar {waiting.length} {waiting.length === 1 ? 'Aluno' : 'Alunos'}</span>
                    </>
                  )}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMAÇÃO (ZERAR CHAMADAS) ───────────────────────── */}
      {confirmClearAll && isAdmin && (
        <div
          className="chamada-modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.74)',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            className="chamada-modal-panel"
            style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 24, padding: 24, width: '90%', maxWidth: 400,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}
          >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#000000' }}>Zerar chamadas?</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>
                    Tem certeza que deseja zerar e excluir todas as chamadas do dia? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                    color: '#000000', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await clearCalls()
                    showToast('Todas as chamadas do dia foram zeradas.')
                    setConfirmClearAll(false)
                  }}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    background: '#ef4444', border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#dc2626'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ef4444'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  Sim, zerar tudo
                </button>
              </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideDown { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes chamadaModalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chamadaModalScale { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .chamada-modal-backdrop {
          animation: chamadaModalFade 0.16s ease-out;
        }
        .chamada-modal-panel {
          animation: chamadaModalScale 0.18s cubic-bezier(0.2, 1, 0.2, 1);
        }
        .chamada-card-perf {
          content-visibility: auto;
          contain-intrinsic-size: 210px 277px;
          contain: layout style paint;
        }
        .chamada-mini-card {
          contain: layout style;
        }

        .search-results-list {
          container: search-results / inline-size;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 6px;
        }
        .search-student-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 12px 14px;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .search-student-card:hover {
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.07);
        }
        .search-student-guardians-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 7px;
        }
        .search-guardian-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
          width: 100%;
          min-height: 40px;
          padding: 7px 12px;
          border-radius: 10px;
          transition: all 0.15s ease;
          outline: none;
          box-sizing: border-box;
        }
        .search-guardian-btn:not(.is-blocked):not(.is-restricted):hover {
          background: rgba(59, 130, 246, 0.14) !important;
          border-color: rgba(59, 130, 246, 0.42) !important;
          transform: translateY(-1px);
        }
        .search-status-card {
          border-radius: 12px;
          padding: 8px 11px;
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          box-sizing: border-box;
        }
        .search-aside-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .search-solo-btn {
          width: 100%;
          min-height: 42px;
          border-radius: 12px;
          padding: 7px 11px;
          background: rgba(16, 185, 129, 0.09);
          border: 1px solid rgba(16, 185, 129, 0.34);
          color: #047857;
          display: flex;
          align-items: center;
          gap: 9px;
          box-sizing: border-box;
          transition: all 0.16s ease;
          outline: none;
        }
        .search-solo-icon {
          background: rgba(16, 185, 129, 0.16);
          color: #059669;
          transition: all 0.16s ease;
        }
        .search-solo-sub {
          color: #059669;
          opacity: 0.88;
        }
        .search-solo-btn:not(:disabled):hover {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: transparent;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
          transform: translateY(-1px);
        }
        .search-solo-btn:not(:disabled):hover .search-solo-icon {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }
        .search-solo-btn:not(:disabled):hover .search-solo-sub {
          color: rgba(255, 255, 255, 0.9);
        }
        @media (pointer: coarse) {
          .search-guardian-btn,
          .search-solo-btn {
            min-height: 44px;
          }
        }
        @container search-results (inline-size >= 540px) {
          .search-student-card {
            grid-template-columns: minmax(0, 1fr);
            padding: 13px 16px;
            gap: 12px 14px;
          }
          .search-student-card:has(.search-student-aside) {
            grid-template-columns: minmax(0, 1fr) minmax(190px, 235px);
          }
          .search-student-profile {
            grid-column: 1;
            grid-row: 1;
          }
          .search-student-aside {
            grid-column: 2;
            grid-row: 1;
            align-self: center;
          }
          .search-student-guardians {
            grid-column: 1 / -1;
            grid-row: 2;
          }
          .search-student-guardians-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
        }
        @container search-results (inline-size >= 900px) {
          .search-student-card {
            grid-template-columns: minmax(220px, 1fr) minmax(320px, 2fr);
            align-items: center;
            gap: 16px;
          }
          .search-student-card:has(.search-student-aside) {
            grid-template-columns: minmax(215px, 0.98fr) minmax(300px, 1.72fr) minmax(205px, 0.85fr);
          }
          .search-student-profile {
            grid-column: 1;
            grid-row: 1;
          }
          .search-student-guardians {
            grid-column: 2;
            grid-row: 1;
          }
          .search-student-aside {
            grid-column: 3;
            grid-row: 1;
          }
          .search-student-guardians-grid {
            grid-template-columns: repeat(auto-fit, minmax(205px, 1fr));
          }
        }
        
        .skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }
        .skeleton-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
          animation: shimmerSweep 1.6s infinite;
        }
        @keyframes shimmerSweep {
          100% { transform: translateX(100%); }
        }

        .btn-modern {
          transition: all 0.2s cubic-bezier(0.2, 1, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .btn-modern:active:not(:disabled) {
          transform: scale(0.96);
        }
        
        .btn-chamar {
          background: rgba(129,140,248,0.08);
          border: 1.5px solid rgba(129,140,248,0.3);
          color: #818cf8;
        }
        .btn-chamar:hover:not(:disabled) {
          background: rgba(129,140,248,0.15);
          border-color: rgba(129,140,248,0.5);
          box-shadow: 0 6px 16px rgba(129,140,248,0.2);
          transform: translateY(-2px);
        }
        .btn-chamar:disabled {
          background: transparent;
          border-color: rgba(129,140,248,0.15);
          color: hsl(var(--text-muted));
        }

        .btn-confirmar {
          background: linear-gradient(135deg, #10b981, #059669);
          border: 1px solid rgba(16,185,129,0.3);
          color: #fff;
          box-shadow: 0 4px 12px rgba(16,185,129,0.25);
        }
        .btn-confirmar:hover {
          box-shadow: 0 8px 24px rgba(16,185,129,0.45);
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .historico-filter-select option {
          background-color: hsl(var(--bg-elevated));
          color: hsl(var(--text-primary));
          font-weight: 600;
        }
        @supports (appearance: base-select) {
          .historico-filter-select,
          .historico-filter-select::picker(select) {
            appearance: base-select;
          }
          .historico-filter-select {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .historico-filter-select::picker(select) {
            background: hsl(var(--bg-elevated));
            border: 1px solid rgba(99, 102, 241, 0.25);
            border-radius: 14px;
            padding: 4px;
            margin-top: 6px;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
            min-width: 185px;
          }
          .historico-filter-select::picker-icon {
            color: #ffffff;
            margin-inline-start: 4px;
          }
          .historico-filter-select option {
            padding: 7px 10px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 600;
            color: hsl(var(--text-primary));
            background: transparent;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .historico-filter-select option:hover {
            background: rgba(99, 102, 241, 0.1);
          }
          .historico-filter-select option:checked {
            background: rgba(99, 102, 241, 0.14);
            font-weight: 700;
          }
          .historico-filter-select option::checkmark {
            color: #6366f1;
          }
        }

        .btn-confirmar-todos {
          height: 32px;
          padding: 0 9px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid rgba(16, 185, 129, 0.35);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%);
          color: #059669;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 4.5px;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(16, 185, 129, 0.08);
        }
        .btn-confirmar-todos:hover:not(:disabled) {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.38);
          transform: translateY(-1px);
        }
        .btn-confirmar-todos:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          border-color: rgba(16, 185, 129, 0.15);
          background: hsl(var(--bg-surface));
          color: hsl(var(--text-muted));
          box-shadow: none;
          transform: none;
        }
        .btn-confirmar-todos .badge-count {
          background: rgba(16, 185, 129, 0.18);
          color: inherit;
          border-radius: 100px;
          font-size: 9.5px;
          padding: 1px 5.5px;
          font-weight: 800;
          min-width: 14px;
          text-align: center;
          transition: all 0.18s ease;
        }
        .btn-confirmar-todos:hover:not(:disabled) .badge-count {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        .btn-cancelar {
          background: rgba(239,68,68,0.08);
          border: 1.5px solid rgba(239,68,68,0.25);
          color: #ef4444;
        }
        .btn-cancelar:hover {
          background: #ef4444;
          border-color: #ef4444;
          color: #fff;
          box-shadow: 0 6px 16px rgba(239,68,68,0.35);
          transform: translateY(-2px);
        }

        .btn-irmaos {
          transition: all 0.2s cubic-bezier(0.2, 1, 0.2, 1);
        }
        .btn-irmaos:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.4)) !important;
          border-color: rgba(192, 132, 252, 0.7) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35) !important;
          transform: translateY(-1px);
        }

        @keyframes pinBob {
          0%, 100% { transform: translate(-50%, 0px); }
          50% { transform: translate(-50%, -4px); }
        }
      ` }} />
    </div>
  )
}

export default function ChamadasPage() {
  return <ChamadasContent />
}
