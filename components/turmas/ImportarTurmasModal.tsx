'use client'

import { useState } from 'react'
import { 
  X, Upload, Check, AlertTriangle, 
  FileSpreadsheet, Loader2, Download, Trash2
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'

interface ImportarTurmasModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ImportarTurmasModal({ isOpen, onClose, onSuccess }: ImportarTurmasModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [hasHeaders, setHasHeaders] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ linha: number; msg: string }[]>([])
  const [importedSummary, setImportedSummary] = useState<any>(null)

  // Campos do sistema para Turmas
  const systemFields = [
    { value: 'nome', label: 'NOME TURMA' },
    { value: 'ano', label: 'Ano letivo' },
    { value: 'segmento', label: 'Segmento' },
    { value: 'serie', label: 'Série' },
    { value: 'turno', label: 'Turno' },
    { value: 'capacidade', label: 'Capacidade' },
  ]

  const normalize = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
      
      if (data.length > 0) {
        let detectedHeaders: string[] = []
        let previewRows: any[][] = []

        if (hasHeaders) {
          detectedHeaders = data[0] as string[]
          previewRows = data.slice(1, 6)
        } else {
          const maxCols = Math.max(...data.map(row => row.length))
          detectedHeaders = Array.from({ length: maxCols }, (_, i) => `Coluna ${i + 1}`)
          previewRows = data.slice(0, 5)
        }

        setHeaders(detectedHeaders)
        setPreviewData(previewRows)
        
        // Auto mapeamento básico com normalização
        const initialMapping: Record<string, string> = {}
        detectedHeaders.forEach((header, idx) => {
          const key = hasHeaders ? header : String(idx)
          const normHeader = normalize(String(header))
          
          const matchedField = systemFields.find(field => {
            const normLabel = normalize(field.label)
            const normValue = normalize(field.value)
            return normHeader.includes(normLabel) || normLabel.includes(normHeader) || normHeader.includes(normValue)
          })

          if (matchedField) {
            initialMapping[key] = matchedField.value
          }
        })
        setMapping(initialMapping)
      }
    }
    reader.readAsBinaryString(uploadedFile)
  }

  const handleMappingChange = (key: string, value: string) => {
    setMapping(prev => ({ ...prev, [key]: value }))
  }

  const handleImport = async () => {
    if (!file) return

    setLoading(true)
    setErrors([])
    setImportedSummary(null)

    // Validação básica
    if (!Object.values(mapping).includes('nome')) {
      setErrors([{ linha: 0, msg: 'Você precisa mapear o campo "NOME TURMA".' }])
      setLoading(false)
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        
        let rowsToProcess = data
        if (hasHeaders) {
          rowsToProcess = data.slice(1)
        }

        const res = await fetch('/api/importacao/turmas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rowsToProcess,
            mapping,
            hasHeaders,
            headers: hasHeaders ? data[0] : null,
          })
        })

        const result = await res.json()

        if (res.ok) {
          setImportedSummary(result)
          onSuccess()
        } else {
          setErrors([{ linha: 0, msg: result.error || 'Erro desconhecido' }])
        }
        setLoading(false)
      }
      reader.readAsBinaryString(file)
    } catch (e: any) {
      setErrors([{ linha: 0, msg: e.message }])
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = "Nome da Turma,Ano Letivo,Segmento,Série,Turno,Capacidade\nTurma A,2026,Fundamental I,1º Ano,Matutino,30\nTurma B,2026,Fundamental II,6º Ano,Vespertino,35"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'modelo_importacao_turmas.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const clearFile = () => {
    setFile(null)
    setHeaders([])
    setPreviewData([])
    setMapping({})
    setErrors([])
    setImportedSummary(null)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.7)', 
            backdropFilter: 'blur(8px)', 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 24 
          }}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{ 
              background: 'hsl(var(--bg-elevated))', 
              border: '1px solid hsl(var(--border-subtle))', 
              borderRadius: 24, 
              width: '100%', 
              maxWidth: 900, 
              maxHeight: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
            }}
          >
            
            {/* Header com Gradiente Ultra Moderno */}
            <div style={{ 
              padding: '28px 32px', 
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                  <FileSpreadsheet size={24} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>Importação de Turmas</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', margin: '2px 0 0 0', fontWeight: 500 }}>Cadastre múltiplas turmas de uma vez</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                style={{ 
                  width: 40, height: 40, borderRadius: '50%', border: 'none', 
                  background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  cursor: 'pointer', color: '#fff', transition: 'all 0.2s' 
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-base))' }}>
              
              {/* Top Actions */}
              {!importedSummary && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ height: 40, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.2)', color: '#0284c7' }} 
                    onClick={downloadTemplate}
                  >
                    <Download size={14} /> Baixar Modelo CSV
                  </button>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'hsl(var(--bg-elevated))', padding: '8px 16px', borderRadius: '10px', border: '1px solid hsl(var(--border-subtle))' }}>
                    <input type="checkbox" checked={hasHeaders} onChange={e => setHasHeaders(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0284c7' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Arquivo possui cabeçalho</span>
                  </label>
                </div>
              )}

              {/* Upload Dropzone */}
              {!file && !importedSummary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ 
                    textAlign: 'center', 
                    padding: '60px 40px', 
                    border: '2px dashed #0284c7', 
                    borderRadius: 20, 
                    background: 'rgba(2, 132, 199, 0.02)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(2, 132, 199, 0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(2, 132, 199, 0.02)'}
                >
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={32} color="#0284c7" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Arraste seu arquivo aqui</h3>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>ou clique para selecionar do seu computador</p>
                  </div>
                  <label className="btn btn-primary" style={{ padding: '12px 24px', cursor: 'pointer', background: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Upload size={16} /> Selecionar Arquivo
                    <input type="file" accept=".xls,.xlsx,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Formatos aceitos: .xlsx, .xls e .csv</span>
                </motion.div>
              )}

              {/* Mapping & Preview */}
              {file && !importedSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: '12px', border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileSpreadsheet size={18} color="#10b981" />
                      </div>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{file.name}</span>
                        <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }} onClick={clearFile}>
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Mapeamento de Campos</h3>
                    <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>Associe as colunas da sua planilha aos campos do sistema.</p>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, background: 'hsl(var(--bg-elevated))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                          {headers.map((header, idx) => {
                            const key = hasHeaders ? header : String(idx)
                            const isMapped = !!mapping[key]
                            return (
                              <th key={idx} style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))', minWidth: 200 }}>
                                <select 
                                  className="form-input" 
                                  style={{ 
                                    height: 38, 
                                    fontSize: 13, 
                                    padding: '0 12px', 
                                    marginBottom: 8,
                                    border: isMapped ? '1px solid #0284c7' : '1px solid hsl(var(--border-subtle))',
                                    background: isMapped ? 'rgba(2, 132, 199, 0.02)' : 'hsl(var(--bg-base))',
                                    fontWeight: isMapped ? 700 : 500
                                  }}
                                  value={mapping[key] || ''}
                                  onChange={(e) => handleMappingChange(key, e.target.value)}
                                >
                                  <option value="">Ignorar coluna</option>
                                  {systemFields.map(field => (
                                    <option key={field.value} value={field.value}>{field.label}</option>
                                  ))}
                                </select>
                                <div style={{ fontSize: 12, color: isMapped ? '#0284c7' : 'hsl(var(--text-muted))', fontWeight: isMapped ? 600 : 500 }}>{header}</div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, rowIdx) => (
                          <tr key={rowIdx} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            {headers.map((_, colIdx) => (
                              <td key={colIdx} style={{ padding: '14px 16px', fontSize: 13, color: 'hsl(var(--text-primary))', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                                {String(row[colIdx] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* Success Summary */}
              {importedSummary && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: 'center', padding: '30px 0' }}
                >
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                    <Check size={36} color="#22c55e" />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-primary))', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Importação Concluída!</h3>
                  <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>O processamento foi finalizado com sucesso.</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
                    <div style={{ background: 'hsl(var(--bg-elevated))', padding: '16px 24px', borderRadius: '16px', border: '1px solid hsl(var(--border-subtle))', minWidth: 120 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', fontFamily: 'Outfit, sans-serif' }}>{importedSummary.inseridos}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>INSERIDOS</div>
                    </div>
                    <div style={{ background: 'hsl(var(--bg-elevated))', padding: '16px 24px', borderRadius: '16px', border: '1px solid hsl(var(--border-subtle))', minWidth: 120 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#0284c7', fontFamily: 'Outfit, sans-serif' }}>{importedSummary.atualizados}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>ATUALIZADOS</div>
                    </div>
                    <div style={{ background: 'hsl(var(--bg-elevated))', padding: '16px 24px', borderRadius: '16px', border: '1px solid hsl(var(--border-subtle))', minWidth: 120 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>{importedSummary.erros}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>ERROS</div>
                    </div>
                  </div>
                  
                  {importedSummary.erroDetails && importedSummary.erroDetails.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left', maxWidth: 600, margin: '0 auto 24px auto' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} /> Detalhes dos Erros:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                        {importedSummary.erroDetails.map((err: any, idx: number) => (
                          <li key={idx} style={{ marginBottom: 4 }}>Linha {err.linha}: {err.msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <button className="btn btn-primary" style={{ padding: '12px 32px', background: '#0284c7', borderRadius: '12px' }} onClick={onClose}>
                    Concluir e Fechar
                  </button>
                </motion.div>
              )}

              {/* Errors Area */}
              {errors.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 16, marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>Erros na validação:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ef4444' }}>
                    {errors.map((err, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>{err.msg}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            {/* Footer */}
            {!importedSummary && (
              <div style={{ 
                padding: '20px 32px', 
                background: 'hsl(var(--bg-elevated))', 
                borderTop: '1px solid hsl(var(--border-subtle))', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0 24px', height: 44, borderRadius: '12px' }}
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </button>

                <div style={{ display: 'flex', gap: 12 }}>
                  {file && (
                    <button 
                      className="btn btn-primary" 
                      style={{ 
                        padding: '0 32px', 
                        height: 44, 
                        minWidth: 140, 
                        background: '#0284c7', 
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                      }}
                      onClick={handleImport}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Check size={16} /> Importar Dados
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
