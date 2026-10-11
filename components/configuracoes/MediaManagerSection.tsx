'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Folder, File, Image as ImageIcon, FileText, Video, Trash2, Plus, Search, 
  RefreshCw, AlertTriangle, Download, ExternalLink, HardDrive, 
  Sparkles, FileCode, CheckCircle, Info, ChevronRight, HelpCircle, X,
  Filter, Eye, Trash, Check, Loader2, Music, Copy, Clock,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, CheckSquare, Square,
  Layers, ShieldAlert, Archive
} from 'lucide-react'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'

interface FileReference {
  table: string
  id: string
  label: string
}

interface MediaFile {
  name: string
  path: string
  id: string
  size: number
  mimeType: string
  updatedAt: string
  url: string
  bucket: string
  module: string
  isOrphan: boolean
  references: FileReference[]
}

interface MediaStats {
  totalSize: number
  totalCount: number
  orphansCount: number
  orphansSize: number
  byBucket: Record<string, number>
  byModule: Record<string, number>
  managedBuckets?: string[]
}

interface StorageAutoCleanConfig {
  enabled: boolean
  interval_days: number
  min_age_hours: number
  last_run: string | null
  next_run: string | null
  last_status: 'success' | 'error' | 'skipped' | null
  last_deleted_count: number
  last_size_reclaimed: number
  last_error: string | null
}

type SortField = 'name' | 'size' | 'updatedAt' | 'module' | 'isOrphan'
type SortOrder = 'asc' | 'desc'

