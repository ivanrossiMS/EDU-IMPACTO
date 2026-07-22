'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { RFIDInput, RFIDInputHandle } from '@/components/saida/RFIDInput'
import {
  Scan, X, Tablet, ShieldOff, Phone, Search,
  GraduationCap, CheckCircle2, Clock, Megaphone, Users,
} from 'lucide-react'

// ─── CSS vars standalone + animações ──────────────────────────────────────────
const STANDALONE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
  :root {
    --bg-base: 215 28% 9%;
    --bg-elevated: 215 26% 12%;
    --bg-overlay: 215 24% 16%;
    --border-subtle: 215 20% 20%;
    --text-base: 210 20% 90%;
    --text-muted: 215 15% 55%;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: hsl(var(--bg-base));
    color: hsl(var(--text-base));
    font-family: 'Outfit', sans-serif;
    min-height: 100vh;
  }
  @keyframes scanPulse {
    0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(6,182,212,0.4), 0 0 0 0 rgba(6,182,212,0.2); }
    50%      { opacity:0.85; transform:scale(1.04); box-shadow:0 0 0 24px rgba(6,182,212,0), 0 0 0 40px rgba(6,182,212,0); }
  }
  @keyframes laserSweep {
    0%, 100% { top: 0%; opacity: 0; }
    8%, 92% { opacity: 1; }
    50% { top: 100%; opacity: 1; }
  }
  @keyframes radarPulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(6,182,212,0.6)); }
    50% { transform: scale(1.08); filter: drop-shadow(0 0 20px rgba(6,182,212,0.95)); }
  }
  @keyframes textPulse {
    0%, 100% { opacity: 1; text-shadow: 0 0 16px rgba(6,182,212,0.5), 0 0 32px rgba(6,182,212,0.2); }
    50% { opacity: 0.88; text-shadow: 0 0 28px rgba(6,182,212,0.85), 0 0 48px rgba(6,182,212,0.4); }
  }
  @keyframes spinSlow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(28px) scale(0.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes slideDown {
    from { opacity:0; transform:translate(-50%,-16px); }
    to   { opacity:1; transform:translate(-50%,0); }
  }
  @keyframes cardIn {
    from { opacity:0; transform:translateY(22px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ripple {
    0%   { transform:scale(0); opacity:0.5; }
    100% { transform:scale(2.5); opacity:0; }
  }
  .student-card-btn {
    position:relative; overflow:hidden; cursor:pointer;
    transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s ease;
  }
  .student-card-btn:active { transform:scale(0.97) !important; }
  .student-card-btn::after {
    content:''; position:absolute; inset:0;
    background:radial-gradient(circle at var(--rx,50%) var(--ry,50%), rgba(255,255,255,0.12) 0%, transparent 70%);
    opacity:0; transition:opacity 0.15s;
  }
  .student-card-btn:hover::after { opacity:1; }
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
`

// ─── Helper: verifica se hoje é dia permitido ─────────────────────────────────
function isDiaPermitido(diasSemana: string[]): boolean {
  if (!diasSemana || diasSemana.length === 0) return true
  const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
  return diasSemana.includes(remap[new Date().getDay()])
}

// ─── StudentCard: card grande clicável ────────────────────────────────────────
function StudentCard({
  aluno, aut, guardianName, rfidCode, onCall, onRecall, index,
}: {
  aluno: any; aut: any; guardianName: string
  rfidCode?: string; onCall: () => void; onRecall: () => void; index: number
}) {
  const { activeCalls } = useSaida()
  const btnRef = useRef<HTMLDivElement>(null)

  const isProibido  = aut?.proibido === true
  const diaOk       = isDiaPermitido(aut?.diasSemana || [])
  const alreadyCalled = activeCalls.some(c =>
    c.studentId === aluno.id && (c.status === 'waiting' || c.status === 'called')
  )
  const alreadyConfirmed = activeCalls.some(c =>
    c.studentId === aluno.id && c.status === 'confirmed'
  )
  const [recalling, setRecalling] = useState(false)
  // Card is blocked only for real restrictions, or if already withdrawn
  const blocked = isProibido || !diaOk || alreadyConfirmed

  const initials = (aluno.nome || '?').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const foto     = aluno.foto

  // Color palette by state
  const accent = isProibido ? '#ef4444' : alreadyConfirmed ? '#10b981' : alreadyCalled ? '#f59e0b' : '#06b6d4'
  const accentDim = isProibido ? 'rgba(239,68,68,0.15)' : alreadyConfirmed ? 'rgba(16,185,129,0.12)' : alreadyCalled ? 'rgba(245,158,11,0.12)' : 'rgba(6,182,212,0.12)'

  const handleRecall = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRecalling(true)
    onRecall()
    setTimeout(() => setRecalling(false), 2600)
  }

  // Ripple effect
  const handlePointerDown = (e: React.PointerEvent) => {
    if (blocked) return
    const el = btnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--rx', `${((e.clientX - rect.left) / rect.width * 100).toFixed(1)}%`)
    el.style.setProperty('--ry', `${((e.clientY - rect.top)  / rect.height * 100).toFixed(1)}%`)
  }

  return (
    <div
      ref={btnRef}
      className={blocked ? '' : 'student-card-btn'}
      onClick={() => {
        if (blocked) return
        if (alreadyCalled) { handleRecall({ stopPropagation: () => {} } as any); return }
        onCall()
      }}
      onPointerDown={handlePointerDown}
      style={{
        animation: `cardIn 0.35s ease both`,
        animationDelay: `${index * 90}ms`,
        borderRadius: 24,
        overflow: 'hidden',
        border: `2px solid ${isProibido ? 'rgba(239,68,68,0.5)' : alreadyConfirmed ? 'rgba(16,185,129,0.5)' : alreadyCalled ? 'rgba(245,158,11,0.5)' : 'rgba(6,182,212,0.35)'}`,
        background: isProibido ? 'rgba(239,68,68,0.04)' : '#0f1c2e',
        boxShadow: blocked ? 'none' : `0 8px 48px ${accent}20, 0 2px 12px rgba(0,0,0,0.4)`,
        cursor: blocked ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* ── PHOTO AREA — square 1:1 ──────────────────────────────────── */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1/1',
        background: foto ? 'transparent' : `linear-gradient(145deg, ${accentDim}, rgba(0,0,0,0.35))`,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={aluno.nome} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: (blocked && !alreadyCalled) ? 'grayscale(70%) brightness(0.6)' : 'none',
            transition: 'filter 0.3s',
          }}/>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Avatar: doubled size (200px), rounded-square */}
            <div style={{
              width: 200, height: 200, borderRadius: 36,
              background: `linear-gradient(145deg, ${accent}55, ${accent}18)`,
              border: `4px solid ${accent}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 82, color: '#fff',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '-4px',
              boxShadow: `0 16px 60px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.12)`,
            }}>{initials}</div>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
          background: 'linear-gradient(to top, rgba(10,18,30,0.95) 0%, rgba(10,18,30,0.4) 60%, transparent 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Status badge top-right */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '5px 12px', borderRadius: 100,
          fontSize: 10, fontWeight: 900, letterSpacing: '0.06em',
          backdropFilter: 'blur(8px)',
          background: isProibido
            ? 'rgba(239,68,68,0.9)'
            : alreadyConfirmed
              ? 'rgba(16,185,129,0.9)'
              : alreadyCalled
                ? 'rgba(245,158,11,0.9)'
                : 'rgba(6,182,212,0.9)',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 2px 12px ${accent}50`,
        }}>
          {isProibido
            ? <><ShieldOff size={10}/> BLOQUEADO</>
            : alreadyConfirmed
              ? <><CheckCircle2 size={10}/> JÁ RETIRADO</>
              : alreadyCalled
                ? <><Clock size={10}/> EM CHAMADA</>
                : <><CheckCircle2 size={10}/> AUTORIZADO</>}
        </div>

        {/* Turma chip top-left */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          padding: '4px 10px', borderRadius: 8,
          fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
          backdropFilter: 'blur(8px)',
          background: 'rgba(0,0,0,0.6)',
          color: 'rgba(255,255,255,0.9)',
          display: 'flex', alignItems: 'center', gap: 5,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <GraduationCap size={10}/> {aluno.turmaNome || aluno.turma || '—'}
        </div>

        {/* Name overlay at bottom of photo */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 18px 14px',
        }}>
          <div style={{
            fontWeight: 900, fontSize: 18, color: '#fff',
            lineHeight: 1.2, letterSpacing: '-0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}>{aluno.nome}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
            {aluno.turno}{aluno.serie ? ` · ${aluno.serie}` : ''}
          </div>
        </div>
      </div>

      {/* ── INFO BAR ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        background: 'rgba(0,0,0,0.3)',
        borderTop: `1px solid ${accent}30`,
      }}>
        {/* Left info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          {isProibido && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f87171', fontSize: 12, fontWeight: 800 }}>
              <ShieldOff size={12}/> Proibido de retirar este aluno
            </div>
          )}
          {!isProibido && !diaOk && (
            <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
              ⚠ Permitido apenas: {(aut?.diasSemana||[]).join(', ')}
            </div>
          )}
          {alreadyCalled && !isProibido && diaOk && (
            <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12}/> {recalling ? 'Chamando novamente...' : 'Aguardando na portaria'}
            </div>
          )}
          {!blocked && !alreadyCalled && (
            <div style={{ fontSize: 12, color: `${accent}cc`, fontWeight: 600 }}>
              Toque para chamar o aluno
            </div>
          )}
          {aut?.rfid && (
            <div style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', letterSpacing: 1 }}>
              📡 {aut.rfid}
            </div>
          )}
        </div>

        {/* CTA button — Chamar / Chamar Novamente / Bloqueado */}
        {alreadyCalled && !isProibido && diaOk ? (
          <button
            onClick={handleRecall}
            disabled={recalling}
            style={{
              padding: '10px 16px', borderRadius: 14, flexShrink: 0,
              background: recalling ? 'rgba(245,158,11,0.08)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: recalling ? '1px solid rgba(245,158,11,0.3)' : 'none',
              color: recalling ? '#f59e0b' : '#fff',
              fontWeight: 900, fontSize: 12, cursor: recalling ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: recalling ? 'none' : '0 4px 16px rgba(245,158,11,0.4)',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
            <Megaphone size={14}/>
            {recalling ? 'Chamando...' : 'Chamar Novamente'}
          </button>
        ) : (
        <div style={{
          height: 54, padding: '0 18px', borderRadius: 16, flexShrink: 0,
          background: blocked
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, #06b6d4, #6366f1)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: blocked ? 'none' : `0 6px 20px ${accent}45`,
          border: blocked ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'all 0.2s',
        }}>
          {isProibido
            ? <ShieldOff size={22} color="#ef444480"/>
            : alreadyConfirmed
              ? <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 800 }}>JÁ RETIRADO</span>
              : (
                <>
                  <Megaphone size={20} color={blocked ? "rgba(255,255,255,0.4)" : "#fff"}/>
                  <span style={{ color: blocked ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>CHAMAR ALUNO</span>
                </>
              )
          }
        </div>
        )}
      </div>
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────
function TabletCardSkeleton() {
  return (
    <div className="skeleton-shimmer" style={{
      borderRadius: 24,
      border: '2px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.02)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 280,
      aspectRatio: '1/1',
      overflow: 'hidden'
    }}>
      {/* Photo Area placeholder */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)' }} />
      
      {/* Content Area */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
         {/* Name */}
         <div style={{ width: '80%', height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }} />
         {/* Class */}
         <div style={{ width: '40%', height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  )
}

// ─── Modal Ultra Moderno para Múltiplos Alunos do Responsável ─────────────────
function SiblingCallModal({
  calledStudent,
  remainingStudents,
  guardianName,
  onCallAnother,
  onCallAllRemaining,
  onFinish,
}: {
  calledStudent: any
  remainingStudents: any[]
  guardianName: string
  onCallAnother: (aluno: any) => void
  onCallAllRemaining: () => void
  onFinish: () => void
}) {
  const [countdown, setCountdown] = useState(14)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (countdown <= 0) {
      onFinish()
      return
    }
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown, onFinish])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 10, 20, 0.92)',
        backdropFilter: 'blur(24px)',
        zIndex: 9995,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'linear-gradient(165deg, #0f1c2e 0%, #080f1a 100%)',
          borderRadius: 32,
          border: '1.5px solid rgba(6, 182, 212, 0.4)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.7), 0 0 50px rgba(6, 182, 212, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Top Progress bar countdown */}
        <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.08)', position: 'relative' }}>
          <div
            style={{
              height: '100%',
              width: `${(countdown / 14) * 100}%`,
              background: 'linear-gradient(90deg, #06b6d4, #10b981)',
              transition: 'width 1s linear',
              boxShadow: '0 0 14px #06b6d4',
            }}
          />
        </div>

        {/* Modal Header */}
        <div style={{ padding: isMobile ? '24px 20px 16px' : '32px 36px 20px', textAlign: 'center', position: 'relative' }}>
          {/* Animated Success Check Badge */}
          <div
            style={{
              width: isMobile ? 64 : 76,
              height: isMobile ? 64 : 76,
              borderRadius: '50%',
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.15))',
              border: '2px solid rgba(16, 185, 129, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)',
            }}
          >
            <CheckCircle2 size={isMobile ? 32 : 40} color="#10b981" />
          </div>

          <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {calledStudent.nome} foi chamado(a)!
          </h2>

          <p style={{ fontSize: isMobile ? 13 : 15, color: '#94a3b8', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
            Existe(m) mais <span style={{ color: '#06b6d4', fontWeight: 900 }}>{remainingStudents.length} aluno(s)</span> vinculado(s) ao cartão de <strong style={{ color: '#f1f5f9' }}>{guardianName}</strong>.
          </p>
        </div>

        {/* Remaining Siblings List */}
        <div style={{ padding: isMobile ? '0 20px 20px' : '0 36px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 380, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Deseja solicitar a saída dos outros alunos?
          </div>

          {remainingStudents.map((aluno, i) => {
            const initials = (aluno.nome || '?').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
            return (
              <div
                key={aluno.id || i}
                style={{
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  borderRadius: 24,
                  background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'all 0.2s',
                }}
              >
                {/* Photo / Initials */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                  <div
                    style={{
                      width: isMobile ? 64 : 76,
                      height: isMobile ? 64 : 76,
                      borderRadius: 20,
                      flexShrink: 0,
                      overflow: 'hidden',
                      background: 'linear-gradient(145deg, #06b6d440, #6366f130)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? 22 : 26,
                      fontWeight: 900,
                      color: '#fff',
                      border: '2px solid rgba(6, 182, 212, 0.4)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)',
                    }}
                  >
                    {aluno.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={aluno.foto} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      initials
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: isMobile ? 16 : 18, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                      {aluno.nome}
                    </div>
                    <div style={{ fontSize: isMobile ? 12 : 14, color: '#06b6d4', fontWeight: 800, marginTop: 4 }}>
                      🎓 {aluno.turmaNome || aluno.turma || '—'} {aluno.turno ? `· ${aluno.turno}` : ''}
                    </div>
                  </div>
                </div>

                {/* Call button (Bigger & Highlighted) */}
                <button
                  onClick={() => onCallAnother(aluno)}
                  style={{
                    padding: isMobile ? '12px 18px' : '14px 26px',
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: isMobile ? 13 : 15,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                    boxShadow: '0 6px 24px rgba(6, 182, 212, 0.45)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Megaphone size={isMobile ? 16 : 18} /> CHAMAR
                </button>
              </div>
            )
          })}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: isMobile ? '18px 20px 22px' : '22px 36px 30px',
            background: 'rgba(0, 0, 0, 0.35)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          {remainingStudents.length > 1 && (
            <button
              onClick={onCallAllRemaining}
              style={{
                width: isMobile ? '100%' : 'auto',
                flex: 1,
                padding: '16px 22px',
                borderRadius: 18,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 22px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Users size={18} /> CHAMAR TODOS OS RESTANTES ({remainingStudents.length})
            </button>
          )}

          <button
            onClick={onFinish}
            style={{
              width: isMobile ? '100%' : 'auto',
              flex: remainingStudents.length > 1 ? 1 : 1,
              padding: '16px 22px',
              borderRadius: 18,
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#cbd5e1',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            ENCERRAR ({countdown}s)
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function PainelTabletContent() {
  const isMobile = useIsMobile()
  const { config, callStudent, blockAttempt, recallStudent, activeCalls, realtimeStatus, refreshCalls } = useSaida()
  const [turmas] = useSupabaseArray<any>('turmas')


  const [mode,              setMode]             = useState<'idle' | 'rfid' | 'manual'>('idle')
  const [rfidCode,          setRfidCode]         = useState<string | undefined>()
  const [rfidError,         setRfidError]        = useState<string | null>(null)
  const [toast,             setToast]            = useState<{ msg: string; ok: boolean } | null>(null)
  const [matchedGuardianName, setMatchedGuardianName] = useState('')
  const [matchedGuardianRole, setMatchedGuardianRole] = useState('')
  const [rfidStudents,        setRfidStudents]        = useState<any[]>([])
  const [isProcessingRFID,    setIsProcessingRFID]    = useState(false)
  
  // Manual search states
  const [search,              setSearch]              = useState('')
  const [manualStudents,      setManualStudents]      = useState<any[]>([])
  const [isSearching,         setIsSearching]         = useState(false)
  const [hasSearched,         setHasSearched]         = useState(false)

  const [blockInfo,           setBlockInfo]           = useState<{
    type: 'proibido' | 'dia_restrito'
    reason: string
    studentName: string
    guardianName: string
  } | null>(null)
  const [showInactiveAlert, setShowInactiveAlert] = useState<{ name: string } | null>(null)
  const [siblingModal, setSiblingModal] = useState<{
    calledStudent: any
    remainingStudents: any[]
    guardianName: string
  } | null>(null)

  // Ref to RFIDInput so we can clear the buffer after each scan
  const rfidRef = useRef<RFIDInputHandle>(null)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // ── Fallback Polling 30s se o Supabase Realtime falhar ou desconectar ──────────
  useEffect(() => {
    if (realtimeStatus !== 'online') {
      refreshCalls() // Dispara imediatamente
      const iv = setInterval(() => {
        refreshCalls()
      }, 30000)
      return () => clearInterval(iv)
    }
  }, [realtimeStatus, refreshCalls])

  // ── Busca Manual via API com Debounce (300ms) ──────────────────────────────
  useEffect(() => {
    const q = search.trim()
    if (q.length < 3) {
      setManualStudents([])
      setIsSearching(false)
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(q)}&status=ativo&limit=25`)
        if (res.ok) {
          const payload = await res.json()
          setManualStudents(payload.data || [])
        }
      } catch (err) {
        console.error('Erro na busca manual de alunos:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [search])

  const doBlockReset = useCallback(() => {
    rfidRef.current?.clear()
    setTimeout(() => {
      setBlockInfo(null); setMode('idle'); setRfidCode(undefined)
      setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
    }, 4000)
  }, [])

  // ── RFID handler ───────────────────────────────────────────────────────────
  const handleRFIDCore = useCallback(async (code: string) => {
    setRfidError(null)
    setBlockInfo(null)

    // 1. Buscar responsável por RFID diretamente na API (Indexado e rápido)
    console.log('Analisando leitura RFID:', code.trim());
    let resp: any = null;
    
    const cleanRfid = code.trim();

    try {
      const res = await fetch(`/api/responsaveis?rfid=${encodeURIComponent(cleanRfid)}`)
      if (res.ok) {
        const payload = await res.json()
        resp = payload.data && payload.data.length > 0 ? payload.data[0] : null
      }
    } catch (error: any) {
      console.error('Erro ao buscar responsável via RFID:', error)
    }

    if (!resp) {
      setRfidError(`RFID "${code}" não encontrado. Verifique o cadastro do responsável.`)
      showToast('RFID não cadastrado.', false)
      rfidRef.current?.clear()
      setTimeout(() => {
        setRfidError(null); setMode('idle'); setRfidCode(undefined)
        setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
      }, 2500)
      return
    }

    const gName = resp.nome || 'Responsável'
    const gRole = resp.parentesco || 'Autorizado'
    
    // Na API, os vínculos já vêm formatados em alunosVinculados
    const filhos = resp.alunosVinculados || []

    if (filhos.length === 0) {
      setRfidError(`Nenhum aluno vinculado ao responsável "${gName}".`)
      showToast('Nenhum aluno vinculado.', false)
      rfidRef.current?.clear()
      setTimeout(() => {
        setRfidError(null); setMode('idle'); setRfidCode(undefined)
        setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
      }, 2500)
      return
    }

    const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
    const todayKey = DIAS[new Date().getDay()]

    const studentIds = filhos.map((f: any) => f.id).filter(Boolean)

    if (studentIds.length === 0) {
      setRfidError(`Nenhum aluno cadastrado vinculado ao responsável "${gName}".`)
      showToast('Nenhum aluno cadastrado.', false)
      rfidRef.current?.clear()
      setTimeout(() => {
        setRfidError(null); setMode('idle'); setRfidCode(undefined)
        setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
      }, 2500)
      return
    }

    // 2. Usar dados completos dos alunos que já vieram da API
    let matchedStudents: any[] = filhos || []

    // 3. Montar lista de alunos e verificar "proibido" primeiro
    const diasAcesso: string[] = resp.dias_acesso || []
    const students: any[] = []
    let isProhibited = false
    let prohibitionReason = ''

    for (const alunoCompleto of matchedStudents) {
      const isAtivo = alunoCompleto.status === 'Ativo' || alunoCompleto.status === 'matriculado';
      if (!isAtivo) {
        setShowInactiveAlert({ name: alunoCompleto.nome })
        setTimeout(() => setShowInactiveAlert(null), 3000)
        showToast('Aluno inativo.', false)
        doBlockReset()
        return
      }

      // Verificar se no JSON do aluno este responsável está marcado como proibido
      const autorizados: any[] = alunoCompleto.saude?.autorizados || []
      const autInfo = autorizados.find((a: any) => {
        const safeRfid = String(a.rfid || '').trim().replace(/^0+/, '').toUpperCase() || String(a.rfid || '').trim().toUpperCase()
        const safeCode = String(code || '').trim().replace(/^0+/, '').toUpperCase() || String(code || '').trim().toUpperCase()
        
        return (
          a.nome?.trim().toLowerCase() === gName.trim().toLowerCase() ||
          (safeRfid && safeCode && safeRfid === safeCode)
        )
      })

      const autObj = {
        rfid: code,
        diasSemana: diasAcesso,
        proibido: resp.proibido || autInfo?.proibido || false,
        parentesco: gRole
      }

      if (autObj.proibido) {
        isProhibited = true
        prohibitionReason = `${gName} está bloqueado(a) de retirar o aluno ${alunoCompleto.nome}.`
        const foto = alunoCompleto.foto && alunoCompleto.foto.length > 10 ? alunoCompleto.foto : null
        blockAttempt(alunoCompleto.id, alunoCompleto.nome, alunoCompleto.turma, `rfid-${code}`, gName, code, 'proibido', prohibitionReason, foto)
      }

      students.push({ ...alunoCompleto, _aut: autObj })
    }

    // Se estiver proibido, bloqueia tudo imediatamente (prioridade máxima)
    if (isProhibited) {
      setBlockInfo({
        type: 'proibido', reason: prohibitionReason,
        studentName: matchedStudents.map((m: any) => m.nome).join(', '),
        guardianName: gName,
      })
      showToast(`🚫 Acesso bloqueado: ${gName}`, false)
      doBlockReset()
      return
    }

    // 4. Validar dias de acesso do responsável (só se não for proibido)
    if (diasAcesso.length > 0 && !diasAcesso.includes(todayKey)) {
      const reason = `${gName} só pode retirar alunos nos dias: ${diasAcesso.join(', ')}. Hoje é ${todayKey}.`

      for (const aluno of matchedStudents) {
        const foto = aluno.foto && aluno.foto.length > 10 ? aluno.foto : null
        blockAttempt(aluno.id, aluno.nome, aluno.turma, `rfid-${code}`, gName, code, 'dia_restrito', reason, foto)
      }

      setBlockInfo({
        type: 'dia_restrito', reason,
        studentName: matchedStudents.map((m: any) => m.nome).join(', '),
        guardianName: gName,
      })
      showToast(`⚠ Dia não permitido para ${gName}`, false)
      doBlockReset()
      return
    }

    setMatchedGuardianName(gName)
    setMatchedGuardianRole(gRole)
    setRfidStudents(students)
    setRfidCode(code)
    setMode('rfid')
  }, [showToast, blockAttempt, doBlockReset])

  const handleRFID = useCallback(async (code: string) => {
    setIsProcessingRFID(true)
    try {
      await handleRFIDCore(code)
    } finally {
      setIsProcessingRFID(false)
    }
  }, [handleRFIDCore])

  const handleReset = useCallback(() => {
    rfidRef.current?.clear()
    setMode('idle'); setRfidCode(undefined); setRfidError(null)
    setBlockInfo(null)
    setSiblingModal(null)
    setMatchedGuardianName(''); setMatchedGuardianRole(''); setRfidStudents([]); setSearch('')
    setManualStudents([]); setIsSearching(false); setHasSearched(false)
  }, [])

  // ── Call student ───────────────────────────────────────────────────────────
  const handleCall = useCallback((a: any) => {
    const gId  = `rfid-${rfidCode}`
    const foto = a.foto && typeof a.foto === 'string' && a.foto.length > 10 ? a.foto : null
    const tObj = (turmas || []).find((t: any) => String(t.id) === String(a.turma) || t.codigo === a.turma || t.nome === a.turma)
    const turmaNome = tObj?.nome || a.turma
    const call = callStudent(a.id, a.nome, turmaNome, gId, matchedGuardianName, 'rfid', rfidCode, foto)
    if (!call) { showToast(`${a.nome} já está em chamada ativa!`, false); return }
    showToast(`📣 ${a.nome} foi chamado(a)!`)
    rfidRef.current?.clear()

    // Verificar se existem outros alunos vinculados a esta leitura de RFID que ainda não foram chamados
    const remaining = rfidStudents.filter(s => {
      if (s.id === a.id) return false
      const alreadyActive = activeCalls.some(c => c.studentId === s.id && (c.status === 'waiting' || c.status === 'called'))
      const isProibido = s._aut?.proibido === true
      const diaOk = isDiaPermitido(s._aut?.diasSemana || [])
      return !alreadyActive && !isProibido && diaOk
    })

    if (remaining.length > 0) {
      setSiblingModal({
        calledStudent: a,
        remainingStudents: remaining,
        guardianName: matchedGuardianName
      })
    } else {
      setTimeout(() => {
        handleReset()
      }, 1000)
    }
  }, [rfidCode, matchedGuardianName, callStudent, showToast, turmas, rfidStudents, activeCalls, handleReset])

  const handleCallAnotherInModal = useCallback((sibling: any) => {
    const gId  = `rfid-${rfidCode}`
    const foto = sibling.foto && typeof sibling.foto === 'string' && sibling.foto.length > 10 ? sibling.foto : null
    const tObj = (turmas || []).find((t: any) => String(t.id) === String(sibling.turma) || t.codigo === sibling.turma || t.nome === sibling.turma)
    const turmaNome = tObj?.nome || sibling.turma
    const call = callStudent(sibling.id, sibling.nome, turmaNome, gId, matchedGuardianName, 'rfid', rfidCode, foto)
    if (call) {
      showToast(`📣 ${sibling.nome} foi chamado(a)!`)
    }

    setSiblingModal(prev => {
      if (!prev) return null
      const nextRemaining = prev.remainingStudents.filter(s => s.id !== sibling.id)
      if (nextRemaining.length === 0) {
        setTimeout(() => handleReset(), 800)
        return null
      }
      return {
        ...prev,
        calledStudent: sibling,
        remainingStudents: nextRemaining
      }
    })
  }, [rfidCode, turmas, callStudent, matchedGuardianName, showToast, handleReset])

  const handleCallAllRemainingInModal = useCallback(() => {
    if (!siblingModal) return
    const gId  = `rfid-${rfidCode}`
    siblingModal.remainingStudents.forEach(sibling => {
      const foto = sibling.foto && typeof sibling.foto === 'string' && sibling.foto.length > 10 ? sibling.foto : null
      const tObj = (turmas || []).find((t: any) => String(t.id) === String(sibling.turma) || t.codigo === sibling.turma || t.nome === sibling.turma)
      const turmaNome = tObj?.nome || sibling.turma
      callStudent(sibling.id, sibling.nome, turmaNome, gId, matchedGuardianName, 'rfid', rfidCode, foto)
    })
    showToast(`📣 Todos os outros alunos foram chamados!`)
    setSiblingModal(null)
    setTimeout(() => handleReset(), 800)
  }, [siblingModal, rfidCode, turmas, callStudent, matchedGuardianName, showToast, handleReset])

  const handleFinishModal = useCallback(() => {
    setSiblingModal(null)
    handleReset()
  }, [handleReset])

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontFamily: 'Outfit, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: STANDALONE_STYLES }} />
      {config.rfidEnabled && <RFIDInput ref={rfidRef} onRead={handleRFID} enabled={mode === 'idle' || mode === 'rfid'}
/>}

      <AnimatePresence>
        {/* ── SIBLING CALL MODAL ───────────────────────────────────── */}
        {siblingModal && (
          <SiblingCallModal
            calledStudent={siblingModal.calledStudent}
            remainingStudents={siblingModal.remainingStudents}
            guardianName={siblingModal.guardianName}
            onCallAnother={handleCallAnotherInModal}
            onCallAllRemaining={handleCallAllRemainingInModal}
            onFinish={handleFinishModal}
          />
        )}{/* ── BLOCKED OVERLAY ─────────────────────────────────────── */}
      {blockInfo && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
          position: 'fixed', inset: 0,
          background: blockInfo.type === 'proibido'
            ? 'linear-gradient(160deg, #1a0000 0%, #2d0000 60%, #1a0000 100%)'
            : 'linear-gradient(160deg, #1a1000 0%, #2d1d00 60%, #1a1000 100%)',
          zIndex: 9990,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: 32, textAlign: 'center',
          animation: 'slideUp 0.3s ease',
        }}>
          {/* Icon */}
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{
            width: 120, height: 120, borderRadius: '50%',
            background: blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
            border: `3px solid ${blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 56,
            animation: 'urgentRingCenter 1.5s ease infinite',
          }}>
            {blockInfo.type === 'proibido' ? '🚫' : '📅'}
          </motion.div>

          {/* Title */}
          <div style={{
            fontWeight: 900, fontSize: isMobile ? 24 : 36,
            color: blockInfo.type === 'proibido' ? '#ef4444' : '#f59e0b',
            fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em',
          }}>
            {blockInfo.type === 'proibido' ? 'ACESSO BLOQUEADO' : 'DIA NÃO PERMITIDO'}
          </div>

          {/* Guardian */}
          <div style={{
            fontSize: isMobile ? 16 : 22, fontWeight: 800,
            color: '#f1f5f9',
          }}>
            👤 {blockInfo.guardianName}
          </div>

          {/* Reason */}
          <div style={{
            padding: '16px 28px', borderRadius: 16, maxWidth: 480,
            background: blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
            fontSize: isMobile ? 13 : 15, color: '#94a3b8', lineHeight: 1.6,
          }}>
            {blockInfo.reason}
          </div>

          {/* Student names */}
          <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
            Aluno(s): <span style={{ color: '#94a3b8' }}>{blockInfo.studentName}</span>
          </div>

          {/* Auto-reset message */}
          <div style={{
            fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.05em',
            marginTop: 8,
          }}>
            ↻ Voltando automaticamente em 4 segundos...
          </div>

          {/* Manual cancel */}
          <button onClick={handleReset} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#64748b',
            cursor: 'pointer', fontWeight: 700, fontSize: 13,
          }}>
            Cancelar agora
          </button>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
          position: 'fixed', top: 24, left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 28px', borderRadius: 100, fontSize: 14, fontWeight: 800,
          background: toast.ok ? 'rgba(16,185,129,0.96)' : 'rgba(239,68,68,0.96)',
          color: '#fff', zIndex: 9999, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.3s ease', whiteSpace: 'nowrap',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        
</motion.div>
)}</AnimatePresence>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      {/* Added bottom padding so the footer doesn't overlap content */}
      <div style={{ padding: isMobile ? '8px 16px 100px' : '12px 32px 120px', maxWidth: 1000, margin: '0 auto' }}>

        {/* ── IDLE ────────────────────────────────────────────────────── */}
        {mode === 'idle' && (
          <div style={{ textAlign: 'center', padding: isMobile ? '48px 0' : '72px 0', animation: 'slideUp 0.4s ease' }}>
            {isProcessingRFID ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.3s' }}>
                <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(6,182,212,0.1)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: '#06b6d4', borderRightColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ position: 'absolute', inset: 12, border: '4px solid rgba(99,102,241,0.1)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: 12, border: '4px solid transparent', borderBottomColor: '#6366f1', borderLeftColor: '#6366f1', borderRadius: '50%', animation: 'spin 1.5s linear infinite reverse' }} />
                  <Scan size={36} color="#06b6d4" style={{ animation: 'pulse 1.5s infinite' }} />
                </div>
                <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#f1f5f9', marginBottom: 8, textShadow: '0 0 20px rgba(6,182,212,0.5)', animation: 'textPulse 1.5s ease-in-out infinite' }}>
                  Processando Leitura...
                </h2>
                <p style={{ fontSize: isMobile ? 14 : 16, color: '#64748b', fontWeight: 600 }}>
                  Validando informações do responsável
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  width: isMobile ? 180 : 250, height: isMobile ? 180 : 250,
                  borderRadius: '50%', margin: '0 auto 40px',
                  background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0.03) 75%)',
                  border: '2px solid rgba(6,182,212,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 0 35px rgba(6,182,212,0.25)',
                  overflow: 'hidden',
                  animation: 'scanPulse 3s ease-in-out infinite',
                }}>
                  {/* Spinning dashed ring */}
                  <div style={{
                    position: 'absolute', inset: 8, borderRadius: '50%',
                    border: '2px dashed rgba(6,182,212,0.25)',
                    animation: 'spinSlow 15s linear infinite',
                    pointerEvents: 'none',
                  }} />

                  {/* Sweeping laser line */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                    boxShadow: '0 0 14px #06b6d4, 0 0 28px #06b6d4',
                    animation: 'laserSweep 3s ease-in-out infinite',
                    zIndex: 2,
                  }} />

                  <Scan size={isMobile ? 76 : 108} color="#06b6d4" strokeWidth={1.1} style={{ animation: 'radarPulse 3s ease-in-out infinite', zIndex: 1 }}/>
                </div>

                <h2 style={{
                  fontWeight: 900,
                  fontSize: isMobile ? 32 : 48,
                  margin: '0 0 16px',
                  color: '#fff',
                  letterSpacing: '-0.04em',
                  textShadow: '0 0 24px rgba(6,182,212,0.5)',
                  animation: 'textPulse 3s ease-in-out infinite',
                }}>
                  Aguardando Leitura
                </h2>
                <p style={{ fontSize: isMobile ? 15 : 18, color: '#64748b', margin: '0 0 32px', lineHeight: 1.6, fontWeight: 600 }}>
                  Aproxime o cartão RFID do responsável
                </p>

                {rfidError && (
                  <div style={{
                    marginTop: 28, padding: '14px 24px', borderRadius: 14, display: 'inline-flex',
                    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171', fontWeight: 700, fontSize: 13, alignItems: 'center', gap: 8,
                  }}>
                    ⚠ {rfidError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── RFID MODE ───────────────────────────────────────────────── */}
        {mode === 'rfid' && matchedGuardianName && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>

            {/* Guardian hero card */}
            <div style={{
              borderRadius: 20, overflow: 'hidden', marginBottom: 32,
              background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(99,102,241,0.06) 100%)',
              border: '1px solid rgba(6,182,212,0.25)',
              boxShadow: '0 8px 40px rgba(6,182,212,0.12)',
            }}>
              {/* Top accent bar */}
              <div style={{ height: 4, background: 'linear-gradient(90deg, #06b6d4, #6366f1)' }}/>
              <div style={{ padding: isMobile ? '18px 20px' : '22px 28px', display: 'flex', alignItems: 'center', gap: 18 }}>
                {/* Avatar */}
                <div style={{
                  width: isMobile ? 58 : 72, height: isMobile ? 58 : 72,
                  borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #06b6d490, #6366f140)',
                  border: '2px solid rgba(6,182,212,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: isMobile ? 24 : 30, color: '#fff',
                  boxShadow: '0 4px 20px rgba(6,182,212,0.3)',
                }}>
                  {(matchedGuardianName[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.1em', marginBottom: 6 }}>
                    ✅ RESPONSÁVEL IDENTIFICADO VIA RFID
                  </div>
                  <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 26, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {matchedGuardianName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{matchedGuardianRole}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 10px', borderRadius: 100,
                      background: 'rgba(6,182,212,0.12)', color: '#06b6d4',
                      fontWeight: 800, border: '1px solid rgba(6,182,212,0.25)',
                      fontFamily: 'monospace', letterSpacing: 1,
                    }}>
                      📡 {rfidCode}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 10px', borderRadius: 100,
                      background: 'rgba(16,185,129,0.1)', color: '#10b981',
                      fontWeight: 800, border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                      {rfidStudents.length} aluno{rfidStudents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section header */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: isMobile ? 15 : 17, color: '#f1f5f9' }}>
                  Alunos vinculados a este cartão
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  Toque no card para chamar o aluno
                </div>
              </div>
              {rfidStudents.length > 1 && (
                <div style={{
                  padding: '6px 14px', borderRadius: 100,
                  background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                  fontSize: 11, fontWeight: 800, color: '#06b6d4',
                }}>
                  {rfidStudents.length} alunos
                </div>
              )}
            </div>

            {/* Student cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: rfidStudents.length === 1
                ? '1fr'
                : rfidStudents.length === 2
                  ? 'repeat(2, 1fr)'
                  : isMobile
                    ? '1fr'
                    : 'repeat(3, 1fr)',
              gap: 16,
              maxWidth: rfidStudents.length === 1 ? 380 : undefined,
            }}>
              {rfidStudents.map((a, i) => {
                const t = (turmas || []).find((t: any) => String(t.id) === String(a.turma) || t.codigo === a.turma || t.nome === a.turma)
                const alunoWithTurma = { ...a, turmaNome: t ? t.nome : a.turma }
                return (
                  <StudentCard
                    key={a.id}
                    aluno={alunoWithTurma}
                    aut={a._aut}
                    guardianName={matchedGuardianName}
                    rfidCode={rfidCode}
                    onCall={() => handleCall(a)}
                    onRecall={() => {
                      const call = activeCalls.find(c =>
                        c.studentId === a.id && (c.status === 'waiting' || c.status === 'called')
                      )
                      if (call) recallStudent(call.id, () => {})
                      else handleCall(a)
                      // Limpa buffer e reset para idle após 1s
                      rfidRef.current?.clear()
                      setTimeout(() => {
                        setMode('idle')
                        setRfidCode(undefined)
                        setRfidError(null)
                        setMatchedGuardianName('')
                        setMatchedGuardianRole('')
                        setRfidStudents([])
                      }, 1000)
                    }}
                    index={i}
                  />
                )
              })}
            </div>

            {rfidStudents.length === 0 && (
              <div style={{
                padding: '40px', borderRadius: 20, textAlign: 'center',
                background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
                color: '#f59e0b', fontSize: 14, fontWeight: 600,
              }}>
                ⚠ Nenhum aluno vinculado a este cartão RFID.
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL MODE ─────────────────────────────────────────────── */}
        {mode === 'manual' && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: isMobile ? 16 : 20, color: '#f1f5f9', marginBottom: 6 }}>Resultados da Busca</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                Localize o aluno e clique no responsável para chamar.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {search.trim().length < 3 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px', color: '#64748b', fontSize: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.07)' }}>
                  <Search size={28} style={{ color: '#334155', margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700 }}>Digite pelo menos 3 caracteres para iniciar a busca.</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Digite texto para buscar por nome, ou número para buscar por ID/Matrícula.</div>
                </div>
              ) : isSearching ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <div style={{ height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.02)' }} className="skeleton-shimmer" />
                   <div style={{ height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.02)' }} className="skeleton-shimmer" />
                   <div style={{ height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.02)' }} className="skeleton-shimmer" />
                </div>
              ) : manualStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px', color: '#ef4444', fontSize: 14, background: 'rgba(239,68,68,0.02)', borderRadius: 16, border: '1px solid rgba(239,68,68,0.1)' }}>
                  Nenhum aluno ativo encontrado para "{search}"
                </div>
              ) : (
                manualStudents.map((a: any) => {
                  const saude: any = a.saude || {}
                  const autorizados: any[] = saude.autorizados || []
                  const autorizaSaida: boolean = saude.autorizaSaida === true
                  const alreadyCalled = activeCalls.some(c =>
                    c.studentId === a.id && (c.status === 'waiting' || c.status === 'called')
                  )
                  const alreadyConfirmed = activeCalls.some(c =>
                    c.studentId === a.id && c.status === 'confirmed'
                  )
                  const initials = (a.nome || '').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

                  // Build autorizados list with fallback to responsaveis
                  const respList: { name: string; role: string; rfid?: string; proibido: boolean; diasSemana: string[] }[] = []
                  const seen = new Set<string>()
                  autorizados.forEach(aut => {
                    if (aut.nome?.trim() && !seen.has(aut.nome.toLowerCase())) {
                      seen.add(aut.nome.toLowerCase())
                      respList.push({ name: aut.nome, role: aut.parentesco || 'Autorizado', rfid: aut.rfid, proibido: aut.proibido === true, diasSemana: aut.diasSemana || [] })
                    }
                  })
                  if (respList.length === 0 && a.responsavel?.trim()) {
                    respList.push({ name: a.responsavel, role: 'Responsável', proibido: false, diasSemana: [] })
                  }

                  return (
                    <div key={a.id} style={{
                      background: '#0f1c2e',
                      border: alreadyConfirmed ? '1px solid rgba(16,185,129,0.4)' : alreadyCalled ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 16, overflow: 'hidden',
                    }}>
                      {/* Student row */}
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Photo or initials */}
                        {a.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.foto} alt={a.nome} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(6,182,212,0.25)' }}/>
                        ) : (
                          <div style={{
                            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                            background: 'linear-gradient(135deg, #06b6d430, #6366f118)',
                            border: '2px solid rgba(6,182,212,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 900, fontSize: 20, color: '#e2e8f0',
                          }}>{initials}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <GraduationCap size={10}/> {a.turma}
                            </span>
                            {a.turno && <span>· {a.turno}</span>}
                            {autorizaSaida && <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Saída independente</span>}
                            {alreadyCalled && <span style={{ color: '#f59e0b', fontWeight: 700 }}>⏳ Em chamada</span>}
                            {alreadyConfirmed && <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Já Retirado</span>}
                          </div>
                        </div>
                      </div>

                      {/* Guardian buttons */}
                      {respList.length > 0 && (
                        <div style={{ padding: '8px 18px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', marginRight: 4 }}>CHAMAR VIA:</span>
                          {respList.map((g, i) => {
                            const diaOk = isDiaPermitido(g.diasSemana)
                            const disabled = alreadyCalled || alreadyConfirmed || g.proibido || !diaOk
                            return (
                              <button key={i}
                                onClick={() => {
                                  if (disabled) return
                                  const gId = `manual-${a.id}-${i}`
                                  const tObj = (turmas || []).find((t: any) => String(t.id) === String(a.turma) || t.codigo === a.turma || t.nome === a.turma)
                                  const turmaNome = tObj?.nome || a.turma
                                  const call = callStudent(a.id, a.nome, turmaNome, gId, g.name, 'manual')
                                  if (!call) showToast(`${a.nome} já em chamada!`, false)
                                  else showToast(`📣 ${a.nome} chamado via ${g.name}!`)
                                }}
                                disabled={disabled}
                                style={{
                                  padding: '7px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                                  background: g.proibido
                                    ? 'rgba(239,68,68,0.08)'
                                    : disabled ? 'rgba(255,255,255,0.03)' : 'rgba(6,182,212,0.1)',
                                  border: g.proibido
                                    ? '1px solid rgba(239,68,68,0.3)'
                                    : disabled ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(6,182,212,0.3)',
                                  color: g.proibido ? '#ef4444' : disabled ? '#334155' : '#06b6d4',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  transition: 'all 0.15s',
                                }}>
                                {g.proibido ? <ShieldOff size={11}/> : <Phone size={10}/>}
                                {g.name}
                                <span style={{ opacity: 0.5, fontSize: 10 }}>{g.role}</span>
                                {g.rfid && <span style={{ fontSize: 9, color: '#06b6d4', fontFamily: 'monospace' }}>📡</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showInactiveAlert && (
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
                <h1 style={{ fontSize: 64, fontWeight: 900, marginBottom: 20 }}>🚫 ALUNO INATIVO</h1>
                <p style={{ fontSize: 32, fontWeight: 700 }}>O aluno {showInactiveAlert.name} está INATIVO no sistema.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #080f1c 0%, #0d1b2e 100%)',
        borderTop: '1px solid rgba(6,182,212,0.18)',
        padding: isMobile ? '14px 16px' : '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, gap: 12,
        boxShadow: '0 -4px 30px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: isMobile ? 38 : 46, height: isMobile ? 38 : 46, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(6,182,212,0.4)',
          }}>
            <Tablet size={isMobile ? 18 : 22} color="#fff"/>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: isMobile ? 14 : 17, color: '#f1f5f9', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              PORTARIA · CONTROLE DE SAÍDA
            </div>
            {!isMobile && (
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginTop: 1 }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Campo discreto para RFID centralizado na barra */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 60 }}>
          <input
            id="test-rfid-input"
            type="text"
            placeholder="RFID..."
            style={{ 
              width: 70, padding: '4px', fontSize: 10, 
              background: 'rgba(15, 28, 46, 0.2)', color: 'rgba(241, 245, 249, 0.15)', 
              border: '1px solid rgba(6,182,212,0.05)', borderRadius: 6,
              outline: 'none', textAlign: 'center',
              backdropFilter: 'blur(2px)', transition: 'all 0.2s'
            }}
            onFocus={(e) => { 
              e.target.style.color = '#f1f5f9'; 
              e.target.style.background = 'rgba(15, 28, 46, 0.8)'; 
              e.target.style.border = '1px solid rgba(6,182,212,0.4)';
              e.target.style.width = '120px';
            }}
            onBlur={(e) => { 
              e.target.style.color = 'rgba(241, 245, 249, 0.15)'; 
              e.target.style.background = 'rgba(15, 28, 46, 0.2)'; 
              e.target.style.border = '1px solid rgba(6,182,212,0.05)';
              e.target.style.width = '70px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRFID(e.currentTarget.value)
                e.currentTarget.value = ''
                e.currentTarget.blur()
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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

          {mode !== 'idle' && (
            <button onClick={handleReset} style={{
              padding: isMobile ? '10px 18px' : '11px 28px', borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #dc2626, #ef4444)',
              color: '#fff', cursor: 'pointer', fontWeight: 900,
              fontSize: isMobile ? 13 : 15,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(239,68,68,0.5)',
              transition: 'all 0.15s', letterSpacing: '0.02em',
            }}>
              <X size={isMobile ? 14 : 16}/> CANCELAR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PainelTabletPage() {
  return (
    <SaidaProvider>
      <PainelTabletContent />
    </SaidaProvider>
  )
}
