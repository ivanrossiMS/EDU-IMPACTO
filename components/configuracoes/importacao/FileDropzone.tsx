'use client'
import { useRef, useState } from 'react'
import { Upload, FileText, X, Eye, ChevronDown } from 'lucide-react'
import { parseCsv, parseXlsx, type ParsedRow } from './useImportacao'

interface Props {
  onData: (rows: ParsedRow[], filename: string) => void
  accept?: string
}

export function FileDropzone({ onData, accept = '.csv,.xlsx,.xls' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [info, setInfo] = useState<{ name: string; size: string; rows: number; preview: ParsedRow[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const processFile = async (file: File) => {
    setLoading(true)
    try {
      let rows: ParsedRow[] = []
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'csv') {
        const text = await file.text()
        rows = parseCsv(text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        rows = await parseXlsx(file)
      }
      const kb = (file.size / 1024).toFixed(1)
      setInfo({ name: file.name, size: `${kb} KB`, rows: rows.length, preview: rows.slice(0, 5) })
      onData(rows, file.name)
    } finally { setLoading(false) }
  }

  const onFiles = (files: FileList | null) => {
    if (files?.[0]) processFile(files[0])
  }

  const previewHeaders = info?.preview[0] ? Object.keys(info.preview[0]) : []

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragging ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
          borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.06)' : 'hsl(var(--bg-elevated))',
          transition: 'all 0.2s', marginBottom: info ? 12 : 0,
        }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
        {loading ? (
          <div style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>⏳ Processando arquivo...</div>
        ) : (
          <>
            <Upload size={28} style={{ margin: '0 auto 10px', color: '#6366f1', display: 'block' }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Arraste o arquivo ou clique para selecionar</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{accept.replace(/\./g, '').toUpperCase()}</div>
          </>
        )}
      </div>

      {info && (
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={16} color="#6366f1" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{info.name}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{info.size} · {info.rows} linhas encontradas</div>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowPreview(p => !p)}><Eye size={14} /></button>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#ef4444' }} onClick={() => { setInfo(null); onData([], '') }}><X size={14} /></button>
          </div>
          {showPreview && previewHeaders.length > 0 && (
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>PRÉVIA DAS PRIMEIRAS LINHAS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                    {previewHeaders.slice(0, 8).map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid hsl(var(--border-subtle))' }}>{h}</th>
                    ))}
                    {previewHeaders.length > 8 && <th style={{ padding: '6px 8px', color: 'hsl(var(--text-muted))' }}>+{previewHeaders.length - 8}</th>}
                  </tr>
                </thead>
                <tbody>
                  {info.preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      {previewHeaders.slice(0, 8).map(h => (
                        <td key={h} style={{ padding: '5px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h]}</td>
                      ))}
                      {previewHeaders.length > 8 && <td style={{ padding: '5px 8px', color: 'hsl(var(--text-muted))' }}>…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
