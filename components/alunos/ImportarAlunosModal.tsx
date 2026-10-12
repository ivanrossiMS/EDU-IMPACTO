'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, Upload, Check, AlertTriangle, ArrowRight, ArrowLeft,
  FileSpreadsheet, Loader2, Users, Camera, FileArchive, Trash2,
  Image as ImageIcon, Shield, History, RotateCcw, Download,
  CheckCircle2, AlertCircle, Edit2, Plus, Sparkles, Filter, ChevronDown
} from 'lucide-react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

import { SYSTEM_FIELDS } from '@/lib/importacao/systemFields'
import { autoMapHeaders } from '@/lib/importacao/autoMapper'
import { downloadAllInOneTemplate } from '@/lib/importacao/templateGenerator'
import { validateRows, parseBrazilianDate } from '@/lib/importacao/validator'
import { RowValidationResult, ValidationIssue } from '@/lib/importacao/types'

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
  // Passos: 1: Upload & Mapeamento | 2: Data Studio & Validação | 3: Progresso & Relatório | 4: Fotos | 5: Histórico de Lotes
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Arquivo e Dados Brutos
  const [file, setFile] = useState<File | null>(null)
  const [rawData, setRawData] = useState<any[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [hasHeaders, setHasHeaders] = useState(true)

  // Mapeamento
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [savedProfiles, setSavedProfiles] = useState<Record<string, Record<string, string>>>({})
  const [profileNameInput, setProfileNameInput] = useState('')
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Dados Validados no Data Studio
  const [validationResults, setValidationResults] = useState<RowValidationResult[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'warning' | 'error'>('all')
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Turmas do Sistema e Conciliação
  const [knownTurmas, setKnownTurmas] = useState<Array<{ id: string; nome: string; serie?: string }>>([])
  const [unmatchedTurmas, setUnmatchedTurmas] = useState<string[]>([])
  const [turmaOverrides, setTurmaOverrides] = useState<Record<string, string>>({}) // planilhaTurma -> sistemaTurmaId
  const [creatingTurmaName, setCreatingTurmaName] = useState<string | null>(null)

  // Configurações da Importação
  const [tipoTurmaConfig, setTipoTurmaConfig] = useState<'acrescentar' | 'substituir'>('acrescentar')
  const [tipoResponsavelConfig, setTipoResponsavelConfig] = useState<'acrescentar' | 'substituir'>('acrescentar')
  const [inativarAusentes, setInativarAusentes] = useState(false)

  // Execução e Progresso
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [importSummary, setImportSummary] = useState<{
    batchId: string
    inseridos: number
    atualizados: number
    erros: number
    total: number
    erroDetails: Array<{ linha: number; alunoNome?: string; msg: string; rawRow?: any }>
  } | null>(null)

  // Rollback e Histórico
  const [batchesList, setBatchesList] = useState<any[]>([])
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null)

  // Fotos
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)

  // 1. Carregar turmas do sistema e perfis salvos ao abrir
  useEffect(() => {
    if (!isOpen) return

    fetch('/api/turmas?all=true')
      .then(res => res.json())
      .then(json => {
        if (json.data && Array.isArray(json.data)) {
          setKnownTurmas(json.data.map((t: any) => ({ id: t.id, nome: t.nome, serie: t.serie })))
        }
      })
      .catch(err => console.error('Erro ao buscar turmas:', err))

    try {
      const stored = localStorage.getItem('impacto_import_profiles')
      if (stored) setSavedProfiles(JSON.parse(stored))
    } catch {}
  }, [isOpen])

  // Carregar histórico de lotes
  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/importacao/rollback')
      const json = await res.json()
      if (json.batches) setBatchesList(json.batches)
    } catch (e) {
      console.error('Erro ao buscar lotes:', e)
    }
  }

  // 2. Manipular Upload de Arquivo Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

        if (!data || data.length === 0) {
          alert('A planilha selecionada está vazia!')
          return
        }

        setRawData(data)
        processHeadersAndAutoMap(data, hasHeaders)
      } catch (err: any) {
        alert('Erro ao processar planilha: ' + err.message)
      }
    }
    reader.readAsBinaryString(uploadedFile)
  }

  const processHeadersAndAutoMap = (data: any[][], useHeaders: boolean) => {
    if (!data || data.length === 0) return
    const detHeaders = useHeaders
      ? (data[0] as any[]).map(h => String(h ?? '').trim())
      : Array.from({ length: Math.max(...data.map(r => r.length)) }, (_, i) => `Coluna ${i + 1}`)

    setHeaders(detHeaders)
    const { mapping: autoMapped } = autoMapHeaders(detHeaders)
    setMapping(autoMapped)
  }

  const toggleHasHeaders = (val: boolean) => {
    setHasHeaders(val)
    if (rawData.length > 0) {
      processHeadersAndAutoMap(rawData, val)
    }
  }

  // Salvar Perfil de Mapeamento
  const handleSaveProfile = () => {
    if (!profileNameInput.trim()) return
    const updated = { ...savedProfiles, [profileNameInput.trim()]: mapping }
    setSavedProfiles(updated)
    localStorage.setItem('impacto_import_profiles', JSON.stringify(updated))
    setProfileNameInput('')
    setShowProfileModal(false)
  }

  const handleLoadProfile = (name: string) => {
    if (savedProfiles[name]) {
      setMapping(savedProfiles[name])
    }
  }

  // 3. Avançar para o Data Studio e disparar pré-validação
  const handleProceedToDataStudio = () => {
    if (!file || rawData.length === 0) return

    // Validar se mapeou ao menos o nome do aluno
    const mappedValues = Object.values(mapping)
    if (!mappedValues.includes('aluno_nome')) {
      alert('A coluna correspondente ao "Nome Completo do Aluno" é obrigatória e deve ser mapeada!')
      return
    }

    const dataRows = hasHeaders ? rawData.slice(1) : rawData
    const validation = validateRows(dataRows, headers, mapping, knownTurmas)
    setValidationResults(validation.results)
    setUnmatchedTurmas(validation.unmatchedTurmas)
    setActiveStep(2)
  }

  // Edição Direta na Grade (Inline Editing)
  const handleStartCellEdit = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ rowIndex, field })
    setEditValue(currentValue ?? '')
  }

  const handleSaveCellEdit = () => {
    if (!editingCell) return
    const { rowIndex, field } = editingCell

    // Atualizar no validationResults
    setValidationResults(prev => {
      const updated = [...prev]
      const targetIdx = updated.findIndex(r => r.rowIndex === rowIndex)
      if (targetIdx !== -1) {
        const row = { ...updated[targetIdx] }
        row.data = { ...row.data, [field]: editValue }

        // Revalidar a linha específica
        const isNomeEmpty = field === 'aluno_nome' && !String(editValue).trim()
        const issues = row.issues.filter((i: ValidationIssue) => i.field !== field)

        if (isNomeEmpty) {
          issues.push({ type: 'error', field: 'aluno_nome', message: 'Nome do aluno é obrigatório' })
        } else if (field === 'aluno_data_nascimento') {
          const parsed = parseBrazilianDate(editValue)
          if (!parsed.valid) {
            issues.push({ type: 'warning', field: 'aluno_data_nascimento', message: 'Data inválida' })
          } else if (parsed.iso) {
            row.data.aluno_data_nascimento = parsed.iso
          }
        }

        row.issues = issues
        const hasErr = issues.some((i: ValidationIssue) => i.type === 'error')
        const hasWarn = issues.some((i: ValidationIssue) => i.type === 'warning')
        row.status = hasErr ? 'error' : hasWarn ? 'warning' : 'ready'
        updated[targetIdx] = row
      }
      return updated
    })

    setEditingCell(null)
    setEditValue('')
  }

  // Criar Turma Rápida durante a Conciliação
  const handleCreateTurma = async (turmaNome: string) => {
    setCreatingTurmaName(turmaNome)
    try {
      const res = await fetch('/api/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: turmaNome, capacidade: 35, ano: new Date().getFullYear() })
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setKnownTurmas(prev => [...prev, { id: json.data.id, nome: json.data.nome }])
        setTurmaOverrides(prev => ({ ...prev, [turmaNome]: json.data.id }))
        setUnmatchedTurmas(prev => prev.filter(t => t !== turmaNome))
      } else {
        alert(json.error || 'Erro ao criar turma')
      }
    } catch (e: any) {
      alert('Erro ao criar turma: ' + e.message)
    }
    setCreatingTurmaName(null)
  }

  // 4. Executar Importação em Lote
  const handleExecuteImport = async () => {
    // Filtrar linhas com status diferente de erro impeditivo
    const rowsToImport = validationResults.filter(r => r.status !== 'error')
    if (rowsToImport.length === 0) {
      alert('Não há registros válidos para importar! Corrija os erros na grade antes de prosseguir.')
      return
    }

    setLoading(true)
    setActiveStep(3)
    setImportProgress({ current: 0, total: rowsToImport.length })

    const batchId = `LOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    const chunkSize = 25
    let totalInseridos = 0
    let totalAtualizados = 0
    let totalErros = 0
    let allErroDetails: any[] = []
    let accumulatedIds: string[] = []
    let currentTracker: any = {
      alunoIdsCriados: [],
      alunoIdsAtualizados: [],
      respIdsCriados: [],
      vinculoIdsCriados: [],
      alunosInativados: [],
      previousSnapshots: {}
    }

    try {
      for (let i = 0; i < rowsToImport.length; i += chunkSize) {
        const chunk = rowsToImport.slice(i, i + chunkSize)
        const isLastChunk = i + chunkSize >= rowsToImport.length

        setImportProgress({
          current: Math.min(i + chunkSize, rowsToImport.length),
          total: rowsToImport.length
        })

        // Preparar chunk de linhas
        const rawChunkRows = chunk.map(c => {
          const rowCopy = [...c.originalRow]
          // Se tiver override de turma
          if (c.data.aluno_turma && turmaOverrides[c.data.aluno_turma]) {
            const turmaColIdx = headers.indexOf(Object.keys(mapping).find(k => mapping[k] === 'aluno_turma') || '')
            if (turmaColIdx !== -1) rowCopy[turmaColIdx] = turmaOverrides[c.data.aluno_turma]
          }
          return rowCopy
        })

        const res = await fetch('/api/importacao/alunos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rawChunkRows,
            mapping,
            headers: hasHeaders ? headers : null,
            hasHeaders,
            tipoTurmaConfig,
            tipoResponsavelConfig,
            inativarAusentes: isLastChunk ? inativarAusentes : false,
            accumulatedIds,
            batchId,
            isLastChunk,
            batchTracker: currentTracker
          })
        })

        const result = await res.json()
        if (res.ok) {
          totalInseridos += result.inseridos || 0
          totalAtualizados += result.atualizados || 0
          totalErros += result.erros || 0
          if (result.erroDetails && result.erroDetails.length > 0) {
            allErroDetails = [...allErroDetails, ...result.erroDetails]
          }
          if (result.processedIds) accumulatedIds = result.processedIds
          if (result.batchTracker) currentTracker = result.batchTracker
        } else {
          totalErros += chunk.length
          allErroDetails.push({ linha: i + 1, msg: result.error || 'Erro no servidor' })
        }
      }

      setImportSummary({
        batchId,
        total: rowsToImport.length,
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        erros: totalErros,
        erroDetails: allErroDetails
      })

      onSuccess()
    } catch (e: any) {
      allErroDetails.push({ linha: 0, msg: e.message })
      setImportSummary({
        batchId,
        total: rowsToImport.length,
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        erros: totalErros + 1,
        erroDetails: allErroDetails
      })
    } finally {
      setLoading(false)
      setImportProgress(null)
    }
  }

  // Baixar Planilha com Apenas os Alunos Rejeitados
  const handleDownloadRejeitados = () => {
    if (!importSummary || importSummary.erroDetails.length === 0) return

    const exportRows = importSummary.erroDetails.map(err => {
      const originalRow = err.rawRow ? err.rawRow : []
      return [
        err.linha,
        err.msg,
        err.alunoNome || '',
        ...originalRow
      ]
    })

    const exportHeaders = ['LINHA ORIGINAL', 'MOTIVO DO ERRO', 'ALUNO', ...headers]
    const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos com Erro')
    XLSX.writeFile(wb, `alunos_rejeitados_${importSummary.batchId}.xlsx`)
  }

  // Desfazer Importação (Rollback)
  const handleRollback = async (batchId: string) => {
    if (!confirm(`Tem certeza que deseja DESFAZER toda a importação do lote ${batchId}? Alunos novos cadastrados por este lote serão removidos e alunos inativados serão restaurados.`)) {
      return
    }

    setRevertingBatchId(batchId)
    try {
      const res = await fetch('/api/importacao/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId })
      })
      const json = await res.json()
      if (res.ok) {
        alert(`Sucesso! ${json.details?.alunosRemovidos || 0} alunos removidos, ${json.details?.alunosReativados || 0} alunos reativados.`)
        onSuccess()
        fetchBatches()
        if (importSummary?.batchId === batchId) {
          setImportSummary(null)
          setActiveStep(1)
        }
      } else {
        alert(json.error || 'Erro ao reverter importação')
      }
    } catch (e: any) {
      alert('Erro ao reverter: ' + e.message)
    } finally {
      setRevertingBatchId(null)
    }
  }

  // Upload e Importação de Fotos
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
        alert(`Fotos importadas com sucesso! ${result.atualizados || photos.length} fotos vinculadas aos alunos.`)
        onSuccess()
        onClose()
      } else {
        alert(result.error || 'Erro ao importar fotos')
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
    setLoading(false)
  }

  // Filtragem dos Resultados da Grade
  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return validationResults
    return validationResults.filter(r => r.status === statusFilter)
  }, [validationResults, statusFilter])

  const totalReady = validationResults.filter(r => r.status === 'ready').length
  const totalWarning = validationResults.filter(r => r.status === 'warning').length
  const totalError = validationResults.filter(r => r.status === 'error').length

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 24,
          width: '100%',
          maxWidth: 1100,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)'
        }}
      >
        {/* Header Superior */}
        <div style={{
          padding: '20px 28px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                Central de Importação Inteligente
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', margin: '2px 0 0 0' }}>
                Importe alunos, turmas e responsáveis em planilha única com auto-validação
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                fetchBatches()
                setActiveStep(5)
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s'
              }}
            >
              <History size={16} /> Histórico / Desfazer
            </button>
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stepper Moderno */}
        <div style={{
          display: 'flex',
          background: 'hsl(var(--bg-base))',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          padding: '12px 28px',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {[
            { num: 1, label: '1. Upload & Mapeamento', icon: Upload },
            { num: 2, label: '2. Data Studio & Validação', icon: Sparkles },
            { num: 3, label: '3. Execução & Conclusão', icon: CheckCircle2 },
            { num: 4, label: '📷 Fotos dos Alunos', icon: Camera }
          ].map(s => {
            const isActive = activeStep === s.num
            const isDone = activeStep > s.num && activeStep !== 5
            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num === 1 || (s.num === 2 && file) || (s.num === 4)) {
                    setActiveStep(s.num as any)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: s.num <= 2 || s.num === 4 ? 'pointer' : 'default',
                  opacity: isActive || isDone ? 1 : 0.45
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isDone ? '#10b981' : isActive ? '#2563eb' : 'hsl(var(--bg-elevated))',
                  color: isDone || isActive ? '#fff' : 'hsl(var(--text-muted))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800
                }}>
                  {isDone ? <Check size={14} /> : s.num}
                </div>
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#2563eb' : 'hsl(var(--text-primary))'
                }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Conteúdo Principal do Modal */}
        <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-base))' }}>
          
          {/* ========================================================
              PASSO 1: UPLOAD & MAPEAMENTO INTELIGENTE
             ======================================================== */}
          {activeStep === 1 && (
            <div>
              {!file ? (
                <div style={{
                  textAlign: 'center',
                  padding: '50px 30px',
                  border: '2px dashed #2563eb',
                  borderRadius: 20,
                  background: 'rgba(37, 99, 235, 0.03)'
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#2563eb'
                  }}>
                    <Upload size={32} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0', color: 'hsl(var(--text-primary))' }}>
                    Selecione a Planilha de Alunos e Responsáveis
                  </h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, maxWidth: 500, margin: '0 auto 24px' }}>
                    O sistema aceita a <b>Planilha Única Oficial</b> (Aluno, Mãe e Pai na mesma linha) ou arquivos exportados de outros ERPs escolares (Totvs, Sophia, Sponte, etc.).
                  </p>

                  <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="btn btn-primary" style={{ padding: '12px 28px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                      <Upload size={16} /> Escolher Arquivo (.xlsx, .xls)
                      <input type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>

                    <button
                      type="button"
                      onClick={downloadAllInOneTemplate}
                      className="btn btn-secondary"
                      style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                    >
                      <Download size={16} color="#10b981" /> Baixar Modelo All-in-One
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Top Bar do Arquivo Carregado */}
                  <div style={{
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FileSpreadsheet color="#10b981" size={24} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{file.name}</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                          {rawData.length} linhas carregadas • {headers.length} colunas encontradas
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={hasHeaders}
                          onChange={(e) => toggleHasHeaders(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                        />
                        <span style={{ fontWeight: 600 }}>Primeira linha é cabeçalho</span>
                      </label>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Trocar arquivo</button>
                    </div>
                  </div>

                  {/* Banner de Mapeamento com Perfis */}
                  <div style={{
                    background: 'rgba(37, 99, 235, 0.04)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    borderRadius: 16,
                    padding: '14px 20px',
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Sparkles size={18} color="#2563eb" />
                      <span>
                        <b>Auto-Mapeamento:</b> O sistema detectou <b>{Object.keys(mapping).length}</b> colunas correspondentes automaticamente.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {Object.keys(savedProfiles).length > 0 && (
                        <select
                          className="form-input"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onChange={(e) => handleLoadProfile(e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>Carregar Perfil Salvo...</option>
                          {Object.keys(savedProfiles).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowProfileModal(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12 }}
                      >
                        Salvar Layout Atual
                      </button>
                    </div>
                  </div>

                  {/* Modal de Salvar Perfil */}
                  {showProfileModal && (
                    <div style={{
                      padding: 16,
                      background: 'hsl(var(--bg-elevated))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 14,
                      marginBottom: 20,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        placeholder="Nome do Perfil (ex: Exportação Totvs, Padrão 2026)..."
                        value={profileNameInput}
                        onChange={(e) => setProfileNameInput(e.target.value)}
                        className="form-input"
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>Salvar Perfil</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowProfileModal(false)}>Cancelar</button>
                    </div>
                  )}

                  {/* Grade de Mapeamento de Colunas */}
                  <div style={{
                    maxHeight: 380,
                    overflowY: 'auto',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    background: 'hsl(var(--bg-elevated))'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'hsl(var(--bg-elevated))', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Coluna na sua Planilha</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Campo Correspondente no Impacto Edu</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Exemplo de Dado (Linha 1)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headers.map((h, idx) => {
                          const isMapped = !!mapping[h]
                          const sampleVal = rawData[hasHeaders ? 1 : 0]?.[idx]
                          return (
                            <tr key={idx} style={{
                              borderBottom: '1px solid hsl(var(--border-subtle))',
                              background: isMapped ? 'rgba(37, 99, 235, 0.02)' : 'transparent'
                            }}>
                              <td style={{ padding: '10px 16px', fontWeight: isMapped ? 700 : 500 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isMapped ? <CheckCircle2 size={14} color="#10b981" /> : <div style={{ width: 14 }} />}
                                  <span>{h}</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 16px' }}>
                                <select
                                  value={mapping[h] || ''}
                                  onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                                  className="form-input"
                                  style={{
                                    fontSize: 12,
                                    borderColor: isMapped ? '#2563eb' : 'hsl(var(--border-subtle))',
                                    fontWeight: isMapped ? 700 : 400
                                  }}
                                >
                                  <option value="">Ignorar esta coluna</option>
                                  <optgroup label="🎓 DADOS DO ALUNO">
                                    {SYSTEM_FIELDS.filter(f => f.category === 'aluno').map(f => (
                                      <option key={f.value} value={f.value}>{f.label} {f.required ? '(*)' : ''}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="📍 ENDEREÇO DO ALUNO">
                                    {SYSTEM_FIELDS.filter(f => f.category === 'endereco').map(f => (
                                      <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="👩 MÃE / RESPONSÁVEL 1">
                                    {SYSTEM_FIELDS.filter(f => f.category === 'resp1').map(f => (
                                      <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="👨 PAI / RESPONSÁVEL 2">
                                    {SYSTEM_FIELDS.filter(f => f.category === 'resp2').map(f => (
                                      <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                  </optgroup>
                                </select>
                              </td>
                              <td style={{ padding: '10px 16px', color: 'hsl(var(--text-muted))', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(sampleVal ?? '')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleProceedToDataStudio}
                      style={{ padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                    >
                      Avançar para o Data Studio e Validação <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              PASSO 2: DATA STUDIO & PRÉ-VALIDAÇÃO VISUAL
             ======================================================== */}
          {activeStep === 2 && (
            <div>
              {/* Painel de Auditoria Prévia (Status Pills) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14,
                marginBottom: 20
              }}>
                <div
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: statusFilter === 'all' ? 'rgba(37, 99, 235, 0.1)' : 'hsl(var(--bg-elevated))',
                    border: statusFilter === 'all' ? '2px solid #2563eb' : '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    padding: 14,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>{validationResults.length}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>TOTAL DE LINHAS</div>
                </div>

                <div
                  onClick={() => setStatusFilter('ready')}
                  style={{
                    background: statusFilter === 'ready' ? 'rgba(16, 185, 129, 0.1)' : 'hsl(var(--bg-elevated))',
                    border: statusFilter === 'ready' ? '2px solid #10b981' : '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    padding: 14,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{totalReady}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>🟢 100% PRONTOS</div>
                </div>

                <div
                  onClick={() => setStatusFilter('warning')}
                  style={{
                    background: statusFilter === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'hsl(var(--bg-elevated))',
                    border: statusFilter === 'warning' ? '2px solid #f59e0b' : '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    padding: 14,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{totalWarning}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>🟡 COM AVISOS</div>
                </div>

                <div
                  onClick={() => setStatusFilter('error')}
                  style={{
                    background: statusFilter === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'hsl(var(--bg-elevated))',
                    border: statusFilter === 'error' ? '2px solid #ef4444' : '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16,
                    padding: 14,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>{totalError}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>🔴 ERROS BLOQUEANTES</div>
                </div>
              </div>

              {/* Card de Conciliação Visual de Turmas */}
              {unmatchedTurmas.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 16,
                  padding: '16px 20px',
                  marginBottom: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#d97706', fontWeight: 800, fontSize: 14 }}>
                    <AlertTriangle size={18} />
                    Conciliação de Turmas ({unmatchedTurmas.length} turmas da planilha não foram encontradas no sistema)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {unmatchedTurmas.map((tName, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        background: 'hsl(var(--bg-elevated))',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border-subtle))',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Turma na planilha: &quot;{tName}&quot;</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select
                            className="form-input"
                            style={{ fontSize: 12, minWidth: 200 }}
                            value={turmaOverrides[tName] || ''}
                            onChange={(e) => setTurmaOverrides({ ...turmaOverrides, [tName]: e.target.value })}
                          >
                            <option value="">Vincular a uma turma existente...</option>
                            {knownTurmas.map(kt => (
                              <option key={kt.id} value={kt.id}>{kt.nome}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={creatingTurmaName === tName}
                            onClick={() => handleCreateTurma(tName)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {creatingTurmaName === tName ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                            Criar Turma Agora
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configurações Adicionais de Vínculo e Inativação */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
                marginBottom: 20
              }}>
                <div style={{
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Histórico de Turmas</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Como registrar a turma se o aluno já existir?</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setTipoTurmaConfig('acrescentar')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        border: tipoTurmaConfig === 'acrescentar' ? '2px solid #2563eb' : '1px solid hsl(var(--border-subtle))',
                        background: tipoTurmaConfig === 'acrescentar' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                        color: tipoTurmaConfig === 'acrescentar' ? '#2563eb' : 'hsl(var(--text-muted))'
                      }}
                    >
                      Acrescentar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoTurmaConfig('substituir')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        border: tipoTurmaConfig === 'substituir' ? '2px solid #ef4444' : '1px solid hsl(var(--border-subtle))',
                        background: tipoTurmaConfig === 'substituir' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        color: tipoTurmaConfig === 'substituir' ? '#ef4444' : 'hsl(var(--text-muted))'
                      }}
                    >
                      Substituir
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: inativarAusentes ? '#ef4444' : 'inherit' }}>
                      Inativar Alunos Ausentes
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Inativa quem não estiver nesta planilha</div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{
                      position: 'relative',
                      width: 40,
                      height: 22,
                      background: inativarAusentes ? '#ef4444' : 'hsl(var(--border-subtle))',
                      borderRadius: 11,
                      transition: 'all 0.3s'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: 2,
                        left: inativarAusentes ? 20 : 2,
                        width: 18,
                        height: 18,
                        background: '#fff',
                        borderRadius: '50%',
                        transition: 'all 0.3s'
                      }} />
                    </div>
                    <input
                      type="checkbox"
                      checked={inativarAusentes}
                      onChange={(e) => setInativarAusentes(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Grade Interativa com Edição Inline e Alertas Visuais */}
              <div style={{
                maxHeight: 380,
                overflowY: 'auto',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 16,
                background: 'hsl(var(--bg-elevated))'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'hsl(var(--bg-elevated))', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      <th style={{ padding: '10px 12px', width: 60, textAlign: 'center', fontWeight: 800 }}>Linha</th>
                      <th style={{ padding: '10px 12px', width: 100, textAlign: 'center', fontWeight: 800 }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Aluno (Duplo-clique p/ editar)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Nascimento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Turma</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Mãe / Resp. 1</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Pai / Resp. 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, rIdx) => {
                      const isEditingNome = editingCell?.rowIndex === r.rowIndex && editingCell?.field === 'aluno_nome'
                      const isEditingNasc = editingCell?.rowIndex === r.rowIndex && editingCell?.field === 'aluno_data_nascimento'
                      const nomeError = r.issues.find((i: ValidationIssue) => i.field === 'aluno_nome')
                      const nascWarning = r.issues.find((i: ValidationIssue) => i.field === 'aluno_data_nascimento')

                      return (
                        <tr key={rIdx} style={{
                          borderBottom: '1px solid hsl(var(--border-subtle))',
                          background: r.status === 'error' ? 'rgba(239, 68, 68, 0.04)' : r.status === 'warning' ? 'rgba(245, 158, 11, 0.03)' : 'transparent'
                        }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                            {r.rowIndex}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {r.status === 'ready' && <span style={{ color: '#10b981', fontWeight: 800, fontSize: 11 }}>🟢 Pronto</span>}
                            {r.status === 'warning' && <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: 11 }}>🟡 Aviso</span>}
                            {r.status === 'error' && <span style={{ color: '#ef4444', fontWeight: 800, fontSize: 11 }}>🔴 Erro</span>}
                          </td>

                          {/* Nome do Aluno com Edição Direta */}
                          <td
                            onDoubleClick={() => handleStartCellEdit(r.rowIndex, 'aluno_nome', r.data.aluno_nome)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              border: nomeError ? '1px dashed #ef4444' : 'none'
                            }}
                          >
                            {isEditingNome ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSaveCellEdit}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCellEdit()}
                                style={{ width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #2563eb' }}
                              />
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: nomeError ? '#ef4444' : 'inherit' }}>
                                  {r.data.aluno_nome || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>[Nome não preenchido]</span>}
                                </div>
                                {nomeError && <div style={{ fontSize: 10, color: '#ef4444' }}>{nomeError.message}</div>}
                              </div>
                            )}
                          </td>

                          {/* Data de Nascimento com Edição Direta */}
                          <td
                            onDoubleClick={() => handleStartCellEdit(r.rowIndex, 'aluno_data_nascimento', r.data.aluno_data_nascimento)}
                            style={{ padding: '8px 12px', cursor: 'pointer' }}
                          >
                            {isEditingNasc ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSaveCellEdit}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCellEdit()}
                                style={{ width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #2563eb' }}
                              />
                            ) : (
                              <div>
                                <span>{r.data.aluno_data_nascimento || '-'}</span>
                                {nascWarning && <div style={{ fontSize: 10, color: '#f59e0b' }}>{nascWarning.message}</div>}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '8px 12px' }}>
                            {turmaOverrides[r.data.aluno_turma]
                              ? knownTurmas.find(k => k.id === turmaOverrides[r.data.aluno_turma])?.nome
                              : r.data.aluno_turma || '-'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>{r.data.resp1_nome || '-'}</td>
                          <td style={{ padding: '8px 12px' }}>{r.data.resp2_nome || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botões de Ação do Data Studio */}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setActiveStep(1)}>
                  <ArrowLeft size={16} /> Voltar ao Mapeamento
                </button>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleExecuteImport}
                    disabled={totalReady + totalWarning === 0}
                    style={{ padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}
                  >
                    Importar {totalReady + totalWarning} Alunos Válidos <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              PASSO 3: EXECUÇÃO & RELATÓRIO COM ROLLBACK
             ======================================================== */}
          {activeStep === 3 && (
            <div>
              {loading && importProgress && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <Loader2 size={48} color="#2563eb" className="animate-spin" style={{ margin: '0 auto 20px' }} />
                  <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
                    Importando registros no banco de dados...
                  </h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 24 }}>
                    Processando alunos, vinculando responsáveis e conciliando turmas.
                  </p>

                  <div style={{ width: '100%', maxWidth: 450, background: 'hsl(var(--bg-elevated))', height: 12, borderRadius: 6, margin: '0 auto', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, #2563eb, #10b981)',
                      height: '100%',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                    {importProgress.current} de {importProgress.total} registros ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                  </div>
                </div>
              )}

              {!loading && importSummary && (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <div style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#10b981'
                  }}>
                    <Check size={40} />
                  </div>

                  <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                    Importação Concluída com Sucesso!
                  </h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 24 }}>
                    Identificador do Lote: <b>{importSummary.batchId}</b>
                  </p>

                  {/* Estatísticas */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16,
                    maxWidth: 600,
                    margin: '0 auto 28px'
                  }}>
                    <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 16 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>{importSummary.inseridos}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>NOVOS ALUNOS</div>
                    </div>
                    <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 16 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#2563eb' }}>{importSummary.atualizados}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>ATUALIZADOS</div>
                    </div>
                    <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 16 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: importSummary.erros > 0 ? '#ef4444' : 'hsl(var(--text-muted))' }}>
                        {importSummary.erros}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>REJEITADOS / ERROS</div>
                    </div>
                  </div>

                  {/* Ações Especiais de Segurança e Devolução */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {importSummary.erros > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadRejeitados}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                      >
                        <Download size={16} color="#ef4444" /> Baixar Planilha de Rejeitados (.xlsx)
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={revertingBatchId === importSummary.batchId}
                      onClick={() => handleRollback(importSummary.batchId)}
                      className="btn btn-ghost"
                      style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                    >
                      <RotateCcw size={16} /> Desfazer esta Importação (Rollback)
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={onClose}
                      style={{ padding: '10px 24px', fontWeight: 800 }}
                    >
                      Finalizar e Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              PASSO 4: FOTOS DOS ALUNOS
             ======================================================== */}
          {activeStep === 4 && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{
                flex: 1,
                minWidth: 300,
                padding: 32,
                border: '2px dashed #2563eb',
                borderRadius: 20,
                textAlign: 'center',
                background: 'rgba(37, 99, 235, 0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
                  <ImageIcon size={32} color="#2563eb" />
                  <FileArchive size={32} color="#2563eb" />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Importar Fotos em Lote</h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 20 }}>
                  Selecione fotos individuais ou um arquivo <b>.ZIP</b>.<br />
                  O nome de cada arquivo deve ser a <b>Matrícula ou Código</b> do aluno (ex: <code>10001.jpg</code>).
                </p>
                <label className="btn btn-primary" style={{ padding: '12px 28px', cursor: 'pointer' }}>
                  Selecionar Fotos / Arquivo .ZIP
                  <input type="file" multiple accept="image/*,.zip" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
              </div>

              {photos.length > 0 && (
                <div style={{ flex: 1.5, minWidth: 300, background: 'hsl(var(--bg-elevated))', borderRadius: 20, padding: 20, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>Fotos Identificadas ({photos.length})</span>
                    <button className="btn btn-ghost btn-sm text-red-500" onClick={() => setPhotos([])}>
                      <Trash2 size={14} /> Limpar
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: 10, maxHeight: 280, overflowY: 'auto', padding: 4 }}>
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1/1', border: '1px solid hsl(var(--border-subtle))' }}>
                        <img src={p.base64} alt={p.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center' }}>
                          {p.id}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 20, textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={handleImportPhotos} disabled={loading}>
                      {loading ? <Loader2 size={16} className="animate-spin" /> : `Vincular ${photos.length} Fotos aos Alunos`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              PASSO 5: HISTÓRICO DE LOTES & ROLLBACK
             ======================================================== */}
          {activeStep === 5 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Histórico de Importações</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>
                    Veja os lotes importados e reverta qualquer importação acidental com 1 clique.
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveStep(1)}>
                  <ArrowLeft size={14} /> Voltar à Importação
                </button>
              </div>

              {batchesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
                  Nenhum lote de importação registrado até o momento.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {batchesList.map(b => (
                    <div
                      key={b.id}
                      style={{
                        background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-subtle))',
                        borderRadius: 16,
                        padding: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{b.id}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: b.status === 'revertido' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: b.status === 'revertido' ? '#ef4444' : '#10b981'
                          }}>
                            {b.status === 'revertido' ? 'REVERTIDO' : 'CONCLUÍDO'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                          {new Date(b.data).toLocaleString('pt-BR')} • {b.total} alunos • {b.inseridos} novos • {b.atualizados} atualizados
                        </div>
                      </div>

                      {b.status !== 'revertido' && (
                        <button
                          type="button"
                          disabled={revertingBatchId === b.id}
                          onClick={() => handleRollback(b.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {revertingBatchId === b.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          Desfazer Lote
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Inferior */}
        <div style={{
          padding: '16px 28px',
          background: 'hsl(var(--bg-elevated))',
          borderTop: '1px solid hsl(var(--border-subtle))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            Impacto Edu ERP • Módulo de Importação Inteligente
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
