import React, { useMemo, useRef, useEffect, useState } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { Bold, Italic, Underline, Subscript, Superscript, RemoveFormatting, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { cleanEnunciadoHtml } from '@/components/simulados/PaginationEngine'

interface HtmlContentProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string
  onBlurHtml?: (html: string) => void
  onBackspaceAtStart?: () => void
  editable?: boolean
  onPasteImage?: (fileOrBlob: File | Blob | null, srcUrl?: string) => void
}

export function unpackMasksAndFormulas(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // 1. Restaurar fórmulas do KaTeX
    const formulaSpans = doc.querySelectorAll('.ql-formula')
    formulaSpans.forEach(span => {
      const formula = span.getAttribute('data-value')
      if (formula) {
        span.innerHTML = formula 
        span.removeAttribute('contenteditable')
      }
    })

    // 2. Restaurar máscaras estilizadas de volta para texto puro original
    const maskSpans = doc.querySelectorAll('.tag-mask')
    maskSpans.forEach(span => {
      const mask = span.getAttribute('data-mask') || span.textContent || ''
      const match = mask.match(/\[(IMAGEM\s*\d+|LINHAS_PAUTADAS\s*:\s*\d+|ESPACO_BRANCO\s*:\s*\d+)\]/i)
      const cleanTag = match ? match[0] : mask.trim()
      const textNode = doc.createTextNode(cleanTag)
      span.parentNode?.replaceChild(textNode, span)
    })

    return doc.body.innerHTML
  } catch (err) {
    return html
  }
}

