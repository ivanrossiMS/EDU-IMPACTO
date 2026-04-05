'use client'

import React, { useState } from 'react'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { ArrowLeft, Send } from 'lucide-react'

type Props = {
  templateId: string
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export function ReportFiller({ templateId, onNavigate }: Props) {
  const { templates, records, setRecords, addLog } = useRelatorios()
  const { adAlert } = useAgendaDigital()
  
  const tpl = templates.find(t => t.id === templateId)
  
  const [formData, setFormData] = useState<Record<string, any>>({})
  
  if (!tpl) return <div style={{ padding: 40, textAlign: 'center' }}>Modelo não encontrado.</div>

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev[fieldId] || []
      const next = checked ? [...current, option] : current.filter((x: string) => x !== option)
      return { ...prev, [fieldId]: next }
    })
  }

  const handleSubmit = () => {
    // Basic required validation
    const missing: string[] = []
    tpl.sections.forEach(sec => {
      sec.fields.forEach(f => {
        if (f.required && !formData[f.id]) missing.push(f.label)
        if (f.required && Array.isArray(formData[f.id]) && formData[f.id].length === 0) missing.push(f.label)
      })
    })

    if (missing.length > 0) {
      return adAlert(`Por favor, preencha os campos obrigatórios:\n- ${missing.join('\n- ')}`, 'Existem Pendências')
    }

    const newRecord = {
      id: `REC-${Date.now()}`,
      templateId: tpl.id,
      version: tpl.version,
      author: 'Colaborador (Mock)',
      data: formData,
      status: 'pendente' as const,
      createdAt: new Date().toISOString()
    }

    setRecords(prev => [newRecord, ...prev])
    addLog('Preenchimento', `Relatório enviado: ${tpl.name}`)
    adAlert('Formulário preenchido e registrado com sucesso!', 'Pronto')
    onNavigate('list')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--bg-main))', margin: '-24px -24px 0 -24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <button className="btn btn-ghost" style={{ padding: '8px', marginRight: 16 }} onClick={() => onNavigate('list')}><ArrowLeft size={20} /></button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Preenchimento</h2>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Modo de visualização (Teste)</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: 'hsl(var(--bg-main))' }}>
        <div className="card" style={{ width: '100%', maxWidth: 640, overflow: 'hidden', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 16, background: tpl.color }} />
          <div style={{ padding: 32, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
             <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit', margin: '0 0 12px 0' }}>{tpl.name}</h1>
             <p style={{ fontSize: 15, color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.6 }}>{tpl.description}</p>
          </div>

          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 40 }}>
            {tpl.sections.map(sec => (
              <div key={sec.id}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: 'hsl(var(--text-main))', paddingBottom: 8, borderBottom: '2px solid rgba(0,0,0,0.05)' }}>{sec.title}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {sec.fields.map(f => {
                    // Check Conditional Rules
                    if (f.conditionalRule) {
                       const { fieldId, operator, value } = f.conditionalRule
                       const dependentVal = formData[fieldId]
                       if (operator === 'equals' && dependentVal !== value) return null
                       if (operator === 'not_equals' && dependentVal === value) return null
                       if (operator === 'contains' && !(dependentVal || []).includes(value)) return null
                    }

                    return (
                      <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 15, fontWeight: 600 }}>
                          {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>
                        {f.description && <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{f.description}</div>}
                        
                        {f.type === 'texto-curto' && <input className="form-input" style={{ width: '100%', fontSize: 15 }} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => handleFieldChange(f.id, e.target.value)} />}
                        
                        {f.type === 'texto-longo' && <textarea className="form-input" style={{ width: '100%', fontSize: 15 }} rows={4} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => handleFieldChange(f.id, e.target.value)} />}
                        
                        {f.type === 'unica-escolha' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            {f.options?.map(opt => (
                              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, cursor: 'pointer', padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, background: formData[f.id] === opt ? 'rgba(99,102,241,0.05)' : 'transparent', outline: formData[f.id] === opt ? '1px solid #4f46e5' : 'none' }}>
                                <input type="radio" style={{ width: 18, height: 18 }} checked={formData[f.id] === opt} onChange={() => handleFieldChange(f.id, opt)} /> 
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}

                        {f.type === 'multipla-escolha' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            {f.options?.map(opt => {
                               const isChecked = (formData[f.id] || []).includes(opt)
                               return (
                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, cursor: 'pointer', padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, background: isChecked ? 'rgba(99,102,241,0.05)' : 'transparent', outline: isChecked ? '1px solid #4f46e5' : 'none' }}>
                                  <input type="checkbox" style={{ width: 18, height: 18 }} checked={isChecked} onChange={e => handleCheckboxChange(f.id, opt, e.target.checked)} /> 
                                  {opt}
                                </label>
                               )
                            })}
                          </div>
                        )}
                        
                        {f.type === 'numero' && <input type="number" className="form-input" style={{ width: '100%', fontSize: 15 }} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => handleFieldChange(f.id, e.target.value)} />}
                        
                        {/* Any other unsupported mock type falls back to short text text representation or notice */}
                        {!['texto-curto', 'texto-longo', 'unica-escolha', 'multipla-escolha', 'numero'].includes(f.type) && (
                           <div style={{ padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 8, border: '1px dashed hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                             [Input '{f.type}' simulado para preenchimento]
                           </div>
                        )}
                      </div>
                    )
                  })}
                  {sec.fields.length === 0 && <span style={{ color: 'hsl(var(--text-muted))' }}>Sem campos na seção.</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 32, background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
             <button className="btn btn-ghost" onClick={() => onNavigate('list')}>Descartar</button>
             <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 16 }} onClick={handleSubmit}>
                <Send size={18} /> Enviar (Submit)
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
