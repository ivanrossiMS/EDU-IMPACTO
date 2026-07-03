import React, { useMemo, useRef, useEffect, useState } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { Bold, Italic, Underline } from 'lucide-react'

interface HtmlContentProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string
  onBlurHtml?: (html: string) => void
  editable?: boolean
}

export function HtmlContent({ html, onBlurHtml, editable, ...props }: HtmlContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const toolbarRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const renderedHtml = useMemo(() => {
    if (!html) return ''
    if (typeof window === 'undefined') return html

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
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

      return doc.body.innerHTML
    } catch (e) {
      console.error('HtmlContent parsing error:', e)
      return html
    }
  }, [html])

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!onBlurHtml) return
    
    try {
      const currentHtml = e.currentTarget.innerHTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(currentHtml, 'text/html')
      
      const formulaSpans = doc.querySelectorAll('.ql-formula')
      formulaSpans.forEach(span => {
        const formula = span.getAttribute('data-value')
        if (formula) {
          span.innerHTML = formula 
          span.removeAttribute('contenteditable')
        }
      })
      
      onBlurHtml(doc.body.innerHTML)
    } catch (err) {
      onBlurHtml(e.currentTarget.innerHTML)
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
        toolbarRef.current.style.top = `${rect.top - 40}px`
        toolbarRef.current.style.left = `${rect.left + (rect.width / 2)}px`
        
        const isBold = document.queryCommandState('bold')
        const isItalic = document.queryCommandState('italic')
        const isUnderline = document.queryCommandState('underline')
        
        const btnBold = toolbarRef.current.querySelector('#btn-bold') as HTMLButtonElement
        if (btnBold) btnBold.style.backgroundColor = isBold ? '#3b82f6' : 'transparent'

        const btnItalic = toolbarRef.current.querySelector('#btn-italic') as HTMLButtonElement
        if (btnItalic) btnItalic.style.backgroundColor = isItalic ? '#3b82f6' : 'transparent'

        const btnUnderline = toolbarRef.current.querySelector('#btn-underline') as HTMLButtonElement
        if (btnUnderline) btnUnderline.style.backgroundColor = isUnderline ? '#3b82f6' : 'transparent'
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
      if (btn) btn.style.backgroundColor = state ? '#3b82f6' : 'transparent'
    }

    // Force save immediately so changes aren't lost if blur doesn't fire naturally
    if (containerRef.current && onBlurHtml) {
      try {
        const currentHtml = containerRef.current.innerHTML
        const parser = new DOMParser()
        const doc = parser.parseFromString(currentHtml, 'text/html')
        
        const formulaSpans = doc.querySelectorAll('.ql-formula')
        formulaSpans.forEach(span => {
          const formula = span.getAttribute('data-value')
          if (formula) {
            span.innerHTML = formula 
            span.removeAttribute('contenteditable')
          }
        })
        
        onBlurHtml(doc.body.innerHTML)
      } catch (err) {
        onBlurHtml(containerRef.current.innerHTML)
      }
    }
    
    if (toolbarRef.current) toolbarRef.current.style.display = 'none'
  }

  return (
    <>
      <div 
        ref={containerRef}
        contentEditable={editable}
        suppressContentEditableWarning={editable}
        onBlur={editable ? handleBlur : undefined}
        onMouseUp={editable ? checkSelection : undefined}
        onKeyUp={editable ? checkSelection : undefined}
        dangerouslySetInnerHTML={{ __html: renderedHtml }} 
        {...props} 
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
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            display: 'none',
            gap: '2px'
          }}
        >
          <button 
            id="btn-bold"
            onMouseDown={e => formatText(e, 'bold')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Negrito"
          >
            <Bold size={16}/>
          </button>
          <button 
            id="btn-italic"
            onMouseDown={e => formatText(e, 'italic')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Itálico"
          >
            <Italic size={16}/>
          </button>
          <button 
            id="btn-underline"
            onMouseDown={e => formatText(e, 'underline')} 
            style={{ background: 'transparent', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Sublinhado"
          >
            <Underline size={16}/>
          </button>
        </div>
      )}
    </>
  )
}
