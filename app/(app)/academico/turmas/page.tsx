'use client'

import { useState, useEffect } from 'react'
import { 
  Users, Search, Plus, Filter, 
  School, Calendar, BookOpen, 
  ChevronLeft, ChevronRight, Edit, Trash2,
  FileSpreadsheet
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import ImportarTurmasModal from '@/components/turmas/ImportarTurmasModal'

export default function TurmasPage() {
  const { cfgNiveisEnsino, cfgTurnos, cfgCalendarioLetivo, logSystemAction } = useData()
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [ano, setAno] = useState(new Date().getFullYear().toString())
  const [segmento, setSegmento] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAlunosModalOpen, setIsAlunosModalOpen] = useState(false)
  const [alunosDaTurma, setAlunosDaTurma] = useState<any[]>([])
  const [loadingAlunos, setLoadingAlunos] = useState(false)
  const [selectedTurma, setSelectedTurma] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Sincronizar ano vigente inicial
  useEffect(() => {
    const vigente = (cfgCalendarioLetivo || []).find((c: any) => c.isVigente)?.ano?.toString()
    if (vigente) {
      setAno(vigente)
      setFormData(prev => ({ ...prev, ano: vigente }))
    }
  }, [cfgCalendarioLetivo])
  
  // Form para nova turma
  const [formData, setFormData] = useState({
    nome: '',
    serie: '',
    segmento: '',
    turno: 'Matutino',
    ano: new Date().getFullYear().toString(),
    capacidade: '30'
  })

  const [itensPorPagina, setItensPorPagina] = useState(10)

  // Query para buscar turmas (Cache via React Query)
  const { data: apiResponse, isLoading: loading, isFetching } = useApiQuery<{ data: any[], total: number }>(
    ['turmas-paginadas'],
    '/api/turmas',
    { page: paginaAtual, limit: itensPorPagina, search: searchQuery, ano: ano, segmento: segmento }
  )

  const turmas = apiResponse?.data || []
  const totalItens = apiResponse?.total || 0

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginaAtual(1)
    setSearchQuery(search)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/turmas'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing ? { ...formData, id: selectedTurma.id } : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (res.ok) {
        const savedData = await res.json()
        const realId = savedData.id || selectedTurma?.id
        logSystemAction(
          'Acadêmico (Turmas)',
          isEditing ? 'Edição' : 'Cadastro',
          `${isEditing ? 'Atualização' : 'Cadastro'} da turma ${formData.nome}`,
          { registroId: realId, detalhesDepois: formData }
        )
        
        setIsModalOpen(false)
        setIsEditing(false)
        setSelectedTurma(null)
        setFormData({
          nome: '',
          serie: '',
          segmento: '',
          turno: 'Matutino',
          ano: new Date().getFullYear().toString(),
          capacidade: '30'
        })
        queryClient.invalidateQueries({ queryKey: ['turmas-paginadas'] })
      }
    } catch (error) {
      console.error('Erro ao salvar turma:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return
    try {
      const res = await fetch(`/api/turmas?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        const turmaExcluida = apiResponse?.data?.find((t: any) => t.id === id)
        const nomeTurma = turmaExcluida?.nome || id
        logSystemAction(
          'Acadêmico (Turmas)',
          'Exclusão',
          `Exclusão da turma ${nomeTurma}`,
          { registroId: id, detalhesAntes: turmaExcluida }
        )
        queryClient.invalidateQueries({ queryKey: ['turmas-paginadas'] })
      }
    } catch (error) {
      console.error('Erro ao excluir turma:', error)
    }
  }

  const handleEdit = (turma: any) => {
    setIsEditing(true)
    setSelectedTurma(turma)
    setFormData({
      nome: turma.nome,
      serie: turma.serie,
      segmento: turma.dados?.segmento || '',
      turno: turma.turno,
      ano: turma.ano.toString(),
      capacidade: turma.capacidade.toString()
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setIsEditing(false)
    setSelectedTurma(null)
    setFormData({
      nome: '',
      serie: '',
      segmento: '',
      turno: 'Matutino',
      ano: new Date().getFullYear().toString(),
      capacidade: '30'
    })
  }

  const handleOpenCreateModal = () => {
    setIsEditing(false)
    setSelectedTurma(null)
    setFormData({
      nome: '',
      serie: '',
      segmento: '',
      turno: 'Matutino',
      ano: new Date().getFullYear().toString(),
      capacidade: '30'
    })
    setIsModalOpen(true)
  }

  const handleOpenAlunos = async (turma: any) => {
    setSelectedTurma(turma)
    setIsAlunosModalOpen(true)
    setLoadingAlunos(true)
    try {
      const res = await fetch(`/api/alunos?turma=${turma.id}&limit=100`)
      const data = await res.json()
      setAlunosDaTurma(data.data || [])
    } catch (error) {
      console.error('Erro ao buscar alunos da turma:', error)
    } finally {
      setLoadingAlunos(false)
    }
  }


  const totalPaginas = Math.ceil(totalItens / itensPorPagina)

  const selectedNivel = cfgNiveisEnsino?.find((n: any) => n.nome === formData.segmento)
  const seriesDisponiveis = selectedNivel?.series || []

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Gestão de Turmas
            {isFetching && <UpdatingIndicator />}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Gerencie as turmas e organizações escolares</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="neo-btn neo-btn-secondary"
            style={{ padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
          >
            <FileSpreadsheet size={16} /> Importar Turmas
          </button>
          <button 
            onClick={handleOpenCreateModal}
            className="neo-btn neo-btn-primary"
            style={{ padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
          >
            <Plus size={16} /> Nova Turma
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '10px', borderRadius: '8px' }}>
              <School size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Total de Turmas</p>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>{totalItens}</h3>
            </div>
          </div>
        </div>
        
        <div style={{ flex: 1, background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px', borderRadius: '8px' }}>
              <Users size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Alunos Matriculados</p>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>{turmas.reduce((acc, t) => acc + (t.matriculados || 0), 0)}</h3>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px', borderRadius: '8px' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Vagas Ocupadas</p>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {Math.round((turmas.reduce((acc, t) => acc + (t.matriculados || 0), 0) / turmas.reduce((acc, t) => acc + (t.capacidade || 30), 0)) * 100) || 0}%
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              className="form-input" 
              style={{ paddingLeft: '36px', width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }} 
              placeholder="Buscar por nome ou código..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{ width: '120px' }}>
            <select 
              className="form-input" 
              style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
              value={ano}
              onChange={e => setAno(e.target.value)}
            >
              {(cfgCalendarioLetivo && cfgCalendarioLetivo.length > 0) ? (
                [...cfgCalendarioLetivo].sort((a,b) => Number(b.ano) - Number(a.ano)).map((c: any) => (
                  <option key={c.id} value={c.ano}>{c.ano}</option>
                ))
              ) : (
                <>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </>
              )}
            </select>
          </div>

          <div style={{ width: '180px' }}>
            <select 
              className="form-input" 
              style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
              value={segmento}
              onChange={e => setSegmento(e.target.value)}
            >
              <option value="">Todos Segmentos</option>
              {cfgNiveisEnsino?.map((n: any) => (
                <option key={n.id} value={n.nome}>{n.nome}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit"
            className="neo-btn neo-btn-secondary"
            style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}
          >
            <Filter size={16} /> Filtrar
          </button>
        </form>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Nome da Turma</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Série</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Segmento</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Turno</th>
              <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Alunos</th>
              <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={10} cols={7} />
            ) : turmas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Nenhuma turma encontrada.</td>
              </tr>
            ) : (
              turmas.map(turma => (
                <tr key={turma.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{turma.id}</td>
                  <td 
                    style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: '#2563eb', cursor: 'pointer' }} 
                    onClick={() => handleOpenAlunos(turma)}
                  >
                    {turma.nome}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{turma.serie}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                    <span style={{ padding: '2px 8px', background: '#e2e8f0', color: '#475569', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {turma.dados?.segmento || 'Não definido'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                    <span style={{ padding: '2px 8px', background: turma.turno === 'Matutino' ? '#dbeafe' : '#fef3c7', color: turma.turno === 'Matutino' ? '#1e40af' : '#b45309', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {turma.turno}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{turma.matriculados || 0}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}> / {turma.capacidade || 30}</span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} 
                        title="Editar"
                        onClick={() => handleEdit(turma)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} 
                        title="Excluir"
                        onClick={() => handleDelete(turma.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Mostrando {turmas.length} de {totalItens} turmas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Exibir:</span>
              <select 
                value={itensPorPagina} 
                onChange={(e) => {
                  setItensPorPagina(parseInt(e.target.value))
                  setPaginaAtual(1)
                }}
                style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '6px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={paginaAtual === 1}
              onClick={() => setPaginaAtual(prev => prev - 1)}
              style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '6px', padding: '4px 8px', cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer', opacity: paginaAtual === 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 700 }}>
              {paginaAtual} de {totalPaginas || 1}
            </span>
            <button 
              disabled={paginaAtual === totalPaginas || totalPaginas === 0}
              onClick={() => setPaginaAtual(prev => prev + 1)}
              style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '6px', padding: '4px 8px', cursor: paginaAtual === totalPaginas || totalPaginas === 0 ? 'not-allowed' : 'pointer', opacity: paginaAtual === totalPaginas || totalPaginas === 0 ? 0.5 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nova Turma */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 20, color: '#0f172a', margin: 0 }}>{isEditing ? 'Editar Turma' : 'Criar Nova Turma'}</h2>
              <button onClick={handleCloseModal} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Nome da Turma *</label>
                <input 
                  className="form-input" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                  placeholder="Ex: 1º Ano A" 
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Ano Letivo *</label>
                <select 
                  className="form-input" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                  value={formData.ano}
                  onChange={e => setFormData({ ...formData, ano: e.target.value })}
                  required
                >
                  <option value="">Selecione…</option>
                  {cfgCalendarioLetivo?.map((c: any) => (
                    <option key={c.id} value={c.ano}>{c.ano}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Segmento *</label>
                <select 
                  className="form-input" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                  value={formData.segmento}
                  onChange={e => setFormData({ ...formData, segmento: e.target.value, serie: '' })}
                  required
                >
                  <option value="">Selecione…</option>
                  {cfgNiveisEnsino?.map((n: any) => (
                    <option key={n.id} value={n.nome}>{n.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Série / Ano Escolar *</label>
                <select 
                  className="form-input" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                  value={formData.serie}
                  onChange={e => setFormData({ ...formData, serie: e.target.value })}
                  required
                  disabled={!formData.segmento}
                >
                  <option value="">Selecione…</option>
                  {seriesDisponiveis.map((s: any) => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Turno</label>
                  <select 
                    className="form-input" 
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                    value={formData.turno}
                    onChange={e => setFormData({ ...formData, turno: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {cfgTurnos?.map((t: any) => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Capacidade</label>
                  <input 
                    type="number"
                    className="form-input" 
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                    value={formData.capacidade}
                    onChange={e => setFormData({ ...formData, capacidade: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                 <button 
                  type="submit"
                  className="neo-btn neo-btn-primary"
                  style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                >
                  {isEditing ? 'Salvar Alterações' : 'Criar Turma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Listagem de Alunos */}
      {isAlunosModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header Gradiente Ultra Moderno */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', padding: '24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 10px rgba(255,255,255,0.3)' }}>
                  <Users size={24} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>Alunos da Turma</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{selectedTurma?.nome}</span>
                    <span>•</span>
                    <span>{selectedTurma?.serie}</span>
                    <span>•</span>
                    <span style={{ padding: '1px 6px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{selectedTurma?.turno}</span>
                    <span>•</span>
                    <span>{selectedTurma?.ano}</span>
                    <span>•</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{alunosDaTurma.length}/{selectedTurma?.capacidade}</span> Vagas
                  </div>
                </div>
              </div>
              <button onClick={() => setIsAlunosModalOpen(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', color: '#fff', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>&times;</button>
            </div>
            
            {/* Conteúdo com Scroll */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loadingAlunos ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Carregando alunos...</div>
              ) : alunosDaTurma.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Nenhum aluno matriculado nesta turma.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {alunosDaTurma.map((aluno: any) => (
                    <div key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                      
                      {/* Aluno (Foto + Nome + Matrícula) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: aluno.foto ? `url(${aluno.foto}) center/cover` : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '18px' }}>
                          {!aluno.foto && aluno.nome.charAt(0)}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{aluno.nome}</p>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Matrícula: {aluno.matricula || aluno.id}</p>
                        </div>
                      </div>

                      {/* Responsáveis (Todas as linhas) */}
                      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
                        {aluno.responsaveis && aluno.responsaveis.length > 0 ? (
                          aluno.responsaveis.map((resp: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{resp.nome}</span>
                              <span style={{ padding: '1px 6px', background: '#e2e8f0', color: '#475569', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>
                                {resp.parentesco || 'N/A'}
                              </span>
                              {resp.isFinanceiro && (
                                <span style={{ padding: '1px 4px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '9px', fontWeight: 700 }}>Fin</span>
                              )}
                              {resp.isPedagogico && (
                                <span style={{ padding: '1px 4px', background: '#fef3c7', color: '#b45309', borderRadius: '4px', fontSize: '9px', fontWeight: 700 }}>Ped</span>
                              )}
                              {resp.isOutro && (
                                <span style={{ padding: '1px 4px', background: '#e2e8f0', color: '#475569', borderRadius: '4px', fontSize: '9px', fontWeight: 700 }}>Outro</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Nenhum responsável</span>
                        )}
                      </div>

                      {/* Status */}
                      <span style={{ padding: '2px 8px', background: aluno.status === 'Ativo' ? '#dbeafe' : '#f3f4f6', color: aluno.status === 'Ativo' ? '#1e40af' : '#475569', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                        {aluno.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  onClick={() => setIsAlunosModalOpen(false)}
                  style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '13px' }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportarTurmasModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['turmas-paginadas'] })}
      />
    </div>
  )
}
