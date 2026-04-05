'use client'

import React, { useState, useEffect } from 'react'
import { useRelatorios, ReportTemplate, ReportSection, ReportField, FieldType } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { 
  ArrowLeft, Save, Eye, Smartphone, Monitor, Plus, GripVertical, 
  Trash2, Edit3, Type, CheckSquare, Hash, AlignLeft, CheckCircle2, 
  ChevronDown, List, Calendar, Clock, DollarSign, Percent, FileText, 
  Image as ImageIcon, PenTool, LayoutTemplate, Copy
} from 'lucide-react'

type Props = {
  templateId: string | null
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

const FIELD_TYPES: { type: FieldType, label: string, icon: any }[] = [
  { type: 'texto-curto', label: 'Texto Curto', icon: <Type size={16}/> },
  { type: 'texto-longo', label: 'Texto Longo (Parágrafo)', icon: <AlignLeft size={16}/> },
  { type: 'unica-escolha', label: 'Seleção Única (Rádio)', icon: <CheckCircle2 size={16}/> },
  { type: 'multipla-escolha', label: 'Múltipla Escolha', icon: <CheckSquare size={16}/> },
  { type: 'sim-nao', label: 'Sim ou Não', icon: <ChevronDown size={16}/> },
  { type: 'numero', label: 'Número', icon: <Hash size={16}/> },
  { type: 'moeda', label: 'Moeda (R$)', icon: <DollarSign size={16}/> },
  { type: 'percentual', label: 'Percentual (%)', icon: <Percent size={16}/> },
  { type: 'data', label: 'Data', icon: <Calendar size={16}/> },
  { type: 'hora', label: 'Hora', icon: <Clock size={16}/> },
  { type: 'checklist', label: 'Checklist / Tarefas', icon: <List size={16}/> },
  { type: 'nota', label: 'Nota / Escala (1-5)', icon: <StarIcon /> },
  { type: 'imagem', label: 'Upload de Imagem', icon: <ImageIcon size={16}/> },
  { type: 'arquivo', label: 'Upload de Arquivo', icon: <FileText size={16}/> },
  { type: 'assinatura', label: 'Assinatura Digital', icon: <PenTool size={16}/> },
  { type: 'repetidor', label: 'Bloco Repetidor (Itens)', icon: <LayoutTemplate size={16}/> }
]

function StarIcon() { return <span style={{fontSize:16}}>★</span> }

export function ReportBuilder({ templateId, onNavigate }: Props) {
  const { templates, setTemplates, addLog } = useRelatorios()
  const { adAlert, adConfirm } = useAgendaDigital()
  
  const [tpl, setTpl] = useState<ReportTemplate>({
    id: `TPL-${Date.now()}`,
    name: 'Novo Relatório Customizado',
    description: '',
    category: 'Geral',
    icon: 'FileText',
    color: '#4f46e5',
    status: 'rascunho',
    permissions: { view: ['todos'], fill: ['todos'], edit: ['admin'], approve: ['admin'] },
    version: 1,
    sections: [{ id: `SEC-${Date.now()}`, title: 'Seção Inicial', fields: [] }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin'
  })

  useEffect(() => {
    if (templateId) {
      const existing = templates.find(t => t.id === templateId)
      if (existing) setTpl(JSON.parse(JSON.stringify(existing))) // clone
    }
  }, [templateId, templates])

  const [leftTab, setLeftTab] = useState<'config' | 'secoes'>('secoes')
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop')

  // Editor Modal State
  const [editingField, setEditingField] = useState<{sectionId: string, field: ReportField} | null>(null)

  const handleSave = (asDraft: boolean) => {
    if (!tpl.name) return adAlert('O relatório requer um nome!', 'Erro ao Salvar')
    
    setTemplates(prev => {
      const finalTpl: ReportTemplate = { ...tpl, status: asDraft ? 'rascunho' : 'ativo', updatedAt: new Date().toISOString() }
      if (templateId) {
         // Verifying if structural changes occurred (basic implementation forces new version if Active)
         const existingOriginal = prev.find(x => x.id === templateId)
         if (existingOriginal?.status === 'ativo' && !asDraft) {
            finalTpl.version = existingOriginal.version + 1
         }
         addLog('Edição de Relatório', `Relatório atualizado: ${finalTpl.name} (v${finalTpl.version})`)
         return prev.map(x => x.id === templateId ? finalTpl : x)
      } else {
         addLog('Criação de Relatório', `Novo Relatório: ${finalTpl.name}`)
         return [finalTpl, ...prev]
      }
    })
    
    adAlert(`Relatório salvo como ${asDraft ? 'rascunho' : 'ativo'} com sucesso!`, 'Salvo')
    onNavigate('list')
  }

  // Build Functions
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
      required: false,
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

  const duplicateField = (secId: string, field: ReportField) => {
    const dup = { ...field, id: `F-${Date.now()}`, label: `${field.label} (Cópia)` }
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === secId ? { ...s, fields: [...s.fields, dup] } : s)
    }))
  }

  // Simulating Drag and Drop Ordering using simple move up/down
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
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Builder do Relatório</h2>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{templateId ? 'Editando versão ativa (Gerará v'+(tpl.version + (tpl.status==='ativo'?1:0))+')' : 'Novo Relatório Premium'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', padding: 4, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
            <button title="Visão Mobile" className={`btn btn-sm ${previewMode === 'mobile' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setPreviewMode('mobile')}><Smartphone size={16}/></button>
            <button title="Visão Desktop" className={`btn btn-sm ${previewMode === 'desktop' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setPreviewMode('desktop')}><Monitor size={16}/></button>
          </div>
          <button className="btn btn-ghost" onClick={() => handleSave(true)}>Salvar Rascunho</button>
          <button className="btn btn-primary" onClick={() => handleSave(false)}><Save size={16} /> Salvar e Efetivar</button>
        </div>
      </div>

      {/* 3 Columns Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Settings & Palette */}
        <div style={{ width: 320, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <button className={`tab-trigger ${leftTab === 'config' ? 'active' : ''}`} style={{ flex: 1, padding: 12 }} onClick={() => setLeftTab('config')}>Configurações</button>
            <button className={`tab-trigger ${leftTab === 'secoes' ? 'active' : ''}`} style={{ flex: 1, padding: 12 }} onClick={() => setLeftTab('secoes')}>Campos</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {leftTab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="form-label">Nome do Relatório</label><input className="form-input" value={tpl.name} onChange={e => setTpl(p=>({...p, name: e.target.value}))}/></div>
                <div><label className="form-label">Categoria</label><input className="form-input" value={tpl.category} onChange={e => setTpl(p=>({...p, category: e.target.value}))}/></div>
                <div><label className="form-label">Descrição (Apoio)</label><textarea className="form-input" value={tpl.description} onChange={e => setTpl(p=>({...p, description: e.target.value}))} rows={3}/></div>
                <div><label className="form-label">Cor de Indicação</label><input type="color" className="form-input" value={tpl.color} onChange={e => setTpl(p=>({...p, color: e.target.value}))} style={{ padding: 4, height: 40 }}/></div>
                <hr style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}/>
                <h4 style={{ fontWeight: 600, margin: 0 }}>Permissões & Segurança</h4>
                <div><label className="form-label">Quem pode preencher?</label><select className="form-input" value={tpl.permissions.fill[0]} onChange={e => setTpl(p=>({...p, permissions: {...p.permissions, fill: [e.target.value]}}))}><option value="todos">Todos (Visível p/ todos)</option><option value="professores">Apenas Professores</option><option value="admin">Apenas Administração</option></select></div>
              </div>
            )}
            
            {leftTab === 'secoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Clique em um campo abaixo para adicioná-lo à última seção aberta.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIELD_TYPES.map(ft => (
                    <button 
                      key={ft.type} 
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => {
                        const secId = tpl.sections[tpl.sections.length - 1]?.id
                        if (!secId) return adAlert('Adicione uma seção primeiro.', 'Aviso')
                        addField(secId, ft.type)
                      }}
                    >
                      <div style={{ color: tpl.color }}>{ft.icon}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Canvas (Drag & Drop / Reorder) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.03)', position: 'relative' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)'}}>
             <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>Estrutura do Formulário (Fluxo Central)</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
               
               {tpl.sections.map((sec, sIdx) => (
                 <div key={sec.id} className="card" style={{ overflow: 'visible', outline: '2px solid transparent' }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'hsl(var(--bg-main))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                     <input 
                       className="form-input" 
                       style={{ fontSize: 18, fontWeight: 800, background: 'transparent', border: 'none', padding: 0 }} 
                       value={sec.title} 
                       onChange={e => setTpl(p => ({...p, sections: p.sections.map(s => s.id === sec.id ? {...s, title: e.target.value} : s)}))}
                     />
                     <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeSection(sec.id)}><Trash2 size={16}/></button>
                   </div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {sec.fields.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhum campo nesta seção. Adicione pelo menu à esquerda.</div>}
                     {sec.fields.map((f, fIdx) => (
                       <div key={f.id} style={{ display: 'flex', padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', gap: 12 }}>
                         <div style={{ cursor: 'move', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                           <button style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => moveField(sec.id, fIdx, true)}>↑</button>
                           <GripVertical size={16} />
                           <button style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => moveField(sec.id, fIdx, false)}>↓</button>
                         </div>
                         <div style={{ flex: 1 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}</h4>
                             <span className="badge badge-ghost" style={{ fontSize: 11 }}>{FIELD_TYPES.find(t => t.type === f.type)?.label}</span>
                           </div>
                           {f.description && <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>{f.description}</p>}
                           
                           {/* Quick preview placeholder */}
                           <div style={{ marginTop: 12, opacity: 0.6, pointerEvents: 'none' }}>
                             {f.type === 'texto-curto' && <input className="form-input" style={{ width: '100%', height: 32 }} placeholder={f.placeholder || 'Resposta curta'} />}
                             {f.type === 'texto-longo' && <textarea className="form-input" style={{ width: '100%' }} rows={2} placeholder={f.placeholder || 'Resposta detalhada'} />}
                             {['unica-escolha', 'multipla-escolha'].includes(f.type) && (
                               <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                 {f.options?.map(opt => <div key={opt} className="badge badge-ghost"><div style={{ width:10,height:10,borderRadius:(f.type==='unica-escolha'?'50%':4),border:'1px solid #ccc' }}/> {opt}</div>)}
                               </div>
                             )}
                           </div>
                           
                           {f.conditionalRule && (
                             <div style={{ marginTop: 12, fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                               ⚠️ Rule: Mostrar se campo "{f.conditionalRule.fieldId}" {f.conditionalRule.operator} "{f.conditionalRule.value}"
                             </div>
                           )}
                         </div>
                         
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                           <button className="btn btn-ghost btn-sm" onClick={() => setEditingField({sectionId: sec.id, field: f})}><Edit3 size={14}/></button>
                           <button className="btn btn-ghost btn-sm" onClick={() => duplicateField(sec.id, f)}><Copy size={14}/></button>
                           <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeField(sec.id, f.id)}><Trash2 size={14}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                   
                   <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.02)', textAlign: 'center' }}>
                     <button className="btn btn-ghost btn-sm text-muted" onClick={() => { setLeftTab('secoes') }}>Adicionar Campo Aqui</button>
                   </div>
                 </div>
               ))}
               
               <button className="btn btn-secondary" style={{ borderStyle: 'dashed', padding: 24 }} onClick={addSection}>+ Adicionar Nova Seção</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-time Preview */}
        <div style={{ width: previewMode === 'mobile' ? 375 : 500, background: 'hsl(var(--bg-surface))', borderLeft: '1px solid hsl(var(--border-subtle))', transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 20px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: tpl.color, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Eye size={20} />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Visualização ({previewMode})</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: previewMode === 'mobile' ? 16 : 32, background: 'hsl(var(--bg-main))' }}>
            {/* The Filler Preview Component Mock */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 12, background: tpl.color }} />
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
                          
                          {f.type === 'texto-curto' && <input className="form-input" style={{ width: '100%' }} placeholder={f.placeholder} disabled />}
                          {f.type === 'texto-longo' && <textarea className="form-input" style={{ width: '100%' }} placeholder={f.placeholder} disabled rows={3} />}
                          {f.type === 'unica-escolha' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {f.options?.map(opt => <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="radio" disabled /> {opt}</label>)}
                            </div>
                          )}
                          {f.type === 'multipla-escolha' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {f.options?.map(opt => <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="checkbox" disabled /> {opt}</label>)}
                            </div>
                          )}
                          {f.type === 'sim-nao' && (
                            <div style={{ display: 'flex', gap: 12 }}>
                               <button className="btn btn-secondary btn-sm" disabled style={{ flex: 1 }}>Sim</button>
                               <button className="btn btn-secondary btn-sm" disabled style={{ flex: 1 }}>Não</button>
                            </div>
                          )}
                          {f.type === 'imagem' && <div style={{ border: '2px dashed hsl(var(--border-subtle))', padding: 24, borderRadius: 8, textAlign: 'center', color: 'hsl(var(--text-muted))' }}><ImageIcon size={24} style={{ margin: '0 auto' }}/><br/>Anexar Imagem</div>}
                          {/* Outros tipos são renderizados de forma padronizada p prévia */}
                          {!['texto-curto', 'texto-longo', 'unica-escolha', 'multipla-escolha', 'sim-nao', 'imagem'].includes(f.type) && (
                             <input className="form-input" style={{ width: '100%' }} placeholder={`Campo: ${f.type}`} disabled />
                          )}
                        </div>
                      ))}
                      {sec.fields.length === 0 && <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhum campo...</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 24, background: 'rgba(0,0,0,0.02)', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                 <button className="btn btn-primary" style={{ width: '100%', background: tpl.color, border: 'none' }} disabled>Enviar Respostas</button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FIELD EDITOR MODAL */}
      {editingField && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="card" style={{ width: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
               <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Configurar Campo</h3>
                   <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Tipo: {FIELD_TYPES.find(t=>t.type===editingField.field.type)?.label}</div>
                 </div>
               </div>
               
               <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div><label className="form-label">Pergunta / Título do Campo</label><input className="form-input" value={editingField.field.label} onChange={e => updateEditingField({label: e.target.value})}/></div>
                 <div><label className="form-label">Descrição Auxiliar (opcional)</label><textarea className="form-input" rows={2} value={editingField.field.description || ''} onChange={e => updateEditingField({description: e.target.value})}/></div>
                 
                 {['texto-curto', 'texto-longo', 'numero'].includes(editingField.field.type) && (
                   <div><label className="form-label">Placeholder (Texto fantasma)</label><input className="form-input" value={editingField.field.placeholder || ''} onChange={e => updateEditingField({placeholder: e.target.value})}/></div>
                 )}
                 
                 {['unica-escolha', 'multipla-escolha'].includes(editingField.field.type) && (
                   <div>
                     <label className="form-label">Opções de Resposta</label>
                     <textarea className="form-input" rows={4} value={(editingField.field.options || []).join('\n')} onChange={e => updateEditingField({options: e.target.value.split('\n')})} placeholder="Uma opção por linha"/>
                     <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Pressione Enter para separar opções.</div>
                   </div>
                 )}
                 
                 <hr style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}/>
                 <h4 style={{ fontWeight: 600, margin: 0 }}>Comportamento</h4>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                   <input type="checkbox" checked={editingField.field.required} onChange={e => updateEditingField({required: e.target.checked})} style={{ width: 18, height: 18 }} /> Campo Obrigatório
                 </label>
                 
               </div>
               
               <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button className="btn btn-secondary" onClick={() => setEditingField(null)}>Cancelar</button>
                 <button className="btn btn-primary" onClick={saveFieldSettings}>Pronto</button>
               </div>
            </div>
         </div>
      )}
    </div>
  )
}
