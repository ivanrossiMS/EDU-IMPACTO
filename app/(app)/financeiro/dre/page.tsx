'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, FileSpreadsheet, Sparkles, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3,
  Calendar, RefreshCw, Trash2, ChevronDown, ChevronRight, Search, Download,
  Printer, ShieldCheck, Building, Lightbulb, Activity, ArrowRight, Eye, X,
  Info, Layers, ArrowUpRight, ArrowDownRight, FileUp, Zap, Scale, Wallet,
  Award, Percent, Target, LineChart as LineChartIcon, ShieldAlert, Cpu,
  UserCheck, Hammer, PiggyBank, Compass, ShieldCheck as ShieldIcon, Clock, CreditCard,
  Edit3, Save, Check, Users
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line, AreaChart, Area
} from 'recharts'

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface DREItem {
  codigo?: string
  descricao: string
  total: number
}

interface DREGrupo {
  codigo?: string
  descricao: string
  itens: DREItem[]
  total: number
}

interface DREDados {
  empresa?: string
  periodo?: {
    inicio?: string
    fim?: string
    descricao: string
    numero_meses?: number
  }
  receitas: {
    grupos: DREGrupo[]
    total_geral: number
  }
  despesas: {
    grupos: DREGrupo[]
    total_geral: number
  }
  resultado_operacional: number
  destinacao_lucro?: {
    retiradas_socios?: number
    reforma_construcao?: number
    total_destinado?: number
    sobra_liquida_caixa?: number
    itens?: DREItem[]
  }
  custos_gerenciais?: {
    numero_meses?: number
    custos_fixos?: number
    custos_fixos_mensais?: number
    custos_variaveis?: number
    folha_pagamento?: number
    custo_operacao?: number
    custo_operacao_mensal?: number
    margem_contribuição_valor?: number
    margem_contribuição_pct?: number
    pct_folha_sobre_receita?: number
    pct_opex_sobre_receita?: number
  }
  metricas_chave?: {
    ebitda?: number
    margem_ebitda_pct?: number
    comprometimento_folha_pct?: number
    custo_infraestrutura_pct?: number
    ponto_equilibrio_estimado?: number
    ponto_equilibrio_anual?: number
    ponto_equilibrio_mensal?: number
    media_faturamento_mensal?: number
    margem_seguranca_pct?: number
    capacidade_retirada_mensal?: number
    score_saude_financeira?: number
    diagnostico_saude?: string
  }
  evolucao_mensal?: Array<{
    mes: string
    receita: number
    despesa: number
    resultado: number
  }>
  insights: {
    margem_liquida_pct: number
    maior_receita_item?: string
    maior_receita_valor?: number
    maior_despesa_grupo?: string
    maior_despesa_valor?: number
    maior_ralo_financeiro?: string
    analise_prolabore?: string
    alertas: string[]
    pontos_positivos?: string[]
    recomendacoes: string[]
    analise_resumida: string
  }
}

interface DREHistoricoItem {
  id: string
  nome_arquivo: string
  tipo_arquivo: string
  periodo_descricao: string
  empresa?: string
  total_receitas: number
  total_despesas: number
  resultado_liquido: number
  criado_em: string
  dados_dre?: DREDados
}

const LOCAL_STORAGE_KEY = 'impacto_dre_historico_v2'

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatCurrency = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val)
}

const formatPercent = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0,0%'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

