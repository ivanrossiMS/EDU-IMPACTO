'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Eraser,
  Image as ImageIcon,
  Loader2,
  Undo2,
  Redo2,
  Highlighter,
  Sigma,
  Table as TableIcon,
  Quote,
  Trash2,
  Frame,
  Type,
  Maximize2,
  Check,
  X,
  Columns,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import 'katex/dist/katex.min.css'
import katex from 'katex'

export interface RichTextToolbarEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string | number
  maxHeight?: string | number
  compact?: boolean
  inline?: boolean
  variant?: 'full' | 'inline' | 'compact'
  className?: string
  disabled?: boolean
  allowImageUpload?: boolean
}

const SYMBOL_CATEGORIES = {
  matematica: {
    label: 'Matemática',
    items: [
      { label: '±', insert: '±', title: 'Mais ou menos' },
      { label: '×', insert: '×', title: 'Multiplicação' },
      { label: '÷', insert: '÷', title: 'Divisão' },
      { label: '≠', insert: '≠', title: 'Diferente' },
      { label: '≈', insert: '≈', title: 'Aproximadamente igual' },
      { label: '≡', insert: '≡', title: 'Idêntico / Congruente' },
      { label: '≤', insert: '≤', title: 'Menor ou igual' },
      { label: '≥', insert: '≥', title: 'Maior ou igual' },
      { label: '∞', insert: '∞', title: 'Infinito' },
      { label: '√', insert: '√', title: 'Raiz quadrada' },
      { label: '∛', insert: '∛', title: 'Raiz cúbica' },
      { label: '∆', insert: '∆', title: 'Delta / Variação' },
      { label: 'π', insert: 'π', title: 'Pi' },
      { label: '°', insert: '°', title: 'Grau' },
      { label: '°C', insert: '°C', title: 'Graus Celsius' },
      { label: '∠', insert: '∠', title: 'Ângulo' },
      { label: '⊥', insert: '⊥', title: 'Perpendicular' },
      { label: '∥', insert: '∥', title: 'Paralelo' },
      { label: '∴', insert: '∴', title: 'Portanto' },
      { label: '∝', insert: '∝', title: 'Proporcional a' },
    ]
  },
  grego: {
    label: 'Grego & Conjuntos',
    items: [
      { label: 'α', insert: 'α', title: 'Alfa' },
      { label: 'β', insert: 'β', title: 'Beta' },
      { label: 'γ', insert: 'γ', title: 'Gama' },
      { label: 'δ', insert: 'δ', title: 'Delta minúsculo' },
      { label: 'θ', insert: 'θ', title: 'Teta' },
      { label: 'λ', insert: 'λ', title: 'Lambda' },
      { label: 'μ', insert: 'μ', title: 'Mi / Micro' },
      { label: 'σ', insert: 'σ', title: 'Sigma minúsculo' },
      { label: 'Σ', insert: 'Σ', title: 'Somatório / Sigma' },
      { label: 'φ', insert: 'φ', title: 'Fi' },
      { label: 'ω', insert: 'ω', title: 'Ômega minúsculo' },
      { label: 'Ω', insert: 'Ω', title: 'Ômega / Ohm' },
      { label: '∈', insert: '∈', title: 'Pertence' },
      { label: '∉', insert: '∉', title: 'Não pertence' },
      { label: '⊂', insert: '⊂', title: 'Está contido' },
      { label: '∪', insert: '∪', title: 'União' },
      { label: '∩', insert: '∩', title: 'Interseção' },
      { label: '∅', insert: '∅', title: 'Conjunto vazio' },
      { label: 'ℕ', insert: 'ℕ', title: 'Naturais' },
      { label: 'ℤ', insert: 'ℤ', title: 'Inteiros' },
      { label: 'ℚ', insert: 'ℚ', title: 'Racionais' },
      { label: 'ℝ', insert: 'ℝ', title: 'Reais' },
    ]
  },
  quimica: {
    label: 'Química & Setas',
    items: [
      { label: '→', insert: ' → ', title: 'Reação / Seta direita' },
      { label: '←', insert: ' ← ', title: 'Seta esquerda' },
      { label: '↔', insert: ' ↔ ', title: 'Ressonância / Dupla seta' },
      { label: '⇌', insert: ' ⇌ ', title: 'Equilíbrio químico' },
      { label: '⇒', insert: ' ⇒ ', title: 'Implica' },
      { label: '⇔', insert: ' ⇔ ', title: 'Se e somente se' },
      { label: '↑', insert: '↑', title: 'Desprendimento de gás' },
      { label: '↓', insert: '↓', title: 'Precipitado' },
      { label: 'H₂O', insert: 'H<sub>2</sub>O', title: 'Água', isHtml: true },
      { label: 'CO₂', insert: 'CO<sub>2</sub>', title: 'Dióxido de carbono', isHtml: true },
      { label: 'O₂', insert: 'O<sub>2</sub>', title: 'Gás oxigênio', isHtml: true },
      { label: 'H⁺', insert: 'H<sup>+</sup>', title: 'Íon Hidrogênio', isHtml: true },
      { label: 'OH⁻', insert: 'OH<sup>−</sup>', title: 'Hidroxila', isHtml: true },
      { label: 'e⁻', insert: 'e<sup>−</sup>', title: 'Elétron', isHtml: true },
      { label: '10ⁿ', insert: '10<sup>n</sup>', title: 'Notação científica', isHtml: true },
      { label: 'm/s²', insert: 'm/s<sup>2</sup>', title: 'Aceleração', isHtml: true },
    ]
  },
  formulas: {
    label: 'Fórmulas LaTeX',
    items: [
      { label: 'a/b (Fração)', insert: '\\(\\frac{a}{b}\\)', title: 'Fração matemática' },
      { label: '√x (Raiz)', insert: '\\(\\sqrt{x}\\)', title: 'Raiz quadrada' },
      { label: 'ⁿ√x (Raiz n)', insert: '\\(\\sqrt[n]{x}\\)', title: 'Raiz de índice n' },
      { label: 'xⁿ (Potência)', insert: '\\(x^{n}\\)', title: 'Potência' },
      { label: 'xᵢ (Índice)', insert: '\\(x_{i}\\)', title: 'Subscrito' },
      { label: 'Bhaskara', insert: '\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)', title: 'Fórmula de Bhaskara' },
      { label: 'Eq. 2º Grau', insert: '\\(ax^2 + bx + c = 0\\)', title: 'Equação do 2º grau' },
      { label: 'Logaritmo', insert: '\\(\\log_{b}(a) = x\\)', title: 'Logaritmo' },
      { label: 'Somatório', insert: '\\(\\sum_{i=1}^{n} x_i\\)', title: 'Somatório' },
      { label: 'Limite', insert: '\\(\\lim_{x \\to a} f(x)\\)', title: 'Limite' },
      { label: 'Integral', insert: '\\(\\int_{a}^{b} f(x)\\,dx\\)', title: 'Integral definida' },
      { label: 'Vetor', insert: '\\(\\vec{v}\\)', title: 'Vetor' },
    ]
  }
}

