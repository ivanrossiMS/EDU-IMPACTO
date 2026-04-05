'use client'
import { useState, useEffect } from 'react'
import { PickupCall } from '@/lib/saidaContext'
import { GraduationCap, Megaphone } from 'lucide-react'

interface Props {
  call: PickupCall
  onConfirm?: (id: string) => void
  onRecall?: (id: string) => void
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function elapsedSec(since: string) {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000)
}

export function MonitorCard({ call, onConfirm, onRecall }: Props) {
  const [secs, setSecs] = useState(elapsedSec(call.calledAt))
  const [recalling, setRecalling] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => setSecs(elapsedSec(call.calledAt)), 1000)
    return () => clearInterval(iv)
  }, [call.calledAt])

  const mins = Math.floor(secs / 60)
  const isUrgent = secs > 120 // 2+ minutes

  const initials = call.studentName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const color = isUrgent ? '#f59e0b' : '#06b6d4'

  const handleRecall = () => {
    if (!onRecall) return
    setRecalling(true)
    onRecall(call.id)
    setTimeout(() => setRecalling(false), 2000)
  }

  return (
    <div style={{
      background: 'linear-gradient(160deg, hsl(var(--bg-elevated)), hsl(var(--bg-base)))',
      border: `2px solid ${color}40`,
      borderRadius: 24, padding: '28px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      boxShadow: `0 8px 40px ${color}20`,
      animation: 'slideUp 0.4s ease',
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.5s',
    }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }}/>

      {/* Avatar */}
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}50, ${color}20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 36, color: '#fff',
        border: `4px solid ${color}50`,
        boxShadow: `0 0 30px ${color}30`,
      }}>
        {initials}
      </div>

      {/* Name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontWeight: 900, fontSize: 22,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '-0.02em', lineHeight: 1.2,
          marginBottom: 6,
        }}>{call.studentName}</div>

        {/* Class badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 14px', borderRadius: 100,
          background: `${color}12`, color, fontWeight: 800, fontSize: 13,
          border: `1px solid ${color}30`,
        }}>
          <GraduationCap size={14}/> {call.studentClass}
        </div>
      </div>

      {/* Guardian */}
      <div style={{
        fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center',
        fontWeight: 600,
      }}>
        👤 {call.guardianName}
      </div>

      {/* Timer */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4, fontWeight: 700 }}>
          CHAMADO ÀS
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, color }}>
          {fmtTime(call.calledAt)}
        </div>
        {mins > 0 && (
          <div style={{ fontSize: 11, color: isUrgent ? '#f59e0b' : 'hsl(var(--text-muted))', marginTop: 4 }}>
            {isUrgent ? '⚠️' : '⏱'} {mins}m {secs % 60}s aguardando
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(onConfirm || onRecall) && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Confirmar */}
          {onConfirm && (
            <button
              onClick={() => onConfirm(call.id)}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'opacity 0.15s',
              }}>
              ✓ Confirmar Saída
            </button>
          )}

          {/* Chamar Novamente */}
          {onRecall && (
            <button
              onClick={handleRecall}
              disabled={recalling}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 12,
                background: recalling
                  ? 'rgba(99,102,241,0.05)'
                  : 'rgba(99,102,241,0.1)',
                border: `1px solid ${recalling ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.4)'}`,
                color: recalling ? 'hsl(var(--text-muted))' : '#818cf8',
                fontWeight: 700, fontSize: 13,
                cursor: recalling ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.2s',
              }}>
              <Megaphone size={14}/>
              {recalling ? 'Chamando...' : 'Chamar Novamente'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
