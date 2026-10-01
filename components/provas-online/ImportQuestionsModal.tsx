'use client'

import React, { useState, useRef } from 'react'
import {
  X, UploadCloud, FileText, CheckCircle2, AlertCircle, HelpCircle,
  Sparkles, ArrowRight, ArrowLeft, RefreshCw, Trash2, Check,
  Image as ImageIcon, Layers, BookOpen, AlertTriangle, Eye, Plus, Calculator
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import {
  QuestaoProva,
  TipoQuestao,
  AlternativaQuestao
} from '@/types/provas-online'
import {
  parseRawTextOrHtmlToQuestoes,
  extractImagesFromRtf,
  injectRtfImagesIntoHtml
} from '@/lib/provas-online/importParser'

interface ImportQuestionsModalProps {
  open: boolean
  onClose: () => void
  onImport: (importedQuestions: QuestaoProva[]) => void
  totalExamPoints: number
  currentQuestionsCount: number
}

const SAMPLE_TEXT = `1. (ENEM) A Revolução Industrial, iniciada na Inglaterra no século XVIII, transformou profundamente as relações socioeconômicas. Uma das principais consequências desse processo foi:
A) O fortalecimento das corporações de ofício medievais.
B) A consolidação do trabalho assalariado e a urbanização acelerada.
C) A descentralização das atividades fabris para o campo.
D) O declínio do capitalismo financeiro global.
E) A extinção imediata das jornadas exaustivas de trabalho.
Gabarito: B

2. Julgue os itens a seguir sobre citologia em Verdadeiro (V) ou Falso (F):
(V) As mitocôndrias são as organelas responsáveis pela respiração celular e produção de ATP.
(F) Os ribossomos são delimitados por dupla membrana lipoproteica.
(V) O complexo de Golgi atua na secreção celular e modificação de proteínas.

3. Explique sucintamente o conceito de seleção natural proposto por Charles Darwin e como ele atua sobre a variabilidade genética das populações.
`

interface PastedImageItem {
  id: string
  name: string
  src: string
  targetQ: number
}

function getSuggestedQuestionIndex(imgName: string, index: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0

  // 1. Try to extract number associated with question/image:
  // Matches "imagem_1.png", "imagem 2.jpg", "figura_3.png", "q4.png", "questao_5", "clip_image006", "image7"
  const nameMatch =
    imgName.match(/(?:q(?:uest[aã]o)?|imagem|img|image|figura|fig|clip_image)[_-\s]?0*(\d{1,3})/i) ||
    imgName.match(/(\d{1,3})/)

  if (nameMatch) {
    const parsedNum = parseInt(nameMatch[1], 10)
    if (parsedNum > 0 && parsedNum <= totalQuestions) {
      return parsedNum - 1
    }
    if (parsedNum > 0) {
      return Math.min(parsedNum - 1, totalQuestions - 1)
    }
  }

  // 2. Sequential fallback: Image 0 -> Question 1 (index 0), Image 1 -> Question 2 (index 1), etc.
  return Math.max(0, Math.min(index, totalQuestions - 1))
}

export function ImportQuestionsModal({
  open,
  onClose,
  onImport,
  totalExamPoints,
  currentQuestionsCount
}: ImportQuestionsModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file')
  const [stage, setStage] = useState<'input' | 'review'>('input')

  // File import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Paste import state
  const [pastedContent, setPastedContent] = useState('')
  const [pastedHtml, setPastedHtml] = useState('')
  const [pastedRtf, setPastedRtf] = useState('')
  const [pastedImages, setPastedImages] = useState<PastedImageItem[]>([])
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null)

  // Loading & Processing state
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')

  // Staging / Review questions state
  const [stagedQuestions, setStagedQuestions] = useState<QuestaoProva[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // Points distribution mode
  const [pointsMode, setPointsMode] = useState<'equal' | 'fixed'>('equal')
  const [fixedPointsValue, setFixedPointsValue] = useState<number>(1.0)

  if (!open) return null

  // ── FILE DRAG & DROP HANDLERS ─────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file: File) => {
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.docx') && !ext.endsWith('.doc') && !ext.endsWith('.pdf') && !ext.endsWith('.txt')) {
      toast.error('Formato não suportado. Por favor, envie arquivos .DOCX, .PDF ou .TXT.')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. O limite máximo é de 30MB.')
      return
    }
    setSelectedFile(file)
  }

  // ── PASTE WITH IMAGES LISTENER ───────────────────────────────────────────
  const handlePasteAreaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboard = e.clipboardData

    // 1. Capture RTF stream and extract embedded hex images (from Word / Docs)
    const rtfData = clipboard.getData('text/rtf')
    if (rtfData) {
      setPastedRtf(rtfData)
    }
    const rtfImages = rtfData ? extractImagesFromRtf(rtfData) : []

    // 2. Capture rich HTML from Word / Docs if available
    let htmlData = clipboard.getData('text/html')

    if (htmlData && htmlData.trim().length > 15) {
      if (rtfImages.length > 0) {
        const { injectedHtml, unassignedImages } = injectRtfImagesIntoHtml(htmlData, rtfImages)
        htmlData = injectedHtml
        if (unassignedImages.length > 0) {
          setPastedImages(prev => [
            ...prev,
            ...unassignedImages.map((u, idx) => ({
              id: crypto.randomUUID(),
              name: u.name,
              src: u.src,
              targetQ: getSuggestedQuestionIndex(u.name, prev.length + idx, stagedQuestions.length)
            }))
          ])
        }
        toast.success(`✨ Formatação e ${rtfImages.length} imagem(ns) do Word associadas automaticamente!`)
      } else {
        toast.success('Formatação rica do documento capturada com sucesso!')
      }
      setPastedHtml(htmlData)
    } else if (rtfImages.length > 0) {
      // If no rich HTML but RTF had images, make them available in unassigned
      setPastedImages(prev => [
        ...prev,
        ...rtfImages.map((u, idx) => ({
          id: crypto.randomUUID(),
          name: u.name,
          src: u.src,
          targetQ: getSuggestedQuestionIndex(u.name, prev.length + idx, stagedQuestions.length)
        }))
      ])
      toast.success(`${rtfImages.length} imagem(ns) extraídas do documento prontas para vincular!`)
    }

    // 3. Capture any clipboard image files
    if (clipboard.files && clipboard.files.length > 0) {
      for (let i = 0; i < clipboard.files.length; i++) {
        const file = clipboard.files[i]
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              const src = reader.result
              setPastedImages(prev => {
                if (prev.some(p => p.src === src)) return prev
                const name = file.name || `imagem_${prev.length + 1}`
                return [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    name,
                    src,
                    targetQ: getSuggestedQuestionIndex(name, prev.length, stagedQuestions.length)
                  }
                ]
              })
              toast.success(`Imagem detectada na área de transferência!`)
            }
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  // ── PROCESS FILE IMPORT ──────────────────────────────────────────────────
  const handleProcessFile = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo .docx ou .pdf para importar.')
      return
    }

    try {
      setProcessing(true)
      setProcessingStatus('Enviando e extraindo questões, alternativas e imagens do arquivo...')

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('totalExamPoints', String(totalExamPoints || 10))

      const res = await fetch('/api/provas-online/importar', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar arquivo.')
      }

      if (!data.questoes || data.questoes.length === 0) {
        toast.warning('Nenhuma questão formatada foi encontrada no arquivo. Verifique se as questões possuem numeração (ex: 1), 1., Questão 1).')
        return
      }

      const questionsList: QuestaoProva[] = data.questoes
      setupStagedQuestions(questionsList)
      toast.success(`${questionsList.length} questões identificadas com sucesso!`)
    } catch (err: any) {
      toast.error(err.message || 'Erro durante o processamento do arquivo.')
    } finally {
      setProcessing(false)
      setProcessingStatus('')
    }
  }

  // ── PROCESS TEXT / PASTE IMPORT ──────────────────────────────────────────
  const handleProcessPaste = async () => {
    const rawText = pastedContent.trim()
    let richHtml = pastedHtml.trim()

    if (!rawText && !richHtml) {
      toast.error('Cole o texto das questões para iniciar a importação.')
      return
    }

    // If we have RTF images that haven't been injected yet, inject now
    if (pastedRtf && richHtml && !richHtml.includes('data:image/')) {
      const rtfImages = extractImagesFromRtf(pastedRtf)
      if (rtfImages.length > 0) {
        const { injectedHtml } = injectRtfImagesIntoHtml(richHtml, rtfImages)
        richHtml = injectedHtml
      }
    }

    try {
      setProcessing(true)
      setProcessingStatus('Analisando enunciados, alternativas, gabaritos e imagens...')

      // Prefer rich HTML if captured from Word/Docs, otherwise use raw text
      const contentToParse = richHtml || rawText

      // Only send rtf to server if contentToParse did not already have images embedded,
      // and only if RTF size is under 2MB to prevent HTTP 413 Payload Too Large
      const shouldSendRtf = !contentToParse.includes('data:image/') && pastedRtf.length > 0 && pastedRtf.length < 2 * 1024 * 1024

      // Attempt server parsing for image cloud optimization
      const res = await fetch('/api/provas-online/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: contentToParse,
          text: rawText,
          rtf: shouldSendRtf ? pastedRtf : undefined,
          totalExamPoints: totalExamPoints || 10
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.questoes && data.questoes.length > 0) {
          setupStagedQuestions(data.questoes)
          toast.success(`${data.questoes.length} questões identificadas com sucesso!`)
          return
        }
      }

      // Fast fallback to client parser
      const clientParsed = parseRawTextOrHtmlToQuestoes(contentToParse, {
        totalExamPoints: totalExamPoints || 10
      })

      if (clientParsed.length === 0) {
        toast.warning('Não foram identificadas questões no texto. Certifique-se de usar numeração (Ex: 1., Questão 1, A), B)...).')
        return
      }

      setupStagedQuestions(clientParsed)
      toast.success(`${clientParsed.length} questões identificadas com sucesso!`)
    } catch (err: any) {
      // Direct client fallback
      const clientParsed = parseRawTextOrHtmlToQuestoes(richHtml || pastedContent.trim(), {
        totalExamPoints: totalExamPoints || 10
      })
      if (clientParsed.length > 0) {
        setupStagedQuestions(clientParsed)
        toast.success(`${clientParsed.length} questões identificadas via leitor local!`)
      } else {
        toast.error('Erro ao interpretar o texto colado: ' + err.message)
      }
    } finally {
      setProcessing(false)
      setProcessingStatus('')
    }
  }

  // ── UPLOAD IMAGE DIRECTLY TO A SPECIFIC QUESTION ──────────────────────────
  const handleUploadImageToQuestion = (qIdx: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido (PNG, JPG, WEBP, GIF, SVG).')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('A imagem é muito grande. O limite máximo é 15MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const src = reader.result
        const imgTag = `<div class="my-3 text-center"><img src="${src}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block;" /></div>`
        setStagedQuestions(prev => prev.map((q, idx) => {
          if (idx !== qIdx) return q
          return {
            ...q,
            enunciado: (q.enunciado ? `${q.enunciado}\n` : '') + imgTag
          }
        }))
        toast.success(`Imagem adicionada à Questão ${qIdx + 1}!`)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── REMOVE IMAGE FROM A SPECIFIC QUESTION ─────────────────────────────────
  const handleRemoveImageFromQuestion = (qIdx: number, srcToRemove: string) => {
    setStagedQuestions(prev => prev.map((q, idx) => {
      if (idx !== qIdx) return q
      const escaped = srcToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const tagRegex = new RegExp(`(<(?:div|p)[^>]*>\\s*)?<img\\b[^>]*?\\bsrc=["']${escaped}["'][^>]*?>(\\s*<\\/(?:div|p)>)?`, 'gi')
      return {
        ...q,
        enunciado: q.enunciado.replace(tagRegex, '').trim()
      }
    }))
    toast.info(`Imagem removida da Questão ${qIdx + 1}.`)
  }

  // ── ASSIGN A PASTED IMAGE TO A SPECIFIC QUESTION ──────────────────────────
  const handleAssignPastedImage = (imageId: string, targetQ?: number) => {
    const item = pastedImages.find(p => p.id === imageId)
    if (!item) return
    const qIdx = targetQ !== undefined ? targetQ : item.targetQ
    const imgTag = `<div class="my-3 text-center"><img src="${item.src}" alt="${item.name}" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block;" /></div>`
    setStagedQuestions(prev => prev.map((q, idx) => {
      if (idx !== qIdx) return q
      return {
        ...q,
        enunciado: (q.enunciado ? `${q.enunciado}\n` : '') + imgTag
      }
    }))
    setPastedImages(prev => prev.filter(p => p.id !== imageId))
    toast.success(`Imagem vinculada à Questão ${qIdx + 1}!`)
  }

  // ── ASSIGN ALL PASTED IMAGES TO THEIR SELECTED QUESTIONS IN SEQUENCE ───────
  const handleAssignAllPastedImages = () => {
    if (pastedImages.length === 0 || stagedQuestions.length === 0) return

    setStagedQuestions(prev => {
      const updated = [...prev]
      pastedImages.forEach(img => {
        const qIdx = Math.max(0, Math.min(img.targetQ ?? 0, updated.length - 1))
        const target = updated[qIdx]
        if (target) {
          const imgTag = `<div class="my-3 text-center"><img src="${img.src}" alt="${img.name}" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block;" /></div>`
          updated[qIdx] = {
            ...target,
            enunciado: (target.enunciado ? `${target.enunciado}\n` : '') + imgTag
          }
        }
      })
      return updated
    })

    const count = pastedImages.length
    setPastedImages([])
    toast.success(`${count} imagem(ns) vinculada(s) às questões com sucesso!`)
  }

  const setupStagedQuestions = (questions: QuestaoProva[]) => {
    // Recalculate default points distribution
    const count = questions.length
    const pointsPerQuestion = count > 0 ? Math.round((totalExamPoints / count) * 10) / 10 : 1.0

    const updated = questions.map((q, idx) => ({
      ...q,
      ordem: currentQuestionsCount + idx,
      pontuacao: pointsMode === 'equal' ? pointsPerQuestion : fixedPointsValue
    }))

    setStagedQuestions(updated)
    setSelectedIndices(new Set(updated.map((_, i) => i)))

    // Re-sync suggested question numbers for any pending pasted images
    setPastedImages(prev => prev.map((img, i) => ({
      ...img,
      targetQ: getSuggestedQuestionIndex(img.name, i, updated.length)
    })))

    setStage('review')
  }

  // ── RECALCULATE POINTS ON MODE CHANGE ─────────────────────────────────────
  const applyPointsDistribution = (mode: 'equal' | 'fixed', fixedVal: number) => {
    const selectedCount = selectedIndices.size
    if (selectedCount === 0) return

    setStagedQuestions(prev => {
      const equalVal = selectedCount > 0 ? Math.round((totalExamPoints / selectedCount) * 10) / 10 : 1.0
      return prev.map((q, idx) => {
        if (!selectedIndices.has(idx)) return q
        return {
          ...q,
          pontuacao: mode === 'equal' ? equalVal : fixedVal
        }
      })
    })
  }

  const handleToggleSelectQuestion = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (selectedIndices.size === stagedQuestions.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(stagedQuestions.map((_, i) => i)))
    }
  }

  const handleUpdateAlternativeCorrect = (qIdx: number, altId: string) => {
    setStagedQuestions(prev => {
      const copy = [...prev]
      const targetQ = { ...copy[qIdx] }
      if (!targetQ.alternativas) return prev

      if (targetQ.tipo === 'multipla_escolha') {
        targetQ.alternativas = targetQ.alternativas.map(a => ({
          ...a,
          correta: a.id === altId
        }))
      } else {
        targetQ.alternativas = targetQ.alternativas.map(a => ({
          ...a,
          correta: a.id === altId ? !a.correta : a.correta
        }))
      }
      copy[qIdx] = targetQ
      return copy
    })
  }

  const handleChangeQuestionType = (qIdx: number, newType: TipoQuestao) => {
    setStagedQuestions(prev => {
      const copy = [...prev]
      const q = { ...copy[qIdx], tipo: newType }
      copy[qIdx] = q
      return copy
    })
  }

  const handleRemoveStagedQuestion = (qIdx: number) => {
    const nextQuestions = stagedQuestions.filter((_, i) => i !== qIdx)
    setStagedQuestions(nextQuestions)
    setSelectedIndices(prev => {
      const next = new Set<number>()
      Array.from(prev).forEach(idx => {
        if (idx < qIdx) next.add(idx)
        else if (idx > qIdx) next.add(idx - 1)
      })
      return next
    })
    if (nextQuestions.length > 0) {
      setPastedImages(prev => prev.map((img, i) => ({
        ...img,
        targetQ: getSuggestedQuestionIndex(img.name, i, nextQuestions.length)
      })))
    }
  }

  // ── FINALIZE AND IMPORT INTO EXAM ────────────────────────────────────────
  const handleConfirmImport = () => {
    const selected = stagedQuestions.filter((_, idx) => selectedIndices.has(idx))
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma questão para importar.')
      return
    }

    // Renumber orders
    const finalized = selected.map((q, i) => ({
      ...q,
      ordem: currentQuestionsCount + i
    }))

    onImport(finalized)
    toast.success(`🎉 ${finalized.length} questão(ões) importada(s) com sucesso para a prova!`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className={`w-full h-full sm:h-auto sm:max-h-[92vh] ${stage === 'review' ? 'max-w-5xl' : 'max-w-4xl'} bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-200`}>
        {/* ── TOP HEADER ── */}
        <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {stage === 'input' ? 'Importar Questões para a Avaliação' : 'Revisão das Questões Identificadas'}
              </h3>
              <p className="text-xs text-slate-500">
                {stage === 'input'
                  ? 'Importe arquivos Word (.docx), PDF ou cole textos com alternativas e imagens'
                  : 'Confira as alternativas, gabaritos e pontuações antes de transferir para a prova'}
              </p>
            </div>
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

        {/* ── STAGE 1: INPUT SCREEN ── */}
        {stage === 'input' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Tabs Selector */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl max-w-md mx-auto border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'file'
                    ? 'bg-white text-sky-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={15} /> Arquivo (Word / PDF)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'paste'
                    ? 'bg-white text-sky-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={15} /> Copiar & Colar Texto / Word
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {activeTab === 'file' && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf,.txt"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndSetFile(e.target.files[0])
                    }
                  }}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
                      : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-slate-300 hover:border-sky-400 bg-slate-50/60 hover:bg-sky-50/20'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                    selectedFile ? 'bg-emerald-100 text-emerald-700 scale-105' : 'bg-sky-100 text-sky-600'
                  }`}>
                    {selectedFile ? <CheckCircle2 size={30} /> : <UploadCloud size={30} />}
                  </div>

                  {selectedFile ? (
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clique para escolher outro arquivo
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Arraste e solte o arquivo aqui ou <span className="text-sky-600 underline">clique para selecionar</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Formatos suportados: <strong>.DOCX (Word com fórmulas e imagens)</strong>, <strong>.PDF</strong> ou <strong>.TXT</strong> (Máx. 30MB)
                      </div>
                    </div>
                  )}
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <ImageIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800">Extração de Imagens</div>
                      <div className="text-[11px] text-slate-500 truncate">Figuras e diagramas preservados</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <Calculator size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800">Fórmulas & Notações</div>
                      <div className="text-[11px] text-slate-500 truncate">OMML, expoentes e frações</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800">Gabarito Automático</div>
                      <div className="text-[11px] text-slate-500 truncate">Detecção no texto ou chave final</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Copy & Paste */}
            {activeTab === 'paste' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/90 flex items-start gap-3 text-xs text-sky-950">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={16} />
                  </div>
                  <div className="leading-relaxed flex-1">
                    <div className="font-extrabold text-sky-900">
                      Importação Inteligente do Word & Documentos
                    </div>
                    <div className="text-[11px] text-sky-800 mt-0.5">
                      Ao colar do Word (Ctrl+C / Ctrl+V), o sistema extrai o texto, identifica alternativas, detecta gabaritos (em vermelho ou negrito) e <strong>vincula todas as imagens</strong> às suas questões correspondentes automaticamente.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText size={15} className="text-sky-600" /> Cole o texto formatado das questões:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPastedContent(SAMPLE_TEXT)
                      toast.info('Exemplo demonstrativo carregado na área de texto.')
                    }}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold underline"
                  >
                    Carregar modelo de exemplo
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={12}
                    value={pastedContent}
                    onChange={e => setPastedContent(e.target.value)}
                    onPaste={handlePasteAreaPaste}
                    placeholder="Cole aqui as questões copiadas do Word, Google Docs ou PDF...
Exemplo:
1. Qual é a capital do Brasil?
A) São Paulo
B) Rio de Janeiro
C) Brasília
D) Salvador
Gabarito: C"
                    className="w-full p-4 rounded-2xl border border-slate-300 font-sans text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 leading-relaxed resize-y"
                  />
                  <span className="absolute right-3 bottom-3 text-[11px] text-slate-400 select-none">
                    Dica: Pressione Ctrl+V com uma imagem copiada para anexá-la!
                  </span>
                </div>

                {/* Rich HTML detected badge */}
                {pastedHtml && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={15} className="text-emerald-600 shrink-0" />
                      <span>Formatação avançada (negrito, gabaritos e imagens) capturada do Word / Documento!</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPastedHtml('')
                        toast.info('Formatação avançada desativada. Será usado texto simples.')
                      }}
                      className="text-[11px] text-emerald-700 underline hover:text-emerald-900 cursor-pointer font-bold shrink-0 ml-2"
                    >
                      Limpar formatação
                    </button>
                  </div>
                )}

                {/* Pasted Images Gallery */}
                {pastedImages.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon size={15} /> {pastedImages.length} imagem(ns) colada(s) detectada(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => setPastedImages([])}
                        className="text-rose-600 hover:underline font-semibold text-[11px]"
                      >
                        Limpar Imagens
                      </button>
                    </div>
                    <div className="flex items-center gap-3 overflow-x-auto py-1">
                      {pastedImages.map((img) => (
                        <div key={img.id} className="relative group shrink-0 w-20 h-20 rounded-xl border border-sky-300 bg-white overflow-hidden shadow-2xs">
                          <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPastedImages(prev => prev.filter(p => p.id !== img.id))}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STAGE 2: REVIEW & STAGING SCREEN ── */}
        {stage === 'review' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
            {/* Top Toolbar in Review */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 border border-emerald-200">
                  <CheckCircle2 size={15} /> {stagedQuestions.length} questões encontradas
                </span>
                <span className="text-xs text-slate-500">
                  {selectedIndices.size} selecionadas para importar
                </span>
              </div>

              {/* Points Distribution Options */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-700">Pontuação:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPointsMode('equal')
                    applyPointsDistribution('equal', fixedPointsValue)
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    pointsMode === 'equal'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Divide o valor total da prova igualmente entre as questões selecionadas"
                >
                  Distribuir {totalExamPoints} pts
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPointsMode('fixed')
                      applyPointsDistribution('fixed', fixedPointsValue)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      pointsMode === 'fixed'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Valor Fixo:
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={fixedPointsValue}
                    onChange={e => {
                      const val = Math.max(0.1, Number(e.target.value))
                      setFixedPointsValue(val)
                      if (pointsMode === 'fixed') {
                        applyPointsDistribution('fixed', val)
                      }
                    }}
                    className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-center"
                  />
                  <span className="text-xs text-slate-500 font-bold">pts</span>
                </div>
              </div>
            </div>

            {/* Questions List for Review */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 hover:text-sky-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedIndices.size === stagedQuestions.length && stagedQuestions.length > 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                  />
                  <span>Selecionar todas as questões</span>
                </button>
                <span className="text-slate-400 font-normal">
                  Clique na letra para alterar o gabarito oficial com 1 clique
                </span>
              </div>

              {/* Unassigned Pasted Images Banner (if user pasted image files) */}
              {pastedImages.length > 0 && (
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-900 flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon size={16} className="text-sky-600" /> {pastedImages.length} imagem(ns) adicionais prontas para vincular:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAssignAllPastedImages}
                        className="text-sky-700 hover:text-sky-900 bg-white border border-sky-300 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-sky-50 transition-colors shadow-2xs"
                      >
                        Vincular Todas em Sequência
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastedImages([])}
                        className="text-rose-600 hover:underline font-semibold text-[11px] cursor-pointer"
                      >
                        Descartar Todas
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {pastedImages.map((img) => (
                      <div key={img.id} className="p-2.5 rounded-xl bg-white border border-sky-200 shadow-2xs flex items-center gap-3">
                        <img
                          src={img.src}
                          alt={img.name}
                          onClick={() => setPreviewImageModal(img.src)}
                          className="w-14 h-14 rounded-lg object-cover border border-slate-100 shrink-0 cursor-pointer hover:opacity-80"
                          title="Clique para ampliar"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-700 truncate">{img.name}</p>
                          <div className="flex items-center gap-1">
                            <select
                              value={img.targetQ}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                setPastedImages(prev => prev.map(p => p.id === img.id ? { ...p, targetQ: val } : p))
                              }}
                              className="text-[11px] font-bold p-1 bg-slate-50 border border-slate-200 rounded-lg flex-1"
                            >
                              {stagedQuestions.map((_, qIdx) => (
                                <option key={qIdx} value={qIdx}>Questão {qIdx + 1}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAssignPastedImage(img.id, img.targetQ)}
                              className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-[11px] font-bold hover:bg-sky-700 transition-colors shrink-0 cursor-pointer"
                            >
                              Vincular
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stagedQuestions.map((q, qIdx) => {
                const isSelected = selectedIndices.has(qIdx)

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border transition-all p-5 space-y-3.5 ${
                      isSelected
                        ? 'bg-white border-sky-300 ring-2 ring-sky-50 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectQuestion(qIdx)}
                          className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                        />
                        <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 font-extrabold text-xs flex items-center justify-center">
                          {qIdx + 1}
                        </span>

                        <select
                          value={q.tipo}
                          onChange={e => handleChangeQuestionType(qIdx, e.target.value as TipoQuestao)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 focus:outline-none"
                        >
                          <option value="multipla_escolha">Objetiva (Única)</option>
                          <option value="multipla_selecao">Múltipla Seleção</option>
                          <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
                          <option value="dissertativa">Dissertativa</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Upload Imagem direto na questão */}
                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 border border-sky-200 text-xs font-bold cursor-pointer transition-all shadow-2xs">
                          <ImageIcon size={13} className="text-sky-600" />
                          <span>Anexar Imagem</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadImageToQuestion(qIdx, file)
                              e.target.value = ''
                            }}
                          />
                        </label>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-semibold">Valor:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={q.pontuacao}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value))
                              setStagedQuestions(p => p.map((item, i) => i === qIdx ? { ...item, pontuacao: val } : item))
                            }}
                            className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-center"
                          />
                          <span className="text-xs text-slate-400 font-bold">pts</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStagedQuestion(qIdx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover questão"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Enunciado */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-800 leading-relaxed space-y-2">
                      <HtmlContent html={q.enunciado} />

                      {/* Imagens da Questão com thumbnails e remoção */}
                      {(() => {
                        const images = Array.from(q.enunciado.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi)).map(m => m[1])
                        if (images.length === 0) return null
                        return (
                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200/60">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                              <ImageIcon size={12} className="text-sky-600" /> {images.length} imagem(ns) nesta questão:
                            </span>
                            {images.map((imgSrc, imgI) => (
                              <div key={imgI} className="group relative inline-flex items-center gap-1.5 p-1 pl-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                                <img
                                  src={imgSrc}
                                  alt={`Imagem ${imgI + 1}`}
                                  className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80 bg-slate-100"
                                  onClick={() => setPreviewImageModal(imgSrc)}
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.opacity = '0.5'
                                  }}
                                  title="Clique para ampliar a imagem"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImageFromQuestion(qIdx, imgSrc)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Remover esta imagem da questão"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Alternativas (for multiple choice/selection) */}
                    {(q.tipo === 'multipla_escolha' || q.tipo === 'multipla_selecao') && q.alternativas && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.alternativas.map(alt => (
                          <div
                            key={alt.id}
                            onClick={() => handleUpdateAlternativeCorrect(qIdx, alt.id)}
                            className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                              alt.correta
                                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200 text-emerald-900 font-bold'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                              alt.correta ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {alt.correta ? <Check size={13} /> : alt.letra}
                            </span>
                            <div className="text-xs flex-1 break-words">
                              <HtmlContent html={alt.texto} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verdadeiro ou Falso */}
                    {q.tipo === 'verdadeiro_falso' && q.itensVF && (
                      <div className="space-y-1.5 pt-1">
                        {q.itensVF.map((item, itIdx) => (
                          <div key={item.id} className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                            <span className="text-slate-800">{itIdx + 1}. {item.afirmacao}</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.correta ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {item.correta ? 'V (Verdadeiro)' : 'F (Falso)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── FOOTER ACTIONS ── */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 bg-slate-50/90 shrink-0">
          {stage === 'input' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={activeTab === 'file' ? handleProcessFile : handleProcessPaste}
                disabled={processing || (activeTab === 'file' && !selectedFile) || (activeTab === 'paste' && !pastedContent.trim() && !pastedHtml.trim())}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm ${
                  processing || (activeTab === 'file' && !selectedFile) || (activeTab === 'paste' && !pastedContent.trim() && !pastedHtml.trim())
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700 cursor-pointer'
                }`}
              >
                {processing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Identificar e Processar Questões</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStage('input')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={15} /> Voltar para Edição
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedIndices.size === 0}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm ${
                  selectedIndices.size === 0
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700 cursor-pointer'
                }`}
              >
                <Check size={16} strokeWidth={2.5} />
                <span>Importar {selectedIndices.size} Questão(ões) para a Prova</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10 cursor-pointer"
            >
              <X size={18} />
            </button>
            <img src={previewImageModal} alt="Visualização da Imagem" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
