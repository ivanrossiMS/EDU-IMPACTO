'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, CheckCircle, Info, XCircle, X, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm'

export interface DialogOptions {
  type?: DialogType
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

interface UiDialogProps extends DialogOptions {
  isConfirm: boolean
  onOk: () => void
  onCancel: () => void
}

// ─── Config per type ──────────────────────────────────────────────────────────

const configs: Record<DialogType, { icon: React.ReactNode; color: string; bg: string; border: string; title: string }> = {
  info: {
    icon: <Info size={24} strokeWidth={1.8} />,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    title: 'Informação',
  },
  success: {
    icon: <CheckCircle size={24} strokeWidth={1.8} />,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
    title: 'Sucesso',
  },
  warning: {
    icon: <AlertTriangle size={24} strokeWidth={1.8} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    title: 'Atenção',
  },
  error: {
    icon: <XCircle size={24} strokeWidth={1.8} />,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    title: 'Erro',
  },
  confirm: {
    icon: <AlertTriangle size={24} strokeWidth={1.8} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    title: 'Confirmar',
  },
}

// Detect type from message content
function detectType(message: string): DialogType {
  const m = message.toLowerCase()
  if (m.includes('erro') || m.includes('error') || m.includes('falh') || m.includes('inválid')) return 'error'
  if (m.includes('sucesso') || m.includes('export') || m.includes('import') || m.includes('copiado') || m.includes('✅') || m.includes('👍')) return 'success'
  if (m.includes('atenção') || m.includes('atenção') || m.includes('não é possível') || m.includes('já existe') || m.includes('⚠️') || m.includes('bloqueada')) return 'warning'
  return 'info'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UiDialog({ type, title, message, isConfirm, confirmLabel, cancelLabel, onOk, onCancel }: UiDialogProps) {
  const resolvedType = type || (isConfirm ? 'confirm' : detectType(message))
  const cfg = configs[resolvedType]
  const resolvedTitle = title || cfg.title

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !isConfirm) onOk()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isConfirm, onOk, onCancel])

  // Format message: preserve \n
  const lines = message.split('\n')

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 12, 30, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        .uidialog-ok:hover { opacity: 0.88 !important; transform: translateY(-1px) !important; }
        .uidialog-cancel:hover { background: hsl(var(--bg-overlay)) !important; }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'hsl(var(--bg-base))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 24,
          maxWidth: 460,
          width: '100%',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 4,
          background: `linear-gradient(90deg, ${cfg.color}aa, ${cfg.color})`,
        }} />

        {/* Header */}
        <div style={{
          padding: '24px 28px 0 28px',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color, flexShrink: 0,
          }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{
              fontSize: 16, fontWeight: 800,
              color: 'hsl(var(--text-base))',
              letterSpacing: -0.3, lineHeight: 1.2,
              marginBottom: 8,
            }}>
              {resolvedTitle}
            </div>
            <div style={{
              fontSize: 13.5, color: 'hsl(var(--text-muted))',
              lineHeight: 1.6,
            }}>
              {lines.map((line, i) => (
                <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '20px 28px 24px',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          {isConfirm && (
            <button
              className="uidialog-cancel"
              onClick={onCancel}
              style={{
                padding: '9px 20px', borderRadius: 12,
                border: '1px solid hsl(var(--border-subtle))',
                background: 'transparent',
                color: 'hsl(var(--text-muted))',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {cancelLabel || 'Cancelar'}
            </button>
          )}
          <button
            className="uidialog-ok"
            onClick={onOk}
            autoFocus
            style={{
              padding: '9px 24px', borderRadius: 12,
              background: cfg.color,
              color: '#fff',
              border: 'none',
              fontSize: 13, fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 16px ${cfg.color}44`,
            }}
          >
            {isConfirm ? <Check size={14} /> : null}
            {confirmLabel || (isConfirm ? 'Confirmar' : 'Ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
