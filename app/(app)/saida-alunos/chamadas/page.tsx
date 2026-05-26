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

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'
import {
  CheckCircle2, Clock, Search, Megaphone, X, GraduationCap,
  UserCheck, ChevronRight, RotateCcw, RefreshCw, Trash2, Pin
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

function elapsedSec(since: string, nowTime: number = Date.now()) {
  return Math.max(0, Math.floor((nowTime - new Date(since).getTime()) / 1000))
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Unified call card (Ultra Modern TV-Monitor style) ─────────────────────────
const CallCard = React.memo(function CallCard({ call, onConfirm, onCancel, onRecall, onRevert, nowTime }: {
  call:      PickupCall
  onConfirm: (id: string) => void
  onCancel:  (id: string) => void
  onRecall:  (id: string) => void
  onRevert:  (id: string) => void
  nowTime:   number
}) {
  const { config } = useSaida()
  const [recalling, setRecalling] = useState(false)
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

  return (
    <div style={{
      position: 'relative',
      borderRadius: 20,
      overflow: 'hidden',
      background: 'hsl(var(--bg-elevated))',
      border: `1px solid ${color}${isFinished ? '20' : '40'}`,
      boxShadow: `0 8px 30px rgba(0,0,0,0.06), 0 0 15px ${color}${urgent ? '30' : '05'}`,
      display: 'flex',
      flexDirection: 'column',
      opacity: isFinished ? 0.75 : 1,
      transition: 'all 0.3s cubic-bezier(0.2, 1, 0.2, 1)',
      animation: urgent ? 'cardFloatUrgent 4s ease-in-out infinite' : 'none',
      minHeight: 320,
      aspectRatio: '1 / 1.38',
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
            fontSize: 56, fontWeight: 900, color: '#fff',
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
          position: 'absolute', top: 12, left: 12,
          padding: '6px 12px', borderRadius: 50,
          background: color,
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 900, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          boxShadow: `0 4px 16px ${color}80`,
          zIndex: 10,
        }}>
          {isActive ? <Clock size={10} className={urgent ? 'tv-pulse-icon' : ''} /> : 
           call.status === 'confirmed' ? <CheckCircle2 size={10} /> : <X size={10} />}
          {urgent ? 'ATRASADO' : meta.label}
        </div>

        {/* Live Timer (if active) */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            padding: '4px 10px', borderRadius: 50,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 10, fontWeight: 900, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 10,
          }}>
            {mins} MIN
          </div>
        )}
      {/* ── CONTENT AREA ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 5, marginTop: 'auto',
        padding: '16px 20px 20px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 16, fontWeight: 900, color: '#fff',
          lineHeight: 1.2, marginBottom: 4, textTransform: 'uppercase',
          fontFamily: 'Outfit, sans-serif', textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}>
          {call.studentName}
        </div>
        
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase',
          letterSpacing: '0.02em', marginBottom: 16,
        }}>
          <GraduationCap size={12} />
          {call.studentClass}
        </div>



        {/* Block Reason Banner */}
        {isBlocked && call.blockReason && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 16,
            background: `rgba(${call.blockType === 'proibido' ? '239,68,68' : '249,115,22'}, 0.15)`,
            border: `1px solid ${color}40`, fontSize: 10, color: '#cbd5e1', lineHeight: 1.4,
          }}>
            <strong style={{ color }}>{call.blockType === 'proibido' ? '🚫 PROIBIDO: ' : '📅 DIA RESTRITO: '}</strong>
            {call.blockReason}
          </div>
        )}

        {/* Footer info (Guardian & Time) */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          {/* Left: Guardian */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, paddingRight: 8 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Responsável
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f8fafc', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
              <UserCheck size={12} color="#cbd5e1" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {call.guardianName || 'Não Informado'}
              </span>
            </div>
          </div>
          
          {/* Right: Times */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 10, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
               <Megaphone size={10} color={color} />
               {fmtTime(call.calledAt)}
             </div>
             {call.confirmedAt && (
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                 <CheckCircle2 size={10} />
                 {fmtTime(call.confirmedAt)}
               </div>
             )}
          </div>
        </div>

        {/* ── ACTION BUTTONS ─────────────────────────────────────────────── */}
        {isActive && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-modern btn-chamar" onClick={handleRecall} disabled={recalling} style={{
              flex: 1, height: 42, borderRadius: 12,
              fontWeight: 800, fontSize: 11, cursor: recalling ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textTransform: 'uppercase',
            }}>
              <Megaphone size={13}/> {recalling ? 'Chamando...' : 'Chamar'}
            </button>

            <button className="btn-modern btn-confirmar" onClick={() => onConfirm(call.id)} style={{
              flex: 1.5, height: 42, borderRadius: 12,
              fontWeight: 800, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textTransform: 'uppercase',
            }}>
              <CheckCircle2 size={13}/> Confirmar
            </button>

            <button className="btn-modern btn-cancelar" onClick={() => onCancel(call.id)} style={{
              width: 42, height: 42, flexShrink: 0, borderRadius: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={15}/>
            </button>
          </div>
        )}

        {isFinished && (
          <button onClick={() => onRevert(call.id)} style={{
            width: '100%', height: 42, borderRadius: 12,
            background: 'hsl(var(--bg-overlay))', border: '1px solid hsl(var(--border-subtle))',
            color: 'hsl(var(--text-muted))', fontWeight: 700, fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s', textTransform: 'uppercase',
          }}>
            <RotateCcw size={13}/> Reverter para Aguardando
          </button>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.call.status === next.call.status &&
         prev.call.id === next.call.id &&
         prev.nowTime === next.nowTime
})

// ── Student search row with inline guardian buttons ───────────────────────────
const StudentSearchRow = React.memo(function StudentSearchRow({ student, activeCalls, onCall, showToast }: {
  student: any
  activeCalls: PickupCall[]
  onCall: (sId: string, sName: string, sClass: string, gId: string, gName: string, foto?: string | null) => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  // Read autorizados directly from aluno.saude (set in nova-matricula)
  const saude: any = student.saude || {}
  const autorizados: any[] = saude.autorizados || []
  const autorizaSaida: boolean = student.autorizadoSairSozinho === true || saude.autorizaSaida === true   // can leave alone

  const [showProibidoAlert, setShowProibidoAlert] = useState<{ name: string, message: string } | null>(null)

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

    if (autorizados.length > 0) {
      autorizados.forEach((aut, i) => {
        const key = (aut.nome || '').toLowerCase().trim()
        if (!key || seen.has(key)) return
        seen.add(key)
        list.push({
          id: `saude-aut-${i}`,
          name: aut.nome,
          role: aut.parentesco || 'Autorizado',
          rfid: aut.rfid,
          proibido: aut.proibido === true,
          diasSemana: aut.diasSemana || [],
        })
      })
    } else {
      // Responsáveis from responsaveis array (Process first to get proibido and diasSemana!)
      const resps: any[] = student.responsaveis || []
      resps.forEach((r: any, i: number) => {
        const key = (r.nome || '').toLowerCase().trim()
        if (key && !seen.has(key)) {
          seen.add(key)
          list.push({ 
            id: `resp-${i}`, 
            name: r.nome, 
            role: r.parentesco || 'Responsável',
            proibido: r.proibido === true,
            diasSemana: r.diasAcesso || r.dias_acesso || r.diasSemana || []
          })
        }
      })
      // Fallback to ERP fields when no saude.autorizados configured
      const erp: { name: string; role: string }[] = []
      if (student.responsavel?.trim())           erp.push({ name: student.responsavel.trim(),           role: 'Responsável' })
      if (student.responsavelFinanceiro?.trim()) erp.push({ name: student.responsavelFinanceiro.trim(), role: 'Financeiro' })
      if (student.responsavelPedagogico?.trim()) erp.push({ name: student.responsavelPedagogico.trim(), role: 'Pedagógico' })
      erp.forEach((c, i) => {
        const key = c.name.toLowerCase().trim()
        if (!seen.has(key)) { seen.add(key); list.push({ id: `erp-${i}`, name: c.name, role: c.role }) }
      })
    }
    return list
  }, [autorizados, student.responsaveis, student.responsavel, student.responsavelFinanceiro, student.responsavelPedagogico])

  const alreadyCalled = useMemo(() => {
    return activeCalls.some(c =>
      c.studentId === student.id && (c.status === 'waiting' || c.status === 'called')
    )
  }, [activeCalls, student.id])

  const initials = useMemo(() => student.nome?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(), [student.nome])

  return (
    <div style={{
      background: 'hsl(var(--bg-elevated))',
      border: alreadyCalled ? '1px solid rgba(245,158,11,0.35)' : '1px solid hsl(var(--border-subtle))',
      borderRadius: 16, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 13, flexShrink: 0,
          background: (student.foto || student.imagem1) ? 'none' : 'linear-gradient(135deg, #06b6d450, #6366f130)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 20, color: '#fff', fontFamily: 'Outfit, sans-serif',
          position: 'relative', overflow: 'hidden',
          border: (student.foto || student.imagem1) ? '1px solid hsl(var(--border-subtle))' : 'none',
        }}>
          {(student.foto || student.imagem1) ? (
            <Image src={student.foto || student.imagem1} alt={student.nome} width={52} height={52} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{student.nome}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <GraduationCap size={11} color="#06b6d4"/>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>{student.turmaNome || student.turma}</span>
            {student.turno && <span style={{ color: 'hsl(var(--text-muted))' }}>· {student.turno}</span>}
            {alreadyCalled && (
              <span style={{
                marginLeft: 4, padding: '1px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800,
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
              }}>⚠ Já em chamada</span>
            )}
          </div>
        </div>
      </div>
      <div style={{
        padding: '8px 18px 14px',
        borderTop: '1px solid hsl(var(--border-subtle))',
        background: 'hsl(var(--bg-base))',
      }}>
        {/* autorizaSaida badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          {autorizaSaida ? (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 800, border: '1px solid rgba(16,185,129,0.25)' }}>
              ✅ Pode sair sozinho
            </span>
          ) : (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239,68,68,0.2)' }}>
              🚫 Não pode sair sozinho
            </span>
          )}
        </div>
        {!autorizaSaida && autorizados.length === 0 && !student.responsavel && (
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
            Nenhum responsável configurado. Cadastre em Saúde &amp; Obs do aluno.
          </div>
        )}
        {respList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', marginRight: 2 }}>
              Chamar via:
            </span>
            {respList.map((g: any) => {
              const isProibido = g.proibido === true
              const dias: string[] = g.diasSemana || []
              const remap2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
              const todayK = remap2[new Date().getDay()]
              const diaRestrito = dias.length > 0 && !dias.includes(todayK)
              const blocked = alreadyCalled
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
                      onCall(student.id, student.nome, student.turmaNome || student.turma, g.id, g.name, student.foto || student.imagem1)
                    }
                  }}
                  disabled={blocked}
                  title={isProibido ? '🚫 Proibido de retirar este aluno' : diaRestrito ? `⚠ Dias permitidos: ${dias.join(', ')}` : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 100,
                    background: isProibido
                      ? 'rgba(239,68,68,0.15)'
                      : alreadyCalled || diaRestrito
                        ? 'hsl(var(--bg-overlay))'
                        : 'linear-gradient(135deg, #06b6d415, #6366f112)',
                    border: isProibido
                      ? '1px solid rgba(239,68,68,0.5)'
                      : alreadyCalled
                        ? '1px solid hsl(var(--border-subtle))'
                        : '1px solid rgba(6,182,212,0.35)',
                    color: isProibido ? '#ef4444' : alreadyCalled || diaRestrito ? 'hsl(var(--text-muted))' : 'hsl(var(--text-base))',
                    fontWeight: 700, fontSize: 12,
                    cursor: blocked || diaRestrito ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: isProibido ? 1 : alreadyCalled ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (blocked || diaRestrito || isProibido) return
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'linear-gradient(135deg, #06b6d4, #6366f1)'
                    el.style.color = '#fff'
                    el.style.borderColor = 'transparent'
                  }}
                  onMouseLeave={e => {
                    if (blocked || diaRestrito || isProibido) return
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'linear-gradient(135deg, #06b6d415, #6366f112)'
                    el.style.color = 'hsl(var(--text-base))'
                    el.style.borderColor = 'rgba(6,182,212,0.35)'
                  }}
                >
                  {isProibido ? <span style={{ fontSize: 11 }}>🚫</span> : <UserCheck size={11}/>}
                  <span>{g.name}</span>
                  {isProibido && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>(proibido retirar)</span>}
                  <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.6, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.08)' }}>
                    {g.role}
                  </span>
                  {g.rfid && <span style={{ fontSize: 9, color: '#06b6d4', fontFamily: 'monospace' }}>📡</span>}
                  {diaRestrito && !isProibido && <span style={{ fontSize: 9 }}>⚠</span>}
                  {!blocked && !diaRestrito && !isProibido && <ChevronRight size={10} style={{ opacity: 0.4 }}/>}
                </button>
              )
            })}
          </div>
        )}
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
        </AnimatePresence>
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.student.id === next.student.id && 
         prev.activeCalls === next.activeCalls
})
function CallCardSkeleton() {
  return (
    <div className="skeleton-shimmer" style={{
      borderRadius: 20,
      background: 'hsl(var(--bg-elevated))',
      border: '1px solid hsl(var(--border-subtle))',
      minHeight: 320,
      aspectRatio: '1 / 1.38',
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
  const { callStudent, confirmPickup, recallStudent, activeCalls = [] } = useSaida()
  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const { currentUser } = useApp()

  // Form State
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [authorizedPerson, setAuthorizedPerson] = useState('')

  // Launches State
  const [launches, setLaunches] = useState<SpecialLaunch[]>([])

  // Load from localStorage & Auto-clear at midnight
  useEffect(() => {
    const checkDate = (list: SpecialLaunch[]) => {
      const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return list.filter(l => l.date === todayStr)
    }

    try {
      const stored = localStorage.getItem('edu-special-launches')
      if (stored) {
        const parsed = JSON.parse(stored)
        const valid = checkDate(parsed)
        setLaunches(valid)
        if (valid.length !== parsed.length) localStorage.setItem('edu-special-launches', JSON.stringify(valid))
      }
    } catch (e) {
      console.error(e)
    }

    const iv = setInterval(() => {
      setLaunches(prev => {
        const valid = checkDate(prev)
        if (valid.length !== prev.length) {
          localStorage.setItem('edu-special-launches', JSON.stringify(valid))
          return valid
        }
        return prev
      })
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  // Sync active calls to launches
  useEffect(() => {
    let updated = false
    const newLaunches = launches.map(l => {
      if (l.confirmedOut) return l
      const matchingCall = activeCalls.find(c => 
        c.studentId === l.studentId && 
        c.status === 'confirmed' &&
        c.guardianName === l.authorizedPerson
      )
      if (matchingCall) {
        updated = true
        return {
          ...l,
          confirmedOut: true,
          confirmedAt: new Date(matchingCall.confirmedAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      }
      return l
    })

    if (updated) {
      saveLaunches(newLaunches)
    }
  }, [activeCalls, launches])

  // Save to localStorage
  const saveLaunches = (list: SpecialLaunch[]) => {
    setLaunches(list)
    try {
      localStorage.setItem('edu-special-launches', JSON.stringify(list))
    } catch (e) {
      console.error(e)
    }
  }

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
    const today = new Date()
    const timeStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // Student call removed per request. Will only be called via megaphone icon.

    // 3. Save special launch to localStorage feed
    const launch: SpecialLaunch = {
      id: crypto.randomUUID(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.nome,
      studentClass: selectedStudent.turmaNome || selectedStudent.turma,
      studentPhoto: selectedStudent.foto || selectedStudent.imagem1,
      authorizedPerson: authorizedPerson.trim(),
      loggedBy: operatorName,
      date: dateStr,
      time: timeStr
    }

    const updated = [launch, ...launches].slice(0, 50)
    saveLaunches(updated)

    showToast(`Saída especial de ${selectedStudent.nome} registrada com sucesso!`)

    // Reset Form
    setSelectedStudent(null)
    setSearch('')
    setAuthorizedPerson('')
  }

  const handleDeleteLaunch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTimeout(() => {
      if (window.confirm('Excluir este lançamento do sticker?')) {
        const updated = launches.filter(l => l.id !== id)
        saveLaunches(updated)
      }
    }, 50)
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

      {/* COMPACT SIDE-BY-SIDE GRID */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
      }}>
        {/* COLUMN 1: STUDENT SEARCH OR SELECTION */}
        <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
          {!selectedStudent ? (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#d97706' }}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar aluno..."
                className="form-input"
                style={{
                  width: '100%', padding: '10px 12px 10px 34px',
                  borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.45)',
                  background: 'hsl(var(--bg-surface))', fontSize: 13,
                  color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
                  height: 38,
                }}
              />

              {isSearching && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={12} className="spin" color="#f59e0b" />
                </div>
              )}

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
                          <Image src={a.foto || a.imagem1} alt={a.nome} width={28} height={28} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
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
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 10px', borderRadius: 12, height: 38,
              background: 'hsl(var(--bg-surface))', border: '1.5px dashed rgba(245, 158, 11, 0.45)',
              position: 'relative', boxSizing: 'border-box',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, overflow: 'hidden',
                background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, color: '#f59e0b', flexShrink: 0,
              }}>
                {selectedStudent.foto || selectedStudent.imagem1 ? (
                  <Image src={selectedStudent.foto || selectedStudent.imagem1} alt={selectedStudent.nome} width={24} height={24} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                ) : (
                  selectedStudent.nome.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 11, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudent.nome}
                </div>
                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', lineHeight: 1 }}>
                  {selectedStudent.turmaNome || selectedStudent.turma}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedStudent(null); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'hsl(var(--text-muted))', display: 'flex', padding: 4,
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
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <input
            value={authorizedPerson}
            onChange={e => setAuthorizedPerson(e.target.value)}
            placeholder="Quem está autorizado a retirar?"
            disabled={!selectedStudent}
            className="form-input"
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'hsl(var(--bg-surface))', fontSize: 12,
              color: 'hsl(var(--text-primary))', outline: 'none', boxSizing: 'border-box',
              opacity: selectedStudent ? 1 : 0.5,
              height: 38,
            }}
          />
        </div>
      </div>

      {/* CONFIRM BUTTON */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirm(); }}
        disabled={!selectedStudent || !authorizedPerson.trim()}
        style={{
          width: '100%', height: 35, borderRadius: 12,
          background: (!selectedStudent || !authorizedPerson.trim())
            ? 'hsl(var(--bg-elevated))'
            : 'linear-gradient(135deg, #f59e0b, #d97706)',
          border: (!selectedStudent || !authorizedPerson.trim()) ? '1px solid hsl(var(--border-subtle))' : 'none',
          color: (!selectedStudent || !authorizedPerson.trim()) ? 'hsl(var(--text-muted))' : '#fff',
          fontWeight: 800, fontSize: 11, cursor: (!selectedStudent || !authorizedPerson.trim()) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          boxShadow: (!selectedStudent || !authorizedPerson.trim()) ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.25)',
          transition: 'all 0.2s',
          marginBottom: 12,
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
        <CheckCircle2 size={13}/> Confirmar Saída Especial
      </button>

      {/* TIMELINE LOG OF TODAY'S RELEASES */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ borderTop: '1px solid rgba(245,158,11,0.22)', paddingTop: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Lançados Hoje</span>
          <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{launches.length} total</span>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5,
          maxHeight: 120, paddingRight: 4,
        }}>
          {launches.map(l => (
            <div
              key={l.id}
              style={{
                background: l.confirmedOut ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-surface))', 
                border: l.confirmedOut ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.22)',
                borderRadius: 10, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s'
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 5, overflow: 'hidden',
                background: l.confirmedOut ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.12)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: l.confirmedOut ? '#10b981' : '#f59e0b', flexShrink: 0,
              }}>
                {l.studentPhoto ? (
                  <Image src={l.studentPhoto} alt={l.studentName} width={22} height={22} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                ) : (
                  l.studentName.split(' ').slice(0,2).map((n:any)=>n[0]).join('').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 10.5, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.studentName}
                </div>
                <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  retirado por: <span style={{ color: l.confirmedOut ? '#10b981' : '#d97706', fontWeight: 700 }}>{l.authorizedPerson}</span>
                </div>
                <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 4, fontWeight: 500 }}>
                  <span>{l.time}</span>
                  <span>·</span>
                  <span>por: <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>{l.loggedBy}</span></span>
                </div>
                {l.confirmedOut && (
                  <div style={{ fontSize: 9, color: '#10b981', fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={10} /> Confirmada saída às {l.confirmedAt}
                  </div>
                )}
              </div>
              
              {/* MICRO ACTION BUTTONS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* BUTTON: CALL STUDENT */}
                {!l.confirmedOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const existingCall = (activeCalls || []).find(c => c.studentId === l.studentId && (c.status === 'waiting' || c.status === 'called'))
                    if (existingCall) {
                      recallStudent(existingCall.id, () => {})
                      showToast(`Aluno ${l.studentName} chamado novamente!`)
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
                      showToast(`Aluno ${l.studentName} chamado na TV!`)
                    }
                  }}
                  title="Chamar Aluno"
                  style={{
                    background: 'rgba(99,102,241,0.12)', border: 'none', cursor: 'pointer',
                    borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#818cf8', transition: 'all 0.2s', flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#6366f1'
                    e.currentTarget.style.color = '#fff'
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(99,102,241,0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                    e.currentTarget.style.color = '#818cf8'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <Megaphone size={11} />
                </button>
                )}

                {/* BUTTON: CONFIRM PICKUP */}
                {!l.confirmedOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const existingCall = (activeCalls || []).find(c => c.studentId === l.studentId && (c.status === 'waiting' || c.status === 'called'))
                    if (existingCall) {
                      confirmPickup(existingCall.id)
                    } else {
                      const call = callStudent(
                        l.studentId,
                        l.studentName,
                        l.studentClass,
                        'special-auth',
                        l.authorizedPerson,
                        'manual',
                        undefined,
                        l.studentPhoto
                      )
                      if (call) {
                        confirmPickup(call.id)
                      }
                    }
                    showToast(`Saída de ${l.studentName} confirmada!`)
                  }}
                  title="Confirmar Saída"
                  style={{
                    background: 'rgba(16,185,129,0.12)', border: 'none', cursor: 'pointer',
                    borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#34d399', transition: 'all 0.2s', flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#10b981'
                    e.currentTarget.style.color = '#fff'
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(16,185,129,0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(16,185,129,0.12)'
                    e.currentTarget.style.color = '#34d399'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <CheckCircle2 size={11} />
                </button>
                )}

                {/* BUTTON: DELETE LAUNCH */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLaunch(l.id, e); }}
                  title="Excluir Lançamento"
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer',
                    borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ef4444', transition: 'all 0.2s', flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ef4444'
                    e.currentTarget.style.color = '#fff'
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(239,68,68,0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                    e.currentTarget.style.color = '#ef4444'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <Trash2 size={11}/>
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
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ChamadasContent() {
  // -- Global Tick for Performant Timers --
  const [globalNow, setGlobalNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setGlobalNow(Date.now()), 10000)
    return () => clearInterval(iv)
  }, [])

  const { activeCalls = [], confirmPickup, cancelCall, recallStudent, revertCall, callStudent, clearCalls, realtimeStatus, refreshCalls, isLoadingCalls } = useSaida()
  const [turmas] = useSupabaseArray<any>('turmas');
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [filter,        setFilter]        = useState<FilterType>('waiting')
  const [callSearch,    setCallSearch]    = useState('')
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  // -- Busca de Alunos Refatorada Direct Supabase --
  const [studentSearch, setStudentSearch] = useState('')
  const [schoolResults, setSchoolResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

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
    const hasActive = activeCalls.some(c =>
      c.studentId === studentId && (c.status === 'waiting' || c.status === 'called')
    )
    if (hasActive) { showToast(`${studentName} já está em chamada ativa.`, false); return }
    callStudent(studentId, studentName, studentClass, guardianId, guardianName, 'manual', undefined, studentPhoto)
    showToast(`${studentName} chamado(a)!`)
    setStudentSearch('')
  }

  const waiting   = activeCalls.filter(c => c.status === 'waiting' || c.status === 'called')
  const confirmed = activeCalls.filter(c => c.status === 'confirmed')
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

    if (filter === 'waiting')   list = list.filter(c => c.status === 'waiting' || c.status === 'called')
    if (filter === 'confirmed') list = list.filter(c => c.status === 'confirmed')
    if (filter === 'cancelled') list = list.filter(c => c.status === 'cancelled')
    if (filter === 'blocked')   list = list.filter(c => c.status === 'blocked')
    
    if (callSearch.trim()) {
      const q = callSearch.toLowerCase()
      list = list.filter(c => c._searchStr.includes(q))
    }
    return list
  }, [activeCalls, filter, callSearch])

  const FILTERS = [
    { key: 'all'       as FilterType, label: 'Todos',       color: '#818cf8', count: mounted ? activeCalls.length : 0 },
    { key: 'waiting'   as FilterType, label: 'Aguardando',  color: '#f59e0b', count: mounted ? waiting.length    : 0 },
    { key: 'confirmed' as FilterType, label: 'Confirmados', color: '#10b981', count: mounted ? confirmed.length  : 0 },
    { key: 'cancelled' as FilterType, label: 'Cancelados',  color: '#94a3b8', count: mounted ? cancelled.length  : 0 },
    { key: 'blocked'   as FilterType, label: 'Bloqueados',  color: '#ef4444', count: mounted ? blocked.length    : 0 },
  ]

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
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            📢 Gestão de Chamadas
          </h1>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
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



      {/* ── TOP CONTAINERS GRID (SEARCH & STICKER) ─────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
        gap: 20,
        marginBottom: 28,
        alignItems: 'start',
      }}>
        {/* ── SEARCH ─────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(99,102,241,0.03))',
          border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 20, padding: '14px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: '#06b6d4', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Search size={15} color="#06b6d4"/> Chamar Aluno
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}/>
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Buscar aluno por nome (mínimo 3 letras)..."
              style={{
                width: '100%', padding: '10px 12px 10px 34px',
                borderRadius: 12, border: '1px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-elevated))', fontSize: 13,
                color: 'hsl(var(--text-base))', outline: 'none', boxSizing: 'border-box',
                height: 38,
              }}
            />
            {studentSearch && (
              <button onClick={() => { setStudentSearch(''); }} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'hsl(var(--text-muted))', padding: 4, display: 'flex',
              }}>
                <X size={14}/>
              </button>
            )}
          </div>
          
          {studentSearch.trim().length > 0 && studentSearch.trim().length < 3 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '12px 0' }}>
              Digite pelo menos 3 letras do nome do aluno.
            </div>
          )}
          
          {isSearching && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <RefreshCw size={14} className="spin" /> Buscando alunos...
            </div>
          )}

          {!isSearching && studentSearch.trim().length >= 3 && schoolResults.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schoolResults.map((a: any) => (
                <StudentSearchRow key={a.id} student={a} activeCalls={activeCalls} onCall={handleCall} showToast={showToast}/>
              ))}
            </div>
          )}
          
          {!isSearching && studentSearch.trim().length >= 3 && schoolResults.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '12px 0' }}>
              Nenhum aluno encontrado com esse nome.
            </div>
          )}
        </div>

        {/* ── STICKER ────────────────────────────────────────────────── */}
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
            color: 'hsl(var(--text-base))', outline: 'none', minWidth: 180,
          }}
        />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setTimeout(() => {
              if (window.confirm('Tem certeza que deseja zerar e excluir todas as chamadas? Esta ação não pode ser desfeita.')) {
                clearCalls()
                showToast('Todas as chamadas foram zeradas.')
              }
            }, 50)
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
      </div>

      {/* ── CALL GRID ────────────────────────────────────────────────── */}
      {isLoadingCalls ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(276px, 1fr))', gap: isMobile ? 12 : 16 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(276px, 1fr))', gap: isMobile ? 12 : 16 }}>
          {filtered.map(call => {
            const turmaNome = (turmas || []).find((t: any) => String(t.id) === String(call.studentClass))?.nome || call.studentClass
            return (
              <CallCard
                key={call.id}
                call={{ ...call, studentClass: turmaNome }}
                nowTime={globalNow}
                onConfirm={confirmPickup}
                onCancel={cancelCall}
                onRecall={id => recallStudent(id, () => {})}
                onRevert={revertCall}
              />
            )
          })}
        </div>
      )}

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
