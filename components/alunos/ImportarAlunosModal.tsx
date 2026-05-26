'use client'

import { useState } from 'react'
import { 
  X, Upload, Check, AlertTriangle, ArrowRight, ArrowLeft, 
  FileSpreadsheet, Loader2, Users, Camera, FileArchive, Trash2, Image as ImageIcon, Shield
} from 'lucide-react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

interface ImportarAlunosModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface PhotoItem {
  id: string
  name: string
  base64: string
  size: number
  status: 'pending' | 'success' | 'error'
  error?: string
}

export default function ImportarAlunosModal({ isOpen, onClose, onSuccess }: ImportarAlunosModalProps) {
  const [step, setStep] = useState(2) // 2: Alunos, 3: Resp1, 4: Resp2, 5: Fotos
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [config, setConfig] = useState('manter')
  const [tipoResponsavelConfig, setTipoResponsavelConfig] = useState<'acrescentar' | 'substituir'>('acrescentar')
  const [hasHeaders, setHasHeaders] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ linha: number; msg: string }[]>([])
  const [errorQuery, setErrorQuery] = useState('')
  const [importedSummary, setImportedSummary] = useState<any>(null)
  
  // States para Fotos
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)

  const getValidationWarnings = () => {
    if (!file) return []
    const warnings: string[] = []
    const mappedValues = Object.values(mapping)
    
    if (step === 2) {
      if (!mappedValues.includes('aluno_nome')) {
        warnings.push('A coluna correspondente ao "NOME COMPLETO ALUNO" é obrigatória e ainda não foi mapeada!')
      }
    } else if (step === 3 || step === 4) {
      const hasStudentLink = mappedValues.includes('aluno_codigo') || mappedValues.includes('aluno_nome');
      if (!hasStudentLink) {
        if (mappedValues.includes('resp_nome') && mappedValues.includes('resp_rfid')) {
          warnings.push('Aviso: Sem dados de Aluno, o sistema apenas buscará o responsável pelo Nome para atualizar o RFID.')
        } else {
          warnings.push('A coluna correspondente ao "ID ALUNO / MATRÍCULA" ou "NOME COMPLETO ALUNO" é necessária para vincular o responsável ao aluno!')
        }
      }
      if (!mappedValues.includes('resp_nome')) {
        warnings.push('A coluna correspondente ao "NOME RESPONSAVEL" é obrigatória e ainda não foi mapeada!')
      }
    }
    return warnings
  }

  const systemFields = [
    { value: 'aluno_codigo', label: 'ID ALUNO / MATRÍCULA' },
    { value: 'aluno_nome', label: 'NOME COMPLETO ALUNO' },
    { value: 'aluno_data_nascimento', label: 'DATA NASCIMENTO' },
    { value: 'aluno_telefone', label: 'TELEFONE' },
    { value: 'aluno_email', label: 'EMAIL' },
    { value: 'aluno_cpf', label: 'CPF ALUNO' },
    { value: 'aluno_rg', label: 'RG ALUNO' },
    { value: 'aluno_sexo', label: 'SEXO/GÊNERO ALUNO' },
    { value: 'aluno_cep', label: 'CEP ENDEREÇO' },
    { value: 'aluno_endereco', label: 'LOGRADOURO/ENDEREÇO' },
    { value: 'aluno_numero', label: 'NÚMERO ENDEREÇO' },
    { value: 'aluno_bairro', label: 'BAIRRO' },
    { value: 'aluno_cidade', label: 'CIDADE' },
    { value: 'aluno_uf', label: 'ESTADO (UF)' },
    { value: 'aluno_ativo', label: 'ALUNO ATIVO' },
    { value: 'aluno_autorizadoSairSozinho', label: 'Pode Sair Sozinho' },
    { value: 'aluno_segmento', label: 'SEGMENTO' },
    { value: 'aluno_serie', label: 'SÉRIE' },
    { value: 'aluno_turma', label: 'TURMA' },
    { value: 'aluno_responsavel', label: 'NOME RESPONSÁVEL (Texto)' },
    { value: 'aluno_responsavel_financeiro', label: 'NOME RESP. FINANCEIRO (Texto)' },
    { value: 'aluno_responsavel_pedagogico', label: 'NOME RESP. PEDAGÓGICO (Texto)' },
    { value: 'resp_id', label: 'ID RESPONSAVEL' },
    { value: 'resp_nome', label: 'NOME RESPONSAVEL' },
    { value: 'resp_parentesco', label: 'PARENTESCO' },
    { value: 'resp_tipo', label: 'TIPO (Pedagógico, Financeiro...)' },
    { value: 'resp_data_nasc', label: 'NASCIMENTO RESP.' },
    { value: 'resp_email', label: 'EMAIL RESP.' },
    { value: 'resp_telefone', label: 'TELEFONE RESP.' },
    { value: 'resp_cpf', label: 'CPF RESPONSÁVEL' },
    { value: 'resp_rg', label: 'RG RESPONSÁVEL' },
    { value: 'resp_profissao', label: 'PROFISSÃO' },
    { value: 'resp_rfid', label: 'RFID' },
    { value: 'resp_autorizado_retirar', label: 'AUTORIZADO RETIRAR' },
  ]

  const handleDownloadTemplate = () => {
    console.log('handleDownloadTemplate: Button clicked! Current step is:', step);
    try {
      const wb = XLSX.utils.book_new()
      let data: any[][] = []
      let filename = ''
      
      if (step === 2) {
      filename = 'modelo_importacao_alunos.xlsx'
      data = [
        [
          'ID ALUNO / MATRÍCULA',
          'NOME COMPLETO ALUNO',
          'DATA NASCIMENTO',
          'TELEFONE',
          'EMAIL',
          'ALUNO ATIVO',
          'Pode Sair Sozinho',
          'SEGMENTO',
          'SÉRIE',
          'TURMA'
        ],
        [
          '10001',
          'Arthur Martins Souza',
          '2015-05-15',
          '11999999999',
          'arthur.souza@impacto.com.br',
          'Sim',
          'Não',
          'Ensino Fundamental I',
          '5º Ano',
          'Turma A'
        ],
        [
          '10002',
          'Bianca Soares Duarte',
          '2016-08-20',
          '11988888888',
          'bianca.duarte@impacto.com.br',
          'Sim',
          'Sim',
          'Ensino Fundamental I',
          '4º Ano',
          'Turma B'
        ]
      ]
    } else if (step === 3 || step === 4) {
      const isFirst = step === 3
      filename = isFirst ? 'modelo_importacao_responsaveis_principais.xlsx' : 'modelo_importacao_responsaveis_adicionais.xlsx'
      data = [
        [
          'ID ALUNO / MATRÍCULA',
          'NOME COMPLETO ALUNO',
          'ID RESPONSAVEL',
          'NOME RESPONSAVEL',
          'PARENTESCO',
          'TIPO (Pedagógico, Financeiro...)',
          'NASCIMENTO RESP.',
          'EMAIL RESP.',
          'TELEFONE RESP.',
          'PROFISSÃO',
          'RFID',
          'AUTORIZADO RETIRAR'
        ],
        [
          '10001',
          'Arthur Martins Souza',
          '20001',
          'Claudio Souza',
          isFirst ? 'Pai' : 'Tio',
          'Financeiro e Pedagógico',
          '1982-10-12',
          'claudio.souza@gmail.com',
          '11977777777',
          'Engenheiro',
          '0008153953',
          'Sim'
        ],
        [
          '10002',
          'Bianca Soares Duarte',
          '20002',
          'Lucia Duarte',
          isFirst ? 'Mãe' : 'Avó',
          'Pedagógico',
          '1985-04-03',
          'lucia.duarte@gmail.com',
          '11966666666',
          'Médica',
          '0008233620',
          'Sim'
        ]
      ]
    } else {
      console.log('handleDownloadTemplate: Step is not 2, 3, or 4. Exiting early.');
      return
    }

    const ws = XLSX.utils.aoa_to_sheet(data)
    
    // Set column widths
    const colWidths = data[0].map(val => ({ wch: Math.max(String(val).length + 4, 15) }))
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação')
    XLSX.writeFile(wb, filename)
    console.log('handleDownloadTemplate: Excel file generated and downloaded successfully!');
  } catch (e: any) {
    console.error('handleDownloadTemplate: Exception caught during template download:', e);
    alert('Erro ao gerar modelo de planilha: ' + e.message);
  }
}

  const normalize = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  const getFilteredFields = (s: number) => {
    return systemFields
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
      if (data.length > 0) {
        let detHeaders = hasHeaders 
          ? (data[0] as any[]).map(h => String(h ?? '').trim()) 
          : Array.from({ length: Math.max(...data.map(r => r.length)) }, (_, i) => `Coluna ${i + 1}`)
        setHeaders(detHeaders)
        setPreviewData(data.slice(hasHeaders ? 1 : 0, 6))
        const initMapping: Record<string, string> = {}
        const fields = getFilteredFields(step)
        detHeaders.forEach((h, idx) => {
          const key = hasHeaders ? h : String(idx)
          const normH = normalize(String(h))
          const matched = fields.find(f => normalize(f.label).includes(normH) || normH.includes(normalize(f.label)))
          if (matched) initMapping[key] = matched.value
        })
        setMapping(initMapping)
      }
    }
    reader.readAsBinaryString(uploadedFile)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setErrors([])
    try {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][]
        const res = await fetch('/api/importacao/alunos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: hasHeaders ? data.slice(1) : data,
            mapping, config, tipoResponsavelConfig, hasHeaders, step,
            headers: hasHeaders ? data[0] : null,
          })
        })
        const result = await res.json()
        if (res.ok) {
          setImportedSummary(result)
          if (result.erroDetails && result.erroDetails.length > 0) {
            setErrors(result.erroDetails)
          }
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

  // Lógica de Fotos
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setPhotoLoading(true)
    const newPhotos: PhotoItem[] = []

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.type === 'application/zip' || f.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(f)
        const entries = Object.keys(zip.files).filter(name => !zip.files[name].dir && /\.(png|jpe?g|webp)$/i.test(name))
        for (const name of entries) {
          const blob = await zip.files[name].async('blob')
          const base64 = await blobToBase64(blob)
          const id = name.split('/').pop()?.split('.')[0] || ''
          newPhotos.push({ id, name, base64, size: blob.size, status: 'pending' })
        }
      } else if (f.type.startsWith('image/')) {
        const base64 = await blobToBase64(f)
        const id = f.name.split('.')[0]
        newPhotos.push({ id, name: f.name, base64, size: f.size, status: 'pending' })
      }
    }
    setPhotos(prev => [...prev, ...newPhotos])
    setPhotoLoading(false)
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }

  const handleImportPhotos = async () => {
    if (photos.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/importacao/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: photos.map(p => ({ id: p.id, base64: p.base64 })) })
      })
      const result = await res.json()
      if (res.ok) {
        setImportedSummary(result)
        onSuccess()
      } else {
        setErrors([{ linha: 0, msg: result.error || 'Erro ao importar fotos' }])
      }
    } catch (e: any) {
      setErrors([{ linha: 0, msg: e.message }])
    }
    setLoading(false)
  }

  const resetForNextStep = (next: number) => {
    setStep(next)
    setFile(null)
    setHeaders([])
    setPreviewData([])
    setMapping({})
    setErrors([])
    setErrorQuery('')
    setImportedSummary(null)
    setPhotos([])
  }

  const steps = [
    { num: 2, label: 'Alunos', icon: Users },
    { num: 3, label: 'Pai/Mãe', icon: Shield },
    { num: 4, label: 'Outros', icon: Shield },
    { num: 5, label: 'Fotos', icon: Camera }
  ]

  const filteredErrors = errors.filter(e => {
    const term = errorQuery.toLowerCase()
    return (
      (e.linha && String(e.linha).includes(term)) ||
      (e.msg && e.msg.toLowerCase().includes(term))
    )
  })

  if (!isOpen) return null

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, width: '100%', maxWidth: 1000, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Central de Importação</h2>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Importe alunos, responsáveis e fotos</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.2)', cursor: 'pointer', color: '#fff' }}><X size={20} /></button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', background: 'hsl(var(--bg-base))', borderBottom: '1px solid hsl(var(--border-subtle))', padding: '16px 32px', justifyContent: 'space-between' }}>
          {steps.map((s) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: step === s.num ? 1 : 0.5 }}>
              <div style={{ width: 32, height: 32, borderRadius: '10px', background: step >= s.num ? '#2563eb' : 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step >= s.num ? '#fff' : 'hsl(var(--text-muted))' }}>
                <s.icon size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: step === s.num ? '#2563eb' : 'hsl(var(--text-primary))' }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-base))' }}>
          {/* STEP 2, 3, 4: EXCEL */}
          {step <= 4 && (
            <>
              {!file && !importedSummary && (
                <div style={{ textAlign: 'center', padding: '60px 40px', border: '2px dashed #2563eb', borderRadius: 20, background: 'rgba(37, 99, 235, 0.02)' }}>
                  <Upload size={48} color="#2563eb" style={{ margin: '0 auto 20px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Selecione o arquivo Excel</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 24 }}>O arquivo deve conter os dados do {steps.find(s => s.num === step)?.label}</p>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="btn btn-primary" style={{ padding: '12px 32px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <Upload size={16} /> Escolher Arquivo
                      <input type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>
                    <button 
                      type="button"
                      onClick={handleDownloadTemplate} 
                      className="btn btn-secondary" 
                      style={{ padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
                    >
                      <FileSpreadsheet size={16} color="#10b981" /> Baixar Modelo
                    </button>
                  </div>
                </div>
              )}

               {file && !importedSummary && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <FileSpreadsheet color="#10b981" />
                      <span style={{ fontWeight: 700 }}>{file.name}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Trocar arquivo</button>
                  </div>

                  {(step === 3 || step === 4) && (
                    <div style={{
                      background: 'hsl(var(--bg-elevated))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 16,
                      padding: '16px 20px',
                      marginBottom: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                          borderRadius: 10,
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Shield size={20} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Atualização dos Papéis do Responsável</h4>
                          <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0 0' }}>
                            Como salvar as funções (Financeiro/Pedagógico) se o responsável já existir?
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setTipoResponsavelConfig('acrescentar')}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: tipoResponsavelConfig === 'acrescentar' ? '2px solid #2563eb' : '1px solid hsl(var(--border-subtle))',
                            background: tipoResponsavelConfig === 'acrescentar' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                            color: tipoResponsavelConfig === 'acrescentar' ? '#2563eb' : 'hsl(var(--text-muted))',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          ➕ Acrescentar papéis
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipoResponsavelConfig('substituir')}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: tipoResponsavelConfig === 'substituir' ? '2px solid #ef4444' : '1px solid hsl(var(--border-subtle))',
                            background: tipoResponsavelConfig === 'substituir' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                            color: tipoResponsavelConfig === 'substituir' ? '#ef4444' : 'hsl(var(--text-muted))',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          🔄 Substituir existentes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dynamic column mapping warnings */}
                  {getValidationWarnings().map((warn, wIdx) => (
                    <div key={wIdx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      background: 'rgba(245, 158, 11, 0.05)', 
                      border: '1px solid rgba(245, 158, 11, 0.25)', 
                      borderRadius: 16, 
                      padding: '16px 20px', 
                      marginBottom: 20 
                    }}>
                      <AlertTriangle color="#f59e0b" size={20} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>{warn}</span>
                    </div>
                  ))}

                  <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'hsl(var(--bg-elevated))' }}>
                        <tr>
                          {headers.map((h, i) => {
                            const isMapped = !!mapping[h];
                            return (
                              <th key={i} style={{ 
                                padding: 16, 
                                textAlign: 'left', 
                                borderRight: '1px solid hsl(var(--border-subtle))',
                                borderTop: isMapped ? '3px solid #2563eb' : 'none',
                                background: isMapped ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                                opacity: isMapped ? 1 : 0.6,
                                transition: 'all 0.2s ease-in-out'
                              }}>
                                <select className="form-input" style={{ marginBottom: 8, borderColor: isMapped ? '#2563eb' : 'hsl(var(--border-subtle))' }} value={mapping[h] || ''} onChange={(e) => setMapping({...mapping, [h]: e.target.value})}>
                                  <option value="">Ignorar</option>
                                  {getFilteredFields(step).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <div style={{ fontSize: 11, fontWeight: isMapped ? 800 : 500, color: isMapped ? '#2563eb' : 'hsl(var(--text-muted))' }}>{h}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, ri) => (
                          <tr key={ri} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                            {headers.map((h, ci) => {
                              const isMapped = !!mapping[h];
                              return (
                                <td key={ci} style={{ 
                                  padding: 12, 
                                  fontSize: 12,
                                  background: isMapped ? 'rgba(37, 99, 235, 0.01)' : 'transparent',
                                  color: isMapped ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                                  opacity: isMapped ? 1 : 0.65,
                                  transition: 'all 0.2s ease-in-out'
                                }}>
                                  {String(row[ci] || '')}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 5: PHOTOS */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!importedSummary && (
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 300, padding: 32, border: '2px dashed #2563eb', borderRadius: 20, textAlign: 'center', background: 'rgba(37, 99, 235, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
                      <ImageIcon size={32} color="#2563eb" />
                      <FileArchive size={32} color="#2563eb" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Importar Fotos</h3>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 24 }}>Selecione imagens individuais ou um arquivo .ZIP.<br/>O nome do arquivo deve ser o <b>ID ou Matrícula</b> do aluno.</p>
                    <label className="btn btn-primary" style={{ padding: '12px 32px', cursor: 'pointer' }}>
                      Selecionar Fotos/ZIP
                      <input type="file" multiple accept="image/*,.zip" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  
                  {photos.length > 0 && (
                    <div style={{ flex: 1.5, minWidth: 300, background: 'hsl(var(--bg-elevated))', borderRadius: 20, padding: 20, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontWeight: 700 }}>Fotos Preparadas ({photos.length})</span>
                        <button className="btn btn-ghost btn-sm text-red-500" onClick={() => setPhotos([])}><Trash2 size={14}/> Limpar tudo</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 12, maxHeight: 300, overflowY: 'auto', padding: 4 }}>
                        {photos.map((p, i) => (
                          <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1/1', border: '1px solid hsl(var(--border-subtle))' }}>
                            <img src={p.base64} alt={p.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center' }}>{p.id}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Success Summary */}
          {importedSummary && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Check size={40} color="#22c55e" />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Importação Concluída!</h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#22c55e' }}>{importedSummary.inseridos || 0}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>INSERIDOS</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#2563eb' }}>{importedSummary.atualizados || 0}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>ATUALIZADOS</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#ef4444' }}>{importedSummary.erros || 0}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>ERROS</div>
                </div>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.03)', 
              border: '1px solid rgba(239, 68, 68, 0.15)', 
              borderRadius: 20, 
              padding: 24, 
              marginTop: 28,
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.05)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', fontWeight: 800, fontSize: 16 }}>
                  <AlertTriangle size={20} className="animate-pulse" /> Detalhes dos Erros Encontrados ({errors.length})
                </div>
                
                {/* Search query box */}
                <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
                  <input 
                    type="text" 
                    placeholder="Buscar por linha ou mensagem..."
                    value={errorQuery}
                    onChange={(e) => setErrorQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      fontSize: 13,
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: 'hsl(var(--bg-elevated))',
                      color: 'hsl(var(--text-primary))',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                  />
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                    <AlertTriangle size={14} color="hsl(var(--text-muted))" />
                  </div>
                </div>
              </div>

              {/* Scrollable interactive list */}
              <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {filteredErrors.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    Nenhum erro corresponde à sua busca.
                  </div>
                ) : (
                  filteredErrors.map((e, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        display: 'flex', 
                        gap: 12, 
                        background: 'rgba(239, 68, 68, 0.02)', 
                        border: '1px solid rgba(239, 68, 68, 0.08)', 
                        borderRadius: 12, 
                        padding: '12px 16px',
                        alignItems: 'center',
                        transition: 'all 0.15s ease-out'
                      }}
                    >
                      {e.linha > 0 && (
                        <span style={{ 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          color: '#ef4444', 
                          fontWeight: 900, 
                          fontSize: 11, 
                          padding: '3px 8px', 
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          flexShrink: 0
                        }}>
                          Linha {e.linha}
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: '#fca5a5', fontWeight: 500, lineHeight: 1.4 }}>
                        {e.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px 32px', background: 'hsl(var(--bg-elevated))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <div style={{ display: 'flex', gap: 12 }}>
            {step > 2 && !importedSummary && (
              <button className="btn btn-secondary" onClick={() => resetForNextStep(step - 1)}><ArrowLeft size={16}/> Anterior</button>
            )}
            
            {step <= 4 && file && !importedSummary && (
              <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : `Importar ${steps.find(s => s.num === step)?.label}`}
              </button>
            )}

            {step === 5 && photos.length > 0 && !importedSummary && (
              <button className="btn btn-primary" onClick={handleImportPhotos} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : `Importar ${photos.length} Fotos`}
              </button>
            )}

            {importedSummary && step < 5 && (
              <button className="btn btn-primary" onClick={() => resetForNextStep(step + 1)}>Próximo Passo <ArrowRight size={16}/></button>
            )}

            {!file && !importedSummary && step < 5 && (
              <button className="btn btn-ghost" onClick={() => resetForNextStep(step + 1)}>Pular Etapa <ArrowRight size={16}/></button>
            )}
            
            {importedSummary && step === 5 && (
              <button className="btn btn-primary" onClick={onClose}>Finalizar</button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
