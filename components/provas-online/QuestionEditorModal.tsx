'use client'

import React, { useState, useRef, useMemo } from 'react'
import {
  X, Plus, Trash2, Check, AlertCircle, HelpCircle,
  FileText, Sparkles, CheckCircle2, Sliders, Image as ImageIcon,
  Calculator, Info, UploadCloud, Loader2, ZoomIn, Eye, Columns,
  Edit3, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight, Scale
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import {
  QuestaoProva,
  TipoQuestao,
  AlternativaQuestao,
  ItemVerdadeiroFalso,
  CriterioAvaliacao,
  ConfigPontuacaoParcial,
  DificuldadeQuestao
} from '@/types/provas-online'
import { RichTextToolbarEditor } from './RichTextToolbarEditor'
import { HtmlContent } from '@/components/HtmlContent'

interface QuestionEditorModalProps {
  open: boolean
  question: QuestaoProva | null
  onClose: () => void
  onSave: (q: QuestaoProva) => void
}

export function QuestionEditorModal({
  open,
  question,
  onClose,
  onSave
}: QuestionEditorModalProps) {
  if (!open || !question) return null

  // View mode: 'edit' | 'split' | 'preview'
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit')

  // Local editable draft of the question, strictly isolated by question type
  const [draft, setDraft] = useState<QuestaoProva>(() => {
    const isMC = question.tipo === 'multipla_escolha' || question.tipo === 'multipla_selecao'
    const isVF = question.tipo === 'verdadeiro_falso'
    const isDissertativa = question.tipo === 'dissertativa'

    return {
      ...question,
      alternativas: isMC
        ? (question.alternativas && question.alternativas.length > 0
            ? [...question.alternativas]
            : [
                { id: 'alt-1', letra: 'A', texto: '', correta: true, ordem: 0 },
                { id: 'alt-2', letra: 'B', texto: '', correta: false, ordem: 1 },
                { id: 'alt-3', letra: 'C', texto: '', correta: false, ordem: 2 },
                { id: 'alt-4', letra: 'D', texto: '', correta: false, ordem: 3 },
              ])
        : undefined,
      itensVF: isVF
        ? (question.itensVF && question.itensVF.length > 0
            ? [...question.itensVF]
            : [
                { id: 'vf-1', afirmacao: '', correta: true, ordem: 0 },
                { id: 'vf-2', afirmacao: '', correta: false, ordem: 1 },
                { id: 'vf-3', afirmacao: '', correta: true, ordem: 2 }
              ])
        : undefined,
      criteriosAvaliacao: isDissertativa
        ? (question.criteriosAvaliacao && question.criteriosAvaliacao.length > 0
            ? [...question.criteriosAvaliacao]
            : [
                { id: 'crit-1', descricao: 'Domínio do conteúdo e clareza argumentativa', pontosMaximos: 1.0 }
              ])
        : undefined,
      configPontuacaoParcial: question.configPontuacaoParcial || {
        permiteParcial: true,
        tipoCalculo: 'proporcional',
        explicacaoCalculo: 'Pontuação distribuída proporcionalmente entre as opções corretas'
      }
    }
  })

  // Image Upload & Gallery State for Question
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  // Detects images currently embedded in the statement (enunciado) along with width & alignment metadata
  const detectedImagesMeta = useMemo(() => {
    if (!draft.enunciado) return []
    if (typeof window === 'undefined') return []
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(draft.enunciado, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img'))
      return imgs.map((img, index) => {
        const src = img.getAttribute('src') || ''
        const widthAttr = img.getAttribute('data-width') || img.style.width || '75%'
        const widthNum = parseInt(widthAttr, 10) || 75
        const alignAttr = (img.getAttribute('data-align') || img.parentElement?.style?.textAlign || 'center') as 'left' | 'center' | 'right'
        return {
          index,
          src,
          widthPct: widthNum,
          align: (['left', 'center', 'right'].includes(alignAttr) ? alignAttr : 'center') as 'left' | 'center' | 'right',
        }
      }).filter(item => Boolean(item.src))
    } catch {
      return []
    }
  }, [draft.enunciado])

  const detectedImages = useMemo(() => detectedImagesMeta.map(m => m.src), [detectedImagesMeta])

  const handleUpdateImageInEnunciado = (imgIdx: number, updates: { widthPct?: number; align?: 'left' | 'center' | 'right' }) => {
    if (!draft.enunciado || typeof window === 'undefined') return
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(draft.enunciado, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img'))
      const img = imgs[imgIdx]
      if (!img) return

      const currentWidth = parseInt(img.getAttribute('data-width') || img.style.width || '75', 10) || 75
      const currentAlign = (img.getAttribute('data-align') || 'center') as 'left' | 'center' | 'right'

      const nextWidth = updates.widthPct ?? currentWidth
      const nextAlign = updates.align ?? currentAlign

      img.style.width = `${nextWidth}%`
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.borderRadius = '8px'
      img.style.display = 'block'
      img.setAttribute('data-width', `${nextWidth}%`)
      img.setAttribute('data-align', nextAlign)

      if (nextAlign === 'center') {
        img.style.marginLeft = 'auto'
        img.style.marginRight = 'auto'
      } else if (nextAlign === 'left') {
        img.style.marginLeft = '0'
        img.style.marginRight = 'auto'
      } else {
        img.style.marginLeft = 'auto'
        img.style.marginRight = '0'
      }

      const parent = img.parentElement
      if (parent && parent !== doc.body && (parent.tagName === 'DIV' || parent.tagName === 'P')) {
        parent.style.textAlign = nextAlign
      }

      setDraft(p => ({ ...p, enunciado: doc.body.innerHTML }))
    } catch {
      // ignore
    }
  }

  const handleUploadQuestionImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado não é uma imagem válida.')
      return
    }

    try {
      setUploadingImage(true)
      const res = await uploadFileToSupabase({
        bucket: 'comunicados-midia',
        folder: 'provas-online/questoes',
        file,
        usageType: 'common'
      })

      let finalUrl = ''
      if (res.ok && res.url) {
        finalUrl = res.url
      } else {
        // Fallback to data URL
        finalUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
      }

      if (finalUrl) {
        const imgTag = `<div style="margin: 10px 0; text-align: center;"><img src="${finalUrl}" alt="${file.name}" data-align="center" data-width="75%" style="width: 75%; max-width: 100%; height: auto; border-radius: 8px; display: block; margin-left: auto; margin-right: auto;" /></div>`
        setDraft(p => ({
          ...p,
          enunciado: (p.enunciado ? `${p.enunciado}\n` : '') + imgTag
        }))
        toast.success('Imagem inserida na questão! Use os controles de enquadramento para ajustar tamanho ou posição.')
      }
    } catch (err: any) {
      toast.error('Erro ao adicionar imagem: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImageFromEnunciado = (srcToRemove: string, indexToRemove?: number) => {
    if (typeof window !== 'undefined' && indexToRemove !== undefined && draft.enunciado) {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(draft.enunciado, 'text/html')
        const imgs = Array.from(doc.querySelectorAll('img'))
        const target = imgs[indexToRemove]
        if (target) {
          const parent = target.parentElement
          target.remove()
          if (parent && parent !== doc.body && (parent.textContent || '').trim() === '' && parent.children.length === 0) {
            parent.remove()
          }
          setDraft(p => ({ ...p, enunciado: doc.body.innerHTML.trim() }))
          toast.success('Imagem removida da questão!')
          return
        }
      } catch {
        // fallback to regex below
      }
    }
    const escaped = srcToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tagRegex = new RegExp(`(<(?:div|p)[^>]*>\\s*)?<img\\b[^>]*?\\bsrc=["']${escaped}["'][^>]*?>(\\s*<\\/(?:div|p)>)?`, 'gi')
    setDraft(p => ({
      ...p,
      enunciado: (p.enunciado || '').replace(tagRegex, '').trim()
    }))
    toast.success('Imagem removida da questão!')
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

  const handleMoveAlternative = (idx: number, direction: 'up' | 'down') => {
    setDraft(prev => {
      const current = [...(prev.alternativas || [])]
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= current.length) return prev
      const [moved] = current.splice(idx, 1)
      current.splice(targetIdx, 0, moved)
      const relettered = current.map((a, i) => ({
        ...a,
        letra: letters[i] || String.fromCharCode(65 + i),
        ordem: i
      }))
      return {
        ...prev,
        alternativas: relettered
      }
    })
  }

  const handleTypeChange = (newType: TipoQuestao) => {
    setDraft(prev => {
      let novasAlternativas = prev.alternativas
      let novosItensVF = prev.itensVF
      let novosCriterios = prev.criteriosAvaliacao

      if (newType === 'multipla_escolha' || newType === 'multipla_selecao') {
        novosItensVF = undefined
        if (!novasAlternativas || novasAlternativas.length === 0) {
          novasAlternativas = [
            { id: 'alt-1', letra: 'A', texto: '', correta: true, ordem: 0 },
            { id: 'alt-2', letra: 'B', texto: '', correta: false, ordem: 1 },
            { id: 'alt-3', letra: 'C', texto: '', correta: false, ordem: 2 },
            { id: 'alt-4', letra: 'D', texto: '', correta: false, ordem: 3 },
          ]
        }
      } else if (newType === 'verdadeiro_falso') {
        novasAlternativas = undefined
        if (!novosItensVF || novosItensVF.length === 0) {
          novosItensVF = [
            { id: 'vf-1', afirmacao: '', correta: true, ordem: 0 },
            { id: 'vf-2', afirmacao: '', correta: false, ordem: 1 },
            { id: 'vf-3', afirmacao: '', correta: true, ordem: 2 }
          ]
        }
      } else if (newType === 'dissertativa') {
        novasAlternativas = undefined
        novosItensVF = undefined
        if (!novosCriterios || novosCriterios.length === 0) {
          novosCriterios = [
            { id: 'crit-1', descricao: 'Domínio do conteúdo e clareza argumentativa', pontosMaximos: 1.0 }
          ]
        }
      }

      return {
        ...prev,
        tipo: newType,
        alternativas: novasAlternativas,
        itensVF: novosItensVF,
        criteriosAvaliacao: novosCriterios
      }
    })
  }

  const handleAddAlternative = () => {
    const current = draft.alternativas || []
    if (current.length >= 8) {
      toast.error('Limite máximo de 8 alternativas por questão atingido.')
      return
    }
    const nextIdx = current.length
    const nextLetter = letters[nextIdx] || String.fromCharCode(65 + nextIdx)
    const newAlt: AlternativaQuestao = {
      id: crypto.randomUUID(),
      letra: nextLetter,
      texto: '',
      correta: false,
      ordem: nextIdx
    }
    setDraft(prev => ({
      ...prev,
      alternativas: [...(prev.alternativas || []), newAlt]
    }))
  }

  const handleRemoveAlternative = (id: string) => {
    const current = draft.alternativas || []
    if (current.length <= 2) {
      toast.error('Uma questão de múltipla escolha precisa ter no mínimo 2 alternativas.')
      return
    }
    const filtered = current.filter(a => a.id !== id).map((a, i) => ({
      ...a,
      letra: letters[i] || String.fromCharCode(65 + i),
      ordem: i
    }))
    setDraft(prev => ({
      ...prev,
      alternativas: filtered
    }))
  }

  const handleToggleAltCorrect = (id: string) => {
    setDraft(prev => {
      const current = prev.alternativas || []
      if (prev.tipo === 'multipla_escolha') {
        // Only one can be correct
        return {
          ...prev,
          alternativas: current.map(a => ({
            ...a,
            correta: a.id === id
          }))
        }
      } else {
        // Multiple can be correct
        return {
          ...prev,
          alternativas: current.map(a => a.id === id ? { ...a, correta: !a.correta } : a)
        }
      }
    })
  }

  // True / False handlers
  const handleAddVF = () => {
    const current = draft.itensVF || []
    const newVF: ItemVerdadeiroFalso = {
      id: crypto.randomUUID(),
      afirmacao: '',
      correta: true,
      ordem: current.length
    }
    setDraft(prev => ({
      ...prev,
      itensVF: [...current, newVF]
    }))
  }

  const handleRemoveVF = (id: string) => {
    const current = draft.itensVF || []
    if (current.length <= 1) {
      toast.error('A questão precisa de ao menos 1 afirmação.')
      return
    }
    setDraft(prev => ({
      ...prev,
      itensVF: current.filter(item => item.id !== id)
    }))
  }

  // Criterios dissertativa
  const handleAddCriterio = () => {
    const current = draft.criteriosAvaliacao || []
    const newCrit: CriterioAvaliacao = {
      id: crypto.randomUUID(),
      descricao: '',
      pontosMaximos: 0.5
    }
    setDraft(prev => ({
      ...prev,
      criteriosAvaliacao: [...current, newCrit]
    }))
  }

  const handleRemoveCriterio = (id: string) => {
    const current = draft.criteriosAvaliacao || []
    setDraft(prev => ({
      ...prev,
      criteriosAvaliacao: current.filter(c => c.id !== id)
    }))
  }

  const handleValidateAndSave = () => {
    const plainEnunciado = draft.enunciado ? draft.enunciado.replace(/<[^>]*>/g, '').trim() : ''
    if (!plainEnunciado && !draft.enunciado?.includes('<img')) {
      toast.error('Informe o enunciado da questão.')
      return
    }

    if (draft.pontuacao <= 0) {
      toast.error('A pontuação da questão deve ser maior que zero.')
      return
    }

    const payload: QuestaoProva = { ...draft }

    if (draft.tipo === 'multipla_escolha' || draft.tipo === 'multipla_selecao') {
      const alts = draft.alternativas || []
      if (alts.length < 2) {
        toast.error('Cadastre ao menos duas alternativas.')
        return
      }
      const emptyAlt = alts.some(a => {
        const plain = a.texto ? a.texto.replace(/<[^>]*>/g, '').trim() : ''
        return !plain && !a.texto?.includes('<img')
      })
      if (emptyAlt) {
        toast.error('Preencha o texto de todas as alternativas.')
        return
      }
      const hasCorrect = alts.some(a => a.correta)
      if (!hasCorrect) {
        toast.error('Selecione ao menos uma alternativa correta como gabarito.')
        return
      }
      delete payload.itensVF
      delete payload.respostaEsperada
      delete payload.criteriosAvaliacao
    } else if (draft.tipo === 'verdadeiro_falso') {
      const vfs = draft.itensVF || []
      if (vfs.length === 0) {
        toast.error('Cadastre ao menos uma afirmação para Verdadeiro ou Falso.')
        return
      }
      const emptyVF = vfs.some(i => !i.afirmacao.trim())
      if (emptyVF) {
        toast.error('Preencha o texto de todas as afirmações V/F.')
        return
      }
      delete payload.alternativas
      delete payload.respostaEsperada
      delete payload.criteriosAvaliacao
    } else if (draft.tipo === 'dissertativa') {
      delete payload.alternativas
      delete payload.itensVF
    }

    onSave(payload)
  }

  const totalRubricaPoints = useMemo(() => {
    return Number(
      ((draft.criteriosAvaliacao || []).reduce((acc, c) => acc + (Number(c.pontosMaximos) || 0), 0)).toFixed(2)
    )
  }, [draft.criteriosAvaliacao])

  const handleBalanceCriterios = () => {
    const crits = draft.criteriosAvaliacao || []
    if (crits.length === 0) return
    const targetTotal = Math.max(0.1, Number(draft.pontuacao) || 1)
    const perCrit = Number((targetTotal / crits.length).toFixed(2))
    const balanced = crits.map((c, idx) => {
      if (idx === crits.length - 1) {
        const prevSum = perCrit * (crits.length - 1)
        return { ...c, pontosMaximos: Number(Math.max(0.05, targetTotal - prevSum).toFixed(2)) }
      }
      return { ...c, pontosMaximos: perCrit }
    })
    setDraft(p => ({ ...p, criteriosAvaliacao: balanced }))
    toast.success(`Pontuação de ${targetTotal} pts distribuída entre os ${crits.length} critérios!`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div
        className={`w-full h-full sm:h-auto sm:max-h-[93vh] ${
          viewMode === 'split' ? 'max-w-6xl' : 'max-w-4xl'
        } bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Editor de Questão
              </h3>
              <p className="text-xs text-slate-500 hidden sm:block">
                Configure tipo, pontuação, enunciado, enquadramento de figuras e alternativas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Mode Switcher: Edição | Dividido | Visão do Aluno */}
            <div className="flex items-center bg-slate-200/75 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={12} />
                <span>Edição</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`hidden md:flex px-2.5 py-1.5 rounded-lg text-[11px] font-bold items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Editar e ver o enquadramento do aluno lado a lado em tempo real"
              >
                <Columns size={12} />
                <span>Dividido (Ao Vivo)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={12} />
                <span>Visão do Aluno</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body (Supports Edit, Split, and Full Preview) */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 text-slate-800 ${
            viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-5'
          }`}
        >
          {/* ── LEFT / MAIN COLUMN: EDITOR FORM ── */}
          {viewMode !== 'preview' && (
            <div className={viewMode === 'split' ? 'lg:col-span-7 space-y-5' : 'space-y-5'}>
              {/* Top Bar: Tipo, Pontuação & Metadados em Grid 12 colunas equilibrado */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80">
                {/* Tipo de Questão: 8 colunas */}
                <div className="sm:col-span-8 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders size={13} className="text-sky-600" /> Tipo de Questão *
                  </label>
                  <select
                    value={draft.tipo}
                    onChange={e => handleTypeChange(e.target.value as TipoQuestao)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                  >
                    <option value="multipla_escolha">Objetiva - Uma Alternativa Correta (Apenas 1)</option>
                    <option value="multipla_selecao">Objetiva - Múltipla Seleção (Várias Corretas)</option>
                    <option value="verdadeiro_falso">Verdadeiro ou Falso (V ou F por item)</option>
                    <option value="dissertativa">Dissertativa com Resposta Digitada</option>
                  </select>
                </div>

                {/* Pontuação: 4 colunas */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calculator size={13} className="text-sky-600" /> Pontuação (Valor) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={draft.pontuacao}
                      onChange={e => setDraft(p => ({ ...p, pontuacao: Math.max(0, Number(e.target.value)) }))}
                      className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 select-none">pts</span>
                  </div>
                </div>

                {/* Nível de Dificuldade: 4 colunas */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nível de Dificuldade</label>
                  <select
                    value={draft.dificuldade || 'medio'}
                    onChange={e => setDraft(p => ({ ...p, dificuldade: e.target.value as DificuldadeQuestao }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Médio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>

                {/* Assunto / Conteúdo: 4 colunas */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Assunto / Conteúdo (Tag)</label>
                  <input
                    type="text"
                    placeholder="Ex: Teorema de Pitágoras"
                    value={(draft.tags && draft.tags[0]) || ''}
                    onChange={e => {
                      const val = e.target.value
                      setDraft(p => ({ ...p, tags: val ? [val] : [] }))
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                </div>

                {/* BNCC: 4 colunas */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Código BNCC (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: EF09MA06"
                    value={draft.habilidadeBNCC || ''}
                    onChange={e => setDraft(p => ({ ...p, habilidadeBNCC: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-mono uppercase focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                </div>
              </div>

              {/* Enunciado */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText size={15} className="text-sky-600" /> Enunciado da Questão *
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Suporta fórmulas LaTeX, tabelas, textos de apoio e ajuste de figuras
                  </span>
                </div>
                <RichTextToolbarEditor
                  value={draft.enunciado}
                  onChange={val => setDraft(p => ({ ...p, enunciado: val }))}
                  placeholder="Digite com clareza o texto do enunciado, contexto ou problema a ser resolvido..."
                  minHeight={150}
                  variant="full"
                  allowImageUpload={true}
                />

                {/* ── IMAGENS DA QUESTÃO / ENQUADRAMENTO RÁPIDO ── */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadQuestionImage(e.target.files[0])
                        e.target.value = ''
                      }
                    }}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <ImageIcon size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          Figuras & Enquadramento da Questão
                          {detectedImagesMeta.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-200/60 text-sky-800 font-extrabold text-[10px]">
                              {detectedImagesMeta.length}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 hidden sm:block">
                          Ajuste o tamanho (P/M/G/100%) e alinhamento de cada figura ou clique nela direto no editor acima.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Enviando...
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Anexar Imagem
                        </>
                      )}
                    </button>
                  </div>

                  {/* Drag & drop dropzone if no images yet */}
                  {detectedImagesMeta.length === 0 ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDraggingImage(true) }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={e => {
                        e.preventDefault()
                        setIsDraggingImage(false)
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleUploadQuestionImage(e.dataTransfer.files[0])
                        }
                      }}
                      onClick={() => imageInputRef.current?.click()}
                      className={`border border-dashed rounded-xl py-2.5 px-4 text-center cursor-pointer transition-all ${
                        isDraggingImage
                          ? 'border-sky-500 bg-sky-100/60'
                          : 'border-sky-200 hover:border-sky-400 bg-white/70 hover:bg-sky-50/50'
                      }`}
                    >
                      <p className="text-[11px] text-slate-600 font-medium m-0 flex items-center justify-center gap-1.5">
                        <UploadCloud size={14} className="text-sky-600 shrink-0" />
                        <span>Arraste imagens aqui ou clique para selecionar (PNG, JPG, WEBP)</span>
                      </p>
                    </div>
                  ) : (
                    /* Gallery of detected images with direct size & alignment controls */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {detectedImagesMeta.map((imgMeta, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs flex items-center gap-3"
                        >
                          <div
                            onClick={() => setEnlargedImage(imgMeta.src)}
                            className="h-16 w-20 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0 cursor-pointer relative group"
                            title="Clique para ampliar"
                          >
                            <img
                              src={imgMeta.src}
                              alt={`Imagem ${imgIdx + 1}`}
                              className="max-h-full max-w-full object-contain rounded"
                            />
                            <div className="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={14} />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-700">
                                Figura {imgIdx + 1} ({imgMeta.widthPct}%)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEnlargedImage(imgMeta.src)}
                                  className="p-1 rounded-md text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Ampliar Figura"
                                >
                                  <ZoomIn size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImageFromEnunciado(imgMeta.src, imgMeta.index)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Remover Figura"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Quick Width + Alignment Row */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                {[25, 50, 75, 100].map(w => (
                                  <button
                                    key={w}
                                    type="button"
                                    onClick={() => handleUpdateImageInEnunciado(imgMeta.index, { widthPct: w })}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                      Math.abs(imgMeta.widthPct - w) <= 5
                                        ? 'bg-sky-600 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title={`Redimensionar para ${w}% da largura`}
                                  >
                                    {w}%
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 ml-auto">
                                {[
                                  { id: 'left' as const, icon: AlignLeft, title: 'Esquerda' },
                                  { id: 'center' as const, icon: AlignCenter, title: 'Centro' },
                                  { id: 'right' as const, icon: AlignRight, title: 'Direita' },
                                ].map(al => {
                                  const Icon = al.icon
                                  return (
                                    <button
                                      key={al.id}
                                      type="button"
                                      onClick={() => handleUpdateImageInEnunciado(imgMeta.index, { align: al.id })}
                                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                        imgMeta.align === al.id
                                          ? 'bg-sky-600 text-white'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                      title={`Alinhar: ${al.title}`}
                                    >
                                      <Icon size={11} />
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── SEÇÃO: OBJETIVAS (ÚNICA OU MÚLTIPLA SELEÇÃO) ─────────────── */}
              {(draft.tipo === 'multipla_escolha' || draft.tipo === 'multipla_selecao') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Alternativas e Gabarito Oficial
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {draft.tipo === 'multipla_escolha'
                          ? 'Clique na letra da alternativa para definir o gabarito. Você também pode inserir figuras ou fórmulas nas alternativas.'
                          : 'Marque todas as alternativas corretas desta questão.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAlternative}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200 flex items-center gap-1.5 self-start sm:self-auto transition-colors shadow-2xs cursor-pointer"
                    >
                      <Plus size={14} /> Adicionar Alternativa
                    </button>
                  </div>

                  {/* Regra de pontuação parcial para múltipla seleção */}
                  {draft.tipo === 'multipla_selecao' && (
                    <div className="p-3 rounded-xl bg-white border border-sky-200 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sky-900">
                        <Info size={15} className="text-sky-600 shrink-0" />
                        Critério de Pontuação para Múltipla Seleção
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pontuacaoParcial"
                            checked={draft.configPontuacaoParcial?.permiteParcial === true}
                            onChange={() => setDraft(p => ({
                              ...p,
                              configPontuacaoParcial: {
                                permiteParcial: true,
                                tipoCalculo: 'proporcional',
                                explicacaoCalculo: 'Pontuação proporcional por alternativa correta assinalada'
                              }
                            }))}
                            className="accent-sky-600"
                          />
                          <span className="text-slate-700 font-medium">Pontuação Parcial Proporcional</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pontuacaoParcial"
                            checked={draft.configPontuacaoParcial?.permiteParcial === false}
                            onChange={() => setDraft(p => ({
                              ...p,
                              configPontuacaoParcial: {
                                permiteParcial: false,
                                tipoCalculo: 'estrita',
                                explicacaoCalculo: 'Exige todas as alternativas corretas para pontuar'
                              }
                            }))}
                            className="accent-sky-600"
                          />
                          <span className="text-slate-700 font-medium">Tudo ou Nada (Exige todas corretas)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Lista de alternativas com editor inline + figuras + reordenação */}
                  <div className="space-y-2.5">
                    {(draft.alternativas || []).map((alt, idx) => (
                      <div
                        key={alt.id}
                        className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                          alt.correta
                            ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleAltCorrect(alt.id)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-all cursor-pointer relative ${
                            alt.correta
                              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                          title={alt.correta ? 'Alternativa Correta (Gabarito Oficial)' : 'Clique para marcar como correta'}
                        >
                          <span>{alt.letra}</span>
                          {alt.correta && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border border-white rounded-full flex items-center justify-center">
                              <Check size={8} strokeWidth={3} className="text-white" />
                            </span>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <RichTextToolbarEditor
                            value={alt.texto}
                            onChange={val => {
                              setDraft(p => ({
                                ...p,
                                alternativas: (p.alternativas || []).map((a, i) => i === idx ? { ...a, texto: val } : a)
                              }))
                            }}
                            placeholder={`Texto ou figura da alternativa ${alt.letra}...`}
                            variant="inline"
                            minHeight={38}
                            allowImageUpload={true}
                          />
                        </div>

                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveAlternative(idx, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                            title="Subir alternativa"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (draft.alternativas || []).length - 1}
                            onClick={() => handleMoveAlternative(idx, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                            title="Descer alternativa"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveAlternative(alt.id)}
                          disabled={(draft.alternativas || []).length <= 2}
                          className={`p-2 rounded-lg transition-colors shrink-0 ${
                            (draft.alternativas || []).length <= 2
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                          }`}
                          title="Excluir alternativa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SEÇÃO: VERDADEIRO OU FALSO ────────────────────────── */}
              {draft.tipo === 'verdadeiro_falso' && (
                <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Itens e Afirmações (V ou F)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Defina as afirmações e selecione o gabarito verdadeiro (V) ou falso (F) de cada uma.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVF}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus size={14} /> Adicionar Afirmação
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(draft.itensVF || []).map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        <input
                          type="text"
                          placeholder="Texto da afirmação..."
                          value={item.afirmacao}
                          onChange={e => {
                            const val = e.target.value
                            setDraft(p => ({
                              ...p,
                              itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, afirmacao: val } : it)
                            }))
                          }}
                          className="flex-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-sky-500"
                        />

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(p => ({
                                ...p,
                                itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, correta: true } : it)
                              }))
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              item.correta
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            V (Verdadeiro)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(p => ({
                                ...p,
                                itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, correta: false } : it)
                              }))
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              !item.correta
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            F (Falso)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveVF(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-1 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SEÇÃO: DISSERTATIVA ───────────────────────────────── */}
              {draft.tipo === 'dissertativa' && (
                <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
                  <div className="border-b border-slate-200/80 pb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Gabarito do Corretor e Critérios de Avaliação
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      A resposta esperada e os critérios são confidenciais e visíveis apenas aos professores e corretores.
                    </p>
                  </div>

                  {/* Resposta Esperada */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Resposta Esperada / Padrão de Resposta</label>
                    <textarea
                      rows={3}
                      placeholder="Descreva o que o aluno deve abordar para atingir pontuação máxima..."
                      value={draft.respostaEsperada || ''}
                      onChange={e => setDraft(p => ({ ...p, respostaEsperada: e.target.value }))}
                      className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Configurações adicionais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Limite de Palavras (Opcional)</label>
                      <input
                        type="number"
                        placeholder="Ex: 250 (Deixe 0 para sem limite)"
                        value={draft.limitePalavras || ''}
                        onChange={e => setDraft(p => ({ ...p, limitePalavras: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="permiteAnexo"
                        checked={draft.permiteAnexoResolucao || false}
                        onChange={e => setDraft(p => ({ ...p, permiteAnexoResolucao: e.target.checked }))}
                        className="w-4 h-4 rounded accent-sky-600"
                      />
                      <label htmlFor="permiteAnexo" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Permitir foto ou anexo da resolução manuscrita
                      </label>
                    </div>
                  </div>

                  {/* Rubrica / Critérios */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700">Rubrica / Critérios de Correção</label>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            Math.abs(totalRubricaPoints - draft.pontuacao) <= 0.05
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          Soma: {totalRubricaPoints} / {draft.pontuacao} pts
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(draft.criteriosAvaliacao || []).length > 0 && Math.abs(totalRubricaPoints - draft.pontuacao) > 0.05 && (
                          <button
                            type="button"
                            onClick={handleBalanceCriterios}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1 cursor-pointer"
                            title="Distribuir o valor da questão igualmente entre os critérios"
                          >
                            <Scale size={12} /> Igualar aos {draft.pontuacao} pts
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddCriterio}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 border border-sky-200 cursor-pointer"
                        >
                          + Novo Critério
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(draft.criteriosAvaliacao || []).map((crit, idx) => (
                        <div key={crit.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-3">
                          <input
                            type="text"
                            placeholder="Ex: Argumentação coerente e estruturada"
                            value={crit.descricao}
                            onChange={e => {
                              const val = e.target.value
                              setDraft(p => ({
                                ...p,
                                criteriosAvaliacao: (p.criteriosAvaliacao || []).map((c, i) => i === idx ? { ...c, descricao: val } : c)
                              }))
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.25"
                              value={crit.pontosMaximos}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value))
                                setDraft(p => ({
                                  ...p,
                                  criteriosAvaliacao: (p.criteriosAvaliacao || []).map((c, i) => i === idx ? { ...c, pontosMaximos: val } : c)
                                }))
                              }}
                              className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-center"
                            />
                            <span className="text-[11px] text-slate-400 font-bold">pts</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterio(crit.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Explicação da Resposta / Feedback do Aluno */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle size={15} className="text-sky-600" />
                  Comentário Pedagógico / Explicação da Resposta (Feedback)
                </label>
                <p className="text-[11px] text-slate-500">
                  Exibido ao aluno na devolução de gabarito e resultado quando publicado pelo professor.
                </p>
                <textarea
                  rows={2}
                  placeholder="Explique detalhadamente por que o gabarito é este..."
                  value={draft.explicacaoResposta || ''}
                  onChange={e => setDraft(p => ({ ...p, explicacaoResposta: e.target.value }))}
                  className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* ── RIGHT / PREVIEW COLUMN: LIVE STUDENT FRAMING VIEW ── */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              className={
                viewMode === 'split'
                  ? 'lg:col-span-5 lg:sticky lg:top-0 space-y-3'
                  : 'max-w-2xl mx-auto w-full space-y-4'
              }
            >
              <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-sky-600" />
                  <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wider">
                    Simulação do Enquadramento do Aluno
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                  Ao Vivo
                </span>
              </div>

              {/* Framed Student Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-extrabold">
                      Questão {(draft.ordem || 0) + 1}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {draft.tipo === 'multipla_escolha' && 'Múltipla Escolha'}
                      {draft.tipo === 'multipla_selecao' && 'Múltipla Seleção'}
                      {draft.tipo === 'verdadeiro_falso' && 'Verdadeiro ou Falso'}
                      {draft.tipo === 'dissertativa' && 'Dissertativa'}
                    </span>
                    {draft.habilidadeBNCC && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                        {draft.habilidadeBNCC}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                    {draft.pontuacao} {draft.pontuacao === 1 ? 'ponto' : 'pontos'}
                  </span>
                </div>

                {/* Enunciado Rendered */}
                <div className="text-xs sm:text-sm text-slate-800 leading-relaxed min-h-[60px]">
                  {draft.enunciado ? (
                    <HtmlContent html={draft.enunciado} />
                  ) : (
                    <span className="text-slate-400 italic">
                      O enunciado digitado aparecerá aqui com fórmulas e figuras enquadradas...
                    </span>
                  )}
                </div>

                {/* Alternativas Preview */}
                {(draft.tipo === 'multipla_escolha' || draft.tipo === 'multipla_selecao') && (
                  <div className="space-y-2 pt-2">
                    {(draft.alternativas || []).map(a => (
                      <div
                        key={a.id}
                        className={`p-3 rounded-xl border flex items-start gap-3 text-xs sm:text-sm transition-all ${
                          a.correta
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : 'bg-slate-50/70 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5 ${
                            a.correta
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          {a.letra}
                        </span>
                        <div className="flex-1 min-w-0">
                          <HtmlContent html={a.texto || '<span style="color:#94a3b8;font-style:italic;">(Alternativa em branco)</span>'} />
                        </div>
                        {a.correta && (
                          <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md shrink-0">
                            Gabarito
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* V/F Preview */}
                {draft.tipo === 'verdadeiro_falso' && (
                  <div className="space-y-2 pt-2">
                    {(draft.itensVF || []).map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0 text-slate-800">
                          <HtmlContent html={item.afirmacao || '<span style="color:#94a3b8;font-style:italic;">(Afirmação em branco)</span>'} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`px-2 py-1 rounded font-extrabold text-[11px] ${
                              item.correta ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-400'
                            }`}
                          >
                            V
                          </span>
                          <span
                            className={`px-2 py-1 rounded font-extrabold text-[11px] ${
                              !item.correta ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-400'
                            }`}
                          >
                            F
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dissertativa Preview */}
                {draft.tipo === 'dissertativa' && (
                  <div className="space-y-2 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-400 h-24">
                      Área de resposta dissertativa do estudante...
                    </div>
                    {draft.limitePalavras && (
                      <div className="text-[11px] text-slate-500 text-right">
                        Limite configurado: até {draft.limitePalavras} palavras
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 bg-slate-50/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleValidateAndSave}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Check size={16} strokeWidth={2.5} /> Salvar Questão
          </button>
        </div>
      </div>

      {/* Enlarged image preview modal */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '10px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={16} />
            </button>
            <img
              src={enlargedImage}
              alt="Imagem ampliada"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '10px',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
