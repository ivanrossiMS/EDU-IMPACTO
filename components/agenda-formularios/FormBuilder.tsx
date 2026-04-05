'use client'

import React, { useState, useEffect } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { ReportSection, ReportField, FieldType } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { 
  ArrowLeft, Save, Eye, Smartphone, Monitor, Plus, GripVertical, 
  Trash2, Edit3, Type, CheckSquare, Hash, AlignLeft, CheckCircle2, 
  ChevronDown, List, Calendar, Clock, DollarSign, Percent, FileText, 
  Image as ImageIcon, PenTool, LayoutTemplate, Copy
} from 'lucide-react'

type Props = {
  formId: string | null
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler' | 'sender', id?: string | null) => void
}

const FIELD_TYPES: { type: FieldType, label: string, icon: any }[] = [
  { type: 'texto-curto', label: 'Texto Curto', icon: <Type size={16}/> },
  { type: 'texto-longo', label: 'Texto Longo (Parágrafo)', icon: <AlignLeft size={16}/> },
  { type: 'unica-escolha', label: 'Seleção Única (Rádio)', icon: <CheckCircle2 size={16}/> },
  { type: 'multipla-escolha', label: 'Múltipla Escolha', icon: <CheckSquare size={16}/> },
  { type: 'sim-nao', label: 'Sim ou Não', icon: <ChevronDown size={16}/> },
  { type: 'numero', label: 'Número', icon: <Hash size={16}/> },
  { type: 'data', label: 'Data', icon: <Calendar size={16}/> },
  { type: 'hora', label: 'Hora', icon: <Clock size={16}/> },
  { type: 'imagem', label: 'Solicitar Upload (Foto/Doc)', icon: <ImageIcon size={16}/> }
]

