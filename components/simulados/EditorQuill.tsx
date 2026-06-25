'use client'

import React, { useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
import katex from 'katex'

if (typeof window !== 'undefined') {
  (window as any).katex = katex
}

const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false, 
  loading: () => <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Carregando editor...</div> 
})

interface EditorQuillProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  compact?: boolean
}

export function EditorQuill({ value, onChange, placeholder, compact }: EditorQuillProps) {
  const modules = useMemo(() => ({
    toolbar: compact 
      ? [
          ['bold', 'italic', 'formula']
        ]
      : [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'align': [] }],
          ['formula'],
          ['clean']
        ],
  }), [compact])

  return (
    <div className="editor-quill-container" style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', background: 'hsl(var(--bg-app))' }}>
      <ReactQuill 
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
      />
      <style dangerouslySetInnerHTML={{__html: `
        .editor-quill-container .ql-toolbar {
          background: hsl(var(--bg-surface));
          border: none !important;
          border-bottom: 1px solid hsl(var(--border-subtle)) !important;
          border-radius: 12px 12px 0 0;
        }
        .editor-quill-container .ql-container {
          border: none !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 14px !important;
          color: hsl(var(--text-primary)) !important;
        }
        .editor-quill-container .ql-editor {
          min-height: ${compact ? '60px' : '120px'};
          padding: ${compact ? '8px 12px' : '16px'};
        }
        /* Formula modal fix */
        .ql-tooltip[data-mode="formula"] {
          z-index: 9999 !important;
          background: #fff;
          border: 1px solid #ccc;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}} />
    </div>
  )
}
