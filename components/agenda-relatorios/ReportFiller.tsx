'use client'

import React, { useState } from 'react'
import { useRelatorios } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { ArrowLeft, Send, Plus, Trash2, Star } from 'lucide-react'

type Props = {
  templateId: string
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export function ReportFiller({ templateId, onNavigate }: Props) {
  const { templates, setRecords, addLog } = useRelatorios()
  const { adAlert } = useAgendaDigital()
  const { currentUser } = useApp()
  
  const tpl = templates.find(t => t.id === templateId)
  
  const [formData, setFormData] = useState<Record<string, any>>({})
  
  if (!tpl) return <div style={{ padding: 40, textAlign: 'center' }}>Modelo não encontrado.</div>

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev }
      if (value === '' || value === undefined || value === null) {
        delete next[fieldId]
      } else {
        next[fieldId] = value
      }
      return next
    })
  }

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev[fieldId] || []
      const next = checked ? [...current, option] : current.filter((x: string) => x !== option)
      return { ...prev, [fieldId]: next }
    })
  }

  const handleFileChange = (fieldId: string, file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      handleFieldChange(fieldId, {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: typeof reader.result === 'string' ? reader.result : ''
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    // Basic required validation
    const missing: string[] = []
    tpl.sections.forEach(sec => {
      sec.fields.forEach(f => {
        if (f.required && (formData[f.id] === undefined || formData[f.id] === null || formData[f.id] === '')) {
          missing.push(f.label)
        } else if (f.required && Array.isArray(formData[f.id]) && formData[f.id].length === 0) {
          missing.push(f.label)
        }
      })
    })

    if (missing.length > 0) {
      return adAlert(`Por favor, preencha os campos obrigatórios:\n- ${missing.join('\n- ')}`, 'Existem Pendências')
    }

    const newRecord = {
      id: `REC-${Date.now()}`,
      templateId: tpl.id,
      version: tpl.version,
      author: currentUser?.nome || 'Colaborador',
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
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Preencha os campos do relatório abaixo</div>
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
                            {f.options?.map(opt => {
                              const isSelected = formData[f.id] === opt;
                              return (
                                <div 
                                  key={opt} 
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleFieldChange(f.id, isSelected ? '' : opt)}
                                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFieldChange(f.id, isSelected ? '' : opt); } }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, cursor: 'pointer', padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, background: isSelected ? 'rgba(99,102,241,0.05)' : 'transparent', outline: isSelected ? '1px solid #4f46e5' : 'none', userSelect: 'none' }}
                                >
                                  <input type="radio" style={{ width: 18, height: 18, pointerEvents: 'none' }} checked={isSelected} readOnly /> 
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {(f.type === 'multipla-escolha' || f.type === 'checklist') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            {(f.options && f.options.length > 0 ? f.options : ['Concluído']).map(opt => {
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

                        {f.type === 'sim-nao' && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                            {['Sim', 'Não'].map(opt => {
                              const isSelected = formData[f.id] === opt
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleFieldChange(f.id, isSelected ? '' : opt)}
                                  className="btn"
                                  style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 8,
                                    border: `1px solid ${isSelected ? '#4f46e5' : 'hsl(var(--border-subtle))'}`,
                                    background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    color: isSelected ? '#4f46e5' : 'hsl(var(--text-main))',
                                    fontWeight: isSelected ? 700 : 500
                                  }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {f.type === 'moeda' && (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>R$</span>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              style={{ width: '100%', paddingLeft: 40, fontSize: 15 }}
                              placeholder={f.placeholder || '0,00'}
                              value={formData[f.id] || ''}
                              onChange={e => handleFieldChange(f.id, e.target.value)}
                            />
                          </div>
                        )}

                        {f.type === 'percentual' && (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              className="form-input"
                              style={{ width: '100%', paddingRight: 36, fontSize: 15 }}
                              placeholder={f.placeholder || '0'}
                              value={formData[f.id] || ''}
                              onChange={e => handleFieldChange(f.id, e.target.value)}
                            />
                            <span style={{ position: 'absolute', right: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>%</span>
                          </div>
                        )}

                        {f.type === 'data' && (
                          <input
                            type="date"
                            className="form-input"
                            style={{ width: '100%', fontSize: 15 }}
                            value={formData[f.id] || ''}
                            onChange={e => handleFieldChange(f.id, e.target.value)}
                          />
                        )}

                        {f.type === 'hora' && (
                          <input
                            type="time"
                            className="form-input"
                            style={{ width: '100%', fontSize: 15 }}
                            value={formData[f.id] || ''}
                            onChange={e => handleFieldChange(f.id, e.target.value)}
                          />
                        )}

                        {f.type === 'nota' && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            {[1, 2, 3, 4, 5].map(star => {
                              const currentNota = Number(formData[f.id] || 0)
                              const active = star <= currentNota
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleFieldChange(f.id, currentNota === star ? '' : star)}
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    border: `1px solid ${active ? '#f59e0b' : 'hsl(var(--border-subtle))'}`,
                                    background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                                    color: active ? '#f59e0b' : 'hsl(var(--text-muted))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontWeight: 700
                                  }}
                                >
                                  <Star size={18} fill={active ? '#f59e0b' : 'none'} />
                                </button>
                              )
                            })}
                            {formData[f.id] && <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginLeft: 8 }}>{formData[f.id]} / 5</span>}
                          </div>
                        )}

                        {(f.type === 'imagem' || f.type === 'arquivo') && (
                          <div style={{ padding: 16, border: '1px dashed hsl(var(--border-subtle))', borderRadius: 10, background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <input
                              type="file"
                              accept={f.type === 'imagem' ? 'image/*' : undefined}
                              onChange={e => handleFileChange(f.id, e.target.files?.[0])}
                            />
                            {formData[f.id]?.name && (
                              <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                                Selecionado: {formData[f.id].name}
                              </div>
                            )}
                          </div>
                        )}

                        {f.type === 'assinatura' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '100%', fontSize: 16, fontFamily: 'cursive, serif', fontStyle: 'italic' }}
                              placeholder="Digite seu nome completo para assinar digitalmente"
                              value={formData[f.id] || ''}
                              onChange={e => handleFieldChange(f.id, e.target.value)}
                            />
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Assinatura eletrônica registrada com data e hora no envio.</span>
                          </div>
                        )}

                        {f.type === 'repetidor' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {((formData[f.id] as string[]) || ['']).map((itemVal: string, idx: number) => (
                              <div key={idx} style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ flex: 1, fontSize: 14 }}
                                  placeholder={f.placeholder || `Item ${idx + 1}`}
                                  value={itemVal}
                                  onChange={e => {
                                    const arr = [...((formData[f.id] as string[]) || [''])]
                                    arr[idx] = e.target.value
                                    handleFieldChange(f.id, arr)
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    const arr = ((formData[f.id] as string[]) || ['']).filter((_, i) => i !== idx)
                                    handleFieldChange(f.id, arr.length > 0 ? arr : undefined)
                                  }}
                                >
                                  <Trash2 size={15} color="#ef4444" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
                              onClick={() => {
                                const arr = [...((formData[f.id] as string[]) || []), '']
                                handleFieldChange(f.id, arr)
                              }}
                            >
                              <Plus size={14} /> Adicionar Item
                            </button>
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
