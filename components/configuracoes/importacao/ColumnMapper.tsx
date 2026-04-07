'use client'
import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'

interface FieldDef { key: string; label: string; required?: boolean; aliases: string[] }

interface Props {
  headers: string[]
  fields: FieldDef[]
  onSave: (mapping: Record<string, string>) => void
  initialMapping?: Record<string, string>
}

export function ColumnMapper({ headers, fields, onSave, initialMapping = {} }: Props) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping)

  const unmappedHeaders = headers.filter(h => !Object.keys(mapping).includes(h))
  const mappedFields = Object.values(mapping)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Coluna do Arquivo</div>
        <div />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Campo do Sistema</div>
      </div>

      {headers.map(h => (
        <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
            {h}
          </div>
          <ArrowRight size={14} color="hsl(var(--text-muted))" style={{ flexShrink: 0 }} />
          <select
            className="form-input"
            value={mapping[h] || ''}
            onChange={e => {
              const val = e.target.value
              setMapping(prev => {
                const next = { ...prev }
                if (!val) { delete next[h]; return next }
                // Remove if another header uses same field
                Object.keys(next).forEach(k => { if (next[k] === val && k !== h) delete next[k] })
                next[h] = val
                return next
              })
            }}
            style={{ fontSize: 12 }}
          >
            <option value="">— Ignorar esta coluna —</option>
            {fields.map(f => (
              <option key={f.key} value={f.key} disabled={mappedFields.includes(f.key) && mapping[h] !== f.key}>
                {f.required ? '* ' : ''}{f.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
          {Object.keys(mapping).length} colunas mapeadas · {fields.filter(f => f.required && !mappedFields.includes(f.key)).length} obrigatórios faltando
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {fields.filter(f => f.required && !mappedFields.includes(f.key)).length > 0 && (
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Campos obrigatórios: {fields.filter(f => f.required && !mappedFields.includes(f.key)).map(f => f.label).join(', ')}
            </div>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onSave(mapping)}
            disabled={fields.filter(f => f.required && !mappedFields.includes(f.key)).length > 0}
          >
            <Check size={13} /> Confirmar Mapeamento
          </button>
        </div>
      </div>
    </div>
  )
}
