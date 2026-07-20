'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PieChart, Plus, Calendar, Users, BarChart3, Copy, X, Trash2, ExternalLink, CheckCircle2, Loader2, Activity, Clock, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Link2, Star, Smile, ClipboardList } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { SidePanel } from '@/components/ui/SidePanel'
import { useApp } from '@/lib/context'

type Pergunta = {
  id: string
  titulo: string
  tipo: 'texto' | 'escala_5' | 'escala_10' | 'multipla_escolha' | 'sim_nao'
  opcoes?: string[]
}

type Pesquisa = {
  id: string
  titulo: string
  descricao?: string
  tipo: string
  status: string
  data_fim: string
  perguntas: Pergunta[]
  respostasCount: number
  respostas: any[]
}

export default function PesquisaClimaAdminPage() {
  const isMobile = useIsMobile()
  const { currentUser } = useApp()
  const isAdmin = currentUser?.cargo === 'Administrador Master' || currentUser?.perfil === 'Administrador'
  
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals state
  const [isNovaPesquisaOpen, setIsNovaPesquisaOpen] = useState(false)
  const [viewPesquisa, setViewPesquisa] = useState<Pesquisa | null>(null)
  const [expandedRespostas, setExpandedRespostas] = useState<Record<string, boolean>>({})
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [loadingResultados, setLoadingResultados] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('recentes')
  const [activeDropdownMenu, setActiveDropdownMenu] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeDropdown = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.action-menu-container')) {
        setActiveDropdownMenu(null)
      }
    }
    document.addEventListener('click', closeDropdown)
    return () => document.removeEventListener('click', closeDropdown)
  }, [])
  
  // Form state
  const [formData, setFormData] = useState({ 
    titulo: '', 
    descricao: '', 
    tipo: 'eNPS', 
    data_fim: '',
    perguntas: [] as Pergunta[]
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchPesquisas()
  }, [])

  const fetchPesquisas = async () => {
    try {
      const res = await fetch(`/api/gestao-pessoas/pesquisas?t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      setPesquisas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.perguntas.length === 0) {
      setFormError('Você precisa adicionar pelo menos uma pergunta à pesquisa.')
      return
    }

    try {
      const url = editingId 
        ? `/api/gestao-pessoas/pesquisas/${editingId}`
        : '/api/gestao-pessoas/pesquisas'
      
      const method = editingId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const responseData = await res.json()
      
      if (res.ok) {
        setIsNovaPesquisaOpen(false)
        setFormData({ titulo: '', descricao: '', tipo: 'eNPS', data_fim: '', perguntas: [] })
        setEditingId(null)
        setFormError('')
        fetchPesquisas()
      } else {
        setFormError(responseData.error || 'Erro ao salvar pesquisa. Verifique o console.')
      }
    } catch (e) {
      setFormError('Erro ao salvar pesquisa. Verifique sua conexão com a API.')
    }
  }

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pesquisa/${id}`
    navigator.clipboard.writeText(url)
    setShowCopySuccess(true)
    setTimeout(() => setShowCopySuccess(false), 2500)
  }

  const handleDeletePesquisa = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta pesquisa?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/pesquisas/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPesquisas(pesquisas.filter(p => p.id !== id))
      } else {
        alert('Erro ao excluir pesquisa')
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao excluir pesquisa')
    }
  }

  const fetchResultados = async (id: string) => {
    setLoadingResultados(id)
    try {
      const res = await fetch(`/api/gestao-pessoas/pesquisas/${id}?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setViewPesquisa({
          ...data,
          respostasCount: data.gp_pesquisa_respostas?.length || 0,
          respostas: data.gp_pesquisa_respostas || []
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingResultados(null)
    }
  }

  // Calculate metrics
  let totalRespostasGlobal = 0
  let ativasCount = 0
  let encerradasCount = 0
  let rascunhosCount = 0
  let encerrandoEmBreve = 0
  
  const hoje = new Date()
  const daquiA7Dias = new Date()
  daquiA7Dias.setDate(hoje.getDate() + 7)

  pesquisas.forEach(p => { 
    totalRespostasGlobal += p.respostasCount 
    if (p.status === 'ativa') {
      ativasCount++
      const fim = new Date(p.data_fim)
      if (fim >= hoje && fim <= daquiA7Dias) {
        encerrandoEmBreve++
      }
    } else if (p.status === 'encerrada' || p.status === 'inativa') {
      encerradasCount++
    } else if (p.status === 'rascunho') {
      rascunhosCount++
    }
  })

  // Filtering and Sorting
  const filteredPesquisas = pesquisas.filter(p => {
    const matchesTab = 
      activeTab === 'todas' || 
      (activeTab === 'ativas' && p.status === 'ativa') ||
      (activeTab === 'encerradas' && (p.status === 'encerrada' || p.status === 'inativa')) ||
      (activeTab === 'rascunhos' && p.status === 'rascunho')
    
    const matchesSearch = p.titulo.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesTab && matchesSearch
  }).sort((a, b) => {
    if (sortBy === 'recentes') {
      return new Date(b.data_fim).getTime() - new Date(a.data_fim).getTime()
    } else if (sortBy === 'antigas') {
      return new Date(a.data_fim).getTime() - new Date(b.data_fim).getTime()
    } else if (sortBy === 'respostas') {
      return (b.respostasCount || 0) - (a.respostasCount || 0)
    }
    return 0
  })

  const totalPages = Math.ceil(filteredPesquisas.length / itemsPerPage)
  const paginatedPesquisas = filteredPesquisas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const addPergunta = () => {
    setFormData({
      ...formData,
      perguntas: [
        ...formData.perguntas,
        { id: `p_${Date.now()}`, titulo: '', tipo: 'texto', opcoes: [] }
      ]
    })
  }

  const updatePergunta = (id: string, updates: Partial<Pergunta>) => {
    setFormData({
      ...formData,
      perguntas: formData.perguntas.map(p => p.id === id ? { ...p, ...updates } : p)
    })
  }

  const removePergunta = (id: string) => {
    setFormData({
      ...formData,
      perguntas: formData.perguntas.filter(p => p.id !== id)
    })
  }

  const toggleResposta = (id: string) => {
    setExpandedRespostas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getIconForIndex = (index: number) => {
    const icons = [
      { Icon: Star, bg: '#e0e7ff', color: '#4f46e5' },
      { Icon: Smile, bg: '#fef3c7', color: '#d97706' },
      { Icon: Users, bg: '#dcfce7', color: '#16a34a' },
      { Icon: ClipboardList, bg: '#f3e8ff', color: '#9333ea' }
    ]
    return icons[index % icons.length]
  }

  const getStatusBadge = (status: string, dataFim: string) => {
    if (status === 'ativa') {
      const fim = new Date(dataFim)
      const diffTime = fim.getTime() - hoje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays <= 9 && diffDays >= 0) {
        return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#d97706' }}>Encerra em {diffDays} dias</span>
      }
      return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>Ativa</span>
    }
    return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>{status === 'rascunho' ? 'Rascunho' : 'Encerrada'}</span>
  }

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? 16 : 40, background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Pesquisa de Clima</h1>
          <p style={{ margin: 0, fontSize: 15, color: '#64748b', marginTop: 8 }}>Crie pesquisas e acompanhe o engajamento da equipe.</p>
        </div>

        {isAdmin && (
          <button 
            onClick={() => {
              setFormData({ titulo: '', descricao: '', tipo: 'eNPS', data_fim: '', perguntas: [] })
              setEditingId(null)
              setIsNovaPesquisaOpen(true)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <Plus size={20} /> Nova pesquisa
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 24, marginBottom: 40 }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: '#f0f9ff', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Pesquisas ativas</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{ativasCount}</div>
          </div>
        </div>
        
        <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Total de respostas</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{totalRespostasGlobal}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Campanhas criadas</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{pesquisas.length}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Encerrando em breve</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{encerrandoEmBreve}</div>
          </div>
        </div>
      </div>

      {/* Campanhas Table Area */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Table Header Controls */}
        <div style={{ padding: '24px 32px 0 32px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Campanhas</h2>
            
            <div style={{ display: 'flex', gap: 12, width: isMobile ? '100%' : 'auto' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar pesquisa..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px 10px 44px', borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none', fontSize: 14, color: '#0f172a' }}
                />
              </div>
              <div style={{ position: 'relative' }} className="action-menu-container">
                <button 
                  onClick={() => setActiveDropdownMenu(activeDropdownMenu === 'sort' ? null : 'sort')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {sortBy === 'recentes' ? 'Mais recentes' : sortBy === 'antigas' ? 'Mais antigas' : 'Mais respostas'} <ChevronDown size={18} />
                </button>
                <AnimatePresence>
                  {activeDropdownMenu === 'sort' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                      style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, minWidth: 200, padding: 8 }}
                    >
                      <button onClick={() => { setSortBy('recentes'); setActiveDropdownMenu(null) }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 14, color: sortBy === 'recentes' ? '#4f46e5' : '#0f172a', fontWeight: sortBy === 'recentes' ? 600 : 500, cursor: 'pointer' }}>Mais recentes</button>
                      <button onClick={() => { setSortBy('antigas'); setActiveDropdownMenu(null) }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 14, color: sortBy === 'antigas' ? '#4f46e5' : '#0f172a', fontWeight: sortBy === 'antigas' ? 600 : 500, cursor: 'pointer' }}>Mais antigas</button>
                      <button onClick={() => { setSortBy('respostas'); setActiveDropdownMenu(null) }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 14, color: sortBy === 'respostas' ? '#4f46e5' : '#0f172a', fontWeight: sortBy === 'respostas' ? 600 : 500, cursor: 'pointer' }}>Mais respostas</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 32, borderBottom: '1px solid #e2e8f0' }}>
            {[
              { id: 'todas', label: 'Todas', count: pesquisas.length },
              { id: 'ativas', label: 'Ativas', count: ativasCount },
              { id: 'rascunhos', label: 'Rascunhos', count: rascunhosCount },
              { id: 'encerradas', label: 'Encerradas', count: encerradasCount }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                style={{
                  padding: '0 0 16px 0', border: 'none', background: 'transparent',
                  color: activeTab === tab.id ? '#4f46e5' : '#64748b',
                  fontWeight: activeTab === tab.id ? 700 : 600, fontSize: 14,
                  borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                {tab.label}
                <span style={{ 
                  background: activeTab === tab.id ? '#e0e7ff' : '#f1f5f9', 
                  color: activeTab === tab.id ? '#4f46e5' : '#64748b', 
                  padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ padding: '16px 32px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', width: '35%' }}>PESQUISA</th>
                <th style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>FORMATO</th>
                <th style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>RESPOSTAS</th>
                <th style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>ENCERRAMENTO</th>
                <th style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                <th style={{ padding: '16px 32px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando pesquisas...</td>
                </tr>
              ) : paginatedPesquisas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Nenhuma pesquisa encontrada.</td>
                </tr>
              ) : (
                paginatedPesquisas.map((p, index) => {
                  const iconData = getIconForIndex(index)
                  const Icon = iconData.Icon
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '24px 32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: iconData.bg, color: iconData.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={22} strokeWidth={2.5} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{p.titulo}</div>
                        </div>
                      </td>
                      <td style={{ padding: '24px 16px', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                        {p.tipo || 'eNPS'} • {p.perguntas?.length || 0} {p.perguntas?.length === 1 ? 'pergunta' : 'perguntas'}
                      </td>
                      <td style={{ padding: '24px 16px', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                        {p.respostasCount} {p.respostasCount === 1 ? 'resposta' : 'respostas'}
                      </td>
                      <td style={{ padding: '24px 16px', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                        {new Date(p.data_fim).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', ' ')}
                      </td>
                      <td style={{ padding: '24px 16px' }}>
                        {getStatusBadge(p.status, p.data_fim)}
                      </td>
                      <td style={{ padding: '24px 32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button 
                            onClick={() => fetchResultados(p.id)}
                            disabled={loadingResultados === p.id}
                            style={{ 
                              padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, 
                              fontSize: 14, fontWeight: 600, cursor: loadingResultados === p.id ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 6, opacity: loadingResultados === p.id ? 0.7 : 1
                            }}
                          >
                            {loadingResultados === p.id ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loadingResultados === p.id ? 'Carregando...' : 'Ver resultados'}
                          </button>
                          
                          <button 
                            onClick={() => window.open(`/pesquisa/${p.id}`, '_blank')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                          >
                            <ExternalLink size={16} /> Abrir
                          </button>
                          
                          <button 
                            onClick={() => copyLink(p.id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                          >
                            <Link2 size={16} /> Copiar
                          </button>

                          {isAdmin && (
                            <div style={{ position: 'relative' }} className="action-menu-container">
                              <button 
                                onClick={() => setActiveDropdownMenu(activeDropdownMenu === p.id ? null : p.id)}
                                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: activeDropdownMenu === p.id ? '#f1f5f9' : '#fff', color: '#64748b', cursor: 'pointer' }}
                                title="Opções"
                              >
                                <MoreVertical size={16} />
                              </button>
                              
                              <AnimatePresence>
                                {activeDropdownMenu === p.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, minWidth: 160, padding: 8 }}
                                  >
                                    <button onClick={() => { 
                                      setActiveDropdownMenu(null)
                                      setFormData({
                                        titulo: p.titulo,
                                        descricao: p.descricao || '',
                                        tipo: p.tipo as any,
                                        data_fim: p.data_fim ? new Date(p.data_fim).toISOString().split('T')[0] : '',
                                        perguntas: p.perguntas || []
                                      })
                                      setEditingId(p.id)
                                      setIsNovaPesquisaOpen(true)
                                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 14, color: '#0f172a', fontWeight: 500, cursor: 'pointer' }}>
                                      <ClipboardList size={16} color="#64748b" /> Editar
                                    </button>
                                    <button onClick={() => { setActiveDropdownMenu(null); handleDeletePesquisa(p.id) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 14, color: '#ef4444', fontWeight: 500, cursor: 'pointer' }}>
                                      <Trash2 size={16} /> Excluir
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Mostrando {filteredPesquisas.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(filteredPesquisas.length, currentPage * itemsPerPage)} de {filteredPesquisas.length} pesquisas
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: currentPage === 1 ? '#cbd5e1' : '#64748b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#e0e7ff', color: '#4f46e5', fontWeight: 700, cursor: 'default' }}>
              {currentPage}
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalPages === 0}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: (currentPage >= totalPages || totalPages === 0) ? '#cbd5e1' : '#64748b', cursor: (currentPage >= totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Nova Pesquisa Modal - CONSTRUTOR DINÂMICO */}
      <SidePanel isOpen={isNovaPesquisaOpen} onClose={() => setIsNovaPesquisaOpen(false)} title={editingId ? "Editar Pesquisa" : "Nova Pesquisa de Clima"} subtitle={editingId ? "Atualize os dados e perguntas" : "Construtor Dinâmico de Formulário"}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {formError && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', fontSize: 14 }}>
              {formError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Informações Básicas</h3>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Título da Pesquisa</label>
              <input required value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 15 }} placeholder="Ex: Pesquisa de Clima 1º Semestre..." />
            </div>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Tipo de Pesquisa</label>
                <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 15 }}>
                  <option value="eNPS">eNPS Clássico</option>
                  <option value="Avaliação de Liderança">Avaliação de Liderança</option>
                  <option value="Saúde Mental">Saúde Mental e Bem-estar</option>
                  <option value="Customizada">Pesquisa Customizada</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Data Limite</label>
                <input required type="date" value={formData.data_fim} onChange={e => setFormData({...formData, data_fim: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 15 }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Descrição / Instruções</label>
              <textarea value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} rows={2} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', fontSize: 15 }} placeholder="Pequeno texto instrucional para os respondentes..."></textarea>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Perguntas do Formulário</h3>
              <button type="button" onClick={addPergunta} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={16} /> Adicionar Pergunta
              </button>
            </div>

            {formData.perguntas.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', background: '#f8fafc', borderRadius: 16, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                Nenhuma pergunta adicionada ainda.
              </div>
            ) : (
              formData.perguntas.map((p, index) => (
                <div key={p.id} style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', position: 'relative' }}>
                  <button type="button" onClick={() => removePergunta(p.id)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Pergunta {index + 1}</label>
                    <input required value={p.titulo} onChange={e => updatePergunta(p.id, { titulo: e.target.value })} style={{ width: 'calc(100% - 30px)', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }} placeholder="Digite a pergunta..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Tipo de Resposta</label>
                    <select value={p.tipo} onChange={e => updatePergunta(p.id, { tipo: e.target.value as any })} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 14 }}>
                      <option value="escala_10">Escala de 0 a 10 (eNPS)</option>
                      <option value="escala_5">Escala de 1 a 5</option>
                      <option value="texto">Texto Livre</option>
                      <option value="sim_nao">Sim ou Não</option>
                      <option value="multipla_escolha">Múltipla Escolha</option>
                    </select>
                  </div>
                  {p.tipo === 'multipla_escolha' && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Opções (separadas por vírgula)</label>
                      <input required value={p.opcoes?.join(', ') || ''} onChange={e => updatePergunta(p.id, { opcoes: e.target.value.split(',').map(s => s.trim()) })} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }} placeholder="Opção A, Opção B, Opção C..." />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 40 }}>
             <button type="button" onClick={() => setIsNovaPesquisaOpen(false)} style={{ padding: '12px 20px', borderRadius: 12, background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
             <button type="submit" style={{ padding: '12px 20px', borderRadius: 12, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Salvar Pesquisa</button>
          </div>
        </form>
      </SidePanel>

      {/* Ver Resultados Modal Dinâmico */}
      <SidePanel isOpen={!!viewPesquisa} onClose={() => setViewPesquisa(null)} title="Resultados Dinâmicos" subtitle={viewPesquisa?.titulo || ''}>
        {viewPesquisa && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>TOTAL DE RESPONDENTES</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{viewPesquisa.respostasCount}</div>
              </div>
            </div>
            
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Respostas Individuais</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {viewPesquisa.respostas.length === 0 ? (
                  <p style={{ color: '#64748b' }}>Nenhuma resposta registrada ainda.</p>
                ) : (
                  viewPesquisa.respostas.map((r: any) => {
                    const isExpanded = expandedRespostas[r.id]
                    let parsedJson = r.respostas_json || {}
                    if (typeof parsedJson === 'string') {
                      try { parsedJson = JSON.parse(parsedJson) } catch (e) {}
                    }

                    return (
                      <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleResposta(r.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff', transition: 'background 0.2s' }}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{r.usuario_nome}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>{r.usuario_cargo}</div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.data_assinatura).toLocaleString('pt-BR')}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>IP: {r.ip_assinatura}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>
                              {isExpanded ? 'Ocultar Respostas ▲' : 'Ver Respostas ▼'}
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px 20px', borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                            {viewPesquisa.perguntas.map((p, index) => {
                              // Ler a resposta do JSON
                              const resposta = parsedJson[p.id] !== undefined ? parsedJson[p.id] : (r.nota !== null ? r.nota : r.comentario) || 'Não respondido'
                              
                              let visualResposta = <span>{resposta}</span>
                              if (p.tipo === 'escala_10') {
                                visualResposta = <span style={{ fontWeight: 800, color: '#4f46e5' }}>{resposta} / 10</span>
                              } else if (p.tipo === 'escala_5') {
                                visualResposta = <span style={{ fontWeight: 800, color: '#4f46e5' }}>{resposta} / 5</span>
                              }
                              
                              return (
                                <div key={p.id}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                                    {index + 1}. {p.titulo}
                                  </div>
                                  <div style={{ fontSize: 15, color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                                    {visualResposta}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Sucesso - Copiar Link */}
      <AnimatePresence>
        {showCopySuccess && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: '#fff', padding: '32px 40px', borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 400, width: '90%' }}
            >
              <div style={{ width: 64, height: 64, borderRadius: 32, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>Link Copiado!</h3>
              <p style={{ margin: 0, fontSize: 15, color: '#64748b', textAlign: 'center' }}>O link da pesquisa foi copiado para sua área de transferência com sucesso.</p>
              <button 
                onClick={() => setShowCopySuccess(false)}
                style={{ marginTop: 8, width: '100%', padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
              >
                OK, entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
