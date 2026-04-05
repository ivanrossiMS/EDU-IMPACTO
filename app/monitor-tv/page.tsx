'use client'
import { useState, useEffect, useRef } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useVoice } from '@/lib/hooks/useVoice'
import { Tv, Clock, Wifi } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function elapsedSec(since: string) {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000)
}

// ── Monitor card — 2-column layout ──────────────────────────────────────────
function MonitorStudentCard({ call }: { call: PickupCall }) {
  const [secs, setSecs] = useState(elapsedSec(call.calledAt))

  useEffect(() => {
    const iv = setInterval(() => setSecs(elapsedSec(call.calledAt)), 1000)
    return () => clearInterval(iv)
  }, [call.calledAt])

  const mins    = Math.floor(secs / 60)
  const urgent  = secs > 120
  const color   = urgent ? '#f59e0b' : '#06b6d4'
  const initials = call.studentName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)',
      border: `2px solid ${color}50`,
      borderRadius: 20,
      display: 'flex',
      flexDirection: 'row',
      minHeight: 240,
      boxShadow: `0 10px 40px ${color}22, 0 0 0 1px ${color}10`,
      animation: 'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      overflow: 'hidden',
      width: '100%',
    }}>
      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        animation: 'glowPulse 2s ease infinite',
      }}/>

      {/* ── LEFT: Full-height photo panel ───────────────────── */}
      <div style={{
        width: 360, flexShrink: 0,
        background: `linear-gradient(175deg, ${color}70, ${color}20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow blob background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 40%, ${color}35 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}/>

        {/* Urgent pulsing ring */}
        {urgent && (
          <div style={{
            position: 'absolute',
            width: 260, height: 260, borderRadius: '50%',
            border: '2px solid rgba(245,158,11,0.5)',
            animation: 'urgentRingCenter 1.5s ease infinite',
          }}/>
        )}

        {/* Photo or initials avatar */}
        {call.studentPhoto ? (
          <img
            src={call.studentPhoto}
            alt={call.studentName}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              zIndex: 1,
              filter: urgent ? 'brightness(0.85)' : 'none',
              transition: 'filter 0.5s',
            }}
          />
        ) : (
          <div style={{
            width: 264, height: 264,
            borderRadius: 32,
            background: `linear-gradient(145deg, ${color}90, ${color}35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 115,
            color: '#fff', letterSpacing: '-6px',
            fontFamily: 'Outfit, sans-serif',
            border: `4px solid ${color}70`,
            boxShadow: `0 12px 48px ${color}50, inset 0 1px 0 rgba(255,255,255,0.2)`,
            position: 'relative', zIndex: 1,
          }}>
            {initials}
          </div>
        )}

      </div>

      {/* ── RIGHT: Info with larger text ───────────────────── */}
      <div style={{
        flex: 1, padding: '20px 20px',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minWidth: 0,
        alignItems: 'center', textAlign: 'center',
      }}>

        {/* Status badge — topo da coluna direita */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 100,
          background: urgent ? 'rgba(245,158,11,0.12)' : `${color}12`,
          border: `1px solid ${color}40`,
          fontSize: 10, fontWeight: 900, color, letterSpacing: '0.1em',
          marginBottom: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: color,
            animation: 'blink 1.2s ease infinite', flexShrink: 0,
          }}/>
          {urgent ? '⚠ +2 MIN AGUARDANDO' : '📢 AGUARDANDO'}
        </div>

        {/* Student name */}
        <div style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 900,
          fontSize: 20,
          color: '#f1f5f9',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          wordBreak: 'break-word',
          marginBottom: 10,
        }}>
          {call.studentName}
        </div>

        {/* Class */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 10, marginBottom: 10,
          background: `${color}18`, color,
          fontWeight: 800, fontSize: 14,
          border: `1px solid ${color}35`,
        }}>
          🎓 {call.studentClass}
        </div>

        {/* Guardian */}
        <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600, marginBottom: 'auto' }}>
          👤 <span style={{ color: '#cbd5e1' }}>{call.guardianName}</span>
        </div>

        {/* Timer row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
            {fmtTime(call.calledAt)}
          </div>
          {mins > 0 && (
            <div style={{
              padding: '3px 10px', borderRadius: 100,
              background: urgent ? 'rgba(245,158,11,0.14)' : 'rgba(6,182,212,0.1)',
              color: urgent ? '#f59e0b' : '#38bdf8',
              fontSize: 13, fontWeight: 800,
            }}>
              {urgent ? '⚠️' : '⏱'} {mins}m{String(secs % 60).padStart(2,'0')}s
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Sort helper: most recent calledAt first
const byTimeDesc = (a: PickupCall, b: PickupCall) =>
  new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()

// ── Main Monitor Component ─────────────────────────────────────────────────────
function MonitorContent() {
  const { activeCalls, config, confirmPickup } = useSaida()
  const { on } = useBroadcastRealtime()
  const voice = useVoice({ rate: config.voiceRate, volume: config.voiceVolume, repeatCount: config.voiceRepeatCount, voiceURI: config.voiceURI })
  const [displayCalls, setDisplayCalls] = useState<PickupCall[]>([])
  const [clock, setClock] = useState('')
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const spokenRef = useRef<Set<string>>(new Set())

  const handleUnlockAudio = () => {
    setAudioUnlocked(true)
    if (config.voiceEnabled && voice.isSupported) {
      voice.speak('', { volume: 0 })
    }
  }

  // Sync from context — sort most recent first
  useEffect(() => {
    setDisplayCalls(
      activeCalls
        .filter(c => c.status === 'waiting' || c.status === 'called')
        .sort(byTimeDesc)
    )
  }, [activeCalls])

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  // TTS: speak new students only on this page
  useEffect(() => {
    if (!audioUnlocked || !config.voiceEnabled || !voice.isSupported) return
    displayCalls.forEach(call => {
      if (!spokenRef.current.has(call.id)) {
        spokenRef.current.add(call.id)
        setTimeout(() => {
          const cName = config.voiceTruncateTurma && config.voiceTruncateChar ? call.studentClass.split(config.voiceTruncateChar)[0].trim() : call.studentClass
          voice.speak(`${call.studentName}, turma ${cName}`)
        }, 600)
      }
    })
  }, [displayCalls, config.voiceEnabled, voice, audioUnlocked])

  // Listen for realtime from other tabs
  useEffect(() => {
    const unsub = on('*', payload => {
      const d = payload.data as any
      if (payload.event === 'CALL_STUDENT') {
        setDisplayCalls(prev => {
          const next = prev.find(c => c.id === d.id) ? prev : [d, ...prev]
          return [...next].sort(byTimeDesc)
        })
        if (audioUnlocked && config.voiceEnabled && voice.isSupported && !spokenRef.current.has(d.id)) {
          spokenRef.current.add(d.id)
          const cName = config.voiceTruncateTurma && config.voiceTruncateChar ? d.studentClass.split(config.voiceTruncateChar)[0].trim() : d.studentClass
          setTimeout(() => voice.speak(`${d.studentName}, turma ${cName}`), 600)
        }
      }
      if (payload.event === 'CONFIRM_PICKUP' && d.callId) {
        setTimeout(() => {
          setDisplayCalls(prev => prev.filter(c => c.id !== d.callId))
          spokenRef.current.delete(d.callId)
        }, (config.tvDisplayTime || 5) * 1000)
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setDisplayCalls(prev => prev.filter(c => c.id !== d.callId))
        spokenRef.current.delete(d.callId)
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setDisplayCalls(prev => {
          const updated = prev.map(c =>
            c.id === d.callId ? { ...c, status: 'waiting' as const, calledAt: new Date().toISOString() } : c
          )
          return [...updated].sort(byTimeDesc)
        })
        // Remove from spoken so main useEffect speaks once (avoids double-speak)
        spokenRef.current.delete(d.callId)
      }
    })
    return () => { unsub() }
  }, [on, config, voice, displayCalls])

  const hasCards = displayCalls.length > 0

  return (
    <div style={{
      minHeight: '100vh', background: '#070d1a',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Outfit, Inter, sans-serif',
    }}>
      {/* ── OVERLAY DE DESBLOQUEIO DE ÁUDIO ── */}
      {!audioUnlocked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(7, 13, 26, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, background: 'rgba(6,182,212,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            border: '2px solid rgba(6,182,212,0.2)', boxShadow: '0 0 32px rgba(6,182,212,0.3)'
          }}>
             <Tv size={40} color="#06b6d4" />
          </div>
          <h1 style={{ color: '#fff', fontSize: 32, fontFamily: 'Outfit, sans-serif', margin: '0 0 12px' }}>
            Monitor TV Portaria
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 40, maxWidth: 440, textAlign: 'center', lineHeight: 1.5 }}>
            Para que o auto-falante da TV possa anunciar os alunos, o navegador exige uma interação inicial de ativação do canal de áudio.
          </p>
          <button onClick={handleUnlockAudio} style={{
            padding: '16px 36px', borderRadius: 100, background: '#06b6d4', color: '#fff',
            fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(6,182,212,0.4)', transition: 'transform 0.2s',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <Tv size={18}/> INICIAR MONITOR COM ÁUDIO
          </button>
        </div>
      )}

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1b2e, #111827)',
        padding: '16px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '2px solid rgba(6,182,212,0.25)',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(6,182,212,0.4)',
          }}>
            <Tv size={26} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              PORTARIA · SAÍDA DE ALUNOS
            </div>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Monitor em tempo real</div>
          </div>
        </div>

        {/* Right: live + clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={14} color="#10b981" />
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 800, letterSpacing: '0.06em' }}>AO VIVO</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: '#f1f5f9',
            background: 'rgba(255,255,255,0.04)', padding: '6px 18px', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Clock size={18} color="#64748b" />
            {clock}
          </div>
          <div style={{
            padding: '6px 16px', borderRadius: 100,
            background: hasCards ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${hasCards ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)'}`,
            color: hasCards ? '#f59e0b' : '#10b981',
            fontSize: 12, fontWeight: 800,
          }}>
            {displayCalls.length} chamada{displayCalls.length !== 1 ? 's' : ''} ativa{displayCalls.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '48px 40px', display: 'flex', flexDirection: 'column' }}>
        {!hasCards ? (
          // Empty state
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24,
          }}>
            <div style={{
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent)',
              border: '2px solid rgba(6,182,212,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Tv size={64} color="rgba(6,182,212,0.25)" strokeWidth={1.2} />
            </div>
            <div style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 36, fontWeight: 900,
              color: 'rgba(255,255,255,0.07)', letterSpacing: '-0.04em',
            }}>
              Aguardando Chamadas
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.06)' }}>
              Os alunos chamados aparecerão aqui automaticamente
            </div>
          </div>
        ) : (
          // Cards
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Counter */}
            <div style={{
              fontSize: 12, fontWeight: 800, color: 'rgba(6,182,212,0.6)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              {displayCalls.length} ALUNO{displayCalls.length !== 1 ? 'S' : ''} AGUARDANDO NA PORTARIA
            </div>

            {/* 2-column grid — centralizado */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              maxWidth: 1100,
              margin: '0 auto',
              width: '100%',
            }}>
              {displayCalls.map(call => (
                <MonitorStudentCard key={call.id} call={call} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom strip ────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1b2e, #111827)',
        borderTop: '1px solid rgba(6,182,212,0.1)',
        padding: '12px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, color: '#334155', flexShrink: 0,
      }}>
        <span>IMPACTO EDU · Sistema de Gestão Escolar</span>
        <span>Portaria Digital · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        body { background: #070d1a !important; margin: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes urgentRingCenter { 0%{transform:scale(1) translateX(-50%);opacity:0.5} 70%{transform:scale(1.25) translateX(-50%);opacity:0} 100%{transform:scale(1) translateX(-50%);opacity:0} }
      `}</style>
    </div>
  )
}

export default function MonitorTVPage() {
  return (
    <SaidaProvider>
      <MonitorContent />
    </SaidaProvider>
  )
}
