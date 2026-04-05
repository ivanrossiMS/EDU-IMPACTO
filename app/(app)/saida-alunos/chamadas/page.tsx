'use client'
import { useState, useEffect, useMemo } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import {
  CheckCircle2, Clock, Search, Megaphone, X, GraduationCap,
  UserCheck, ChevronRight, RotateCcw,
} from 'lucide-react'

type FilterType = 'all' | 'waiting' | 'confirmed' | 'cancelled' | 'blocked'

// ── Helper ────────────────────────────────────────────────────────────────────
function statusMeta(call: PickupCall) {
  if (call.status === 'waiting' || call.status === 'called')
    return { color: '#f59e0b', label: '⏳ AGUARDANDO' }
  if (call.status === 'confirmed')
    return { color: '#10b981', label: '✅ CONFIRMADO'  }
  if (call.status === 'blocked')
    return {
      color: call.blockType === 'dia_restrito' ? '#f97316' : '#ef4444',
      label: call.blockType === 'dia_restrito' ? '📅 DIA RESTRITO' : '🚫 PROIBIDO',
    }
  return { color: '#ef4444', label: '✕ CANCELADO' }
}

// ── Unified call card (active + finished look the same, just different actions) ──
function CallCard({ call, onConfirm, onCancel, onRecall, onRevert }: {
  call:      PickupCall
  onConfirm: (id: string) => void
  onCancel:  (id: string) => void
  onRecall:  (id: string) => void
  onRevert:  (id: string) => void
}) {
  const [recalling, setRecalling] = useState(false)

  const isActive   = call.status === 'waiting' || call.status === 'called'
  const isFinished = call.status === 'confirmed' || call.status === 'cancelled'
  const isBlocked  = call.status === 'blocked'
  const { color }  = statusMeta(call)

  const initials = call.studentName
    .split(' ').slice(0, 2)
    .map((n: string) => n[0]).join('').toUpperCase()

  const handleRecall = () => {
    setRecalling(true)
    onRecall(call.id)
    setTimeout(() => setRecalling(false), 2500)
  }

  return (
    <div style={{
      background: isBlocked
        ? call.blockType === 'proibido'
          ? 'linear-gradient(135deg, rgba(239,68,68,0.06), hsl(var(--bg-elevated)))'
          : 'linear-gradient(135deg, rgba(249,115,22,0.06), hsl(var(--bg-elevated)))'
        : 'hsl(var(--bg-elevated))',
      border: `2px solid ${color}${isFinished || isBlocked ? '25' : '35'}`,
      borderRadius: 24, overflow: 'hidden',
      boxShadow: `0 8px 36px ${color}${isFinished || isBlocked ? '0a' : '14'}`,
      transition: 'all 0.25s ease',
      opacity: isFinished || isBlocked ? 0.88 : 1,
      display: 'flex', flexDirection: 'row',
      minHeight: 220,
    }}>

      {/* ── COLUNA ESQUERDA: Foto full-height ────────────────────────────── */}
      <div style={{
        width: 160, flexShrink: 0,
        background: `linear-gradient(175deg, ${color}80, ${color}28)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow blob */}
        <div style={{
          position: 'absolute', top: -30, left: -30,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}35 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}/>

        {/* Photo or initials */}
        {call.studentPhoto ? (
          <img
            src={call.studentPhoto}
            alt={call.studentName}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', zIndex: 1,
              opacity: isFinished ? 0.6 : 1,
            }}
          />
        ) : (
          <div style={{
            width: 120, height: 120,
            borderRadius: 20,
            background: `linear-gradient(145deg, ${color}90, ${color}40)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 52,
            color: '#fff', letterSpacing: '-3px',
            fontFamily: 'Outfit, sans-serif',
            border: `3px solid ${color}70`,
            boxShadow: `0 8px 28px ${color}45, inset 0 1px 0 rgba(255,255,255,0.2)`,
            position: 'relative', zIndex: 1,
          }}>
            {initials}
          </div>
        )}

      </div>

      {/* ── COLUNA DIREITA: Informações ─────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Status badge — topo da coluna direita */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 100,
          background: `${color}12`, border: `1px solid ${color}40`,
          fontSize: 9, fontWeight: 900, color, letterSpacing: '0.08em',
          alignSelf: 'flex-start', marginBottom: 8,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: color,
            animation: isActive ? 'blink 1.4s ease infinite' : 'none', flexShrink: 0,
          }}/>
          {statusMeta(call).label}
        </div>

        {/* Student name */}
        <div style={{
          fontWeight: 900, fontSize: 22,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          wordBreak: 'break-word',
          marginBottom: 10,
        }}>
          {call.studentName}
        </div>

        {/* Turma */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 10, marginBottom: 10,
          background: `${color}12`, border: `1px solid ${color}25`,
          color, fontWeight: 800, fontSize: 14,
          alignSelf: 'flex-start',
        }}>
          <GraduationCap size={14}/>
          {call.studentClass}
        </div>

        {/* Guardian */}
        <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginBottom: 6, fontWeight: 600 }}>
          👤 {call.guardianName}
        </div>

        {/* Time */}
        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>
          Chamado às{' '}
          <span style={{ color, fontWeight: 800, fontSize: 15 }}>
            {new Date(call.calledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {call.confirmedAt && (
            <span style={{ fontSize: 12 }}> → saída {new Date(call.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        {isActive && (
          <div style={{
            marginTop: 4,
            paddingTop: 14,
            borderTop: `1px solid ${color}18`,
            display: 'flex', gap: 8,
          }}>
            {/* Chamar Novamente — secondary outlined */}
            <button onClick={handleRecall} disabled={recalling} style={{
              flex: 1, height: 42, borderRadius: 12,
              background: recalling ? 'transparent' : 'rgba(129,140,248,0.07)',
              border: `1.5px solid ${recalling ? 'rgba(129,140,248,0.15)' : 'rgba(129,140,248,0.4)'}`,
              color: recalling ? 'hsl(var(--text-muted))' : '#818cf8',
              fontWeight: 700, fontSize: 12, cursor: recalling ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.18s', whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}>
              <Megaphone size={13} style={{ flexShrink: 0 }}/>
              {recalling ? 'Chamando…' : 'Chamar Nov.'}
            </button>

            {/* Confirmar Saída — primary filled */}
            <button onClick={() => onConfirm(call.id)} style={{
              flex: 1.4, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: '#fff',
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.18s', whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
              letterSpacing: '0.01em',
            }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }}/> Confirmar
            </button>

            {/* Cancelar — icon-only danger */}
            <button onClick={() => onCancel(call.id)} style={{
              width: 42, height: 42, flexShrink: 0, borderRadius: 12,
              background: 'rgba(239,68,68,0.06)',
              border: '1.5px solid rgba(239,68,68,0.25)',
              color: '#ef4444', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s',
            }}>
              <X size={14}/>
            </button>
          </div>
        )}

        {/* Block reason banner (when blocked) */}
        {isBlocked && call.blockReason && (
          <div style={{
            marginTop: 4, padding: '10px 14px', borderRadius: 10,
            background: call.blockType === 'proibido' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.07)',
            border: `1px solid ${color}30`,
            fontSize: 11, color: '#94a3b8', lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 800, color }}>
              {call.blockType === 'proibido' ? '🚫 Acesso bloqueado: ' : '📅 Dia não permitido: '}
            </span>
            {call.blockReason}
          </div>
        )}

        {isFinished && (
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${color}18` }}>
            <button onClick={() => onRevert(call.id)} style={{
              width: '100%', height: 40, borderRadius: 12,
              background: 'rgba(99,102,241,0.07)', border: '1.5px solid rgba(99,102,241,0.28)',
              color: '#818cf8', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.18s', whiteSpace: 'nowrap',
            }}>
              <RotateCcw size={13}/> Reverter para Aguardando
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Student search row with inline guardian buttons ───────────────────────────
function StudentSearchRow({ student, activeCalls, onCall }: {
  student: any
  activeCalls: PickupCall[]
  onCall: (sId: string, sName: string, sClass: string, gId: string, gName: string, foto?: string | null) => void
}) {
  // Read autorizados directly from aluno.saude (set in nova-matricula)
  const saude: any = student.saude || {}
  const autorizados: any[] = saude.autorizados || []
  const autorizaSaida: boolean = saude.autorizaSaida === true   // can leave alone

  // Day-of-week check
  const DIAS_LABEL = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
  const todayIdx = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
  const todayLabel = [DIAS_LABEL[6], ...DIAS_LABEL].at(todayIdx)! // remap: 0→Dom
  const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const todayKey = remap[todayIdx]

  // Also include responsáveis ERP as fallback if no autorizados defined
  const respList: { id: string; name: string; role: string; rfid?: string; proibido?: boolean; diasSemana?: string[] }[] = []
  const seen = new Set<string>()

  if (autorizados.length > 0) {
    autorizados.forEach((aut, i) => {
      const key = (aut.nome || '').toLowerCase().trim()
      if (!key || seen.has(key)) return
      seen.add(key)
      respList.push({
        id: `saude-aut-${i}`,
        name: aut.nome,
        role: aut.parentesco || 'Autorizado',
        rfid: aut.rfid,
        proibido: aut.proibido === true,
        diasSemana: aut.diasSemana || [],
      })
    })
  } else {
    // Fallback to ERP fields when no saude.autorizados configured
    const erp: { name: string; role: string }[] = []
    if (student.responsavel?.trim())           erp.push({ name: student.responsavel.trim(),           role: 'Responsável' })
    if (student.responsavelFinanceiro?.trim()) erp.push({ name: student.responsavelFinanceiro.trim(), role: 'Financeiro' })
    if (student.responsavelPedagogico?.trim()) erp.push({ name: student.responsavelPedagogico.trim(), role: 'Pedagógico' })
    erp.forEach((c, i) => {
      const key = c.name.toLowerCase().trim()
      if (!seen.has(key)) { seen.add(key); respList.push({ id: `erp-${i}`, name: c.name, role: c.role }) }
    })
    // Responsáveis from responsaveis array
    const resps: any[] = student.responsaveis || []
    resps.forEach((r: any, i: number) => {
      const key = (r.nome || '').toLowerCase().trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        respList.push({ id: `resp-${i}`, name: r.nome, role: r.parentesco || 'Responsável' })
      }
    })
  }

  const alreadyCalled = activeCalls.some(c =>
    c.studentId === student.id && (c.status === 'waiting' || c.status === 'called')
  )
  const initials = student.nome?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div style={{
      background: 'hsl(var(--bg-elevated))',
      border: alreadyCalled ? '1px solid rgba(245,158,11,0.35)' : '1px solid hsl(var(--border-subtle))',
      borderRadius: 16, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #06b6d450, #6366f130)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 20, color: '#fff', fontFamily: 'Outfit, sans-serif',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{student.nome}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <GraduationCap size={11} color="#06b6d4"/>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>{student.turma}</span>
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
              const remap2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
              const todayK = remap2[new Date().getDay()]
              const diaRestrito = dias.length > 0 && !dias.includes(todayK)
              const blocked = alreadyCalled || isProibido
              return (
                <button
                  key={g.id}
                  onClick={() => !blocked && !diaRestrito && onCall(student.id, student.nome, student.turma, g.id, g.name, student.foto)}
                  disabled={blocked || diaRestrito}
                  title={isProibido ? '🚫 Proibido de retirar este aluno' : diaRestrito ? `⚠ Dias permitidos: ${dias.join(', ')}` : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 100,
                    background: isProibido
                      ? 'rgba(239,68,68,0.08)'
                      : alreadyCalled || diaRestrito
                        ? 'hsl(var(--bg-overlay))'
                        : 'linear-gradient(135deg, #06b6d415, #6366f112)',
                    border: isProibido
                      ? '1px solid rgba(239,68,68,0.3)'
                      : alreadyCalled
                        ? '1px solid hsl(var(--border-subtle))'
                        : '1px solid rgba(6,182,212,0.35)',
                    color: isProibido ? '#f87171' : alreadyCalled || diaRestrito ? 'hsl(var(--text-muted))' : 'hsl(var(--text-base))',
                    fontWeight: 700, fontSize: 12,
                    cursor: blocked || diaRestrito ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: isProibido ? 0.7 : alreadyCalled ? 0.5 : 1,
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
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ChamadasContent() {
  const { activeCalls, confirmPickup, cancelCall, recallStudent, revertCall, callStudent } = useSaida()
  const { alunos } = useData()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [filter,        setFilter]        = useState<FilterType>('all')
  const [callSearch,    setCallSearch]    = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const schoolResults = useMemo(() => {
    if (studentSearch.trim().length < 2) return []
    const q = studentSearch.toLowerCase()
    return (alunos as any[]).filter(a =>
      a.nome?.toLowerCase().includes(q) ||
      a.turma?.toLowerCase().includes(q) ||
      a.id?.includes(q)
    ).slice(0, 10)
  }, [alunos, studentSearch])

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
    let list = [...activeCalls].sort((a, b) =>
      new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()
    )
    if (filter === 'waiting')   list = list.filter(c => c.status === 'waiting' || c.status === 'called')
    if (filter === 'confirmed') list = list.filter(c => c.status === 'confirmed')
    if (filter === 'cancelled') list = list.filter(c => c.status === 'cancelled')
    if (filter === 'blocked')   list = list.filter(c => c.status === 'blocked')
    if (callSearch.trim()) {
      const q = callSearch.toLowerCase()
      list = list.filter(c =>
        c.studentName.toLowerCase().includes(q) ||
        c.studentClass.toLowerCase().includes(q) ||
        c.guardianName.toLowerCase().includes(q)
      )
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
      {/* Toast */}
      {toast && (
        <div style={{
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px' }}>
          📢 Gestão de Chamadas
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Histórico e controle em tempo real
        </p>
      </div>

      {/* ── STATS ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? 8 : 12, marginBottom: 20 }}>
        {[
          { label: 'Aguardando', value: mounted ? waiting.length   : 0, color: '#f59e0b', icon: '⏳', bg: 'rgba(245,158,11,0.08)',  bd: 'rgba(245,158,11,0.2)' },
          { label: 'Confirmados',value: mounted ? confirmed.length : 0, color: '#10b981', icon: '✅', bg: 'rgba(16,185,129,0.08)',  bd: 'rgba(16,185,129,0.2)' },
          { label: 'Cancelados', value: mounted ? cancelled.length : 0, color: '#ef4444', icon: '✕',  bg: 'rgba(239,68,68,0.06)', bd: 'rgba(239,68,68,0.15)' },
        ].map(s => (
          <div key={s.label} style={{ padding: isMobile ? '14px 12px' : '18px 20px', borderRadius: 18, background: s.bg, border: `1px solid ${s.bd}` }}>
            <div style={{ fontSize: isMobile ? 14 : 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 24 : 32, color: s.color, letterSpacing: '-2px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: isMobile ? 9 : 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(99,102,241,0.03))',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 20, padding: '22px 24px', marginBottom: 28,
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} color="#06b6d4"/> Chamar Aluno
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}/>
          <input
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Buscar aluno por nome, turma ou código..."
            style={{
              width: '100%', padding: '12px 40px',
              borderRadius: 12, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))', fontSize: 13,
              color: 'hsl(var(--text-base))', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {studentSearch && (
            <button onClick={() => setStudentSearch('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'hsl(var(--text-muted))', padding: 4, display: 'flex',
            }}>
              <X size={14}/>
            </button>
          )}
        </div>
        {schoolResults.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schoolResults.map((a: any) => (
              <StudentSearchRow key={a.id} student={a} activeCalls={activeCalls} onCall={handleCall}/>
            ))}
          </div>
        )}
        {studentSearch.trim().length >= 2 && schoolResults.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '12px 0' }}>
            Nenhum aluno encontrado para "{studentSearch}"
          </div>
        )}
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', marginRight: 4 }}>HISTÓRICO</div>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
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
      </div>

      {/* ── CALL GRID ────────────────────────────────────────────────── */}
      {!mounted ? null : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
          <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }}/>
          <div>Nenhuma chamada {filter !== 'all' ? 'com este filtro' : 'registrada'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: isMobile ? 14 : 20 }}>
          {filtered.map(call => (
            <CallCard
              key={call.id}
              call={call}
              onConfirm={confirmPickup}
              onCancel={cancelCall}
              onRecall={id => recallStudent(id, () => {})}
              onRevert={revertCall}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideDown { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
      `}</style>
    </div>
  )
}

export default function ChamadasPage() {
  return <ChamadasContent />
}
