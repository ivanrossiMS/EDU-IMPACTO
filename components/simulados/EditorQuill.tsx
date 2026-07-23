'use client'

import React, { useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'
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
    loading: () => <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Carregando editor...</div> 
  }
)

interface EditorQuillProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  compact?: boolean
}

export function EditorQuill({ value, onChange, placeholder, compact }: EditorQuillProps) {
  const { openKeyboard } = useKeyboard()
  const quillRef = useRef<any>(null)

  const handleSaveVisualFormula = (latex: string) => {
    if (!latex) return
    if (!quillRef.current) return
    
    // Use getEditor() method from react-quill
    const editor = typeof quillRef.current.getEditor === 'function' 
      ? quillRef.current.getEditor() 
      : quillRef.current; // fallback if it's the raw quill instance
      
    if (editor && typeof editor.insertEmbed === 'function') {
      editor.focus()
      const range = editor.getSelection(true)
      const index = range ? range.index : editor.getLength()
      editor.insertEmbed(index, 'formula', latex)
      // Wait a tick before setting selection to allow DOM to update
      setTimeout(() => editor.setSelection(index + 1), 10)
    }
  }

  const modules = useMemo(() => ({
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
      handlers: {
      }
    }
  }), [compact])

  return (
    <div className="editor-quill-container" style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))' }}>
      <ReactQuillWrapper 
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Digite o conteúdo aqui...'}
        modules={modules}
        useSemanticHTML={false}
      />
      <style dangerouslySetInnerHTML={{__html: `
        .editor-quill-container .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border-subtle)) !important;
          background: hsl(var(--bg-surface)) !important;
          border-radius: 12px 12px 0 0 !important;
          padding: 12px 16px !important;
        }
        .editor-quill-container .ql-container {
          border: none !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 15px !important;
          background: hsl(var(--bg-app)) !important;
          border-radius: 0 0 12px 12px !important;
        }
        .editor-quill-container .ql-editor {
          min-height: ${compact ? '120px' : '200px'} !important;
          padding: 16px !important;
          color: hsl(var(--text-primary)) !important;
        }
        .editor-quill-container .ql-editor.ql-blank::before {
          color: hsl(var(--text-muted)) !important;
          font-style: normal !important;
          left: 16px !important;
        }
        .editor-quill-container .ql-toolbar button {
          border-radius: 6px !important;
          margin-right: 4px !important;
          transition: all 0.2s ease !important;
        }
        .editor-quill-container .ql-toolbar button:hover {
          background: hsl(var(--bg-subtle)) !important;
        }
        .editor-quill-container .ql-toolbar button.ql-active {
          background: hsl(var(--bg-subtle)) !important;
          color: hsl(var(--brand-primary)) !important;
        }
        .editor-quill-container .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--brand-primary)) !important;
        }
        .editor-quill-container .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--brand-primary)) !important;
        }
        /* Style for the formula tooltip */
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
