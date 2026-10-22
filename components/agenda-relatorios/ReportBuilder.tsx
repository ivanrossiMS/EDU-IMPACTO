'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Portal from '@/components/Portal'
import { useRelatorios, ReportTemplate, ReportSection, ReportField, FieldType } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Plus,
  GripVertical,
  Trash2,
  Edit3,
  Type,
  CheckSquare,
  AlignLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  List,
  FileText,
  Image as ImageIcon,
  PenTool,
  Copy,
  Star,
  X,
  Check,
  Sparkles,
  Settings,
  Layers,
  ToggleLeft
} from 'lucide-react'

type Props = {
  templateId: string | null
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export const FIELD_TYPES: {
  type: FieldType
  label: string
  hint: string
  icon: React.ReactNode
}[] = [
  { type: 'texto-curto', label: 'Texto Curto', hint: 'Resposta rápida em uma linha', icon: <Type size={16} /> },
  { type: 'texto-longo', label: 'Texto Longo (Parágrafo)', hint: 'Observações, conteúdos ou detalhes', icon: <AlignLeft size={16} /> },
  { type: 'unica-escolha', label: 'Seleção Única (Rádio)', hint: 'Escolher apenas uma opção', icon: <CheckCircle2 size={16} /> },
  { type: 'multipla-escolha', label: 'Múltipla Escolha', hint: 'Selecionar uma ou mais opções', icon: <CheckSquare size={16} /> },
  { type: 'sim-nao', label: 'Sim ou Não', hint: 'Escolha binária rápida', icon: <ToggleLeft size={16} /> },
  { type: 'checklist', label: 'Checklist / Tarefas', hint: 'Lista de itens de verificação', icon: <List size={16} /> },
  { type: 'nota', label: 'Nota / Escala (1-5)', hint: 'Avaliação por estrelas de 1 a 5', icon: <Star size={16} /> },
  { type: 'imagem', label: 'Upload de Imagem', hint: 'Anexar foto ou imagem', icon: <ImageIcon size={16} /> },
  { type: 'arquivo', label: 'Upload de Arquivo', hint: 'Anexar documento ou PDF', icon: <FileText size={16} /> },
  { type: 'assinatura', label: 'Assinatura Digital', hint: 'Confirmação nominal eletrônica', icon: <PenTool size={16} /> }
]

const PRESET_COLORS = [
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#db2777'
]

const OPTION_PRESETS: { label: string; options: string[] }[] = [
  { label: 'Ótimo / Bom / Regular', options: ['Ótimo', 'Bom', 'Regular'] },
  { label: 'Tudo / Parcial / Recusou', options: ['Comeu tudo', 'Comeu parcialmente', 'Recusou'] },
  { label: 'Feliz / Calmo / Agitado', options: ['Feliz e participativo', 'Calmo', 'Agitado', 'Sonolento'] },
  { label: 'Normal / Líquida / Não evacuou', options: ['Normal', 'Pastosa', 'Líquida', 'Não evacuou'] }
]

function getFieldMeta(type: FieldType) {
  const found = FIELD_TYPES.find(t => t.type === type)
  if (found) return found
  return {
    type,
    label: `Campo (${type})`,
    hint: 'Campo configurado',
    icon: <Type size={16} />
  }
}

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
    sections: [{ id: `SEC-${Date.now()}`, title: '', fields: [] }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin'
  })

  useEffect(() => {
    if (templateId) {
      const existing = templates.find(t => t.id === templateId)
      if (existing) {
        const cloned: ReportTemplate = JSON.parse(JSON.stringify(existing))
        cloned.sections = (cloned.sections || []).map(s => ({ ...s, title: '' }))
        setTpl(cloned)
      }
    }
  }, [templateId, templates])

  const [leftTab, setLeftTab] = useState<'config' | 'secoes'>('secoes')
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop')
  const [showPreview, setShowPreview] = useState(true)

  // Editor Modal State
  const [editingField, setEditingField] = useState<{
    sectionId: string
    field: ReportField
    isNew?: boolean
  } | null>(null)

  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  // Open/close native modal <dialog> and lock .ad-main-scroll
  useEffect(() => {
    const dialog = dialogRef.current
    const mainScroll = document.querySelector('.ad-main-scroll') as HTMLElement | null

    if (editingField && dialog) {
      if (!dialog.open) {
        try {
          dialog.showModal()
        } catch {
          // fallback if already open
        }
      }
      const prevOverflow = mainScroll ? mainScroll.style.overflowY : ''
      if (mainScroll) {
        mainScroll.style.overflowY = 'hidden'
      }
      const focusTimer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus()
          if (editingField.field.label === 'Novo Campo') {
            titleInputRef.current.select()
          }
        }
      }, 60)

      return () => {
        clearTimeout(focusTimer)
        if (mainScroll) {
          mainScroll.style.overflowY = prevOverflow
        }
        if (dialog.open) {
          try {
            dialog.close()
          } catch {
            // ignore
          }
        }
      }
    }
  }, [editingField?.field.id])

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
    if (!tpl.name || !tpl.name.trim()) return adAlert('O relatório requer um nome!', 'Erro ao Salvar')

    setTemplates(prev => {
      const cleanedSections = tpl.sections.map(s => ({ ...s, title: '' }))
      const finalTpl: ReportTemplate = {
        ...tpl,
        sections: cleanedSections,
        status: asDraft ? 'rascunho' : 'ativo',
        updatedAt: new Date().toISOString()
      }
      if (templateId) {
        const existingOriginal = prev.find(x => x.id === templateId)
        if (existingOriginal?.status === 'ativo' && !asDraft) {
          finalTpl.version = existingOriginal.version + 1
        }
        addLog('Edição de Relatório', `Relatório atualizado: ${finalTpl.name} (v${finalTpl.version})`)
        return prev.map(x => (x.id === templateId ? finalTpl : x))
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
    const newSec: ReportSection = { id: `SEC-${Date.now()}`, title: '', fields: [] }
    setTpl(prev => ({
      ...prev,
      sections: [...prev.sections, newSec]
    }))
    setActiveSectionId(newSec.id)
  }

  const removeSection = (secId: string) => {
    if (tpl.sections.length <= 1) {
      return adAlert('O relatório precisa ter pelo menos um bloco de campos.', 'Aviso')
    }
    adConfirm('Deseja excluir este bloco e todos os seus campos?', 'Atenção', () => {
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
      title: '',
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
    if (!targetId) return adAlert('Adicione um bloco primeiro.', 'Aviso')

    const newField: ReportField = {
      id: `F-${Date.now()}`,
      type,
      label: 'Novo Campo',
      required: false
    }
    if (['unica-escolha', 'multipla-escolha', 'checklist'].includes(type)) {
      newField.options = ['Opção 1', 'Opção 2']
    }

    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === targetId ? { ...s, fields: [...s.fields, newField] } : s))
    }))

    setActiveSectionId(targetId)
    setEditingField({ sectionId: targetId, field: newField, isNew: true })
  }

  const updateEditingField = (updates: Partial<ReportField>) => {
    setEditingField(prev => {
      if (!prev) return null
      const updatedField = { ...prev.field, ...updates }
      if (
        updates.type &&
        ['unica-escolha', 'multipla-escolha', 'checklist'].includes(updates.type) &&
        (!updatedField.options || updatedField.options.length === 0)
      ) {
        updatedField.options = ['Opção 1', 'Opção 2']
      }
      return { ...prev, field: updatedField }
    })
  }

  const cancelFieldEditing = () => {
    if (!editingField) return
    if (editingField.isNew) {
      setTpl(prev => ({
        ...prev,
        sections: prev.sections.map(s =>
          s.id === editingField.sectionId
            ? { ...s, fields: s.fields.filter(f => f.id !== editingField.field.id) }
            : s
        )
      }))
    }
    setEditingField(null)
  }

  const saveFieldSettings = () => {
    if (!editingField) return
    const cleanedOptions = editingField.field.options
      ? editingField.field.options.map(o => o.trim()).filter(Boolean)
      : undefined

    const finalField: ReportField = {
      ...editingField.field,
      label: editingField.field.label.trim() || 'Campo sem título',
      options: cleanedOptions && cleanedOptions.length > 0 ? cleanedOptions : editingField.field.options
    }

    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === editingField.sectionId
          ? {
              ...s,
              fields: s.fields.map(f => (f.id === finalField.id ? finalField : f))
            }
          : s
      )
    }))
    setEditingField(null)
  }

  const removeField = (secId: string, fieldId: string) => {
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === secId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s))
    }))
    if (editingField?.field.id === fieldId) {
      setEditingField(null)
    }
  }

  const duplicateField = (secId: string, field: ReportField) => {
    const dup: ReportField = {
      ...field,
      id: `F-${Date.now()}`,
      label: `${field.label} (Cópia)`,
      options: field.options ? [...field.options] : undefined
    }
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === secId ? { ...s, fields: [...s.fields, dup] } : s))
    }))
  }

  const moveField = (secId: string, fieldIndex: number, up: boolean) => {
    setTpl(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== secId) return s
        const f = [...s.fields]
        if (up && fieldIndex > 0) {
          ;[f[fieldIndex], f[fieldIndex - 1]] = [f[fieldIndex - 1], f[fieldIndex]]
        } else if (!up && fieldIndex < f.length - 1) {
          ;[f[fieldIndex], f[fieldIndex + 1]] = [f[fieldIndex + 1], f[fieldIndex]]
        }
        return { ...s, fields: f }
      })
    }))
  }

  const moveFieldBetween = (
    fromSecId: string,
    fromIdx: number,
    toSecId: string,
    toIdx: number,
    position: 'before' | 'after'
  ) => {
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
      moveFieldBetween(draggedField.secId, draggedField.fIdx, targetSecId, targetFIdx, dragOverField.position)
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

  const totalFieldsCount = tpl.sections.reduce((acc, s) => acc + s.fields.length, 0)
  const accentColor = tpl.color || '#4f46e5'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 30px -6px rgba(15, 23, 42, 0.06)',
        minHeight: 'calc(100vh - 180px)'
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .ad-builder-palette-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
          width: 100%;
        }
        .ad-builder-palette-btn:hover {
          border-color: ${accentColor};
          background: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }
        .ad-builder-field-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .ad-builder-field-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        }
        dialog.ad-field-config-dialog {
          border: none;
          padding: 0;
          background: transparent;
          max-width: 100vw;
          max-height: 100dvh;
        }
        dialog.ad-field-config-dialog:modal {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          margin: 0;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          overscroll-behavior: contain;
          z-index: 2147483647;
          box-sizing: border-box;
        }
        dialog.ad-field-config-dialog::backdrop {
          overflow: hidden;
          overscroll-behavior: contain;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        @media (max-width: 1100px) {
          .ad-builder-preview-col {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .ad-builder-workspace {
            flex-direction: column !important;
          }
          .ad-builder-left-col {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
            max-height: 320px !important;
          }
          .ad-builder-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
        }
      `}} />

      {/* Top Bar */}
      <div
        className="ad-builder-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 22px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => onNavigate('list')}
            title="Voltar para a lista"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div style={{ flex: 1, minWidth: 0, maxWidth: 440 }}>
            <input
              value={tpl.name}
              onChange={e => setTpl(p => ({ ...p, name: e.target.value }))}
              placeholder="Nome do Relatório..."
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: '#0f172a',
                border: '1px solid transparent',
                borderRadius: 8,
                padding: '4px 8px',
                marginLeft: -8,
                width: '100%',
                background: 'transparent',
                fontFamily: 'Outfit, sans-serif',
                outline: 'none'
              }}
              onFocus={e => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onBlur={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginTop: 1 }}>
              <span>{templateId ? `Editando modelo • v${tpl.version}` : 'Novo modelo de relatório'}</span>
              <span>•</span>
              <span style={{ color: accentColor, fontWeight: 700 }}>
                {totalFieldsCount} {totalFieldsCount === 1 ? 'campo' : 'campos'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Preview Controls */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 11,
              border: '1px solid #e2e8f0',
              gap: 2
            }}
          >
            <button
              type="button"
              title="Prévia Mobile"
              onClick={() => {
                setShowPreview(true)
                setPreviewMode('mobile')
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: showPreview && previewMode === 'mobile' ? '#ffffff' : 'transparent',
                color: showPreview && previewMode === 'mobile' ? '#0f172a' : '#64748b',
                boxShadow: showPreview && previewMode === 'mobile' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <Smartphone size={14} />
            </button>
            <button
              type="button"
              title="Prévia Desktop"
              onClick={() => {
                setShowPreview(true)
                setPreviewMode('desktop')
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: showPreview && previewMode === 'desktop' ? '#ffffff' : 'transparent',
                color: showPreview && previewMode === 'desktop' ? '#0f172a' : '#64748b',
                boxShadow: showPreview && previewMode === 'desktop' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              title={showPreview ? 'Ocultar Prévia' : 'Mostrar Prévia'}
              onClick={() => setShowPreview(v => !v)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: !showPreview ? '#ffffff' : 'transparent',
                color: !showPreview ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSave(true)}
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 11,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Salvar Rascunho
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 6px 16px -4px rgba(79, 70, 229, 0.45)'
            }}
          >
            <Save size={15} />
            Salvar e Efetivar
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="ad-builder-workspace" style={{ display: 'flex', flex: 1, minHeight: 620 }}>
        {/* LEFT COLUMN: Palette & Settings */}
        <div
          className="ad-builder-left-col"
          style={{
            width: 290,
            background: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}
        >
          {/* Left Tabs */}
          <div style={{ display: 'flex', padding: 10, gap: 6, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setLeftTab('secoes')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: leftTab === 'secoes' ? '1px solid #e2e8f0' : '1px solid transparent',
                background: leftTab === 'secoes' ? '#ffffff' : 'transparent',
                color: leftTab === 'secoes' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: leftTab === 'secoes' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <Layers size={14} />
              Campos
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('config')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: leftTab === 'config' ? '1px solid #e2e8f0' : '1px solid transparent',
                background: leftTab === 'config' ? '#ffffff' : 'transparent',
                color: leftTab === 'config' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: leftTab === 'config' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <Settings size={14} />
              Ajustes
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {leftTab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Nome do Relatório
                  </label>
                  <input
                    className="form-input"
                    value={tpl.name}
                    onChange={e => setTpl(p => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%', borderRadius: 10, fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Categoria
                  </label>
                  <input
                    className="form-input"
                    value={tpl.category}
                    onChange={e => setTpl(p => ({ ...p, category: e.target.value }))}
                    placeholder="Ex: Rotina, Pedagógico, Geral..."
                    style={{ width: '100%', borderRadius: 10, fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Descrição (Opcional)
                  </label>
                  <textarea
                    className="form-input"
                    value={tpl.description}
                    onChange={e => setTpl(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder="Breve descrição sobre a finalidade deste relatório..."
                    style={{ width: '100%', borderRadius: 10, fontSize: 13.5, resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Cor de Destaque
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTpl(p => ({ ...p, color: c }))}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: c,
                          border: tpl.color === c ? '2px solid #0f172a' : '2px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff'
                        }}
                      >
                        {tpl.color === c && <Check size={14} strokeWidth={3} />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={tpl.color}
                      onChange={e => setTpl(p => ({ ...p, color: e.target.value }))}
                      style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                      title="Cor personalizada"
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Quem pode preencher?
                  </label>
                  <select
                    className="form-input"
                    value={tpl.permissions.fill[0]}
                    onChange={e =>
                      setTpl(p => ({ ...p, permissions: { ...p.permissions, fill: [e.target.value] } }))
                    }
                    style={{ width: '100%', borderRadius: 10, fontSize: 13.5 }}
                  >
                    <option value="todos">Todos os Colaboradores</option>
                    <option value="professores">Apenas Professores</option>
                    <option value="admin">Apenas Administração</option>
                  </select>
                </div>
              </div>
            )}

            {leftTab === 'secoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tpl.sections.length > 1 && (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Inserir novo campo em:
                    </label>
                    <select
                      className="form-input"
                      style={{ fontSize: 13, fontWeight: 600, height: 34, padding: '4px 8px', borderRadius: 8 }}
                      value={activeSectionId || (tpl.sections[0]?.id || '')}
                      onChange={e => setActiveSectionId(e.target.value)}
                    >
                      {tpl.sections.map((s, idx) => (
                        <option key={s.id} value={s.id}>
                          Seção {idx + 1} ({s.fields.length} {s.fields.length === 1 ? 'campo' : 'campos'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 2px' }}>
                  Clique para adicionar campo
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIELD_TYPES.map(ft => (
                    <button
                      key={ft.type}
                      type="button"
                      className="ad-builder-palette-btn"
                      onClick={() => {
                        const secId = activeSectionId || tpl.sections[tpl.sections.length - 1]?.id
                        if (!secId) return adAlert('Adicione uma seção primeiro.', 'Aviso')
                        addField(secId, ft.type)
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: `${accentColor}12`,
                          color: accentColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {ft.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{ft.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ft.hint}
                        </div>
                      </div>
                      <Plus size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Structure Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', minWidth: 0 }}>
          <div
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div>
              <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                Estrutura de Campos do Relatório
              </h3>
              <p style={{ fontSize: 11.5, color: '#64748b', margin: '2px 0 0 0' }}>
                Clique em qualquer campo para editar ou arraste pela alça lateral para reordenar
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 9,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Novo Bloco
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {tpl.sections.map((sec, sIdx) => {
                const isCollapsed = collapsedSections[sec.id]
                const isActive = activeSectionId === sec.id

                return (
                  <div key={sec.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {dragOverSecIdx === sIdx && draggedSecIdx !== null && draggedSecIdx !== sIdx && dropSecPosition === 'before' && (
                      <div style={{ height: 4, background: accentColor, borderRadius: 2, margin: '6px 0' }} />
                    )}

                    <div
                      onClick={() => setActiveSectionId(sec.id)}
                      onDragOver={e => handleSecDragOver(e, sIdx)}
                      onDrop={e => handleSecDrop(e, sIdx)}
                      style={{
                        background: '#ffffff',
                        borderRadius: 16,
                        border: isActive ? `2px solid ${accentColor}66` : '1px solid #e2e8f0',
                        opacity: draggedSecIdx === sIdx ? 0.4 : 1,
                        boxShadow: isActive
                          ? `0 8px 24px -8px ${accentColor}22`
                          : '0 2px 10px rgba(15, 23, 42, 0.03)',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Section Header (Without Section Name Input!) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          background: '#f8fafc',
                          borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            draggable
                            onDragStart={e => handleSecDragStart(e, sIdx)}
                            onDragEnd={handleSecDragEnd}
                            title="Arraste para reordenar este bloco"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: draggedSecIdx === sIdx ? 'grabbing' : 'grab',
                              padding: '4px 10px',
                              borderRadius: 8,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              userSelect: 'none'
                            }}
                          >
                            <GripVertical size={14} style={{ color: '#94a3b8' }} />
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              {tpl.sections.length > 1 ? `Bloco ${sIdx + 1}` : 'Campos do Relatório'}
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#64748b',
                              background: '#e2e8f0',
                              padding: '2px 8px',
                              borderRadius: 999
                            }}
                          >
                            {sec.fields.length} {sec.fields.length === 1 ? 'campo' : 'campos'}
                          </span>

                          {tpl.sections.length > 1 && (
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button
                                type="button"
                                disabled={sIdx === 0}
                                onClick={e => {
                                  e.stopPropagation()
                                  moveSection(sIdx, true)
                                }}
                                title="Mover bloco para cima"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 4,
                                  cursor: sIdx === 0 ? 'default' : 'pointer',
                                  opacity: sIdx === 0 ? 0.25 : 0.7,
                                  display: 'flex'
                                }}
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={sIdx === tpl.sections.length - 1}
                                onClick={e => {
                                  e.stopPropagation()
                                  moveSection(sIdx, false)
                                }}
                                title="Mover bloco para baixo"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 4,
                                  cursor: sIdx === tpl.sections.length - 1 ? 'default' : 'pointer',
                                  opacity: sIdx === tpl.sections.length - 1 ? 0.25 : 0.7,
                                  display: 'flex'
                                }}
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              duplicateSection(sec.id)
                            }}
                            title="Duplicar bloco"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              padding: 6,
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex'
                            }}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              toggleCollapse(sec.id)
                            }}
                            title={isCollapsed ? 'Expandir' : 'Recolher'}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              padding: 6,
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex'
                            }}
                          >
                            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </button>
                          {tpl.sections.length > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                removeSection(sec.id)
                              }}
                              title="Excluir bloco"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                padding: 6,
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Section Body */}
                      {!isCollapsed && (
                        <div
                          style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
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
                            <div
                              style={{
                                padding: '32px 20px',
                                textAlign: 'center',
                                color: '#64748b',
                                fontSize: 13,
                                border: dragOverEmptySecId === sec.id ? `2px dashed ${accentColor}` : '1px dashed #cbd5e1',
                                background: dragOverEmptySecId === sec.id ? `${accentColor}08` : '#f8fafc',
                                borderRadius: 12
                              }}
                            >
                              {dragOverEmptySecId === sec.id
                                ? 'Solte o campo aqui'
                                : 'Nenhum campo adicionado ainda. Selecione um tipo de campo na coluna à esquerda.'}
                            </div>
                          )}

                          {sec.fields.map((f, fIdx) => {
                            const meta = getFieldMeta(f.type)
                            return (
                              <React.Fragment key={f.id}>
                                {draggedField &&
                                  dragOverField?.secId === sec.id &&
                                  dragOverField?.fIdx === fIdx &&
                                  dragOverField?.position === 'before' && (
                                    <div style={{ height: 3, background: accentColor, borderRadius: 2 }} />
                                  )}

                                <div
                                  className="ad-builder-field-item"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingField({ sectionId: sec.id, field: { ...f }, isNew: false })
                                  }}
                                  onDragOver={e => handleFieldDragOver(e, sec.id, fIdx)}
                                  onDrop={e => handleFieldDrop(e, sec.id, fIdx)}
                                  style={{
                                    opacity: draggedField?.secId === sec.id && draggedField?.fIdx === fIdx ? 0.35 : 1
                                  }}
                                >
                                  {/* Reorder & Drag Handle */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: 1,
                                      color: '#94a3b8',
                                      marginTop: 2
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      disabled={fIdx === 0}
                                      onClick={() => moveField(sec.id, fIdx, true)}
                                      title="Subir campo"
                                      style={{
                                        border: 0,
                                        background: 'none',
                                        cursor: fIdx === 0 ? 'default' : 'pointer',
                                        opacity: fIdx === 0 ? 0.25 : 0.8,
                                        padding: 2,
                                        display: 'flex'
                                      }}
                                    >
                                      <ChevronUp size={13} />
                                    </button>
                                    <div
                                      draggable
                                      onDragStart={e => handleFieldDragStart(e, sec.id, fIdx)}
                                      onDragEnd={handleFieldDragEnd}
                                      title="Arraste para mover"
                                      style={{ cursor: 'grab', padding: 2, display: 'flex' }}
                                    >
                                      <GripVertical size={15} />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={fIdx === sec.fields.length - 1}
                                      onClick={() => moveField(sec.id, fIdx, false)}
                                      title="Descer campo"
                                      style={{
                                        border: 0,
                                        background: 'none',
                                        cursor: fIdx === sec.fields.length - 1 ? 'default' : 'pointer',
                                        opacity: fIdx === sec.fields.length - 1 ? 0.25 : 0.8,
                                        padding: 2,
                                        display: 'flex'
                                      }}
                                    >
                                      <ChevronDown size={13} />
                                    </button>
                                  </div>

                                  {/* Field Icon */}
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      background: `${accentColor}12`,
                                      color: accentColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      marginTop: 2
                                    }}
                                  >
                                    {meta.icon}
                                  </div>

                                  {/* Content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{f.label}</span>
                                      {f.required && (
                                        <span
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            color: '#dc2626',
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            padding: '1px 7px',
                                            borderRadius: 999
                                          }}
                                        >
                                          Obrigatório
                                        </span>
                                      )}
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: '#64748b',
                                          background: '#f1f5f9',
                                          padding: '2px 8px',
                                          borderRadius: 6
                                        }}
                                      >
                                        {meta.label}
                                      </span>
                                    </div>

                                    {f.description && (
                                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>{f.description}</p>
                                    )}

                                    {/* Compact visual preview of options or placeholder */}
                                    {['unica-escolha', 'multipla-escolha', 'checklist'].includes(f.type) &&
                                      f.options &&
                                      f.options.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                          {f.options.map((opt, idx) => (
                                            <span
                                              key={idx}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                fontSize: 11.5,
                                                fontWeight: 600,
                                                color: '#475569',
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                padding: '3px 9px',
                                                borderRadius: 8
                                              }}
                                            >
                                              <span
                                                style={{
                                                  width: 7,
                                                  height: 7,
                                                  borderRadius: f.type === 'unica-escolha' ? '50%' : 2,
                                                  border: `1.5px solid ${accentColor}`
                                                }}
                                              />
                                              {opt}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                    {f.type === 'sim-nao' && (
                                      <div style={{ display: 'inline-flex', gap: 6, marginTop: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: '#ecfdf5', color: '#059669' }}>
                                          Sim
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: '#fef2f2', color: '#dc2626' }}>
                                          Não
                                        </span>
                                      </div>
                                    )}

                                    {f.type === 'nota' && (
                                      <div style={{ display: 'inline-flex', gap: 3, marginTop: 6, color: '#f59e0b' }}>
                                        {[1, 2, 3, 4, 5].map(n => (
                                          <Star key={n} size={13} fill="#f59e0b" />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setEditingField({ sectionId: sec.id, field: { ...f }, isNew: false })}
                                      title="Configurar campo"
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        color: '#475569',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateField(sec.id, f)}
                                      title="Duplicar campo"
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        color: '#475569',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeField(sec.id, f.id)}
                                      title="Excluir campo"
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 8,
                                        border: '1px solid #fecaca',
                                        background: '#fef2f2',
                                        color: '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                {draggedField &&
                                  dragOverField?.secId === sec.id &&
                                  dragOverField?.fIdx === fIdx &&
                                  dragOverField?.position === 'after' && (
                                    <div style={{ height: 3, background: accentColor, borderRadius: 2 }} />
                                  )}
                              </React.Fragment>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {dragOverSecIdx === sIdx && draggedSecIdx !== null && draggedSecIdx !== sIdx && dropSecPosition === 'after' && (
                      <div style={{ height: 4, background: accentColor, borderRadius: 2, margin: '6px 0' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Preview */}
        {showPreview && (
          <div
            className="ad-builder-preview-col"
            style={{
              width: previewMode === 'mobile' ? 350 : 390,
              background: '#ffffff',
              borderLeft: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              transition: 'width 0.25s ease'
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: `${accentColor}15`,
                    color: accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Eye size={14} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                  Pré-visualização ({previewMode === 'mobile' ? 'Mobile' : 'Desktop'})
                </span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f1f5f9' }}>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 18,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06)'
                }}
              >
                <div style={{ height: 8, background: accentColor }} />
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <h4 style={{ fontSize: 17, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>
                    {tpl.name || 'Relatório'}
                  </h4>
                  {tpl.description && (
                    <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0 0' }}>{tpl.description}</p>
                  )}
                </div>

                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {totalFieldsCount === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12.5 }}>
                      Adicione campos para visualizar o formulário aqui.
                    </div>
                  )}

                  {tpl.sections.flatMap(s => s.fields).map(f => (
                    <div key={'pf' + f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      {f.description && <div style={{ fontSize: 11.5, color: '#64748b' }}>{f.description}</div>}

                      {f.type === 'texto-curto' && (
                        <input
                          className="form-input"
                          style={{ width: '100%', height: 36, fontSize: 12.5, borderRadius: 10 }}
                          placeholder={f.placeholder || 'Digite aqui...'}
                          disabled
                        />
                      )}
                      {f.type === 'texto-longo' && (
                        <textarea
                          className="form-input"
                          style={{ width: '100%', fontSize: 12.5, borderRadius: 10 }}
                          placeholder={f.placeholder || 'Digite aqui...'}
                          disabled
                          rows={2}
                        />
                      )}
                      {f.type === 'unica-escolha' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(f.options || []).map((opt, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '6px 11px',
                                borderRadius: 9,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                fontSize: 12,
                                color: '#475569',
                                fontWeight: 600
                              }}
                            >
                              ○ {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {(f.type === 'multipla-escolha' || f.type === 'checklist') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(f.options || ['Item']).map((opt, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '6px 11px',
                                borderRadius: 9,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                fontSize: 12,
                                color: '#475569',
                                fontWeight: 600
                              }}
                            >
                              ☐ {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {f.type === 'sim-nao' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              textAlign: 'center',
                              padding: '7px',
                              borderRadius: 9,
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#475569'
                            }}
                          >
                            Sim
                          </div>
                          <div
                            style={{
                              flex: 1,
                              textAlign: 'center',
                              padding: '7px',
                              borderRadius: 9,
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#475569'
                            }}
                          >
                            Não
                          </div>
                        </div>
                      )}
                      {f.type === 'nota' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <div
                              key={n}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: '1px solid #fde68a',
                                background: '#fffbeb',
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 800
                              }}
                            >
                              {n}★
                            </div>
                          ))}
                        </div>
                      )}
                      {(f.type === 'imagem' || f.type === 'arquivo') && (
                        <div
                          style={{
                            border: '1px dashed #cbd5e1',
                            padding: 12,
                            borderRadius: 10,
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: 12,
                            background: '#f8fafc'
                          }}
                        >
                          {f.type === 'imagem' ? 'Selecionar Imagem' : 'Selecionar Arquivo'}
                        </div>
                      )}
                      {f.type === 'assinatura' && (
                        <input
                          className="form-input"
                          style={{ width: '100%', height: 36, fontSize: 12.5, fontStyle: 'italic', borderRadius: 10 }}
                          placeholder="Assinatura digital..."
                          disabled
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    disabled
                    style={{
                      width: '100%',
                      height: 38,
                      borderRadius: 10,
                      background: accentColor,
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      opacity: 0.9
                    }}
                  >
                    Enviar Relatório
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIELD CONFIGURATION MODAL (Portaled & Native Top-Layer Dialog with Scroll Lock) */}
      {editingField && (
        <Portal>
          <dialog
            ref={dialogRef}
            className="ad-field-config-dialog"
            onCancel={e => {
              e.preventDefault()
              cancelFieldEditing()
            }}
            onClick={e => {
              if (e.target === e.currentTarget) {
                cancelFieldEditing()
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 'min(560px, calc(100vw - 32px))',
                maxHeight: 'min(86vh, 720px)',
                background: '#ffffff',
                borderRadius: 24,
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.38)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#0f172a',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: `${accentColor}15`,
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {getFieldMeta(editingField.field.type).icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>
                      Configurar Campo
                    </h3>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                      {getFieldMeta(editingField.field.type).label} — {getFieldMeta(editingField.field.type).hint}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelFieldEditing}
                  aria-label="Fechar modal"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div
                style={{
                  padding: '22px 24px',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18
                }}
              >
                {/* Field Type Switcher */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6
                    }}
                  >
                    Tipo de Campo
                  </label>
                  <select
                    value={editingField.field.type}
                    onChange={e => updateEditingField({ type: e.target.value as FieldType })}
                    style={{
                      width: '100%',
                      height: 42,
                      padding: '0 12px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontSize: 14,
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.type} value={ft.type}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pergunta / Título */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6
                    }}
                  >
                    Pergunta / Título do Campo <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    ref={titleInputRef}
                    value={editingField.field.label}
                    onChange={e => updateEditingField({ label: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveFieldSettings()
                      }
                    }}
                    placeholder="Ex: Alimentação, Disposição, Conteúdo trabalhado..."
                    style={{
                      width: '100%',
                      height: 44,
                      padding: '0 14px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: 14.5,
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Descrição Auxiliar */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6
                    }}
                  >
                    Instrução / Descrição Auxiliar <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Opcional)</span>
                  </label>
                  <input
                    value={editingField.field.description || ''}
                    onChange={e => updateEditingField({ description: e.target.value })}
                    placeholder="Ex: Adicione detalhes caso julgue necessário..."
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Placeholder for Text Fields */}
                {['texto-curto', 'texto-longo'].includes(editingField.field.type) && (
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6
                      }}
                    >
                      Texto de Exemplo (Placeholder){' '}
                      <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Opcional)</span>
                    </label>
                    <input
                      value={editingField.field.placeholder || ''}
                      onChange={e => updateEditingField({ placeholder: e.target.value })}
                      placeholder="Ex: Digite aqui a resposta..."
                      style={{
                        width: '100%',
                        height: 40,
                        padding: '0 14px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* Interactive Options Manager for Choice Fields */}
                {['unica-escolha', 'multipla-escolha', 'checklist'].includes(editingField.field.type) && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#334155',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5
                        }}
                      >
                        Opções de Resposta ({(editingField.field.options || []).length})
                      </label>
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={12} style={{ color: accentColor }} /> Sugestões:
                      </span>
                      {OPTION_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updateEditingField({ options: [...preset.options] })}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: 999,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(editingField.field.options || []).map((opt, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 7,
                              background: '#e2e8f0',
                              color: '#475569',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {idx + 1}
                          </span>
                          <input
                            value={opt}
                            onChange={e => {
                              const next = [...(editingField.field.options || [])]
                              next[idx] = e.target.value
                              updateEditingField({ options: next })
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const next = [...(editingField.field.options || [])]
                                next.splice(idx + 1, 0, `Opção ${next.length + 1}`)
                                updateEditingField({ options: next })
                              }
                            }}
                            placeholder={`Opção ${idx + 1}`}
                            style={{
                              flex: 1,
                              height: 36,
                              padding: '0 12px',
                              borderRadius: 10,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontSize: 13.5,
                              fontWeight: 500,
                              outline: 'none'
                            }}
                          />
                          <button
                            type="button"
                            disabled={(editingField.field.options || []).length <= 1}
                            onClick={() => {
                              const next = (editingField.field.options || []).filter((_, i) => i !== idx)
                              updateEditingField({ options: next })
                            }}
                            title="Remover opção"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: (editingField.field.options || []).length <= 1 ? 'not-allowed' : 'pointer',
                              opacity: (editingField.field.options || []).length <= 1 ? 0.4 : 1,
                              flexShrink: 0
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const current = editingField.field.options || []
                        updateEditingField({ options: [...current, `Opção ${current.length + 1}`] })
                      }}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '7px 12px',
                        borderRadius: 10,
                        border: `1px dashed ${accentColor}`,
                        background: '#ffffff',
                        color: accentColor,
                        fontSize: 12.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Adicionar Opção
                    </button>
                  </div>
                )}

                {/* Required Behavior Toggle */}
                <div
                  onClick={() => updateEditingField({ required: !editingField.field.required })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: editingField.field.required ? `1.5px solid ${accentColor}` : '1px solid #e2e8f0',
                    background: editingField.field.required ? `${accentColor}08` : '#f8fafc',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Campo Obrigatório</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Destaca o campo com asterisco e exige resposta no preenchimento
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      background: editingField.field.required ? accentColor : '#cbd5e1',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: editingField.field.required ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  {!editingField.isNew && (
                    <button
                      type="button"
                      onClick={() => removeField(editingField.sectionId, editingField.field.id)}
                      style={{
                        height: 40,
                        padding: '0 14px',
                        borderRadius: 11,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={cancelFieldEditing}
                    style={{
                      height: 40,
                      padding: '0 18px',
                      borderRadius: 11,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveFieldSettings}
                    style={{
                      height: 40,
                      padding: '0 22px',
                      borderRadius: 11,
                      border: 'none',
                      background: `linear-gradient(135deg, ${accentColor} 0%, #6366f1 100%)`,
                      color: '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      boxShadow: `0 6px 16px -4px ${accentColor}66`
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </dialog>
        </Portal>
      )}
    </div>
  )
}
