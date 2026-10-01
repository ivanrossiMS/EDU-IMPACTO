'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Bold, Italic, Underline, Subscript, Superscript,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Sparkles
} from 'lucide-react'

interface RichTextToolbarEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number | string
  compact?: boolean
  className?: string
  disabled?: boolean
}

/**
 * Sanitizes and cleans pasted HTML from Word, Google Docs, PDFs, and web browsers
 * while PRESERVING original rich text formatting: bold, italic, underline, strike,
 * superscript, subscript, colors, font styles, lists (ul/ol/li), tables, paragraphs, and spans.
 */
function sanitizeAndPreservePastedHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return ''

  try {
    let html = rawHtml

    // 1. If Microsoft Office / Google Docs fragment comments exist, extract fragment
    const fragmentMatch = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i)
    if (fragmentMatch && fragmentMatch[1]) {
      html = fragmentMatch[1]
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // 2. Remove executable or harmful tags: script, link, meta, xml, object, embed, iframe
    const forbidden = doc.querySelectorAll('script, link, meta, xml, object, embed, applet, iframe, noscript')
    forbidden.forEach(el => el.remove())

    // 3. Remove inline style tags that pollute global CSS
    const styleTags = doc.querySelectorAll('style')
    styleTags.forEach(el => el.remove())

    // 4. Clean Microsoft Word specific namespace tags (e.g. <o:p>, <w:sdt>)
    const allNodes = doc.querySelectorAll('*')
    allNodes.forEach(el => {
      const tag = el.tagName.toLowerCase()
      if (tag.includes(':')) {
        el.replaceWith(...Array.from(el.childNodes))
        return
      }

      // Remove security-sensitive attributes like on* (onload, onclick, etc.)
      const attrs = Array.from(el.attributes)
      for (const attr of attrs) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
        }
        // Clean out mso- specific styles from style attribute while retaining text styles
        if (name === 'style') {
          const rules = attr.value.split(';').map(r => r.trim()).filter(Boolean)
          const validRules = rules.filter(r => !r.toLowerCase().startsWith('mso-'))
          if (validRules.length > 0) {
            el.setAttribute('style', validRules.join('; '))
          } else {
            el.removeAttribute('style')
          }
        }
      }
    })

    return doc.body.innerHTML || ''
  } catch (err) {
    console.warn('Failed to parse pasted HTML, using raw fallback:', err)
    return rawHtml
  }
}

function isHtmlEmpty(str: string | undefined | null): boolean {
  if (!str) return true
  const stripped = str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return stripped === '' && !str.includes('<img')
}

