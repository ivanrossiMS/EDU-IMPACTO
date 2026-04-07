'use client'
import { useState, useCallback, useMemo, useRef } from 'react'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { RFIDInput, RFIDInputHandle } from '@/components/saida/RFIDInput'
import {
  Scan, X, Tablet, ShieldOff, Phone, Search,
  GraduationCap, CheckCircle2, Clock, Megaphone,
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
    0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(6,182,212,0.4); }
    50%      { opacity:0.85; transform:scale(1.04); box-shadow:0 0 0 18px rgba(6,182,212,0); }
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
`

// ─── Helper: verifica se hoje é dia permitido ─────────────────────────────────
function isDiaPermitido(diasSemana: string[]): boolean {
  if (!diasSemana || diasSemana.length === 0) return true
  const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
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
  const [recalling, setRecalling] = useState(false)
  // Card is blocked only for real restrictions, NOT for alreadyCalled (recall is possible)
  const blocked = isProibido || !diaOk

  const initials = (aluno.nome || '?').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const foto     = aluno.foto

  // Color palette by state
  const accent = isProibido ? '#ef4444' : alreadyCalled ? '#f59e0b' : '#06b6d4'
  const accentDim = isProibido ? 'rgba(239,68,68,0.15)' : alreadyCalled ? 'rgba(245,158,11,0.12)' : 'rgba(6,182,212,0.12)'

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
        border: `2px solid ${isProibido ? 'rgba(239,68,68,0.5)' : alreadyCalled ? 'rgba(245,158,11,0.5)' : 'rgba(6,182,212,0.35)'}`,
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
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
          background: 'linear-gradient(to top, rgba(10,18,30,0.98) 0%, rgba(10,18,30,0.6) 50%, transparent 100%)',
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
            : alreadyCalled
              ? 'rgba(245,158,11,0.9)'
              : 'rgba(6,182,212,0.9)',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 2px 12px ${accent}50`,
        }}>
          {isProibido
            ? <><ShieldOff size={10}/> BLOQUEADO</>
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
          <GraduationCap size={10}/> {aluno.turma || '—'}
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
            {aluno.matricula ? ` · Cód. ` : ''}
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
          width: 54, height: 54, borderRadius: 16, flexShrink: 0,
          background: blocked
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, #06b6d4, #6366f1)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: blocked ? 'none' : `0 6px 20px ${accent}45`,
          border: blocked ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'all 0.2s',
        }}>
          {isProibido
            ? <ShieldOff size={22} color="#ef444480"/>
            : <Megaphone size={22} color="#fff"/>}
        </div>
        )}
      </div>
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────
function PainelTabletContent() {
  const isMobile = useIsMobile()
  const { config, callStudent, blockAttempt, recallStudent, activeCalls } = useSaida()
  const { alunos } = useData()

  const [mode,              setMode]             = useState<'idle' | 'rfid' | 'manual'>('idle')
  const [rfidCode,          setRfidCode]         = useState<string | undefined>()
  const [rfidError,         setRfidError]        = useState<string | null>(null)
  const [toast,             setToast]            = useState<{ msg: string; ok: boolean } | null>(null)
  const [matchedGuardianName, setMatchedGuardianName] = useState('')
  const [matchedGuardianRole, setMatchedGuardianRole] = useState('')
  const [rfidStudents,        setRfidStudents]        = useState<any[]>([])
  const [search,              setSearch]              = useState('')
  const [blockInfo,           setBlockInfo]           = useState<{
    type: 'proibido' | 'dia_restrito'
    reason: string
    studentName: string
    guardianName: string
  } | null>(null)

  // Ref to RFIDInput so we can clear the buffer after each scan
  const rfidRef = useRef<RFIDInputHandle>(null)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // ── RFID handler ───────────────────────────────────────────────────────────
  const handleRFID = useCallback((code: string) => {
    setRfidError(null)
    setBlockInfo(null)

    // Find all students whose authorized list has this RFID
    const matches: { aluno: any; aut: any }[] = []
    for (const aluno of (alunos || [])) {
      const autorizados: any[] = (aluno as any).saude?.autorizados || []
      for (const aut of autorizados) {
        if (aut.rfid && aut.rfid.trim().toUpperCase() === code.trim().toUpperCase()) {
          matches.push({ aluno, aut })
        }
      }
    }

    // ── 1. RFID not found ───────────────────────────────────────────────────
    if (matches.length === 0) {
      setRfidError(`RFID "${code}" não encontrado. Verifique a ficha do aluno.`)
      showToast('RFID não cadastrado em nenhum aluno.', false)
      rfidRef.current?.clear()
      setTimeout(() => {
        setRfidError(null); setMode('idle'); setRfidCode(undefined)
        setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
      }, 2500)
      return
    }

    const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    const todayKey = DIAS[new Date().getDay()]
    const aut = matches[0].aut
    const gName = aut.nome || 'Responsável'
    const gRole = aut.parentesco || 'Autorizado'

    const doBlockReset = () => {
      rfidRef.current?.clear()
      setTimeout(() => {
        setBlockInfo(null); setMode('idle'); setRfidCode(undefined)
        setRfidStudents([]); setMatchedGuardianName(''); setMatchedGuardianRole('')
      }, 4000)
    }

    // ── 2. Proibido — absolute block ────────────────────────────────────────
    if (aut.proibido === true) {
      const reason = `${gName} está bloqueado(a) de retirar alunos nesta instituição.`
      for (const { aluno } of matches) {
        const foto = aluno.foto && aluno.foto.length > 10 ? aluno.foto : null
        blockAttempt(aluno.id, aluno.nome, aluno.turma, `rfid-${code}`, gName, code, 'proibido', reason, foto)
      }
      setBlockInfo({
        type: 'proibido', reason,
        studentName: matches.map(m => m.aluno.nome).join(', '),
        guardianName: gName,
      })
      showToast(`🚫 Acesso bloqueado: ${gName}`, false)
      doBlockReset()
      return
    }

    // ── 3. Day restriction ──────────────────────────────────────────────────
    const diasSemana: string[] = aut.diasSemana || []
    if (diasSemana.length > 0 && !diasSemana.includes(todayKey)) {
      const reason = `${gName} só pode retirar alunos nos dias: ${diasSemana.join(', ')}. Hoje é ${todayKey}.`
      for (const { aluno } of matches) {
        const foto = aluno.foto && aluno.foto.length > 10 ? aluno.foto : null
        blockAttempt(aluno.id, aluno.nome, aluno.turma, `rfid-${code}`, gName, code, 'dia_restrito', reason, foto)
      }
      setBlockInfo({
        type: 'dia_restrito', reason,
        studentName: matches.map(m => m.aluno.nome).join(', '),
        guardianName: gName,
      })
      showToast(`⚠ Dia não permitido para ${gName}`, false)
      doBlockReset()
      return
    }

    // ── All checks passed — show student cards ──────────────────────────────
    const seen = new Set<string>()
    const students: any[] = []
    for (const { aluno, aut: a } of matches) {
      if (!seen.has(aluno.id)) { seen.add(aluno.id); students.push({ ...aluno, _aut: a }) }
    }
    setMatchedGuardianName(gName)
    setMatchedGuardianRole(gRole)
    setRfidStudents(students)
    setRfidCode(code)
    setMode('rfid')
  }, [alunos, showToast, blockAttempt])

  // ── Call student ───────────────────────────────────────────────────────────
  const handleCall = useCallback((a: any) => {
    const gId  = `rfid-${rfidCode}`
    // Convert empty string foto to null so callStudent receives proper value
    const foto = a.foto && typeof a.foto === 'string' && a.foto.length > 10 ? a.foto : null
    const call = callStudent(a.id, a.nome, a.turma, gId, matchedGuardianName, 'rfid', rfidCode, foto)
    if (!call) { showToast(`${a.nome} já está em chamada ativa!`, false); return }
    showToast(`📣 ${a.nome} foi chamado(a)!`)
    // Limpa buffer RFID imediatamente e volta ao idle após 1s
    rfidRef.current?.clear()
    setTimeout(() => {
      setMode('idle')
      setRfidCode(undefined)
      setRfidError(null)
      setMatchedGuardianName('')
      setMatchedGuardianRole('')
      setRfidStudents([])
    }, 1000)
  }, [rfidCode, matchedGuardianName, callStudent, showToast])

  // ── Manual ─────────────────────────────────────────────────────────────────
  const filteredAlunos = useMemo(() => {
    if (!search.trim()) return (alunos || []).slice(0, 24)
    const q = search.toLowerCase()
    return (alunos || []).filter((a: any) =>
      a.nome?.toLowerCase().includes(q) ||
      a.turma?.toLowerCase().includes(q) ||
      a.matricula?.toLowerCase?.()?.includes(q)
    ).slice(0, 16)
  }, [alunos, search])

  const handleReset = useCallback(() => {
    rfidRef.current?.clear()
    setMode('idle'); setRfidCode(undefined); setRfidError(null)
    setBlockInfo(null)
    setMatchedGuardianName(''); setMatchedGuardianRole(''); setRfidStudents([]); setSearch('')
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontFamily: 'Outfit, sans-serif' }}>
      <style>{STANDALONE_STYLES}</style>
      {config.rfidEnabled && <RFIDInput ref={rfidRef} onRead={handleRFID} enabled={mode === 'idle' || mode === 'rfid'}
/>}

      {/* ── BLOCKED OVERLAY ─────────────────────────────────────── */}
      {blockInfo && (
        <div style={{
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
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
            border: `3px solid ${blockInfo.type === 'proibido' ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 56,
            animation: 'urgentRingCenter 1.5s ease infinite',
          }}>
            {blockInfo.type === 'proibido' ? '🚫' : '📅'}
          </div>

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
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 28px', borderRadius: 100, fontSize: 14, fontWeight: 800,
          background: toast.ok ? 'rgba(16,185,129,0.96)' : 'rgba(239,68,68,0.96)',
          color: '#fff', zIndex: 9999, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.3s ease', whiteSpace: 'nowrap',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #080f1c 0%, #0d1b2e 100%)',
        borderBottom: '1px solid rgba(6,182,212,0.18)',
        padding: isMobile ? '14px 16px' : '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50, gap: 12,
        boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
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

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div style={{ padding: isMobile ? '24px 16px' : '36px 32px', maxWidth: 1000, margin: '0 auto' }}>

        {/* ── IDLE ────────────────────────────────────────────────────── */}
        {mode === 'idle' && (
          <div style={{ textAlign: 'center', padding: isMobile ? '48px 0' : '72px 0', animation: 'slideUp 0.4s ease' }}>
            <div style={{
              width: isMobile ? 110 : 140, height: isMobile ? 110 : 140,
              borderRadius: '50%', margin: '0 auto 32px',
              background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.03) 70%)',
              border: '2px solid rgba(6,182,212,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'scanPulse 2.4s ease-in-out infinite',
            }}>
              <Scan size={isMobile ? 46 : 60} color="#06b6d4" strokeWidth={1.4}/>
            </div>
            <h2 style={{ fontWeight: 900, fontSize: isMobile ? 24 : 32, margin: '0 0 12px', color: '#f1f5f9', letterSpacing: '-0.03em' }}>
              Aguardando Identificação
            </h2>
            <p style={{ fontSize: isMobile ? 13 : 15, color: '#64748b', margin: '0 0 32px', lineHeight: 1.6 }}>
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
              {rfidStudents.map((a, i) => (
                <StudentCard
                  key={a.id}
                  aluno={a}
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
              ))}
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
              <div style={{ fontWeight: 900, fontSize: isMobile ? 16 : 20, color: '#f1f5f9', marginBottom: 6 }}>Busca Manual</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                Localize o aluno e clique no responsável para chamar.
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}/>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nome, turma ou matrícula..."
                  autoFocus
                  style={{
                    width: '100%', padding: '13px 14px 13px 42px', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.1)', background: '#0f1c2e',
                    color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'Outfit, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredAlunos.map((a: any) => {
                const saude: any = a.saude || {}
                const autorizados: any[] = saude.autorizados || []
                const autorizaSaida: boolean = saude.autorizaSaida === true
                const alreadyCalled = activeCalls.some(c =>
                  c.studentId === a.id && (c.status === 'waiting' || c.status === 'called')
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
                    border: alreadyCalled ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, overflow: 'hidden',
                  }}>
                    {/* Student row */}
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Photo or initials */}
                      {a.foto ? (
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
                        </div>
                      </div>
                    </div>

                    {/* Guardian buttons */}
                    {respList.length > 0 && (
                      <div style={{ padding: '8px 18px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', marginRight: 4 }}>CHAMAR VIA:</span>
                        {respList.map((g, i) => {
                          const diaOk = isDiaPermitido(g.diasSemana)
                          const disabled = alreadyCalled || g.proibido || !diaOk
                          return (
                            <button key={i}
                              onClick={() => {
                                if (disabled) return
                                const gId = `manual-${a.id}-${i}`
                                const call = callStudent(a.id, a.nome, a.turma, gId, g.name, 'manual')
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
              })}
              {filteredAlunos.length === 0 && search && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#334155', fontSize: 14 }}>
                  Nenhum aluno encontrado para "{search}"
                </div>
              )}
            </div>
          </div>
        )}
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
