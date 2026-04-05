'use client'
import { Guardian, GuardianType } from '@/lib/saidaContext'
import { Shield, ShieldOff, Phone, CreditCard } from 'lucide-react'

const TYPE_LABELS: Record<GuardianType | string, string> = {
  mae: 'Mãe', pai: 'Pai', avo: 'Avó/Avô', motorista: 'Motorista', outro: 'Outro',
}
const TYPE_COLORS: Record<GuardianType | string, string> = {
  mae: '#f472b6', pai: '#60a5fa', avo: '#a78bfa', motorista: '#fb923c', outro: '#94a3b8',
}

interface Props {
  guardian: Guardian
  rfidCode?: string
  compact?: boolean
}

export function GuardianCard({ guardian, rfidCode, compact = false }: Props) {
  const color = TYPE_COLORS[guardian.type] ?? '#94a3b8'
  const initials = guardian.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 12,
        background: 'hsl(var(--bg-elevated))',
        border: `1px solid ${color}30`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `${color}20`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 14, color, flexShrink: 0,
        }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{guardian.name}</div>
          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
            {TYPE_LABELS[guardian.type]} {rfidCode && `· RFID ${rfidCode}`}
          </div>
        </div>
        {!guardian.active && (
          <ShieldOff size={14} color="#ef4444" style={{ marginLeft: 'auto' }}/>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}08, transparent)`,
      border: `2px solid ${color}30`,
      borderRadius: 20, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {/* Avatar */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: guardian.photoUrl ? 'transparent' : `linear-gradient(135deg, ${color}40, ${color}20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 26, color,
        flexShrink: 0, overflow: 'hidden',
        border: `3px solid ${color}40`,
      }}>
        {guardian.photoUrl
          ? <img src={guardian.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          : initials
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 20 }}>{guardian.name}</span>
          {guardian.active
            ? <Shield size={16} color="#10b981"/>
            : <ShieldOff size={16} color="#ef4444"/>
          }
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 100,
            background: `${color}15`, color, fontWeight: 700,
            border: `1px solid ${color}30`,
          }}>{TYPE_LABELS[guardian.type]}</span>
          {guardian.document && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              <CreditCard size={11}/> {guardian.document}
            </span>
          )}
          {guardian.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              <Phone size={11}/> {guardian.phone}
            </span>
          )}
          {rfidCode && (
            <span style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600 }}>
              📡 RFID: {rfidCode}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        padding: '6px 14px', borderRadius: 100, fontSize: 11, fontWeight: 700,
        background: guardian.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        color: guardian.active ? '#10b981' : '#ef4444',
        border: `1px solid ${guardian.active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
        flexShrink: 0,
      }}>
        {guardian.active ? '✓ Autorizado' : '✗ Bloqueado'}
      </div>
    </div>
  )
}
