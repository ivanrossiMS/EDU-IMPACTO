'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Unlink,
  Palette,
  Highlighter,
  Undo2,
  Redo2,
  Eraser,
  Type,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  X,
  ExternalLink,
} from 'lucide-react'

// ============================================================================
// CONSTANTS & PALETTES
// ============================================================================

const TEXT_COLORS = [
  { name: 'Padrão', color: '#1e293b' },
  { name: 'Azul', color: '#2563eb' },
  { name: 'Índigo', color: '#4f46e5' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Vermelho', color: '#dc2626' },
  { name: 'Laranja', color: '#ea580c' },
  { name: 'Roxo', color: '#9333ea' },
  { name: 'Cinza', color: '#64748b' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Sem grifo', color: 'transparent', border: '#cbd5e1' },
  { name: 'Amarelo', color: '#fef08a', border: '#facc15' },
  { name: 'Verde', color: '#bbf7d0', border: '#4ade80' },
  { name: 'Azul', color: '#bae6fd', border: '#38bdf8' },
  { name: 'Rosa', color: '#fecdd3', border: '#fb7185' },
  { name: 'Laranja', color: '#fed7aa', border: '#fb923c' },
  { name: 'Roxo', color: '#e9d5ff', border: '#c084fc' },
]

export interface FormRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number | string
  compact?: boolean
  primaryColor?: string
  onImagePaste?: (file: File) => void
  className?: string
  style?: React.CSSProperties
  id?: string
  ariaLabel?: string
}

// ============================================================================
// UTILITY: Normalizes raw text (converts plain text with line breaks to HTML)
// ============================================================================
export function normalizeValueToHtml(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // If it already contains HTML tags, return it
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw
  }
  // Otherwise convert \n to <br>
  return raw
    .split(/\r?\n/)
    .map(line => (line.trim() === '' ? '<br>' : line))
    .join('<br>')
}

// ============================================================================
// UTILITY: Strips HTML to plain text (for previews, lists, cards)
// ============================================================================
export function stripHtmlToPlainText(html: string): string {
  if (!html) return ''
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html
  }
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

// ============================================================================
// UTILITY: Sanitize HTML content for rendering
// ============================================================================
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  // Remove script and iframe tags
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, '')

  // Ensure all anchor tags open in new tab securely
  cleaned = cleaned.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
    let cleanAttrs = attrs
    if (!/target=/i.test(cleanAttrs)) {
      cleanAttrs += ' target="_blank"'
    } else {
      cleanAttrs = cleanAttrs.replace(/target=(['"]).*?\1/i, 'target="_blank"')
    }
    if (!/rel=/i.test(cleanAttrs)) {
      cleanAttrs += ' rel="noopener noreferrer"'
    }
    return `<a${cleanAttrs}>`
  })

  return cleaned
}