const HIGHLIGHT_COLORS = [
  { label: 'Amarelo', color: '#fef08a', border: '#facc15' },
  { label: 'Verde', color: '#bbf7d0', border: '#4ade80' },
  { label: 'Azul', color: '#bae6fd', border: '#38bdf8' },
  { label: 'Rosa', color: '#fecdd3', border: '#fb7185' },
  { label: 'Roxo', color: '#e9d5ff', border: '#c084fc' },
  { label: 'Sem Grifo', color: 'transparent', border: '#cbd5e1' },
]

/**
 * RichTextToolbarEditor
 * Editor HTML rico interativo (WYSIWYG) para enunciados, textos de apoio e alternativas
 * das provas online. Suporta controle interativo de imagens (tamanho, margens, alinhamento,
 * moldura, legenda), fórmulas matemáticas LaTeX/KaTeX, tabelas, citações e colagem direta.
 */
export function RichTextToolbarEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight: rawMinHeight = '120px',
  maxHeight: rawMaxHeight = '420px',
  compact: rawCompact = false,
  inline: rawInline = false,
  variant,
  className = '',
  disabled = false,
  allowImageUpload = true,
}: RichTextToolbarEditorProps) {
  const inline = rawInline || variant === 'inline'
  const compact = rawCompact || variant === 'inline' || variant === 'compact'
  const minHeight = typeof rawMinHeight === 'number' ? `${rawMinHeight}px` : rawMinHeight
  const maxHeight = typeof rawMaxHeight === 'number' ? `${rawMaxHeight}px` : rawMaxHeight

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const isInternalChangeRef = useRef(false)

  const [isFocused, setIsFocused] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [paperFramingMode, setPaperFramingMode] = useState(false)

  // Popovers state
  const [openPopover, setOpenPopover] = useState<'symbols' | 'highlight' | 'table' | null>(null)
  const [symbolTab, setSymbolTab] = useState<'matematica' | 'grego' | 'quimica' | 'formulas'>('matematica')
  const [customLatex, setCustomLatex] = useState('')

  // Selected image inspector state
  const [selectedImgIndex, setSelectedImgIndex] = useState<number | null>(null)
  const [selectedImgWidth, setSelectedImgWidth] = useState<number>(75) // percentage 15..100
  const [selectedImgAlign, setSelectedImgAlign] = useState<'left' | 'center' | 'right'>('center')
  const [selectedImgFramed, setSelectedImgFramed] = useState<boolean>(false)

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    subscript: false,
    superscript: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  })

  /**
   * Normalizes plain text with line breaks into HTML paragraphs if it has no HTML tags yet.
   */
  const normalizeValueToHtml = useCallback((raw: string): string => {
    if (!raw) return ''
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
      return trimmed
        .split(/\r?\n/)
        .map(line => line || '<br>')
        .join('<br>')
    }
    return raw
  }, [])

  // Sync external value into contentEditable when value changes from outside
  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }

    const normalized = normalizeValueToHtml(value)
    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized
    }
  }, [value, normalizeValueToHtml])

  // Apply visual selection class to whichever image is currently selected
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const imgs = el.querySelectorAll('img')
    imgs.forEach((img, idx) => {
      if (idx === selectedImgIndex) {
        img.setAttribute('data-rte-selected', 'true')
      } else {
        img.removeAttribute('data-rte-selected')
      }
    })
  }, [selectedImgIndex, value])

  const saveSelection = useCallback(() => {
    if (typeof window === 'undefined') return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0)
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange()
      }
    }
  }, [])

  const restoreSelection = useCallback(() => {
    if (typeof window === 'undefined') return
    const sel = window.getSelection()
    if (sel && savedRangeRef.current && editorRef.current) {
      try {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      } catch {
        // Ignore invalid range errors
      }
    } else if (editorRef.current) {
      editorRef.current.focus()
    }
  }, [])

  const updateToolbarState = useCallback(() => {
    if (typeof document === 'undefined') return
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        subscript: document.queryCommandState('subscript'),
        superscript: document.queryCommandState('superscript'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      })
    } catch {
      // Ignore queryCommandState errors
    }
  }, [])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    isInternalChangeRef.current = true
    // Strip temporary editor selection attribute before saving HTML
    const clone = el.cloneNode(true) as HTMLDivElement
    clone.querySelectorAll('img[data-rte-selected]').forEach(img => {
      img.removeAttribute('data-rte-selected')
    })
    const rawHtml = clone.innerHTML
    const textOnly = (el.textContent || '').trim()
    const hasMediaOrTable = Boolean(el.querySelector('img, table, hr, iframe, svg'))
    if (!textOnly && !hasMediaOrTable) {
      onChange('')
    } else {
      onChange(rawHtml)
    }
  }, [onChange])

  const execFormat = (e: React.MouseEvent, command: string, arg?: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return

    restoreSelection()
    document.execCommand(command, false, arg)
    saveSelection()
    updateToolbarState()
    emitChange()
  }

  const handleClearFormatting = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return

    restoreSelection()
    document.execCommand('removeFormat', false)
    document.execCommand('unlink', false)
    saveSelection()
    updateToolbarState()
    emitChange()
  }

  const insertHtmlSnippet = useCallback((htmlSnippet: string) => {
    if (disabled || !editorRef.current) return
    editorRef.current.focus()
    restoreSelection()

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, htmlSnippet)
    } else {
      editorRef.current.insertAdjacentHTML('beforeend', htmlSnippet)
    }

    saveSelection()
    emitChange()
  }, [disabled, restoreSelection, saveSelection, emitChange])

  const handleInsertReadingBox = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const snippet = `
      <blockquote style="margin: 10px 0; padding: 12px 16px; border-left: 4px solid #0284c7; background: #f8fafc; border-radius: 0 10px 10px 0; color: #1e293b;">
        <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 0.92em; text-transform: uppercase; color: #0369a1;">Texto de Apoio</p>
        <p style="margin: 0 0 6px 0; text-align: justify;">Digite ou cole aqui o texto-base, trecho literário ou reportagem da questão...</p>
        <p style="margin: 0; font-size: 0.8em; color: #64748b; text-align: right; font-style: italic;">Fonte: Autor, Obra, Ano.</p>
      </blockquote>
      <p><br></p>
    `
    insertHtmlSnippet(snippet)
    setOpenPopover(null)
  }

  const handleInsertTable = (rows: number, cols: number) => {
    let headerCells = ''
    for (let c = 0; c < cols; c++) {
      headerCells += `<th style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #f1f5f9; font-weight: 700; text-align: center;">Coluna ${c + 1}</th>`
    }
    let bodyRows = ''
    for (let r = 0; r < rows - 1; r++) {
      let cells = ''
      for (let c = 0; c < cols; c++) {
        cells += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">Dado</td>`
      }
      bodyRows += `<tr>${cells}</tr>`
    }
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.92em;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p><br></p>
    `
    insertHtmlSnippet(tableHtml)
    setOpenPopover(null)
  }

  // Image Inspection & Manipulation
  const inspectClickedElement = useCallback((target: HTMLElement) => {
    const el = editorRef.current
    if (!el) return

    const clickedImg = target.tagName === 'IMG' ? (target as HTMLImageElement) : (target.closest('img') as HTMLImageElement | null)
    if (!clickedImg || !el.contains(clickedImg)) {
      if (selectedImgIndex !== null) {
        setSelectedImgIndex(null)
      }
      return
    }

    const allImgs = Array.from(el.querySelectorAll('img'))
    const idx = allImgs.indexOf(clickedImg)
    if (idx === -1) {
      setSelectedImgIndex(null)
      return
    }

    setSelectedImgIndex(idx)

    // Parse current width percentage
    const styleWidth = clickedImg.style.width || clickedImg.getAttribute('data-width') || ''
    let parsedWidth = 75
    if (styleWidth.endsWith('%')) {
      parsedWidth = Math.min(100, Math.max(15, parseInt(styleWidth, 10) || 75))
    } else if (styleWidth.endsWith('px')) {
      const px = parseInt(styleWidth, 10) || 400
      const containerW = el.clientWidth || 640
      parsedWidth = Math.min(100, Math.max(15, Math.round((px / containerW) * 100)))
    }
    setSelectedImgWidth(parsedWidth)

    // Parse current alignment
    const dataAlign = clickedImg.getAttribute('data-align') as 'left' | 'center' | 'right' | null
    const parentAlign = clickedImg.parentElement?.style?.textAlign
    if (dataAlign === 'left' || dataAlign === 'center' || dataAlign === 'right') {
      setSelectedImgAlign(dataAlign)
    } else if (parentAlign === 'left' || parentAlign === 'right' || parentAlign === 'center') {
      setSelectedImgAlign(parentAlign)
    } else {
      setSelectedImgAlign('center')
    }

    // Parse frame state
    setSelectedImgFramed(clickedImg.getAttribute('data-framed') === 'true')
  }, [selectedImgIndex])

  const applyChangesToSelectedImage = useCallback((updates: {
    widthPct?: number
    align?: 'left' | 'center' | 'right'
    framed?: boolean
  }) => {
    const el = editorRef.current
    if (!el || selectedImgIndex === null) return

    const imgs = el.querySelectorAll('img')
    const img = imgs[selectedImgIndex] as HTMLImageElement | undefined
    if (!img) return

    const nextWidth = updates.widthPct ?? selectedImgWidth
    const nextAlign = updates.align ?? selectedImgAlign
    const nextFramed = updates.framed ?? selectedImgFramed

    setSelectedImgWidth(nextWidth)
    setSelectedImgAlign(nextAlign)
    setSelectedImgFramed(nextFramed)

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

    if (nextFramed) {
      img.setAttribute('data-framed', 'true')
      img.style.border = '1px solid #cbd5e1'
      img.style.padding = '6px'
      img.style.background = '#ffffff'
      img.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'
    } else {
      img.removeAttribute('data-framed')
      img.style.border = ''
      img.style.padding = ''
      img.style.background = ''
      img.style.boxShadow = ''
    }

    // Also update immediate parent wrapper if it only wraps this image
    const parent = img.parentElement
    if (parent && parent !== el && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
      parent.style.textAlign = nextAlign
    }

    emitChange()
  }, [selectedImgIndex, selectedImgWidth, selectedImgAlign, selectedImgFramed, emitChange])

  const handleAddImageCaption = () => {
    const el = editorRef.current
    if (!el || selectedImgIndex === null) return
    const imgs = el.querySelectorAll('img')
    const img = imgs[selectedImgIndex]
    if (!img) return

    const captionP = document.createElement('p')
    captionP.style.fontSize = '11px'
    captionP.style.color = '#64748b'
    captionP.style.textAlign = selectedImgAlign
    captionP.style.fontStyle = 'italic'
    captionP.style.marginTop = '4px'
    captionP.style.marginBottom = '10px'
    captionP.innerHTML = 'Figura: Digite a legenda ou fonte da imagem...'

    const parent = img.parentElement
    if (parent && parent !== el) {
      parent.insertAdjacentElement('afterend', captionP)
    } else {
      img.insertAdjacentElement('afterend', captionP)
    }

    emitChange()
    toast.success('Legenda adicionada abaixo da figura!')
  }

  const handleDeleteSelectedImage = () => {
    const el = editorRef.current
    if (!el || selectedImgIndex === null) return
    const imgs = el.querySelectorAll('img')
    const img = imgs[selectedImgIndex]
    if (!img) return

    const parent = img.parentElement
    img.remove()
    if (parent && parent !== el && (parent.textContent || '').trim() === '' && parent.children.length === 0) {
      parent.remove()
    }
    setSelectedImgIndex(null)
    emitChange()
    toast.info('Imagem removida.')
  }

  /**
   * Compress large images client-side before converting or uploading so exams stay fast and crisp
   */
  const optimizeImageFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        if (file.type === 'image/svg+xml' || file.size < 250 * 1024) {
          resolve(result)
          return
        }
        const img = new window.Image()
        img.onload = () => {
          const maxDim = 1400
          let { width, height } = img
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(result)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const compressed = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88)
          resolve(compressed.length < result.length ? compressed : result)
        }
        img.onerror = () => resolve(result)
        img.src = result
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10 MB.')
      return
    }

    setUploadingImage(true)
    try {
      let imageUrl = ''
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/provas-online/upload-image', {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          if (data?.url) imageUrl = data.url
        }
      } catch {
        // Fallback to optimized inline data URL
      }

      if (!imageUrl) {
        imageUrl = await optimizeImageFileToDataUrl(file)
      }

      if (editorRef.current) {
        const defaultWidth = inline ? '55%' : '75%'
        const imgHtml = `<div style="margin: 10px 0; text-align: center;"><img src="${imageUrl}" alt="Figura da questão" data-align="center" data-width="${defaultWidth}" style="width: ${defaultWidth}; max-width: 100%; height: auto; border-radius: 8px; display: block; margin-left: auto; margin-right: auto;" /></div>`
        insertHtmlSnippet(imgHtml)
        toast.success('Imagem inserida! Clique nela para ajustar tamanho ou alinhamento.')
      }
    } catch {
      toast.error('Erro ao inserir imagem.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await uploadAndInsertImage(file)
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    const items = e.clipboardData?.items
    if (items && allowImageUpload) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await uploadAndInsertImage(file)
          }
          return
        }
      }
    }

    const htmlData = e.clipboardData?.getData('text/html')
    if (htmlData) {
      e.preventDefault()
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlData, 'text/html')

        doc.querySelectorAll('script, style, meta, link, xml, o\\:p').forEach(n => n.remove())

        doc.querySelectorAll('*').forEach(node => {
          const el = node as HTMLElement
          el.removeAttribute('class')
          el.removeAttribute('id')
          if (el.tagName !== 'IMG' && el.tagName !== 'TABLE' && el.tagName !== 'TD' && el.tagName !== 'TH') {
            const textAlign = el.style?.textAlign
            const fontWeight = el.style?.fontWeight
            const fontStyle = el.style?.fontStyle
            const textDecoration = el.style?.textDecoration
            el.removeAttribute('style')
            if (textAlign && ['center', 'right', 'justify'].includes(textAlign)) {
              el.style.textAlign = textAlign
            }
            if (fontWeight === 'bold' || Number(fontWeight) >= 600) {
              el.style.fontWeight = 'bold'
            }
            if (fontStyle === 'italic') {
              el.style.fontStyle = 'italic'
            }
            if (textDecoration?.includes('underline')) {
              el.style.textDecoration = 'underline'
            }
          } else if (el.tagName === 'IMG') {
            el.style.maxWidth = '100%'
            el.style.height = 'auto'
            el.style.borderRadius = '8px'
            el.style.display = 'block'
            el.style.marginLeft = 'auto'
            el.style.marginRight = 'auto'
            el.setAttribute('data-align', 'center')
          }
        })

        document.execCommand('insertHTML', false, doc.body.innerHTML)
        emitChange()
      } catch {
        const text = e.clipboardData?.getData('text/plain') || ''
        document.execCommand('insertText', false, text)
        emitChange()
      }
    }
  }

  // Live preview of custom LaTeX in the symbol popover
  const customLatexPreview = useMemo(() => {
    if (!customLatex.trim()) return ''
    try {
      return katex.renderToString(customLatex.trim(), { throwOnError: false })
    } catch {
      return ''
    }
  }, [customLatex])

  // Compute text statistics for non-inline editors
  const editorStats = useMemo(() => {
    if (inline || compact) return null
    const plain = (value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const words = plain ? plain.split(' ').length : 0
    const chars = plain.length
    const imgMatches = (value || '').match(/<img\b/gi)
    const images = imgMatches ? imgMatches.length : 0
    return { words, chars, images }
  }, [value, inline, compact])

  const btnBase = `${
    compact ? 'w-7 h-7' : 'w-7.5 h-7.5'
  } rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0`

  const getBtnClass = (active: boolean) =>
    `${btnBase} ${
      active
        ? 'bg-sky-600 text-white shadow-2xs'
        : 'text-slate-600 hover:bg-slate-200/75 hover:text-slate-900'
    }`

  return (
    <div
      className={`rounded-xl border transition-all bg-white relative ${
        isFocused
          ? 'border-sky-500 ring-2 ring-sky-100 shadow-2xs'
          : 'border-slate-200 hover:border-slate-300'
      } ${disabled ? 'opacity-60 pointer-events-none' : ''} ${className}`}
    >
      <style>{`
        .rich-text-editor-content:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          display: block;
        }
        .rich-text-editor-content p {
          margin-top: 0;
          margin-bottom: 0.4em;
        }
        .rich-text-editor-content p:last-child {
          margin-bottom: 0;
        }
        .rich-text-editor-content ul {
          list-style-type: disc;
          padding-left: 1.4rem;
          margin: 0.35rem 0;
        }
        .rich-text-editor-content ol {
          list-style-type: decimal;
          padding-left: 1.4rem;
          margin: 0.35rem 0;
        }
        .rich-text-editor-content sub,
        .rich-text-editor-content sup {
          font-size: 75%;
          line-height: 0;
          position: relative;
          vertical-align: baseline;
        }
        .rich-text-editor-content sub {
          bottom: -0.25em;
        }
        .rich-text-editor-content sup {
          top: -0.5em;
        }
        .rich-text-editor-content blockquote {
          margin: 0.5rem 0;
          padding: 0.65rem 0.9rem;
          border-left: 3.5px solid #0284c7;
          background: #f8fafc;
          border-radius: 0 0.5rem 0.5rem 0;
          color: #1e293b;
        }
        .rich-text-editor-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.5rem 0;
          font-size: 0.92em;
        }
        .rich-text-editor-content th,
        .rich-text-editor-content td {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
        }
        .rich-text-editor-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.35rem 0;
          cursor: pointer;
          transition: outline 0.15s ease, box-shadow 0.15s ease;
        }
        .rich-text-editor-content img:hover {
          outline: 2px dashed #38bdf8;
          outline-offset: 2px;
        }
        .rich-text-editor-content img[data-rte-selected="true"] {
          outline: 2.5px solid #0284c7 !important;
          outline-offset: 3px !important;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.2) !important;
        }
        .rich-text-editor-content img[data-align="center"] {
          display: block;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .rich-text-editor-content img[data-align="left"] {
          display: block;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        .rich-text-editor-content img[data-align="right"] {
          display: block;
          margin-left: auto !important;
          margin-right: 0 !important;
        }
        .rich-text-editor-content img[data-framed="true"] {
          border: 1px solid #cbd5e1 !important;
          padding: 6px !important;
          background: #ffffff !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06) !important;
        }
      `}</style>

      {/* ── MAIN TOOLBAR ── */}
      <div
        className={`flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-slate-200/80 bg-slate-50/90 rounded-t-xl ${
          inline && !isFocused && !openPopover && selectedImgIndex === null ? 'opacity-85 hover:opacity-100' : ''
        }`}
      >
        {/* Undo / Redo */}
        {!inline && (
          <>
            <button
              type="button"
              onMouseDown={e => execFormat(e, 'undo')}
              className={getBtnClass(false)}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onMouseDown={e => execFormat(e, 'redo')}
              className={getBtnClass(false)}
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
          </>
        )}

        {/* Text Style */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'bold')}
          className={getBtnClass(activeFormats.bold)}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={compact ? 13 : 14} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'italic')}
          className={getBtnClass(activeFormats.italic)}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={compact ? 13 : 14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'underline')}
          className={getBtnClass(activeFormats.underline)}
          title="Sublinhado (Ctrl+U)"
        >
          <Underline size={compact ? 13 : 14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'strikeThrough')}
          className={getBtnClass(activeFormats.strikeThrough)}
          title="Tachado / Riscado"
        >
          <Strikethrough size={compact ? 13 : 14} />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Subscript / Superscript */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'subscript')}
          className={getBtnClass(activeFormats.subscript)}
          title="Subscrito (Ex: H₂O)"
        >
          <Subscript size={compact ? 13 : 14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'superscript')}
          className={getBtnClass(activeFormats.superscript)}
          title="Sobrescrito (Ex: x²)"
        >
          <Superscript size={compact ? 13 : 14} />
        </button>

        {/* Highlight Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setOpenPopover(prev => (prev === 'highlight' ? null : 'highlight'))
            }}
            className={getBtnClass(openPopover === 'highlight')}
            title="Marca-texto / Destacar"
          >
            <Highlighter size={compact ? 13 : 14} />
          </button>

          {openPopover === 'highlight' && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-2 flex items-center gap-1.5"
            >
              {HIGHLIGHT_COLORS.map(h => (
                <button
                  key={h.label}
                  type="button"
                  onMouseDown={e => {
                    execFormat(e, 'hiliteColor', h.color)
                    setOpenPopover(null)
                  }}
                  style={{ backgroundColor: h.color === 'transparent' ? '#ffffff' : h.color, borderColor: h.border }}
                  className="w-6 h-6 rounded-md border flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                  title={h.label}
                >
                  {h.color === 'transparent' && <X size={12} className="text-slate-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Paragraph Alignments */}
        {!inline && (
          <>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'justifyLeft')}
              className={getBtnClass(activeFormats.justifyLeft)}
              title="Alinhar à Esquerda"
            >
              <AlignLeft size={compact ? 13 : 14} />
            </button>

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'justifyCenter')}
              className={getBtnClass(activeFormats.justifyCenter)}
              title="Centralizar"
            >
              <AlignCenter size={compact ? 13 : 14} />
            </button>

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'justifyRight')}
              className={getBtnClass(activeFormats.justifyRight)}
              title="Alinhar à Direita (Ex: Fonte bibliográfica)"
            >
              <AlignRight size={compact ? 13 : 14} />
            </button>

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'justifyFull')}
              className={getBtnClass(activeFormats.justifyFull)}
              title="Justificar Texto (Alinhar margens esquerda e direita)"
            >
              <AlignJustify size={compact ? 13 : 14} />
            </button>

            <div className="w-px h-4 bg-slate-200 mx-0.5" />

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'insertUnorderedList')}
              className={getBtnClass(activeFormats.insertUnorderedList)}
              title="Lista com Marcadores"
            >
              <List size={compact ? 13 : 14} />
            </button>

            <button
              type="button"
              onMouseDown={e => execFormat(e, 'insertOrderedList')}
              className={getBtnClass(activeFormats.insertOrderedList)}
              title="Lista Numerada (I, II, III / 1, 2, 3)"
            >
              <ListOrdered size={compact ? 13 : 14} />
            </button>
          </>
        )}

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Math & Scientific Symbols Popover */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setOpenPopover(prev => (prev === 'symbols' ? null : 'symbols'))
            }}
            className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer select-none ${
              openPopover === 'symbols'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200'
            }`}
            title="Inserir Símbolos Matemáticos, Fórmulas, Química e Letras Gregas"
          >
            <Sigma size={13} className={openPopover === 'symbols' ? 'text-white' : 'text-sky-600'} />
            <span className="hidden sm:inline">Fórmulas & Símbolos</span>
          </button>

          {openPopover === 'symbols' && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 z-50 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sigma size={13} className="text-sky-600" /> Painel de Símbolos & Fórmulas
                </span>
                <button
                  type="button"
                  onClick={() => setOpenPopover(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Category Tabs */}
              <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
                {(Object.keys(SYMBOL_CATEGORIES) as Array<keyof typeof SYMBOL_CATEGORIES>).map(catKey => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSymbolTab(catKey)}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer truncate ${
                      symbolTab === catKey
                        ? 'bg-white text-sky-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {SYMBOL_CATEGORIES[catKey].label}
                  </button>
                ))}
              </div>

              {/* Symbols Grid */}
              <div className={`grid ${symbolTab === 'formulas' ? 'grid-cols-2' : 'grid-cols-5'} gap-1.5 max-h-44 overflow-y-auto pr-0.5`}>
                {SYMBOL_CATEGORIES[symbolTab].items.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      if ((item as any).isHtml) {
                        insertHtmlSnippet(item.insert)
                      } else {
                        insertHtmlSnippet(item.insert)
                      }
                    }}
                    title={item.title}
                    className="px-2 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/70 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-800 text-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom LaTeX Builder */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Inserir Fórmula LaTeX Personalizada (Ex: \frac{'{x+1}'}{'{2}'})
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customLatex}
                    onChange={e => setCustomLatex(e.target.value)}
                    placeholder="Ex: \sqrt{a^2 + b^2}"
                    className="flex-1 h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    disabled={!customLatex.trim()}
                    onClick={() => {
                      if (!customLatex.trim()) return
                      insertHtmlSnippet(`\\(${customLatex.trim()}\\) `)
                      setCustomLatex('')
                      setOpenPopover(null)
                    }}
                    className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    Inserir
                  </button>
                </div>
                {customLatexPreview && (
                  <div
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-center text-xs overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: customLatexPreview }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reading Box / Blockquote & Table insertion (for non-inline editors) */}
        {!inline && (
          <>
            <button
              type="button"
              onMouseDown={handleInsertReadingBox}
              className="h-7 px-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Inserir Caixa de Texto de Apoio / Citação com Fonte"
            >
              <Quote size={12} className="text-sky-600" />
              <span className="hidden md:inline">Texto de Apoio</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  saveSelection()
                  setOpenPopover(prev => (prev === 'table' ? null : 'table'))
                }}
                className={getBtnClass(openPopover === 'table')}
                title="Inserir Tabela de Dados"
              >
                <TableIcon size={compact ? 13 : 14} />
              </button>

              {openPopover === 'table' && (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-2.5 space-y-1.5 w-44"
                >
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 px-1">
                    Inserir Tabela
                  </div>
                  {[
                    { label: 'Tabela 2 × 2', r: 2, c: 2 },
                    { label: 'Tabela 3 × 2', r: 3, c: 2 },
                    { label: 'Tabela 3 × 3', r: 3, c: 3 },
                    { label: 'Tabela 4 × 3', r: 4, c: 3 },
                    { label: 'Tabela 5 × 4', r: 5, c: 4 },
                  ].map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => handleInsertTable(t.r, t.c)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>{t.label}</span>
                      <TableIcon size={12} className="text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Clear Formatting */}
        <button
          type="button"
          onMouseDown={handleClearFormatting}
          className={getBtnClass(false)}
          title="Limpar Formatação"
        >
          <Eraser size={compact ? 13 : 14} />
        </button>

        {/* Paper Framing Guide Toggle (for full editors) */}
        {!inline && !compact && (
          <button
            type="button"
            onClick={() => setPaperFramingMode(prev => !prev)}
            className={`h-7 px-2 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer ml-0.5 ${
              paperFramingMode
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="Alternar Guia de Enquadramento e Margens de Folha"
          >
            <Columns size={12} />
            <span className="hidden lg:inline">Guias de Margem</span>
          </button>
        )}

        {/* Image Upload Button */}
        {allowImageUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                saveSelection()
                fileInputRef.current?.click()
              }}
              disabled={uploadingImage}
              className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              title="Inserir ou enviar imagem (ou cole com Ctrl+V)"
            >
              {uploadingImage ? (
                <Loader2 size={12} className="animate-spin text-sky-600" />
              ) : (
                <ImageIcon size={12} className="text-sky-600" />
              )}
              <span>{inline ? 'Figura' : 'Inserir Figura'}</span>
            </button>
          </>
        )}
      </div>

      {/* ── CONTEXTUAL IMAGE FRAMING & MARGIN INSPECTOR BAR ── */}
      {selectedImgIndex !== null && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="px-3 py-2 bg-sky-50/95 border-b border-sky-200 flex items-center justify-between gap-2 flex-wrap animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-sky-900 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-sky-200 shadow-2xs">
              <ImageIcon size={12} className="text-sky-600" />
              Figura #{selectedImgIndex + 1}
            </span>

            {/* Size Presets */}
            <div className="flex items-center bg-white rounded-lg border border-sky-200 p-0.5 shadow-2xs">
              {[
                { label: 'P (25%)', val: 25 },
                { label: 'M (50%)', val: 50 },
                { label: 'G (75%)', val: 75 },
                { label: '100%', val: 100 },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => applyChangesToSelectedImage({ widthPct: preset.val })}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    Math.abs(selectedImgWidth - preset.val) <= 4
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Fine-Grained Slider */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
              <Maximize2 size={11} className="text-slate-400" />
              <input
                type="range"
                min={15}
                max={100}
                step={5}
                value={selectedImgWidth}
                onChange={e => applyChangesToSelectedImage({ widthPct: Number(e.target.value) })}
                className="w-20 accent-sky-600 cursor-pointer h-1.5"
                title="Ajustar largura percentual da imagem"
              />
              <span className="text-[11px] font-extrabold text-sky-800 min-w-[32px] text-right">
                {selectedImgWidth}%
              </span>
            </div>

            {/* Alignment Controls */}
            <div className="flex items-center bg-white rounded-lg border border-sky-200 p-0.5 shadow-2xs">
              {[
                { id: 'left' as const, icon: AlignLeft, title: 'Alinhar à Esquerda' },
                { id: 'center' as const, icon: AlignCenter, title: 'Centralizar na Questão' },
                { id: 'right' as const, icon: AlignRight, title: 'Alinhar à Direita' },
              ].map(al => {
                const Icon = al.icon
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => applyChangesToSelectedImage({ align: al.id })}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      selectedImgAlign === al.id
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title={al.title}
                  >
                    <Icon size={13} />
                  </button>
                )
              })}
            </div>

            {/* Border Frame Toggle */}
            <button
              type="button"
              onClick={() => applyChangesToSelectedImage({ framed: !selectedImgFramed })}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs ${
                selectedImgFramed
                  ? 'bg-sky-600 border-sky-600 text-white'
                  : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100'
              }`}
              title="Adicionar/remover moldura na imagem"
            >
              <Frame size={12} />
              <span>Moldura</span>
            </button>

            {/* Add Caption / Source */}
            {!inline && (
              <button
                type="button"
                onClick={handleAddImageCaption}
                className="h-7 px-2.5 rounded-lg bg-white border border-sky-200 hover:bg-sky-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Inserir linha de legenda ou fonte abaixo da figura"
              >
                <Type size={12} className="text-sky-600" />
                <span>+ Legenda</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleDeleteSelectedImage}
              className="h-7 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              title="Remover esta imagem"
            >
              <Trash2 size={12} />
              <span>Remover</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedImgIndex(null)}
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              title="Fechar painel da imagem"
            >
              <Check size={13} className="text-emerald-600" />
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENTEDITABLE CANVAS ── */}
      <div
        className={
          paperFramingMode
            ? 'bg-slate-100/80 p-3 sm:p-5 transition-all'
            : ''
        }
      >
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onFocus={() => {
            setIsFocused(true)
            saveSelection()
            updateToolbarState()
          }}
          onBlur={() => {
            setIsFocused(false)
            saveSelection()
            emitChange()
          }}
          onInput={() => {
            saveSelection()
            emitChange()
          }}
          onKeyUp={() => {
            saveSelection()
            updateToolbarState()
          }}
          onMouseUp={e => {
            saveSelection()
            updateToolbarState()
            inspectClickedElement(e.target as HTMLElement)
          }}
          onClick={e => {
            if (openPopover) setOpenPopover(null)
            inspectClickedElement(e.target as HTMLElement)
          }}
          onPaste={handlePaste}
          style={{
            minHeight,
            maxHeight,
          }}
          className={`rich-text-editor-content w-full overflow-y-auto focus:outline-none text-slate-800 leading-relaxed break-words ${
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-xs sm:text-sm'
          } ${
            paperFramingMode
              ? 'max-w-[680px] mx-auto bg-white rounded-xl border border-dashed border-sky-300 shadow-xs px-6 py-5'
              : ''
          }`}
        />
      </div>

      {/* ── STATUS & HELPER FOOTER (Full Editors Only) ── */}
      {!inline && !compact && editorStats && (
        <div className="px-3.5 py-1.5 border-t border-slate-100 bg-slate-50/60 rounded-b-xl flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles size={11} className="text-sky-500 shrink-0" />
            <span>Clique em qualquer figura para ajustar enquadramento, tamanho e alinhamento • Aceita Ctrl+V de imagens</span>
          </span>
          <div className="flex items-center gap-3 font-semibold text-slate-500 shrink-0 ml-auto">
            {editorStats.images > 0 && (
              <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/70">
                {editorStats.images} {editorStats.images === 1 ? 'figura' : 'figuras'}
              </span>
            )}
            <span>{editorStats.words} {editorStats.words === 1 ? 'palavra' : 'palavras'}</span>
            <span>{editorStats.chars} caract.</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RichTextToolbarEditor

