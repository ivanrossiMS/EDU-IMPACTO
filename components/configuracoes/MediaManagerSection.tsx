'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Folder, File, Image, FileText, Video, Trash2, Plus, Search, 
  RefreshCw, AlertTriangle, Download, ExternalLink, HardDrive, 
  Sparkles, FileCode, CheckCircle, Info, ChevronRight, HelpCircle, X,
  Filter, Eye, Trash, Check, Loader2, Music, Copy
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
}

export default function MediaManagerSection() {
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'orphan'>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  
  // Estado de modais e ações
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null)
  const [deleteFile, setDeleteFile] = useState<MediaFile | null>(null)
  const [deleteDbRecord, setDeleteDbRecord] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cleaningOrphans, setCleaningOrphans] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  
  // Upload manual de arquivos
  const [uploadBucket, setUploadBucket] = useState('comunicados-midia')
  const [uploadFolder, setUploadFolder] = useState('uploads')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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

  // Carregar dados
  const loadMediaData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/configuracoes/midia')
      if (!res.ok) {
        throw new Error('Falha ao obter dados do gerenciador de mídia.')
      }
      const data = await res.json()
      setFiles(data.files || [])
      setStats(data.stats || null)
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
      // Filtro de busca
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            file.path.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Filtro de bucket
      const matchesBucket = selectedBucket === 'all' || file.bucket === selectedBucket
      
      // Filtro de módulo
      const matchesModule = selectedModule === 'all' || file.module === selectedModule
      
      // Filtro de status (órfão / vinculado)
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'orphan' && file.isOrphan) || 
                            (statusFilter === 'linked' && !file.isOrphan)
      
      // Filtro de tipo
      let matchesType = true
      if (selectedType !== 'all') {
        const mime = file.mimeType.toLowerCase()
        if (selectedType === 'image') matchesType = mime.startsWith('image/')
        else if (selectedType === 'pdf') matchesType = mime === 'application/pdf'
        else if (selectedType === 'video') matchesType = mime.startsWith('video/')
        else if (selectedType === 'audio') matchesType = mime.startsWith('audio/')
        else if (selectedType === 'other') {
          matchesType = !mime.startsWith('image/') && mime !== 'application/pdf' && 
                        !mime.startsWith('video/') && !mime.startsWith('audio/')
        }
      }

      return matchesSearch && matchesBucket && matchesModule && matchesStatus && matchesType
    })
  }, [files, searchTerm, selectedBucket, selectedModule, statusFilter, selectedType])

  // Tratar upload de arquivo
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    setUploading(true)
    setUploadMessage(null)

    try {
      // Usar a rota centralizada de upload
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('bucket', uploadBucket)
      
      const res = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar arquivo.')
      }

      setUploadMessage({
        type: 'success',
        text: `Arquivo "${uploadFile.name}" enviado com sucesso para ${uploadBucket}!`
      })
      setUploadFile(null)
      // Resetar input
      const fileInput = document.getElementById('media-upload-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      // Recarregar os dados
      loadMediaData()
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Erro ao realizar upload.'
      })
    } finally {
      setUploading(false)
    }
  }

  // Tratar exclusão de arquivo
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
      loadMediaData()
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar arquivo.')
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
      loadMediaData()
    } catch (err: any) {
      alert(err.message || 'Erro ao limpar arquivos órfãos.')
    } finally {
      setCleaningOrphans(false)
    }
  }

  // Renderizador do ícone de arquivo
  const getFileIcon = (mimeType: string) => {
    const mime = mimeType.toLowerCase()
    if (mime.startsWith('image/')) return <Image className="text-blue-400" size={18} />
    if (mime === 'application/pdf') return <FileText className="text-red-400" size={18} />
    if (mime.startsWith('video/')) return <Video className="text-purple-400" size={18} />
    if (mime.startsWith('audio/')) return <Music className="text-green-400" size={18} />
    return <File className="text-gray-400" size={18} />
  }

  // Tradução do módulo
  const getModuleLabel = (module: string) => {
    switch (module) {
      case 'agenda_digital': return '💬 Agenda Digital'
      case 'gestao_pessoas': return '👤 Gestão de Pessoas'
      case 'simulados_provas': return '🎓 Simulados e Provas'
      case 'gestao_escolar': return '🏫 Gestão Escolar'
      default: return '📁 Outros / Geral'
    }
  }

  // Render do Preview de Arquivos no Modal
  const renderPreviewContent = (file: MediaFile) => {
    const mime = file.mimeType.toLowerCase()
    if (mime.startsWith('image/')) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 8, padding: 8, overflow: 'hidden' }}>
          <img src={file.url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain' }} />
        </div>
      )
    }
    if (mime === 'application/pdf') {
      return (
        <div style={{ width: '100%', height: '450px', borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
          <iframe src={`${file.url}#toolbar=0`} width="100%" height="100%" style={{ border: 'none' }} />
        </div>
      )
    }
    if (mime.startsWith('video/')) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 8, padding: 8 }}>
          <video src={file.url} controls style={{ maxWidth: '100%', maxHeight: '450px' }} />
        </div>
      )
    }
    if (mime.startsWith('audio/')) {
      return (
        <div style={{ padding: '40px 20px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
          <audio src={file.url} controls style={{ width: '100%' }} />
        </div>
      )
    }
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
        <File size={48} color="hsl(var(--text-muted))" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Visualização não disponível</div>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
          Este arquivo não pode ser visualizado diretamente no navegador.
        </p>
        <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Download size={13} /> Baixar Arquivo
        </a>
      </div>
    )
  }

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
                {stats.totalCount > 0 ? (((stats.totalCount - stats.orphansCount) / stats.totalCount) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{stats.totalCount - stats.orphansCount} vinculados</div>
            </div>
          </div>

        </div>
      )}

      {/* ─── BARRA DE FILTROS ───────────────────────────────────────── */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Controles superiores */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          
          {/* Caixa de Busca */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              className="form-input" 
              placeholder="Buscar por nome do arquivo ou caminho..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Filtro de Status */}
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ width: 150 }}>
            <option value="all">🔍 Todos Status</option>
            <option value="linked">✓ Vinculados</option>
            <option value="orphan">⚠️ Órfãos</option>
          </select>

          {/* Filtro de Bucket */}
          <select className="form-input" value={selectedBucket} onChange={e => setSelectedBucket(e.target.value)} style={{ width: 170 }}>
            <option value="all">📦 Todos Buckets</option>
            <option value="comunicados-midia">comunicados-midia</option>
            <option value="fotos-perfil">fotos-perfil</option>
            <option value="documentos">documentos</option>
          </select>

          {/* Filtro de Módulo */}
          <select className="form-input" value={selectedModule} onChange={e => setSelectedModule(e.target.value)} style={{ width: 180 }}>
            <option value="all">🧩 Todos Módulos</option>
            <option value="agenda_digital">💬 Agenda Digital</option>
            <option value="gestao_pessoas">👤 Gestão de Pessoas</option>
            <option value="simulados_provas">🎓 Simulados e Provas</option>
            <option value="gestao_escolar">🏫 Gestão Escolar</option>
            <option value="outros">📁 Outros / Geral</option>
          </select>

          {/* Filtro de Tipo */}
          <select className="form-input" value={selectedType} onChange={e => setSelectedType(e.target.value)} style={{ width: 140 }}>
            <option value="all">🏷️ Todos Tipos</option>
            <option value="image">🖼️ Imagens</option>
            <option value="pdf">📄 PDFs</option>
            <option value="video">🎥 Vídeos</option>
            <option value="audio">🎵 Áudios</option>
            <option value="other">⚙️ Outros</option>
          </select>

          {/* Ações */}
          <button className="btn btn-secondary btn-icon" onClick={loadMediaData} title="Atualizar dados">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {stats && stats.orphansCount > 0 && (
            <button 
              className="btn btn-danger" 
              onClick={() => setShowCleanConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer' }}
            >
              <Trash size={14} /> Limpar Órfãos ({stats.orphansCount})
            </button>
          )}

        </div>
      </div>

      {/* ─── CORPO PRINCIPAL: UPLOAD & LISTAGEM ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        
        {/* Lado Esquerdo: Lista de arquivos */}
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Arquivos no Storage ({filteredFiles.length})</span>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Exibindo {formatSize(filteredFiles.reduce((acc, curr) => acc + curr.size, 0))}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 className="animate-spin text-primary" size={32} color="#3b82f6" />
              <span style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>Escaneando buckets e cruzando dados de referência...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#f87171' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
              <div>{error}</div>
              <button className="btn btn-secondary btn-sm" onClick={loadMediaData} style={{ marginTop: 16 }}>Tentar Novamente</button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Folder size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>Nenhum arquivo encontrado</div>
              <p style={{ fontSize: 12, marginTop: 4 }}>Ajuste seus filtros ou faça upload de um arquivo para começar.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Arquivo / Caminho</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Bucket</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Módulo</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Tamanho</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Status / Vínculos</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border))', transition: 'background 0.2s' }} className="hover:bg-[hsl(var(--bg-elevated))]">
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
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
                      <td style={{ padding: '12px 16px', color: 'hsl(var(--text-muted))', fontSize: 12 }}>
                        {file.bucket}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-secondary))' }}>
                          {file.module === 'agenda_digital' ? '💬 Agenda' : 
                           file.module === 'gestao_pessoas' ? '👤 Pessoas' : 
                           file.module === 'simulados_provas' ? '🎓 Provas' : 
                           file.module === 'gestao_escolar' ? '🏫 Escolar' : '📁 Geral'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {formatSize(file.size)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {file.isOrphan ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 100 }}>
                            <AlertTriangle size={10} /> Órfão
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '2px 6px', borderRadius: 100, width: 'fit-content' }}>
                              <CheckCircle size={10} /> Vinculado
                            </span>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column' }}>
                              {file.references.slice(0, 2).map((ref, rIdx) => (
                                <span key={rIdx} title={`${ref.table} ID: ${ref.id}`}>
                                  • {ref.label}
                                </span>
                              ))}
                              {file.references.length > 2 && (
                                <span>+ {file.references.length - 2} mais...</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPreviewFile(file)} title="Visualizar">
                            <Eye size={14} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm" 
                            onClick={() => handleCopyLink(file.url)} 
                            title="Copiar Link"
                            style={{ color: copiedFileUrl === file.url ? '#34d399' : 'inherit' }}
                          >
                            {copiedFileUrl === file.url ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon btn-sm" title="Abrir URL pública">
                            <ExternalLink size={14} />
                          </a>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm text-red-400 hover:bg-red-500/10" 
                            onClick={() => setDeleteFile(file)} 
                            title="Excluir"
                            style={{ color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Lado Direito: Formulário de Upload & Info */}
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
                  <option value="comunicados-midia">comunicados-midia (Geral)</option>
                  <option value="fotos-perfil">fotos-perfil (Avatares)</option>
                  <option value="documentos">documentos (RH / Documentos)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Pasta Relativa</label>
                <input 
                  className="form-input" 
                  value={uploadFolder} 
                  onChange={e => setUploadFolder(e.target.value)} 
                  placeholder="ex: uploads ou contratos"
                  style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }}
                  disabled
                  title="Uploads administrativos são roteados para a pasta padrão do bucket por motivos de segurança."
                />
                <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'block' }}>
                  A pasta padrão é definida automaticamente conforme as regras da API.
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Arquivo</label>
                <input 
                  id="media-upload-input"
                  type="file" 
                  className="form-input" 
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', fontSize: 12, padding: 6 }}
                  required
                />
              </div>

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

          {/* Dica do Desenvolvedor / Diagnóstico */}
          <div className="card" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#60a5fa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} /> Diagnóstico de Storage
            </div>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              O Supabase Storage acumula arquivos antigos caso as entidades do banco sejam removidas sem a exclusão manual do arquivo físico.
            </p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />
            <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>
              Filtre por <strong>⚠️ Órfãos</strong> para identificar arquivos redundantes e clique no botão de limpeza rápida para liberar espaço em disco instantaneamente.
            </p>
          </div>

        </div>

      </div>

      {/* ─── MODAL DE PREVIEW / DETALHES ─────────────────────────────── */}
      {previewFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
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
                <span style={{ fontWeight: 600 }}>{formatSize(previewFile.size)} ({previewFile.size} bytes)</span>
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
                <span style={{ fontWeight: 600 }}>{new Date(previewFile.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Vínculos */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Vínculos no Banco de Dados:</div>
              {previewFile.references.length === 0 ? (
                <div style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Este arquivo é órfão e não possui vínculos no banco de dados.
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

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ───────────────────────── */}
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
                    Deletar/Limpar registros vinculados no banco de dados também
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