// ============================================================================
// COMPONENT: FormRichTextEditor
// ============================================================================
export function FormRichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui as instruções, orientações e informações detalhadas...',
  minHeight = 110,
  compact = false,
  primaryColor = '#4f46e5',
  onImagePaste,
  className = '',
  style,
  id,
  ariaLabel,
}: FormRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChangeRef = useRef(false)
  const savedRangeRef = useRef<Range | null>(null)

  const [isFocused, setIsFocused] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!value || value.trim() === '')

  // Active styles in current selection
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  })

  // Popovers state
  const [popoverOpen, setPopoverOpen] = useState<
    'color' | 'highlight' | 'link' | 'callout' | 'heading' | null
  >(null)

  // Link dialog state
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [hasExistingLink, setHasExistingLink] = useState(false)

  // Sync external value into editor DOM
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

    const text = (el.textContent || '').trim()
    const hasMedia = Boolean(el.querySelector('img, a, table, blockquote, div, ul, ol'))
    setIsEmpty(!text && !hasMedia)
  }, [value])

  // Save current selection range
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

  // Restore saved selection
  const restoreSelection = useCallback(() => {
    if (typeof window === 'undefined') return
    const sel = window.getSelection()
    if (sel && savedRangeRef.current && editorRef.current) {
      try {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      } catch {
        editorRef.current.focus()
      }
    } else if (editorRef.current) {
      editorRef.current.focus()
    }
  }, [])

  // Update active formats state
  const updateActiveFormats = useCallback(() => {
    if (typeof document === 'undefined') return
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      })
    } catch {
      // QueryCommandState may throw in some edge cases
    }
  }, [])

  // Emit change to parent
  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    isInternalChangeRef.current = true

    const rawHtml = el.innerHTML
    const textOnly = (el.textContent || '').trim()
    const hasMedia = Boolean(el.querySelector('img, a, table, blockquote, div, ul, ol'))

    const empty = !textOnly && !hasMedia
    setIsEmpty(empty)

    if (empty) {
      onChange('')
    } else {
      onChange(rawHtml)
    }
  }, [onChange])

  // Execute standard formatting command
  const execFormat = (e: React.MouseEvent, command: string, arg?: string) => {
    e.preventDefault()
    e.stopPropagation()
    restoreSelection()
    try {
      document.execCommand(command, false, arg)
    } catch {
      // Fallback
    }
    saveSelection()
    updateActiveFormats()
    emitChange()
  }

  // Clear all formatting on selection
  const handleClearFormat = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    restoreSelection()
    try {
      document.execCommand('removeFormat', false)
      document.execCommand('unlink', false)
      document.execCommand('formatBlock', false, '<p>')
    } catch {
      // Fallback
    }
    saveSelection()
    updateActiveFormats()
    emitChange()
    setPopoverOpen(null)
  }

  // Set font heading / block format
  const handleSetHeading = (tag: string) => {
    restoreSelection()
    try {
      document.execCommand('formatBlock', false, tag)
    } catch {
      // Fallback
    }
    saveSelection()
    updateActiveFormats()
    emitChange()
    setPopoverOpen(null)
  }

  // Apply text color
  const handleApplyColor = (color: string) => {
    restoreSelection()
    try {
      document.execCommand('foreColor', false, color)
    } catch {
      // Fallback
    }
    saveSelection()
    updateActiveFormats()
    emitChange()
    setPopoverOpen(null)
  }

  // Apply highlight background color
  const handleApplyHighlight = (color: string) => {
    restoreSelection()
    try {
      if (!document.execCommand('hiliteColor', false, color)) {
        document.execCommand('backColor', false, color)
      }
    } catch {
      // Fallback
    }
    saveSelection()
    updateActiveFormats()
    emitChange()
    setPopoverOpen(null)
  }

  // Open Link popover
  const handleOpenLinkPopover = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    saveSelection()

    // Inspect if current selection is inside an anchor
    let foundAnchor: HTMLAnchorElement | null = null
    const sel = window.getSelection()
    if (sel && sel.anchorNode) {
      let node: Node | null = sel.anchorNode
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'A') {
          foundAnchor = node as HTMLAnchorElement
          break
        }
        node = node.parentNode
      }
    }

    if (foundAnchor) {
      setLinkUrl(foundAnchor.getAttribute('href') || '')
      setLinkText(foundAnchor.textContent || '')
      setHasExistingLink(true)
    } else {
      const selectedStr = sel?.toString() || ''
      setLinkUrl('')
      setLinkText(selectedStr)
      setHasExistingLink(false)
    }

    setPopoverOpen(prev => (prev === 'link' ? null : 'link'))
  }

  // Insert or update link
  const handleSaveLink = () => {
    if (!linkUrl.trim()) {
      if (hasExistingLink) {
        restoreSelection()
        document.execCommand('unlink', false)
        emitChange()
      }
      setPopoverOpen(null)
      return
    }

    restoreSelection()
    const targetUrl = /^https?:\/\//i.test(linkUrl.trim())
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`

    const textToInsert = linkText.trim() || targetUrl

    const linkHtml = `<a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="color: ${primaryColor}; text-decoration: underline; font-weight: 600;">${textToInsert}</a>`

    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, linkHtml)
      } else if (editorRef.current) {
        editorRef.current.insertAdjacentHTML('beforeend', linkHtml)
      }
    } catch {
      document.execCommand('createLink', false, targetUrl)
    }

    saveSelection()
    emitChange()
    setPopoverOpen(null)
    setLinkUrl('')
    setLinkText('')
  }

  // Remove existing link
  const handleRemoveLink = () => {
    restoreSelection()
    document.execCommand('unlink', false)
    saveSelection()
    emitChange()
    setPopoverOpen(null)
    setLinkUrl('')
    setLinkText('')
  }

  // Insert Callout Box
  const handleInsertCallout = (type: 'info' | 'warning' | 'success') => {
    restoreSelection()

    let calloutHtml = ''
    if (type === 'info') {
      calloutHtml = `
        <div style="margin: 10px 0; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; color: #1e40af; font-size: 13.5px; line-height: 1.5;">
          <strong>ℹ️ Informação Importante:</strong> Digite aqui orientações detalhadas, avisos ou observações para o colaborador...
        </div>
        <p><br></p>
      `
    } else if (type === 'warning') {
      calloutHtml = `
        <div style="margin: 10px 0; padding: 12px 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; color: #92400e; font-size: 13.5px; line-height: 1.5;">
          <strong>⚠️ Atenção & Regras:</strong> Digite aqui regras obrigatórias, prazos ou condições de preenchimento...
        </div>
        <p><br></p>
      `
    } else {
      calloutHtml = `
        <div style="margin: 10px 0; padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; color: #065f46; font-size: 13.5px; line-height: 1.5;">
          <strong>✅ Dica de Preenchimento:</strong> Digite aqui orientações que facilitem a resposta do formulário...
        </div>
        <p><br></p>
      `
    }

    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, calloutHtml)
      } else if (editorRef.current) {
        editorRef.current.insertAdjacentHTML('beforeend', calloutHtml)
      }
    } catch {
      // Fallback
    }

    saveSelection()
    emitChange()
    setPopoverOpen(null)
  }

  // Handle Paste
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []) as DataTransferItem[]
    const imgItem = items.find(i => i.type.startsWith('image/'))

    // If an image is pasted, delegate to onImagePaste handler if available
    if (imgItem && onImagePaste) {
      const file = imgItem.getAsFile()
      if (file) {
        e.preventDefault()
        onImagePaste(file)
        return
      }
    }

    // Otherwise clean up pasted text: allow standard rich text or clean line breaks
    // We let the browser paste, then emitChange
    setTimeout(() => {
      emitChange()
    }, 10)
  }

  // Handle Keyboard Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        document.execCommand('bold', false)
        updateActiveFormats()
        emitChange()
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        document.execCommand('italic', false)
        updateActiveFormats()
        emitChange()
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault()
        document.execCommand('underline', false)
        updateActiveFormats()
        emitChange()
      } else if (e.key === 'z' || e.key === 'Z') {
        // Let browser handle undo/redo natively, but update formats
        setTimeout(() => {
          updateActiveFormats()
          emitChange()
        }, 10)
      }
    }
  }

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.form-editor-popover-container')) {
        setPopoverOpen(null)
      }
    }
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [popoverOpen])

  // Helper for button classes
  const getBtnStyle = (isActive: boolean) => ({
    display: 'inline-flex' as const,
    alignItems: 'center',
    justifyContent: 'center',
    width: compact ? 28 : 30,
    height: compact ? 28 : 30,
    borderRadius: 6,
    border: 'none',
    background: isActive ? '#e0e7ff' : 'transparent',
    color: isActive ? primaryColor : '#475569',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        border: `1px solid ${isFocused ? primaryColor : '#cbd5e1'}`,
        boxShadow: isFocused ? `0 0 0 3px ${primaryColor}20` : 'none',
        background: '#ffffff',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative',
        ...style,
      }}
      className={`form-rich-editor ${className || ''}`}
    >
      {/* =================================================================== */}
      {/* TOOLBAR */}
      {/* =================================================================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          padding: compact ? '4px 6px' : '6px 8px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          borderRadius: '11px 11px 0 0',
          userSelect: 'none',
          position: 'relative',
        }}
        className="form-editor-popover-container"
      >
        {/* Undo / Redo */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'undo')}
          title="Desfazer (Ctrl+Z)"
          style={getBtnStyle(false)}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'redo')}
          title="Refazer (Ctrl+Y)"
          style={getBtnStyle(false)}
        >
          <Redo2 size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Text Style: Bold, Italic, Underline, Strikethrough */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'bold')}
          title="Negrito (Ctrl+B)"
          style={getBtnStyle(activeFormats.bold)}
        >
          <Bold size={14} strokeWidth={2.6} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'italic')}
          title="Itálico (Ctrl+I)"
          style={getBtnStyle(activeFormats.italic)}
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'underline')}
          title="Sublinhado (Ctrl+U)"
          style={getBtnStyle(activeFormats.underline)}
        >
          <Underline size={14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'strikeThrough')}
          title="Tachado / Riscado"
          style={getBtnStyle(activeFormats.strikeThrough)}
        >
          <Strikethrough size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Heading / Font size dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setPopoverOpen(prev => (prev === 'heading' ? null : 'heading'))
            }}
            title="Tamanho do Texto / Título"
            style={{
              ...getBtnStyle(popoverOpen === 'heading'),
              width: 'auto',
              padding: '0 6px',
              gap: 3,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Type size={13} />
            <span style={{ fontSize: 11 }}>Estilo</span>
            <ChevronDown size={11} />
          </button>

          {popoverOpen === 'heading' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                padding: 4,
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 150,
              }}
            >
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleSetHeading('<p>')
                }}
                style={{
                  padding: '7px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 13,
                  color: '#334155',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Parágrafo Normal
              </button>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleSetHeading('<h3>')
                }}
                style={{
                  padding: '7px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#0f172a',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Título Destaque
              </button>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleSetHeading('<h4>')
                }}
                style={{
                  padding: '7px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#475569',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Subtítulo Médio
              </button>
            </div>
          )}
        </div>

        {/* Text Color Picker */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setPopoverOpen(prev => (prev === 'color' ? null : 'color'))
            }}
            title="Cor do Texto"
            style={getBtnStyle(popoverOpen === 'color')}
          >
            <Palette size={14} />
          </button>

          {popoverOpen === 'color' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                padding: 8,
                zIndex: 60,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                width: 130,
              }}
            >
              {TEXT_COLORS.map(c => (
                <button
                  key={c.color}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    handleApplyColor(c.color)
                  }}
                  title={c.name}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c.color,
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 1px #cbd5e1',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlighter Picker */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setPopoverOpen(prev => (prev === 'highlight' ? null : 'highlight'))
            }}
            title="Realce / Marca-texto"
            style={getBtnStyle(popoverOpen === 'highlight')}
          >
            <Highlighter size={14} />
          </button>

          {popoverOpen === 'highlight' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                padding: 8,
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>
                Cor do Grifo
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.color}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      handleApplyHighlight(c.color)
                    }}
                    title={c.name}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: c.color,
                      border: `1.5px solid ${c.border}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#475569',
                    }}
                  >
                    {c.color === 'transparent' ? '✕' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Alignment */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'justifyLeft')}
          title="Alinhar à Esquerda"
          style={getBtnStyle(activeFormats.justifyLeft)}
        >
          <AlignLeft size={14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'justifyCenter')}
          title="Centralizar"
          style={getBtnStyle(activeFormats.justifyCenter)}
        >
          <AlignCenter size={14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'justifyRight')}
          title="Alinhar à Direita"
          style={getBtnStyle(activeFormats.justifyRight)}
        >
          <AlignRight size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Lists */}
        <button
          type="button"
          onMouseDown={e => execFormat(e, 'insertUnorderedList')}
          title="Lista com Marcadores"
          style={getBtnStyle(activeFormats.insertUnorderedList)}
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onMouseDown={e => execFormat(e, 'insertOrderedList')}
          title="Lista Numerada"
          style={getBtnStyle(activeFormats.insertOrderedList)}
        >
          <ListOrdered size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Link Popover Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseDown={handleOpenLinkPopover}
            title="Inserir ou Editar Link Clicável"
            style={getBtnStyle(popoverOpen === 'link')}
          >
            <Link2 size={14} />
          </button>

          {popoverOpen === 'link' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                boxShadow: '0 12px 28px -5px rgba(0,0,0,0.18)',
                padding: 12,
                zIndex: 70,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                width: 280,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  {hasExistingLink ? 'Editar Link' : 'Inserir Link Clicável'}
                </div>
                <button
                  type="button"
                  onClick={() => setPopoverOpen(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}
                >
                  URL do Link (Endereço web)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com.br"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}
                >
                  Texto Exibido
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder="Ex: Clique aqui para ver"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                {hasExistingLink && (
                  <button
                    type="button"
                    onClick={handleRemoveLink}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid #fecdd3',
                      background: '#fff1f2',
                      color: '#e11d48',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Remover
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveLink}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: primaryColor,
                    color: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Inserir Link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Callout Box Preset Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              saveSelection()
              setPopoverOpen(prev => (prev === 'callout' ? null : 'callout'))
            }}
            title="Inserir Caixa de Aviso / Instruções em Destaque"
            style={getBtnStyle(popoverOpen === 'callout')}
          >
            <Sparkles size={14} />
          </button>

          {popoverOpen === 'callout' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                padding: 6,
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 180,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', padding: '2px 6px' }}>
                Caixas em Destaque
              </div>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleInsertCallout('info')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  border: 'none',
                  background: '#eff6ff',
                  borderRadius: 6,
                  color: '#1e40af',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Info size={14} />
                <span>ℹ️ Informação / Aviso</span>
              </button>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleInsertCallout('warning')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  border: 'none',
                  background: '#fffbeb',
                  borderRadius: 6,
                  color: '#92400e',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <AlertTriangle size={14} />
                <span>⚠️ Atenção & Regras</span>
              </button>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  handleInsertCallout('success')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  border: 'none',
                  background: '#f0fdf4',
                  borderRadius: 6,
                  color: '#065f46',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <CheckCircle2 size={14} />
                <span>✅ Dica de Resposta</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={handleClearFormat}
          title="Limpar Formatação do Texto Selecionado"
          style={getBtnStyle(false)}
        >
          <Eraser size={14} />
        </button>
      </div>

      {/* =================================================================== */}
      {/* EDITABLE SURFACE */}
      {/* =================================================================== */}
      <div style={{ position: 'relative', flex: 1 }}>
        {/* Placeholder overlay when empty and not actively typing */}
        {isEmpty && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 14,
              right: 14,
              color: '#94a3b8',
              fontSize: 14,
              pointerEvents: 'none',
              lineHeight: 1.6,
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          id={id}
          aria-label={ariaLabel || placeholder}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => {
            setIsFocused(true)
            saveSelection()
            updateActiveFormats()
          }}
          onBlur={() => {
            setIsFocused(false)
            saveSelection()
            emitChange()
          }}
          onInput={() => {
            saveSelection()
            updateActiveFormats()
            emitChange()
          }}
          onKeyUp={() => {
            saveSelection()
            updateActiveFormats()
          }}
          onMouseUp={() => {
            saveSelection()
            updateActiveFormats()
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          style={{
            minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.65,
            color: '#1e293b',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
            wordBreak: 'break-word',
            borderRadius: '0 0 11px 11px',
          }}
          className="form-rich-editor-content"
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .form-rich-editor-content p {
          margin: 0 0 6px 0;
        }
        .form-rich-editor-content p:last-child {
          margin-bottom: 0;
        }
        .form-rich-editor-content ul {
          margin: 6px 0;
          padding-left: 22px;
          list-style-type: disc;
        }
        .form-rich-editor-content ol {
          margin: 6px 0;
          padding-left: 22px;
          list-style-type: decimal;
        }
        .form-rich-editor-content li {
          margin-bottom: 3px;
        }
        .form-rich-editor-content a {
          color: ${primaryColor};
          text-decoration: underline;
          cursor: pointer;
        }
        .form-rich-editor-content h3 {
          margin: 10px 0 6px 0;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }
        .form-rich-editor-content h4 {
          margin: 8px 0 4px 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #334155;
        }
      `,
        }}
      />
    </div>
  )
}

// ============================================================================
// COMPONENT: FormRichTextRenderer
// Safely and beautifully renders rich text or plain text
// ============================================================================
export interface FormRichTextRendererProps {
  content: string | undefined | null
  style?: React.CSSProperties
  className?: string
  id?: string
  primaryColor?: string
}

export function FormRichTextRenderer({
  content,
  style,
  className = '',
  id,
  primaryColor = '#4f46e5',
}: FormRichTextRendererProps) {
  if (!content || !content.trim()) return null

  const isHtml = /<[a-z][\s\S]*>/i.test(content)

  if (!isHtml) {
    return (
      <div
        id={id}
        style={{
          whiteSpace: 'pre-line',
          wordBreak: 'break-word',
          ...style,
        }}
        className={`form-rich-text-renderer ${className}`}
      >
        {content}
      </div>
    )
  }

  const clean = sanitizeHtml(content)

  return (
    <div
      id={id}
      style={{
        wordBreak: 'break-word',
        ...style,
      }}
      className={`form-rich-text-renderer ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