export default function DREPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [dreData, setDreData] = useState<DREDados | null>(null)
  const [nomeRelatorio, setNomeRelatorio] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'dre' | 'cfo' | 'graficos' | 'insights' | 'historico'>('dre')

  // Modais de Edição / Salvar
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string } | null>(null)

  // Histórico
  const [historico, setHistorico] = useState<DREHistoricoItem[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Filtros da Tabela
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchHistorico()
  }, [])

  // Buscar Histórico Unificado (Supabase + LocalStorage Fallback)
  const fetchHistorico = async () => {
    setLoadingHistorico(true)
    let localItems: DREHistoricoItem[] = []

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) localItems = JSON.parse(stored)
    } catch (e) {
      console.warn('Erro ao ler LocalStorage DRE:', e)
    }

    try {
      const res = await fetch('/api/financeiro/dre/historico')
      const json = await res.json()

      if (res.ok && json.data && json.data.length > 0) {
        // Mescla sem duplicados por ID
        const dbItems: DREHistoricoItem[] = json.data
        const map = new Map<string, DREHistoricoItem>()

        localItems.forEach(item => map.set(item.id, item))
        dbItems.forEach(item => map.set(item.id, item))

        const merged = Array.from(map.values()).sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
        setHistorico(merged)
      } else {
        setHistorico(localItems)
      }
    } catch (e) {
      console.error('Erro ao buscar histórico DRE API:', e)
      setHistorico(localItems)
    } finally {
      setLoadingHistorico(false)
    }
  }

  // Função para salvar no LocalStorage + Supabase
  const salvarNoHistorico = async (dados: DREDados, nomePersonalizado: string) => {
    const idItem = `dre_${Date.now()}`
    const novoItem: DREHistoricoItem = {
      id: idItem,
      nome_arquivo: nomePersonalizado || 'DRE - Relatório Analítico',
      tipo_arquivo: 'pdf',
      periodo_descricao: dados.periodo?.descricao || 'Análise Anual',
      empresa: dados.empresa || 'Colégio Impacto',
      total_receitas: dados.receitas?.total_geral || 0,
      total_despesas: dados.despesas?.total_geral || 0,
      resultado_liquido: dados.resultado_operacional || 0,
      criado_em: new Date().toISOString(),
      dados_dre: dados
    }

    // 1. Salva no LocalStorage imediatamente
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      const currentList: DREHistoricoItem[] = stored ? JSON.parse(stored) : []
      const updatedList = [novoItem, ...currentList.filter(i => i.id !== idItem)]
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList))
      setHistorico(updatedList)
    } catch (e) {
      console.warn('Erro ao gravar no LocalStorage:', e)
    }

    // 2. Tenta salvar na API Supabase
    try {
      await fetch('/api/financeiro/dre/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nomeArquivo: nomePersonalizado,
          dadosDRE: dados
        })
      })
    } catch (e) {
      console.warn('Erro ao salvar no Supabase backend:', e)
    }
  }

  const handleFileUpload = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'xlsx', 'xls'].includes(ext || '')) {
      setErrorMessage('Formato inválido. Por favor, envie um arquivo em PDF ou Excel (.xlsx, .xls).')
      return
    }

    setFile(selectedFile)
    setErrorMessage(null)
    setUploading(true)
    setUploadProgress(15)
    setStatusText('Lendo arquivo e calculando Ponto de Equilíbrio Mensal e Anual...')

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) {
          clearInterval(interval)
          return 85
        }
        return prev + 10
      })
    }, 400)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('nomeArquivo', selectedFile.name)

      const response = await fetch('/api/financeiro/dre/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(interval)
      setUploadProgress(100)

      let result: any = {}
      try {
        result = await response.json()
      } catch (jsonErr) {
        result = { error: `Erro de comunicação com o servidor (Status ${response.status})` }
      }

      if (!response.ok || !result.success) {
        const errorMsg = typeof result?.error === 'string'
          ? result.error
          : (result?.error?.message || result?.saveError || 'Não foi possível processar o arquivo DRE. Verifique o arquivo e tente novamente.')
        setErrorMessage(String(errorMsg))
        return
      }

      const nomePadrao = selectedFile.name.replace(/\.[^/.]+$/, '')
      setNomeRelatorio(nomePadrao)
      setDreData(result.data)
      setActiveTab('dre')

      // Salva automaticamente no Histórico Híbrido
      await salvarNoHistorico(result.data, nomePadrao)
      await fetchHistorico()

      if (result.data) {
        const initialExpand: Record<string, boolean> = {}
        result.data.receitas?.grupos?.forEach((g: DREGrupo, i: number) => {
          initialExpand[`rec_${g.codigo || i}`] = true
        })
        result.data.despesas?.grupos?.forEach((g: DREGrupo, i: number) => {
          initialExpand[`desp_${g.codigo || i}`] = true
        })
        setExpandedGroups(initialExpand)
      }

    } catch (err: any) {
      console.error('Erro no upload DRE:', err)
      const message = typeof err === 'string' ? err : (err?.message || 'Falha ao processar o arquivo.')
      setErrorMessage(String(message))
    } finally {
      setUploading(false)
    }
  }

  const handleCarregarHistorico = async (item: DREHistoricoItem) => {
    // Se o item tiver dados_dre no LocalStorage, carrega direto
    if (item.dados_dre) {
      setDreData(item.dados_dre)
      setNomeRelatorio(item.nome_arquivo)
      setActiveTab('dre')

      const initialExpand: Record<string, boolean> = {}
      item.dados_dre.receitas?.grupos?.forEach((g: DREGrupo, i: number) => {
        initialExpand[`rec_${g.codigo || i}`] = true
      })
      item.dados_dre.despesas?.grupos?.forEach((g: DREGrupo, i: number) => {
        initialExpand[`desp_${g.codigo || i}`] = true
      })
      setExpandedGroups(initialExpand)
      return
    }

    setUploading(true)
    setStatusText('Carregando DRE do histórico...')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/financeiro/dre/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      })
      const json = await res.json()
      if (res.ok && json.data?.dados_dre) {
        setDreData(json.data.dados_dre)
        setNomeRelatorio(item.nome_arquivo)
        setActiveTab('dre')

        const initialExpand: Record<string, boolean> = {}
        json.data.dados_dre.receitas?.grupos?.forEach((g: DREGrupo, i: number) => {
          initialExpand[`rec_${g.codigo || i}`] = true
        })
        json.data.dados_dre.despesas?.grupos?.forEach((g: DREGrupo, i: number) => {
          initialExpand[`desp_${g.codigo || i}`] = true
        })
        setExpandedGroups(initialExpand)
      } else {
        setErrorMessage('Não foi possível carregar o DRE selecionado.')
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Erro ao carregar o DRE.')
    } finally {
      setUploading(false)
    }
  }

  const handleExcluirHistorico = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Deseja excluir este DRE do histórico?')) return

    // 1. Remove do LocalStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const list: DREHistoricoItem[] = JSON.parse(stored)
        const updated = list.filter(item => item.id !== id)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
        setHistorico(updated)
      }
    } catch (err) {
      console.error(err)
    }

    // 2. Remove do Supabase
    try {
      await fetch(`/api/financeiro/dre/historico?id=${id}`, { method: 'DELETE' })
      fetchHistorico()
    } catch (err) {
      console.error(err)
    }
  }

  // Renomear Item do Histórico
  const handleRenomearItem = async (id: string, novoNome: string) => {
    if (!novoNome.trim()) return

    // 1. Atualiza LocalStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const list: DREHistoricoItem[] = JSON.parse(stored)
        const updated = list.map(item => item.id === id ? { ...item, nome_arquivo: novoNome } : item)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
        setHistorico(updated)
      }
    } catch (err) {
      console.error(err)
    }

    // 2. Atualiza Supabase
    try {
      await fetch('/api/financeiro/dre/historico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, novoNome })
      })
    } catch (err) {
      console.error(err)
    }

    if (dreData && (id === editingItem?.id || nomeRelatorio)) {
      setNomeRelatorio(novoNome)
    }
    setEditingItem(null)
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAllGroups = (expand: boolean) => {
    if (!dreData) return
    const newState: Record<string, boolean> = {}
    dreData.receitas?.grupos?.forEach((g, i) => { newState[`rec_${g.codigo || i}`] = expand })
    dreData.despesas?.grupos?.forEach((g, i) => { newState[`desp_${g.codigo || i}`] = expand })
    setExpandedGroups(newState)
  }

  const pieChartData = useMemo(() => {
    if (!dreData?.despesas?.grupos) return []
    return dreData.despesas.grupos
      .filter(g => g.total > 0)
      .map(g => ({
        name: g.descricao,
        value: g.total
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [dreData])

  const barChartData = useMemo(() => {
    if (dreData?.evolucao_mensal && dreData.evolucao_mensal.length > 0) {
      return dreData.evolucao_mensal.map(m => ({
        categoria: m.mes,
        Receitas: m.receita,
        Despesas: m.despesa,
        Resultado: m.resultado
      }))
    }

    if (!dreData) return []
    return [
      {
        categoria: 'DRE Total',
        Receitas: dreData.receitas?.total_geral || 0,
        Despesas: dreData.despesas?.total_geral || 0,
        Resultado: dreData.resultado_operacional || 0
      }
    ]
  }, [dreData])

  // ─── NÚMERO DE MESES DO PERÍODO AUDITADO (N MESES DINÂMICO) ────────────────
  const numeroMeses = useMemo(() => {
    if (dreData?.custos_gerenciais?.numero_meses) return dreData.custos_gerenciais.numero_meses
    if (dreData?.periodo?.numero_meses) return dreData.periodo.numero_meses
    if (dreData?.evolucao_mensal && Array.isArray(dreData.evolucao_mensal) && dreData.evolucao_mensal.length > 0) {
      return dreData.evolucao_mensal.length
    }
    if (dreData?.periodo?.inicio && dreData?.periodo?.fim) {
      try {
        const pIni = String(dreData.periodo.inicio).split('/')
        const pFim = String(dreData.periodo.fim).split('/')
        if (pIni.length === 3 && pFim.length === 3) {
          const m1 = parseInt(pIni[1])
          const m2 = parseInt(pFim[1])
          const a1 = parseInt(pIni[2])
          const a2 = parseInt(pFim[2])
          const diff = (a2 - a1) * 12 + (m2 - m1) + 1
          if (diff > 0 && diff <= 12) return diff
        }
      } catch (e) {}
    }
    return 12
  }, [dreData])

  const margemOperacionalReal = useMemo(() => {
    if (!dreData || !dreData.receitas?.total_geral) return 0
    return Math.round(((dreData.resultado_operacional / dreData.receitas.total_geral) * 100) * 10) / 10
  }, [dreData])

  const custoFolhaPagamento = useMemo(() => {
    if (dreData?.custos_gerenciais?.folha_pagamento !== undefined && dreData.custos_gerenciais.folha_pagamento > 0) {
      return dreData.custos_gerenciais.folha_pagamento
    }
    let sum = 0
    dreData?.despesas?.grupos?.forEach(g => {
      const descUpper = String(g.descricao || '').toUpperCase()
      const cod = String(g.codigo || '')
      if (cod.startsWith('50') || descUpper.includes('FOLHA') || descUpper.includes('PESSOAL') || descUpper.includes('SALÁRIO') || descUpper.includes('SALARIO') || descUpper.includes('ENCARGOS')) {
        sum += Number(g.total) || 0
      }
    })
    return sum
  }, [dreData])

  const pctFolhaPagamento = useMemo(() => {
    const rec = dreData?.receitas?.total_geral || 0
    if (!rec || rec === 0) return 0
    return Math.round((custoFolhaPagamento / rec) * 1000) / 10
  }, [dreData, custoFolhaPagamento])

  const custoOperacaoTotal = useMemo(() => {
    return dreData?.despesas?.total_geral || 0
  }, [dreData])

  const margemContribuiçãoPct = useMemo(() => {
    return dreData?.custos_gerenciais?.margem_contribuição_pct ?? 85
  }, [dreData])

  const faturamentoMensalMedio = useMemo(() => {
    if (dreData?.metricas_chave?.media_faturamento_mensal) return dreData.metricas_chave.media_faturamento_mensal
    const totalRec = dreData?.receitas?.total_geral || 0
    return totalRec / (numeroMeses || 12)
  }, [dreData, numeroMeses])

  const custoOperacaoMensalMedio = useMemo(() => {
    if (dreData?.custos_gerenciais?.custo_operacao_mensal) return dreData.custos_gerenciais.custo_operacao_mensal
    const totalDesp = dreData?.despesas?.total_geral || 0
    return totalDesp / (numeroMeses || 12)
  }, [dreData, numeroMeses])

  const breakEvenMensal = useMemo(() => {
    if (dreData?.metricas_chave?.ponto_equilibrio_mensal) return dreData.metricas_chave.ponto_equilibrio_mensal
    const custosFixos = (dreData?.custos_gerenciais?.custos_fixos || (dreData?.despesas?.total_geral || 0) * 0.9)
    const custosFixosMensais = custosFixos / (numeroMeses || 12)
    return margemContribuiçãoPct > 0 ? (custosFixosMensais / (margemContribuiçãoPct / 100)) : custosFixosMensais
  }, [dreData, numeroMeses, margemContribuiçãoPct])

  const breakEvenAnual = useMemo(() => {
    if (dreData?.metricas_chave?.ponto_equilibrio_anual) return dreData.metricas_chave.ponto_equilibrio_anual
    return breakEvenMensal * 12
  }, [dreData, breakEvenMensal])

  const margemSeguranca = useMemo(() => {
    if (!breakEvenMensal || breakEvenMensal === 0) return 0
    if (!faturamentoMensalMedio || faturamentoMensalMedio === 0) return 0
    return Math.round(((faturamentoMensalMedio - breakEvenMensal) / faturamentoMensalMedio) * 1000) / 10
  }, [faturamentoMensalMedio, breakEvenMensal])

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '24px 16px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* ─── HEADER EXECUTIVO ────────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.3)'
          }}>
            <BarChart3 size={28} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Demonstração do Resultado (DRE)
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '20px',
                background: '#eef2ff',
                color: '#4338ca',
                border: '1px solid #c7d2fe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={12} color="#4338ca" /> IA Contador Sênior & Economista
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
              Análise com Ponto de Equilíbrio (Break-Even Mensal e Anual) e Histórico Salvo
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {dreData && (
            <button
              onClick={() => setShowRenameModal(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                background: '#faf5ff',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Edit3 size={15} /> Renomear & Salvar
            </button>
          )}

          {dreData && (
            <button
              onClick={() => { setDreData(null); setFile(null) }}
              style={{
                height: '42px',
                padding: '0 18px',
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              <RefreshCw size={15} /> Novo Upload
            </button>
          )}

          {dreData && (
            <button
              onClick={() => window.print()}
              style={{
                height: '42px',
                padding: '0 20px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <Printer size={16} /> Imprimir DRE
            </button>
          )}
        </div>
      </div>

      {/* ─── UPLOAD SECTION (Se não houver DRE ativo) ───────────────────────── */}
      {!dreData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Box de Drag and Drop */}
          <div style={{ gridColumn: 'span 2' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0])
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: isDragging ? '#f5f3ff' : '#ffffff',
                borderRadius: '16px',
                border: isDragging ? '2px dashed #6366f1' : '2px dashed #cbd5e1',
                padding: '48px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf, .xlsx, .xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4f46e5',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
                }}>
                  <FileUp size={36} />
                </div>

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                    Envie o arquivo PDF ou Excel da DRE / Análise Anual
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    Análise completa com salvamento automático no histórico e permissão para renomear
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', background: '#faf5ff', color: '#7e22ce', border: '1px solid #f3e8ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#7e22ce" /> Relatório PDF do SAE-C / Sistema
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={14} color="#047857" /> Planilha Balancete Excel (.xlsx)
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                marginTop: '16px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <AlertTriangle size={20} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px' }}>Aviso de Leitura</strong>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Progress Container */}
            {uploading && (
              <div style={{
                marginTop: '16px',
                padding: '20px 24px',
                borderRadius: '16px',
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                boxShadow: '0 4px 16px rgba(79, 70, 229, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 700, color: '#4338ca', marginBottom: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} className="animate-spin" /> {statusText}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>

                <div style={{ width: '100%', height: '8px', background: '#e0e7ff', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', margin: '8px 0 0' }}>
                  Calculando Ponto de Equilíbrio Mensal, Margem de Segurança e salvando no histórico...
                </p>
              </div>
            )}
          </div>

          {/* Side Card: Histórico Lateral */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#4f46e5" /> DREs Processados ({historico.length})
                </h3>
                <button
                  onClick={fetchHistorico}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
                  title="Atualizar"
                >
                  <RefreshCw size={14} className={loadingHistorico ? 'animate-spin' : ''} />
                </button>
              </div>

              {historico.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>
                  Nenhum DRE no histórico ainda. Envie o primeiro arquivo ao lado.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                  {historico.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleCarregarHistorico(item)}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nome_arquivo}
                        </p>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px' }}>
                          {item.periodo_descricao || new Date(item.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                        <div style={{ fontSize: '11px', display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#059669', fontWeight: 700 }}>Rec: {formatCurrency(item.total_receitas)}</span>
                          <span style={{ color: item.resultado_liquido >= 0 ? '#2563eb' : '#dc2626', fontWeight: 700 }}>
                            Lucro: {formatCurrency(item.resultado_liquido)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Salvamento em Nuvem Supabase + Fundo Local Ativo.</span>
            </div>
          </div>

        </div>
      )}

      {/* ─── MODAL RENOMEAR / SALVAR DRE ─────────────────────────────────────── */}
      {showRenameModal && dreData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#7c3aed" /> Renomear & Salvar DRE
              </h3>
              <X size={18} color="#94a3b8" cursor="pointer" onClick={() => setShowRenameModal(false)} />
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Defina um nome identificador personalizado para este relatório no seu histórico.
            </p>

            <input
              type="text"
              value={nomeRelatorio}
              onChange={(e) => setNomeRelatorio(e.target.value)}
              placeholder="Ex: DRE Anual 2026 - Colégio Impacto"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                outline: 'none',
                marginBottom: '20px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowRenameModal(false)}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  salvarNoHistorico(dreData, nomeRelatorio)
                  setShowRenameModal(false)
                }}
                style={{ padding: '8px 20px', background: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} /> Salvar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEÇÃO DE RESULTADOS DRE (Após upload / carregamento) ─────────────── */}
      {dreData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Subheader com Empresa e Seletor de Abas */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={14} /> {dreData.empresa || 'Colégio Impacto'}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                Relatório DRE — {nomeRelatorio || dreData.periodo?.descricao || 'Análise Anual'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Período auditado: {dreData.periodo?.inicio || '01/01'} a {dreData.periodo?.fim || '31/12'}
              </p>
            </div>

            {/* SELETOR DE ABAS — PILL STYLE EXECUTIVO */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: '12px',
              padding: '4px',
              display: 'flex',
              gap: '4px',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setActiveTab('dre')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'dre' ? '#ffffff' : 'transparent',
                  color: activeTab === 'dre' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'dre' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={14} /> Tabela DRE
              </button>

              <button
                onClick={() => setActiveTab('cfo')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'cfo' ? '#ffffff' : 'transparent',
                  color: activeTab === 'cfo' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'cfo' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Award size={14} color="#6366f1" /> Painel CFO & Break-Even
              </button>

              <button
                onClick={() => setActiveTab('graficos')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'graficos' ? '#ffffff' : 'transparent',
                  color: activeTab === 'graficos' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'graficos' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <PieChartIcon size={14} /> Gráficos & Evolução
              </button>

              <button
                onClick={() => setActiveTab('insights')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'insights' ? '#ffffff' : 'transparent',
                  color: activeTab === 'insights' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'insights' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Lightbulb size={14} color="#d97706" /> Insights IA ({dreData.insights?.alertas?.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('historico')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'historico' ? '#ffffff' : 'transparent',
                  color: activeTab === 'historico' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'historico' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Calendar size={14} /> Histórico ({historico.length})
              </button>
            </div>
          </div>

          {/* ─── BLOCO 1: 4 CARDS PRINCIPAIS DA DRE OPERACIONAL (LINHA 1) ─────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            
            {/* Card 1: Receita Bruta Total */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receita Bruta Total</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#059669', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(dreData.receitas?.total_geral)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} color="#059669" /> Média mensal ({numeroMeses}m): {formatCurrency(faturamentoMensalMedio)}
              </p>
            </div>

            {/* Card 2: Custo de Operação (OPEX) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo de Operação (OPEX)</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(custoOperacaoTotal)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <Activity size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info size={13} color="#dc2626" /> Custo mensal ({numeroMeses}m): {formatCurrency(custoOperacaoMensalMedio)}
              </p>
            </div>

            {/* Card 3: Custo de Folha de Pagamento */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #c7d2fe',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(79, 70, 229, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Folha de Pagamento</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(custoFolhaPagamento)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <Users size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#4338ca', fontWeight: 700, margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <PieChartIcon size={13} color="#4f46e5" /> Comprometimento: {pctFolhaPagamento}% da Receita
              </p>
            </div>

            {/* Card 4: Lucro Operacional Real & % Margem */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #bfdbfe',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lucro Operacional Real</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(dreData.resultado_operacional)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Percent size={13} color="#2563eb" /> Margem de Lucro: {margemOperacionalReal}% da receita
              </p>
            </div>

          </div>

          {/* ─── BLOCO 2: 4 CARDS ESTRATÉGICOS DE BREAK-EVEN & CAIXA (LINHA 2) ───── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            
            {/* Card 1: Break-Even Mensal (0 a 0) */}
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              borderRadius: '16px',
              padding: '18px 20px',
              color: '#ffffff',
              boxShadow: '0 6px 16px -2px rgba(3, 105, 161, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#e0f2fe', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Target size={13} /> Break-Even Mensal (0 a 0)
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(breakEvenMensal)} / mês
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Scale size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#e0f2fe', margin: '12px 0 0' }}>
                Faturamento mensal via Margem de Contribuição ({margemContribuiçãoPct}%)
              </p>
            </div>

            {/* Card 2: Break-Even Anual (0 a 0) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Break-Even Anual (0 a 0)</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(breakEvenAnual)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                  <Compass size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} color="#059669" /> Ponto de equilíbrio gerencial real
              </p>
            </div>

            {/* Card 3: Margem de Segurança (%) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #a7f3d0',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margem de Folga / Segurança</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#059669', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    +{margemSeguranca}%
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Zap size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                Receita <strong style={{ color: '#059669' }}>{margemSeguranca}% acima</strong> do Break-Even
              </p>
            </div>

            {/* Card 4: Sobra Retida no Caixa */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #ddd6fe',
              padding: '18px 20px',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sobra Retida no Caixa</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {formatCurrency(dreData.destinacao_lucro?.sobra_liquida_caixa ?? dreData.resultado_operacional)}
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <PiggyBank size={18} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                Reserva mantida no fundo de caixa da escola
              </p>
            </div>

          </div>

          {/* ─── ABA 1: TABELA DRE HIERÁRQUICA E ELEGANTE ──────────────────────── */}
          {activeTab === 'dre' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)'
            }}>
              
              {/* Toolbar da Tabela */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por grupo ou conta (ex: Folha, Luz...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      paddingLeft: '36px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  {searchTerm && (
                    <X size={14} color="#94a3b8" onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }} />
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => toggleAllGroups(true)}
                    style={{ height: '36px', padding: '0 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Expandir Todos
                  </button>
                  <button
                    onClick={() => toggleAllGroups(false)}
                    style={{ height: '36px', padding: '0 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Recolher Todos
                  </button>
                </div>
              </div>

              {/* Tabela Estruturada */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '12px 16px', width: '100px' }}>Código</th>
                      <th style={{ padding: '12px 16px' }}>Descrição da Conta / Categoria</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', width: '180px' }}>Valor Total</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', width: '120px' }}>% Represent.</th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* 🟢 LINHA MESTRA: RECEITAS BRUTAS */}
                    <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534', fontWeight: 800, fontSize: '14px' }}>
                      <td style={{ padding: '14px 16px' }}>00</td>
                      <td style={{ padding: '14px 16px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>RECEITAS BRUTAS OPERACIONAIS</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '15px' }}>{formatCurrency(dreData.receitas?.total_geral)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace' }}>100.0%</td>
                    </tr>

                    {dreData.receitas?.grupos?.map((grupo, gIdx) => {
                      const groupKey = `rec_${grupo.codigo || gIdx}`
                      const isExpanded = expandedGroups[groupKey] ?? true
                      const itemsFiltrados = grupo.itens?.filter(i =>
                        i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (i.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
                      )

                      if (searchTerm && itemsFiltrados?.length === 0 && !grupo.descricao.toLowerCase().includes(searchTerm.toLowerCase())) {
                        return null
                      }

                      const pctReceita = dreData.receitas?.total_geral > 0
                        ? ((grupo.total / dreData.receitas.total_geral) * 100).toFixed(1)
                        : '0.0'

                      return (
                        <React.Fragment key={groupKey}>
                          <tr
                            onClick={() => toggleGroup(groupKey)}
                            style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontWeight: 700, color: '#1e293b' }}
                          >
                            <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: 'monospace' }}>{grupo.codigo || `00.${gIdx+1}`}</td>
                            <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isExpanded ? <ChevronDown size={16} color="#059669" /> : <ChevronRight size={16} color="#94a3b8" />}
                              <span>{grupo.descricao}</span>
                              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                                {grupo.itens?.length || 0} itens
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 800 }}>{formatCurrency(grupo.total)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{pctReceita}%</td>
                          </tr>

                          {isExpanded && itemsFiltrados?.map((item, iIdx) => (
                            <tr key={iIdx} style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#475569' }}>
                              <td style={{ padding: '10px 16px 10px 32px', color: '#94a3b8', fontFamily: 'monospace' }}>{item.codigo || '—'}</td>
                              <td style={{ padding: '10px 16px 10px 40px', color: '#334155' }}>{item.descricao}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.total)}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                                {dreData.receitas?.total_geral > 0 ? ((item.total / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}

                    {/* 🔴 LINHA MESTRA: DESPESAS E CUSTOS OPERACIONAIS (OPEX) */}
                    <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#991b1b', fontWeight: 800, fontSize: '14px' }}>
                      <td style={{ padding: '14px 16px' }}>50</td>
                      <td style={{ padding: '14px 16px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>DESPESAS OPERACIONAIS (OPEX)</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '15px' }}>{formatCurrency(dreData.despesas?.total_geral)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {dreData.receitas?.total_geral > 0 ? ((dreData.despesas?.total_geral / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>

                    {dreData.despesas?.grupos?.map((grupo, gIdx) => {
                      const groupKey = `desp_${grupo.codigo || gIdx}`
                      const isExpanded = expandedGroups[groupKey] ?? true
                      const itemsFiltrados = grupo.itens?.filter(i =>
                        i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (i.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
                      )

                      if (searchTerm && itemsFiltrados?.length === 0 && !grupo.descricao.toLowerCase().includes(searchTerm.toLowerCase())) {
                        return null
                      }

                      const pctReceita = dreData.receitas?.total_geral > 0
                        ? ((grupo.total / dreData.receitas.total_geral) * 100).toFixed(1)
                        : '0.0'

                      return (
                        <React.Fragment key={groupKey}>
                          <tr
                            onClick={() => toggleGroup(groupKey)}
                            style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontWeight: 700, color: '#1e293b' }}
                          >
                            <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: 'monospace' }}>{grupo.codigo || `50.${gIdx+1}`}</td>
                            <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isExpanded ? <ChevronDown size={16} color="#dc2626" /> : <ChevronRight size={16} color="#94a3b8" />}
                              <span>{grupo.descricao}</span>
                              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 700 }}>
                                {grupo.itens?.length || 0} itens
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626', fontWeight: 800 }}>{formatCurrency(grupo.total)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{pctReceita}%</td>
                          </tr>

                          {isExpanded && itemsFiltrados?.map((item, iIdx) => (
                            <tr key={iIdx} style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#475569' }}>
                              <td style={{ padding: '10px 16px 10px 32px', color: '#94a3b8', fontFamily: 'monospace' }}>{item.codigo || '—'}</td>
                              <td style={{ padding: '10px 16px 10px 40px', color: '#334155' }}>{item.descricao}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(item.total)}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                                {dreData.receitas?.total_geral > 0 ? ((item.total / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}

                    {/* 🟦 LINHA MESTRA: RESULTADO OPERACIONAL REAL (LUCRO GERADO) */}
                    <tr style={{ background: '#eff6ff', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6', color: '#1e40af', fontWeight: 900, fontSize: '15px' }}>
                      <td style={{ padding: '16px' }}>(=)</td>
                      <td style={{ padding: '16px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>RESULTADO OPERACIONAL REAL (LUCRO GERADO PELA ESCOLA)</td>
                      <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '18px', color: '#2563eb' }}>
                        {formatCurrency(dreData.resultado_operacional)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', color: '#1d4ed8' }}>
                        {margemOperacionalReal}%
                      </td>
                    </tr>

                    {/* 💜 SEÇÃO ESPECIAL: DESTINAÇÃO DO RESULTADO / INVESTIMENTOS (RETIRADAS DOS SÓCIOS E REFORMAS) */}
                    {dreData.destinacao_lucro && (
                      <>
                        <tr style={{ background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', color: '#6b21a8', fontWeight: 800, fontSize: '14px' }}>
                          <td style={{ padding: '14px 16px' }}>59</td>
                          <td style={{ padding: '14px 16px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>(-) DESTINAÇÃO DO LUCRO & REINVESTIMENTOS (RETIRADAS DOS SÓCIOS / CAPEX)</td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '15px' }}>
                            {formatCurrency(dreData.destinacao_lucro.total_destinado)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {dreData.receitas?.total_geral > 0 ? (((dreData.destinacao_lucro.total_destinado || 0) / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                          </td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#334155' }}>
                          <td style={{ padding: '10px 16px 10px 32px', color: '#94a3b8', fontFamily: 'monospace' }}>59.01</td>
                          <td style={{ padding: '10px 16px 10px 40px', color: '#4c1d95', fontWeight: 700 }}>Retiradas dos Sócios (Pró-Labore & Distribuição de Lucro)</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>
                            {formatCurrency(dreData.destinacao_lucro.retiradas_socios)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {dreData.receitas?.total_geral > 0 ? (((dreData.destinacao_lucro.retiradas_socios || 0) / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                          </td>
                        </tr>

                        {(dreData.destinacao_lucro.reforma_construcao || 0) > 0 && (
                          <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#334155' }}>
                            <td style={{ padding: '10px 16px 10px 32px', color: '#94a3b8', fontFamily: 'monospace' }}>58.01.03</td>
                            <td style={{ padding: '10px 16px 10px 40px', color: '#4c1d95', fontWeight: 700 }}>Reforma e Construção (Investimento de Capital / CapEx)</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>
                              {formatCurrency(dreData.destinacao_lucro.reforma_construcao)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                              {dreData.receitas?.total_geral > 0 ? (((dreData.destinacao_lucro.reforma_construcao || 0) / dreData.receitas.total_geral) * 100).toFixed(1) : '0.0'}%
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* 🟣 SOBRA LÍQUIDA FINAL RETIDA EM CAIXA */}
                    <tr style={{ background: '#faf5ff', borderTop: '3px double #a855f7', borderBottom: '2px solid #a855f7', color: '#581c87', fontWeight: 900, fontSize: '15px' }}>
                      <td style={{ padding: '16px' }}>(=)</td>
                      <td style={{ padding: '16px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>SOBRA LÍQUIDA RETIDA NO CAIXA DA ESCOLA</td>
                      <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '18px', color: (dreData.destinacao_lucro?.sobra_liquida_caixa ?? dreData.resultado_operacional) >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(dreData.destinacao_lucro?.sobra_liquida_caixa ?? dreData.resultado_operacional)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', color: '#7e22ce' }}>
                        {formatPercent(dreData.insights?.margem_liquida_pct)}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── ABA 2: PAINEL CFO, BREAK-EVEN & KPIS ESTRATÉGICOS ───────────────── */}
          {activeTab === 'cfo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* BANNER DE RÉGUA DE EQUILÍBRIO OPERACIONAL */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Scale size={16} /> Análise de Ponto de Equilíbrio (Break-Even)
                    </span>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                      Faturamento Mínimo para Empatar a Escola
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ background: '#f0f9ff', padding: '8px 16px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                      <span style={{ fontSize: '10px', color: '#0369a1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Empate Mensal</span>
                      <strong style={{ fontSize: '16px', color: '#0284c7' }}>{formatCurrency(breakEvenMensal)}</strong>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '8px 16px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '10px', color: '#047857', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Faturamento Mensal Real</span>
                      <strong style={{ fontSize: '16px', color: '#059669' }}>{formatCurrency(faturamentoMensalMedio)}</strong>
                    </div>
                  </div>
                </div>

                {/* BARRA DE PROGRESSO DO BREAK-EVEN */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    <span>Ponto de Equilíbrio Atingido ({Math.min(100, Math.round((faturamentoMensalMedio / (breakEvenMensal || 1)) * 100))}% da Meta)</span>
                    <span style={{ color: '#059669' }}>Folha de Proteção: +{margemSeguranca}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: '100%',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    <span>R$ 0,00 (Prejuízo)</span>
                    <span style={{ color: '#0284c7', fontWeight: 700 }}>Break-Even: {formatCurrency(breakEvenMensal)}/mês</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>Faturado: {formatCurrency(faturamentoMensalMedio)}/mês</span>
                  </div>
                </div>
              </div>

              {/* Grid de KPIs do Economista */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                
                <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>EBITDA Real</span>
                    <Cpu size={18} color="#6366f1" />
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#4f46e5', margin: 0 }}>
                    {formatCurrency(dreData.metricas_chave?.ebitda || dreData.resultado_operacional)}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Geração efetiva de caixa operacional da instituição
                  </p>
                </div>

                <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Capacidade Mensal de Retirada</span>
                    <Wallet size={18} color="#059669" />
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#059669', margin: 0 }}>
                    {formatCurrency(dreData.metricas_chave?.capacidade_retirada_mensal || ((dreData.resultado_operacional * 0.7) / 12))} / mês
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Limite recomendado por sócio para manter reserva de caixa
                  </p>
                </div>

                <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Retiradas dos Sócios (Ano)</span>
                    <UserCheck size={18} color="#7c3aed" />
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#7c3aed', margin: 0 }}>
                    {formatCurrency(dreData.destinacao_lucro?.retiradas_socios || 0)}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Valor total retirado pelos mantenedores a partir do lucro
                  </p>
                </div>

              </div>

            </div>
          )}

          {/* ─── ABA 3: GRÁFICOS INTERATIVOS E EVOLUÇÃO MENSAL ──────────────────── */}
          {activeTab === 'graficos' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
              
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={20} color="#4f46e5" />
                  {dreData.evolucao_mensal && dreData.evolucao_mensal.length > 0 ? 'Evolução Mensal (Janeiro a Dezembro)' : 'Comparativo Geral: Receita vs Despesa Operacional'}
                </h3>
                <div style={{ height: '320px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="categoria" stroke="#64748b" />
                      <YAxis stroke="#64748b" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                      <Legend />
                      <Bar dataKey="Receitas" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="Resultado" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChartIcon size={20} color="#059669" /> Distribuição das Maiores Despesas Operacionais (OPEX)
                </h3>
                <div style={{ height: '320px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) => `${(name || '').slice(0, 15)}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* ─── ABA 4: INSIGHTS DO CONTADOR IA REFORMULADO ───────────────────── */}
          {activeTab === 'insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #311b92 100%)',
                borderRadius: '16px',
                padding: '28px',
                color: '#ffffff',
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.25)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                    <Lightbulb size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Parecer de Inteligência Financeira e Contábil</h3>
                    <p style={{ fontSize: '12px', color: '#c7d2fe', margin: 0 }}>Diagnóstico gerencial completo emitido pela IA Contador</p>
                  </div>
                </div>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#f1f5f9', margin: 0, paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {dreData.insights?.analise_resumida}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #fecaca', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Alertas & Pontos de Atenção
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dreData.insights?.alertas?.map((alerta, idx) => (
                      <div key={idx} style={{ padding: '12px 16px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fee2e2', fontSize: '13px', color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', marginTop: '6px', flexShrink: 0 }} />
                        <span>{alerta}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #a7f3d0', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} /> Recomendações Estratégicas
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dreData.insights?.recomendacoes?.map((rec, idx) => (
                      <div key={idx} style={{ padding: '12px 16px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #d1fae5', fontSize: '13px', color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <ArrowRight size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── ABA 5: HISTÓRICO COMPLETO COM BOTÃO RENOMEAR E NUVEM / LOCAL ────── */}
          {activeTab === 'historico' && (
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Histórico de Arquivos DRE Analisados</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Gerencie, renomeie ou recarregue seus balancetes salvos</p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                  {historico.length} relatórios salvos
                </span>
              </div>

              {historico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                  <Calendar size={36} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', margin: 0 }}>Nenhum relatório salvo no histórico ainda.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historico.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '16px 20px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        {editingItem?.id === item.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                            <input
                              type="text"
                              value={editingItem.nome}
                              onChange={(e) => setEditingItem({ ...editingItem, nome: e.target.value })}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1', fontSize: '13px', color: '#0f172a', outline: 'none' }}
                            />
                            <button
                              onClick={() => handleRenomearItem(item.id, editingItem.nome)}
                              style={{ padding: '4px 10px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              style={{ padding: '4px 10px', background: '#cbd5e1', color: '#334155', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{item.nome_arquivo}</h4>
                            <button
                              onClick={() => setEditingItem({ id: item.id, nome: item.nome_arquivo })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }}
                              title="Renomear este relatório"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        )}

                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                          {item.periodo_descricao} • Criado em {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                        </p>

                        <div style={{ fontSize: '12px', display: 'flex', gap: '16px', marginTop: '8px' }}>
                          <span style={{ color: '#059669', fontWeight: 700 }}>Receita: {formatCurrency(item.total_receitas)}</span>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>Despesa: {formatCurrency(item.total_despesas)}</span>
                          <span style={{ color: '#2563eb', fontWeight: 900 }}>Lucro: {formatCurrency(item.resultado_liquido)}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleCarregarHistorico(item)}
                          style={{ padding: '8px 16px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Eye size={14} /> Visualizar
                        </button>
                        <button
                          onClick={(e) => handleExcluirHistorico(item.id, e)}
                          style={{ padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  )
}