export function HtmlContent({ html, onBlurHtml, onBackspaceAtStart, editable, onPasteImage, ...props }: HtmlContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const toolbarRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (props.onPaste) {
      props.onPaste(e)
      if (e.defaultPrevented) return
    }

    if (!editable || !onPasteImage) return

    // 1. Check if clipboard contains an image item
    const items = e.clipboardData?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            onPasteImage(file)
            return
          }
        }
      }
    }

    // 2. Check if clipboard files contain an image
    const files = e.clipboardData?.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          e.preventDefault()
          onPasteImage(files[i])
          return
        }
      }
    }

    // 3. Check if HTML data in clipboard has an <img> tag
    const htmlData = e.clipboardData?.getData('text/html')
    if (htmlData && /<img[^>]+src=["']([^"']+)["']/i.test(htmlData)) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
      const src = match?.[1]
      if (src) {
        e.preventDefault()
        if (src.startsWith('data:image/')) {
          try {
            const byteString = atob(src.split(',')[1])
            const mimeString = src.split(',')[0].split(':')[1].split(';')[0]
            const ab = new ArrayBuffer(byteString.length)
            const ia = new Uint8Array(ab)
            for (let j = 0; j < byteString.length; j++) {
              ia[j] = byteString.charCodeAt(j)
            }
            const blob = new Blob([ab], { type: mimeString })
            onPasteImage(blob)
            return
          } catch (err) {
            console.error('Erro ao converter imagem em base64 colada:', err)
          }
        }
        onPasteImage(null, src)
        return
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (props.onKeyDown) props.onKeyDown(e)
    if (e.key === 'Backspace' && onBackspaceAtStart) {
      const sel = window.getSelection()
      if (sel && sel.isCollapsed && sel.anchorNode && containerRef.current) {
        try {
          const range = sel.getRangeAt(0)
          const preRange = document.createRange()
          preRange.selectNodeContents(containerRef.current)
          preRange.setEnd(range.startContainer, range.startOffset)
          const textBefore = preRange.toString()
          if (textBefore.length === 0) {
            onBackspaceAtStart()
          }
        } catch(err) {}
      }
    }
  }

  const renderedHtml = useMemo(() => {
    if (!html) return ''
    const cleanedHtml = cleanEnunciadoHtml(html)
    if (typeof window === 'undefined') return cleanedHtml

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(cleanedHtml, 'text/html')
      
      // 1. Render all .ql-formula elements
      const formulaSpans = doc.querySelectorAll('.ql-formula')
      formulaSpans.forEach(span => {
        const formula = span.getAttribute('data-value') || span.textContent
        if (formula) {
          try {
            const rendered = katex.renderToString(formula, { throwOnError: false })
            span.innerHTML = rendered
            span.setAttribute('contenteditable', 'false')
            if (!span.hasAttribute('data-value')) {
              span.setAttribute('data-value', formula)
            }
          } catch (e) {
            console.error('KaTeX render error:', e)
          }
        }
      })

      // 2. Render any inline/display LaTeX patterns: \(...\), \[...\], $$...$$ in text nodes
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
      const textNodes: Text[] = []
      let currentNode = walker.nextNode()
      while (currentNode) {
        // Skip text nodes that are already inside a .ql-formula span or katex element
        const parent = (currentNode as Text).parentElement
        if (!parent || (!parent.closest('.ql-formula') && !parent.closest('.katex'))) {
          textNodes.push(currentNode as Text)
        }
        currentNode = walker.nextNode()
      }

      for (const node of textNodes) {
        const val = node.nodeValue || ''
        if (/\\[\(\[]|\$\$|\$[^\$]+\$/.test(val)) {
          const replaced = val.replace(/\\(?:\[([\s\S]*?)\\\]|\(([\s\S]*?)\\\))|\$\$([\s\S]*?)\$\$|\$([^\$\n]+)\$/g, (match, d1, i1, d2, i2) => {
            const formula = (d1 || i1 || d2 || i2 || '').trim()
            const isDisplay = Boolean(d1 || d2)
            if (!formula) return match
            try {
              return `<span class="ql-formula" data-value="${formula.replace(/"/g, '&quot;')}" contenteditable="false">${katex.renderToString(formula, { displayMode: isDisplay, throwOnError: false })}</span>`
            } catch {
              return match
            }
          })
          if (replaced !== val) {
            const temp = doc.createElement('span')
            temp.innerHTML = replaced
            node.parentNode?.replaceChild(temp, node)
          }
        }
      }

      // 3. Render masks: [IMAGEM N], [LINHAS_PAUTADAS:N], [ESPACO_BRANCO:N] as bold colorful badges
      const maskWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
      const maskTextNodes: Text[] = []
      let mNode = maskWalker.nextNode()
      while (mNode) {
        const parent = (mNode as Text).parentElement
        if (!parent || (!parent.closest('.ql-formula') && !parent.closest('.katex') && !parent.closest('.tag-mask'))) {
          maskTextNodes.push(mNode as Text)
        }
        mNode = maskWalker.nextNode()
      }

      for (const node of maskTextNodes) {
        const val = node.nodeValue || ''
        if (/\[(IMAGEM\s*\d+|LINHAS_PAUTADAS\s*:\s*\d+|ESPACO_BRANCO\s*:\s*\d+)\]/i.test(val)) {
          const replaced = val.replace(/\[(IMAGEM\s*\d+|LINHAS_PAUTADAS\s*:\s*\d+|ESPACO_BRANCO\s*:\s*\d+)\]/gi, (match) => {
            const upper = match.toUpperCase()
            if (upper.includes('IMAGEM')) {
              return `<span class="tag-mask tag-mask-imagem" data-mask="${match}" contenteditable="false"><span class="tag-mask-icon">🖼️</span><strong>${match}</strong></span>`
            } else if (upper.includes('LINHAS_PAUTADAS')) {
              return `<span class="tag-mask tag-mask-linhas" data-mask="${match}" contenteditable="false"><span class="tag-mask-icon">📝</span><strong>${match}</strong></span>`
            } else if (upper.includes('ESPACO_BRANCO')) {
              return `<span class="tag-mask tag-mask-espaco" data-mask="${match}" contenteditable="false"><span class="tag-mask-icon">📄</span><strong>${match}</strong></span>`
            }
            return match
          })
          if (replaced !== val) {
            const temp = doc.createElement('span')
            temp.innerHTML = replaced
            node.parentNode?.replaceChild(temp, node)
          }
        }
      }

      return doc.body.innerHTML
    } catch (e) {
      console.error('HtmlContent parsing error:', e)
      return cleanedHtml
    }
  }, [html])

  useEffect(() => {
    if (containerRef.current && document.activeElement !== containerRef.current) {
      if (containerRef.current.innerHTML !== renderedHtml) {
        containerRef.current.innerHTML = renderedHtml
      }
    }
  }, [renderedHtml])

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!onBlurHtml) return
    
    try {
      const currentHtml = e.currentTarget.innerHTML
      const unpacked = unpackMasksAndFormulas(currentHtml)
      onBlurHtml(cleanEnunciadoHtml(unpacked))
    } catch (err) {
      onBlurHtml(cleanEnunciadoHtml(e.currentTarget.innerHTML))
    }
    
    setTimeout(() => {
      if (toolbarRef.current) toolbarRef.current.style.display = 'none'
    }, 100)
  }

  const checkSelection = () => {
    if (!editable) return
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !containerRef.current) {
        if (toolbarRef.current) toolbarRef.current.style.display = 'none'
        return
      }

      if (!containerRef.current.contains(sel.anchorNode)) {
        if (toolbarRef.current) toolbarRef.current.style.display = 'none'
        return
      }

      if (sel.toString().trim().length === 0) {
        if (toolbarRef.current) toolbarRef.current.style.display = 'none'
        return
      }

      const range = sel.getRangeAt(0)
      savedRangeRef.current = range.cloneRange()
      const rect = range.getBoundingClientRect()
      
      if (toolbarRef.current) {
        toolbarRef.current.style.display = 'flex'
        const safeTop = Math.max(12, rect.top - 44)
        const safeLeft = Math.min(Math.max(180, rect.left + (rect.width / 2)), window.innerWidth - 180)
        toolbarRef.current.style.top = `${safeTop}px`
        toolbarRef.current.style.left = `${safeLeft}px`
        
        const isBold = document.queryCommandState('bold')
        const isItalic = document.queryCommandState('italic')
        const isUnderline = document.queryCommandState('underline')
        const isSubscript = document.queryCommandState('subscript')
        const isSuperscript = document.queryCommandState('superscript')
        
        const btnBold = toolbarRef.current.querySelector('#btn-bold') as HTMLButtonElement
        if (btnBold) btnBold.style.background = isBold ? '#3b82f6' : 'transparent'

        const btnItalic = toolbarRef.current.querySelector('#btn-italic') as HTMLButtonElement
        if (btnItalic) btnItalic.style.background = isItalic ? '#3b82f6' : 'transparent'

        const btnUnderline = toolbarRef.current.querySelector('#btn-underline') as HTMLButtonElement
        if (btnUnderline) btnUnderline.style.background = isUnderline ? '#3b82f6' : 'transparent'

        const btnSubscript = toolbarRef.current.querySelector('#btn-subscript') as HTMLButtonElement
        if (btnSubscript) btnSubscript.style.background = isSubscript ? '#3b82f6' : 'transparent'

        const btnSuperscript = toolbarRef.current.querySelector('#btn-superscript') as HTMLButtonElement
        if (btnSuperscript) btnSuperscript.style.background = isSuperscript ? '#3b82f6' : 'transparent'
      }
    }, 10)
  }

  const formatText = (e: React.MouseEvent, command: string) => {
    e.preventDefault() 
    e.stopPropagation()

    // Restore selection if it was lost by clicking the button
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }

    // Apply the formatting
    document.execCommand(command, false)
    
    // Update button visual state manually
    if (toolbarRef.current) {
      const state = document.queryCommandState(command)
      const btn = toolbarRef.current.querySelector(`#btn-${command}`) as HTMLButtonElement
      if (btn) btn.style.background = state ? '#3b82f6' : 'transparent'
    }

    // Force save immediately so changes aren't lost if blur doesn't fire naturally
    if (containerRef.current && onBlurHtml) {
      try {
        const currentHtml = containerRef.current.innerHTML
        const unpacked = unpackMasksAndFormulas(currentHtml)
        onBlurHtml(unpacked)
      } catch (err) {
        onBlurHtml(containerRef.current.innerHTML)
      }
    }
    
    if (toolbarRef.current) toolbarRef.current.style.display = 'none'
  }

  const removeFormatting = (e: React.MouseEvent) => {
    e.preventDefault() 
    e.stopPropagation()

    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }

    document.execCommand('removeFormat', false)

    try {
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        if (!range.collapsed) {
          const container = document.createElement('div')
          container.appendChild(range.extractContents())
          const plainText = container.textContent || ''
          const textNode = document.createTextNode(plainText)
          range.insertNode(textNode)

          const newRange = document.createRange()
          newRange.selectNodeContents(textNode)
          sel.removeAllRanges()
          sel.addRange(newRange)
          savedRangeRef.current = newRange.cloneRange()
        }
      }
    } catch (err) {
      console.error('Error removing format:', err)
    }

    if (containerRef.current && onBlurHtml) {
      try {
        const currentHtml = containerRef.current.innerHTML
        const unpacked = unpackMasksAndFormulas(currentHtml)
        onBlurHtml(unpacked)
      } catch (err) {
        onBlurHtml(containerRef.current.innerHTML)
      }
    }
    
    if (toolbarRef.current) toolbarRef.current.style.display = 'none'
  }

  return (
    <>
      <style>{`
        .html-content p {
          margin-top: 0;
          margin-bottom: 0.35em;
        }
        .html-content p:first-child {
          margin-top: 0 !important;
        }
        .html-content p:last-child {
          margin-bottom: 0 !important;
        }
        .html-content div:first-child {
          margin-top: 0 !important;
        }
        .html-content ul {
          list-style-type: disc !important;
          padding-left: 1.25rem !important;
          margin: 0.3rem 0 !important;
        }
        .html-content ol {
          list-style-type: decimal !important;
          padding-left: 1.25rem !important;
          margin: 0.3rem 0 !important;
        }
        .html-content li {
          margin-bottom: 0.15rem !important;
        }
        .html-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5rem 0;
          font-size: 0.92em;
        }
        .html-content th, .html-content td {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
        }
        .html-content th {
          background-color: #f8fafc;
          font-weight: 700;
        }
        .html-content blockquote {
          margin: 0.5rem 0;
          padding: 0.65rem 0.9rem;
          border-left: 3px solid #0284c7;
          background: #f8fafc;
          border-radius: 0 0.5rem 0.5rem 0;
          color: #334155;
        }
        .html-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          object-fit: contain;
        }
        .html-content img[data-align="center"] {
          display: block;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .html-content img[data-align="left"] {
          display: block;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        .html-content img[data-align="right"] {
          display: block;
          margin-left: auto !important;
          margin-right: 0 !important;
        }
        .html-content img[data-framed="true"] {
          border: 1px solid #cbd5e1 !important;
          padding: 6px !important;
          background: #ffffff !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06) !important;
        }
        .html-content sub, .html-content sup {
          font-size: 75%;
          line-height: 0;
          position: relative;
          vertical-align: baseline;
        }
        .html-content sub {
          bottom: -0.25em;
        }
        .html-content sup {
          top: -0.5em;
        }
        .html-content[contenteditable="true"]:hover {
          background-color: rgba(59, 130, 246, 0.015);
          border-radius: 3px;
        }
        .html-content[contenteditable="true"]:focus {
          outline: 1.5px dashed rgba(59, 130, 246, 0.5) !important;
          outline-offset: 2px;
          background-color: rgba(59, 130, 246, 0.03);
          border-radius: 3px;
        }

        /* Máscaras no texto: Negrito com cores elegantes e destaque */
        .tag-mask {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 800 !important;
          font-family: inherit;
          font-size: 0.88em;
          padding: 2px 8px;
          margin: 1px 3px;
          border-radius: 6px;
          line-height: 1.4;
          user-select: all;
          vertical-align: baseline;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          letter-spacing: 0.02em;
          cursor: default;
        }
        .tag-mask strong {
          font-weight: 800 !important;
        }
        .tag-mask-icon {
          font-size: 0.95em;
          line-height: 1;
        }
        .tag-mask-imagem {
          color: #1d4ed8 !important; /* Azul Forte */
          background: #eff6ff !important; /* Azul Suave */
          border: 1.5px solid #93c5fd !important; /* Borda Azul */
        }
        .tag-mask-linhas {
          color: #6d28d9 !important; /* Roxo Forte */
          background: #f5f3ff !important; /* Roxo Suave */
          border: 1.5px solid #c4b5fd !important; /* Borda Roxa */
        }
        .tag-mask-espaco {
          color: #047857 !important; /* Verde Forte */
          background: #ecfdf5 !important; /* Verde Suave */
          border: 1.5px solid #a7f3d0 !important; /* Borda Verde */
        }
        .dark .tag-mask-imagem {
          color: #60a5fa !important;
          background: rgba(37, 99, 235, 0.22) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
        }
        .dark .tag-mask-linhas {
          color: #c4b5fd !important;
          background: rgba(139, 92, 246, 0.22) !important;
          border-color: rgba(196, 181, 253, 0.45) !important;
        }
        .dark .tag-mask-espaco {
          color: #6ee7b7 !important;
          background: rgba(16, 185, 129, 0.22) !important;
          border-color: rgba(110, 231, 183, 0.45) !important;
        }
      `}</style>
      <div 
        ref={containerRef}
        {...props} 
        className={`html-content ${props.className || ''}`}
        style={{ display: 'flow-root', ...props.style }}
        contentEditable={editable}
        suppressContentEditableWarning={editable}
        onBlur={(e) => {
          if (props.onBlur) props.onBlur(e)
          if (editable) handleBlur(e)
        }}
        onMouseUp={(e) => {
          if (props.onMouseUp) props.onMouseUp(e)
          if (editable) checkSelection()
        }}
        onKeyUp={(e) => {
          if (props.onKeyUp) props.onKeyUp(e)
          if (editable) checkSelection()
        }}
        onKeyDown={editable ? handleKeyDown : props.onKeyDown}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: renderedHtml }} 
      />
      {editable && (
        <div 
          ref={toolbarRef}
          className="no-print"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            transform: 'translateX(-50%)', 
            zIndex: 999999,
            background: '#1e293b',
            padding: '4px',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
            display: 'none',
            alignItems: 'center',
            gap: '2px'
          }}
        >
          <button 
            id="btn-bold"
            onMouseDown={e => formatText(e, 'bold')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Negrito"
          >
            <Bold size={15}/>
          </button>
          <button 
            id="btn-italic"
            onMouseDown={e => formatText(e, 'italic')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Itálico"
          >
            <Italic size={15}/>
          </button>
          <button 
            id="btn-underline"
            onMouseDown={e => formatText(e, 'underline')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Sublinhado"
          >
            <Underline size={15}/>
          </button>
          <button 
            id="btn-subscript"
            onMouseDown={e => formatText(e, 'subscript')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Subescrito (H₂O)"
          >
            <Subscript size={15}/>
          </button>
          <button 
            id="btn-superscript"
            onMouseDown={e => formatText(e, 'superscript')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Sobrescrito (x²)"
          >
            <Superscript size={15}/>
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
          <button 
            id="btn-justifyLeft"
            onMouseDown={e => formatText(e, 'justifyLeft')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Alinhar à Esquerda"
          >
            <AlignLeft size={15}/>
          </button>
          <button 
            id="btn-justifyCenter"
            onMouseDown={e => formatText(e, 'justifyCenter')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Centralizar"
          >
            <AlignCenter size={15}/>
          </button>
          <button 
            id="btn-justifyRight"
            onMouseDown={e => formatText(e, 'justifyRight')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Alinhar à Direita"
          >
            <AlignRight size={15}/>
          </button>
          <button 
            id="btn-justifyFull"
            onMouseDown={e => formatText(e, 'justifyFull')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Justificar Texto"
          >
            <AlignJustify size={15}/>
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
          <button 
            id="btn-remove-format"
            onMouseDown={removeFormatting} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Texto Normal (Remover Formatação)"
          >
            <RemoveFormatting size={15}/>
          </button>
        </div>
      )}
    </>
  )
}
