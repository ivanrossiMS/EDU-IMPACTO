'use client'
import { motion, AnimatePresence } from 'framer-motion';

import React, { useState, useEffect } from 'react'
import { useRelatorios, ReportTemplate, ReportSection, ReportField, FieldType } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { 
  ArrowLeft, Save, Eye, Smartphone, Monitor, Plus, GripVertical, 
  Trash2, Edit3, Type, CheckSquare, Hash, AlignLeft, CheckCircle2, 
  ChevronDown, ChevronUp, List, Calendar, Clock, DollarSign, Percent, FileText, 
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

  // Section drag & active state
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [draggedSecIdx, setDraggedSecIdx] = useState<number | null>(null)
  const [dragOverSecIdx, setDragOverSecIdx] = useState<number | null>(null)
  const [dropSecPosition, setDropSecPosition] = useState<'before' | 'after' | null>(null)

  // Field drag state
  const [draggedField, setDraggedField] = useState<{ secId: string; fIdx: number } | null>(null)
  const [dragOverField, setDragOverField] = useState<{ secId: string; fIdx: number; position: 'before' | 'after' } | null>(null)
  const [dragOverEmptySecId, setDragOverEmptySecId] = useState<string | null>(null)

  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!activeSectionId && tpl.sections.length > 0) {
      setActiveSectionId(tpl.sections[0].id)
    }
  }, [tpl.sections, activeSectionId])

  const toggleCollapse = (secId: string) => {
    setCollapsedSections(prev => ({ ...prev, [secId]: !prev[secId] }))
  }

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

  // Section Build & Reorder Functions
  const addSection = () => {
    const newSec: ReportSection = { id: `SEC-${Date.now()}`, title: 'Nova Seção', fields: [] }
    setTpl(prev => ({
      ...prev,
      sections: [...prev.sections, newSec]
    }))
    setActiveSectionId(newSec.id)
  }

  const removeSection = (secId: string) => {
    adConfirm('Deseja excluir esta seção e todos os seus campos?', 'Atenção', () => {
      setTpl(prev => {
        const next = prev.sections.filter(s => s.id !== secId)
        if (activeSectionId === secId) {
          setActiveSectionId(next[0]?.id || null)
        }
        return { ...prev, sections: next }
      })
    })
  }

  const duplicateSection = (secId: string) => {
    const sec = tpl.sections.find(s => s.id === secId)
    if (!sec) return
    const cloned: ReportSection = {
      id: `SEC-${Date.now()}`,
      title: `${sec.title} (Cópia)`,
      fields: sec.fields.map(f => ({
        ...f,
        id: `F-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      }))
    }
    const secIndex = tpl.sections.findIndex(s => s.id === secId)
    setTpl(prev => {
      const next = [...prev.sections]
      next.splice(secIndex + 1, 0, cloned)
      return { ...prev, sections: next }
    })
    setActiveSectionId(cloned.id)
  }

  const moveSection = (index: number, up: boolean) => {
    const targetIdx = up ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= tpl.sections.length) return
    setTpl(prev => {
      const next = [...prev.sections]
      const [moved] = next.splice(index, 1)
      next.splice(targetIdx, 0, moved)
      return { ...prev, sections: next }
    })
  }

  const reorderSections = (fromIndex: number, toIndex: number, position: 'before' | 'after') => {
    if (fromIndex === toIndex) return
    setTpl(prev => {
      const next = [...prev.sections]
      const [moved] = next.splice(fromIndex, 1)
      let target = toIndex
      if (fromIndex < toIndex) {
        target = target - 1
      }
      if (position === 'after') {
        target += 1
      }
      next.splice(target, 0, moved)
      return { ...prev, sections: next }
    })
  }

  // Section Drag Event Handlers
  const handleSecDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `section:${index}`)
    setDraggedSecIdx(index)
  }

  const handleSecDragOver = (e: React.DragEvent, index: number) => {
    if (draggedSecIdx === null) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const offset = e.clientY - rect.top
    const isAfter = offset > rect.height / 2
    setDragOverSecIdx(index)
    setDropSecPosition(isAfter ? 'after' : 'before')
  }

  const handleSecDrop = (e: React.DragEvent, index: number) => {
    if (draggedSecIdx === null) return
    e.preventDefault()
    e.stopPropagation()

    if (draggedSecIdx !== null && dropSecPosition !== null) {
      reorderSections(draggedSecIdx, index, dropSecPosition)
    }
    setDraggedSecIdx(null)
    setDragOverSecIdx(null)
    setDropSecPosition(null)
  }

  const handleSecDragEnd = () => {
    setDraggedSecIdx(null)
    setDragOverSecIdx(null)
    setDropSecPosition(null)
  }

  // Field Functions
  const addField = (secId: string, type: FieldType) => {
    const targetId = secId || activeSectionId || tpl.sections[tpl.sections.length - 1]?.id
    if (!targetId) return adAlert('Adicione uma seção primeiro.', 'Aviso')

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
      sections: prev.sections.map(s => s.id === targetId ? { ...s, fields: [...s.fields, newField] } : s)
    }))
    
    setActiveSectionId(targetId)
    setEditingField({ sectionId: targetId, field: newField })
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

  const moveFieldBetween = (fromSecId: string, fromIdx: number, toSecId: string, toIdx: number, position: 'before' | 'after') => {
    setTpl(prev => {
      const sourceSec = prev.sections.find(s => s.id === fromSecId)
      if (!sourceSec) return prev
      const fieldToMove = sourceSec.fields[fromIdx]
      if (!fieldToMove) return prev

      const nextSections = prev.sections.map(s => {
        if (s.id === fromSecId && s.id === toSecId) {
          const f = [...s.fields]
          const [moved] = f.splice(fromIdx, 1)
          let target = toIdx
          if (fromIdx < toIdx) target -= 1
          if (position === 'after') target += 1
          f.splice(target, 0, moved)
          return { ...s, fields: f }
        }
        if (s.id === fromSecId) {
          return { ...s, fields: s.fields.filter((_, idx) => idx !== fromIdx) }
        }
        if (s.id === toSecId) {
          const f = [...s.fields]
          let target = toIdx
          if (position === 'after') target += 1
          f.splice(target, 0, fieldToMove)
          return { ...s, fields: f }
        }
        return s
      })

      return { ...prev, sections: nextSections }
    })
  }

  const moveFieldToSectionEnd = (fromSecId: string, fromIdx: number, toSecId: string) => {
    setTpl(prev => {
      const sourceSec = prev.sections.find(s => s.id === fromSecId)
      if (!sourceSec) return prev
      const fieldToMove = sourceSec.fields[fromIdx]
      if (!fieldToMove) return prev

      const nextSections = prev.sections.map(s => {
        if (s.id === fromSecId && s.id === toSecId) return s
        if (s.id === fromSecId) {
          return { ...s, fields: s.fields.filter((_, idx) => idx !== fromIdx) }
        }
        if (s.id === toSecId) {
          return { ...s, fields: [...s.fields, fieldToMove] }
        }
        return s
      })
      return { ...prev, sections: nextSections }
    })
  }

  // Field Drag Event Handlers
  const handleFieldDragStart = (e: React.DragEvent, secId: string, fIdx: number) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `field:${secId}:${fIdx}`)
    setDraggedField({ secId, fIdx })
  }

  const handleFieldDragOver = (e: React.DragEvent, secId: string, fIdx: number) => {
    if (!draggedField) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const offset = e.clientY - rect.top
    const isAfter = offset > rect.height / 2
    setDragOverField({ secId, fIdx, position: isAfter ? 'after' : 'before' })
  }

  const handleFieldDrop = (e: React.DragEvent, targetSecId: string, targetFIdx: number) => {
    if (!draggedField) return
    e.preventDefault()
    e.stopPropagation()

    if (dragOverField) {
      moveFieldBetween(
        draggedField.secId,
        draggedField.fIdx,
        targetSecId,
        targetFIdx,
        dragOverField.position
      )
    }
    setDraggedField(null)
    setDragOverField(null)
    setDragOverEmptySecId(null)
  }

  const handleFieldDragEnd = () => {
    setDraggedField(null)
    setDragOverField(null)
    setDragOverEmptySecId(null)
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
                {/* Target Section Selector */}
                <div style={{ 
                  background: 'hsl(var(--bg-main))', 
                  padding: '12px 14px', 
                  borderRadius: 10, 
                  border: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Destino do Novo Campo:
                  </label>
                  <select 
                    className="form-input" 
                    style={{ fontSize: 13, fontWeight: 600, height: 36, padding: '4px 8px' }}
                    value={activeSectionId || (tpl.sections[0]?.id || '')}
                    onChange={e => setActiveSectionId(e.target.value)}
                  >
                    {tpl.sections.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        Seção {idx + 1}: {s.title || '(Sem título)'}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    Clique em um campo abaixo para inseri-lo na seção selecionada.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIELD_TYPES.map(ft => (
                    <button 
                      key={ft.type} 
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease' }}
                      onClick={() => {
                        const secId = activeSectionId || tpl.sections[tpl.sections.length - 1]?.id
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
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>Estrutura do Formulário (Fluxo Central)</h3>
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: '2px 0 0 0' }}>Arraste seções e campos pelo ícone de alça para organizar o formulário</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={addSection} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Nova Seção
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
               
               {tpl.sections.map((sec, sIdx) => {
                 const isCollapsed = collapsedSections[sec.id]
                 const isActive = activeSectionId === sec.id

                 return (
                   <div key={sec.id} style={{ display: 'flex', flexDirection: 'column' }}>
                     {/* Drag target indicator ABOVE this section */}
                     {dragOverSecIdx === sIdx && draggedSecIdx !== null && draggedSecIdx !== sIdx && dropSecPosition === 'before' && (
                       <div style={{ height: 4, background: '#4f46e5', borderRadius: 2, margin: '6px 0', boxShadow: '0 0 10px rgba(79,70,229,0.7)', position: 'relative', zIndex: 10 }}>
                         <div style={{ position: 'absolute', left: -4, top: -4, width: 12, height: 12, borderRadius: '50%', background: '#4f46e5', boxShadow: '0 0 6px rgba(79,70,229,0.8)' }} />
                       </div>
                     )}

                     <div
                       className="card"
                       onDragOver={e => handleSecDragOver(e, sIdx)}
                       onDrop={e => handleSecDrop(e, sIdx)}
                       style={{
                         overflow: 'visible',
                         outline: isActive ? '2px solid rgba(79,70,229,0.4)' : '2px solid transparent',
                         opacity: draggedSecIdx === sIdx ? 0.35 : 1,
                         transform: draggedSecIdx === sIdx ? 'scale(0.99)' : 'none',
                         boxShadow: isActive ? '0 8px 24px -6px rgba(79,70,229,0.12)' : undefined,
                         transition: 'all 0.15s ease'
                       }}
                     >
                       {/* Header */}
                       <div style={{ 
                         display: 'flex', 
                         alignItems: 'center', 
                         justifyContent: 'space-between', 
                         padding: '14px 18px', 
                         background: 'hsl(var(--bg-main))', 
                         borderBottom: '1px solid hsl(var(--border-subtle))',
                         gap: 12
                       }}>
                         {/* Drag Handle + Order badge + Arrows */}
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <div
                             draggable
                             onDragStart={e => handleSecDragStart(e, sIdx)}
                             onDragEnd={handleSecDragEnd}
                             title="Segure e arraste para reposicionar esta seção no formulário"
                             style={{
                               display: 'flex',
                               alignItems: 'center',
                               gap: 6,
                               cursor: draggedSecIdx === sIdx ? 'grabbing' : 'grab',
                               padding: '6px 10px',
                               borderRadius: 8,
                               background: 'hsl(var(--bg-surface))',
                               border: '1px solid hsl(var(--border-subtle))',
                               userSelect: 'none',
                               boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                             }}
                           >
                             <GripVertical size={16} style={{ color: 'hsl(var(--text-muted))' }} />
                             <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'hsl(var(--text-secondary))' }}>
                               Seção {sIdx + 1}
                             </span>
                           </div>

                           <div style={{ display: 'flex', gap: 2 }}>
                             <button
                               type="button"
                               className="btn btn-ghost btn-sm"
                               style={{ padding: '4px 6px', height: 28, width: 28, opacity: sIdx === 0 ? 0.25 : 1 }}
                               disabled={sIdx === 0}
                               onClick={() => moveSection(sIdx, true)}
                               title="Mover seção para cima"
                             >
                               <ChevronUp size={15} />
                             </button>
                             <button
                               type="button"
                               className="btn btn-ghost btn-sm"
                               style={{ padding: '4px 6px', height: 28, width: 28, opacity: sIdx === tpl.sections.length - 1 ? 0.25 : 1 }}
                               disabled={sIdx === tpl.sections.length - 1}
                               onClick={() => moveSection(sIdx, false)}
                               title="Mover seção para baixo"
                             >
                               <ChevronDown size={15} />
                             </button>
                           </div>
                         </div>

                         {/* Title */}
                         <div style={{ flex: 1 }}>
                           <input 
                             className="form-input" 
                             style={{ fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', padding: '4px 8px' }} 
                             placeholder="Nome da Seção..."
                             value={sec.title} 
                             onFocus={() => setActiveSectionId(sec.id)}
                             onChange={e => setTpl(p => ({...p, sections: p.sections.map(s => s.id === sec.id ? {...s, title: e.target.value} : s)}))}
                           />
                         </div>

                         {/* Actions */}
                         <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                           <button 
                             type="button"
                             className="btn btn-ghost btn-sm" 
                             style={{ padding: '4px 8px', height: 30 }}
                             onClick={() => duplicateSection(sec.id)} 
                             title="Duplicar seção"
                           >
                             <Copy size={14}/>
                           </button>
                           <button 
                             type="button"
                             className="btn btn-ghost btn-sm" 
                             style={{ padding: '4px 8px', height: 30 }}
                             onClick={() => toggleCollapse(sec.id)} 
                             title={isCollapsed ? "Expandir seção" : "Recolher seção"}
                           >
                             {isCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                           </button>
                           <button 
                             type="button"
                             className="btn btn-ghost btn-sm" 
                             style={{ color: '#ef4444', padding: '4px 8px', height: 30 }} 
                             onClick={() => removeSection(sec.id)}
                             title="Excluir seção"
                           >
                             <Trash2 size={15}/>
                           </button>
                         </div>
                       </div>
                       
                       {/* Section Body */}
                       {!isCollapsed && (
                         <>
                           <div 
                             style={{ display: 'flex', flexDirection: 'column' }}
                             onDragOver={e => {
                               if (draggedField && sec.fields.length === 0) {
                                 e.preventDefault()
                                 e.dataTransfer.dropEffect = 'move'
                                 setDragOverEmptySecId(sec.id)
                               }
                             }}
                             onDrop={e => {
                               if (draggedField && sec.fields.length === 0) {
                                 e.preventDefault()
                                 e.stopPropagation()
                                 moveFieldToSectionEnd(draggedField.secId, draggedField.fIdx, sec.id)
                                 setDraggedField(null)
                                 setDragOverEmptySecId(null)
                               }
                             }}
                           >
                             {sec.fields.length === 0 && (
                               <div style={{ 
                                 padding: 32, 
                                 textAlign: 'center', 
                                 color: 'hsl(var(--text-muted))', 
                                 fontSize: 13,
                                 border: dragOverEmptySecId === sec.id ? '2px dashed #4f46e5' : 'none',
                                 background: dragOverEmptySecId === sec.id ? 'rgba(79,70,229,0.05)' : 'transparent',
                                 borderRadius: 8,
                                 margin: 8,
                                 transition: 'all 0.2s ease'
                               }}>
                                 {dragOverEmptySecId === sec.id ? 'Solte o campo aqui' : 'Nenhum campo nesta seção. Clique no botão abaixo para adicionar ou arraste campos para cá.'}
                               </div>
                             )}

                             {sec.fields.map((f, fIdx) => (
                               <React.Fragment key={f.id}>
                                 {/* Field drop indicator BEFORE */}
                                 {draggedField && dragOverField?.secId === sec.id && dragOverField?.fIdx === fIdx && dragOverField?.position === 'before' && (
                                   <div style={{ height: 3, background: '#4f46e5', margin: '2px 0', boxShadow: '0 0 6px rgba(79,70,229,0.7)', position: 'relative', zIndex: 10 }}>
                                     <div style={{ position: 'absolute', left: 8, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#4f46e5' }} />
                                   </div>
                                 )}

                                 <div 
                                   onDragOver={e => handleFieldDragOver(e, sec.id, fIdx)}
                                   onDrop={e => handleFieldDrop(e, sec.id, fIdx)}
                                   style={{ 
                                     display: 'flex', 
                                     padding: '16px 20px', 
                                     borderBottom: '1px solid hsl(var(--border-subtle))', 
                                     background: 'hsl(var(--bg-surface))', 
                                     gap: 12,
                                     opacity: draggedField?.secId === sec.id && draggedField?.fIdx === fIdx ? 0.35 : 1,
                                     transition: 'all 0.15s ease'
                                   }}
                                 >
                                   {/* Field drag handle + reorder buttons */}
                                   <div style={{ color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                     <button 
                                       type="button"
                                       style={{ border: 0, background: 'none', cursor: fIdx === 0 ? 'default' : 'pointer', opacity: fIdx === 0 ? 0.25 : 0.7, padding: '2px 4px' }} 
                                       disabled={fIdx === 0}
                                       onClick={() => moveField(sec.id, fIdx, true)}
                                       title="Mover campo para cima"
                                     >
                                       <ChevronUp size={14} />
                                     </button>
                                     <div
                                       draggable
                                       onDragStart={e => handleFieldDragStart(e, sec.id, fIdx)}
                                       onDragEnd={handleFieldDragEnd}
                                       title="Arraste para reposicionar este campo"
                                       style={{ cursor: 'grab', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                     >
                                       <GripVertical size={16} />
                                     </div>
                                     <button 
                                       type="button"
                                       style={{ border: 0, background: 'none', cursor: fIdx === sec.fields.length - 1 ? 'default' : 'pointer', opacity: fIdx === sec.fields.length - 1 ? 0.25 : 0.7, padding: '2px 4px' }} 
                                       disabled={fIdx === sec.fields.length - 1}
                                       onClick={() => moveField(sec.id, fIdx, false)}
                                       title="Mover campo para baixo"
                                     >
                                       <ChevronDown size={14} />
                                     </button>
                                   </div>

                                   <div style={{ flex: 1 }}>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                   
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                     <button className="btn btn-ghost btn-sm" title="Editar configurações do campo" onClick={() => setEditingField({sectionId: sec.id, field: f})}><Edit3 size={14}/></button>
                                     <button className="btn btn-ghost btn-sm" title="Duplicar campo" onClick={() => duplicateField(sec.id, f)}><Copy size={14}/></button>
                                     <button className="btn btn-ghost btn-sm" title="Excluir campo" style={{ color: '#ef4444' }} onClick={() => removeField(sec.id, f.id)}><Trash2 size={14}/></button>
                                   </div>
                                 </div>

                                 {/* Field drop indicator AFTER */}
                                 {draggedField && dragOverField?.secId === sec.id && dragOverField?.fIdx === fIdx && dragOverField?.position === 'after' && (
                                   <div style={{ height: 3, background: '#4f46e5', margin: '2px 0', boxShadow: '0 0 6px rgba(79,70,229,0.7)', position: 'relative', zIndex: 10 }}>
                                     <div style={{ position: 'absolute', left: 8, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#4f46e5' }} />
                                   </div>
                                 )}
                               </React.Fragment>
                             ))}
                           </div>
                           
                           {/* Add Field In This Section */}
                           <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.02)', textAlign: 'center', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                             <button 
                               type="button"
                               className="btn btn-ghost btn-sm" 
                               style={{ color: tpl.color || 'hsl(var(--color-primary))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                               onClick={() => { 
                                 setActiveSectionId(sec.id)
                                 setLeftTab('secoes') 
                               }}
                             >
                               <Plus size={15} /> Adicionar Campo Nesta Seção
                             </button>
                           </div>
                         </>
                       )}
                     </div>

                     {/* Drag target indicator BELOW this section */}
                     {dragOverSecIdx === sIdx && draggedSecIdx !== null && draggedSecIdx !== sIdx && dropSecPosition === 'after' && (
                       <div style={{ height: 4, background: '#4f46e5', borderRadius: 2, margin: '6px 0', boxShadow: '0 0 10px rgba(79,70,229,0.7)', position: 'relative', zIndex: 10 }}>
                         <div style={{ position: 'absolute', left: -4, top: -4, width: 12, height: 12, borderRadius: '50%', background: '#4f46e5', boxShadow: '0 0 6px rgba(79,70,229,0.8)' }} />
                       </div>
                     )}
                   </div>
                 )
               })}
               
               <button 
                 type="button"
                 className="btn btn-secondary" 
                 style={{ borderStyle: 'dashed', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} 
                 onClick={addSection}
               >
                 <Plus size={16} /> Adicionar Nova Seção
               </button>
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

      <AnimatePresence>
{/* FIELD EDITOR MODAL */}
      {editingField && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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
            </motion.div>
         
</motion.div>
)}</AnimatePresence>
    </div>
  )
}
