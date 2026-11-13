'use client'

import React, { useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'
import 'react-quill-new/dist/quill.bubble.css'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { useKeyboard } from '../providers/KeyboardProvider'

if (typeof window !== 'undefined') {
  (window as any).katex = katex
}

const ReactQuillWrapper = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new');
    // eslint-disable-next-line react/display-name
    return React.forwardRef((props: any, ref) => <RQ ref={ref} {...props} />);
  },
  { 
    ssr: false, 
    loading: () => <div style={{ minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>Carregando...</div> 
  }
)

interface EditorQuillProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  compact?: boolean
  variant?: 'standard' | 'compact' | 'alternative'
}

export function EditorQuill({ value, onChange, placeholder, compact, variant = 'standard' }: EditorQuillProps) {
  const { openKeyboard } = useKeyboard()
  const quillRef = useRef<any>(null)

  const isAlternative = variant === 'alternative'

  const modules = useMemo(() => {
    if (isAlternative) {
      return {
        toolbar: [
          ['bold', 'italic', 'underline', { 'script': 'sub'}, { 'script': 'super' }],
          [{ 'align': '' }, { 'align': 'center' }, { 'align': 'right' }, { 'align': 'justify' }],
          ['clean']
        ]
      }
    }

    return {
      toolbar: {
        container: compact 
          ? [
              ['bold', 'italic', 'underline'],
              [{ 'script': 'sub'}, { 'script': 'super' }],
              ['clean']
            ]
          : [
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'script': 'sub'}, { 'script': 'super' }],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'align': [] }],
              ['clean']
            ],
        handlers: {}
      }
    }
  }, [compact, isAlternative])

  return (
    <div 
      className={`editor-quill-container ${isAlternative ? 'variant-alternative' : ''}`} 
      style={{ 
        border: '1px solid hsl(var(--border-subtle))', 
        borderRadius: isAlternative ? 8 : 12, 
        background: isAlternative ? 'hsl(var(--bg-surface))' : 'hsl(var(--bg-app))',
        transition: 'border-color 0.15s ease',
        position: 'relative'
      }}
    >
      <ReactQuillWrapper 
        ref={quillRef}
        theme={isAlternative ? "bubble" : "snow"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Digite o conteúdo aqui...'}
        modules={modules}
        useSemanticHTML={false}
      />
      <style dangerouslySetInnerHTML={{__html: `
        /* STANDARD ENUNCIADO EDITOR: 5 LINHAS COMPACTO E ELEGANTE */
        .editor-quill-container:not(.variant-alternative) .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border-subtle)) !important;
          background: hsl(var(--bg-surface)) !important;
          border-radius: 12px 12px 0 0 !important;
          padding: 8px 12px !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-container {
          border: none !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 14px !important;
          background: hsl(var(--bg-app)) !important;
          border-radius: 0 0 12px 12px !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-editor {
          min-height: 110px !important;
          max-height: 140px !important;
          padding: 10px 14px !important;
          color: hsl(var(--text-primary)) !important;
          line-height: 1.45 !important;
          overflow-y: auto !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-editor.ql-blank::before {
          color: hsl(var(--text-muted)) !important;
          font-style: normal !important;
          left: 14px !important;
          font-size: 14px !important;
        }

        /* VARIANT ALTERNATIVE: COMPACT, SINGLE-LINE FEEL */
        .editor-quill-container.variant-alternative {
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          position: relative !important;
          overflow: visible !important;
        }
        .editor-quill-container.variant-alternative:focus-within {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15) !important;
        }
        .editor-quill-container.variant-alternative .ql-container {
          border: none !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 13.5px !important;
          background: transparent !important;
          position: relative !important;
          overflow: visible !important;
        }
        .editor-quill-container.variant-alternative .ql-editor {
          min-height: 38px !important;
          max-height: 84px !important;
          padding: 8px 12px !important;
          color: hsl(var(--text-primary)) !important;
          line-height: 20px !important;
          overflow-y: auto !important;
        }
        .editor-quill-container.variant-alternative .ql-editor.ql-blank::before {
          color: hsl(var(--text-muted)) !important;
          font-style: normal !important;
          left: 12px !important;
          font-size: 13px !important;
          line-height: 20px !important;
        }

        /* BUBBLE TOOLBAR ON SELECTION FOR ALTERNATIVES (COMPACT, SUPERIOR, RIGHT-SAFE) */
        .editor-quill-container.variant-alternative .ql-bubble .ql-tooltip {
          background: #182235 !important;
          border-radius: 9px !important;
          box-shadow: 0 8px 24px -2px rgba(0, 0, 0, 0.45), 0 3px 6px -1px rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          padding: 2px 5px !important;
          z-index: 99999 !important;
          top: auto !important;
          bottom: calc(100% + 6px) !important;
          left: 6px !important;
          transform: none !important;
          display: flex !important;
          align-items: center !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble .ql-tooltip.ql-hidden {
          display: none !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble .ql-tooltip-arrow {
          top: 100% !important;
          bottom: auto !important;
          left: 20px !important;
          margin-left: 0 !important;
          border-top: 5px solid #182235 !important;
          border-bottom: none !important;
          border-left: 5px solid transparent !important;
          border-right: 5px solid transparent !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble .ql-toolbar {
          display: flex !important;
          align-items: center !important;
          gap: 1px !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble .ql-formats {
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 2px !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble .ql-formats + .ql-formats {
          border-left: 1px solid rgba(255, 255, 255, 0.2) !important;
          padding-left: 4px !important;
          margin-left: 3px !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button {
          width: 23px !important;
          height: 23px !important;
          padding: 2.5px !important;
          margin: 0 1px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 4px !important;
          background: transparent !important;
          border: none !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button svg {
          width: 14px !important;
          height: 14px !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button:hover {
          background: rgba(255, 255, 255, 0.16) !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button.ql-active {
          background: rgba(59, 130, 246, 0.4) !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button .ql-stroke {
          stroke: #ffffff !important;
          stroke-width: 2 !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button .ql-fill {
          fill: #ffffff !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button.ql-active .ql-stroke {
          stroke: #60a5fa !important;
        }
        .editor-quill-container.variant-alternative .ql-bubble button.ql-active .ql-fill {
          fill: #60a5fa !important;
        }

        /* STANDARD TOOLBAR BUTTONS */
        .editor-quill-container:not(.variant-alternative) .ql-toolbar button {
          border-radius: 6px !important;
          margin-right: 4px !important;
          transition: all 0.2s ease !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-toolbar button:hover {
          background: hsl(var(--bg-subtle)) !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-toolbar button.ql-active {
          background: hsl(var(--bg-subtle)) !important;
          color: hsl(var(--brand-primary)) !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--brand-primary)) !important;
        }
        .editor-quill-container:not(.variant-alternative) .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--brand-primary)) !important;
        }
        .editor-quill-container .ql-tooltip {
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          border: 1px solid hsl(var(--border-subtle)) !important;
          background: hsl(var(--bg-surface)) !important;
          padding: 8px 12px !important;
          color: hsl(var(--text-primary)) !important;
        }
        .editor-quill-container .ql-tooltip input[type=text] {
          border: 1px solid hsl(var(--border-subtle)) !important;
          border-radius: 6px !important;
          padding: 6px 12px !important;
          font-size: 14px !important;
          color: hsl(var(--text-primary)) !important;
          background: hsl(var(--bg-app)) !important;
        }
        .editor-quill-container .ql-tooltip a.ql-action::after {
          background: hsl(var(--brand-primary)) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          font-size: 14px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          border: none !important;
        }
        .editor-quill-container .ql-tooltip a.ql-remove::before {
          color: hsl(var(--text-muted)) !important;
          margin-left: 8px !important;
          font-size: 14px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
        }
      `}} />
    </div>
  )
}