export default function MediaManagerSection() {
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [autoCleanConfig, setAutoCleanConfig] = useState<StorageAutoCleanConfig | null>(null)
  const [savingAutoClean, setSavingAutoClean] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'orphan'>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Seleção múltipla para ações em lote
  const [selectedFileUrls, setSelectedFileUrls] = useState<Set<string>>(new Set())
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [deleteDbRecordsBatch, setDeleteDbRecordsBatch] = useState(false)

  // Modais de ações unitárias
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null)
  const [deleteFile, setDeleteFile] = useState<MediaFile | null>(null)
  const [deleteDbRecord, setDeleteDbRecord] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cleaningOrphans, setCleaningOrphans] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  
  // Upload manual de arquivos
  const [uploadBucket, setUploadBucket] = useState('comunicados-midia')
  const [uploadFolder, setUploadFolder] = useState('uploads')
  const [uploadCustomFolder, setUploadCustomFolder] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para link copiado
  const [copiedFileUrl, setCopiedFileUrl] = useState<string | null>(null)

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedFileUrl(url)
      setTimeout(() => setCopiedFileUrl(null), 2000)
    } catch (err) {
      console.error('Falha ao copiar link:', err)
    }
  }

  // Carregar dados da API
  const loadMediaData = async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh ? '/api/configuracoes/midia?refresh=true' : '/api/configuracoes/midia'
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Falha ao obter dados do gerenciador de mídia.')
      }
      const data = await res.json()
      setFiles(data.files || [])
      setStats(data.stats || null)
      if (data.autoCleanConfig) {
        setAutoCleanConfig(data.autoCleanConfig)
      }
      // Limpa seleções expiradas
      setSelectedFileUrls(new Set())
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao carregar mídias.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMediaData()
  }, [])

  // Formatador de tamanho de arquivo
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Filtrar arquivos
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // Filtro de busca textual
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term || 
        file.name.toLowerCase().includes(term) || 
        file.path.toLowerCase().includes(term) ||
        file.references.some(r => r.label.toLowerCase().includes(term) || r.id.toLowerCase().includes(term))
      
      // Filtro de bucket
      const matchesBucket = selectedBucket === 'all' || file.bucket === selectedBucket
      
      // Filtro de módulo
      const matchesModule = selectedModule === 'all' || file.module === selectedModule
      
      // Filtro de status (órfão / vinculado)
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'orphan' && file.isOrphan) || 
                            (statusFilter === 'linked' && !file.isOrphan)
      
      // Filtro de tipo MIME
      let matchesType = true
      if (selectedType !== 'all') {
        const mime = file.mimeType.toLowerCase()
        if (selectedType === 'image') matchesType = mime.startsWith('image/')
        else if (selectedType === 'pdf') matchesType = mime === 'application/pdf'
        else if (selectedType === 'video') matchesType = mime.startsWith('video/')
        else if (selectedType === 'audio') matchesType = mime.startsWith('audio/')
        else if (selectedType === 'doc') {
          matchesType = mime.includes('word') || mime.includes('excel') || mime.includes('sheet') || mime.includes('text') || mime.includes('csv')
        }
        else if (selectedType === 'other') {
          matchesType = !mime.startsWith('image/') && mime !== 'application/pdf' && 
                        !mime.startsWith('video/') && !mime.startsWith('audio/') &&
                        !mime.includes('word') && !mime.includes('excel')
        }
      }

      return matchesSearch && matchesBucket && matchesModule && matchesStatus && matchesType
    })
  }, [files, searchTerm, selectedBucket, selectedModule, statusFilter, selectedType])

  // Ordenação dos arquivos filtrados
  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === 'size') {
        comparison = a.size - b.size
      } else if (sortField === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      } else if (sortField === 'module') {
        comparison = a.module.localeCompare(b.module)
      } else if (sortField === 'isOrphan') {
        comparison = (a.isOrphan === b.isOrphan ? 0 : a.isOrphan ? -1 : 1)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [filteredFiles, sortField, sortOrder])

  // Paginação dos arquivos ordenados
  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / itemsPerPage))
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedFiles.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedFiles, currentPage, itemsPerPage])

  // Resetar página quando filtros ou busca mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedBucket, selectedModule, statusFilter, selectedType, itemsPerPage])

  // Alternar ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  // Gestão de Seleção Múltipla
  const isAllPageSelected = paginatedFiles.length > 0 && paginatedFiles.every(f => selectedFileUrls.has(f.url))

  const handleToggleSelectAllPage = () => {
    const newSelected = new Set(selectedFileUrls)
    if (isAllPageSelected) {
      paginatedFiles.forEach(f => newSelected.delete(f.url))
    } else {
      paginatedFiles.forEach(f => newSelected.add(f.url))
    }
    setSelectedFileUrls(newSelected)
  }

  const handleToggleSelectFile = (url: string) => {
    const newSelected = new Set(selectedFileUrls)
    if (newSelected.has(url)) {
      newSelected.delete(url)
    } else {
      newSelected.add(url)
    }
    setSelectedFileUrls(newSelected)
  }

  const selectedFilesList = useMemo(() => {
    return files.filter(f => selectedFileUrls.has(f.url))
  }, [files, selectedFileUrls])

  const selectedFilesTotalSize = useMemo(() => {
    return selectedFilesList.reduce((acc, f) => acc + f.size, 0)
  }, [selectedFilesList])

  // Tratar upload de arquivo com alta resiliência (URLs assinadas e suporte a arquivos grandes)
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    setUploading(true)
    setUploadProgress('Autorizando upload seguro...')
    setUploadMessage(null)

    try {
      const targetFolder = uploadFolder === 'custom' 
        ? (uploadCustomFolder.trim() || 'uploads') 
        : uploadFolder

      setUploadProgress('Transferindo arquivo...')
      const result = await uploadFileToSupabase({
        bucket: uploadBucket,
        folder: targetFolder,
        file: uploadFile,
        usageType: 'common'
      })

      if (!result.ok) {
        throw new Error(result.error || 'Falha no envio do arquivo.')
      }

      setUploadMessage({
        type: 'success',
        text: `Arquivo "${uploadFile.name}" enviado com sucesso para ${uploadBucket}/${targetFolder}!`
      })
      setUploadFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      // Recarrega os dados imediatamente
      await loadMediaData(true)
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Erro ao realizar upload.'
      })
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  // Tratar exclusão de arquivo unitário
  const handleDelete = async () => {
    if (!deleteFile) return

    setDeleting(true)
    try {
      const res = await fetch('/api/configuracoes/midia', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [deleteFile.url],
          deleteDbRecord
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao deletar arquivo.')
      }

      setDeleteFile(null)
      setDeleteDbRecord(false)
      await loadMediaData(true)
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar arquivo.')
    } finally {
      setDeleting(false)
    }
  }

  // Tratar exclusão em lote de arquivos selecionados
  const handleBatchDelete = async () => {
    if (selectedFileUrls.size === 0) return

    setDeleting(true)
    try {
      const res = await fetch('/api/configuracoes/midia', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: Array.from(selectedFileUrls),
          deleteDbRecord: deleteDbRecordsBatch
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao deletar arquivos selecionados.')
      }

      setShowBatchDeleteModal(false)
      setSelectedFileUrls(new Set())
      setDeleteDbRecordsBatch(false)
      await loadMediaData(true)
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar arquivos em lote.')
    } finally {
      setDeleting(false)
    }
  }

  // Limpeza de arquivos órfãos em lote
  const handleCleanOrphans = async () => {
    setCleaningOrphans(true)
    try {
      const res = await fetch('/api/configuracoes/midia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean-orphans' })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao limpar órfãos.')
      }

      alert(data.message || 'Arquivos órfãos excluídos com sucesso!')
      setShowCleanConfirm(false)
      await loadMediaData(true)
    } catch (err: any) {
      alert(err.message || 'Erro ao limpar arquivos órfãos.')
    } finally {
      setCleaningOrphans(false)
    }
  }

  // Alternar ativação da limpeza automática (a cada 30 dias)
  const handleToggleAutoClean = async () => {
    if (!autoCleanConfig) return
    const newEnabled = !autoCleanConfig.enabled
    setSavingAutoClean(true)
    try {
      const res = await fetch('/api/configuracoes/midia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-auto-clean',
          config: { enabled: newEnabled }
        })
      })
      const data = await res.json()
      if (data.ok && data.config) {
        setAutoCleanConfig(data.config)
      }
    } catch (err: any) {
      alert('Erro ao alterar limpeza automática: ' + (err.message || 'Erro inesperado'))
    } finally {
      setSavingAutoClean(false)
    }
  }

  // Renderizador do ícone de arquivo
  const getFileIcon = (mimeType: string) => {
    const mime = (mimeType || '').toLowerCase()
    if (mime.startsWith('image/')) return <ImageIcon className="text-blue-400" size={18} />
    if (mime === 'application/pdf') return <FileText className="text-red-400" size={18} />
    if (mime.startsWith('video/')) return <Video className="text-purple-400" size={18} />
    if (mime.startsWith('audio/')) return <Music className="text-emerald-400" size={18} />
    if (mime.includes('word') || mime.includes('excel') || mime.includes('sheet') || mime.includes('csv')) {
      return <FileText className="text-amber-400" size={18} />
    }
    return <File className="text-gray-400" size={18} />
  }

  // Rótulos amigáveis de Módulos
  const getModuleBadge = (module: string) => {
    switch (module) {
      case 'agenda_digital': 
        return { label: '💬 Agenda', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }
      case 'gestao_pessoas': 
        return { label: '👤 Pessoas / RH', bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }
      case 'simulados_provas': 
        return { label: '🎓 Provas & Simulados', bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }
      case 'gestao_escolar': 
        return { label: '🏫 Escolar / Contratos', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }
      case 'financeiro':
        return { label: '💰 Financeiro', bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }
      default: 
        return { label: '📁 Geral', bg: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))' }
    }
  }

  // Render do Preview de Arquivos no Modal
  const renderPreviewContent = (file: MediaFile) => {
    const mime = (file.mimeType || '').toLowerCase()
    if (mime.startsWith('image/')) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', background: '#090d16', borderRadius: 8, padding: 12, overflow: 'hidden' }}>
          <img src={file.url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 4 }} />
        </div>
      )
    }
    if (mime === 'application/pdf') {
      return (
        <div style={{ width: '100%', height: '440px', borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
          <iframe src={`${file.url}#toolbar=0`} width="100%" height="100%" style={{ border: 'none' }} title={file.name} />
        </div>
      )
    }
    if (mime.startsWith('video/')) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', background: '#090d16', borderRadius: 8, padding: 12 }}>
          <video src={file.url} controls style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: 4 }} />
        </div>
      )
    }
    if (mime.startsWith('audio/')) {
      return (
        <div style={{ padding: '36px 20px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Music size={28} />
          </div>
          <audio src={file.url} controls style={{ width: '100%', maxWidth: 460 }} />
        </div>
      )
    }
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
        <File size={48} color="hsl(var(--text-muted))" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Visualização Integrada Não Disponível</div>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
          Arquivos deste formato ({file.mimeType}) podem ser transferidos e inspecionados em seu leitor local.
        </p>
        <a href={file.url} target="_blank" rel="noreferrer" download={file.name} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Download size={13} /> Baixar Arquivo
        </a>
      </div>
    )
  }

  // Lista de buckets dinâmicos ou padrão
  const availableBuckets = stats?.managedBuckets || ['comunicados-midia', 'documentos', 'simulados-arquivos', 'credimpacto']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* ─── DASHBOARD DE ESTATÍSTICAS ───────────────────────────────── */}
      {!loading && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          
          <div className="card" style={{ padding: '20px', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <HardDrive size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Espaço Total Usado</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{formatSize(stats.totalSize)}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{stats.totalCount} arquivos no storage</div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', gap: 16, alignItems: 'center', border: stats.orphansCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid hsl(var(--border))' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: stats.orphansCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stats.orphansCount > 0 ? '#ef4444' : '#10b981' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Arquivos Órfãos</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: stats.orphansCount > 0 ? '#f87171' : 'inherit' }}>{stats.orphansCount}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>Ocupando {formatSize(stats.orphansSize)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Taxa de Utilização</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                {stats.totalCount > 0 ? (((stats.totalCount - stats.orphansCount) / stats.totalCount) * 100).toFixed(1) : '100.0'}%
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{stats.totalCount - stats.orphansCount} vinculados</div>
            </div>
          </div>

        </div>
      )}

      {/* ─── BARRA DE FILTROS & AÇÕES ───────────────────────────────── */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          
          {/* Caixa de Busca */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              className="form-input" 
              placeholder="Buscar por nome do arquivo, caminho ou registro..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Filtro de Status */}
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ width: 140 }}>
            <option value="all">🔍 Todos Status</option>
            <option value="linked">✓ Vinculados</option>
            <option value="orphan">⚠️ Órfãos</option>
          </select>

          {/* Filtro de Bucket */}
          <select className="form-input" value={selectedBucket} onChange={e => setSelectedBucket(e.target.value)} style={{ width: 160 }}>
            <option value="all">📦 Todos Buckets</option>
            {availableBuckets.map(b => (
              <option key={b} value={b}>
                {b} {stats?.byBucket?.[b] !== undefined ? `(${stats.byBucket[b]})` : ''}
              </option>
            ))}
          </select>

          {/* Filtro de Módulo */}
          <select className="form-input" value={selectedModule} onChange={e => setSelectedModule(e.target.value)} style={{ width: 170 }}>
            <option value="all">🧩 Todos Módulos</option>
            <option value="agenda_digital">💬 Agenda Digital</option>
            <option value="gestao_pessoas">👤 Gestão de Pessoas</option>
            <option value="simulados_provas">🎓 Simulados e Provas</option>
            <option value="gestao_escolar">🏫 Gestão Escolar</option>
            <option value="financeiro">💰 Financeiro</option>
            <option value="outros">📁 Outros / Geral</option>
          </select>

          {/* Filtro de Tipo */}
          <select className="form-input" value={selectedType} onChange={e => setSelectedType(e.target.value)} style={{ width: 135 }}>
            <option value="all">🏷️ Todos Tipos</option>
            <option value="image">🖼️ Imagens</option>
            <option value="pdf">📄 PDFs</option>
            <option value="video">🎥 Vídeos</option>
            <option value="audio">🎵 Áudios</option>
            <option value="doc">📑 Documentos</option>
            <option value="other">⚙️ Outros</option>
          </select>

          {/* Botão de Atualizar */}
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => loadMediaData(true)} 
            title="Atualizar dados do storage e do banco"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Limpar órfãos */}
          {stats && stats.orphansCount > 0 && (
            <button 
              className="btn btn-danger" 
              onClick={() => setShowCleanConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              <Trash size={14} /> Limpar Órfãos ({stats.orphansCount})
            </button>
          )}

        </div>

        {/* Barra flutuante de ações em lote caso haja itens selecionados */}
        {selectedFileUrls.size > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '10px 14px', 
            background: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.25)', 
            borderRadius: 8,
            fontSize: 13
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: '#3b82f6' }}>
                {selectedFileUrls.size} arquivo(s) selecionado(s)
              </span>
              <span style={{ color: 'hsl(var(--text-muted))' }}>
                (Total: {formatSize(selectedFilesTotalSize)})
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={() => setSelectedFileUrls(new Set())}
                style={{ fontSize: 12 }}
              >
                Desmarcar todos
              </button>
              <button 
                type="button" 
                className="btn btn-danger btn-sm" 
                onClick={() => setShowBatchDeleteModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Trash2 size={13} /> Excluir Selecionados ({selectedFileUrls.size})
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ─── CORPO PRINCIPAL: LISTAGEM & PAINEL LATERAL ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        
        {/* Lado Esquerdo: Lista de arquivos */}
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Arquivos no Storage ({filteredFiles.length})</span>
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                • Exibindo {formatSize(filteredFiles.reduce((acc, curr) => acc + curr.size, 0))}
              </span>
            </div>

            {/* Seletor de itens por página */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <span>Linhas por página:</span>
              <select 
                className="form-input" 
                value={itemsPerPage} 
                onChange={e => setItemsPerPage(Number(e.target.value))}
                style={{ padding: '2px 8px', fontSize: 12, height: 28 }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 className="animate-spin text-primary" size={32} color="#3b82f6" />
              <span style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>Escaneando buckets e cruzando vínculos com o banco de dados...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#f87171' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
              <div>{error}</div>
              <button className="btn btn-secondary btn-sm" onClick={() => loadMediaData(true)} style={{ marginTop: 16 }}>Tentar Novamente</button>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Folder size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>Nenhum arquivo encontrado</div>
              <p style={{ fontSize: 12, marginTop: 4 }}>Ajuste seus filtros ou envie um arquivo para começar.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border))' }}>
                      {/* Checkbox de seleção da página */}
                      <th style={{ width: 40, padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={handleToggleSelectAllPage}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: isAllPageSelected ? '#3b82f6' : 'hsl(var(--text-muted))' }}
                          title={isAllPageSelected ? 'Desmarcar página atual' : 'Selecionar todos da página'}
                        >
                          {isAllPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>

                      {/* Arquivo / Caminho com ordenação */}
                      <th 
                        style={{ padding: '12px 14px', fontWeight: 600, color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
                        onClick={() => handleSort('name')}
                        title="Clique para ordenar por nome"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>Arquivo / Caminho</span>
                          {sortField === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#3b82f6" />
                          ) : <ArrowUpDown size={12} opacity={0.4} />}
                        </div>
                      </th>

                      {/* Bucket */}
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Bucket</th>

                      {/* Módulo com ordenação */}
                      <th 
                        style={{ padding: '12px 14px', fontWeight: 600, color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
                        onClick={() => handleSort('module')}
                        title="Clique para ordenar por módulo"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>Módulo</span>
                          {sortField === 'module' ? (
                            sortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#3b82f6" />
                          ) : <ArrowUpDown size={12} opacity={0.4} />}
                        </div>
                      </th>

                      {/* Tamanho com ordenação */}
                      <th 
                        style={{ padding: '12px 14px', fontWeight: 600, color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
                        onClick={() => handleSort('size')}
                        title="Clique para ordenar por tamanho"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>Tamanho</span>
                          {sortField === 'size' ? (
                            sortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#3b82f6" />
                          ) : <ArrowUpDown size={12} opacity={0.4} />}
                        </div>
                      </th>

                      {/* Status / Vínculos com ordenação */}
                      <th 
                        style={{ padding: '12px 14px', fontWeight: 600, color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
                        onClick={() => handleSort('isOrphan')}
                        title="Clique para ordenar por status"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>Status / Vínculos</span>
                          {sortField === 'isOrphan' ? (
                            sortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#3b82f6" />
                          ) : <ArrowUpDown size={12} opacity={0.4} />}
                        </div>
                      </th>

                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFiles.map((file, idx) => {
                      const isSelected = selectedFileUrls.has(file.url)
                      const badge = getModuleBadge(file.module)

                      return (
                        <tr 
                          key={file.url || idx} 
                          style={{ 
                            borderBottom: '1px solid hsl(var(--border))', 
                            transition: 'background 0.2s',
                            background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                          }} 
                          className="hover:bg-[hsl(var(--bg-elevated))]"
                        >
                          {/* Checkbox de seleção */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectFile(file.url)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: isSelected ? '#3b82f6' : 'hsl(var(--text-muted))' }}
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          </td>

                          {/* Arquivo / Caminho */}
                          <td style={{ padding: '12px 14px', maxWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flexShrink: 0 }}>
                                {getFileIcon(file.mimeType)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                  {file.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }} title={file.path}>
                                  {file.path}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Bucket */}
                          <td style={{ padding: '12px 14px', color: 'hsl(var(--text-muted))', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {file.bucket}
                          </td>

                          {/* Módulo */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
                          </td>

                          {/* Tamanho */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {formatSize(file.size)}
                          </td>

                          {/* Status / Vínculos */}
                          <td style={{ padding: '12px 14px' }}>
                            {file.isOrphan ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 100 }}>
                                <AlertTriangle size={10} /> Órfão
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '2px 8px', borderRadius: 100, width: 'fit-content' }}>
                                  <CheckCircle size={10} /> Vinculado
                                </span>
                                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', marginTop: 1 }}>
                                  {file.references.slice(0, 2).map((ref, rIdx) => (
                                    <span key={rIdx} title={`${ref.table} ID: ${ref.id}`}>
                                      • {ref.label}
                                    </span>
                                  ))}
                                  {file.references.length > 2 && (
                                    <span style={{ fontWeight: 600 }}>+ {file.references.length - 2} mais...</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Ações */}
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPreviewFile(file)} title="Visualizar Mídia">
                                <Eye size={14} />
                              </button>
                              <button 
                                className="btn btn-ghost btn-icon btn-sm" 
                                onClick={() => handleCopyLink(file.url)} 
                                title="Copiar URL pública"
                                style={{ color: copiedFileUrl === file.url ? '#34d399' : 'inherit' }}
                              >
                                {copiedFileUrl === file.url ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                              <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon btn-sm" title="Abrir URL em nova aba">
                                <ExternalLink size={14} />
                              </a>
                              <button 
                                className="btn btn-ghost btn-icon btn-sm text-red-400 hover:bg-red-500/10" 
                                onClick={() => setDeleteFile(file)} 
                                title="Excluir Mídia"
                                style={{ color: '#f87171' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Controles de Paginação */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  Exibindo {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, sortedFiles.length)} de {sortedFiles.length} arquivos
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  <span style={{ fontSize: 12, padding: '0 8px', fontWeight: 600 }}>
                    Página {currentPage} de {totalPages}
                  </span>

                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Lado Direito: Formulário de Upload & Painel do Robô */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Card de Upload */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} color="#3b82f6" /> Fazer Upload de Mídia
            </div>
            
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              <div>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Bucket de Destino</label>
                <select className="form-input" value={uploadBucket} onChange={e => setUploadBucket(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                  <option value="comunicados-midia">comunicados-midia (Geral & Fotos)</option>
                  <option value="documentos">documentos (Contratos & RH)</option>
                  <option value="simulados-arquivos">simulados-arquivos (Simulados)</option>
                  <option value="credimpacto">credimpacto (Comprovantes)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Pasta de Destino</label>
                <select 
                  className="form-input" 
                  value={uploadFolder} 
                  onChange={e => setUploadFolder(e.target.value)} 
                  style={{ width: '100%', fontSize: 12, marginBottom: uploadFolder === 'custom' ? 6 : 0 }}
                >
                  <option value="uploads">uploads (Padrão)</option>
                  <option value="avatars">avatars (Fotos de perfil)</option>
                  <option value="timbrados">timbrados (Modelos de papel)</option>
                  <option value="contratos">contratos (Matrículas)</option>
                  <option value="custom">✏️ Outra pasta personalizada...</option>
                </select>

                {uploadFolder === 'custom' && (
                  <input 
                    className="form-input"
                    value={uploadCustomFolder}
                    onChange={e => setUploadCustomFolder(e.target.value)}
                    placeholder="Nome da pasta (ex: projetos)"
                    style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }}
                  />
                )}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Arquivo</label>
                <input 
                  ref={fileInputRef}
                  id="media-upload-input"
                  type="file" 
                  className="form-input" 
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', fontSize: 12, padding: 6 }}
                  required
                />
              </div>

              {uploadProgress && (
                <div style={{ fontSize: 11, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 className="animate-spin" size={12} /> {uploadProgress}
                </div>
              )}

              {uploadMessage && (
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  background: uploadMessage.type === 'success' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: uploadMessage.type === 'success' ? '#34d399' : '#f87171',
                  border: uploadMessage.type === 'success' ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  {uploadMessage.text}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={uploading || !uploadFile}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38 }}
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Enviando...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Enviar Arquivo
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Card: Robô de Limpeza Automática a cada 30 dias */}
          <div 
            className="card" 
            style={{ 
              padding: '20px', 
              background: autoCleanConfig?.enabled 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)' 
                : 'hsl(var(--bg-card))',
              border: autoCleanConfig?.enabled 
                ? '1px solid rgba(16, 185, 129, 0.25)' 
                : '1px solid hsl(var(--border))',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  background: autoCleanConfig?.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                  color: autoCleanConfig?.enabled ? '#10b981' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Limpeza a Cada 30 Dias</div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Expurgo automático de órfãos</div>
                </div>
              </div>

              {/* Botão de Toggle */}
              <button
                type="button"
                onClick={handleToggleAutoClean}
                disabled={savingAutoClean || !autoCleanConfig}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: autoCleanConfig?.enabled ? '#10b981' : 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  cursor: savingAutoClean ? 'wait' : 'pointer',
                  transition: 'background 0.2s',
                  padding: 2,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title={autoCleanConfig?.enabled ? 'Clique para pausar a limpeza automática' : 'Clique para ativar a limpeza automática'}
              >
                <span style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: autoCleanConfig?.enabled ? 'translateX(20px)' : 'translateX(0px)',
                  transition: 'transform 0.2s ease-in-out'
                }} />
              </button>
            </div>

            {/* Status e Detalhes */}
            <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>Status do Robô:</span>
                <span style={{ 
                  fontWeight: 700, 
                  color: autoCleanConfig?.enabled ? '#10b981' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: '50%', 
                    background: autoCleanConfig?.enabled ? '#10b981' : '#94a3b8',
                    display: 'inline-block' 
                  }} />
                  {autoCleanConfig?.enabled ? 'Ativo (Ciclo de 30 dias)' : 'Pausado'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>Frequência:</span>
                <span style={{ fontWeight: 600 }}>A cada 30 dias</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>Próxima Faxina:</span>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                  {autoCleanConfig?.next_run 
                    ? new Date(autoCleanConfig.next_run).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Agendada no cron diário'}
                </span>
              </div>

              {autoCleanConfig?.last_run && (
                <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--text-muted))' }}>Última execução:</span>
                    <span style={{ fontWeight: 600 }}>
                      {new Date(autoCleanConfig.last_run).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  {autoCleanConfig.last_deleted_count > 0 && (
                    <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                      Liberados {autoCleanConfig.last_deleted_count} arquivos ({formatSize(autoCleanConfig.last_size_reclaimed)})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Ação manual imediata se houver órfãos */}
            {stats && stats.orphansCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCleanConfirm(true)}
                disabled={cleaningOrphans}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '8px 12px'
                }}
              >
                <Trash size={13} color="#ef4444" />
                {cleaningOrphans ? 'Executando Limpeza...' : `Executar Limpeza Agora (${stats.orphansCount})`}
              </button>
            )}

            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>
              🛡️ <em>Arquivos criados nas últimas 24h são preservados para resguardar uploads em andamento.</em>
            </div>
          </div>

          {/* Diagnóstico de Storage */}
          <div className="card" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#60a5fa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} /> Diagnóstico de Storage
            </div>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              O Supabase Storage acumula arquivos antigos caso as entidades do banco sejam removidas sem a exclusão manual do arquivo físico correspondente.
            </p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />
            <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>
              Filtre por <strong>⚠️ Órfãos</strong> para identificar arquivos residuais e execute a faxina sob demanda com segurança garantida.
            </p>
          </div>

        </div>

      </div>

      {/* ─── MODAL DE PREVIEW / DETALHES ─────────────────────────────── */}
      {previewFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <button 
              className="btn btn-ghost btn-icon btn-sm" 
              onClick={() => setPreviewFile(null)}
              style={{ position: 'absolute', right: 16, top: 16 }}
            >
              <X size={16} />
            </button>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 32 }}>
                {previewFile.name}
              </h3>
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontFamily: 'monospace', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {previewFile.bucket}/{previewFile.path}
              </p>
            </div>

            {/* Preview visual */}
            {renderPreviewContent(previewFile)}

            {/* Metadados detalhados */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'hsl(var(--bg-elevated))', padding: 14, borderRadius: 8, fontSize: 12 }}>
              <div>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block' }}>Tamanho:</span>
                <span style={{ fontWeight: 600 }}>{formatSize(previewFile.size)} ({previewFile.size.toLocaleString('pt-BR')} bytes)</span>
              </div>
              <div>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block' }}>Tipo MIME:</span>
                <span style={{ fontWeight: 600 }}>{previewFile.mimeType}</span>
              </div>
              <div>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block' }}>Bucket:</span>
                <span style={{ fontWeight: 600 }}>{previewFile.bucket}</span>
              </div>
              <div>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block' }}>Última Modificação:</span>
                <span style={{ fontWeight: 600 }}>{new Date(previewFile.updatedAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Vínculos */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Vínculos no Banco de Dados:</div>
              {previewFile.references.length === 0 ? (
                <div style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Este arquivo é órfão e não possui nenhum registro ativo associado no banco de dados.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {previewFile.references.map((ref, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 6, fontSize: 12 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{ref.label}</span>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1, fontFamily: 'monospace' }}>
                          Tabela: {ref.table} | ID: {ref.id}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 4, fontWeight: 600 }}>
                        {ref.table}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações inferiores */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewFile(null)}>Fechar</button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleCopyLink(previewFile.url)} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: copiedFileUrl === previewFile.url ? '#34d399' : 'inherit' }}
              >
                {copiedFileUrl === previewFile.url ? (
                  <>
                    <Check size={13} /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copiar Link
                  </>
                )}
              </button>
              <a href={previewFile.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={13} /> Abrir em Nova Aba
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO UNITÁRIA ───────────────── */}
      {deleteFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
              <AlertTriangle size={24} /> Confirmar Exclusão de Arquivo
            </div>

            <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              Tem certeza que deseja excluir o arquivo <strong>{deleteFile.name}</strong> permanentemente do storage? Esta ação não pode ser desfeita.
            </p>

            {/* Se o arquivo tiver vínculos, avisar sobre eles */}
            {deleteFile.references.length > 0 && (
              <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> ATENÇÃO: Arquivo Vinculado!
                </div>
                <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  Este arquivo está associado aos seguintes registros no banco de dados:
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  {deleteFile.references.map((ref, idx) => (
                    <li key={idx}><strong>{ref.label}</strong> (ID: {ref.id})</li>
                  ))}
                </ul>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input 
                    type="checkbox" 
                    id="delete-db-record-chk" 
                    checked={deleteDbRecord}
                    onChange={e => setDeleteDbRecord(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="delete-db-record-chk" style={{ fontSize: 11, color: '#f87171', fontWeight: 600, cursor: 'pointer' }}>
                    Limpar referências vinculadas no banco de dados também
                  </label>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setDeleteFile(null); setDeleteDbRecord(false); }} disabled={deleting}>
                Cancelar
              </button>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
              >
                {deleting ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO EM LOTE ─────────────────── */}
      {showBatchDeleteModal && selectedFileUrls.size > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
              <AlertTriangle size={24} /> Excluir {selectedFileUrls.size} Arquivos Selecionados
            </div>

            <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              Você selecionou <strong>{selectedFileUrls.size} arquivos</strong> ({formatSize(selectedFilesTotalSize)}) para remoção permanente do storage.
            </p>

            <div style={{ maxHeight: 150, overflowY: 'auto', background: 'hsl(var(--bg-elevated))', padding: 10, borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}>
              {selectedFilesList.map((f, i) => (
                <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                  • {f.bucket}/{f.path} ({formatSize(f.size)}) {f.isOrphan ? '⚠️' : '✓'}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input 
                type="checkbox" 
                id="delete-batch-db-record-chk" 
                checked={deleteDbRecordsBatch}
                onChange={e => setDeleteDbRecordsBatch(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="delete-batch-db-record-chk" style={{ fontSize: 11, color: '#f87171', fontWeight: 600, cursor: 'pointer' }}>
                Limpar referências dos registros vinculados no banco de dados também
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBatchDeleteModal(false)} disabled={deleting}>
                Cancelar
              </button>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleBatchDelete}
                disabled={deleting}
                style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
              >
                {deleting ? 'Excluindo...' : 'Confirmar Exclusão em Lote'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE LIMPEZA DE ÓRFÃOS ──────────────── */}
      {showCleanConfirm && stats && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
              <AlertTriangle size={24} /> Limpeza em Lote de Arquivos Órfãos
            </div>

            <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              Você está prestes a excluir permanentemente <strong>{stats.orphansCount} arquivos órfãos</strong> do armazenamento. 
              Estes arquivos não possuem nenhuma referência correspondente nas tabelas do banco de dados e são considerados resíduos.
            </p>

            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', display: 'flex', justifyContent: 'space-between' }}>
                <span>Quantidade a deletar:</span>
                <span style={{ fontWeight: 700 }}>{stats.orphansCount} arquivos</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Espaço a ser liberado:</span>
                <span style={{ fontWeight: 700 }}>{formatSize(stats.orphansSize)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCleanConfirm(false)} disabled={cleaningOrphans}>
                Cancelar
              </button>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleCleanOrphans}
                disabled={cleaningOrphans}
                style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
              >
                {cleaningOrphans ? 'Limpando...' : 'Confirmar Limpeza em Lote'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