export function FormBuilder({ formId, onNavigate }: Props) {
  const { forms, setForms } = useFormularios()
  const { adAlert, adConfirm } = useAgendaDigital()
  
  const [tpl, setTpl] = useState<FormTemplate>({
    id: `FRM-${Date.now()}`,
    name: 'Novo Formulário para Alunos',
    description: '',
    category: 'Geral',
    status: 'rascunho',
    requireSignature: true,
    version: 1,
    sections: [{ id: `SEC-${Date.now()}`, title: 'Dados do Formulário', fields: [] }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin'
  })

  useEffect(() => {
    if (formId) {
      const existing = forms.find(t => t.id === formId)
      if (existing) setTpl(JSON.parse(JSON.stringify(existing)))
    }
  }, [formId, forms])

  const [leftTab, setLeftTab] = useState<'config' | 'secoes'>('secoes')
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile')
  const [editingField, setEditingField] = useState<{sectionId: string, field: ReportField} | null>(null)

  const handleSave = (asDraft: boolean) => {
    if (!tpl.name) return adAlert('O formulário requer um nome!', 'Erro ao Salvar')
    
    setForms(prev => {
      const finalTpl: FormTemplate = { ...tpl, status: asDraft ? 'rascunho' : 'ativo', updatedAt: new Date().toISOString() }
      if (formId) {
         const existingOriginal = prev.find(x => x.id === formId)
         if (existingOriginal?.status === 'ativo' && !asDraft) {
            finalTpl.version = existingOriginal.version + 1
         }
         return prev.map(x => x.id === formId ? finalTpl : x)
      } else {
         return [finalTpl, ...prev]
      }
    })
    
    adAlert(`Formulário salvo como ${asDraft ? 'rascunho' : 'ativo'} com sucesso!`, 'Salvo')
    onNavigate('list')
  }

  const addSection = () => {
    setTpl(prev => ({
      ...prev,
      sections: [...prev.sections, { id: `SEC-${Date.now()}`, title: 'Nova Seção', fields: [] }]
    }))
  }

  const removeSection = (secId: string) => {
    adConfirm('Deseja excluir esta seção e todos os seus campos?', 'Atenção', () => {
      setTpl(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== secId) }))
    })
  }

  const addField = (secId: string, type: FieldType) => {
    const newField: ReportField = {
      id: `F-${Date.now()}`,
      type,
      label: 'Novo Campo',
      required: true,
    }
    if (['unica-escolha', 'multipla-escolha', 'sim-nao'].includes(type)) {
       newField.options = ['Opção 1', 'Opção 2']
    }
    
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === secId ? { ...s, fields: [...s.fields, newField] } : s)
    }))
    setEditingField({ sectionId: secId, field: newField })
  }

  const updateEditingField = (updates: Partial<ReportField>) => {
    setEditingField(prev => prev ? { ...prev, field: { ...prev.field, ...updates } } : null)
  }

  const saveFieldSettings = () => {
    if (!editingField) return
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === editingField.sectionId ? {
        ...s,
        fields: s.fields.map(f => f.id === editingField.field.id ? editingField.field : f)
      } : s)
    }))
    setEditingField(null)
  }

  const removeField = (secId: string, fieldId: string) => {
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === secId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s)
    }))
  }

  const copyField = (secId: string, field: ReportField) => {
    const dup = { ...field, id: `F-${Date.now()}`, label: `${field.label} (Cópia)` }
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === secId ? { ...s, fields: [...s.fields, dup] } : s)
    }))
  }

  const moveField = (secId: string, fieldIndex: number, up: boolean) => {
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== secId) return s
        const f = [...s.fields]
        if (up && fieldIndex > 0) {
          [f[fieldIndex], f[fieldIndex - 1]] = [f[fieldIndex - 1], f[fieldIndex]]
        } else if (!up && fieldIndex < f.length - 1) {
          [f[fieldIndex], f[fieldIndex + 1]] = [f[fieldIndex + 1], f[fieldIndex]]
        }
        return { ...s, fields: f }
      })
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--bg-main))', margin: '-24px -24px 0 -24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => onNavigate('list')}><ArrowLeft size={20} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Builder de Formulário</h2>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{formId ? 'Editando versão' : 'Novo Formulário para Familiares'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', padding: 4, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
            <button className={`btn btn-sm ${previewMode === 'mobile' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setPreviewMode('mobile')}><Smartphone size={16}/></button>
            <button className={`btn btn-sm ${previewMode === 'desktop' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setPreviewMode('desktop')}><Monitor size={16}/></button>
          </div>
          <button className="btn btn-ghost" onClick={() => handleSave(true)}>Salvar Rascunho</button>
          <button className="btn btn-primary" onClick={() => handleSave(false)}><Save size={16} /> Salvar e Ativar Formulário</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Settings & Palette */}
        <div style={{ width: 320, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <button className={`tab-trigger ${leftTab === 'config' ? 'active' : ''}`} style={{ flex: 1, padding: 12 }} onClick={() => setLeftTab('config')}>Configurações Gerais</button>
            <button className={`tab-trigger ${leftTab === 'secoes' ? 'active' : ''}`} style={{ flex: 1, padding: 12 }} onClick={() => setLeftTab('secoes')}>Campos para Adicionar</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {leftTab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="form-label">Título do Formulário</label><input className="form-input" value={tpl.name} onChange={e => setTpl(p=>({...p, name: e.target.value}))}/></div>
                <div><label className="form-label">Categoria</label><input className="form-input" value={tpl.category} onChange={e => setTpl(p=>({...p, category: e.target.value}))} placeholder="Ex: Autorizações, Saúde..."/></div>
                <div><label className="form-label">Descrição Textual (para os Pais)</label><textarea className="form-input" value={tpl.description} onChange={e => setTpl(p=>({...p, description: e.target.value}))} rows={4}/></div>
                
                <hr style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}/>
                <h4 style={{ fontWeight: 600, margin: 0 }}>Termo Legal / Assinatura</h4>
                
                <label style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
                   <input type="checkbox" checked={tpl.requireSignature} onChange={e => setTpl(p=>({...p, requireSignature: e.target.checked}))} style={{ marginTop: 4, width: 20, height: 20 }} /> 
                   <div>
                     <strong style={{ display: 'block', fontSize: 13 }}>Exigir Assinatura Digital do Responsável</strong>
                     <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: '4px 0 0 0', lineHeight: 1.4 }}>O aplicativo exigirá biometria/senha do pai para injetar validade jurídica nas respostas na hora de enviar.</p>
                   </div>
                </label>
              </div>
            )}
            
            {leftTab === 'secoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Componentes disponíveis para arrastar/inserir:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIELD_TYPES.map(ft => (
                    <button 
                      key={ft.type} 
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => {
                        const secId = tpl.sections[tpl.sections.length - 1]?.id
                        if (!secId) return adAlert('Adicione uma seção de perguntas primeiro.', 'Aviso')
                        addField(secId, ft.type)
                      }}
                    >
                      <div style={{ color: '#4f46e5' }}>{ft.icon}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)'}}>
             <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>Estrutura (Arraste para Reordenar)</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
               
               {tpl.sections.map((sec, sIdx) => (
                 <div key={sec.id} className="card" style={{ overflow: 'visible' }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'hsl(var(--bg-main))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                     <input 
                       className="form-input" 
                       style={{ fontSize: 16, fontWeight: 800, background: 'transparent', border: 'none', padding: 0 }} 
                       value={sec.title} 
                       onChange={e => setTpl(p => ({...p, sections: p.sections.map(s => s.id === sec.id ? {...s, title: e.target.value} : s)}))}
                     />
                     <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeSection(sec.id)}><Trash2 size={16}/></button>
                   </div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {sec.fields.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Seção vazia.</div>}
                     {sec.fields.map((f, fIdx) => (
                       <div key={f.id} style={{ display: 'flex', padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', gap: 12 }}>
                         <div style={{ cursor: 'move', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                           <button style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => moveField(sec.id, fIdx, true)}>↑</button>
                           <GripVertical size={16} />
                           <button style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => moveField(sec.id, fIdx, false)}>↓</button>
                         </div>
                         <div style={{ flex: 1 }}>
                           <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}</h4>
                           {f.description && <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>{f.description}</p>}
                           <div style={{ marginTop: 12, opacity: 0.5, pointerEvents: 'none' }}>
                             <span className="badge badge-ghost" style={{ fontSize: 10 }}>[ {FIELD_TYPES.find(t => t.type === f.type)?.label} ]</span>
                           </div>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                           <button className="btn btn-ghost btn-sm" onClick={() => setEditingField({sectionId: sec.id, field: f})}><Edit3 size={14}/></button>
                           <button className="btn btn-ghost btn-sm" onClick={() => copyField(sec.id, f)}><Copy size={14}/></button>
                           <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeField(sec.id, f.id)}><Trash2 size={14}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               
               <button className="btn btn-secondary" style={{ borderStyle: 'dashed', padding: 24 }} onClick={addSection}>+ Adicionar Novo Bloco de Perguntas</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-time Preview */}
        <div style={{ width: previewMode === 'mobile' ? 375 : 500, background: 'hsl(var(--bg-surface))', borderLeft: '1px solid hsl(var(--border-subtle))', transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 20px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Eye size={20} />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Visão do Familiar ({previewMode})</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: previewMode === 'mobile' ? 16 : 32, background: 'hsl(var(--bg-main))' }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 12, background: '#4f46e5' }} />
              <div style={{ padding: 24, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit', margin: '0 0 8px 0' }}>{tpl.name}</h1>
                <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', margin: 0 }}>{tpl.description}</p>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
                {tpl.sections.map(sec => (
                  <div key={'p'+sec.id}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'hsl(var(--text-main))' }}>{sec.title}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {sec.fields.map(f => (
                        <div key={'pf'+f.id}>
                          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}</label>
                          {f.description && <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{f.description}</div>}
                          {/* Renderização Realística do Preview */}
                          {['texto-curto', 'texto-longo', 'numero', 'data', 'hora'].includes(f.type) && (
                            <input 
                              className="form-input" 
                              disabled 
                              placeholder={`Campo de ${f.type}`}
                              style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed' }}
                            />
                          )}
                          
                          {f.type === 'unica-escolha' && f.options?.map(op => (
                            <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, marginBottom: 8, opacity: 0.7 }}>
                               <input type="radio" disabled style={{ width: 18, height: 18 }} />
                               <span>{op}</span>
                            </label>
                          ))}

                          {f.type === 'sim-nao' && (
                            <div style={{ display: 'flex', gap: 12, opacity: 0.7 }}>
                               <button className="btn btn-secondary" disabled style={{ flex: 1 }}>Sim</button>
                               <button className="btn btn-secondary" disabled style={{ flex: 1 }}>Não</button>
                            </div>
                          )}

                          {f.type === 'multipla-escolha' && f.options?.map(op => (
                            <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, marginBottom: 8, opacity: 0.7 }}>
                              <input type="checkbox" disabled style={{ width: 18, height: 18 }} />
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {tpl.requireSignature && (
                  <div style={{ padding: 24, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                     <div style={{ color: '#10b981' }}><PenTool size={32}/></div>
                     <div>
                       <div style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>Assinatura Digital Exigida</div>
                       <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>No app, o pai confirmará a identidade antes de enviar.</div>
                     </div>
                  </div>
                )}

              </div>
              <div style={{ padding: 24, background: 'rgba(0,0,0,0.02)', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                 <button className="btn btn-primary" style={{ width: '100%', background: '#4f46e5', border: 'none' }} disabled>Concluir e Assinar</button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {editingField && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="card" style={{ width: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
               <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Configurar Pergunta</h3>
                 </div>
               </div>
               
               <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div><label className="form-label">Texto da Pergunta</label><input className="form-input" value={editingField.field.label} onChange={e => updateEditingField({label: e.target.value})}/></div>
                 <div><label className="form-label">Instrução extra (opcional)</label><textarea className="form-input" rows={2} value={editingField.field.description || ''} onChange={e => updateEditingField({description: e.target.value})}/></div>
                 
                 {['unica-escolha', 'multipla-escolha'].includes(editingField.field.type) && (
                   <div>
                     <label className="form-label">Opções</label>
                     <textarea className="form-input" rows={4} value={(editingField.field.options || []).join('\n')} onChange={e => updateEditingField({options: e.target.value.split('\n')})} placeholder="Uma opção por linha"/>
                   </div>
                 )}
                 <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                   <input type="checkbox" checked={editingField.field.required} onChange={e => updateEditingField({required: e.target.checked})} style={{ width: 18, height: 18 }} /> Resposta Obrigatória
                 </label>
               </div>
               
               <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button className="btn btn-secondary" onClick={() => setEditingField(null)}>Cancelar</button>
                 <button className="btn btn-primary" onClick={saveFieldSettings}>Confirmar</button>
               </div>
            </div>
         </div>
      )}
    </div>
  )
}
