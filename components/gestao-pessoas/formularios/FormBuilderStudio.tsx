'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Save,
  Eye,
  Palette,
  Settings,
  BarChart3,
  FileText,
  Sparkles,
  Check,
  Link2,
  Smartphone,
  Monitor,
  Layers,
  GitBranch,
  ShieldAlert,
  Award,
  UserPlus,
  ArrowLeft,
  ClipboardPaste,
  Columns,
  Maximize2,
  HelpCircle,
  Image as ImageIcon,
  UserCheck,
  User,
  Globe,
} from 'lucide-react'
import {
  GPForm,
  GPFormResponse,
  FormSection,
  FormField,
  FormFieldType,
  FormMediaItem,
  FORM_THEME_PRESETS,
  FORM_CATEGORIES,
} from '@/lib/gestao-pessoas/formulariosTypes'
import { FormRenderer } from './FormRenderer'
import { FormAnalyticsDashboard } from './FormAnalyticsDashboard'
import {
  HeaderBannerAndLogoEditor,
  MediaCollectionEditor,
  compressImageFileToDataUrl,
  uploadFormImageFile,
} from './FormMediaHelper'
import { FormRichTextEditor } from './FormRichTextEditor'

export const FIELD_TYPE_CATALOG: {
  type: FormFieldType
  label: string
  group: string
  badge: string
}[] = [
  { type: 'texto_curto', label: 'Resposta Curta', group: 'Texto', badge: 'Aa' },
  { type: 'paragrafo', label: 'Parágrafo / Texto Longo', group: 'Texto', badge: '¶' },
  { type: 'multipla_escolha', label: 'Múltipla Escolha (Única)', group: 'Escolha', badge: '◉' },
  { type: 'caixas_selecao', label: 'Caixas de Seleção (Várias)', group: 'Escolha', badge: '☑' },
  { type: 'lista_suspensa', label: 'Lista Suspensa (Dropdown)', group: 'Escolha', badge: '▾' },
  { type: 'sim_nao', label: 'Sim / Não Rápido', group: 'Escolha', badge: '👍' },
  { type: 'escala_linear', label: 'Escala Linear (1 a 5 / 10)', group: 'Escalas & Clima', badge: '1..5' },
  { type: 'nps', label: 'Medidor eNPS (0 a 10)', group: 'Escalas & Clima', badge: 'NPS' },
  { type: 'avaliacao_estrelas', label: 'Avaliação por Estrelas', group: 'Escalas & Clima', badge: '★' },
  { type: 'termometro_humor', label: 'Termômetro de Sentimento (Emojis)', group: 'Escalas & Clima', badge: '😊' },
  { type: 'grade_multipla', label: 'Grade de Múltipla Escolha (Matriz)', group: 'Matrizes & Ordem', badge: '⊞' },
  { type: 'grade_caixas', label: 'Grade de Caixas de Seleção', group: 'Matrizes & Ordem', badge: ' 田' },
  { type: 'ranking', label: 'Ordenação por Prioridade (Ranking)', group: 'Matrizes & Ordem', badge: '1º2º' },
  { type: 'usuario_logado', label: 'Nome do Usuário Logado (Automático)', group: 'Dados & Identificação', badge: '👤' },
  { type: 'data', label: 'Data', group: 'Dados & Assinatura', badge: '📅' },
  { type: 'hora', label: 'Horário', group: 'Dados & Assinatura', badge: '⏰' },
  { type: 'numero_moeda', label: 'Número / Moeda (R$) / %', group: 'Dados & Assinatura', badge: 'R$' },
  { type: 'assinatura_digital', label: 'Assinatura Digital na Tela', group: 'Dados & Assinatura', badge: '✍️' },
  { type: 'bloco_informativo', label: 'Bloco Informativo / Texto de Instruções', group: 'Instruções & Mídia', badge: 'ℹ️' },
  { type: 'bloco_imagem', label: 'Bloco de Imagem / Infográfico / Cartaz', group: 'Instruções & Mídia', badge: '🖼️' },
]

interface FormBuilderStudioProps {
  initialForm: GPForm
  responses: GPFormResponse[]
  colaboradoresList: any[]
  currentUser: any
  initialStudioTab?: 'perguntas' | 'layout' | 'config' | 'preview' | 'respostas'
  onSaveForm: (updatedForm: GPForm) => Promise<void>
  onBack: () => void
  onOpenManualEntry: (prefillColaborador?: any, editResp?: GPFormResponse | null) => void
  onDeleteResponse: (responseId: string) => Promise<void>
  onResponsesChange: (nextResponses: GPFormResponse[]) => void
}