export function RichTextToolbarEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight = 120,
  compact = false,
  className = '',
  disabled = false
}: RichTextToolbarEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const isInternalChangeRef = useRef(false)

  // Sync value to DOM only when changed externally (avoids resetting cursor during typing)
  useEffect(() => {
    if (!editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    if (value !== currentHtml && !isInternalChangeRef.current) {
      editorRef.current.innerHTML = value || ''
    }
    isInternalChangeRef.current = false
  }, [value])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    isInternalChangeRef.current = true
    const newHtml = editorRef.current.innerHTML
    onChange(newHtml)
  }, [onChange])

  const execCmd = (cmd: string, arg?: string) => {
    if (disabled || !editorRef.current) return
    editorRef.current.focus()
    document.execCommand(cmd, false, arg)
    handleInput()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    const clipboardData = e.clipboardData
    const htmlData = clipboardData.getData('text/html')
    const textData = clipboardData.getData('text/plain')

    if (htmlData && htmlData.trim().length > 0) {
      // Pull and preserve all original formatting (bold, italic, tables, lists, colors, superscripts)
      const cleaned = sanitizeAndPreservePastedHtml(htmlData)
      document.execCommand('insertHTML', false, cleaned)
    } else if (textData) {
      // Plain text: preserve line breaks as <br>
      const formatted = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n|\r|\n/g, '<br>')
      document.execCommand('insertHTML', false, formatted)
    }

    handleInput()
  }

  const handleClearFormat = () => {
    if (disabled || !editorRef.current) return
    editorRef.current.focus()
    document.execCommand('removeFormat', false)
    handleInput()
  }

  const isEmpty = isHtmlEmpty(value)

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden flex flex-col bg-white ${
        isFocused
          ? 'border-sky-500 ring-2 ring-sky-100 shadow-xs'
          : 'border-slate-200 hover:border-slate-300'
      } ${className}`}
    >
      {/* ── FORMATTING TOOLBAR ── */}
      <div
        className={`flex items-center flex-wrap gap-1 px-3 py-1.5 bg-slate-50/90 border-b border-slate-200/80 select-none ${
          compact ? 'py-1 px-2' : ''
        }`}
      >
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('bold') }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          title="Negrito (Ctrl+B)"
        >
          <Bold size={compact ? 13 : 15} />
        </button>

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('italic') }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          title="Itálico (Ctrl+I)"
        >
          <Italic size={compact ? 13 : 15} />
        </button>

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('underline') }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          title="Sublinhado (Ctrl+U)"
        >
          <Underline size={compact ? 13 : 15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('superscript') }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          title="Sobrescrito / Expoente (x²)"
        >
          <Superscript size={compact ? 13 : 15} />
        </button>

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('subscript') }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          title="Subscrito / Índice (H₂O)"
        >
          <Subscript size={compact ? 13 : 15} />
        </button>

        {!compact && (
          <>
            <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList') }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title="Lista com marcadores"
            >
              <List size={15} />
            </button>

            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList') }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title="Lista numerada"
            >
              <ListOrdered size={15} />
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft') }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title="Alinhar à esquerda"
            >
              <AlignLeft size={15} />
            </button>

            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter') }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title="Centralizar"
            >
              <AlignCenter size={15} />
            </button>

            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); execCmd('justifyRight') }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title="Alinhar à direita"
            >
              <AlignRight size={15} />
            </button>
          </>
        )}

        <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleClearFormat() }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors ml-auto"
          title="Limpar formatação"
        >
          <RemoveFormatting size={compact ? 13 : 15} />
        </button>
      </div>

      {/* ── SCOPED CONTENT STYLES ── */}
      <style>{`
        .rich-text-editor-content ul {
          list-style-type: disc !important;
          padding-left: 1.25rem !important;
          margin: 0.25rem 0 !important;
        }
        .rich-text-editor-content ol {
          list-style-type: decimal !important;
          padding-left: 1.25rem !important;
          margin: 0.25rem 0 !important;
        }
        .rich-text-editor-content li {
          margin-bottom: 0.15rem !important;
        }
        .rich-text-editor-content p {
          margin-top: 0;
          margin-bottom: 0.25rem;
        }
        .rich-text-editor-content p:last-child {
          margin-bottom: 0;
        }
        .rich-text-editor-content sub, .rich-text-editor-content sup {
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
        .rich-text-editor-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5rem 0;
        }
        .rich-text-editor-content th, .rich-text-editor-content td {
          border: 1px solid #cbd5e1;
          padding: 4px 8px;
        }
      `}</style>

      {/* ── CONTENTEDITABLE CANVAS ── */}
      <div className="relative flex-1">
        {isEmpty && !isFocused && (
          <div className={`absolute ${compact ? 'left-3 top-2 text-[12px]' : 'left-3.5 top-2.5 text-xs'} text-slate-400 pointer-events-none select-none font-sans`}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            handleInput()
          }}
          style={{ minHeight }}
          className={`rich-text-editor-content w-full p-3 text-slate-800 outline-none leading-relaxed font-sans overflow-y-auto ${
            compact ? 'py-1.5 px-3 text-xs' : 'text-sm'
          }`}
        />
      </div>
    </div>
  )
}
