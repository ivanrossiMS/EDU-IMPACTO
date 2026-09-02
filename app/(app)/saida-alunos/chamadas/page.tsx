'use client'
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'
import {
  CheckCircle2, Clock, Search, Megaphone, X, GraduationCap,
  UserCheck, ChevronRight, RotateCcw, RefreshCw, Trash2, Pin,
  Users, Sparkles, AlertCircle
} from 'lucide-react'

type FilterType = 'all' | 'waiting' | 'confirmed' | 'cancelled' | 'blocked'

// ── Helper ────────────────────────────────────────────────────────────────────
function statusMeta(call: PickupCall) {
  if (call.status === 'waiting' || call.status === 'called')
    return { color: '#f59e0b', label: 'AGUARDANDO' }
  if (call.status === 'confirmed')
    return { color: '#10b981', label: 'CONFIRMADO'  }
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

function fmtTime(iso?: string) {
  if (!iso) return ''
  try {
    let str = String(iso).trim()
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const [h, m] = str.split(':').map(Number)
      const dateToday = new Date().toISOString().split('T')[0]
      str = `${dateToday}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      str += '-03:00'
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(iso)
  }
}

// ── Unified call card (Ultra Modern TV-Monitor style) ─────────────────────────
const CallCard = React.memo(function CallCard({ call, onConfirm, onCancel, onRecall, onRevert, onOpenIrmaos }: {
  call:         PickupCall
  onConfirm:    (id: string) => void
  onCancel:     (id: string) => void
  onRecall:     (id: string) => void
  onRevert:     (id: string) => void
  onOpenIrmaos: (call: PickupCall) => void
}) {
  const { config } = useSaida()
  const [recalling, setRecalling] = useState(false)
  const [nowTime, setNowTime] = useState(Date.now())
  
  useEffect(() => {
    const iv = setInterval(() => setNowTime(Date.now()), 10000)
    return () => clearInterval(iv)
  }, [])
  
  const secs = elapsedSec(call.calledAt, nowTime)

  const isActive   = call.status === 'waiting' || call.status === 'called'
  const isFinished = call.status === 'confirmed' || call.status === 'cancelled'
  const isBlocked  = call.status === 'blocked'
  
  const urgentLimit = (config?.tvUrgentTime ?? 5) * 60
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
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'hsl(var(--bg-elevated))',
      border: `1px solid ${color}${isFinished ? '20' : '40'}`,
      boxShadow: `0 6px 20px rgba(0,0,0,0.06), 0 0 12px ${color}${urgent ? '30' : '05'}`,
      display: 'flex',
      flexDirection: 'column',
      opacity: isFinished ? 0.85 : 1,
      transition: 'all 0.3s cubic-bezier(0.2, 1, 0.2, 1)',
      animation: urgent ? 'cardFloatUrgent 4s ease-in-out infinite' : 'none',
      minHeight: 235,
      aspectRatio: '1 / 1.32',
    }}>

      {/* ── BACKGROUND PHOTO ─────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'hsl(var(--bg-muted))' }}>
        {call.studentPhoto ? (
          <img
            src={call.studentPhoto}
            alt={call.studentName}
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
           call.status === 'confirmed' ? <CheckCircle2 size={9} /> : <X size={9} />}
          {urgent ? 'ATRASADO' : meta.label}
        </div>

        {/* Live Timer (if active) */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            padding: '3px 8px', borderRadius: 50,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
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
          {call.studentName}
        </div>
        
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase',
          letterSpacing: '0.02em', marginBottom: 10,
        }}>
          <GraduationCap size={11} />
          {call.studentClass}
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
              Responsável
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f8fafc', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>
              <UserCheck size={10} color="#cbd5e1" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {call.guardianName || 'Não Informado'}
              </span>
            </div>
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
         prev.call.blockType === next.call.blockType
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 26, stiffness: 360 }}
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
      </motion.div>
    </motion.div>
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

  // Read autorizados directly from aluno.saude (set in nova-matricula)
  const saude: any = student.saude || {}
  const autorizados: any[] = saude.autorizados || []
  const autorizaSaida: boolean = student.autorizadoSairSozinho === true || saude.autorizaSaida === true   // can leave alone

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
    return activeCalls.some(c =>
      c.studentId === student.id && (c.status === 'waiting' || c.status === 'called')
    )
  }, [activeCalls, student.id])

  const confirmedCall = useMemo(() => {
    return activeCalls.find(c =>
      c.studentId === student.id && c.status === 'confirmed'
    )
  }, [activeCalls, student.id])
  const alreadyConfirmed = !!confirmedCall

  const initials = useMemo(() => student.nome?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(), [student.nome])

  const executeSoloExit = useCallback(() => {
    confirmSoloExit(
      student.id,
      student.nome,
      student.turmaNome || student.turma,
      student.foto || student.imagem1
    )
    showToast(`Saída de ${student.nome} confirmada (Saiu Sozinho)!`, true)
  }, [confirmSoloExit, student.id, student.nome, student.turmaNome, student.turma, student.foto, student.imagem1, showToast])
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

  const isMobile = useIsMobile()
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
      onCall(student.id, student.nome, student.turmaNome || student.turma, firstPermitted.id, firstPermitted.name, student.foto || student.imagem1)
      setTimeout(() => setIsCalling(false), 2000)
      showToast(`Chamando via ${firstPermitted.name}...`)
    } else {
      showToast('Nenhum responsável autorizado para hoje!', false)
    }
  }, [blocked, respList, student, onCall, showToast])

  return (
    <div style={{
      background: '#ffffff',
      border: alreadyCalled ? '1px solid rgba(245,158,11,0.45)' : '1px solid #e2e8f0',
      borderRadius: 16,
      padding: '16px 20px',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.5fr 1fr',
      gap: 20,
      alignItems: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      position: 'relative',
    }}>
      {/* 1. LEFT COLUMN: Student Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 68, height: 68, borderRadius: 16, flexShrink: 0,
          background: (student.foto || student.imagem1) ? 'none' : 'linear-gradient(135deg, #06b6d450, #6366f130)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 24, color: '#fff', fontFamily: 'Outfit, sans-serif',
          position: 'relative', overflow: 'hidden',
          border: (student.foto || student.imagem1) ? '1px solid #e2e8f0' : 'none',
        }}>
          {(student.foto || student.imagem1) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.foto || student.imagem1} alt={student.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {student.nome}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{ color: '#06b6d4', fontWeight: 800 }}>
              {student.turmaNome || student.turma} {student.turno ? `· ${student.turno.toUpperCase()}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 2 }}>
            {autorizaSaida ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 800, border: '1px solid rgba(16,185,129,0.25)' }}>
                Pode sair sozinho
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239,68,68,0.2)' }}>
                Não pode sair sozinho
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. MIDDLE COLUMN: Authorized Guardians */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>
          RESPONSÁVEIS AUTORIZADOS
        </span>
        {respList.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            Nenhum responsável configurado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {respList.map((g: any) => {
              const isProibido = g.proibido === true
              const dias: string[] = g.diasSemana || []
              const remap2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
              const todayK = remap2[new Date().getDay()]
              const diaRestrito = dias.length > 0 && !dias.includes(todayK)
              const isProibidoHoje = isProibido || diaRestrito

              return (
                <button
                  key={g.id}
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
                      onCall(student.id, student.nome, student.turmaNome || student.turma, g.id, g.name, student.foto || student.imagem1)
                      setTimeout(() => setIsCalling(false), 2000)
                    }
                  }}
                  disabled={blocked}
                  title={isProibido ? '🚫 Proibido de retirar este aluno' : diaRestrito ? `⚠ Dias permitidos: ${dias.join(', ')}` : alreadyConfirmed ? '✅ Aluno já retirado' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', borderRadius: 10, width: '100%',
                    background: alreadyConfirmed
                      ? 'rgba(253, 224, 71, 0.12)'
                      : blocked
                        ? '#f8fafc'
                        : isProibidoHoje
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(59, 130, 246, 0.08)',
                    border: alreadyConfirmed
                      ? '1px solid rgba(253, 224, 71, 0.35)'
                      : blocked
                        ? '1px solid #e2e8f0'
                        : isProibidoHoje
                          ? '1px solid rgba(239, 68, 68, 0.25)'
                          : '1px solid rgba(59, 130, 246, 0.25)',
                    color: alreadyConfirmed
                      ? '#a16207'
                      : blocked
                        ? '#94a3b8'
                        : isProibidoHoje
                          ? '#dc2626'
                          : '#1d4ed8',
                    fontWeight: 700, fontSize: 12.5,
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    if (blocked || isProibidoHoje) return
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(59, 130, 246, 0.15)'
                    el.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                  }}
                  onMouseLeave={e => {
                    if (blocked || isProibidoHoje) return
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(59, 130, 246, 0.08)'
                    el.style.borderColor = 'rgba(59, 130, 246, 0.25)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.8 }}>👤</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: alreadyConfirmed ? '#a16207' : '#1e293b', fontWeight: 700 }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.05)', color: alreadyConfirmed ? '#a16207' : '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {g.role}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {g.rfid && <span style={{ fontSize: 9, color: '#3b82f6' }}>📡</span>}
                    {alreadyConfirmed ? (
                      <span style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>✅</span>
                    ) : isProibidoHoje ? (
                      <span style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>⚠️</span>
                    ) : (
                      <ChevronRight size={13} style={{ opacity: 0.5 }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. RIGHT COLUMN: Confirmed Checkout Badge or Solo Exit Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {alreadyConfirmed ? (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            color: '#10b981',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
            {confirmedCall?.guardianName?.toLowerCase() === 'saiu sozinho' || confirmedCall?.guardianId === 'solo' ? (
              <>
                <span style={{ fontWeight: 900, fontSize: 13 }}>🚶‍♂️ SAIU SOZINHO</span>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
                  Saída confirmada às {confirmedCall?.confirmedAt ? fmtTime(confirmedCall.confirmedAt) : fmtTime(confirmedCall?.calledAt)}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>👨‍👦 RETIRADO POR:</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#059669', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {confirmedCall?.guardianName || 'Autorizado'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
                  às {confirmedCall?.confirmedAt ? fmtTime(confirmedCall.confirmedAt) : fmtTime(confirmedCall?.calledAt)}
                </span>
              </>
            )}
          </div>
        ) : autorizaSaida ? (
          <button
            type="button"
            onClick={handleSoloExitClick}
            disabled={blocked}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 18px',
              cursor: blocked ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s',
              opacity: blocked ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (blocked) return
              const el = e.currentTarget
              el.style.transform = 'translateY(-1px)'
              el.style.filter = 'brightness(1.05)'
            }}
            onMouseLeave={e => {
              if (blocked) return
              const el = e.currentTarget
              el.style.transform = 'none'
              el.style.filter = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={16} />
              <span>Registrar saiu sozinho</span>
            </div>
            <ChevronRight size={16} />
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Warning Alert Screens & Modals */}
      <AnimatePresence>
        {showProibidoAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(220, 38, 38, 0.95)',
              zIndex: 9999, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              style={{ textAlign: 'center' }}
            >
              <h1 style={{ fontSize: 64, fontWeight: 900, marginBottom: 20 }}>🚫 ACESSO NEGADO</h1>
              <p style={{ fontSize: 32, fontWeight: 700 }}>{showProibidoAlert.name} {showProibidoAlert.message}</p>
            </motion.div>
          </motion.div>
        )}

        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
              zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  confirmedOut?: boolean
  confirmedAt?: string
}

function SpecialExitSticker({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const { addSpecialAuth, confirmSpecialExit, deleteCall, cancelCall, callStudent, confirmPickup, recallStudent, activeCalls = [] } = useSaida()
  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const { currentUser } = useApp()
  const isMobile = useIsMobile()

  // Form State
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [authorizedPerson, setAuthorizedPerson] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── Persistent accumulator: never loses a special_auth entry even if activeCalls is overwritten ──
  // Key: call.id → PickupCall  (grows, never shrinks unless deleteCall is called)
  const seenSpecialAuthsRef = useRef<Map<string, PickupCall>>(new Map())

  // Whenever activeCalls changes, absorb any special_auth entries into the accumulator
  useEffect(() => {
    let changed = false
    for (const c of activeCalls) {
      if (c.status === 'special_auth') {
        const existing = seenSpecialAuthsRef.current.get(c.id)
        if (!existing || JSON.stringify(existing) !== JSON.stringify(c)) {
          seenSpecialAuthsRef.current.set(c.id, c)
          changed = true
        }
      }
    }
    // Force a re-render if new entries were absorbed
    if (changed) setSeenSpecialAuthsVersion(v => v + 1)
  }, [activeCalls])

  const [seenSpecialAuthsVersion, setSeenSpecialAuthsVersion] = useState(0)

  // Remove a specific special_auth from the accumulator (called from the delete handler)
  const removeFromAccumulator = useCallback((callId: string) => {
    seenSpecialAuthsRef.current.delete(callId)
    setSeenSpecialAuthsVersion(v => v + 1)
  }, [])

  // Computed Launches — uses the ACCUMULATOR (persistent) as source + activeCalls for confirmed status
  const launches = useMemo(() => {
    // seenSpecialAuthsVersion is referenced here only to trigger re-computation when accumulator changes
    void seenSpecialAuthsVersion
    const specialAuthEntries = Array.from(seenSpecialAuthsRef.current.values())

    return specialAuthEntries.map(c => {
      const sId = c.studentId ? String(c.studentId).trim() : ''
      const sName = c.studentName ? c.studentName.trim().toLowerCase() : ''

      // Encontra a chamada confirmada do aluno (compara tanto por ID quanto por Nome do Aluno)
      const pickUpCall = activeCalls.find(ac => {
        if (ac.status !== 'confirmed') return false
        const acId = ac.studentId ? String(ac.studentId).trim() : ''
        const acName = ac.studentName ? ac.studentName.trim().toLowerCase() : ''
        return (sId && acId && sId === acId) || (sName && acName && sName === acName)
      })

      const d = new Date(c.calledAt)
      const dateStr = !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : c.calledAt.split('T')[0]

      return {
        id: c.id,
        studentId: c.studentId,
        studentName: c.studentName,
        studentClass: c.studentClass,
        studentPhoto: c.studentPhoto,
        authorizedPerson: c.guardianName,
        loggedBy: c.operatorId || 'Sistema',
        date: dateStr,
        time: fmtTime(c.calledAt),
        calledAtMs: new Date(c.calledAt).getTime(),
        confirmedOut: !!pickUpCall,
        confirmedAt: pickUpCall
          ? fmtTime(pickUpCall.confirmedAt || pickUpCall.calledAt)
          : undefined
      }
    })
    // Mais recente primeiro
    .sort((a, b) => b.calledAtMs - a.calledAtMs)
  }, [activeCalls, seenSpecialAuthsVersion])



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
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=5`)
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
    const sPhoto = selectedStudent.foto || selectedStudent.imagem1
    const authPerson = authorizedPerson.trim()
    
    // Registra no histórico de lançamentos de autorização especial (apenas lança no card)
    addSpecialAuth(
      sId,
      sName,
      sClass,
      authPerson,
      operatorName,
      sPhoto
    )

    showToast(`Autorização lançada no card para ${sName}! Clique no alto-falante 📣 para chamar.`, true)

    // Reset Form
    setSelectedStudent(null)
    setSearch('')
    setAuthorizedPerson('')
  }


  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.04) 100%)',
      border: '1.5px solid rgba(245, 158, 11, 0.35)',
      borderRadius: 24,
      padding: '14px 18px',
      boxShadow: 'var(--shadow-lg), inset 0 0 20px rgba(245,158,11,0.03)',
      transform: 'rotate(-0.3deg)',
      transition: 'all 0.3s cubic-bezier(0.2, 1, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      height: '100%',
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'none'
      e.currentTarget.style.boxShadow = 'var(--shadow-xl), inset 0 0 20px rgba(245,158,11,0.05)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'rotate(-0.3deg)'
      e.currentTarget.style.boxShadow = 'var(--shadow-lg), inset 0 0 20px rgba(245,158,11,0.02)'
    }}
    >
      {/* 📌 Floating Pushpin */}
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        fontSize: 22, zIndex: 10, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
      }}>
        📌
      </div>

      <div style={{ fontWeight: 900, fontSize: 13, color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        📝 Autorização Especial do Dia
      </div>

      {/* COMPACT FORM GRID (SEARCH, AUTHORIZED PERSON, SUBMIT BUTTON) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        {/* COLUMN 1: STUDENT SEARCH OR SELECTION */}
        <div style={{ flex: '1 1 140px', minWidth: 0, position: 'relative' }}>
          {!selectedStudent ? (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#d97706' }}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar aluno..."
                className="form-input"
                style={{
                  width: '100%', padding: '8px 10px 8px 30px',
                  borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.45)',
                  background: 'hsl(var(--bg-surface))', fontSize: 12,
                  color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
                  height: 38,
                }}
              />

              {isSearching ? (
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={12} className="spin" color="#f59e0b" />
                </div>
              ) : search.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSearch(''); }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d97706' }}
                >
                  <X size={14} />
                </button>
              ) : null}

              {/* Autocomplete Results */}
              {results.length > 0 && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
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
                        {a.foto || a.imagem1 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.foto || a.imagem1} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        ) : (
                          a.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
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
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 8px', borderRadius: 12, height: 38,
              background: 'hsl(var(--bg-surface))', border: '1.5px dashed rgba(245, 158, 11, 0.45)',
              position: 'relative', boxSizing: 'border-box',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, overflow: 'hidden',
                background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: '#f59e0b', flexShrink: 0,
              }}>
                {selectedStudent.foto || selectedStudent.imagem1 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedStudent.foto || selectedStudent.imagem1} alt={selectedStudent.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                ) : (
                  selectedStudent.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 10.5, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudent.nome}
                </div>
                <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', lineHeight: 1 }}>
                  {selectedStudent.turmaNome || selectedStudent.turma}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedStudent(null); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'hsl(var(--text-muted))', display: 'flex', padding: 2,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'hsl(var(--text-muted))'}
              >
                <X size={13}/>
              </button>
            </div>
          )}
        </div>

        {/* COLUMN 2: AUTHORIZED PERSON */}
        <div style={{ flex: '1.1 1 150px', minWidth: 0 }}>
          <input
            value={authorizedPerson}
            onChange={e => setAuthorizedPerson(e.target.value)}
            placeholder="Quem está autorizado a retirar?"
            disabled={!selectedStudent}
            className="form-input"
            style={{
              width: '100%', padding: '8px 10px',
              borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'hsl(var(--bg-surface))', fontSize: 12,
              color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
              opacity: selectedStudent ? 1 : 0.5,
              height: 38,
            }}
          />
        </div>

        {/* SUBMIT BUTTON: LANÇAR AUTORIZAÇÃO */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirm(); }}
          disabled={!selectedStudent || !authorizedPerson.trim()}
          style={{
            height: 38, padding: '0 14px', borderRadius: 12, flexShrink: 0,
            background: (!selectedStudent || !authorizedPerson.trim())
              ? 'hsl(var(--bg-elevated))'
              : 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: (!selectedStudent || !authorizedPerson.trim()) ? '1px solid hsl(var(--border-subtle))' : 'none',
            color: (!selectedStudent || !authorizedPerson.trim()) ? 'hsl(var(--text-muted))' : '#fff',
            fontWeight: 800, fontSize: 11, cursor: (!selectedStudent || !authorizedPerson.trim()) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
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
          <CheckCircle2 size={13}/> Lançar Autorização
        </button>
      </div>

      {/* TIMELINE LOG OF TODAY'S RELEASES */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ borderTop: '1px solid rgba(245,158,11,0.22)', paddingTop: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Lançados Hoje</span>
          <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{launches.length} total</span>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          alignContent: 'start',
          alignItems: 'start',
          gap: 8,
          maxHeight: 260, paddingRight: 4,
        }}>
          {launches.map(l => (
            <div
              key={l.id}
              style={{
                background: l.confirmedOut ? 'rgba(16,185,129,0.08)' : 'hsl(var(--bg-surface))', 
                border: l.confirmedOut ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.22)',
                borderRadius: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s',
                minWidth: 0,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 6, overflow: 'hidden',
                background: l.confirmedOut ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.12)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, color: l.confirmedOut ? '#10b981' : '#f59e0b', flexShrink: 0,
              }}>
                {l.studentPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.studentPhoto} alt={l.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                ) : (
                  l.studentName.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 11, color: 'hsl(var(--text-primary))', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.studentName}
                </div>
                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 1, lineHeight: 1.35, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  retirado por: <span style={{ color: l.confirmedOut ? '#10b981' : '#d97706', fontWeight: 700 }}>{l.authorizedPerson}</span>
                </div>
                <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 4, fontWeight: 500, flexWrap: 'wrap' }}>
                  <span>{l.time}</span>
                  <span>·</span>
                  <span>por: <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>{l.loggedBy}</span></span>
                </div>
                {l.confirmedOut && (
                  <div style={{ fontSize: 8.5, color: '#10b981', fontWeight: 800, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', wordBreak: 'break-word' }}>
                    <CheckCircle2 size={10} style={{ flexShrink: 0 }} /> Confirmada saída às {l.confirmedAt}
                  </div>
                )}
              </div>
              
              {/* MICRO ACTION BUTTONS (STACKED: TOP LINE = CHAMAR + CONFIRMAR, BOTTOM LINE = EXCLUIR) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
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
                              l.studentPhoto
                            )
                            showToast(`Aluno ${l.studentName} chamado na TV!`, true)
                          }
                        }}
                        title={isCalling ? "Aluno sendo chamado na TV. Clique para rechamar" : "Chamar Aluno na TV"}
                        style={{
                          background: btnBg, border: 'none', cursor: 'pointer',
                          borderRadius: 6, width: 26, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                        <Megaphone size={13} />
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
                        showToast(`Saída de ${l.studentName} já foi confirmada!`, false)
                        return
                      }
                      confirmSpecialExit(
                        l.studentId,
                        l.studentName,
                        l.studentClass,
                        l.authorizedPerson,
                        l.studentPhoto
                      )
                      showToast(`Saída de ${l.studentName} confirmada!`, true)
                    }}
                    disabled={l.confirmedOut}
                    title={l.confirmedOut ? `Saída confirmada às ${l.confirmedAt}` : "Confirmar Saída do Aluno"}
                    style={{
                      background: l.confirmedOut ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)',
                      border: 'none',
                      cursor: l.confirmedOut ? 'default' : 'pointer',
                      borderRadius: 6, width: 26, height: 24,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#10b981', transition: 'all 0.2s', flexShrink: 0,
                      opacity: l.confirmedOut ? 0.7 : 1,
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
                    <CheckCircle2 size={13} />
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
                    borderRadius: 6, width: '100%', height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  <Trash2 size={13}/>
                </button>
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
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
              zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Proibidos Retirada Component ──────────────────────────────────────────
function ProibidosRetiradaCard() {
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
    }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🚫</span> Proibidos Retirada Hoje
        </div>
        {restritos.length > 0 && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            {restritos.length} {restritos.length === 1 ? 'aluno' : 'alunos'}
          </span>
        )}
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 12, padding: '20px 0', opacity: 0.7 }}>Buscando restrições...</div>
        ) : restritos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 11, padding: '20px 0', opacity: 0.6, fontStyle: 'italic' }}>
            Nenhuma restrição encontrada para hoje.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
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
                  <div style={{ fontWeight: 800, fontSize: 12, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {aluno.nome}
                  </div>
                  {aluno.restritos.map((r: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ 
                        fontSize: 8, 
                        fontWeight: 700, 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        textTransform: 'uppercase',
                        backgroundColor: 'rgba(156, 163, 175, 0.15)',
                        color: '#6b7280',
                        border: '1px solid rgba(156, 163, 175, 0.3)'
                      }}>
                        {r.parentesco ? r.parentesco : 'Resp.'}
                      </span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>{r.nome}</span>
                      <span style={{ 
                        fontSize: 8, 
                        fontWeight: 800, 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        textTransform: 'uppercase',
                        backgroundColor: r.motivo === 'Proibido' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                        color: r.motivo === 'Proibido' ? '#ef4444' : '#f97316',
                        border: `1px solid ${r.motivo === 'Proibido' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)'}`
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
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ChamadasContent() {

  const { activeCalls = [], confirmPickup, cancelCall, recallStudent, revertCall, callStudent, clearCalls, realtimeStatus, refreshCalls, isLoadingCalls } = useSaida()
  const { currentUser, currentUserPerfil } = useApp()
  const [turmas] = useSupabaseArray<any>('turmas');
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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
      refreshCalls() // Dispara imediatamente
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

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=10`)
        if (!res.ok) throw new Error('Falha ao buscar alunos')
        const json = await res.json()
        const data = json.data || []

        // Filtra apenas alunos ativos/matriculados
        const filtered = data.filter((a: any) =>
          ['ativo', 'matriculado'].includes(String(a.status || '').trim().toLowerCase())
        )

        const mapped = filtered.map((a: any) => {
          const turmaObj = (turmas || []).find((t: any) => 
            String(t.id) === String(a.turma) || t.codigo === a.turma || t.nome === a.turma
          )
          return { ...a, turmaNome: turmaObj?.nome || a.turma }
        })

        setSchoolResults(mapped)
      } catch (err) {
        console.error('Erro ao buscar alunos:', err)
        setSchoolResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [studentSearch, turmas])

  const handleCall = (
    studentId: string, studentName: string, studentClass: string,
    guardianId: string, guardianName: string,
    studentPhoto?: string | null,
  ) => {
    const isConfirmedToday = activeCalls.some(c => c.studentId === studentId && c.status === 'confirmed')
    if (isConfirmedToday) {
      showToast(`${studentName} já teve a saída confirmada hoje!`, false);
      return;
    }
    const hasActive = activeCalls.some(c =>
      c.studentId === studentId && (c.status === 'waiting' || c.status === 'called')
    )
    if (hasActive) { showToast(`${studentName} já está em chamada ativa.`, false); return }
    callStudent(studentId, studentName, studentClass, guardianId, guardianName, 'manual', undefined, studentPhoto)
    showToast(`${studentName} chamado(a)!`)
    setStudentSearch('')
  }

  const confirmedStudentIds = useMemo(() => {
    return new Set(
      activeCalls
        .filter(c => c.status === 'confirmed' && c.studentId != null)
        .map(c => String(c.studentId))
    )
  }, [activeCalls])

  const confirmed = useMemo(() => {
    const list = activeCalls.filter(c => c.status === 'confirmed')
    const seen = new Set<string>()
    const dedup: any[] = []
    for (const c of list) {
      const key = c.studentId ? String(c.studentId) : c.id
      if (!seen.has(key)) {
        seen.add(key)
        dedup.push(c)
      }
    }
    return dedup
  }, [activeCalls])

  const allCalls = useMemo(() => {
    const list = activeCalls.filter(c => c.status !== 'special_auth')
    const seen = new Set<string>()
    const dedup: any[] = []
    for (const c of list) {
      const key = c.status === 'confirmed' && c.studentId ? `confirmed-${c.studentId}` : c.id
      if (!seen.has(key)) {
        seen.add(key)
        dedup.push(c)
      }
    }
    return dedup
  }, [activeCalls])

  const waiting   = activeCalls.filter(c => (c.status === 'waiting' || c.status === 'called') && c.studentId != null && !confirmedStudentIds.has(String(c.studentId)))
  const cancelled = activeCalls.filter(c => c.status === 'cancelled')
  const blocked   = activeCalls.filter(c => c.status === 'blocked')

  const filtered = useMemo(() => {
    // PRECALCULATE TIMESTAMPS AND SEARCH STRINGS FOR FAST SORTING/FILTERING
    let list = activeCalls.map(c => ({
      ...c,
      _parsedTime: new Date(c.calledAt).getTime(),
      _searchStr: (c.studentName + ' ' + c.studentClass + ' ' + (c.guardianName||'')).toLowerCase()
    }))

    list.sort((a, b) => b._parsedTime - a._parsedTime)

    if (filter === 'all') {
      list = list.filter(c => c.status !== 'special_auth')
      const seen = new Set<string>()
      list = list.filter(c => {
        if (c.status === 'confirmed') {
          const key = (c.studentId ? String(c.studentId).trim() : '') || (c.studentName ? c.studentName.trim().toLowerCase() : c.id)
          if (seen.has(key)) return false
          seen.add(key)
        }
        return true
      })
    }
    else if (filter === 'waiting')   list = list.filter(c => (c.status === 'waiting' || c.status === 'called') && c.studentId != null && !confirmedStudentIds.has(String(c.studentId)))
    else if (filter === 'confirmed') {
      list = list.filter(c => c.status === 'confirmed')
      const seen = new Set<string>()
      list = list.filter(c => {
        const key = (c.studentId ? String(c.studentId).trim() : '') || (c.studentName ? c.studentName.trim().toLowerCase() : c.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    else if (filter === 'cancelled') list = list.filter(c => c.status === 'cancelled')
    else if (filter === 'blocked')   list = list.filter(c => c.status === 'blocked')
    
    if (callSearch.trim()) {
      const q = callSearch.toLowerCase()
      list = list.filter(c => c._searchStr.includes(q))
    }
    return list
  }, [activeCalls, filter, callSearch, confirmedStudentIds])

  const FILTERS = [
    { key: 'all'       as FilterType, label: 'Todos',       color: '#818cf8', count: mounted ? allCalls.length : 0 },
    { key: 'waiting'   as FilterType, label: 'Aguardando',  color: '#f59e0b', count: mounted ? waiting.length    : 0 },
    { key: 'confirmed' as FilterType, label: 'Confirmados', color: '#10b981', count: mounted ? confirmed.length  : 0 },
    { key: 'cancelled' as FilterType, label: 'Cancelados',  color: '#94a3b8', count: mounted ? cancelled.length  : 0 },
    { key: 'blocked'   as FilterType, label: 'Bloqueados',  color: '#ef4444', count: mounted ? blocked.length    : 0 },
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
      <AnimatePresence>
{/* Toast */}
      {toast && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 700, zIndex: 9999,
          background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'slideDown 0.3s ease',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        
</motion.div>
)}</AnimatePresence>

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
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 20,
          position: 'relative',
        }}
      >
        {/* Left: Blue Megaphone Circle + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}>
            <Megaphone size={18} />
          </div>
          <span style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 15,
            color: '#2563eb', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>
            Chamar aluno
          </span>
        </div>

        {/* Middle: Search Input */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
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
              width: '100%', padding: '10px 14px 10px 40px',
              borderRadius: 14, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-surface))', fontSize: 13,
              color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              height: 42,
            }}
          />
          {studentSearch && (
            <button
              onClick={() => { setStudentSearch(''); }}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'hsl(var(--text-muted))', padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <X size={15}/>
            </button>
          )}

          {/* OVERLAY DROPDOWN FOR RESULTS */}
          {searchFocused && studentSearch.trim().length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 20,
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
              zIndex: 1000,
              maxHeight: '65vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              padding: 6,
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 8 }}>
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
        </div>

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

      {/* ── FILTERS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', marginRight: 4 }}>HISTÓRICO</div>
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilter(f.key); }} style={{
            padding: '7px 12px', borderRadius: 100, fontSize: isMobile ? 11 : 12, fontWeight: 700,
            border: `1px solid ${filter === f.key ? f.color : 'hsl(var(--border-subtle))'}`,
            background: filter === f.key ? `${f.color}12` : 'hsl(var(--bg-elevated))',
            color: filter === f.key ? f.color : 'hsl(var(--text-muted))',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {f.label}
            <span style={{
              background: filter === f.key ? `${f.color}20` : 'hsl(var(--bg-overlay))',
              color: filter === f.key ? f.color : 'hsl(var(--text-muted))',
              borderRadius: 100, fontSize: 10, padding: '1px 7px', fontWeight: 900,
            }}>{f.count}</span>
          </button>
        ))}
        <input
          value={callSearch} onChange={e => setCallSearch(e.target.value)}
          placeholder="Filtrar histórico..."
          style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, fontSize: 12,
            border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))',
            color: '#000000', outline: 'none', minWidth: 180,
          }}
        />

        {isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setConfirmClearAll(true)
            }}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#ef4444'
              el.style.color = '#fff'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(239,68,68,0.1)'
              el.style.color = '#ef4444'
            }}
          >
            <X size={14}/> Zerar Chamadas
          </button>
        )}
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(195px, 1fr))', gap: isMobile ? 10 : 14 }}>
          {filtered.map(rawCall => {
            const turmaNome = (turmas || []).find((t: any) => String(t.id) === String(rawCall.studentClass))?.nome || rawCall.studentClass
            // Mutações ou clonagens seguras devem ser feitas antes, mas como `filtered` já mudou, o ideal é passar propriedades flat ou garantir que o objeto em si seja estável.
            // Para não quebrar a tipagem de call, vamos injetar a string como propriedade separada se necessário, mas o mais seguro aqui é apenas o `Object.assign` no map caso seja inevitável.
            // Para evitar re-render, CallCard deve usar deep comparison ou o React.memo deve ter um custom comparator function.
            // Como não posso alterar CallCard facilmente agora, criarei a prop estática:
            rawCall.studentClass = turmaNome; 
            return (
              <CallCard
                key={rawCall.id}
                call={rawCall}
                onConfirm={confirmPickup}
                onCancel={cancelCall}
                onRecall={handleRecall}
                onRevert={revertCall}
                onOpenIrmaos={setSelectedCallForIrmaos}
              />
            )
          })}
        </div>
      )}

      {/* ── MODAL ULTRA MODERNO DE CHAMAR IRMÃOS ────────────────────────── */}
      <AnimatePresence>
        {selectedCallForIrmaos && (
          <ModalChamarIrmaos
            call={selectedCallForIrmaos}
            onClose={() => setSelectedCallForIrmaos(null)}
            activeCalls={activeCalls}
            onCallStudent={(sId, sName, sClass, gId, gName, sFoto) => {
              handleCall(sId, sName, sClass, gId, gName, sFoto)
            }}
            onRecallStudent={handleRecall}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL DE CONFIRMAÇÃO (ZERAR CHAMADAS) ───────────────────────── */}
      <AnimatePresence>
        {confirmClearAll && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
              zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideDown { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
        
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