export function FormBuilderStudio({
  initialForm,
  responses,
  colaboradoresList,
  currentUser,
  initialStudioTab = 'perguntas',
  onSaveForm,
  onBack,
  onOpenManualEntry,
  onDeleteResponse,
  onResponsesChange,
}: FormBuilderStudioProps) {
  const [form, setForm] = useState<GPForm>(initialForm)
  const [studioTab, setStudioTab] = useState<
    'perguntas' | 'layout' | 'config' | 'preview' | 'respostas'
  >(initialStudioTab)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(
    initialForm.sections?.[0]?.fields?.[0]?.id || null
  )
  const [openAdvancedPanel, setOpenAdvancedPanel] = useState<
    Record<string, 'conditional' | 'validation' | 'quiz' | null>
  >({})
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Smart Paste Modal State
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false)
  const [smartPasteText, setSmartPasteText] = useState('')

  // Reorder Sections Modal State
  const [isReorderSectionsOpen, setIsReorderSectionsOpen] = useState(false)

  const primaryColor = form.theme?.primaryColor || '#4f46e5'

  // Auto-save: whenever form changes, debounce a background save after 1800ms
  // so the user never loses images or edits even if they navigate away or refresh
  const isFirstRender = React.useRef(true)
  const formRef = React.useRef(form)
  formRef.current = form

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timer = setTimeout(() => {
      onSaveForm(formRef.current).catch(err => {
        console.warn('[AutoSave] Falha no salvamento automático em segundo plano:', err)
      })
    }, 1800)
    return () => clearTimeout(timer)
  }, [form, onSaveForm])

  const handleBack = async () => {
    setIsSaving(true)
    try {
      await onSaveForm(form)
    } catch (e) {
      console.warn('Erro ao salvar formulário ao sair:', e)
    } finally {
      setIsSaving(false)
      onBack()
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSaveForm(form)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/gestao-pessoas/formularios/${form.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // ---------------------------------------------------------------------------
  // SECTION & FIELD MUTATION HELPERS
  // ---------------------------------------------------------------------------
  const addSection = () => {
    const newSec: FormSection = {
      id: `sec-${Date.now()}`,
      title: `Seção ${(form.sections?.length || 0) + 1}`,
      description: '',
      fields: [
        {
          id: `f-${Date.now()}`,
          type: 'texto_curto',
          title: 'Nova pergunta',
          required: false,
          width: '100%',
        },
      ],
    }
    setForm(prev => ({
      ...prev,
      sections: [...(prev.sections || []), newSec],
    }))
  }

  const updateSection = (secId: string, patch: Partial<FormSection>) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === secId ? { ...s, ...patch } : s)),
    }))
  }

  const removeSection = (secId: string) => {
    if ((form.sections?.length || 0) <= 1) {
      alert('O formulário precisa ter pelo menos 1 seção.')
      return
    }
    setForm(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== secId),
    }))
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= (form.sections?.length || 0)) return
    setForm(prev => {
      const nextSections = [...(prev.sections || [])]
      const temp = nextSections[index]
      nextSections[index] = nextSections[targetIndex]
      nextSections[targetIndex] = temp
      return { ...prev, sections: nextSections }
    })
  }

  const duplicateSection = (secId: string) => {
    setForm(prev => {
      const idx = prev.sections.findIndex(s => s.id === secId)
      if (idx === -1) return prev
      const orig = prev.sections[idx]
      const clone: FormSection = {
        ...JSON.parse(JSON.stringify(orig)),
        id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${orig.title} (Cópia)`,
        fields: orig.fields.map(f => ({
          ...JSON.parse(JSON.stringify(f)),
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        })),
      }
      const nextSections = [...prev.sections]
      nextSections.splice(idx + 1, 0, clone)
      return { ...prev, sections: nextSections }
    })
  }

  const createDefaultField = (type: FormFieldType): FormField => {
    const base: FormField = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title:
        type === 'bloco_informativo'
          ? 'Título ou Instrução Importante'
          : type === 'bloco_imagem'
          ? 'Imagem Ilustrativa / Comunicado Visual'
          : 'Nova pergunta sem título',
      required: type !== 'bloco_informativo' && type !== 'bloco_imagem',
      width: '100%',
    }

    if (
      type === 'multipla_escolha' ||
      type === 'caixas_selecao' ||
      type === 'lista_suspensa' ||
      type === 'ranking'
    ) {
      base.options = ['Opção 1', 'Opção 2', 'Opção 3']
    }
    if (type === 'escala_linear') {
      base.scaleMin = 1
      base.scaleMax = 5
      base.scaleMinLabel = 'Discordo Totalmente'
      base.scaleMaxLabel = 'Concordo Totalmente'
    }
    if (type === 'avaliacao_estrelas') {
      base.starCount = 5
    }
    if (type === 'grade_multipla' || type === 'grade_caixas') {
      base.gridRows = ['Critério 1', 'Critério 2', 'Critério 3']
      base.gridCols = ['Ruim', 'Regular', 'Bom', 'Excelente']
    }
    if (type === 'numero_moeda') {
      base.numberFormat = 'inteiro'
    }
    if (type === 'usuario_logado') {
      base.title = 'Nome Completo'
      base.placeholder = 'Preenchido automaticamente pelo login'
      base.autoFillUser = 'nome'
      base.lockAutoFill = true
    }
    return base
  }

  const addFieldToSection = (secId: string, type: FormFieldType = 'multipla_escolha') => {
    const newField = createDefaultField(type)
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === secId ? { ...s, fields: [...s.fields, newField] } : s
      ),
    }))
    setActiveFieldId(newField.id)
  }

  const updateField = (secId: string, fieldId: string, patch: Partial<FormField>) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== secId) return s
        return {
          ...s,
          fields: s.fields.map(f => {
            if (f.id !== fieldId) return f
            const merged = { ...f, ...patch }
            // Ensure options/grids exist when switching types
            if (
              (merged.type === 'multipla_escolha' ||
                merged.type === 'caixas_selecao' ||
                merged.type === 'lista_suspensa' ||
                merged.type === 'ranking') &&
              (!merged.options || merged.options.length === 0)
            ) {
              merged.options = ['Opção 1', 'Opção 2', 'Opção 3']
            }
            if (
              (merged.type === 'grade_multipla' || merged.type === 'grade_caixas') &&
              (!merged.gridRows || merged.gridRows.length === 0)
            ) {
              merged.gridRows = ['Item 1', 'Item 2']
              merged.gridCols = ['Regular', 'Bom', 'Excelente']
            }
            return merged
          }),
        }
      }),
    }))
  }

  const duplicateField = (secId: string, fieldId: string) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== secId) return s
        const idx = s.fields.findIndex(f => f.id === fieldId)
        if (idx === -1) return s
        const orig = s.fields[idx]
        const clone: FormField = {
          ...JSON.parse(JSON.stringify(orig)),
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `${orig.title} (Cópia)`,
        }
        const nextFields = [...s.fields]
        nextFields.splice(idx + 1, 0, clone)
        setActiveFieldId(clone.id)
        return { ...s, fields: nextFields }
      }),
    }))
  }

  const removeField = (secId: string, fieldId: string) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === secId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s
      ),
    }))
  }

  const moveField = (secId: string, index: number, dir: 'up' | 'down') => {
    setForm(prev => {
      const sIdx = prev.sections.findIndex(s => s.id === secId)
      if (sIdx === -1) return prev

      const currSec = prev.sections[sIdx]
      const target = dir === 'up' ? index - 1 : index + 1

      // Case 1: Move within same section
      if (target >= 0 && target < currSec.fields.length) {
        const nextFields = [...currSec.fields]
        const temp = nextFields[index]
        nextFields[index] = nextFields[target]
        nextFields[target] = temp
        return {
          ...prev,
          sections: prev.sections.map((s, idx) =>
            idx === sIdx ? { ...s, fields: nextFields } : s
          ),
        }
      }

      // Case 2: Move up across section boundary (to end of previous section)
      if (dir === 'up' && target < 0 && sIdx > 0) {
        const movingField = currSec.fields[index]
        return {
          ...prev,
          sections: prev.sections.map((s, idx) => {
            if (idx === sIdx) {
              return { ...s, fields: s.fields.filter((_, fIdx) => fIdx !== index) }
            }
            if (idx === sIdx - 1) {
              return { ...s, fields: [...s.fields, movingField] }
            }
            return s
          }),
        }
      }

      // Case 3: Move down across section boundary (to start of next section)
      if (dir === 'down' && target >= currSec.fields.length && sIdx < prev.sections.length - 1) {
        const movingField = currSec.fields[index]
        return {
          ...prev,
          sections: prev.sections.map((s, idx) => {
            if (idx === sIdx) {
              return { ...s, fields: s.fields.filter((_, fIdx) => fIdx !== index) }
            }
            if (idx === sIdx + 1) {
              return { ...s, fields: [movingField, ...s.fields] }
            }
            return s
          }),
        }
      }

      return prev
    })
  }

  const moveFieldToSection = (fromSecId: string, toSecId: string, fieldId: string) => {
    if (fromSecId === toSecId) return
    setForm(prev => {
      let targetField: FormField | null = null
      const updatedSections = prev.sections.map(sec => {
        if (sec.id === fromSecId) {
          const found = sec.fields.find(f => f.id === fieldId)
          if (found) targetField = found
          return { ...sec, fields: sec.fields.filter(f => f.id !== fieldId) }
        }
        return sec
      })
      if (!targetField) return prev
      return {
        ...prev,
        sections: updatedSections.map(sec =>
          sec.id === toSecId ? { ...sec, fields: [...sec.fields, targetField!] } : sec
        ),
      }
    })
  }

  // Smart Paste Parser: turns pasted text into questions & options automatically!
  const handleApplySmartPaste = () => {
    if (!smartPasteText.trim()) return
    const blocks = smartPasteText
      .trim()
      .split(/\n\s*\n/)
      .map(b => b.trim())
      .filter(Boolean)

    const generatedFields: FormField[] = blocks.map(block => {
      const lines = block
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
      const firstLine = lines[0].replace(/^\d+[\.\)]\s*/, '')
      const optionLines = lines
        .slice(1)
        .map(l => l.replace(/^[-*•a-zA-Z0-9]+[\.\)]\s*|^[-*•]\s*/, '').trim())
        .filter(Boolean)

      if (optionLines.length >= 2) {
        return {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'multipla_escolha',
          title: firstLine,
          required: true,
          width: '100%',
          options: optionLines,
        }
      }
      return {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: firstLine.length > 90 ? 'paragrafo' : 'texto_curto',
        title: firstLine,
        required: true,
        width: '100%',
      }
    })

    if (generatedFields.length > 0) {
      const firstSecId = form.sections[0]?.id
      if (firstSecId) {
        setForm(prev => ({
          ...prev,
          sections: prev.sections.map((s, idx) =>
            idx === 0 ? { ...s, fields: [...s.fields, ...generatedFields] } : s
          ),
        }))
      }
    }
    setSmartPasteText('')
    setIsSmartPasteOpen(false)
  }

  // All previous fields list for Conditional Rule selector
  const allFieldsFlat = form.sections.flatMap(s => s.fields)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ===================================================================== */}
      {/* STUDIO STICKY TOP NAVIGATION BAR                                      */}
      {/* ===================================================================== */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          border: '1px solid #e2e8f0',
          padding: '16px 22px',
          boxShadow: '0 8px 28px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'sticky',
          top: 12,
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: isSaving ? '#94a3b8' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isSaving ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
              title="Salvar e voltar para lista de formulários"
            >
              <ArrowLeft size={18} />
            </button>

            <input
              type="text"
              aria-label="Título do formulário"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              style={{
                flex: 1,
                fontSize: 19,
                fontWeight: 800,
                color: '#0f172a',
                border: '1px solid transparent',
                borderRadius: 10,
                padding: '6px 10px',
                background: 'transparent',
                fontFamily: "'Outfit', sans-serif",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />

            <select
              aria-label="Status do formulário"
              value={form.status}
              onChange={e =>
                setForm(prev => ({ ...prev, status: e.target.value as any }))
              }
              style={{
                padding: '7px 12px',
                borderRadius: 99,
                border: '1px solid #cbd5e1',
                fontSize: 12.5,
                fontWeight: 800,
                background:
                  form.status === 'ativo'
                    ? '#dcfce7'
                    : form.status === 'rascunho'
                    ? '#fef3c7'
                    : '#f1f5f9',
                color:
                  form.status === 'ativo'
                    ? '#15803d'
                    : form.status === 'rascunho'
                    ? '#b45309'
                    : '#475569',
                cursor: 'pointer',
              }}
            >
              <option value="ativo">🟢 Ativo (Recebendo Respostas)</option>
              <option value="rascunho">🟡 Rascunho</option>
              <option value="encerrado">⚪ Encerrado</option>
            </select>

            {form.settings?.publicLink && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 99,
                  background: '#dcfce7',
                  border: '1.5px solid #86efac',
                  color: '#15803d',
                  fontSize: 12.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
                title="Qualquer pessoa com o link pode entrar e responder sem estar logada"
              >
                <Globe size={13} /> Link Público Aberto
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onOpenManualEntry()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 11,
                border: '1px solid #10b981',
                background: '#ecfdf5',
                color: '#059669',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={15} /> + Adicionar Resposta
            </button>

            <button
              type="button"
              onClick={handleCopyShareLink}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 11,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiedLink ? <Check size={15} color="#10b981" /> : <Link2 size={15} />}
              {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                background: savedToast ? '#10b981' : primaryColor,
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 14px ${primaryColor}40`,
              }}
            >
              {savedToast ? <Check size={16} /> : <Save size={16} />}
              {isSaving ? 'Salvando...' : savedToast ? 'Salvo com Sucesso!' : 'Salvar Formulário'}
            </button>
          </div>
        </div>

        {/* STUDIO TABS (PERGUNTAS | LAYOUT | CONFIGURAÇÕES | PRÉ-VISUALIZAR | RESPOSTAS) */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 12,
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'perguntas', label: '1. Perguntas & Estrutura', icon: FileText },
            { id: 'layout', label: '2. Personalizar Layout & Tema', icon: Palette },
            { id: 'config', label: '3. Configurações & Regras', icon: Settings },
            { id: 'preview', label: '4. Pré-visualizar Formulário', icon: Eye },
            {
              id: 'respostas',
              label: `5. Relatório de Respostas (${responses.length})`,
              icon: BarChart3,
            },
          ].map(t => {
            const Icon = t.icon
            const active = studioTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStudioTab(t.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 11,
                  border: active ? `1.5px solid ${primaryColor}` : '1px solid transparent',
                  background: active ? `${primaryColor}12` : 'transparent',
                  color: active ? primaryColor : '#64748b',
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PERGUNTAS & ESTRUTURA (CONSTRUTOR)                             */}
      {/* ===================================================================== */}
      {studioTab === 'perguntas' && (
        <div style={{ maxWidth: 920, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Form Header Configuration Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 22,
              border: '1px solid #e2e8f0',
              borderTop: `6px solid ${primaryColor}`,
              padding: 26,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Cabeçalho e Identificação do Formulário
              </span>

              <button
                type="button"
                onClick={() => setIsSmartPasteOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 10,
                  border: '1px solid #c7d2fe',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <ClipboardPaste size={15} /> ⚡ Colar Perguntas em Lote (Smart Paste)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <div>
                <label
                  htmlFor="builder-form-title"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}
                >
                  Título Principal do Formulário *
                </label>
                <input
                  id="builder-form-title"
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Pesquisa de Clima e Satisfação 2026"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="builder-form-category"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}
                >
                  Categoria em Gestão de Pessoas
                </label>
                <select
                  id="builder-form-category"
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#f8fafc',
                  }}
                >
                  {FORM_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="builder-form-subtitle"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}
              >
                Subtítulo (Opcional)
              </label>
              <input
                id="builder-form-subtitle"
                type="text"
                value={form.subtitle || ''}
                onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Ex: Acompanhamento trimestral da equipe pedagógica e administrativa"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label
                htmlFor="builder-form-desc"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569' }}
              >
                Instruções / Descrição Inicial para o Colaborador (Você também pode formatar o texto e colar imagens com Ctrl+V)
              </label>
              <FormRichTextEditor
                id="builder-form-desc"
                value={form.description || ''}
                onChange={val => setForm(prev => ({ ...prev, description: val }))}
                primaryColor={primaryColor}
                minHeight={120}
                placeholder="Explique o objetivo deste formulário, regras e orientações de preenchimento..."
                onImagePaste={async file => {
                  const imageUrl = await uploadFormImageFile(file, 1400, 0.84)
                  const newMedia: FormMediaItem = {
                    id: `img-${Date.now()}`,
                    url: imageUrl,
                    caption: '',
                    width: '100%',
                    align: 'center',
                    position: 'below',
                  }
                  setForm(prev => ({
                    ...prev,
                    instructionMedia: [...(prev.instructionMedia || []), newMedia],
                  }))
                }}
              />

              {/* Imagens inseridas no texto de instruções do cabeçalho */}
              <MediaCollectionEditor
                media={form.instructionMedia}
                onChange={nextMedia =>
                  setForm(prev => ({ ...prev, instructionMedia: nextMedia }))
                }
                primaryColor={primaryColor}
                buttonLabel="+ Inserir Imagem nas Instruções do Cabeçalho"
                defaultPosition="below"
              />
            </div>

            {/* Editor de Capa (Banner) e Logo do Cabeçalho */}
            <HeaderBannerAndLogoEditor
              theme={form.theme}
              primaryColor={primaryColor}
              onChangeTheme={patch =>
                setForm(prev => ({
                  ...prev,
                  theme: { ...prev.theme, ...patch },
                }))
              }
            />
          </div>

          {/* SECTIONS & QUESTIONS LOOP */}
          {form.sections.map((section, sIdx) => (
            <div
              key={section.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: '#f1f5f9',
                padding: 20,
                borderRadius: 24,
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Section Header Bar */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '16px 20px',
                  borderRadius: 16,
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 280,
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          padding: '5px 11px',
                          borderRadius: 8,
                          background: primaryColor,
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.02em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Seção {sIdx + 1} de {form.sections.length}
                      </span>

                      {/* Botões de Ordenar Seção */}
                      {form.sections.length > 1 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            background: '#f1f5f9',
                            padding: '3px 4px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <button
                            type="button"
                            disabled={sIdx === 0}
                            onClick={() => moveSection(sIdx, 'up')}
                            title={
                              sIdx === 0
                                ? 'Esta já é a primeira seção'
                                : `Subir Seção ${sIdx + 1} (Mover para posição ${sIdx})`
                            }
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: '1px solid ' + (sIdx === 0 ? 'transparent' : '#cbd5e1'),
                              background: sIdx === 0 ? 'transparent' : '#ffffff',
                              color: sIdx === 0 ? '#94a3b8' : '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: sIdx === 0 ? 'not-allowed' : 'pointer',
                              boxShadow: sIdx === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={sIdx === form.sections.length - 1}
                            onClick={() => moveSection(sIdx, 'down')}
                            title={
                              sIdx === form.sections.length - 1
                                ? 'Esta já é a última seção'
                                : `Descer Seção ${sIdx + 1} (Mover para posição ${sIdx + 2})`
                            }
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border:
                                '1px solid ' +
                                (sIdx === form.sections.length - 1 ? 'transparent' : '#cbd5e1'),
                              background:
                                sIdx === form.sections.length - 1 ? 'transparent' : '#ffffff',
                              color: sIdx === form.sections.length - 1 ? '#94a3b8' : '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: sIdx === form.sections.length - 1 ? 'not-allowed' : 'pointer',
                              boxShadow:
                                sIdx === form.sections.length - 1
                                  ? 'none'
                                  : '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      aria-label={`Título da seção ${sIdx + 1}`}
                      value={section.title}
                      placeholder="Título da Seção..."
                      onChange={e => updateSection(section.id, { title: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#0f172a',
                        minWidth: 160,
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {form.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setIsReorderSectionsOpen(true)}
                        title="Abrir painel para ver e reordenar todas as seções"
                        style={{
                          padding: '6px 11px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <ArrowUpDown size={13} /> Reordenar Seções
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => duplicateSection(section.id)}
                      title="Duplicar esta seção inteira com suas perguntas"
                      style={{
                        padding: '6px 11px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Copy size={13} /> Duplicar Seção
                    </button>

                    {form.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        title="Excluir esta seção"
                        style={{
                          padding: '6px 11px',
                          borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Trash2 size={13} /> Remover Seção
                      </button>
                    )}
                  </div>
                </div>
                <FormRichTextEditor
                  ariaLabel={`Descrição e instruções da seção ${sIdx + 1}`}
                  value={section.description || ''}
                  onChange={val => updateSection(section.id, { description: val })}
                  placeholder="Instruções ou descrição opcional desta seção (formate com a barra de ferramentas ou cole imagens com Ctrl+V)..."
                  minHeight={70}
                  compact
                  primaryColor={primaryColor}
                  onImagePaste={async file => {
                    const imageUrl = await uploadFormImageFile(file, 1400, 0.84)
                    const newMedia: FormMediaItem = {
                      id: `img-${Date.now()}`,
                      url: imageUrl,
                      caption: '',
                      width: '100%',
                      align: 'center',
                      position: 'below',
                    }
                    updateSection(section.id, {
                      media: [...(section.media || []), newMedia],
                    })
                  }}
                />
                <MediaCollectionEditor
                  media={section.media}
                  onChange={nextMedia => updateSection(section.id, { media: nextMedia })}
                  primaryColor={primaryColor}
                  buttonLabel="+ Inserir Imagem nas Instruções desta Seção"
                  defaultPosition="below"
                />
              </div>

              {/* Fields Inside Section */}
              {section.fields.map((field, fIdx) => {
                const isFocused = activeFieldId === field.id
                const advPanel = openAdvancedPanel[field.id] || null
                const otherFieldsForCondition = allFieldsFlat.filter(f => f.id !== field.id)

                return (
                  <div
                    key={field.id}
                    onClick={() => setActiveFieldId(field.id)}
                    style={{
                      background: '#ffffff',
                      borderRadius: 18,
                      border: isFocused ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                      borderLeft: `6px solid ${isFocused ? primaryColor : '#cbd5e1'}`,
                      padding: '20px 22px',
                      boxShadow: isFocused
                        ? '0 10px 28px rgba(15, 23, 42, 0.07)'
                        : '0 2px 6px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Row 1: Question Title + Type Selector + Width Toggle */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        aria-label={`Título da pergunta ${fIdx + 1}`}
                        value={field.title}
                        onChange={e =>
                          updateField(section.id, field.id, { title: e.target.value })
                        }
                        placeholder="Digite o enunciado da pergunta..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 15,
                          fontWeight: 700,
                          color: '#0f172a',
                          background: '#f8fafc',
                          boxSizing: 'border-box',
                        }}
                      />

                      <select
                        aria-label="Tipo de campo"
                        value={field.type}
                        onChange={e =>
                          updateField(section.id, field.id, {
                            type: e.target.value as FormFieldType,
                          })
                        }
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: '#0f172a',
                          background: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        {FIELD_TYPE_CATALOG.map(item => (
                          <option key={item.type} value={item.type}>
                            {item.badge} {item.label} ({item.group})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          updateField(section.id, field.id, {
                            width: field.width === '50%' ? '100%' : '50%',
                          })
                        }
                        title="Alternar largura: 100% ou 50% (2 colunas lado a lado)"
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: field.width === '50%' ? '#eef2ff' : '#ffffff',
                          color: field.width === '50%' ? '#4f46e5' : '#475569',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {field.width === '50%' ? '½ Coluna (50%)' : 'Largura 100%'}
                      </button>
                    </div>

                    {/* Row 2: Helper Description / Instructions & Placeholder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            field.type === 'texto_curto' ||
                            field.type === 'paragrafo' ||
                            field.type === 'numero_moeda'
                              ? '1fr 1fr'
                              : '1fr',
                          gap: 10,
                        }}
                      >
                        {field.type === 'bloco_informativo' || field.type === 'bloco_imagem' ? (
                          <FormRichTextEditor
                            ariaLabel="Texto de instruções ou explicação do bloco"
                            value={field.description || ''}
                            onChange={val =>
                              updateField(section.id, field.id, { description: val })
                            }
                            placeholder="Digite aqui o texto completo de instruções, orientações ou legenda detalhada..."
                            minHeight={90}
                            compact
                            primaryColor={primaryColor}
                            onImagePaste={async file => {
                              const imageUrl = await uploadFormImageFile(file, 1400, 0.84)
                              const newMedia: FormMediaItem = {
                                id: `img-${Date.now()}`,
                                url: imageUrl,
                                caption: '',
                                width: '100%',
                                align: 'center',
                                position: 'below',
                              }
                              updateField(section.id, field.id, {
                                media: [...(field.media || []), newMedia],
                              })
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            aria-label="Descrição ou instrução de ajuda da pergunta"
                            value={field.description || ''}
                            onChange={e =>
                              updateField(section.id, field.id, { description: e.target.value })
                            }
                            placeholder="Instrução ou texto de apoio opcional para esta pergunta..."
                            style={{
                              padding: '8px 12px',
                              borderRadius: 9,
                              border: '1px solid #e2e8f0',
                              fontSize: 13,
                              color: '#475569',
                            }}
                          />
                        )}
                        {(field.type === 'texto_curto' ||
                          field.type === 'paragrafo' ||
                          field.type === 'numero_moeda') && (
                          <input
                            type="text"
                            aria-label="Texto de exemplo (placeholder)"
                            value={field.placeholder || ''}
                            onChange={e =>
                              updateField(section.id, field.id, { placeholder: e.target.value })
                            }
                            placeholder="Placeholder (ex: Digite aqui...)"
                            style={{
                              padding: '8px 12px',
                              borderRadius: 9,
                              border: '1px solid #e2e8f0',
                              fontSize: 13,
                              color: '#475569',
                            }}
                          />
                        )}
                      </div>

                      {/* Image Attachment Editor for this Question / Instruction Block / Image Block */}
                      <MediaCollectionEditor
                        media={field.media}
                        onChange={nextMedia =>
                          updateField(section.id, field.id, { media: nextMedia })
                        }
                        primaryColor={primaryColor}
                        buttonLabel={
                          field.type === 'bloco_imagem'
                            ? '+ Selecionar Imagem / Infográfico Principal'
                            : field.type === 'bloco_informativo'
                            ? '+ Inserir Imagem neste Bloco de Instruções'
                            : '+ Inserir Imagem na Pergunta / Instrução'
                        }
                        defaultPosition="below"
                      />
                    </div>

                    {/* TYPE-SPECIFIC CONFIGURATION: OPTIONS LIST */}
                    {(field.type === 'multipla_escolha' ||
                      field.type === 'caixas_selecao' ||
                      field.type === 'lista_suspensa' ||
                      field.type === 'ranking') && (
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: 14,
                          borderRadius: 14,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>
                          Opções de Resposta (com suporte a imagem por opção):
                        </div>
                        {(field.options || []).map((opt, oIdx) => {
                          const optImg = field.optionImages?.[oIdx]
                          return (
                            <div
                              key={oIdx}
                              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#94a3b8',
                                    width: 22,
                                  }}
                                >
                                  {oIdx + 1}.
                                </span>
                                <input
                                  type="text"
                                  aria-label={`Opção ${oIdx + 1}`}
                                  value={opt}
                                  onChange={e => {
                                    const nextOpts = [...(field.options || [])]
                                    nextOpts[oIdx] = e.target.value
                                    updateField(section.id, field.id, { options: nextOpts })
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    fontSize: 13.5,
                                    background: '#ffffff',
                                  }}
                                />

                                {/* Upload image for this option */}
                                {(field.type === 'multipla_escolha' ||
                                  field.type === 'caixas_selecao') && (
                                  <label
                                    title="Adicionar imagem a esta opção"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '6px 9px',
                                      borderRadius: 8,
                                      border: optImg
                                        ? `1px solid ${primaryColor}`
                                        : '1px solid #cbd5e1',
                                      background: optImg ? `${primaryColor}12` : '#ffffff',
                                      color: optImg ? primaryColor : '#64748b',
                                      cursor: 'pointer',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      gap: 4,
                                    }}
                                  >
                                    <ImageIcon size={14} />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={async e => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const imageUrl = await uploadFormImageFile(
                                          file,
                                          800,
                                          0.85
                                        )
                                        updateField(section.id, field.id, {
                                          optionImages: {
                                            ...(field.optionImages || {}),
                                            [oIdx]: imageUrl,
                                          },
                                        })
                                        e.target.value = ''
                                      }}
                                    />
                                  </label>
                                )}

                                {(field.options?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextOpts = (field.options || []).filter(
                                        (_, i) => i !== oIdx
                                      )
                                      updateField(section.id, field.id, { options: nextOpts })
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      fontWeight: 800,
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {optImg && (
                                <div
                                  style={{
                                    marginLeft: 30,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    background: '#ffffff',
                                    padding: 6,
                                    borderRadius: 10,
                                    border: '1px solid #e2e8f0',
                                     alignSelf: 'flex-start',
                                  }}
                                >
                                  <img
                                    src={optImg}
                                    alt={`Imagem da opção ${opt}`}
                                    style={{
                                      height: 54,
                                      width: 'auto',
                                      borderRadius: 6,
                                      objectFit: 'cover',
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextMap = { ...(field.optionImages || {}) }
                                      delete nextMap[oIdx]
                                      updateField(section.id, field.id, {
                                        optionImages: nextMap,
                                      })
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: '1px solid #fecaca',
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Remover Imagem
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const nextOpts = [
                                ...(field.options || []),
                                `Opção ${(field.options?.length || 0) + 1}`,
                              ]
                              updateField(section.id, field.id, { options: nextOpts })
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: `1px dashed ${primaryColor}`,
                              background: '#ffffff',
                              color: primaryColor,
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            + Adicionar Opção
                          </button>

                          {(field.type === 'multipla_escolha' ||
                            field.type === 'caixas_selecao') && (
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(field.allowOther)}
                                onChange={e =>
                                  updateField(section.id, field.id, {
                                    allowOther: e.target.checked,
                                  })
                                }
                              />
                              Incluir campo &quot;Outro (especificar)&quot;
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TYPE-SPECIFIC: ESCALA LINEAR */}
                    {field.type === 'escala_linear' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: 10,
                          background: '#f8fafc',
                          padding: 14,
                          borderRadius: 12,
                        }}
                      >
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                            Início da Escala
                          </label>
                          <select
                            value={field.scaleMin ?? 1}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                scaleMin: Number(e.target.value),
                              })
                            }
                            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                          >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                            Fim da Escala
                          </label>
                          <select
                            value={field.scaleMax ?? 5}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                scaleMax: Number(e.target.value),
                              })
                            }
                            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                          >
                            <option value={5}>5</option>
                            <option value={7}>7</option>
                            <option value={10}>10</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                            Rótulo Mínimo
                          </label>
                          <input
                            type="text"
                            value={field.scaleMinLabel || ''}
                            onChange={e =>
                              updateField(section.id, field.id, { scaleMinLabel: e.target.value })
                            }
                            placeholder="Ex: Insatisfeito"
                            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                            Rótulo Máximo
                          </label>
                          <input
                            type="text"
                            value={field.scaleMaxLabel || ''}
                            onChange={e =>
                              updateField(section.id, field.id, { scaleMaxLabel: e.target.value })
                            }
                            placeholder="Ex: Muito Satisfeito"
                            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* TYPE-SPECIFIC: GRADE (LINHAS X COLUNAS) */}
                    {(field.type === 'grade_multipla' || field.type === 'grade_caixas') && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 14,
                          background: '#f8fafc',
                          padding: 14,
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                            Linhas (Itens avaliados — 1 por linha):
                          </div>
                          <textarea
                            rows={4}
                            value={(field.gridRows || []).join('\n')}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                gridRows: e.target.value.split('\n').filter(Boolean),
                              })
                            }
                            style={{
                              width: '100%',
                              padding: 10,
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              fontSize: 13,
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                            Colunas (Opções de avaliação — 1 por linha):
                          </div>
                          <textarea
                            rows={4}
                            value={(field.gridCols || []).join('\n')}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                gridCols: e.target.value.split('\n').filter(Boolean),
                              })
                            }
                            style={{
                              width: '100%',
                              padding: 10,
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              fontSize: 13,
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* TYPE-SPECIFIC: NÚMERO / MOEDA */}
                    {field.type === 'numero_moeda' && (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                          Formato Numérico:
                        </span>
                        <select
                          value={field.numberFormat || 'inteiro'}
                          onChange={e =>
                            updateField(section.id, field.id, {
                              numberFormat: e.target.value as any,
                            })
                          }
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                        >
                          <option value="inteiro">Número Inteiro</option>
                          <option value="decimal">Número Decimal</option>
                          <option value="moeda_brl">Moeda Real (R$)</option>
                          <option value="percentual">Percentual (%)</option>
                        </select>
                      </div>
                    )}

                    {/* TYPE-SPECIFIC: USUÁRIO LOGADO AUTOMÁTICO */}
                    {(field.type === 'usuario_logado' || field.autoFillUser) && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1.5px solid #86efac',
                          borderRadius: 14,
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: '#16a34a',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <UserCheck size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#166534' }}>
                                ⚡ Preenchimento Automático pelo Usuário Logado
                              </div>
                              <div style={{ fontSize: 12, color: '#15803d' }}>
                                O formulário detecta a sessão do colaborador autenticado e preenche este campo automaticamente.
                              </div>
                            </div>
                          </div>

                          {field.type === 'texto_curto' && field.autoFillUser && (
                            <button
                              type="button"
                              onClick={() =>
                                updateField(section.id, field.id, {
                                  autoFillUser: undefined,
                                })
                              }
                              style={{
                                padding: '4px 10px',
                                borderRadius: 8,
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Desativar Preenchimento Automático
                            </button>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 12,
                            background: '#ffffff',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          <div>
                            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                              Dado do Usuário a Preencher:
                            </label>
                            <select
                              value={field.autoFillUser || 'nome'}
                              onChange={e =>
                                updateField(section.id, field.id, {
                                  autoFillUser: e.target.value as any,
                                })
                              }
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, fontWeight: 600 }}
                            >
                              <option value="nome">👤 Nome Completo do Colaborador (Padrão)</option>
                              <option value="email">✉️ E-mail Corporativo</option>
                              <option value="cargo">💼 Cargo / Função</option>
                              <option value="departamento">🏢 Setor / Departamento</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#1f2937', cursor: 'pointer', marginTop: 14 }}>
                              <input
                                type="checkbox"
                                checked={field.lockAutoFill !== false}
                                onChange={e =>
                                  updateField(section.id, field.id, {
                                    lockAutoFill: e.target.checked,
                                  })
                                }
                                style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                              />
                              🔒 Bloquear alteração (Somente Leitura - Garante autenticidade)
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* QUICK ACTION TO ACTIVATE AUTO-FILL FOR TEXTO_CURTO */}
                    {field.type === 'texto_curto' && !field.autoFillUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(section.id, field.id, {
                              autoFillUser: 'nome',
                              lockAutoFill: true,
                              placeholder: 'Preenchido automaticamente pelo login',
                            })
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #86efac',
                            background: '#f0fdf4',
                            color: '#166534',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <UserCheck size={14} />
                          ⚡ Preencher automaticamente com o nome do usuário logado
                        </button>
                      </div>
                    )}

                    {/* ADVANCED DRAWER: CONDITIONAL LOGIC / VALIDATION / QUIZ */}
                    {advPanel === 'conditional' && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#1e40af' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(field.conditional?.enabled)}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                conditional: {
                                  enabled: e.target.checked,
                                  sourceFieldId:
                                    field.conditional?.sourceFieldId ||
                                    otherFieldsForCondition[0]?.id ||
                                    '',
                                  operator: field.conditional?.operator || 'equals',
                                  value: field.conditional?.value || 'Sim',
                                },
                              })
                            }
                          />
                          Exibir apenas se a pergunta:
                        </label>

                        <select
                          value={field.conditional?.sourceFieldId || ''}
                          onChange={e =>
                            updateField(section.id, field.id, {
                              conditional: {
                                enabled: true,
                                sourceFieldId: e.target.value,
                                operator: field.conditional?.operator || 'equals',
                                value: field.conditional?.value || '',
                              },
                            })
                          }
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: 12.5, maxWidth: 240 }}
                        >
                          <option value="">-- Escolha a pergunta base --</option>
                          {otherFieldsForCondition.map(of => (
                            <option key={of.id} value={of.id}>
                              {of.title}
                            </option>
                          ))}
                        </select>

                        <select
                          value={field.conditional?.operator || 'equals'}
                          onChange={e =>
                            updateField(section.id, field.id, {
                              conditional: {
                                enabled: true,
                                sourceFieldId: field.conditional?.sourceFieldId || '',
                                operator: e.target.value as any,
                                value: field.conditional?.value || '',
                              },
                            })
                          }
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: 12.5 }}
                        >
                          <option value="equals">For igual a</option>
                          <option value="not_equals">For diferente de</option>
                          <option value="contains">Contiver</option>
                        </select>

                        <input
                          type="text"
                          value={field.conditional?.value || ''}
                          onChange={e =>
                            updateField(section.id, field.id, {
                              conditional: {
                                enabled: true,
                                sourceFieldId: field.conditional?.sourceFieldId || '',
                                operator: field.conditional?.operator || 'equals',
                                value: e.target.value,
                              },
                            })
                          }
                          placeholder="Valor esperado (ex: Sim)"
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: 12.5 }}
                        />
                      </div>
                    )}

                    {advPanel === 'validation' && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: '#fefce8',
                          border: '1px solid #fde047',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#854d0e' }}>
                            Formato Exigido
                          </label>
                          <select
                            value={field.validation?.regexType || 'livre'}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                validation: {
                                  ...(field.validation || {}),
                                  regexType: e.target.value as any,
                                },
                              })
                            }
                            style={{ width: '100%', padding: 7, borderRadius: 8, border: '1px solid #fde047', marginTop: 4 }}
                          >
                            <option value="livre">Texto Livre</option>
                            <option value="email">E-mail válido</option>
                            <option value="cpf">CPF (11 dígitos)</option>
                            <option value="telefone">Telefone com DDD</option>
                            <option value="url">Link / URL</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#854d0e' }}>
                            Limite Máx. Caracteres
                          </label>
                          <input
                            type="number"
                            value={field.validation?.maxLength || ''}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                validation: {
                                  ...(field.validation || {}),
                                  maxLength: e.target.value ? Number(e.target.value) : undefined,
                                },
                              })
                            }
                            placeholder="Sem limite"
                            style={{ width: '100%', padding: 7, borderRadius: 8, border: '1px solid #fde047', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#854d0e' }}>
                            Mensagem de Erro Customizada
                          </label>
                          <input
                            type="text"
                            value={field.validation?.customErrorText || ''}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                validation: {
                                  ...(field.validation || {}),
                                  customErrorText: e.target.value,
                                },
                              })
                            }
                            placeholder="Ex: Preencha conforme padrão..."
                            style={{ width: '100%', padding: 7, borderRadius: 8, border: '1px solid #fde047', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}

                    {advPanel === 'quiz' && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: '#f5f3ff',
                          border: '1px solid #ddd6fe',
                          display: 'grid',
                          gridTemplateColumns: '120px 1fr',
                          gap: 10,
                        }}
                      >
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5b21b6' }}>
                            Pontos da Questão
                          </label>
                          <input
                            type="number"
                            value={field.quizPoints || 0}
                            onChange={e =>
                              updateField(section.id, field.id, {
                                quizPoints: Number(e.target.value),
                              })
                            }
                            style={{ width: '100%', padding: 7, borderRadius: 8, border: '1px solid #c4b5fd', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5b21b6' }}>
                            Resposta Correta (Gabarito)
                          </label>
                          <input
                            type="text"
                            value={
                              Array.isArray(field.quizCorrectAnswer)
                                ? field.quizCorrectAnswer.join(', ')
                                : field.quizCorrectAnswer || ''
                            }
                            onChange={e =>
                              updateField(section.id, field.id, {
                                quizCorrectAnswer: e.target.value,
                              })
                            }
                            placeholder="Digite exatamente a opção correta..."
                            style={{ width: '100%', padding: 7, borderRadius: 8, border: '1px solid #c4b5fd', marginTop: 4, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Row Bottom: Actions & Toggles */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid #f1f5f9',
                        paddingTop: 12,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenAdvancedPanel(prev => ({
                              ...prev,
                              [field.id]:
                                prev[field.id] === 'conditional' ? null : 'conditional',
                            }))
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 10px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: field.conditional?.enabled ? '#dbeafe' : '#f8fafc',
                            color: field.conditional?.enabled ? '#1d4ed8' : '#64748b',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <GitBranch size={13} /> Lógica Condicional
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenAdvancedPanel(prev => ({
                              ...prev,
                              [field.id]:
                                prev[field.id] === 'validation' ? null : 'validation',
                            }))
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 10px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <ShieldAlert size={13} /> Validação
                        </button>

                        {form.settings?.isQuizMode && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenAdvancedPanel(prev => ({
                                ...prev,
                                [field.id]: prev[field.id] === 'quiz' ? null : 'quiz',
                              }))
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: '1px solid #ddd6fe',
                              background: '#f5f3ff',
                              color: '#6d28d9',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Award size={13} /> Gabarito ({field.quizPoints || 0} pts)
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {form.sections.length > 1 && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Mover p/:</span>
                            <select
                              value={section.id}
                              onChange={e => moveFieldToSection(section.id, e.target.value, field.id)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 7,
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                fontSize: 11.5,
                                color: '#1e293b',
                                cursor: 'pointer',
                              }}
                            >
                              {form.sections.map((s, idx) => (
                                <option key={s.id} value={s.id}>
                                  Seção {idx + 1}: {s.title.slice(0, 18) || `Seção ${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={sIdx === 0 && fIdx === 0}
                          onClick={() => moveField(section.id, fIdx, 'up')}
                          title={
                            sIdx === 0 && fIdx === 0
                              ? 'Primeira pergunta do formulário'
                              : fIdx === 0
                              ? 'Mover para o final da seção anterior'
                              : 'Subir pergunta'
                          }
                          style={{
                            padding: 6,
                            borderRadius: 7,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            cursor: sIdx === 0 && fIdx === 0 ? 'not-allowed' : 'pointer',
                            color: sIdx === 0 && fIdx === 0 ? '#cbd5e1' : '#334155',
                          }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            sIdx === form.sections.length - 1 && fIdx === section.fields.length - 1
                          }
                          onClick={() => moveField(section.id, fIdx, 'down')}
                          title={
                            sIdx === form.sections.length - 1 &&
                            fIdx === section.fields.length - 1
                              ? 'Última pergunta do formulário'
                              : fIdx === section.fields.length - 1
                              ? 'Mover para o início da próxima seção'
                              : 'Descer pergunta'
                          }
                          style={{
                            padding: 6,
                            borderRadius: 7,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            cursor:
                              sIdx === form.sections.length - 1 &&
                              fIdx === section.fields.length - 1
                                ? 'not-allowed'
                                : 'pointer',
                            color:
                              sIdx === form.sections.length - 1 &&
                              fIdx === section.fields.length - 1
                                ? '#cbd5e1'
                                : '#334155',
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateField(section.id, field.id)}
                          title="Duplicar pergunta"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 7,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Copy size={13} /> Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(section.id, field.id)}
                          title="Excluir pergunta"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 7,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>

                        {field.type !== 'bloco_informativo' && field.type !== 'bloco_imagem' && (
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              marginLeft: 6,
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: field.required ? primaryColor : '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={e =>
                                updateField(section.id, field.id, {
                                  required: e.target.checked,
                                })
                              }
                              style={{ accentColor: primaryColor }}
                            />
                            Obrigatória
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Quick Add Field Bar inside Section */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: '12px 16px',
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginRight: 4 }}>
                  + Adicionar Campo:
                </span>
                {[
                  { type: 'texto_curto', label: '+ Texto Curto' },
                  { type: 'usuario_logado', label: '+ Nome do Usuário 👤' },
                  { type: 'paragrafo', label: '+ Parágrafo' },
                  { type: 'multipla_escolha', label: '+ Múltipla Escolha' },
                  { type: 'caixas_selecao', label: '+ Checkboxes' },
                  { type: 'escala_linear', label: '+ Escala 1-5' },
                  { type: 'nps', label: '+ eNPS 0-10' },
                  { type: 'termometro_humor', label: '+ Emojis Clima' },
                  { type: 'grade_multipla', label: '+ Grade/Matriz' },
                  { type: 'ranking', label: '+ Ranking' },
                  { type: 'assinatura_digital', label: '+ Assinatura' },
                  { type: 'bloco_informativo', label: '+ Bloco de Instrução' },
                  { type: 'bloco_imagem', label: '+ Imagem / Cartaz' },
                ].map(btn => (
                  <button
                    key={btn.type}
                    type="button"
                    onClick={() =>
                      addFieldToSection(section.id, btn.type as FormFieldType)
                    }
                    style={{
                      padding: '6px 12px',
                      borderRadius: 9,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Add New Section & Reorder Section Buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={addSection}
              style={{
                flex: 1,
                minWidth: 260,
                padding: '16px',
                borderRadius: 18,
                border: `2px dashed ${primaryColor}`,
                background: '#ffffff',
                color: primaryColor,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Layers size={18} /> + Adicionar Nova Seção / Página ao Formulário
            </button>
            {form.sections.length > 1 && (
              <button
                type="button"
                onClick={() => setIsReorderSectionsOpen(true)}
                title="Reordenar a sequência de seções do formulário"
                style={{
                  padding: '16px 22px',
                  borderRadius: 18,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                }}
              >
                <ArrowUpDown size={17} /> Reordenar Seções ({form.sections.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PERSONALIZAR LAYOUT & TEMA                                     */}
      {/* ===================================================================== */}
      {studioTab === 'layout' && (
        <div
          style={{
            maxWidth: 920,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 22,
              border: '1px solid #e2e8f0',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Paletas e Temas Visuais Prontos
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
                Escolha uma identidade visual profissional ou personalize as cores, capa do cabeçalho e modo de exibição.
              </p>
            </div>

            <HeaderBannerAndLogoEditor
              theme={form.theme}
              primaryColor={primaryColor}
              onChangeTheme={patch =>
                setForm(prev => ({
                  ...prev,
                  theme: { ...prev.theme, ...patch },
                }))
              }
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 14,
              }}
            >
              {FORM_THEME_PRESETS.map(preset => {
                const isSelected = form.theme.presetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          presetId: preset.id,
                          primaryColor: preset.primaryColor,
                          accentColor: preset.accentColor,
                          backgroundColor: preset.backgroundColor,
                          headerGradient: preset.headerGradient,
                          cardStyle: preset.cardStyle,
                        },
                      }))
                    }
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: isSelected
                        ? `2.5px solid ${preset.primaryColor}`
                        : '1px solid #e2e8f0',
                      background: '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        height: 44,
                        borderRadius: 10,
                        background: preset.headerGradient,
                      }}
                    />
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                      {preset.name}
                    </div>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                borderTop: '1px solid #f1f5f9',
                paddingTop: 20,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Modo de Exibição para o Colaborador
                </label>
                <select
                  value={form.theme.displayMode}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      theme: { ...prev.theme, displayMode: e.target.value as any },
                    }))
                  }
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 700 }}
                >
                  <option value="classic_all">Lista Completa (Estilo Google Forms)</option>
                  <option value="section_wizard">Paginado por Seções (Passo a Passo)</option>
                  <option value="focus_one_by_one">Modo Foco (1 Pergunta por Tela - Typeform)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Estilo dos Cartões de Pergunta
                </label>
                <select
                  value={form.theme.cardStyle}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      theme: { ...prev.theme, cardStyle: e.target.value as any },
                    }))
                  }
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 700 }}
                >
                  <option value="classic_top_bar">Clássico com Barra Superior Colorida</option>
                  <option value="elevated">Sombra Suave Moderna</option>
                  <option value="glass">Glassmorphism Translúcido</option>
                  <option value="bordered">Minimalista com Bordas Nítidas</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Tipografia do Formulário
                </label>
                <select
                  value={form.theme.fontFamily}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      theme: { ...prev.theme, fontFamily: e.target.value as any },
                    }))
                  }
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 700 }}
                >
                  <option value="modern">Moderna Sans-Serif (Inter / Outfit)</option>
                  <option value="editorial">Editorial Clássica (Serif)</option>
                  <option value="technical">Técnica Monospace</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Cor Principal Personalizada
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.theme.primaryColor}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        theme: { ...prev.theme, primaryColor: e.target.value },
                      }))
                    }
                    style={{ width: 44, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.theme.primaryColor}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        theme: { ...prev.theme, primaryColor: e.target.value },
                      }))
                    }
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Cor da Fonte do Título Principal
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.theme.headerTitleColor || '#ffffff'}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          headerTitleColor: e.target.value,
                          headerSubtitleColor: e.target.value,
                        },
                      }))
                    }
                    title="Escolha a cor da fonte do título principal"
                    style={{ width: 44, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.theme.headerTitleColor || '#ffffff'}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          headerTitleColor: e.target.value,
                          headerSubtitleColor: e.target.value,
                        },
                      }))
                    }
                    placeholder="#ffffff"
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          headerTitleColor: '#ffffff',
                          headerSubtitleColor: '#ffffff',
                        },
                      }))
                    }
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚪ Branco
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.theme.showProgressBar}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      theme: { ...prev.theme, showProgressBar: e.target.checked },
                    }))
                  }
                />
                Mostrar barra de progresso de preenchimento
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.theme.showQuestionNumbers}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      theme: { ...prev.theme, showQuestionNumbers: e.target.checked },
                    }))
                  }
                />
                Numerar questões automaticamente (1, 2, 3...)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CONFIGURAÇÕES & REGRAS DE ACESSO                               */}
      {/* ===================================================================== */}
      {studioTab === 'config' && (
        <div
          style={{
            maxWidth: 840,
            margin: '0 auto',
            width: '100%',
            background: '#ffffff',
            borderRadius: 22,
            border: '1px solid #e2e8f0',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            Regras de Autenticação, Respostas e Confirmação
          </h3>

          {/* STATUS GERAL / ACEITANDO RESPOSTAS (PADRÃO GOOGLE FORMS) */}
          <div
            style={{
              padding: '18px 22px',
              borderRadius: 16,
              background: form.status === 'ativo' ? '#f0fdf4' : '#fef2f2',
              border: form.status === 'ativo' ? '2px solid #16a34a' : '2px solid #ef4444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15.5, fontWeight: 800, color: '#0f172a' }}>
                <span>{form.status === 'ativo' ? '🟢 Aceitando Novas Respostas' : '⏸️ Respostas Pausadas / Encerrado'}</span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 99,
                    background: form.status === 'ativo' ? '#dcfce7' : '#fee2e2',
                    color: form.status === 'ativo' ? '#15803d' : '#b91c1c',
                  }}
                >
                  {form.status === 'ativo' ? 'Ativo' : form.status === 'encerrado' ? 'Encerrado' : 'Rascunho'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                {form.status === 'ativo'
                  ? 'O formulário está aberto para receber respostas pelo link ou no sistema.'
                  : 'O recebimento de respostas está suspenso. Marque para abrir o formulário.'}
              </div>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 13.5,
                color: form.status === 'ativo' ? '#15803d' : '#b91c1c',
                background: '#ffffff',
                padding: '9px 16px',
                borderRadius: 12,
                border: '1.5px solid #cbd5e1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              }}
            >
              <span>{form.status === 'ativo' ? 'Aceitando Respostas' : 'Pausado'}</span>
              <input
                type="checkbox"
                checked={form.status === 'ativo'}
                onChange={e => {
                  const nextStatus = e.target.checked ? 'ativo' : 'encerrado'
                  setForm(prev => ({ ...prev, status: nextStatus }))
                }}
                style={{ width: 22, height: 22, accentColor: '#16a34a', cursor: 'pointer' }}
              />
            </label>
          </div>

          {[
            {
              key: 'publicLink',
              title: 'Link Público (Qualquer pessoa com o link pode entrar e responder sem estar logada)',
              desc: 'Permite que qualquer pessoa acesse e responda este formulário pelo link sem login, conta ou senha no sistema. Ideal para inscrições de eventos (ex: confraternizações), pesquisas com famílias/comunidade e público externo.',
              badge: 'Acesso Público Aberto 🌐',
            },
            {
              key: 'requireLogin',
              title: 'Exigir login de colaborador no sistema para responder',
              desc: 'Garante que apenas colaboradores com acesso ativo ao sistema respondam e vincula nome/cargo automaticamente.',
            },
            {
              key: 'allowAccessWithoutModule',
              title: 'Liberar acesso para qualquer usuário (sem estar com acesso ao módulo)',
              desc: 'Permite que professores e colaboradores de qualquer setor acessem e respondam este formulário pelo link, mesmo se o perfil deles não tiver acesso ao Módulo de Gestão de Pessoas.',
              badge: 'Acesso Amplo',
            },
            {
              key: 'allowManualAdminEntry',
              title: 'Permitir que Gestores/RH adicionem respostas manualmente',
              desc: 'Habilita o botão de lançamento manual para registrar respostas de entrevistas presenciais, fichas físicas ou colaboradores operacionais.',
            },
            {
              key: 'allowMultipleResponses',
              title: 'Permitir múltiplas respostas pelo mesmo colaborador',
              desc: 'Se desativado, cada colaborador logado poderá enviar apenas 1 resposta (ideal para pesquisas e votações).',
            },
            {
              key: 'allowEditOwnResponse',
              title: 'Permitir que o colaborador edite sua resposta após enviar',
              desc: 'Enquanto o formulário estiver ativo, o colaborador poderá atualizar sua resposta enviada.',
            },
            {
              key: 'confidentialMode',
              title: 'Modo Confidencial nos Relatórios (Ocultar nomes nas respostas)',
              desc: 'O sistema valida o login para evitar duplicidade, mas exibe apenas o protocolo nas respostas para proteger o anonimato.',
            },
            {
              key: 'isQuizMode',
              title: 'Ativar Modo Avaliação / Teste com Pontuação (Quiz)',
              desc: 'Permite atribuir pontos e gabarito às questões para calcular a nota do colaborador automaticamente.',
            },
          ].map(item => (
            <label
              key={item.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderRadius: 16,
                background:
                  item.key === 'publicLink' && form.settings?.publicLink
                    ? '#f0fdf4'
                    : item.key === 'allowAccessWithoutModule' && form.settings?.allowAccessWithoutModule
                    ? '#f0fdf4'
                    : '#f8fafc',
                border:
                  item.key === 'publicLink' && form.settings?.publicLink
                    ? '1.5px solid #16a34a'
                    : item.key === 'allowAccessWithoutModule' && form.settings?.allowAccessWithoutModule
                    ? '1.5px solid #10b981'
                    : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                  <span>{item.title}</span>
                  {(item as any).badge && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#15803d' }}>
                      {(item as any).badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {item.desc}
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean((form.settings as any)[item.key])}
                onChange={e => {
                  const val = e.target.checked
                  setForm(prev => {
                    const nextSettings: any = {
                      ...prev.settings,
                      [item.key]: val,
                    }
                    if (item.key === 'publicLink' && val) {
                      nextSettings.requireLogin = false
                    } else if (item.key === 'requireLogin' && val) {
                      nextSettings.publicLink = false
                    }
                    const nextStatus =
                      item.key === 'publicLink' && val && prev.status === 'rascunho'
                        ? 'ativo'
                        : prev.status
                    return {
                      ...prev,
                      status: nextStatus,
                      settings: nextSettings,
                    }
                  })
                }}
                style={{ width: 22, height: 22, accentColor: primaryColor, flexShrink: 0 }}
              />
            </label>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Data Limite de Encerramento (Opcional)
              </label>
              <input
                type="date"
                value={form.settings.deadline || ''}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    settings: { ...prev.settings, deadline: e.target.value },
                  }))
                }
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Título da Tela de Confirmação
              </label>
              <input
                type="text"
                value={form.settings.confirmationTitle}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    settings: { ...prev.settings, confirmationTitle: e.target.value },
                  }))
                }
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Mensagem de Agradecimento Após Envio
            </label>
            <textarea
              rows={2}
              value={form.settings.confirmationMessage}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  settings: { ...prev.settings, confirmationMessage: e.target.value },
                }))
              }
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: PRÉ-VISUALIZAR FORMULÁRIO (DESKTOP / MOBILE)                   */}
      {/* ===================================================================== */}
      {studioTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: previewDevice === 'desktop' ? '#0f172a' : '#ffffff',
                color: previewDevice === 'desktop' ? '#ffffff' : '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Monitor size={16} /> Visão Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: previewDevice === 'mobile' ? '#0f172a' : '#ffffff',
                color: previewDevice === 'mobile' ? '#ffffff' : '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Smartphone size={16} /> Visão Celular
            </button>
          </div>

          <div
            style={{
              maxWidth: previewDevice === 'mobile' ? 420 : '100%',
              margin: '0 auto',
              width: '100%',
              transition: 'max-width 0.25s ease',
            }}
          >
            <FormRenderer
              form={form}
              currentUser={currentUser}
              isAdmin={true}
              isPreview={true}
              colaboradoresList={colaboradoresList}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: RELATÓRIO DE RESPOSTAS INTEGRADO                               */}
      {/* ===================================================================== */}
      {studioTab === 'respostas' && (
        <FormAnalyticsDashboard
          form={form}
          responses={responses}
          colaboradoresList={colaboradoresList}
          onAddManualResponse={prefillColab => onOpenManualEntry(prefillColab, null)}
          onEditResponse={resp => onOpenManualEntry(undefined, resp)}
          onDeleteResponse={onDeleteResponse}
          onBulkImportSuccess={updatedList => onResponsesChange(updatedList)}
        />
      )}

      {/* SMART PASTE MODAL */}
      {isSmartPasteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              maxWidth: 620,
              width: '100%',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              ⚡ Colar Perguntas em Lote (Smart Paste)
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
              Cole suas perguntas separadas por uma linha em branco. Se houver linhas começando com{' '}
              <code>-</code> abaixo da pergunta, elas serão convertidas em opções de Múltipla Escolha automaticamente!
            </p>
            <textarea
              rows={8}
              value={smartPasteText}
              onChange={e => setSmartPasteText(e.target.value)}
              placeholder={`Exemplo:\nQual seu grau de satisfação com o ambiente?\n- Muito satisfeito\n- Satisfeito\n- Regular\n\nDeixe sua sugestão para a equipe:`}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                fontSize: 13.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsSmartPasteOpen(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplySmartPaste}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: primaryColor,
                  color: '#ffffff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Gerar Perguntas Automaticamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REORDER SECTIONS MODAL */}
      <AnimatePresence>
        {isReorderSectionsOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setIsReorderSectionsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.16 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: 22,
                maxWidth: 580,
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: '24px 28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <ArrowUpDown size={20} color={primaryColor} /> Reordenar Seções do Formulário
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    Altere a ordem de exibição das páginas/seções usando os botões subir e descer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReorderSectionsOpen(false)}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#64748b',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: '55vh',
                  paddingRight: 4,
                }}
              >
                {form.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          padding: '4px 9px',
                          borderRadius: 7,
                          background: primaryColor,
                          color: '#ffffff',
                          fontSize: 11.5,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sec.title || `Seção ${idx + 1}`}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {sec.fields.length} {sec.fields.length === 1 ? 'pergunta' : 'perguntas'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, 'up')}
                        title={idx === 0 ? 'Esta já é a primeira seção' : `Subir para Seção ${idx}`}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: idx === 0 ? '#f1f5f9' : '#ffffff',
                          color: idx === 0 ? '#cbd5e1' : '#0f172a',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: idx === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.sections.length - 1}
                        onClick={() => moveSection(idx, 'down')}
                        title={
                          idx === form.sections.length - 1
                            ? 'Esta já é a última seção'
                            : `Descer para Seção ${idx + 2}`
                        }
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: idx === form.sections.length - 1 ? '#f1f5f9' : '#ffffff',
                          color: idx === form.sections.length - 1 ? '#cbd5e1' : '#0f172a',
                          cursor: idx === form.sections.length - 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: idx === form.sections.length - 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingTop: 12,
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsReorderSectionsOpen(false)}
                  style={{
                    padding: '9px 24px',
                    borderRadius: 10,
                    background: primaryColor,
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
