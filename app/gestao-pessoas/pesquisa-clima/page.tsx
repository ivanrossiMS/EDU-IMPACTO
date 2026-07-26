'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PieChart, Plus, Calendar, Users, BarChart3, Copy, X, Trash2, ExternalLink, 
  CheckCircle2, Loader2, Activity, Clock, Search, Filter, ChevronDown, 
  ChevronLeft, ChevronRight, MoreVertical, Link2, Star, Smile, ClipboardList, 
  HeartPulse, Settings, FileSpreadsheet, Download, RefreshCw, AlertTriangle, 
  MessageCircle, HelpCircle, Save, Edit3, ArrowLeft, Eye, ShieldAlert, Sparkles, Sliders, BrainCircuit, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
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

type BurnoutQuestionConfig = {
  id: string
  pergunta: string
  invertida: boolean
  opcoes?: string[]
}

type CheckinConfig = {
  id: string
  ativo: boolean
  frequencia_dias: number
  titulo_modal: string
  subtitulo_modal: string
  pergunta_emocao: string
  emocoes: { label: string; emoji: string; color: string }[]
  motivos: string[]
  perguntas_burnout: BurnoutQuestionConfig[]
}

export default function PesquisaClimaAdminPage() {
  const isMobile = useIsMobile()
  const { currentUser } = useApp()
  const checkIsAdminUser = (user: any) => {
    if (!user) return false
    if (user.is_admin || user.is_master) return true

    const perfil = (user.perfil || '').trim().toLowerCase()
    const cargo = (user.cargo || '').trim().toLowerCase()

    // Excluir expressamente cargos operacionais e de suporte como Auxiliar Administrativo, Assistente...
    const nonAdminKeywords = ['auxiliar', 'assistente', 'estagiário', 'estagiario', 'operacional', 'atendente', 'recepcionista', 'secretária', 'secretaria', 'professor', 'professora']
    if (nonAdminKeywords.some(k => perfil.includes(k) || cargo.includes(k))) {
      return false
    }

    const adminExactRoles = [
      'administrador',
      'administrador master',
      'admin',
      'diretor geral',
      'diretor',
      'gestor rh',
      'gerente rh',
      'rh'
    ]

    return adminExactRoles.includes(perfil) || adminExactRoles.includes(cargo)
  }

  const isAdmin = checkIsAdminUser(currentUser)
  const canSeeResultados = isAdmin

  // Navigation main section: 'clima' | 'checkin'
  const [mainSection, setMainSection] = useState<'clima' | 'checkin'>('clima')

  // Check-in Sub Tabs: 'relatorio' | 'config'
  const [checkinSubTab, setCheckinSubTab] = useState<'relatorio' | 'config'>('relatorio')

  // Proteger acesso: redirecionar para 'clima' se não for administrador
  useEffect(() => {
    if (!isAdmin && mainSection === 'checkin') {
      setMainSection('clima')
    }
  }, [isAdmin, mainSection])

  // -------------------------------------------------------------
  // ESTADOS - PESQUISA DE CLIMA (eNPS)
  // -------------------------------------------------------------
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([])
  const [loading, setLoading] = useState(true)
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

  const [formData, setFormData] = useState({ 
    titulo: '', 
    descricao: '', 
    tipo: 'eNPS', 
    data_fim: '',
    perguntas: [] as Pergunta[]
  })
  const [formError, setFormError] = useState('')

  // -------------------------------------------------------------
  // ESTADOS - CHECK-IN DE BEM-ESTAR
  // -------------------------------------------------------------
  const [checkinConfig, setCheckinConfig] = useState<CheckinConfig>({
    id: 'default',
    ativo: true,
    frequencia_dias: 7,
    titulo_modal: 'Check-in de Bem-Estar',
    subtitulo_modal: 'Acompanhamento Semanal',
    pergunta_emocao: 'Como foi essa sua semana no ambiente de trabalho?',
    emocoes: [
      { label: 'Muito bem', emoji: '🙂', color: '#10b981' },
      { label: 'Bem', emoji: '😊', color: '#34d399' },
      { label: 'Regular', emoji: '😐', color: '#fbbf24' },
      { label: 'Cansado', emoji: '😟', color: '#f87171' },
      { label: 'Precisando conversar', emoji: '😞', color: '#ef4444' }
    ],
    motivos: ['Sobrecarga', 'Conflitos', 'Problemas pessoais', 'Dificuldade com equipe', 'Outro'],
    perguntas_burnout: [
      { id: 'q1', pergunta: 'Estou dormindo bem?', invertida: false },
      { id: 'q2', pergunta: 'Tenho energia para trabalhar?', invertida: false },
      { id: 'q3', pergunta: 'Tenho sentido ansiedade?', invertida: true },
      { id: 'q4', pergunta: 'Estou sobrecarregado?', invertida: true },
      { id: 'q5', pergunta: 'Consigo descansar?', invertida: false }
    ]
  })
  const [loadingCheckinConfig, setLoadingCheckinConfig] = useState(false)
  const [savingCheckinConfig, setSavingCheckinConfig] = useState(false)
  const [configSuccessMsg, setConfigSuccessMsg] = useState('')

  // Check-in Relatório
  const [checkinsRelatorio, setCheckinsRelatorio] = useState<any[]>([])
  const [loadingCheckinRelatorio, setLoadingCheckinRelatorio] = useState(false)

  // Filtros de Relatório do Check-in
  const [checkinSearch, setCheckinSearch] = useState('')
  const [checkinDataInicio, setCheckinDataInicio] = useState('')
  const [checkinDataFim, setCheckinDataFim] = useState('')
  const [checkinFiltroRisco, setCheckinFiltroRisco] = useState('todos')
  const [checkinFiltroConversa, setCheckinFiltroConversa] = useState('todos')
  const [checkinCurrentPage, setCheckinCurrentPage] = useState(1)
  const [checkinItemsPerPage, setCheckinItemsPerPage] = useState<number>(15)

  // Ordenação por colunas da tabela de Check-ins
  type CheckinSortColumn = 'data_checkin' | 'colaborador' | 'emocao' | 'motivos' | 'risco' | 'conversa'
  const [checkinSortColumn, setCheckinSortColumn] = useState<CheckinSortColumn>('data_checkin')
  const [checkinSortDirection, setCheckinSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSortCheckin = (col: CheckinSortColumn) => {
    if (checkinSortColumn === col) {
      setCheckinSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setCheckinSortColumn(col)
      setCheckinSortDirection('asc')
    }
  }

  // Modal Detalhes do Check-in selecionado
  const [selectedCheckinDetail, setSelectedCheckinDetail] = useState<any | null>(null)

  // Novo Motivo State (para edição de config)
  const [novoMotivoText, setNovoMotivoText] = useState('')

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

  useEffect(() => {
    fetchPesquisas()
    fetchCheckinConfig()
    fetchCheckinRelatorio()
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

  const fetchCheckinConfig = async () => {
    setLoadingCheckinConfig(true)
    try {
      const res = await fetch('/api/gestao-pessoas/checkin/config', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setCheckinConfig({
            id: data.id || 'default',
            ativo: data.ativo ?? true,
            frequencia_dias: data.frequencia_dias ?? 7,
            titulo_modal: data.titulo_modal || 'Check-in de Bem-Estar',
            subtitulo_modal: data.subtitulo_modal || 'Acompanhamento Semanal',
            pergunta_emocao: data.pergunta_emocao || 'Como foi essa sua semana no ambiente de trabalho?',
            emocoes: Array.isArray(data.emocoes) && data.emocoes.length > 0 ? data.emocoes : checkinConfig.emocoes,
            motivos: Array.isArray(data.motivos) && data.motivos.length > 0 ? data.motivos : checkinConfig.motivos,
            perguntas_burnout: Array.isArray(data.perguntas_burnout) && data.perguntas_burnout.length > 0 ? data.perguntas_burnout : checkinConfig.perguntas_burnout
          })
        }
      }
    } catch (e) {
      console.error('Erro ao carregar config do checkin:', e)
    } finally {
      setLoadingCheckinConfig(false)
    }
  }

  const fetchCheckinRelatorio = async (paramsObj?: Record<string, string>) => {
    setLoadingCheckinRelatorio(true)
    try {
      const queryParams = new URLSearchParams()
      if (checkinDataInicio) queryParams.set('data_inicio', checkinDataInicio)
      if (checkinDataFim) queryParams.set('data_fim', checkinDataFim)
      if (checkinFiltroRisco && checkinFiltroRisco !== 'todos') queryParams.set('risco', checkinFiltroRisco)
      if (checkinFiltroConversa && checkinFiltroConversa !== 'todos') queryParams.set('quer_conversar', checkinFiltroConversa)
      if (checkinSearch) queryParams.set('search', checkinSearch)

      if (paramsObj) {
        Object.entries(paramsObj).forEach(([k, v]) => {
          if (v) queryParams.set(k, v)
          else queryParams.delete(k)
        })
      }

      const res = await fetch(`/api/rh/checkins/relatorio?${queryParams.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success && Array.isArray(data.checkins)) {
        setCheckinsRelatorio(data.checkins)
      } else {
        setCheckinsRelatorio([])
      }
    } catch (e) {
      console.error('Erro ao buscar relatório de checkins:', e)
    } finally {
      setLoadingCheckinRelatorio(false)
    }
  }

  const handleSaveCheckinConfig = async () => {
    setSavingCheckinConfig(true)
    setConfigSuccessMsg('')
    try {
      const res = await fetch('/api/gestao-pessoas/checkin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkinConfig)
      })
      const data = await res.json()
      if (res.ok) {
        setConfigSuccessMsg('Configurações salvas com sucesso! O modal já reflete os novos dados.')
        setTimeout(() => setConfigSuccessMsg(''), 4000)
      } else {
        alert(data.error || 'Erro ao salvar configurações')
      }
    } catch (e: any) {
      alert('Erro de conexão ao salvar configurações: ' + e.message)
    } finally {
      setSavingCheckinConfig(false)
    }
  }

  // --- Handlers de Pesquisa de Clima ---
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
    if (!canSeeResultados) return
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

  // --- Handlers de Motivos & Perguntas de Burnout ---
  const handleAddMotivo = () => {
    if (!novoMotivoText.trim()) return
    if (checkinConfig.motivos.includes(novoMotivoText.trim())) {
      setNovoMotivoText('')
      return
    }
    setCheckinConfig({
      ...checkinConfig,
      motivos: [...checkinConfig.motivos, novoMotivoText.trim()]
    })
    setNovoMotivoText('')
  }

  const handleRemoveMotivo = (motivo: string) => {
    setCheckinConfig({
      ...checkinConfig,
      motivos: checkinConfig.motivos.filter(m => m !== motivo)
    })
  }

  const handleAddBurnoutQuestion = () => {
    const newQ: BurnoutQuestionConfig = {
      id: `bq_${Date.now()}`,
      pergunta: 'Nova pergunta de autoavaliação...',
      invertida: false,
      opcoes: ['Nada', 'Pouco', 'Médio', 'Muito', 'Totalmente']
    }
    setCheckinConfig({
      ...checkinConfig,
      perguntas_burnout: [...checkinConfig.perguntas_burnout, newQ]
    })
  }

  const handleUpdateBurnoutQuestion = (id: string, updates: Partial<BurnoutQuestionConfig>) => {
    setCheckinConfig({
      ...checkinConfig,
      perguntas_burnout: checkinConfig.perguntas_burnout.map(q => q.id === id ? { ...q, ...updates } : q)
    })
  }

  const handleRemoveBurnoutQuestion = (id: string) => {
    if (checkinConfig.perguntas_burnout.length <= 1) {
      alert('Você precisa ter pelo menos 1 pergunta no check-in.')
      return
    }
    setCheckinConfig({
      ...checkinConfig,
      perguntas_burnout: checkinConfig.perguntas_burnout.filter(q => q.id !== id)
    })
  }

  // Exportar Check-in para CSV
  const handleExportCSV = () => {
    if (checkinsRelatorio.length === 0) {
      alert('Nenhum registro para exportar.')
      return
    }

    const headers = ['Data e Hora', 'Colaborador', 'E-mail', 'Cargo', 'Emoção Geral', 'Motivos', 'Risco Burnout', 'Solicitou RH']
    const rows = checkinsRelatorio.map(ck => [
      new Date(ck.data_checkin).toLocaleString('pt-BR'),
      `"${(ck.colaborador_nome || '').replace(/"/g, '""')}"`,
      `"${(ck.colaborador_email || '').replace(/"/g, '""')}"`,
      `"${(ck.colaborador_cargo || '').replace(/"/g, '""')}"`,
      `"${(ck.emocao_geral || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(ck.motivos) ? ck.motivos.join(', ') : '').replace(/"/g, '""')}"`,
      `"${(ck.risco_burnout || '').replace(/"/g, '""')}"`,
      `"${(ck.quer_conversar || 'Não').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `relatorio_checkin_bem_estar_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Cálculo de estatísticas da Pesquisa de Clima
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

  // Filtros de Pesquisa de Clima
  const filteredPesquisas = pesquisas.filter(p => {
    const matchesTab = 
      activeTab === 'todas' || 
      (activeTab === 'ativas' && p.status === 'ativa') ||
      (activeTab === 'encerradas' && (p.status === 'encerrada' || p.status === 'inativa')) ||
      (activeTab === 'rascunhos' && p.status === 'rascunho')
    const matchesSearch = p.titulo.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  }).sort((a, b) => {
    if (sortBy === 'recentes') return new Date(b.data_fim).getTime() - new Date(a.data_fim).getTime()
    if (sortBy === 'antigas') return new Date(a.data_fim).getTime() - new Date(b.data_fim).getTime()
    if (sortBy === 'respostas') return (b.respostasCount || 0) - (a.respostasCount || 0)
    return 0
  })

  const totalPages = Math.ceil(filteredPesquisas.length / itemsPerPage)
  const paginatedPesquisas = filteredPesquisas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Estatísticas do Check-in de Bem-Estar
  const checkinAltoRiscoCount = checkinsRelatorio.filter(c => c.risco_burnout === 'Alto risco').length
  const checkinAtencaoCount = checkinsRelatorio.filter(c => c.risco_burnout === 'Atenção').length
  const checkinQuerConversarCount = checkinsRelatorio.filter(c => Boolean(c.quer_conversar)).length

  // Ordenação dinâmica do relatório de Check-in
  const sortedCheckinsRelatorio = [...checkinsRelatorio].sort((a, b) => {
    let valA: any = ''
    let valB: any = ''

    switch (checkinSortColumn) {
      case 'data_checkin':
        valA = new Date(a.data_checkin).getTime()
        valB = new Date(b.data_checkin).getTime()
        break
      case 'colaborador':
        valA = (a.colaborador_nome || '').toLowerCase()
        valB = (b.colaborador_nome || '').toLowerCase()
        break
      case 'emocao':
        valA = (a.emocao_geral || '').toLowerCase()
        valB = (b.emocao_geral || '').toLowerCase()
        break
      case 'motivos':
        valA = Array.isArray(a.motivos) ? a.motivos.join(', ').toLowerCase() : ''
        valB = Array.isArray(b.motivos) ? b.motivos.join(', ').toLowerCase() : ''
        break
      case 'risco':
        const weightMap: Record<string, number> = { 'Alto risco': 3, 'Atenção': 2, 'Baixo risco': 1 }
        valA = weightMap[a.risco_burnout] || 0
        valB = weightMap[b.risco_burnout] || 0
        break
      case 'conversa':
        valA = (a.quer_conversar || '').toLowerCase()
        valB = (b.quer_conversar || '').toLowerCase()
        break
      default:
        valA = new Date(a.data_checkin).getTime()
        valB = new Date(b.data_checkin).getTime()
    }

    if (valA < valB) return checkinSortDirection === 'asc' ? -1 : 1
    if (valA > valB) return checkinSortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Paginação Check-in
  const checkinTotalPages = Math.ceil(sortedCheckinsRelatorio.length / checkinItemsPerPage)
  const paginatedCheckins = sortedCheckinsRelatorio.slice((checkinCurrentPage - 1) * checkinItemsPerPage, checkinCurrentPage * checkinItemsPerPage)

  const addPergunta = () => {
    setFormData({
      ...formData,
      perguntas: [...formData.perguntas, { id: `p_${Date.now()}`, titulo: '', tipo: 'texto', opcoes: [] }]
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

  const getEmotionBadge = (emocaoName: string) => {
    const found = checkinConfig.emocoes.find(e => (e.label || '').toLowerCase() === (emocaoName || '').toLowerCase())
    const emoji = found?.emoji || (
      emocaoName === 'Muito bem' ? '🙂' :
      emocaoName === 'Bem' ? '😊' :
      emocaoName === 'Regular' ? '😐' :
      emocaoName === 'Cansado' ? '😟' :
      emocaoName === 'Precisando conversar' ? '😞' : '💬'
    )
    const color = found?.color || '#059669'

    return (
      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1' }}>
        <span style={{ fontSize: 16 }}>{emoji}</span> {emocaoName || 'N/I'}
      </span>
    )
  }

  const getRiscoBadge = (risco: string) => {
    switch (risco) {
      case 'Alto risco':
        return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={14} /> Alto Risco</span>
      case 'Atenção':
        return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> Atenção</span>
      default:
        return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Baixo Risco</span>
    }
  }

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? 16 : 40, background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Top Main Section Navigation Bar (Exibida apenas para Administradores) */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: 8, marginBottom: 32, display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMainSection('clima')}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 14,
              border: 'none',
              background: mainSection === 'clima' ? '#4f46e5' : 'transparent',
              color: mainSection === 'clima' ? '#fff' : '#64748b',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s',
              boxShadow: mainSection === 'clima' ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none'
            }}
          >
            <PieChart size={20} /> Pesquisas de Clima (eNPS)
          </button>
          <button
            onClick={() => setMainSection('checkin')}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 14,
              border: 'none',
              background: mainSection === 'checkin' ? '#059669' : 'transparent',
              color: mainSection === 'checkin' ? '#fff' : '#64748b',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s',
              boxShadow: mainSection === 'checkin' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none'
            }}
          >
            <HeartPulse size={20} /> Check-in de Bem-Estar
            <span style={{ 
              background: mainSection === 'checkin' ? 'rgba(255,255,255,0.2)' : (checkinConfig.ativo ? '#dcfce7' : '#fee2e2'), 
              color: mainSection === 'checkin' ? '#fff' : (checkinConfig.ativo ? '#16a34a' : '#ef4444'), 
              padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 
            }}>
              {checkinConfig.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: PESQUISAS DE CLIMA (eNPS & CAMPANHAS)                            */}
      {/* ========================================================================= */}
      {mainSection === 'clima' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 32 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Pesquisas de Clima Organizacional</h1>
              <p style={{ margin: 0, fontSize: 15, color: '#64748b', marginTop: 6 }}>Crie campanhas customizadas e acompanhe os indicadores de engajamento da equipe.</p>
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
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}
              >
                <Plus size={20} /> Nova Pesquisa de Clima
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
            <div style={{ padding: '24px 32px 0 32px' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Campanhas de Clima</h2>
                
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
                              {canSeeResultados && (
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
                              )}
                              
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
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CHECK-IN DE BEM-ESTAR (NOVA ABA COMPLETA)                        */}
      {/* ========================================================================= */}
      {isAdmin && mainSection === 'checkin' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Check-in Header & Subtabs */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
                  Check-in de Bem-Estar
                </h1>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    background: checkinConfig.ativo ? '#dcfce7' : '#fee2e2',
                    color: checkinConfig.ativo ? '#15803d' : '#b91c1c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {checkinConfig.ativo ? <CheckCircle2 size={16} /> : <X size={16} />}
                  {checkinConfig.ativo ? `Ativo (A cada ${checkinConfig.frequencia_dias} dias)` : 'Inativo no Login'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 15, color: '#64748b', marginTop: 6 }}>
                Acompanhamento periódico de saúde mental, fadiga e solicitação de apoio ao RH.
              </p>
            </div>

            {/* Sub-tab Switcher */}
            <div style={{ display: 'flex', gap: 12, background: '#fff', padding: 6, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setCheckinSubTab('relatorio')}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: checkinSubTab === 'relatorio' ? '#059669' : 'transparent',
                  color: checkinSubTab === 'relatorio' ? '#fff' : '#64748b',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                <BarChart3 size={18} /> Resultados & Relatórios
              </button>
              <button
                onClick={() => setCheckinSubTab('config')}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: checkinSubTab === 'config' ? '#059669' : 'transparent',
                  color: checkinSubTab === 'config' ? '#fff' : '#64748b',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                <Settings size={18} /> Configurações & Perguntas
              </button>
            </div>
          </div>

          {/* Subtab 1: Resultados e Relatórios */}
          {checkinSubTab === 'relatorio' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* KPIs do Check-in */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
                <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Total de Check-ins</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{checkinsRelatorio.length}</div>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Alto Risco</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{checkinAltoRiscoCount}</div>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Nível Atenção</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706' }}>{checkinAtencaoCount}</div>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Solicitou Conversa RH</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#9333ea' }}>{checkinQuerConversarCount}</div>
                  </div>
                </div>
              </div>

              {/* Filtros Avançados de Busca do Check-in */}
              <div style={{ background: '#fff', padding: 20, borderRadius: 20, border: '1px solid #e2e8f0', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    <Filter size={18} color="#059669" /> Filtros e Busca de Resultados
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => fetchCheckinRelatorio()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={14} className={loadingCheckinRelatorio ? 'animate-spin' : ''} /> Atualizar
                    </button>

                    <button
                      onClick={handleExportCSV}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: '#059669',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)'
                      }}
                    >
                      <Download size={14} /> Exportar CSV
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Data Início</label>
                    <input
                      type="date"
                      value={checkinDataInicio}
                      onChange={e => {
                        setCheckinDataInicio(e.target.value)
                        fetchCheckinRelatorio({ data_inicio: e.target.value })
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Data Fim</label>
                    <input
                      type="date"
                      value={checkinDataFim}
                      onChange={e => {
                        setCheckinDataFim(e.target.value)
                        fetchCheckinRelatorio({ data_fim: e.target.value })
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Nível de Risco</label>
                    <select
                      value={checkinFiltroRisco}
                      onChange={e => {
                        setCheckinFiltroRisco(e.target.value)
                        fetchCheckinRelatorio({ risco: e.target.value })
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                    >
                      <option value="todos">Todos os Riscos</option>
                      <option value="Alto risco">Alto risco</option>
                      <option value="Atenção">Atenção</option>
                      <option value="Baixo risco">Baixo risco</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Atendimento RH</label>
                    <select
                      value={checkinFiltroConversa}
                      onChange={e => {
                        setCheckinFiltroConversa(e.target.value)
                        fetchCheckinRelatorio({ quer_conversar: e.target.value })
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                    >
                      <option value="todos">Todas as opções</option>
                      <option value="sim">Sim (Qualquer modalidade)</option>
                      <option value="Presencial">Presencial</option>
                      <option value="Online">Online</option>
                      <option value="Sigiloso">Sigiloso</option>
                      <option value="nao">Não Solicitou</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Buscar Colaborador</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Nome, cargo ou email..."
                        value={checkinSearch}
                        onChange={e => {
                          setCheckinSearch(e.target.value)
                          fetchCheckinRelatorio({ search: e.target.value })
                        }}
                        style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de Resultados dos Check-ins */}
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 850 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th
                          onClick={() => handleSortCheckin('data_checkin')}
                          style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'data_checkin' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Data e Hora"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            DATA & HORA
                            {checkinSortColumn === 'data_checkin' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSortCheckin('colaborador')}
                          style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'colaborador' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Colaborador"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            COLABORADOR
                            {checkinSortColumn === 'colaborador' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSortCheckin('emocao')}
                          style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'emocao' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Emoção Geral"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            EMOÇÃO GERAL
                            {checkinSortColumn === 'emocao' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSortCheckin('motivos')}
                          style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'motivos' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Motivos"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            MOTIVOS / FATORES
                            {checkinSortColumn === 'motivos' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSortCheckin('risco')}
                          style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'risco' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Avaliação de Risco"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            AVALIAÇÃO DE RISCO
                            {checkinSortColumn === 'risco' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSortCheckin('conversa')}
                          style={{ padding: '16px 16px', fontSize: 12, fontWeight: 700, color: checkinSortColumn === 'conversa' ? '#059669' : '#64748b', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          title="Clique para ordenar por Atendimento RH"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            SOLICITOU RH
                            {checkinSortColumn === 'conversa' ? (checkinSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.4 }} />}
                          </div>
                        </th>

                        <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingCheckinRelatorio ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                            Carregando check-ins...
                          </td>
                        </tr>
                      ) : paginatedCheckins.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                            Nenhum check-in encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        paginatedCheckins.map((ck: any) => (
                          <tr key={ck.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '18px 24px', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                              {new Date(ck.data_checkin).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: '18px 24px' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ck.colaborador_nome}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{ck.colaborador_cargo}</div>
                            </td>
                            <td style={{ padding: '18px 16px' }}>
                              {getEmotionBadge(ck.emocao_geral)}
                            </td>
                            <td style={{ padding: '18px 16px' }}>
                              {Array.isArray(ck.motivos) && ck.motivos.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {ck.motivos.map((m: string) => (
                                    <span key={m} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>Nenhum selecionado</span>
                              )}
                            </td>
                            <td style={{ padding: '18px 16px' }}>
                              {getRiscoBadge(ck.risco_burnout)}
                            </td>
                            <td style={{ padding: '18px 16px' }}>
                              {ck.quer_conversar ? (
                                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <MessageCircle size={14} /> {ck.quer_conversar}
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>Não</span>
                              )}
                            </td>
                            <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                              <button
                                onClick={() => setSelectedCheckinDetail(ck)}
                                style={{
                                  padding: '8px 14px',
                                  background: '#e0e7ff',
                                  color: '#4f46e5',
                                  border: 'none',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Eye size={14} /> Detalhes
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação da Tabela de Check-ins */}
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                      Mostrando {sortedCheckinsRelatorio.length > 0 ? (checkinCurrentPage - 1) * checkinItemsPerPage + 1 : 0} a {Math.min(sortedCheckinsRelatorio.length, checkinCurrentPage * checkinItemsPerPage)} de {sortedCheckinsRelatorio.length} registros
                    </div>

                    {/* Selector de Itens por Página */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                      <span>Exibir:</span>
                      <select
                        value={checkinItemsPerPage}
                        onChange={e => {
                          setCheckinItemsPerPage(Number(e.target.value))
                          setCheckinCurrentPage(1)
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0f172a',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={15}>15 por página</option>
                        <option value={30}>30 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={999999}>Todos ({sortedCheckinsRelatorio.length})</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setCheckinCurrentPage(p => Math.max(1, p - 1))}
                      disabled={checkinCurrentPage === 1}
                      style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: checkinCurrentPage === 1 ? '#cbd5e1' : '#64748b', cursor: checkinCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: checkinTotalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === checkinTotalPages || Math.abs(page - checkinCurrentPage) <= 1)
                        .map((page, idx, array) => {
                          const prevPage = array[idx - 1]
                          const showEllipsis = prevPage && page - prevPage > 1

                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && <span style={{ padding: '6px 4px', color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>...</span>}
                              <button
                                onClick={() => setCheckinCurrentPage(page)}
                                style={{
                                  width: 36,
                                  height: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 8,
                                  background: checkinCurrentPage === page ? '#dcfce7' : '#fff',
                                  color: checkinCurrentPage === page ? '#15803d' : '#64748b',
                                  fontWeight: checkinCurrentPage === page ? 800 : 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          )
                        })}
                    </div>

                    <button
                      onClick={() => setCheckinCurrentPage(p => Math.min(checkinTotalPages, p + 1))}
                      disabled={checkinCurrentPage >= checkinTotalPages || checkinTotalPages === 0}
                      style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: (checkinCurrentPage >= checkinTotalPages || checkinTotalPages === 0) ? '#cbd5e1' : '#64748b', cursor: (checkinCurrentPage >= checkinTotalPages || checkinTotalPages === 0) ? 'not-allowed' : 'pointer' }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Subtab 2: Configurações e Perguntas do Check-in */}
          {checkinSubTab === 'config' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {configSuccessMsg && (
                <div style={{ padding: 16, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 14, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} />
                  {configSuccessMsg}
                </div>
              )}

              {/* Card 1: Regras Gerais e Exibição */}
              <div style={{ background: '#fff', padding: 28, borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <Sliders size={22} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    Regras de Exibição no Login
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  {/* Status Ativar / Desativar */}
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                      Status do Check-in no Login
                    </label>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
                      Quando ativado, os colaboradores visualizarão o modal periodicamente ao efetuar login.
                    </p>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setCheckinConfig({ ...checkinConfig, ativo: true })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 12,
                          border: checkinConfig.ativo ? '2px solid #10b981' : '1px solid #cbd5e1',
                          background: checkinConfig.ativo ? '#dcfce7' : '#fff',
                          color: checkinConfig.ativo ? '#15803d' : '#64748b',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <CheckCircle2 size={18} /> Ativado
                      </button>

                      <button
                        type="button"
                        onClick={() => setCheckinConfig({ ...checkinConfig, ativo: false })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 12,
                          border: !checkinConfig.ativo ? '2px solid #ef4444' : '1px solid #cbd5e1',
                          background: !checkinConfig.ativo ? '#fee2e2' : '#fff',
                          color: !checkinConfig.ativo ? '#b91c1c' : '#64748b',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <X size={18} /> Desativado
                      </button>
                    </div>
                  </div>

                  {/* Frequência (Intervalo de Dias) */}
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                      Frequência de Exibição (Intervalo em Dias)
                    </label>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
                      Intervalo mínimo (em dias) para reexibir o check-in após o último preenchimento.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={checkinConfig.frequencia_dias}
                        onChange={e => setCheckinConfig({ ...checkinConfig, frequencia_dias: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                        style={{ width: 100, padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 800, textAlign: 'center', outline: 'none' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>dias (Ex: 7 = Semanal, 14 = Quinzenal, 30 = Mensal)</span>
                    </div>
                  </div>
                </div>

                {/* Textos do Modal */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Título do Modal</label>
                    <input
                      type="text"
                      value={checkinConfig.titulo_modal}
                      onChange={e => setCheckinConfig({ ...checkinConfig, titulo_modal: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Subtítulo do Modal</label>
                    <input
                      type="text"
                      value={checkinConfig.subtitulo_modal}
                      onChange={e => setCheckinConfig({ ...checkinConfig, subtitulo_modal: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Pergunta de Emoção Inicial</label>
                    <input
                      type="text"
                      value={checkinConfig.pergunta_emocao}
                      onChange={e => setCheckinConfig({ ...checkinConfig, pergunta_emocao: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Opções de Emoções da Etapa Inicial (Com Emojis) */}
              <div style={{ background: '#fff', padding: 28, borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Smile size={22} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    Opções de Emoções da Etapa Inicial (Com Emojis)
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                  Personalize o emoji e a descrição de cada botão de sentimento que o colaborador visualiza no modal.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: 14 }}>
                  {checkinConfig.emocoes.map((e, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: 18, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 28, background: `${e.color || '#3b82f6'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        {e.emoji || '🙂'}
                      </div>

                      <div style={{ width: '100%' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Emoji</label>
                        <input
                          type="text"
                          value={e.emoji}
                          onChange={ev => {
                            const newEmocoes = [...checkinConfig.emocoes]
                            newEmocoes[idx] = { ...newEmocoes[idx], emoji: ev.target.value }
                            setCheckinConfig({ ...checkinConfig, emocoes: newEmocoes })
                          }}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 18, outline: 'none', textAlign: 'center', background: '#fff' }}
                        />
                      </div>

                      <div style={{ width: '100%' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Texto da Emoção</label>
                        <input
                          type="text"
                          value={e.label}
                          onChange={ev => {
                            const newEmocoes = [...checkinConfig.emocoes]
                            newEmocoes[idx] = { ...newEmocoes[idx], label: ev.target.value }
                            setCheckinConfig({ ...checkinConfig, emocoes: newEmocoes })
                          }}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, outline: 'none', background: '#fff', textAlign: 'center' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Gerenciador de Motivos / Tags */}
              <div style={{ background: '#fff', padding: 28, borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Smile size={22} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    Fatores de Influência (Motivos Selecionáveis)
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                  Opções de tags que o colaborador pode marcar como causa do seu estado emocional na semana.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                  {checkinConfig.motivos.map(m => (
                    <span
                      key={m}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 100,
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        fontSize: 14,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() => handleRemoveMotivo(m)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        <X size={16} />
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, maxWidth: 500 }}>
                  <input
                    type="text"
                    placeholder="Adicionar novo motivo (ex: Carga de Trabalho, Prazos...)"
                    value={novoMotivoText}
                    onChange={e => setNovoMotivoText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMotivo(); } }}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddMotivo}
                    style={{ padding: '12px 20px', borderRadius: 12, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={18} /> Adicionar
                  </button>
                </div>
              </div>

              {/* Card 3: Perguntas de Autoavaliação de Burnout */}
              <div style={{ background: '#fff', padding: 28, borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <BrainCircuit size={22} color="#8b5cf6" />
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                        Perguntas de Autoavaliação (Cálculo de Risco)
                      </h3>
                    </div>
                    <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                      Adicione e ajuste as perguntas para diagnóstico de sobrecarga/burnout. Marque "Pontuação Invertida" para perguntas onde a afirmação é negativa (ex: "Sinto ansiedade?").
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBurnoutQuestion}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      background: '#f3e8ff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={18} /> Adicionar Pergunta
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {checkinConfig.perguntas_burnout.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      style={{
                        background: '#f8fafc',
                        padding: 18,
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        gap: 16
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          background: '#7c3aed',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {idx + 1}
                      </span>

                      <div style={{ flex: 1, width: '100%' }}>
                        <input
                          type="text"
                          value={q.pergunta}
                          onChange={e => handleUpdateBurnoutQuestion(q.id, { pergunta: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: 14,
                            fontWeight: 600,
                            outline: 'none',
                            background: '#fff'
                          }}
                        />

                        {/* Editor de Opções de Resposta da Escala (1 a 5) */}
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                            Opções de Resposta da Escala (1 a 5):
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 8 }}>
                            {(Array.isArray(q.opcoes) && q.opcoes.length === 5 ? q.opcoes : ['Nada', 'Pouco', 'Médio', 'Muito', 'Totalmente']).map((optLabel, optIdx) => (
                              <div key={optIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>
                                  Escala {optIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={optLabel}
                                  onChange={e => {
                                    const currentOpcoes = Array.isArray(q.opcoes) && q.opcoes.length === 5
                                      ? [...q.opcoes]
                                      : ['Nada', 'Pouco', 'Médio', 'Muito', 'Totalmente']
                                    currentOpcoes[optIdx] = e.target.value
                                    handleUpdateBurnoutQuestion(q.id, { opcoes: currentOpcoes })
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    outline: 'none',
                                    background: '#fff'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer',
                            background: q.invertida ? '#fee2e2' : '#fff',
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={q.invertida}
                            onChange={e => handleUpdateBurnoutQuestion(q.id, { invertida: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                          Invertida (Negativa)
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveBurnoutQuestion(q.id)}
                          style={{
                            padding: '8px',
                            borderRadius: 8,
                            background: '#fff',
                            border: '1px solid #fee2e2',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                          title="Excluir Pergunta"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão Flutuante/Fixo de Salvar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleSaveCheckinConfig}
                  disabled={savingCheckinConfig}
                  style={{
                    padding: '16px 36px',
                    borderRadius: 14,
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: savingCheckinConfig ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 16px rgba(5, 150, 105, 0.3)',
                    opacity: savingCheckinConfig ? 0.7 : 1
                  }}
                >
                  {savingCheckinConfig ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  {savingCheckinConfig ? 'Salvando...' : 'Salvar Configurações de Check-in'}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETALHES DO CHECK-IN SELECIONADO                                  */}
      {/* ========================================================================= */}
      <SidePanel
        isOpen={!!selectedCheckinDetail}
        onClose={() => setSelectedCheckinDetail(null)}
        title="Detalhes do Check-in de Bem-Estar"
        subtitle={selectedCheckinDetail?.colaborador_nome || ''}
      >
        {selectedCheckinDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header info */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{selectedCheckinDetail.colaborador_nome}</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>{selectedCheckinDetail.colaborador_cargo} • {selectedCheckinDetail.colaborador_email}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                Data: {new Date(selectedCheckinDetail.data_checkin).toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Emoção & Risco */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>EMOÇÃO DECLARADA</div>
                {getEmotionBadge(selectedCheckinDetail.emocao_geral)}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 16, borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>DIAGNÓSTICO DE RISCO</div>
                {getRiscoBadge(selectedCheckinDetail.risco_burnout)}
              </div>
            </div>

            {/* Motivos e Solicitação de Atendimento RH */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 20, borderRadius: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>MOTIVOS INFLUENCIADORES</div>
              {Array.isArray(selectedCheckinDetail.motivos) && selectedCheckinDetail.motivos.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {selectedCheckinDetail.motivos.map((m: string) => (
                    <span key={m} style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Nenhum motivo específico informado.</p>
              )}

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>SOLICITAÇÃO DE ATENDIMENTO/CONVERSA RH</div>
                {selectedCheckinDetail.quer_conversar ? (
                  <div style={{ padding: '12px 16px', background: '#f3e8ff', border: '1px solid #ddd6fe', borderRadius: 12, color: '#7c3aed', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageCircle size={18} /> Solicitou atendimento modalidade: <u>{selectedCheckinDetail.quer_conversar}</u>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Não solicitou atendimento nesta ocasião.</span>
                )}
              </div>
            </div>

            {/* Respostas Pergunta a Pergunta */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 20, borderRadius: 16 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                Respostas de Autoavaliação de Burnout
              </h4>

              {Array.isArray(selectedCheckinDetail.respostas_json) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedCheckinDetail.respostas_json.map((item: any, idx: number) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        {idx + 1}. {item.pergunta}
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.resposta_texto && (
                          <span style={{ fontWeight: 700, fontSize: 12, color: '#334155', background: '#f1f5f9', padding: '4px 10px', borderRadius: 8 }}>
                            "{item.resposta_texto}"
                          </span>
                        )}
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#4f46e5', background: '#e0e7ff', padding: '4px 10px', borderRadius: 8 }}>
                          Nota: {item.resposta_valor || item.score} / 5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#475569' }}>Q1 (Sono): {selectedCheckinDetail.burnout_q1 || 'N/A'} / 5</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>Q2 (Energia): {selectedCheckinDetail.burnout_q2 || 'N/A'} / 5</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>Q3 (Ansiedade): {selectedCheckinDetail.burnout_q3 || 'N/A'} / 5</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>Q4 (Sobrecarga): {selectedCheckinDetail.burnout_q4 || 'N/A'} / 5</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>Q5 (Descanso): {selectedCheckinDetail.burnout_q5 || 'N/A'} / 5</div>
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

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
