'use client'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 440, md: 580, lg: 780 }

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ zIndex: 1000 }}
    >
      <div
        ref={ref}
        className="modal"
        style={{ maxWidth: widths[size], width: '100%', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

interface Field {
  key: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  options?: string[]
  placeholder?: string
  required?: boolean
}

interface FormModalProps<T extends Record<string, unknown>> {
  open: boolean
  onClose: () => void
  title: string
  fields: Field[]
  values: T
  onChange: (key: string, value: unknown) => void
  onSubmit: () => void
  submitLabel?: string
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function FormModal<T extends Record<string, unknown>>({
  open, onClose, title, fields, values, onChange, onSubmit, submitLabel = 'Salvar', loading, size = 'md',
}: FormModalProps<T>) {
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit() }

  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {f.label}
              {f.required && <span style={{ color: '#ef4444', fontSize: 12 }}>*</span>}
            </label>
            {f.type === 'select' ? (
              <select
                className="form-input"
                value={String(values[f.key] ?? '')}
                onChange={e => onChange(f.key, e.target.value)}
                required={f.required}
              >
                <option value="">Selecione...</option>
                {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                className="form-input"
                rows={3}
                placeholder={f.placeholder}
                value={String(values[f.key] ?? '')}
                onChange={e => onChange(f.key, e.target.value)}
                required={f.required}
              />
            ) : f.type === 'checkbox' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={e => onChange(f.key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                />
                <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{f.placeholder || ''}</span>
              </div>
            ) : (
              <input
                className="form-input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={String(values[f.key] ?? '')}
                onChange={e => onChange(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                required={f.required}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Reusable confirm delete dialog */
export function ConfirmModal({
  open, onClose, onConfirm, title = 'Confirmar exclusão', message, loading,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; message?: string; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', marginBottom: 20 }}>
        {message || 'Esta ação não pode ser desfeita. Tem certeza?'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={onConfirm} disabled={loading}>
          {loading ? 'Excluindo...' : 'Excluir'}
        </button>
      </div>
    </Modal>
  )
}

/** Generic empty state component */
export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
      {icon && <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>{title}</div>
      {description && <div style={{ fontSize: 13, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>{description}</div>}
      {action}
    </div>
  )
}
