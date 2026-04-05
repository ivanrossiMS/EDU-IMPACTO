'use client'
import { useState, useEffect } from 'react'
import { Volume2, CheckCircle2, AlertTriangle, Megaphone } from 'lucide-react'
import { PickupCall } from '@/lib/saidaContext'

interface Props {
  call: PickupCall
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onRecall: (id: string) => void
}

function elapsed(since: string) {
  const s = Math.floor((Date.now() - new Date(since).getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

export function ActiveCallCard({ call, onConfirm, onCancel, onRecall }: Props) {
  const [time, setTime] = useState(elapsed(call.calledAt))

  useEffect(() => {
    const iv = setInterval(() => setTime(elapsed(call.calledAt)), 1000)
    return () => clearInterval(iv)
  }, [call.calledAt])

  const isWaiting  = call.status === 'waiting'
  const isCalled   = call.status === 'called'
  const accent = isWaiting || isCalled ? '#f59e0b' : '#10b981'

  const initials = call.studentName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div style={{
      background: 'hsl(var(--bg-elevated))',
      border: `1px solid ${accent}35`,
      borderRadius: 16, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow strip */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${accent}, ${accent}60)`,
        borderRadius: '16px 0 0 16px',
      }}/>

      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, #3b82f680, #06b6d480)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 18, color: '#fff',
      }}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{call.studentName}</div>
        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          {call.studentClass} · {call.guardianName}
        </div>
        <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 4 }}>
          ⏱ {time} aguardando
        </div>
      </div>

      {/* Status */}
      <div style={{
        padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700,
        background: `${accent}12`, color: accent, border: `1px solid ${accent}30`,
        flexShrink: 0,
      }}>
        {isWaiting ? '⏳ Aguardando' : isCalled ? '📢 Chamado' : '✅ OK'}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onRecall(call.id)}
          title="Rechamar"
          style={{
            padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(167,139,250,0.3)',
            background: 'rgba(167,139,250,0.08)', color: '#a78bfa',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
          }}>
          <Megaphone size={13}/> Rechamar
        </button>
        <button
          onClick={() => onConfirm(call.id)}
          title="Confirmar saída"
          style={{
            padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(16,185,129,0.3)',
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
          }}>
          <CheckCircle2 size={13}/> Confirmar
        </button>
        <button
          onClick={() => onCancel(call.id)}
          title="Cancelar"
          style={{
            padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.07)', color: '#ef4444',
            cursor: 'pointer', fontSize: 12,
          }}>
          ✕
        </button>
      </div>
    </div>
  )
}
