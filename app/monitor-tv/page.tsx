'use client'
import { useState, useEffect, useRef } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { useVoice } from '@/lib/hooks/useVoice'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { Tv, Clock, User, Nfc, Maximize, Wifi, WifiOff, Loader2 } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function elapsedSec(since: string) {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000)
}

// Intelligent abbreviation for Portuguese student names to stay strictly in 1 line
function formatName(fullName: string) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 2) return fullName // First and Last name only

  // If the name is already short enough, keep it
  if (fullName.length <= 20) return fullName

  // Keep first name, keep last name, and abbreviate middle names!
  const first = parts[0]
  const last = parts[parts.length - 1]
  const middles = parts.slice(1, -1).map(m => {
    const lower = m.toLowerCase()
    // Skip small Portuguese prepositions
    if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(lower)) return ''
    return m[0].toUpperCase() + '.'
  }).filter(Boolean)

  const assembled = [first, ...middles, last].join(' ')
  // If still too long, return just First and Last
  if (assembled.length > 24 && parts.length > 1) {
    return `${first} ${last}`
  }
  return assembled
}

// ── Monitor Card - Full Background Photo ──────────────────────────────────────
function MonitorStudentCard({ call, index }: { call: PickupCall, index: number }) {
  const { config } = useSaida()
  const [secs, setSecs] = useState(elapsedSec(call.calledAt))

  useEffect(() => {
    const iv = setInterval(() => setSecs(elapsedSec(call.calledAt)), 1000)
    return () => clearInterval(iv)
  }, [call.calledAt])

  const mins = Math.floor(secs / 60)
  const urgentLimit = (config?.tvUrgentTime ?? 5) * 60
  const urgent = secs > urgentLimit
  const accentColor = urgent ? '#ef4444' : '#06b6d4'
  const initials = call.studentName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const animDelay = `${Math.min(index * 0.08, 0.4)}s`

  return (
    <div 
      className={`tv-card-full-photo ${urgent ? 'tv-card-urgent-glow' : 'tv-card-normal-glow'}`} 
      style={{ animationDelay: animDelay }}
    >
      {/* Background Image / Initials Gradient */}
      {call.studentPhoto ? (
        <>
          {/* Blurred Background Backdrop for premium ambient fill */}
          <img src={call.studentPhoto} alt="" className="tv-card-photo-blur-backdrop" />
          {/* Crisp, uncropped centered foreground photo */}
          <img src={call.studentPhoto} alt={call.studentName} className="tv-card-photo-bg" />
        </>
      ) : (
        <div className="tv-card-photo-bg-initials" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #171717 100%)` }}>
          {initials}
        </div>
      )}

      {/* Modern Black Gradient Overlay for Maximum Legibility */}
      <div className="tv-card-gradient-overlay" />

      {/* Floating Status Tag (Top-Right) */}
      <div className={`tv-card-tag-badge ${urgent ? 'badge-urgent' : 'badge-waiting'}`}>
        {urgent ? 'ATRASADO' : 'LIBERADO'}
      </div>

      {/* Text Details & Metadata Container */}
      <div className="tv-card-text-content">
        {/* Shortened Name */}
        <h2 className="tv-card-name-one-line" title={call.studentName}>
          {formatName(call.studentName)}
        </h2>

        {/* Class Badge */}
        <div className="tv-card-class-badge-modern" style={{ borderColor: `${accentColor}80`, color: '#fff' }}>
          <span style={{ color: accentColor, fontWeight: 900, marginRight: 6 }}>•</span>
          {call.studentClass}
        </div>

        {/* Footer Info Row */}
        <div className="tv-card-footer-modern">
          {/* Guardian Info */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em', flexShrink: 0 }}>RESPONSÁVEL:</span>
            <span className="tv-card-guardian-text" title={call.guardianName}>
              {call.guardianName || 'Não Informado'}
            </span>
          </div>

          {/* Time & Counter */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 900, color: '#e2e8f0' }}>
              <Clock size={15} color="rgba(255, 255, 255, 0.4)" />
              <span>{fmtTime(call.calledAt)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 900, color: accentColor }}>
              <Clock size={15} color={accentColor} className={urgent ? 'tv-pulse-icon' : ''} />
              <span>{mins}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sort helper: most recent calledAt first
const byTimeDesc = (a: PickupCall, b: PickupCall) =>
  new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()

// ── Secondary Student Card for Bottom Grid ──────────────────────────────────
function MonitorSecondaryCard({ call, index }: { call: PickupCall, index: number }) {
  const { config } = useSaida()
  const initials = call.studentName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const secs = elapsedSec(call.calledAt)
  const urgentLimit = (config?.tvUrgentTime ?? 5) * 60
  const urgent = secs > urgentLimit
  const accentColor = urgent ? '#ef4444' : '#06b6d4'
  const animDelay = `${Math.min(index * 0.05, 0.4)}s`
  
  return (
    <div className="tv-secondary-card-item" style={{ animationDelay: animDelay }}>
      {/* Side Glow Border */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: accentColor,
        boxShadow: `0 0 10px ${accentColor}`
      }} />

      {/* Mini Photo/Initials */}
      <div className="tv-secondary-card-avatar">
        {call.studentPhoto ? (
          <img src={call.studentPhoto} alt={call.studentName} className="tv-secondary-card-photo" />
        ) : (
          <div className="tv-secondary-card-initials" style={{ background: `linear-gradient(135deg, ${accentColor}, #4f46e5)` }}>
            {initials}
          </div>
        )}
      </div>

      {/* Info Container */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 className="tv-secondary-card-name" title={call.studentName}>
          {formatName(call.studentName)}
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="tv-secondary-card-class" style={{ color: accentColor, borderColor: `${accentColor}33` }}>
            {call.studentClass}
          </span>
          
          <span className="tv-secondary-card-guardian" title={call.guardianName}>
            👤 {call.guardianName || 'Não Informado'}
          </span>
        </div>
      </div>

      {/* Call Time */}
      <div className="tv-secondary-card-time">
        <Clock size={12} color="rgba(255, 255, 255, 0.35)" />
        <span>{fmtTime(call.calledAt)}</span>
      </div>
    </div>
  )
}

// ── TV Card Skeleton for Instant Rendering ──────────────────────────────────
function TVCardSkeleton() {
  return (
    <div className="tv-card-full-photo skeleton-shimmer" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1.5px solid rgba(255, 255, 255, 0.05)', height: 370, position: 'relative' }}>
      <div className="tv-card-gradient-overlay" />
      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
        <div style={{ width: '75%', height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ width: '30%', height: 18, borderRadius: 5, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <div style={{ width: '50%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ width: '20%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Monitor Component ─────────────────────────────────────────────────────
function MonitorContent() {
  const { activeCalls, config, realtimeStatus, isLoadingCalls, refreshCalls } = useSaida()
  const [turmas] = useSupabaseArray<any>('turmas')
  const { on } = useBroadcastRealtime()
  
  const voice = useVoice({ 
    rate: config?.voiceRate ?? 0.9, 
    volume: config?.voiceVolume ?? 1, 
    repeatCount: config?.voiceRepeatCount ?? 0, 
    voiceURI: config?.voiceURI || '' 
  })

  const [displayCalls, setDisplayCalls] = useState<PickupCall[]>([])
  const [clock, setClock] = useState('')
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [mounted, setMounted] = useState(false)
  const spokenRef = useRef<Set<string>>(new Set())

  // Configurable Scale, Rotation & Mode States
  const [rotation, setRotation] = useState<0 | 90 | 270>(0)
  const [displayMode, setDisplayMode] = useState<'fit' | 'cover'>('cover')
  const [scale, setScale] = useState(1)
  const [hintText, setHintText] = useState('')
  const [showControls, setShowControls] = useState(true)

  useEffect(() => {
    setMounted(true)
    
    // Detect OS for shortcut hint
    const platform = navigator.platform.toLowerCase()
    const isMac = platform.includes('mac') || navigator.userAgent.toLowerCase().includes('mac')
    setHintText(isMac ? "Se necessário, pressione Control + Command + F" : "Se necessário, pressione F11")
  }, [])

  // Auto scale to viewport with FIT vs COVER modes
  useEffect(() => {
    if (!mounted) return
    const handleResize = () => {
      const vWidth = window.innerWidth
      const vHeight = window.innerHeight
      
      const isRotated = rotation === 90 || rotation === 270
      const contentWidth = isRotated ? 1920 : 1080
      const contentHeight = isRotated ? 1080 : 1920
 
      const scaleFit = Math.min(vWidth / contentWidth, vHeight / contentHeight)
      const scaleCover = Math.max(vWidth / contentWidth, vHeight / contentHeight)

      const newScale = displayMode === 'cover' ? scaleCover : scaleFit
      setScale(newScale)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [mounted, rotation, displayMode])

  // Mouse activity timer to autohide controls
  useEffect(() => {
    let timer: NodeJS.Timeout
    const handleActivity = () => {
      setShowControls(true)
      clearTimeout(timer)
      timer = setTimeout(() => {
        setShowControls(false)
      }, 4000)
    }
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    handleActivity()
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      clearTimeout(timer)
    }
  }, [])

  // Fallback Polling 30s se o Supabase Realtime falhar ou desconectar
  useEffect(() => {
    if (realtimeStatus !== 'online') {
      refreshCalls()
      const iv = setInterval(() => {
        refreshCalls()
      }, 30000)
      return () => clearInterval(iv)
    }
  }, [realtimeStatus, refreshCalls])

  const handleUnlockAudio = () => {
    setAudioUnlocked(true)
    if (config?.voiceEnabled && voice.isSupported) {
      voice.speak('', { volume: 0 })
    }
  }

  // Fullscreen trigger API
  const enterFullscreen = async () => {
    try {
      const element = document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      }
    } catch (err) {
      console.error("Fullscreen failed:", err)
    }
  }

  // Sync from context — sort most recent first & show top 25 to support both panels
  useEffect(() => {
    setDisplayCalls(
      activeCalls
        .filter(c => c.status === 'waiting' || c.status === 'called')
        .sort(byTimeDesc)
        .slice(0, 25)
    )
  }, [activeCalls])

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  // TTS voice feedback
  useEffect(() => {
    if (!audioUnlocked || !config?.voiceEnabled || !voice.isSupported) return
    displayCalls.forEach(call => {
      const speechKey = call.id + '_' + (call.calledAt || Date.now())
      if (!spokenRef.current.has(speechKey)) {
        spokenRef.current.add(speechKey)
        setTimeout(() => {
          const turmaObj = (turmas || []).find((t: any) => String(t.id) === String(call.studentClass) || t.codigo === call.studentClass || t.nome === call.studentClass)
          const tName = turmaObj?.nome || call.studentClass
          const cName = config?.voiceTruncateTurma && config?.voiceTruncateChar ? tName.split(config.voiceTruncateChar)[0].trim() : tName
          voice.speak(`${call.studentName}, turma ${cName}`)
        }, 600)
      }
    })
  }, [displayCalls, config, voice, audioUnlocked, turmas])

  const turmasRef = useRef(turmas)
  const configRef = useRef(config)
  const audioUnlockedRef = useRef(audioUnlocked)
  const displayCallsRef = useRef(displayCalls)

  useEffect(() => {
    turmasRef.current = turmas
    configRef.current = config
    audioUnlockedRef.current = audioUnlocked
    displayCallsRef.current = displayCalls
  }, [turmas, config, audioUnlocked, displayCalls])

  // Listen for realtime from other tabs
  useEffect(() => {
    const unsub = on('*', payload => {
      const d = payload.data as any
      const currentConfig = configRef.current
      const currentTurmas = turmasRef.current

      if (payload.event === 'CALL_STUDENT') {
        setDisplayCalls(prev => {
          const next = prev.find(c => c.id === d.id) ? prev : [d, ...prev]
          return [...next].sort(byTimeDesc).slice(0, 25)
        })
        const speechKey = d.id + '_' + (d.calledAt || Date.now())
        if (audioUnlockedRef.current && currentConfig?.voiceEnabled && voice.isSupported && !spokenRef.current.has(speechKey)) {
          spokenRef.current.add(speechKey)
          const turmaObj = (currentTurmas || []).find((t: any) => String(t.id) === String(d.studentClass) || t.codigo === d.studentClass || t.nome === d.studentClass)
          const tName = turmaObj?.nome || d.studentClass
          const cName = currentConfig?.voiceTruncateTurma && currentConfig?.voiceTruncateChar ? tName.split(currentConfig.voiceTruncateChar)[0].trim() : tName
          setTimeout(() => voice.speak(`${d.studentName}, turma ${cName}`), 600)
        }
      }
      if (payload.event === 'CONFIRM_PICKUP' && d.callId) {
        setTimeout(() => {
          setDisplayCalls(prev => prev.filter(c => c.id !== d.callId))
          spokenRef.current.delete(d.callId)
        }, (currentConfig?.tvDisplayTime || 5) * 1000)
      }
      if (payload.event === 'CANCEL_CALL' && d.callId) {
        setDisplayCalls(prev => prev.filter(c => c.id !== d.callId))
        spokenRef.current.delete(d.callId)
      }
      if (payload.event === 'CLEAR_ALL_CALLS') {
        setDisplayCalls([])
        spokenRef.current.clear()
      }
      if (payload.event === 'RECALL_STUDENT' && d.callId) {
        setDisplayCalls(prev => {
          const updated = prev.map(c =>
            c.id === d.callId ? { ...c, status: 'waiting' as const, calledAt: new Date().toISOString() } : c
          )
          return [...updated].sort(byTimeDesc).slice(0, 25)
        })
        
        // Speak immediately
        const theCall = displayCallsRef.current.find(c => c.id === d.callId)
        const speechKey = d.callId + '_' + (d.calledAt || Date.now())
        if (theCall && audioUnlockedRef.current && currentConfig?.voiceEnabled && voice.isSupported && !spokenRef.current.has(speechKey)) {
          spokenRef.current.add(speechKey)
          const turmaObj = (currentTurmas || []).find((t: any) => String(t.id) === String(theCall.studentClass) || t.codigo === theCall.studentClass || t.nome === theCall.studentClass)
          const tName = turmaObj?.nome || theCall.studentClass
          const cName = currentConfig?.voiceTruncateTurma && currentConfig?.voiceTruncateChar ? tName.split(currentConfig.voiceTruncateChar)[0].trim() : tName
          setTimeout(() => voice.speak(`${theCall.studentName}, turma ${cName}`), 600)
        }
      }
    })
    return () => { unsub() }
  }, [on, voice])

  const isScreenLoading = !mounted || isLoadingCalls
  const hasCards = displayCalls.length > 0

  const canvasStyle: React.CSSProperties = {
    width: 1080,
    height: 1920,
    transform: `rotate(${rotation}deg) scale(${scale})`,
    transformOrigin: 'center center',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'radial-gradient(circle at top right, #091326, #020612 85%)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    zIndex: 5,
    flexShrink: 0,
    position: 'relative',
  }

  return (
    <div className="tv-fullscreen-container">
      {/* ── Background blobs ── */}
      <div className="bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      {/* ── AUDIO UNLOCK OVERLAY ── */}
      {!audioUnlocked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(4, 11, 22, 0.96)', backdropFilter: 'blur(30px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 70, height: 70, borderRadius: 24, background: 'rgba(6,182,212,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            border: '2px solid rgba(6,182,212,0.3)', boxShadow: '0 0 32px rgba(6,182,212,0.4)',
            animation: 'pulseUrgent 2s infinite'
          }}>
             <Tv size={36} color="#06b6d4" />
          </div>
          <h1 style={{ color: '#fff', fontSize: 32, fontFamily: 'Outfit, sans-serif', margin: '0 0 16px', fontWeight: 900, letterSpacing: '-0.02em' }}>
            Monitor TV Portaria (Vertical)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32, maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
            Para que a TV possa anunciar os alunos por voz, clique no botão abaixo para iniciar o modo monitor vertical.
          </p>
          <button onClick={handleUnlockAudio} style={{
            padding: '16px 36px', borderRadius: 100, background: '#06b6d4', color: '#fff',
            fontWeight: 900, fontSize: 16, border: 'none', cursor: 'pointer',
            boxShadow: '0 12px 28px rgba(6,182,212,0.4)', transition: 'transform 0.2s',
            display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '0.02em'
          }}>
            <Tv size={20}/> INICIAR MONITOR COM ÁUDIO
          </button>

          {/* Realtime Status Indicator */}
          <div 
            onClick={refreshCalls} 
            title="Clique para forçar verificação de conexão"
            style={{
              marginTop: 24,
              padding: '10px 20px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${
                realtimeStatus === 'online' 
                  ? 'rgba(16, 185, 129, 0.22)' 
                  : realtimeStatus === 'offline' 
                    ? 'rgba(239, 68, 68, 0.22)' 
                    : 'rgba(6, 182, 212, 0.22)'
              }`,
              boxShadow: `0 8px 24px rgba(0, 0, 0, 0.2), 0 0 16px ${
                realtimeStatus === 'online' 
                  ? 'rgba(16, 185, 129, 0.06)' 
                  : realtimeStatus === 'offline' 
                    ? 'rgba(239, 68, 68, 0.06)' 
                    : 'rgba(6, 182, 212, 0.06)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.2, 1, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {realtimeStatus === 'online' ? (
              <>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  animation: 'tagPulse 1.8s infinite ease-in-out'
                }} />
                <Wifi size={16} color="#10b981" />
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#10b981',
                  textTransform: 'uppercase'
                }}>
                  REALTIME: CONECTADO
                </span>
              </>
            ) : realtimeStatus === 'offline' ? (
              <>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'pulseUrgent 1.2s infinite alternate'
                }} />
                <WifiOff size={16} color="#ef4444" />
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#ef4444',
                  textTransform: 'uppercase'
                }}>
                  REALTIME: FALHA (CLIQUE PARA RECONECTAR)
                </span>
              </>
            ) : (
              <>
                <Loader2 size={16} className="tv-spin" style={{ color: '#06b6d4' }} />
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#06b6d4',
                  textTransform: 'uppercase'
                }}>
                  REALTIME: CONECTANDO...
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FIXED VIRTUAL CANVAS (1080x1920) ────────────────────────────────── */}
      <div className="tv-canvas" style={canvasStyle}>
        
        {/* Header */}
        <div style={{
          padding: '48px 48px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid rgba(6, 182, 212, 0.18)',
          background: 'rgba(5, 12, 28, 0.45)',
          backdropFilter: 'blur(20px)',
          zIndex: 10
        }}>
          {/* Left: Icon and App Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14,
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(6,182,212,0.4)',
            }}>
              <Tv size={28} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 28, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                PORTARIA DIGITAL
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                Saída de Alunos em Tempo Real
              </div>
            </div>
          </div>

          {/* Right: Realtime Status Badge & Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Realtime Status Badge */}
            <div className="tv-realtime-status-pill" style={{
              background: realtimeStatus === 'online' ? 'rgba(16,185,129,0.12)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1.5px solid ${realtimeStatus === 'online' ? 'rgba(16,185,129,0.25)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                boxShadow: `0 0 8px ${realtimeStatus === 'online' ? '#10b981' : realtimeStatus === 'connecting' ? '#f59e0b' : '#ef4444'}`,
                animation: realtimeStatus !== 'online' ? 'pulseUrgent 1.5s infinite' : 'none'
              }} />
              <span>{realtimeStatus === 'online' ? 'ONLINE' : realtimeStatus === 'connecting' ? 'CONECTANDO' : 'OFFLINE'}</span>
            </div>

            {/* Clock */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'monospace', fontSize: 32, fontWeight: 900, color: '#f1f5f9',
              background: 'rgba(0,0,0,0.3)', padding: '10px 24px', borderRadius: 16,
              border: '1.5px solid rgba(255,255,255,0.06)'
            }}>
              <Clock size={24} color="#06b6d4" />
              {clock}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: 48, display: 'flex', flexDirection: 'column', gap: 28, overflow: 'hidden', justifyContent: hasCards ? 'flex-start' : 'center', zIndex: 10 }}>
          {isScreenLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, width: '100%' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <TVCardSkeleton key={i} />
              ))}
            </div>
          ) : !hasCards ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 48,
              animation: 'cardEnter 0.6s ease-out',
              margin: 'auto 0'
            }}>
              {/* Animated RFID Reader */}
              <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                  border: '3px solid rgba(6,182,212,0.4)', animation: 'rippleEmit 2.8s infinite ease-out'
                }} />
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                  border: '3px solid rgba(6,182,212,0.2)', animation: 'rippleEmit 2.8s infinite ease-out 1.4s'
                }} />
                
                <div style={{
                  position: 'relative', width: 140, height: 140, borderRadius: 36,
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                  boxShadow: '0 0 45px rgba(6,182,212,0.35), inset 0 0 25px rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)', border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ animation: 'tagPulse 3s infinite ease-in-out' }}>
                    <Nfc size={64} color="#fff" strokeWidth={1.2} style={{ filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.8))' }} />
                  </div>
                </div>
              </div>

              {/* Ultra Modern Text */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: 48, fontWeight: 900,
                    color: '#ffffff', letterSpacing: '-0.02em',
                    textShadow: '0 0 24px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.5)',
                    textTransform: 'uppercase',
                    animation: 'tagPulse 2.5s infinite ease-in-out'
                  }}>
                  Aguardando Leitura
                </div>
                <div style={{
                  fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700,
                  color: '#06b6d4', letterSpacing: '0.22em', textTransform: 'uppercase',
                  textShadow: '0 0 10px rgba(6,182,212,0.4)'
                }}>
                  Aproxime a Tag do Leitor
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Top 8 Cards Grid (2 Columns, max 8 students) with Animated Separator Line */}
              <div style={{ position: 'relative', width: '100%' }}>
                {/* Modern Animated Neon Separator Line between 2 columns */}
                {displayCalls.slice(0, 8).length > 1 && (
                  <div className="tv-vertical-neon-separator" />
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, width: '100%' }}>
                  {displayCalls.slice(0, 8).map((call, idx) => {
                    const classroomObj = (turmas || []).find((t: any) => String(t.id) === String(call.studentClass) || t.codigo === call.studentClass || t.nome === call.studentClass)
                    const mappedCall = { ...call, studentClass: classroomObj?.nome || call.studentClass }
                    return <MonitorStudentCard key={call.id} call={mappedCall} index={idx} />
                  })}
                </div>
              </div>

              {/* Secondary Bottom Panel (Fila de Saída Anterior - starts from 9th) */}
              {displayCalls.length > 8 && (
                <div style={{
                  marginTop: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  animation: 'cardEnter 0.5s ease-out backwards',
                  animationDelay: '0.2s',
                  maxHeight: 180,
                  overflowY: 'auto',
                  paddingRight: 4
                }} className="custom-tv-scrollbar">
                  {/* Glowing Mini Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} />
                    <span style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: 14,
                      fontWeight: 900,
                      color: '#a855f7',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase'
                    }}>Fila de Saída Anterior ({displayCalls.length - 8})</span>
                  </div>

                  {/* 2-Column Grid for Secondary Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 16
                  }}>
                    {displayCalls.slice(8).map((call, idx) => {
                      const classroomObj = (turmas || []).find((t: any) => String(t.id) === String(call.studentClass) || t.codigo === call.studentClass || t.nome === call.studentClass)
                      const mappedCall = { ...call, studentClass: classroomObj?.nome || call.studentClass }
                      return <MonitorSecondaryCard key={call.id} call={mappedCall} index={idx} />
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '32px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 14, color: '#64748b', fontWeight: 700, flexShrink: 0,
          zIndex: 10, backdropFilter: 'blur(20px)'
        }}>
          <span>IMPACTO EDU · Sistema de Gestão Escolar</span>
          <span>Portaria Digital · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* ── ADVANCED FLOATING TV CONTROL PANEL ── */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(15, 23, 42, 0.94)',
        border: '1px solid rgba(255,255,255,0.12)', padding: '14px 18px',
        borderRadius: 16, backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.95)',
        pointerEvents: showControls ? 'auto' : 'none',
        fontFamily: 'Outfit, sans-serif',
        minWidth: 260
      }}>
        
        {/* Title */}
        <div style={{ fontSize: 11, fontWeight: 900, color: '#06b6d4', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 4 }}>
          Controles do Monitor TV
        </div>

        {/* Section 1: Rotation */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROTAÇÃO VIRTUAL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 90, 270].map(deg => (
              <button key={deg} onClick={() => setRotation(deg as any)} style={{
                flex: 1, background: rotation === deg ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(255,255,255,0.03)',
                border: 'none', color: rotation === deg ? '#fff' : '#cbd5e1',
                padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: 900, fontSize: 11, transition: 'all 0.15s'
              }}>
                {deg}°
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Scale Mode */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AJUSTE DE TELA</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['fit', 'cover'] as const).map(mode => (
              <button key={mode} onClick={() => setDisplayMode(mode)} style={{
                flex: 1, background: displayMode === mode ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(255,255,255,0.03)',
                border: 'none', color: displayMode === mode ? '#fff' : '#cbd5e1',
                padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: 900, fontSize: 11, transition: 'all 0.15s',
                textTransform: 'uppercase'
              }}>
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Fullscreen Action */}
        <div style={{ marginTop: 4 }}>
          <button onClick={enterFullscreen} style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
            fontWeight: 900, fontSize: 12, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            textTransform: 'uppercase', letterSpacing: '0.02em'
          }}>
            <Maximize size={14} /> Tela Cheia
          </button>
          
          {/* OS Shortcut Hint */}
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 1.3 }}>
            {hintText}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        
        /* ── Strict Fullscreen Override ── */
        html, body, #__next {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #020612 !important;
        }

        body {
          user-select: none;
        }

        .tv-fullscreen-container {
          width: 100vw;
          height: 100vh;
          background: #020612;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tv-canvas {
          box-sizing: border-box;
        }

        /* ── Modern Full Background Photo Cards ── */
        .tv-card-full-photo {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          height: 370px;
          max-width: 390px;
          margin: 0 auto;
          width: 100%;
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(20px);
          transition: all 0.4s cubic-bezier(0.2, 1, 0.2, 1);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 22px;
          box-sizing: border-box;
          animation: cardEnter 0.5s cubic-bezier(0.2, 1, 0.2, 1) backwards;
          will-change: transform, opacity;
        }

        .tv-card-photo-blur-backdrop {
          position: absolute;
          inset: -15px;
          width: calc(100% + 30px);
          height: calc(100% + 30px);
          object-fit: cover;
          z-index: 0;
          filter: blur(28px) brightness(0.32);
          pointer-events: none;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.2, 1);
        }

        .tv-card-photo-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          z-index: 1;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.2, 1);
        }

        .tv-card-photo-bg-initials {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 96px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          z-index: 0;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.2, 1);
        }

        .tv-card-full-photo:hover .tv-card-photo-bg,
        .tv-card-full-photo:hover .tv-card-photo-blur-backdrop,
        .tv-card-full-photo:hover .tv-card-photo-bg-initials {
          transform: scale(1.06);
        }

        .tv-card-full-photo:hover {
          transform: translateY(-4px);
        }

        /* Ambient Glow Shadows & Aura Pulsing */
        .tv-card-normal-glow {
          border-color: rgba(6, 182, 212, 0.15);
          animation: cardEnter 0.5s cubic-bezier(0.2, 1, 0.2, 1) backwards, auraPulseNormal 3.2s ease-in-out infinite;
        }
        .tv-card-normal-glow:hover {
          border-color: rgba(6, 182, 212, 0.6);
          box-shadow: 0 20px 48px rgba(6, 182, 212, 0.35), 0 0 35px rgba(6, 182, 212, 0.25);
        }

        .tv-card-urgent-glow {
          border-color: rgba(239, 68, 68, 0.3);
          animation: cardEnter 0.5s cubic-bezier(0.2, 1, 0.2, 1) backwards, auraPulseUrgent 2s ease-in-out infinite, cardFloatUrgent 4s ease-in-out infinite;
        }
        .tv-card-urgent-glow:hover {
          border-color: rgba(239, 68, 68, 0.75);
          box-shadow: 0 20px 48px rgba(239, 68, 68, 0.45), 0 0 40px rgba(239, 68, 68, 0.3);
        }

        @keyframes auraPulseNormal {
          0%, 100% {
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 12px rgba(6, 182, 212, 0.22), inset 0 0 8px rgba(6, 182, 212, 0.08);
            border-color: rgba(6, 182, 212, 0.15);
          }
          50% {
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 38px rgba(6, 182, 212, 0.75), inset 0 0 20px rgba(6, 182, 212, 0.35);
            border-color: rgba(6, 182, 212, 0.65);
          }
        }

        @keyframes auraPulseUrgent {
          0%, 100% {
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 15px rgba(239, 68, 68, 0.25), inset 0 0 10px rgba(239, 68, 68, 0.12);
            border-color: rgba(239, 68, 68, 0.3);
          }
          50% {
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 48px rgba(239, 68, 68, 0.88), inset 0 0 25px rgba(239, 68, 68, 0.45);
            border-color: rgba(239, 68, 68, 0.88);
          }
        }

        @keyframes cardFloatUrgent {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        /* Dense Black Linear Gradient Overlay */
        .tv-card-gradient-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(2, 6, 23, 0.98) 0%,
            rgba(2, 6, 23, 0.8) 40%,
            rgba(2, 6, 23, 0.35) 70%,
            transparent 100%
          );
          z-index: 2;
          pointer-events: none;
        }

        /* ── Modern Animated Vertical Separator Line ── */
        .tv-vertical-neon-separator {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: 15px;
          bottom: 15px;
          width: 3px;
          background: linear-gradient(
            to bottom,
            rgba(0, 210, 255, 0.02) 0%,
            rgba(0, 210, 255, 0.3) 25%,
            rgba(0, 210, 255, 0.3) 75%,
            rgba(0, 210, 255, 0.02) 100%
          );
          box-shadow: 0 0 10px rgba(0, 210, 255, 0.12);
          z-index: 5;
          pointer-events: none;
          overflow: hidden;
          border-radius: 4px;
        }

        .tv-vertical-neon-separator::after {
          content: '';
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 150px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 210, 255, 0.8),
            #ffffff,
            rgba(0, 210, 255, 0.8),
            transparent
          );
          box-shadow: 0 0 15px rgba(0, 210, 255, 0.95), 
                      0 0 30px rgba(0, 210, 255, 0.6),
                      0 0 45px rgba(0, 210, 255, 0.3);
          border-radius: 4px;
          animation: laserTravel 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes laserTravel {
          0% {
            top: -150px;
          }
          100% {
            top: 100%;
          }
        }

        /* Top Right Status Badges */
        .tv-card-tag-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 4;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.05em;
          color: #fff;
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .badge-waiting {
          background: #10b981;
        }

        .badge-urgent {
          background: #ef4444;
          animation: pulseUrgent 1.2s infinite alternate;
        }

        /* Text overlay containers */
        .tv-card-text-content {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .tv-card-name-one-line {
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.02em;
          font-family: 'Outfit', sans-serif;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .tv-card-class-badge-modern {
          align-self: flex-start;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          border: 1.5px solid;
          letter-spacing: 0.02em;
          background: rgba(255, 255, 255, 0.04);
          font-family: 'Outfit', sans-serif;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        }

        .tv-card-footer-modern {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 4px;
          font-family: 'Outfit', sans-serif;
        }

        .tv-card-guardian-text {
          font-size: 13px;
          font-weight: 800;
          color: #e2e8f0;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        /* Connection status */
        .tv-realtime-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        /* Ambient blobs */
        .bg-blobs {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.25;
          animation: floatBlob 25s infinite alternate ease-in-out;
        }
        .blob-1 { top: -10%; left: -10%; width: 500px; height: 500px; background: rgba(6, 182, 212, 0.25); }
        .blob-2 { bottom: -10%; right: -10%; width: 600px; height: 600px; background: rgba(99, 102, 241, 0.2); animation-delay: -12s; }

        @keyframes floatBlob {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(10%, 10%) scale(1.15); }
        }

        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pulseUrgent {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.05); opacity: 0.85; }
        }

        .tv-pulse-icon {
          animation: pulseUrgent 1.2s infinite alternate;
        }

        /* ── Skeletons ── */
        .skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }
        .skeleton-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
          animation: shimmerSweep 1.6s infinite;
        }
        @keyframes shimmerSweep {
          100% { transform: translateX(100%); }
        }

        @keyframes tagPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.1); opacity: 1; }
        }

        @keyframes rippleEmit {
          0% { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        /* ── Modern Secondary List Styles (Bottom Grid) ── */
        .tv-secondary-card-item {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(15, 23, 42, 0.45);
          border: 1.5px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 12px 18px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          backdrop-filter: blur(10px);
          animation: cardEnter 0.4s ease-out backwards;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          transition: all 0.3s cubic-bezier(0.2, 1, 0.2, 1);
        }

        .tv-secondary-card-item:hover {
          transform: translateY(-2px);
          border-color: rgba(168, 85, 247, 0.3);
          box-shadow: 0 10px 24px rgba(168, 85, 247, 0.1);
        }

        .tv-secondary-card-avatar {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0f172a;
        }

        .tv-secondary-card-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .tv-secondary-card-initials {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
          color: #fff;
        }

        .tv-secondary-card-name {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
        }

        .tv-secondary-card-class {
          font-size: 11px;
          font-weight: 800;
          border: 1px solid;
          padding: 1px 6px;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .tv-secondary-card-guardian {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
          text-transform: uppercase;
        }

        .tv-secondary-card-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          margin-left: auto;
          background: rgba(255, 255, 255, 0.04);
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        /* Custom Violet Scrollbars */
        .custom-tv-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-tv-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-tv-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.35);
          border-radius: 10px;
        }
        .custom-tv-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.6);
        }

        /* TV Spin Animation */
        @keyframes tvSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .tv-spin {
          animation: tvSpin 1.2s linear infinite;
        }
      ` }} />
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
