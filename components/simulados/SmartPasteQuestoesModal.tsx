'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Sparkles, FileText, CheckCircle2, AlertCircle, Image as ImageIcon,
  Bold, Italic, Underline, Subscript, Superscript, Trash2, Plus, Check,
  ClipboardPaste, Wand2, ListChecks, AlignLeft, BookOpen, Upload,
  Loader2, HelpCircle, Eye, SplitSquareVertical, RefreshCw, Sigma, Table
} from 'lucide-react'
import { HtmlContent } from '@/components/HtmlContent'
import {
  extractImagesFromRtf,
  injectRtfImagesIntoHtml,
  convertHtmlListsToExplicitMarkers,
  parseSmartPasteToSimuladoQuestoes,
  applyBulkGabaritoString,
  reflowBrokenPdfLines,
  isRedMarker
} from '@/lib/provas-online/importParser'
import { useKeyboard } from '@/components/providers/KeyboardProvider'

export interface SmartPasteQuestoesModalProps {
  open?: boolean
  mode?: 'modal' | 'inline'
  onClose?: () => void
  onImport: (questoes: any[], importMode: 'append' | 'replace') => void | Promise<void>
  existingCount?: number
  cotaQuestoes?: number
  defaultDisciplinaId?: string
  defaultDisciplinaNome?: string
  defaultProfessorId?: string
  defaultProfessorNome?: string
  defaultRequisicaoId?: string
}

const SAMPLE_PASTE_HTML = `<p><strong>1. (ENEM)</strong> A Revolução Industrial, iniciada na Inglaterra no século XVIII, transformou profundamente as relações socioeconômicas e a organização do espaço geográfico. Uma das principais consequências desse processo foi:</p>
<p>a) O fortalecimento das corporações de ofício medievais.</p>
<p><span data-gabarito="true" style="color: #dc2626; font-weight: 700;">b) A consolidação do trabalho assalariado e a urbanização acelerada.</span></p>
<p>c) A descentralização das atividades fabris para o meio rural.</p>
<p>d) O declínio imediato do comércio marítimo internacional.</p>
<p>e) A extinção das jornadas de trabalho nas minas de carvão.</p>
<p><br></p>
<p><strong>2.</strong> Sabendo que a função quadrática é definida por f(x) = x<sup>2</sup> - 5x + 6, quais são as raízes reais dessa equação?</p>
<p>a) x = 1 e x = 6 &nbsp;&nbsp;&nbsp; b) x = -2 e x = -3 &nbsp;&nbsp;&nbsp; c) x = 2 e x = 3 &nbsp;&nbsp;&nbsp; d) x = 0 e x = 5 &nbsp;&nbsp;&nbsp; e) x = -1 e x = 6</p>
<p>Gabarito: C</p>
<p><br></p>
<p><strong>3. (FUVEST)</strong> Na reação de síntese da água (2H<sub>2</sub> + O<sub>2</sub> → 2H<sub>2</sub>O), explique como a conservação da massa de Lavoisier se aplica às quantidades de reagentes e produtos.</p>`

/**
 * Sanitizes pasted HTML before inserting into the rich paste editor,
 * preserving formatting (b, strong, i, em, u, sup, sub, table, tr, td, th, img, .ql-formula, data-gabarito)
 * and highlighting red/green/marked gabarito runs visually.
 */
