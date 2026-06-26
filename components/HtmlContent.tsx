import React, { useMemo, useRef, useEffect } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'

interface HtmlContentProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string
  onBlurHtml?: (html: string) => void
  editable?: boolean
}

export function HtmlContent({ html, onBlurHtml, editable, ...props }: HtmlContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const renderedHtml = useMemo(() => {
    if (!html) return ''
    if (typeof window === 'undefined') return html

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      const formulaSpans = doc.querySelectorAll('.ql-formula')
      formulaSpans.forEach(span => {
        // Fallback to textContent if data-value is missing, which can happen in newer Quill versions
        const formula = span.getAttribute('data-value') || span.textContent
        if (formula) {
          try {
            // Render KaTeX and make it uneditable so user can't mess it up inside contentEditable
            const rendered = katex.renderToString(formula, { throwOnError: false })
            span.innerHTML = rendered
            span.setAttribute('contenteditable', 'false')
            // Ensure data-value exists so the blur handler can revert it later
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
    
    // We need to clean up the HTML before saving, reverting KaTeX to simple ql-formula
    try {
      const currentHtml = e.currentTarget.innerHTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(currentHtml, 'text/html')
      
      const formulaSpans = doc.querySelectorAll('.ql-formula')
      formulaSpans.forEach(span => {
        const formula = span.getAttribute('data-value')
        if (formula) {
          // Revert back to what Quill expects
          span.innerHTML = formula // or just empty, Quill recalculates
          span.removeAttribute('contenteditable')
        }
      })
      
      onBlurHtml(doc.body.innerHTML)
    } catch (err) {
      onBlurHtml(e.currentTarget.innerHTML)
    }
  }

  return (
    <div 
      ref={containerRef}
      contentEditable={editable}
      suppressContentEditableWarning={editable}
      onBlur={editable ? handleBlur : undefined}
      dangerouslySetInnerHTML={{ __html: renderedHtml }} 
      {...props} 
    />
  )
}