function preparePastedHtmlForEditor(rawHtml: string, rtfData?: string): { html: string; extractedImagesCount: number; hadRichFormatting: boolean } {
  if (!rawHtml) return { html: '', extractedImagesCount: 0, hadRichFormatting: false }

  let working = rawHtml
  let extractedImagesCount = 0

  // 1. Extract RTF binary images if HTML references images
  const htmlHasImages = /<img\b|<v:imagedata\b|<v:shape\b/i.test(working)
  if (rtfData && htmlHasImages) {
    const rtfImages = extractImagesFromRtf(rtfData)
    if (rtfImages.length > 0) {
      const { injectedHtml } = injectRtfImagesIntoHtml(working, rtfImages)
      working = injectedHtml
      extractedImagesCount = rtfImages.length
    }
  }

  // 2. Convert Word conditional list blocks (<!--[if !supportLists]-->) and <ol>/<ul> to explicit numbered/lettered paragraphs
  working = convertHtmlListsToExplicitMarkers(working)

  // 3. Mark red/green/highlighted elements with data-gabarito="true" and visible red styling so user sees the detected gabarito
  working = working.replace(/<(span|font|mark|p|li|b|strong|em|u)\b([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const lowerTag = tag.toLowerCase()
    if (lowerTag === 'mark' || isRedMarker(attrs)) {
      if (lowerTag === 'p' || lowerTag === 'li') {
        return `<${tag} data-gabarito="true" style="color: #dc2626; font-weight: 700;">`
      }
      return `<span data-gabarito="true" style="color: #dc2626; background: rgba(239,68,68,0.08); padding: 0 3px; border-radius: 4px; font-weight: 700;">`
    }
    return match
  })
  working = working.replace(/<\/(?:font|mark)>/gi, '</span>')

  // 4. Strip dangerous/junk Office tags while keeping semantic formatting, tables, formulas, and images
  working = working
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
    .replace(/<(?:script|style|xml|head|meta|link|title|iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:script|style|xml|head|meta|link|title|iframe|object|embed)>/gi, '')
    .replace(/<\/?(?:html|body|head|meta|link|title|o:p)\b[^>]*>/gi, '')
    .replace(/<\/?(?:w|m|o|v):[a-z0-9_-]+\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])(?:(?!\1)[\s\S])*?\1/gi, '')
    .replace(/\sclass=(['"])Mso[^'"]*\1/gi, '')
    .replace(/\sstyle=(['"])(?:(?!\1)[\s\S])*?\1/gi, (styleMatch) => {
      if (/color:\s*#dc2626/i.test(styleMatch)) return styleMatch
      if (isRedMarker(styleMatch)) {
        return ' data-gabarito="true" style="color: #dc2626; font-weight: 700;"'
      }
      return ''
    })

  // Style tables cleanly for the visual editor
  working = working
    .replace(/<table\b[^>]*>/gi, '<table style="border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px;">')
    .replace(/<(td|th)\b([^>]*)>/gi, '<$1 style="border: 1px solid #cbd5e1; padding: 6px 10px;">')

  // Style images cleanly for the visual editor
  working = working.replace(/<img\b([^>]*?)>/gi, (imgMatch, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i)
    if (!srcMatch || !srcMatch[1]) return ''
    const src = srcMatch[1]
    if (src.startsWith('file://') || src.startsWith('webkit-fake-url://')) return ''
    return `<img src="${src}" alt="Imagem colada" style="max-width: 280px; max-height: 180px; height: auto; border-radius: 8px; border: 1px solid #cbd5e1; margin: 6px 0; display: block;" />`
  })

  return {
    html: working.trim(),
    extractedImagesCount,
    hadRichFormatting: true
  }
}

export function SmartPasteQuestoesModal({
  open = true,
  mode = 'modal',
  onClose,
  onImport,
  existingCount = 0,
  cotaQuestoes,
  defaultDisciplinaId,
  defaultDisciplinaNome,
  defaultProfessorId,
  defaultProfessorNome,
  defaultRequisicaoId
}: SmartPasteQuestoesModalProps) {
  const { openKeyboard } = useKeyboard()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fileImageInputRef = useRef<HTMLInputElement>(null)
  const questionImageInputRef = useRef<HTMLInputElement>(null)

  const [editorEmpty, setEditorEmpty] = useState(true)
  const [parsedQuestoes, setParsedQuestoes] = useState<any[]>([])
  const [bulkGabaritoInput, setBulkGabaritoInput] = useState('')
  const [importMode, setImportMode] = useState<'append' | 'replace'>(existingCount > 0 ? 'append' : 'replace')
  const [isImporting, setIsImporting] = useState(false)
  const [statusAnnouncement, setStatusAnnouncement] = useState('')
  const [toastFeedback, setToastFeedback] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null)
  const [uploadTargetQIdx, setUploadTargetQIdx] = useState<number | null>(null)
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    subscript: false,
    superscript: false
  })

  const parseTimerRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastFeedback({ text, type })
    setStatusAnnouncement(text)
    setTimeout(() => {
      setToastFeedback(prev => (prev?.text === text ? null : prev))
    }, 3500)
  }, [])

  // Manage native <dialog> when mode === 'modal'
  useEffect(() => {
    if (mode !== 'modal') return
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      try {
        dialog.showModal()
      } catch {
        dialog.setAttribute('open', '')
      }
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, mode])

  // Roving tabindex fallback for toolbar when native focusgroup is unsupported
  useEffect(() => {
    const bar = toolbarRef.current
    if (!bar || ('focusGroup' in HTMLElement.prototype)) return

    const items = Array.from(bar.querySelectorAll<HTMLButtonElement>('button'))
    items.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1
    })

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLButtonElement
      if (items.includes(target)) {
        items.forEach(b => {
          b.tabIndex = b === target ? 0 : -1
        })
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const activeIdx = items.indexOf(document.activeElement as HTMLButtonElement)
      if (activeIdx === -1) return

      let nextIdx = -1
      if (e.key === 'ArrowRight') {
        nextIdx = (activeIdx + 1) % items.length
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (activeIdx - 1 + items.length) % items.length
      } else if (e.key === 'Home') {
        nextIdx = 0
      } else if (e.key === 'End') {
        nextIdx = items.length - 1
      }

      if (nextIdx !== -1) {
        e.preventDefault()
        items[nextIdx]?.focus()
      }
    }

    bar.addEventListener('focusin', onFocusIn)
    bar.addEventListener('keydown', onKeyDown)
    return () => {
      bar.removeEventListener('focusin', onFocusIn)
      bar.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const runLiveParser = useCallback((rawHtml?: string) => {
    const html = rawHtml !== undefined ? rawHtml : (editorRef.current?.innerHTML || '')
    const plain = (editorRef.current?.innerText || '').trim()
    const hasImg = /<img\b/i.test(html)

    if (!plain && !hasImg) {
      setEditorEmpty(true)
      setParsedQuestoes([])
      return
    }

    setEditorEmpty(false)
    const startNumber = importMode === 'append' ? existingCount + 1 : 1
    const newlyParsed = parseSmartPasteToSimuladoQuestoes(html, {
      id_requisicao: defaultRequisicaoId,
      id_disciplina: defaultDisciplinaId,
      disciplina_nome: defaultDisciplinaNome,
      id_professor: defaultProfessorId,
      professor_nome: defaultProfessorNome,
      startNumber
    })

    // Apply bulk gabarito if filled
    if (bulkGabaritoInput.trim() && newlyParsed.length > 0) {
      const { updated } = applyBulkGabaritoString(newlyParsed, bulkGabaritoInput)
      setParsedQuestoes(updated)
    } else {
      setParsedQuestoes(newlyParsed)
    }
  }, [
    importMode,
    existingCount,
    defaultRequisicaoId,
    defaultDisciplinaId,
    defaultDisciplinaNome,
    defaultProfessorId,
    defaultProfessorNome,
    bulkGabaritoInput
  ])

  const scheduleLiveParse = useCallback(() => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current)
    parseTimerRef.current = setTimeout(() => {
      runLiveParser()
    }, 180)
  }, [runLiveParser])

  const updateToolbarActiveStates = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        subscript: document.queryCommandState('subscript'),
        superscript: document.queryCommandState('superscript')
      })
    } catch {}
  }

  const applyEditorCommand = (cmd: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(cmd, false)
    updateToolbarActiveStates()
    scheduleLiveParse()
  }

  const handleInsertFormula = () => {
    openKeyboard({
      onInsert: (latex: string) => {
        if (!latex || !editorRef.current) return
        editorRef.current.focus()
        const safeLatex = latex.replace(/"/g, '&quot;')
        const formulaHtml = `<span class="ql-formula" data-value="${safeLatex}">\\(${latex}\\)</span>&nbsp;`
        document.execCommand('insertHTML', false, formulaHtml)
        scheduleLiveParse()
        showToast('Fórmula matemática inserida!', 'success')
      }
    })
  }

  const handleInsertTable = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const tableHtml = `<table style="border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px;"><tbody><tr><th style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #f8fafc;">Coluna 1</th><th style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #f8fafc;">Coluna 2</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dado 1</td><td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dado 2</td></tr></tbody></table><p><br></p>`
    document.execCommand('insertHTML', false, tableHtml)
    scheduleLiveParse()
    showToast('Tabela 2x2 inserida no editor!', 'info')
  }

  const handleMarkSelectionAsGabarito = () => {
    if (!editorRef.current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      showToast('Selecione o texto da alternativa correta para marcá-la como Gabarito.', 'warning')
      return
    }
    const text = sel.toString()
    document.execCommand(
      'insertHTML',
      false,
      `<span data-gabarito="true" style="color: #dc2626; background: rgba(239,68,68,0.08); padding: 0 4px; border-radius: 4px; font-weight: 700;">${text}</span>`
    )
    scheduleLiveParse()
    showToast('Alternativa marcada como Gabarito!', 'success')
  }

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboard = e.clipboardData
    if (!clipboard) return

    const plainText = clipboard.getData('text/plain') || ''
    const htmlData = clipboard.getData('text/html') || ''
    const rtfData = clipboard.getData('text/rtf') || ''

    // 1. Check if pasting a standalone image (screenshot or copied image file without text)
    if (!plainText.trim() && clipboard.files && clipboard.files.length > 0) {
      for (let i = 0; i < clipboard.files.length; i++) {
        const file = clipboard.files[i]
        if (file.type.startsWith('image/')) {
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string' && editorRef.current) {
              editorRef.current.focus()
              const imgHtml = `<p><img src="${reader.result}" alt="${file.name || 'Imagem colada'}" style="max-width: 280px; max-height: 180px; height: auto; border-radius: 8px; border: 1px solid #cbd5e1; margin: 6px 0; display: block;" /></p>`
              document.execCommand('insertHTML', false, imgHtml)
              runLiveParser()
              showToast('🖼️ Imagem colada diretamente na questão!', 'success')
            }
          }
          reader.readAsDataURL(file)
          return
        }
      }
    }

    // 2. If rich HTML from Word, Google Docs, or Web is available
    if (htmlData && htmlData.trim().length > 10) {
      e.preventDefault()
      const { html: preparedHtml, extractedImagesCount } = preparePastedHtmlForEditor(htmlData, rtfData)
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand('insertHTML', false, preparedHtml)
        runLiveParser()
        if (extractedImagesCount > 0) {
          showToast(`✨ Texto, formatação e ${extractedImagesCount} imagem(ns) do Word identificados automaticamente!`, 'success')
        } else {
          showToast('✨ Questões, formatação e gabaritos identificados automaticamente!', 'success')
        }
      }
      return
    }

    // 3. Plain text paste fallback
    if (plainText) {
      e.preventDefault()
      const safeHtml = plainText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .split(/\r?\n/)
        .map(line => `<p>${line || '<br>'}</p>`)
        .join('')
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand('insertHTML', false, safeHtml)
        runLiveParser()
        showToast('✨ Texto colado e questões analisadas automaticamente!', 'success')
      }
    }
  }

  const handlePasteFromClipboardButton = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (!text || !text.trim()) {
          showToast('A área de transferência está vazia. Use Ctrl+V (ou Cmd+V) no campo abaixo.', 'warning')
          return
        }
        const safeHtml = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .split(/\r?\n/)
          .map(line => `<p>${line || '<br>'}</p>`)
          .join('')
        if (editorRef.current) {
          editorRef.current.focus()
          document.execCommand('insertHTML', false, safeHtml)
          runLiveParser()
          showToast('Conteúdo colado da área de transferência!', 'success')
        }
      }
    } catch {
      showToast('Pressione Ctrl+V (ou Cmd+V) diretamente dentro do campo de edição.', 'info')
      editorRef.current?.focus()
    }
  }

  const handleLoadSample = () => {
    if (editorRef.current) {
      if ('setHTML' in Element.prototype) {
        try {
          ;(editorRef.current as any).setHTML(SAMPLE_PASTE_HTML)
        } catch {
          editorRef.current.innerHTML = SAMPLE_PASTE_HTML
        }
      } else {
        editorRef.current.innerHTML = SAMPLE_PASTE_HTML
      }
      runLiveParser(SAMPLE_PASTE_HTML)
      showToast('Exemplo de questões carregado! Veja a identificação ao lado.', 'info')
    }
  }

  const handleReflowPdfLines = () => {
    if (!editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    if (!currentHtml.trim()) return
    const reflowed = reflowBrokenPdfLines(editorRef.current.innerText || '')
    const nextHtml = reflowed
      .split(/\n/)
      .map(line => `<p>${line || '<br>'}</p>`)
      .join('')
    editorRef.current.innerHTML = nextHtml
    runLiveParser(nextHtml)
    showToast('🧹 Quebras de linha de PDF corrigidas e parágrafos unidos!', 'success')
  }

  const handleClearEditor = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
    }
    setEditorEmpty(true)
    setParsedQuestoes([])
    setBulkGabaritoInput('')
    showToast('Área de edição limpa.', 'info')
  }

  // Interactive updates on the parsed preview cards
  const handleSelectGabaritoOnCard = (qIdx: number, targetLetter: string) => {
    setParsedQuestoes(prev =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q
        const nextAlts = (q.alternativas || []).map((a: any) => {
          const l = (a.letter || a.letra || '').toUpperCase()
          const isMatch = l === targetLetter
          return {
            ...a,
            correct: isMatch,
            eh_correta: isMatch,
            correta: isMatch,
            is_correta: isMatch,
            isCorrect: isMatch
          }
        })
        return { ...q, alternativas: nextAlts, gabarito: targetLetter }
      })
    )
  }

  const handleChangeCardType = (qIdx: number, newType: 'multipla_escolha' | 'descritiva' | 'texto_apoio') => {
    setParsedQuestoes(prev => {
      const updated = prev.map((q, idx) => {
        if (idx !== qIdx) return q
        if (newType === 'multipla_escolha') {
          const existingAlts = Array.isArray(q.alternativas) && q.alternativas.length >= 2
            ? q.alternativas
            : ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({
                letter: l,
                letra: l,
                text: '',
                texto: '',
                correct: i === 0,
                eh_correta: i === 0,
                correta: i === 0,
                is_correta: i === 0,
                isCorrect: i === 0,
                linhas: 0
              }))
          const gab = existingAlts.find((a: any) => a.correct)?.letter || 'A'
          return {
            ...q,
            tipo_questao: 'multipla_escolha',
            alternativas: existingAlts,
            gabarito: gab
          }
        }
        if (newType === 'descritiva') {
          return {
            ...q,
            tipo_questao: 'descritiva',
            alternativas: [],
            gabarito: '',
            linhas_resposta: q.linhas_resposta || 5,
            estilo_espaco: q.estilo_espaco || 'pautado'
          }
        }
        return {
          ...q,
          numero: 0,
          tipo_questao: 'texto_apoio',
          alternativas: [],
          gabarito: ''
        }
      })

      // Renumber non-texto_apoio questions
      let num = importMode === 'append' ? existingCount + 1 : 1
      return updated.map(item => ({
        ...item,
        numero: item.tipo_questao === 'texto_apoio' ? 0 : num++
      }))
    })
  }

  const handleRemoveCardQuestion = (qIdx: number) => {
    setParsedQuestoes(prev => {
      const filtered = prev.filter((_, i) => i !== qIdx)
      let num = importMode === 'append' ? existingCount + 1 : 1
      return filtered.map(item => ({
        ...item,
        numero: item.tipo_questao === 'texto_apoio' ? 0 : num++
      }))
    })
  }

  const handleAddImageToCard = (qIdx: number, file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result
        setParsedQuestoes(prev =>
          prev.map((q, idx) => {
            if (idx !== qIdx) return q
            const currentImgs = [...(q.imagens || [])]
            const nextImgNum = currentImgs.length + 1
            currentImgs.push({
              src: `${dataUrl}#w=350`,
              contentType: file.type || 'image/png',
              posicao: 'inicio'
            })
            const tag = `[IMAGEM ${nextImgNum}]`
            const nextEnunciado = `<p>${tag}</p>${q.enunciado || ''}`
            return {
              ...q,
              imagens: currentImgs,
              enunciado: nextEnunciado
            }
          })
        )
        showToast(`Imagem adicionada à Questão ${qIdx + 1}!`, 'success')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImageFromCard = (qIdx: number, imgIdx: number) => {
    setParsedQuestoes(prev =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q
        const oldImgs = q.imagens || []
        const newImgs = oldImgs.filter((_: any, i: number) => i !== imgIdx)
        let nextEnunciado = (q.enunciado || '').replace(
          new RegExp(`(<(?:p|div)[^>]*>\\s*)?\\[IMAGEM\\s*${imgIdx + 1}\\](\\s*<\\/(?:p|div)>)?|\\[IMAGEM\\s*${imgIdx + 1}\\]`, 'gi'),
          ''
        )
        for (let k = imgIdx + 1; k < oldImgs.length; k++) {
          nextEnunciado = nextEnunciado.replace(new RegExp(`\\[IMAGEM\\s*${k + 1}\\]`, 'gi'), `[IMAGEM ${k}]`)
        }
        return {
          ...q,
          imagens: newImgs,
          enunciado: nextEnunciado.trim()
        }
      })
    )
  }

  const handleApplyBulkGabarito = (val: string) => {
    setBulkGabaritoInput(val)
    if (!val.trim()) {
      runLiveParser()
      return
    }
    setParsedQuestoes(prev => {
      const { updated } = applyBulkGabaritoString(prev, val)
      return updated
    })
  }

  // Upload any data:image/... base64 images to Supabase Storage (/api/upload-midia) before finalizing
  const uploadDataUrlIfNeeded = async (srcWithHash: string): Promise<string> => {
    if (!srcWithHash || !srcWithHash.startsWith('data:image/')) return srcWithHash
    const hashIdx = srcWithHash.indexOf('#')
    const dataUrl = hashIdx >= 0 ? srcWithHash.slice(0, hashIdx) : srcWithHash
    const hashSuffix = hashIdx >= 0 ? srcWithHash.slice(hashIdx) : '#w=350'

    try {
      const parts = dataUrl.split(',')
      if (parts.length < 2) return srcWithHash
      const mimeMatch = parts[0].match(/data:(image\/[a-zA-Z0-9+.-]+);base64/)
      const mime = mimeMatch ? mimeMatch[1] : 'image/png'
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'png'

      const byteString = atob(parts[1])
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mime })
      const formData = new FormData()
      formData.append('file', blob, `smart-paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`)
      formData.append('bucket', 'comunicados-midia')

      const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
      if (res.ok) {
        const json = await res.json()
        if (json.url) {
          return `${json.url}${hashSuffix}`
        }
      }
    } catch (err) {
      console.warn('[SmartPaste] Fallback para base64 local:', err)
    }
    return srcWithHash
  }

  const handleConfirmImport = async () => {
    if (parsedQuestoes.length === 0) {
      showToast('Cole ao menos uma questão antes de confirmar a importação.', 'warning')
      return
    }

    setIsImporting(true)
    try {
      const optimizedQuestoes = await Promise.all(
        parsedQuestoes.map(async (q) => {
          const nextImgs = await Promise.all(
            (q.imagens || []).map(async (img: any) => {
              const rawSrc = typeof img === 'string' ? img : img.src
              const uploadedSrc = await uploadDataUrlIfNeeded(rawSrc)
              return typeof img === 'object' ? { ...img, src: uploadedSrc } : { src: uploadedSrc, contentType: 'image/png' }
            })
          )

          const nextAlts = await Promise.all(
            (q.alternativas || []).map(async (alt: any) => {
              if (!alt.imagem_url || !alt.imagem_url.startsWith('data:image/')) return alt
              const uploadedAltImg = await uploadDataUrlIfNeeded(alt.imagem_url)
              return { ...alt, imagem_url: uploadedAltImg }
            })
          )

          return {
            ...q,
            imagens: nextImgs,
            alternativas: nextAlts,
            expandido: true
          }
        })
      )

      await onImport(optimizedQuestoes, existingCount > 0 ? importMode : 'replace')
      if (mode === 'modal' && onClose) {
        onClose()
      }
    } catch (err: any) {
      showToast('Erro ao importar questões: ' + (err?.message || 'Tente novamente'), 'warning')
    } finally {
      setIsImporting(false)
    }
  }

  const totalRealQuestions = parsedQuestoes.filter(q => q.tipo_questao !== 'texto_apoio').length
  const totalWithGabarito = parsedQuestoes.filter(q => q.tipo_questao === 'multipla_escolha' && Boolean(q.gabarito)).length
  const totalMultipleChoice = parsedQuestoes.filter(q => q.tipo_questao === 'multipla_escolha').length
  const totalImages = parsedQuestoes.reduce(
    (acc, q) =>
      acc +
      (q.imagens?.length || 0) +
      (q.alternativas || []).filter((a: any) => Boolean(a.imagem_url)).length,
    0
  )

  if (mode === 'modal' && !open) return null

  const studioBody = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: mode === 'modal' ? '90vh' : 'auto',
        maxHeight: mode === 'modal' ? 880 : 'none',
        background: 'hsl(var(--bg-surface))',
        borderRadius: mode === 'modal' ? 22 : 20,
        border: '1px solid hsl(var(--border-subtle))',
        boxShadow: mode === 'modal' ? '0 25px 60px -15px rgba(0,0,0,0.35)' : '0 4px 20px -4px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}
    >
      <style>{`
        dialog.smart-paste-dialog:modal {
          overscroll-behavior: contain;
          border: none;
          padding: 0;
          background: transparent;
          max-width: 1240px;
          width: calc(100vw - 32px);
          margin: auto;
          overflow: visible;
        }
        dialog.smart-paste-dialog::backdrop {
          overflow: hidden;
          overscroll-behavior: contain;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(6px);
        }
        .smart-paste-toolbar button[aria-pressed="true"] {
          background: rgba(139, 92, 246, 0.16) !important;
          color: #7c3aed !important;
          box-shadow: inset 0 0 0 1.5px #8b5cf6 !important;
        }
        .smart-paste-toolbar button:focus-visible {
          outline: 2px solid #8b5cf6;
          outline-offset: 2px;
        }
        .smart-paste-editor:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--text-muted, #94a3b8));
          pointer-events: none;
          white-space: pre-wrap;
          display: block;
          line-height: 1.6;
        }
        .smart-paste-editor p {
          margin: 0 0 6px 0;
        }
        .smart-paste-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        .smart-paste-editor td, .smart-paste-editor th {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
        }
        @media (max-width: 960px) {
          .smart-paste-split-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Screen-reader live region outside toolbar */}
      <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {statusAnnouncement}
      </p>

      {/* Hidden file inputs */}
      <input
        ref={fileImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && editorRef.current) {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result === 'string' && editorRef.current) {
                editorRef.current.focus()
                document.execCommand(
                  'insertHTML',
                  false,
                  `<p><img src="${reader.result}" alt="${f.name}" style="max-width: 280px; max-height: 180px; height: auto; border-radius: 8px; border: 1px solid #cbd5e1; margin: 6px 0; display: block;" /></p>`
                )
                runLiveParser()
                showToast('Imagem inserida no editor!', 'success')
              }
            }
            reader.readAsDataURL(f)
          }
          e.target.value = ''
        }}
      />
      <input
        ref={questionImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && uploadTargetQIdx !== null) {
            handleAddImageToCard(uploadTargetQIdx, f)
          }
          setUploadTargetQIdx(null)
          e.target.value = ''
        }}
      />

      {/* ─── HEADER ─── */}
      <div
        style={{
          padding: '16px 22px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          background: 'linear-gradient(180deg, rgba(139,92,246,0.06) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
              flexShrink: 0
            }}
          >
            <ClipboardPaste size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2
                id="smart-paste-dialog-title"
                style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}
              >
                Copiar e Colar Questões — Reconhecimento Inteligente
              </h2>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(139,92,246,0.12)',
                  color: '#7c3aed',
                  border: '1px solid rgba(139,92,246,0.25)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Word • PDF • Google Docs • Web
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
              Cole suas questões abaixo (Ctrl+V / ⌘+V). O sistema identifica enunciados, alternativas, gabaritos (em vermelho, grifados ou no texto), imagens, tabelas e fórmulas em tempo real!
            </p>
          </div>
        </div>

        {/* Live Counters & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              borderRadius: 9,
              background: totalRealQuestions > 0 ? 'rgba(139,92,246,0.1)' : 'hsl(var(--bg-app))',
              border: `1px solid ${totalRealQuestions > 0 ? 'rgba(139,92,246,0.3)' : 'hsl(var(--border-subtle))'}`,
              fontSize: 12,
              fontWeight: 800,
              color: totalRealQuestions > 0 ? '#7c3aed' : 'hsl(var(--text-secondary))'
            }}
          >
            <ListChecks size={14} />
            <span>{totalRealQuestions} {totalRealQuestions === 1 ? 'questão' : 'questões'}</span>
            {cotaQuestoes ? <span style={{ opacity: 0.7, fontWeight: 600 }}>/ meta {cotaQuestoes}</span> : null}
          </div>

          {totalMultipleChoice > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 9,
                background: totalWithGabarito === totalMultipleChoice ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${totalWithGabarito === totalMultipleChoice ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                fontSize: 12,
                fontWeight: 800,
                color: totalWithGabarito === totalMultipleChoice ? '#059669' : '#d97706'
              }}
            >
              <CheckCircle2 size={14} />
              <span>{totalWithGabarito}/{totalMultipleChoice} gabaritos</span>
            </div>
          )}

          {totalImages > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 9,
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.25)',
                fontSize: 12,
                fontWeight: 800,
                color: '#2563eb'
              }}
            >
              <ImageIcon size={14} />
              <span>{totalImages} {totalImages === 1 ? 'imagem' : 'imagens'}</span>
            </div>
          )}

          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de importação"
              title="Fechar (Esc)"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: '1px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-app))',
                color: 'hsl(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* ─── TOAST FEEDBACK BANNER ─── */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background:
                toastFeedback.type === 'success'
                  ? 'rgba(16,185,129,0.1)'
                  : toastFeedback.type === 'warning'
                  ? 'rgba(245,158,11,0.12)'
                  : 'rgba(59,130,246,0.1)',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              padding: '8px 22px',
              fontSize: 12.5,
              fontWeight: 700,
              color:
                toastFeedback.type === 'success'
                  ? '#059669'
                  : toastFeedback.type === 'warning'
                  ? '#d97706'
                  : '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Sparkles size={14} />
              {toastFeedback.text}
            </span>
            <button
              type="button"
              onClick={() => setToastFeedback(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
              aria-label="Fechar aviso"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN SPLIT WORKSPACE ─── */}
      <div
        className="smart-paste-split-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.08fr)',
          flex: 1,
          minHeight: mode === 'inline' ? 560 : 0,
          overflow: 'hidden'
        }}
      >
        {/* ─── LEFT PANE: RICH PASTE EDITOR & TOOLS ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid hsl(var(--border-subtle))',
            minHeight: 0,
            background: 'hsl(var(--bg-app))'
          }}
        >
          {/* Accessible Formatting & Smart Actions Toolbar */}
          <div
            ref={toolbarRef}
            role="toolbar"
            {...({ focusgroup: 'toolbar wrap' } as any)}
            aria-label="Formatação e ferramentas de colagem"
            aria-controls="smart-paste-rich-editor"
            className="smart-paste-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 14px',
              background: 'hsl(var(--bg-surface))',
              borderBottom: '1px solid hsl(var(--border-subtle))'
            }}
          >
            {/* Group 1: Rich Text Formatting */}
            <div role="group" aria-label="Estilo de texto" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                type="button"
                aria-label="Negrito"
                title="Negrito (Ctrl+B)"
                aria-pressed={activeFormats.bold}
                onMouseDown={(e) => { e.preventDefault(); applyEditorCommand('bold') }}
                style={{
                  minInlineSize: 28,
                  minBlockSize: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'hsl(var(--text-primary))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Bold size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Itálico"
                title="Itálico (Ctrl+I)"
                aria-pressed={activeFormats.italic}
                onMouseDown={(e) => { e.preventDefault(); applyEditorCommand('italic') }}
                style={{
                  minInlineSize: 28,
                  minBlockSize: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'hsl(var(--text-primary))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Italic size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Sublinhado"
                title="Sublinhado (Ctrl+U)"
                aria-pressed={activeFormats.underline}
                onMouseDown={(e) => { e.preventDefault(); applyEditorCommand('underline') }}
                style={{
                  minInlineSize: 28,
                  minBlockSize: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'hsl(var(--text-primary))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Underline size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Subscrito (ex: H₂O)"
                title="Subscrito (H₂O)"
                aria-pressed={activeFormats.subscript}
                onMouseDown={(e) => { e.preventDefault(); applyEditorCommand('subscript') }}
                style={{
                  minInlineSize: 28,
                  minBlockSize: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'hsl(var(--text-primary))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Subscript size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Sobrescrito (ex: x²)"
                title="Sobrescrito (x²)"
                aria-pressed={activeFormats.superscript}
                onMouseDown={(e) => { e.preventDefault(); applyEditorCommand('superscript') }}
                style={{
                  minInlineSize: 28,
                  minBlockSize: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'hsl(var(--text-primary))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Superscript size={14} aria-hidden="true" />
              </button>
            </div>

            <span role="separator" aria-orientation="vertical" style={{ width: 0, height: 18, borderLeft: '1px solid hsl(var(--border-subtle))' }} />

            {/* Group 2: Math, Table, Image & Gabarito Marker */}
            <div role="group" aria-label="Inserção de elementos" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={handleInsertFormula}
                title="Abrir teclado visual de Fórmulas Matemáticas (LaTeX/KaTeX)"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(139,92,246,0.25)',
                  background: 'rgba(139,92,246,0.08)',
                  color: '#7c3aed',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Sigma size={13} aria-hidden="true" />
                <span>Fórmula</span>
              </button>

              <button
                type="button"
                onClick={() => fileImageInputRef.current?.click()}
                title="Inserir imagem do computador na posição do cursor"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(59,130,246,0.25)',
                  background: 'rgba(59,130,246,0.08)',
                  color: '#2563eb',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <ImageIcon size={13} aria-hidden="true" />
                <span>Imagem</span>
              </button>

              <button
                type="button"
                onClick={handleInsertTable}
                title="Inserir tabela 2x2 no texto"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-app))',
                  color: 'hsl(var(--text-secondary))',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Table size={13} aria-hidden="true" />
                <span>Tabela</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleMarkSelectionAsGabarito() }}
                title="Marcar a alternativa selecionada no texto como Gabarito (Vermelho)"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Check size={13} aria-hidden="true" />
                <span>Marcar Gabarito</span>
              </button>
            </div>

            <span role="separator" aria-orientation="vertical" style={{ width: 0, height: 18, borderLeft: '1px solid hsl(var(--border-subtle))' }} />

            {/* Group 3: Utilities (PDF Reflow, Sample, Clear) */}
            <div role="group" aria-label="Ações rápidas do editor" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={handleReflowPdfLines}
                title="Unir frases quebradas ao copiar de PDFs em 2 colunas"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-app))',
                  color: 'hsl(var(--text-secondary))',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Wand2 size={12} aria-hidden="true" />
                <span>Unir Linhas PDF</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                title="Carregar modelo de exemplo com 3 questões"
                style={{
                  minBlockSize: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-app))',
                  color: '#8b5cf6',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={12} aria-hidden="true" />
                <span>Exemplo</span>
              </button>

              {!editorEmpty && (
                <button
                  type="button"
                  onClick={handleClearEditor}
                  aria-label="Limpar todo o texto colado"
                  title="Limpar tudo"
                  style={{
                    minInlineSize: 28,
                    minBlockSize: 28,
                    padding: '0 6px',
                    borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(239,68,68,0.06)',
                    color: '#ef4444',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Rich ContentEditable Area */}
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 320, overflow: 'hidden' }}>
            <div
              id="smart-paste-rich-editor"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onPaste={handleEditorPaste}
              onInput={scheduleLiveParse}
              onKeyUp={updateToolbarActiveStates}
              onMouseUp={updateToolbarActiveStates}
              className="smart-paste-editor"
              data-placeholder={`Cole aqui suas questões do Word, Google Docs, PDF ou Internet (Ctrl+V / ⌘+V)...\n\nFormatos reconhecidos automaticamente:\n• Questões: "1.", "1)", "1 -", "Questão 01", ou até sem número!\n• Alternativas: "a)", "A.", "(A)", em várias linhas ou na mesma linha!\n• Gabarito: Texto em vermelho/verde, grifado em amarelo, [X], "Gabarito: B" ou lista de gabarito no final!\n• Imagens e Fórmulas: Copie do Word com imagens ou cole prints (Ctrl+V) direto aqui!`}
              style={{
                flex: 1,
                padding: '16px 18px',
                overflowY: 'auto',
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'hsl(var(--text-primary))',
                outline: 'none',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            />

            {/* Floating Quick Paste Button when empty */}
            {editorEmpty && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  display: 'flex',
                  gap: 8
                }}
              >
                <button
                  type="button"
                  onClick={handlePasteFromClipboardButton}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
                  }}
                >
                  <ClipboardPaste size={14} /> Colar da Área de Transferência
                </button>
              </div>
            )}
          </div>

          {/* Bottom Bar of Left Pane: Bulk Gabarito Quick Input */}
          <div
            style={{
              padding: '10px 14px',
              background: 'hsl(var(--bg-surface))',
              borderTop: '1px solid hsl(var(--border-subtle))',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: '#059669', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Gabarito Rápido em Lote:</span>
            </div>
            <input
              type="text"
              value={bulkGabaritoInput}
              onChange={(e) => handleApplyBulkGabarito(e.target.value)}
              placeholder="Ex: 1-A, 2-C, 3-B, 4-D, 5-E  ou  A C B D E"
              style={{
                flex: 1,
                minWidth: 180,
                padding: '6px 11px',
                borderRadius: 8,
                border: '1px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-app))',
                color: 'hsl(var(--text-primary))',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none'
              }}
            />
            {bulkGabaritoInput && (
              <button
                type="button"
                onClick={() => handleApplyBulkGabarito('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(var(--text-secondary))',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANE: LIVE INTERACTIVE RECOGNITION PREVIEW ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'hsl(var(--bg-surface))'
          }}
        >
          {/* Right Pane Subheader */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'hsl(var(--bg-surface))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
              <Eye size={15} color="#8b5cf6" />
              <span>Questões Identificadas em Tempo Real ({parsedQuestoes.length})</span>
            </div>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
              Clique na letra (A-E) para alterar o gabarito
            </span>
          </div>

          {/* Questions Preview Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: 'hsl(var(--bg-app))'
            }}
          >
            {parsedQuestoes.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 28,
                  border: '2px dashed hsl(var(--border-subtle))',
                  borderRadius: 16,
                  background: 'hsl(var(--bg-surface))'
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'rgba(139,92,246,0.1)',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>
                  Aguardando questões coladas...
                </div>
                <div style={{ fontSize: 12.5, color: 'hsl(var(--text-secondary))', maxWidth: 340, lineHeight: 1.5 }}>
                  Assim que você colar ou digitar no campo à esquerda, cada questão, alternativa, gabarito e imagem aparecerá organizada aqui!
                </div>
              </div>
            ) : (
              parsedQuestoes.map((q, qIdx) => {
                const isApoio = q.tipo_questao === 'texto_apoio'
                const isDesc = q.tipo_questao === 'descritiva'
                const alts = Array.isArray(q.alternativas) ? q.alternativas : []

                return (
                  <div
                    key={q.id || qIdx}
                    style={{
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Card Top Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isApoio ? (
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: 7,
                              background: 'rgba(168,85,247,0.14)',
                              color: '#9333ea',
                              fontSize: 11,
                              fontWeight: 800
                            }}
                          >
                            TEXTO DE APOIO
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: 7,
                              background: 'rgba(139,92,246,0.12)',
                              color: '#7c3aed',
                              fontSize: 12,
                              fontWeight: 800
                            }}
                          >
                            Questão #{q.numero}
                          </span>
                        )}

                        {/* Type Switcher Pills */}
                        <div
                          style={{
                            display: 'inline-flex',
                            background: 'hsl(var(--bg-app))',
                            padding: 2,
                            borderRadius: 7,
                            border: '1px solid hsl(var(--border-subtle))',
                            gap: 2
                          }}
                        >
                          {(
                            [
                              { id: 'multipla_escolha', label: 'Objetiva' },
                              { id: 'descritiva', label: 'Descritiva' },
                              { id: 'texto_apoio', label: 'Apoio' }
                            ] as const
                          ).map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleChangeCardType(qIdx, t.id)}
                              style={{
                                padding: '2px 7px',
                                borderRadius: 5,
                                border: 'none',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: q.tipo_questao === t.id ? '#8b5cf6' : 'transparent',
                                color: q.tipo_questao === t.id ? '#fff' : 'hsl(var(--text-secondary))'
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isApoio && !isDesc && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: q.gabarito ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                              color: q.gabarito ? '#059669' : '#d97706'
                            }}
                          >
                            {q.gabarito ? `✓ Gab: ${q.gabarito}` : '⚠️ Sem Gabarito'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setUploadTargetQIdx(qIdx)
                            questionImageInputRef.current?.click()
                          }}
                          title="Anexar imagem a esta questão"
                          style={{
                            padding: '3px 7px',
                            borderRadius: 6,
                            border: '1px solid rgba(59,130,246,0.25)',
                            background: 'rgba(59,130,246,0.08)',
                            color: '#2563eb',
                            fontSize: 10.5,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer'
                          }}
                        >
                          <ImageIcon size={11} /> + Img
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveCardQuestion(qIdx)}
                          title="Remover esta questão"
                          aria-label={`Remover questão ${q.numero}`}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border: 'none',
                            background: 'rgba(239,68,68,0.08)',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Enunciado Preview */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'hsl(var(--bg-app))',
                        border: '1px solid hsl(var(--border-subtle))',
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: 'hsl(var(--text-primary))'
                      }}
                    >
                      <HtmlContent
                        html={q.enunciado || '<span style="color:#94a3b8;font-style:italic">Enunciado vazio</span>'}
                        editable
                        onBlurHtml={(newHtml) => {
                          setParsedQuestoes(prev => prev.map((item, i) => (i === qIdx ? { ...item, enunciado: newHtml } : item)))
                        }}
                      />
                    </div>

                    {/* Attached Question Images */}
                    {Array.isArray(q.imagens) && q.imagens.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {q.imagens.map((img: any, imgIdx: number) => {
                          const src = (typeof img === 'string' ? img : img.src || '').split('#')[0]
                          return (
                            <div
                              key={imgIdx}
                              style={{
                                position: 'relative',
                                width: 110,
                                height: 74,
                                borderRadius: 8,
                                border: '1px solid #93c5fd',
                                background: '#fff',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <img src={src} alt={`Img ${imgIdx + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 3,
                                  left: 3,
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'rgba(15,23,42,0.8)',
                                  color: '#fff'
                                }}
                              >
                                [IMAGEM {imgIdx + 1}]
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveImageFromCard(qIdx, imgIdx)}
                                title="Remover imagem"
                                style={{
                                  position: 'absolute',
                                  top: 3,
                                  right: 3,
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: 'rgba(239,68,68,0.9)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Alternatives List */}
                    {!isApoio && !isDesc && alts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {alts.map((alt: any, aIdx: number) => {
                          const isCorr = Boolean(alt.correct || alt.correta)
                          const letter = alt.letter || alt.letra || String.fromCharCode(65 + aIdx)
                          return (
                            <div
                              key={aIdx}
                              onClick={() => handleSelectGabaritoOnCard(qIdx, letter)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                borderRadius: 9,
                                background: isCorr ? 'rgba(16,185,129,0.08)' : 'hsl(var(--bg-app))',
                                border: `1.5px solid ${isCorr ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: isCorr ? '#10b981' : 'rgba(100,116,139,0.12)',
                                  color: isCorr ? '#fff' : 'hsl(var(--text-secondary))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  flexShrink: 0
                                }}
                              >
                                {letter}
                              </div>
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'hsl(var(--text-primary))' }}
                              >
                                <HtmlContent
                                  html={alt.text || alt.texto || ''}
                                  editable
                                  onBlurHtml={(newAltHtml) => {
                                    setParsedQuestoes(prev =>
                                      prev.map((item, idx) => {
                                        if (idx !== qIdx) return item
                                        const nextAlts = [...(item.alternativas || [])]
                                        nextAlts[aIdx] = { ...nextAlts[aIdx], text: newAltHtml, texto: newAltHtml }
                                        return { ...item, alternativas: nextAlts }
                                      })
                                    )
                                  }}
                                />
                                {alt.imagem_url && (
                                  <img
                                    src={alt.imagem_url.split('#')[0]}
                                    alt={`Alt ${letter}`}
                                    style={{ maxHeight: 48, borderRadius: 4, marginTop: 4, display: 'block' }}
                                  />
                                )}
                              </div>
                              {isCorr && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    color: '#059669',
                                    background: 'rgba(16,185,129,0.14)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    flexShrink: 0
                                  }}
                                >
                                  CORRETA
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isDesc && (
                      <div style={{ fontSize: 11.5, color: '#8b5cf6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlignLeft size={13} /> Questão Descritiva / Discursiva (5 linhas pautadas configuradas)
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div
        style={{
          padding: '14px 22px',
          borderTop: '1px solid hsl(var(--border-subtle))',
          background: 'hsl(var(--bg-surface))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {existingCount > 0 && (
            <div
              style={{
                display: 'inline-flex',
                background: 'hsl(var(--bg-app))',
                padding: 3,
                borderRadius: 9,
                border: '1px solid hsl(var(--border-subtle))',
                gap: 3
              }}
            >
              <button
                type="button"
                onClick={() => setImportMode('append')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: importMode === 'append' ? '#8b5cf6' : 'transparent',
                  color: importMode === 'append' ? '#fff' : 'hsl(var(--text-secondary))'
                }}
              >
                + Somar às {existingCount} existentes
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: importMode === 'replace' ? '#ef4444' : 'transparent',
                  color: importMode === 'replace' ? '#fff' : 'hsl(var(--text-secondary))'
                }}
              >
                Substituir todas
              </button>
            </div>
          )}

          <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
            💡 Você poderá continuar editando cada detalhe e pré-visualizar a folha A4 no próximo passo.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: 11,
                border: '1px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-app))',
                color: 'hsl(var(--text-secondary))',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            disabled={parsedQuestoes.length === 0 || isImporting}
            onClick={handleConfirmImport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              borderRadius: 11,
              border: 'none',
              background:
                parsedQuestoes.length === 0
                  ? 'rgba(139,92,246,0.35)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: parsedQuestoes.length === 0 || isImporting ? 'not-allowed' : 'pointer',
              boxShadow: parsedQuestoes.length > 0 ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processando e enviando imagens...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>
                  Confirmar e Abrir {parsedQuestoes.length} {parsedQuestoes.length === 1 ? 'Questão' : 'Questões'} no Editor
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  if (mode === 'inline') {
    return studioBody
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="smart-paste-dialog-title"
      className="smart-paste-dialog"
      onClose={() => {
        if (onClose) onClose()
      }}
    >
      {studioBody}
    </dialog>
  )
}
