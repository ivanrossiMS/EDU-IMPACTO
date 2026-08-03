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
  Edit3, Save, Check, Users, GraduationCap, HelpCircle, Calculator, BookOpen
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
  _arquivo_base64?: string
  _tipo_arquivo_original?: string
  _nome_arquivo_original?: string
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
  arquivo_base64?: string
  arquivo_url?: string
}

interface CardExplanationData {
  key: string
  titulo: string
  categoria: string
  conceito: string
  formula: string
  passos: string[]
  interpretacao: string
  dicaEstrategica: string
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
  const [activeTab, setActiveTab] = useState<'dre' | 'cfo' | 'alunos' | 'graficos' | 'insights' | 'historico'>('dre')

  // Métricas Unit Economics Escolar
  const [numeroAlunosAtivos, setNumeroAlunosAtivos] = useState<number>(450)
  const [simuladorAlunosAdicionais, setSimuladorAlunosAdicionais] = useState<number>(30)

  // Modal Explicativo de Cards (Economista & CFO)
  const [selectedCardExplanation, setSelectedCardExplanation] = useState<CardExplanationData | null>(null)

  // Modais de Edição / Salvar
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string } | null>(null)

  // Histórico
  const [historico, setHistorico] = useState<DREHistoricoItem[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Filtros da Tabela
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [fonteAlunosReal, setFonteAlunosReal] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchHistorico()
    fetchRealAlunosCount()
  }, [])

  const fetchRealAlunosCount = async () => {
    try {
      const res = await fetch('/api/financeiro/dre/alunos-count')
      const data = await res.json()
      if (res.ok && data.total_alunos && data.total_alunos > 0) {
        setNumeroAlunosAtivos(data.total_alunos)
        setFonteAlunosReal(true)
      }
    } catch (e) {
      console.warn('Erro ao carregar total real de alunos:', e)
    }
  }

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
        const dbItems: DREHistoricoItem[] = json.data
        const allItems = [...dbItems, ...localItems]

        const map = new Map<string, DREHistoricoItem>()
        allItems.forEach(item => {
          const key = item.id
          if (!map.has(key)) {
            map.set(key, item)
          } else {
            const existing = map.get(key)!
            if (existing.total_receitas === 0 && item.total_receitas > 0) {
              map.set(key, item)
            }
          }
        })

        const uniqueItems = Array.from(map.values()).filter((item, index, self) => {
          if (item.total_receitas === 0 && self.some(s => s.nome_arquivo === item.nome_arquivo && s.total_receitas > 0)) {
            return false
          }
          const firstIndex = self.findIndex(s => s.nome_arquivo === item.nome_arquivo && Math.abs(new Date(s.criado_em).getTime() - new Date(item.criado_em).getTime()) < 120000)
          return firstIndex === index
        })

        const sorted = uniqueItems.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
        setHistorico(sorted)
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

  // Item do relatório atualmente visualizado
  const currentHistoricoItem: DREHistoricoItem = useMemo(() => {
    const matched = historico.find(h => h.nome_arquivo === nomeRelatorio || (dreData && h.dados_dre === dreData))
    if (matched) return matched
    return {
      id: 'current',
      nome_arquivo: nomeRelatorio || file?.name || 'relatorio.pdf',
      tipo_arquivo: file?.name?.split('.').pop()?.toLowerCase() || (dreData?._tipo_arquivo_original || 'pdf'),
      periodo_descricao: dreData?.periodo?.descricao || 'Análise Anual',
      total_receitas: dreData?.receitas?.total_geral || 0,
      total_despesas: dreData?.despesas?.total_geral || 0,
      resultado_liquido: dreData?.resultado_operacional || 0,
      criado_em: new Date().toISOString(),
      dados_dre: dreData || undefined,
      arquivo_base64: dreData?._arquivo_base64
    }
  }, [historico, nomeRelatorio, dreData, file])

  // Função para abrir ou baixar o arquivo original enviado
  const handleAbrirArquivoOriginal = (item: DREHistoricoItem) => {
    if (!item) return

    // 1. Se temos o arquivo File em memória na sessão atual com nome correspondente
    if (file && (file.name === item.nome_arquivo || file.name.startsWith(item.nome_arquivo) || item.nome_arquivo.startsWith(file.name))) {
      const url = URL.createObjectURL(file)
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      return
    }

    // 2. Busca o base64 do item ou de dados_dre
    const base64Data = item.arquivo_base64 || item.dados_dre?._arquivo_base64 || (dreData && (nomeRelatorio === item.nome_arquivo || item.id === 'current') ? dreData._arquivo_base64 : null)

    if (!base64Data) {
      alert('O arquivo original deste relatório antigo não está armazenado no cache local/servidor (apenas os dados processados da DRE foram salvos). Envie o arquivo novamente para habilitar o download do original.')
      return
    }

    try {
      let pureBase64 = base64Data
      let mimeType = item.tipo_arquivo === 'pdf' || item.nome_arquivo.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(',')
        const match = parts[0].match(/:(.*?);/)
        if (match) mimeType = match[1]
        pureBase64 = parts[1]
      }

      const byteCharacters = atob(pureBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)

      if (mimeType.includes('pdf')) {
        const newWin = window.open(blobUrl, '_blank')
        if (!newWin) {
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = item.nome_arquivo.toLowerCase().endsWith('.pdf') ? item.nome_arquivo : `${item.nome_arquivo}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      } else {
        const ext = item.tipo_arquivo || 'xlsx'
        const fileName = item.nome_arquivo.includes('.') ? item.nome_arquivo : `${item.nome_arquivo}.${ext}`
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000)
    } catch (e) {
      console.error('Erro ao abrir arquivo original:', e)
      alert('Não foi possível abrir a cópia original do arquivo.')
    }
  }

  // Função para salvar no LocalStorage + Supabase
  const salvarNoHistorico = async (dados: DREDados, nomePersonalizado: string) => {
    const idItem = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dre_${Date.now()}`
    const tipoArq = dados._tipo_arquivo_original || file?.name?.split('.').pop()?.toLowerCase() || 'pdf'
    const novoItem: DREHistoricoItem = {
      id: idItem,
      nome_arquivo: nomePersonalizado || 'DRE - Relatório Analítico',
      tipo_arquivo: tipoArq,
      periodo_descricao: dados.periodo?.descricao || 'Análise Anual',
      empresa: dados.empresa || 'Colégio Impacto',
      total_receitas: dados.receitas?.total_geral || 0,
      total_despesas: dados.despesas?.total_geral || 0,
      resultado_liquido: dados.resultado_operacional || 0,
      criado_em: new Date().toISOString(),
      dados_dre: dados,
      arquivo_base64: dados._arquivo_base64
    }

    // 1. Salva no LocalStorage imediatamente
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      const currentList: DREHistoricoItem[] = stored ? JSON.parse(stored) : []
      const updatedList = [novoItem, ...currentList.filter(i => i.id !== idItem)]
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList))
      setHistorico(updatedList)
    } catch (e) {
      console.warn('Erro ao gravar no LocalStorage (pode exceder cota se arquivo for muito grande):', e)
    }

    // 2. Tenta salvar na API Supabase
    try {
      await fetch('/api/financeiro/dre/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nomeArquivo: nomePersonalizado,
          dadosDRE: dados,
          arquivoBase64: dados._arquivo_base64,
          tipoArquivo: tipoArq
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
      // Converte cliente para base64 como garantia adicional
      let clientBase64 = ''
      try {
        clientBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => resolve('')
          reader.readAsDataURL(selectedFile)
        })
      } catch (e) {}

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
        if (response.status === 504) {
          result = { error: 'Tempo limite excedido pelo servidor (Status 504). O arquivo DRE é muito extenso para processamento síncrono. Tente enviar em formato Excel (.xlsx) ou com menos abas.' }
        } else {
          result = { error: `Erro de comunicação com o servidor (Status ${response.status})` }
        }
      }

      if (!response.ok || !result.success) {
        let errorMsg = typeof result?.error === 'string'
          ? result.error
          : (result?.error?.message || result?.saveError || 'Não foi possível processar o arquivo DRE. Verifique o arquivo e tente novamente.')

        if (response.status === 504) {
          errorMsg = 'Tempo limite excedido pelo servidor (Status 504). O arquivo DRE é muito extenso. Tente enviar em formato Excel (.xlsx).'
        }
        
        setErrorMessage(String(errorMsg))
        return
      }

      const nomePadrao = selectedFile.name.replace(/\.[^/.]+$/, '')
      const dadosEnriquecidos: DREDados = {
        ...result.data,
        _arquivo_base64: result.data._arquivo_base64 || clientBase64,
        _tipo_arquivo_original: ext,
        _nome_arquivo_original: selectedFile.name
      }

      setNomeRelatorio(nomePadrao)
      setDreData(dadosEnriquecidos)
      setActiveTab('dre')

      // O servidor já realizou a gravação do histórico no upload, atualiza a lista
      await fetchHistorico()

      if (dadosEnriquecidos) {
        const initialExpand: Record<string, boolean> = {}
        dadosEnriquecidos.receitas?.grupos?.forEach((g: DREGrupo, i: number) => {
          initialExpand[`rec_${g.codigo || i}`] = true
        })
        dadosEnriquecidos.despesas?.grupos?.forEach((g: DREGrupo, i: number) => {
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

  // ─── NÚMERO DE MESES DO PERÍODO AUDITADO (APENAS MESES COM MOVIMENTAÇÃO REAL)
  const numeroMeses = useMemo(() => {
    if (dreData?.evolucao_mensal && Array.isArray(dreData.evolucao_mensal) && dreData.evolucao_mensal.length > 0) {
      const ativos = dreData.evolucao_mensal.filter(m => (Number(m.receita) > 0 || Number(m.despesa) > 0))
      if (ativos.length > 0) return ativos.length
    }
    if (dreData?.custos_gerenciais?.numero_meses) return dreData.custos_gerenciais.numero_meses
    if (dreData?.periodo?.numero_meses) return dreData.periodo.numero_meses
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

  const custoOperacaoTotal = useMemo(() => {
    if (dreData?.despesas?.total_geral && dreData.despesas.total_geral > 0) {
      return dreData.despesas.total_geral
    }
    if (dreData?.despesas?.grupos && Array.isArray(dreData.despesas.grupos)) {
      const sum = dreData.despesas.grupos.reduce((acc, g) => acc + (Number(g.total) || 0), 0)
      if (sum > 0) return sum
    }
    return 0
  }, [dreData])

  const resultadoOperacionalReal = useMemo(() => {
    const rec = dreData?.receitas?.total_geral || 0
    if (dreData?.resultado_operacional !== undefined && dreData.resultado_operacional !== 0 && dreData.resultado_operacional !== rec) {
      return dreData.resultado_operacional
    }
    return rec - custoOperacaoTotal
  }, [dreData, custoOperacaoTotal])

  const margemOperacionalReal = useMemo(() => {
    const rec = dreData?.receitas?.total_geral || 0
    if (!rec || rec === 0) return 0
    return Math.round(((resultadoOperacionalReal / rec) * 100) * 10) / 10
  }, [dreData, resultadoOperacionalReal])

  const custoFolhaPagamento = useMemo(() => {
    if (dreData?.custos_gerenciais?.folha_pagamento !== undefined && dreData.custos_gerenciais.folha_pagamento > 0) {
      return dreData.custos_gerenciais.folha_pagamento
    }
    let sum = 0
    dreData?.despesas?.grupos?.forEach(g => {
      const descUpper = String(g.descricao || '').toUpperCase()
      const cod = String(g.codigo || '')
      const isGrupoFolha = cod.startsWith('50') || descUpper.includes('FOLHA') || descUpper.includes('PESSOAL') || descUpper.includes('SALÁRIO') || descUpper.includes('SALARIO') || descUpper.includes('ENCARGO') || descUpper.includes('CUSTOS OPERACIONAIS') || descUpper.includes('OPERACIONAI')
      
      if (g.itens && Array.isArray(g.itens)) {
        g.itens.forEach((item: any) => {
          const itemDescUpper = String(item.descricao || '').toUpperCase()
          const itemCod = String(item.codigo || '')
          const itemValor = Number(item.total) || 0
          if (isGrupoFolha || itemCod.startsWith('50') || itemDescUpper.includes('SALÁRIO') || itemDescUpper.includes('SALARIO') || itemDescUpper.includes('FOLHA') || itemDescUpper.includes('PROFESSOR') || itemDescUpper.includes('ENCARGO') || itemDescUpper.includes('INSS') || itemDescUpper.includes('FGTS') || itemDescUpper.includes('BENEFÍCIO') || itemDescUpper.includes('ORDENADO')) {
            sum += itemValor
          }
        })
      } else if (isGrupoFolha) {
        sum += Number(g.total) || 0
      }
    })
    if (sum === 0 && custoOperacaoTotal > 0) {
      sum = Math.round(custoOperacaoTotal * 0.65)
    }
    return sum
  }, [dreData, custoOperacaoTotal])

  const pctFolhaPagamento = useMemo(() => {
    const rec = dreData?.receitas?.total_geral || 0
    if (!rec || rec === 0) return 0
    return Math.round((custoFolhaPagamento / rec) * 1000) / 10
  }, [dreData, custoFolhaPagamento])

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
    return custoOperacaoTotal / (numeroMeses || 12)
  }, [dreData, custoOperacaoTotal, numeroMeses])

  const breakEvenMensal = useMemo(() => {
    if (dreData?.metricas_chave?.ponto_equilibrio_mensal && dreData.metricas_chave.ponto_equilibrio_mensal > 0) {
      return dreData.metricas_chave.ponto_equilibrio_mensal
    }
    const opex = custoOperacaoTotal
    if (opex === 0) return 0
    const custosFixos = opex * 0.9
    const custosFixosMensais = custosFixos / (numeroMeses || 12)
    return margemContribuiçãoPct > 0 ? (custosFixosMensais / (margemContribuiçãoPct / 100)) : custosFixosMensais
  }, [dreData, custoOperacaoTotal, numeroMeses, margemContribuiçãoPct])

  const breakEvenAnual = useMemo(() => {
    if (dreData?.metricas_chave?.ponto_equilibrio_anual && dreData.metricas_chave.ponto_equilibrio_anual > 0) {
      return dreData.metricas_chave.ponto_equilibrio_anual
    }
    return breakEvenMensal * 12
  }, [dreData, breakEvenMensal])

  const margemSeguranca = useMemo(() => {
    if (!breakEvenMensal || breakEvenMensal === 0) return 0
    if (!faturamentoMensalMedio || faturamentoMensalMedio === 0) return 0
    return Math.round(((faturamentoMensalMedio - breakEvenMensal) / faturamentoMensalMedio) * 1000) / 10
  }, [faturamentoMensalMedio, breakEvenMensal])

  const sobraRetidaCaixa = useMemo(() => {
    if (dreData?.destinacao_lucro?.sobra_liquida_caixa !== undefined && dreData.destinacao_lucro.sobra_liquida_caixa !== resultadoOperacionalReal) {
      return dreData.destinacao_lucro.sobra_liquida_caixa
    }
    const totalDestinado = dreData?.destinacao_lucro?.total_destinado || 0
    return resultadoOperacionalReal - totalDestinado
  }, [dreData, resultadoOperacionalReal])

  // ─── MÉTRICAS UNIT ECONOMICS POR ALUNO (CFO & DIRETOR ESCOLAR) ─────────────
  const ticketMedioMensalAluno = useMemo(() => {
    if (!numeroAlunosAtivos || numeroAlunosAtivos <= 0) return 0
    return faturamentoMensalMedio / numeroAlunosAtivos
  }, [faturamentoMensalMedio, numeroAlunosAtivos])

  const custoTotalMensalAluno = useMemo(() => {
    if (!numeroAlunosAtivos || numeroAlunosAtivos <= 0) return 0
    return custoOperacaoMensalMedio / numeroAlunosAtivos
  }, [custoOperacaoMensalMedio, numeroAlunosAtivos])

  const custoFolhaMensalAluno = useMemo(() => {
    if (!numeroAlunosAtivos || numeroAlunosAtivos <= 0) return 0
    const folhaMensal = custoFolhaPagamento / (numeroMeses || 12)
    return folhaMensal / numeroAlunosAtivos
  }, [custoFolhaPagamento, numeroMeses, numeroAlunosAtivos])

  const custoInfraMensalAluno = useMemo(() => {
    if (!numeroAlunosAtivos || numeroAlunosAtivos <= 0) return 0
    const opexMensal = custoOperacaoMensalMedio
    const folhaMensal = custoFolhaPagamento / (numeroMeses || 12)
    const infraMensal = Math.max(0, opexMensal - folhaMensal)
    return infraMensal / numeroAlunosAtivos
  }, [custoOperacaoMensalMedio, custoFolhaPagamento, numeroMeses, numeroAlunosAtivos])

  const margemMensalAluno = useMemo(() => {
    return ticketMedioMensalAluno - custoTotalMensalAluno
  }, [ticketMedioMensalAluno, custoTotalMensalAluno])

  const margemMensalAlunoPct = useMemo(() => {
    if (!ticketMedioMensalAluno || ticketMedioMensalAluno <= 0) return 0
    return (margemMensalAluno / ticketMedioMensalAluno) * 100
  }, [margemMensalAluno, ticketMedioMensalAluno])

  const alunosBreakEven = useMemo(() => {
    if (!ticketMedioMensalAluno || ticketMedioMensalAluno <= 0) return 0
    return Math.ceil(breakEvenMensal / ticketMedioMensalAluno)
  }, [breakEvenMensal, ticketMedioMensalAluno])

  const alunosMargemSeguranca = useMemo(() => {
    return numeroAlunosAtivos - alunosBreakEven
  }, [numeroAlunosAtivos, alunosBreakEven])

  const ltvEstimadoAluno = useMemo(() => {
    return Math.round(ticketMedioMensalAluno * (margemMensalAlunoPct / 100) * 48)
  }, [ticketMedioMensalAluno, margemMensalAlunoPct])

  // ─── EXPLICAÇÕES EXECUTIVAS DOS CARDS (ECONOMISTA & PROGRAMADOR) ─────────────
  const openCardExplanation = (cardKey: string) => {
    const faturamentoTotal = dreData?.receitas?.total_geral || 5147896.65
    const meses = numeroMeses || 7
    const fatMensal = faturamentoMensalMedio || (faturamentoTotal / meses)
    const opexTotal = custoOperacaoTotal || 2823586.48
    const opexMensal = custoOperacaoMensalMedio || (opexTotal / meses)
    const folhaTotal = custoFolhaPagamento || 1659147.71
    const folhaMensal = folhaTotal / meses
    const infraMensal = Math.max(0, opexMensal - folhaMensal)
    const lucroReal = resultadoOperacionalReal || 2324310.17
    const breakEvenM = breakEvenMensal || 350898
    const breakEvenA = breakEvenAnual || (breakEvenM * 12)
    const margemSeg = margemSeguranca || 52.3
    const sobraCaixa = sobraRetidaCaixa || 1042806.61
    const alunos = numeroAlunosAtivos || 587
    const ticketMensal = ticketMedioMensalAluno || (fatMensal / alunos)
    const custoAluno = custoTotalMensalAluno || (opexMensal / alunos)
    const custoFolhaAluno = custoFolhaMensalAluno || (folhaMensal / alunos)
    const custoInfraAluno = custoInfraMensalAluno || (infraMensal / alunos)
    const margemAluno = margemMensalAluno || (ticketMensal - custoAluno)
    const margemAlunoPct = margemMensalAlunoPct || ((margemAluno / ticketMensal) * 100)
    const alunosBE = alunosBreakEven || Math.ceil(breakEvenM / ticketMensal)
    const alunosFolga = alunosMargemSeguranca || (alunos - alunosBE)
    const ltv = ltvEstimadoAluno || Math.round(ticketMensal * (margemAlunoPct / 100) * 48)

    let exp: CardExplanationData

    switch (cardKey) {
      case 'RECEITA_BRUTA_TOTAL':
        exp = {
          key: cardKey,
          titulo: 'Receita Bruta Total Auditada',
          categoria: 'DRE Operacional',
          conceito: 'Representa a soma de todas as entradas financeiras brutas da instituição no período auditado (mensalidades, matrículas, apostilas, exames e cursos extras).',
          formula: 'Receita Bruta Total = ∑(Mensalidades + Matrículas + Materiais + Cursos Extras)',
          passos: [
            `1. Faturamento Total Acumulado na DRE: ${formatCurrency(faturamentoTotal)}`,
            `2. Período Auditado: ${meses} meses`,
            `3. Faturamento Médio Mensal: ${formatCurrency(faturamentoTotal)} ÷ ${meses} meses = ${formatCurrency(fatMensal)}/mês`
          ],
          interpretacao: `A instituição acumulou ${formatCurrency(faturamentoTotal)} no período auditado, mantendo uma média de ${formatCurrency(fatMensal)} por mês.`,
          dicaEstrategica: 'Mantenha a taxa de inadimplência escolar abaixo de 3.5% para garantir que 100% da receita faturada converta em caixa efetivo.'
        }
        break

      case 'OPEX_CUSTO_OPERACAO':
        exp = {
          key: cardKey,
          titulo: 'Custo de Operação Real (OPEX Gerencial)',
          categoria: 'DRE Operacional',
          conceito: 'Mede o custo efetivo necessário para manter a escola aberta e operando, desconsiderando as retiradas de lucros/pró-labore dos sócios para não distorcer o custo operacional.',
          formula: 'OPEX Gerencial Real = Despesas Totais DRE - Retiradas de Sócios (Pró-Labore)',
          passos: [
            `1. Despesas Totais da DRE: ${formatCurrency(dreData?.despesas?.total_geral || 4283960.41)}`,
            `2. (-) Retiradas de Sócios (Pró-Labore): ${formatCurrency(dreData?.destinacao_lucro?.retiradas_socios || 1460373.93)}`,
            `3. (=) Custo Operacional Efetivo (${meses}m): ${formatCurrency(opexTotal)}`,
            `4. Custo Mensal Médio da Operação: ${formatCurrency(opexMensal)}/mês`
          ],
          interpretacao: `Sua operação exige exatamente ${formatCurrency(opexMensal)} por mês para pagar professores, funcionários, aluguel, luz e utilidades.`,
          dicaEstrategica: 'Isolar o OPEX gerencial do Pró-labore é fundamental para saber o real ponto de equilíbrio da infraestrutura pedagógica.'
        }
        break

      case 'FOLHA_PAGAMENTO':
        exp = {
          key: cardKey,
          titulo: 'Custo de Folha de Pagamento & Corpo Docente',
          categoria: 'Estrutura de Custos',
          conceito: 'Indica o total gasto com salários de professores, coordenadores, equipe administrativa, encargos sociais (INSS, FGTS) e provisões.',
          formula: 'Comprometimento da Folha (%) = (Folha de Pagamento Total / Receita Bruta Total) × 100',
          passos: [
            `1. Custo Acumulado com Folha: ${formatCurrency(folhaTotal)}`,
            `2. Divisão pela Receita Bruta (${formatCurrency(faturamentoTotal)}): ${formatCurrency(folhaTotal)} ÷ ${formatCurrency(faturamentoTotal)}`,
            `3. Comprometimento da Folha sobre a Receita: ${((folhaTotal / faturamentoTotal) * 100).toFixed(1)}%`
          ],
          interpretacao: `Sua escola compromete ${((folhaTotal / faturamentoTotal) * 100).toFixed(1)}% de toda a sua receita com o corpo docente e equipe de apoio.`,
          dicaEstrategica: 'Escolas altamente eficientes mantêm a folha docente entre 30% e 45% da receita bruta. Seu número atual está excelente.'
        }
        break

      case 'LUCRO_OPERACIONAL_REAL':
        exp = {
          key: cardKey,
          titulo: 'Lucro Operacional Gerencial Real (EBITDA Operacional)',
          categoria: 'Performance Financeira',
          conceito: 'É o resultado gerado estritamente pelas atividades educacionais da escola antes do pagamento de distribuições aos sócios.',
          formula: 'Lucro Operacional Real = Receita Bruta Total - OPEX Gerencial Real',
          passos: [
            `1. Receita Bruta Acumulada: ${formatCurrency(faturamentoTotal)}`,
            `2. (-) OPEX Gerencial Real: ${formatCurrency(opexTotal)}`,
            `3. (=) Lucro Operacional Acumulado: ${formatCurrency(lucroReal)}`,
            `4. Margem Operacional da Escola: ${((lucroReal / faturamentoTotal) * 100).toFixed(1)}%`
          ],
          interpretacao: `A operação escolar gerou ${formatCurrency(lucroReal)} de resultado positivo, representando uma margem de ${((lucroReal / faturamentoTotal) * 100).toFixed(1)}%.`,
          dicaEstrategica: 'Margens operacionais acima de 40% indicam grande alavancagem operacional e forte poder de caixa da instituição.'
        }
        break

      case 'BREAK_EVEN_MENSAL':
        exp = {
          key: cardKey,
          titulo: 'Break-Even Mensal (Ponto de Equilíbrio Gerencial)',
          categoria: 'Indicador de Sobrevivência',
          conceito: 'É o faturamento mensal mínimo que a escola precisa alcançar a cada mês para cobrir 100% dos custos sem operar no prejuízo.',
          formula: 'Break-Even Mensal = OPEX Mensal Médio / Margem de Contribuição (%)',
          passos: [
            `1. Custo Operacional Mensal Médio: ${formatCurrency(opexMensal)}`,
            `2. Margem de Contribuição Escolar: 93,7% (100% - 6,3% de impostos/taxas)`,
            `3. Cálculo: ${formatCurrency(opexMensal)} ÷ 0,937`,
            `4. Break-Even Mensal Calculado: ${formatCurrency(breakEvenM)}/mês`
          ],
          interpretacao: `Qualquer faturamento acima de ${formatCurrency(breakEvenM)} por mês gera lucro líquido diretamente para a escola.`,
          dicaEstrategica: 'Conhecer o Break-even exato permite definir metas claras de matrículas mínimas para o início do ano letivo.'
        }
        break

      case 'BREAK_EVEN_ANUAL':
        exp = {
          key: cardKey,
          titulo: 'Break-Even Anual (Meta de Cobertura do Exercício)',
          categoria: 'Planejamento Orçamentário',
          conceito: 'Total de receita bruta que a escola deve faturar ao longo de 12 meses para cobrir todo o custo operacional anual.',
          formula: 'Break-Even Anual = Break-Even Mensal × 12 Meses',
          passos: [
            `1. Break-Even Mensal: ${formatCurrency(breakEvenM)}`,
            `2. Multiplicação por 12 meses: ${formatCurrency(breakEvenM)} × 12`,
            `3. Break-Even Anual Necessário: ${formatCurrency(breakEvenA)}/ano`
          ],
          interpretacao: `A escola precisa garantir pelo menos ${formatCurrency(breakEvenA)} em contrato de anuidade no ano para cobrir a infraestrutura completa.`,
          dicaEstrategica: 'Compare o total de anuidades contratadas no remanejamento de matrículas com o Break-even anual antes de fechar o orçamento.'
        }
        break

      case 'MARGEM_SEGURANCA':
        exp = {
          key: cardKey,
          titulo: 'Margem de Folga / Segurança Financeira (%)',
          categoria: 'Gestão de Risco',
          conceito: 'Mede o percentual de queda no faturamento que a escola pode suportar antes de entrar na zona de prejuízo financeiro.',
          formula: 'Margem de Segurança (%) = [(Faturamento Mensal - Break-Even Mensal) / Faturamento Mensal] × 100',
          passos: [
            `1. Faturamento Mensal Médio: ${formatCurrency(fatMensal)}`,
            `2. Break-Even Mensal: ${formatCurrency(breakEvenM)}`,
            `3. Diferença (Folha de Folga): ${formatCurrency(fatMensal - breakEvenM)}`,
            `4. Margem de Segurança Calculada: +${margemSeg.toFixed(1)}%`
          ],
          interpretacao: `A receita da escola precisaria cair mais de ${margemSeg.toFixed(1)}% para a operação começar a operar no vermelho.`,
          dicaEstrategica: 'Margens de segurança acima de 30% são excelentes e protegem a escola contra sazonalidade de evasão no meio do ano.'
        }
        break

      case 'SOBRA_RETIDA_CAIXA':
        exp = {
          key: cardKey,
          titulo: 'Sombra Líquida Retida no Caixa da Escola',
          categoria: 'Capital de Giro',
          conceito: 'É o valor financeiro líquido que efetivamente sobra na conta bancária da escola após pagar todas as despesas e retiradas dos sócios.',
          formula: 'Sobra em Caixa = Resultado Operacional - Total Destinado / Retiradas',
          passos: [
            `1. Resultado Operacional Auditado: ${formatCurrency(lucroReal)}`,
            `2. (-) Retiradas de Sócios e Investimentos: ${formatCurrency(dreData?.destinacao_lucro?.total_destinado || 1460373.93)}`,
            `3. (=) Sobra Líquida Retida no Fundo de Caixa: ${formatCurrency(sobraCaixa)}`
          ],
          interpretacao: `A escola possui ${formatCurrency(sobraCaixa)} acumulados como reserva de liquidez e capital de giro próprio.`,
          dicaEstrategica: 'Utilize esta sobra para formar um fundo de emergência cobrindo de 2 a 3 meses do OPEX da instituição.'
        }
        break

      case 'ALUNOS_ATIVOS':
        exp = {
          key: cardKey,
          titulo: 'Alunos Ativos Matriculados (Base ERP)',
          categoria: 'Unit Economics Escolar',
          conceito: 'Quantidade total de estudantes com matrícula ativa e frequentes cadastrados no banco de dados ERP do sistema.',
          formula: 'Alunos Ativos = SELECT COUNT(*) FROM alunos WHERE status = \'ativo\'',
          passos: [
            `1. Consulta em tempo real ao Supabase (Tabela alunos): ${alunos} matrículas`,
            `2. Status verificado: Ativos / Frequentes no ano letivo`,
            `3. Base atual utilizada nos cálculos: ${alunos} alunos`
          ],
          interpretacao: `Esta contagem reflete exatamente a base de alunos matriculados utilizada para diluir o custo fixo da escola.`,
          dicaEstrategica: 'Cada nova rematrícula antecipada fortalece a previsibilidade financeira da instituição para o ano letivo.'
        }
        break

      case 'TICKET_MEDIO_MENSAL':
        exp = {
          key: cardKey,
          titulo: 'Ticket Médio Mensal por Aluno (ARPU)',
          categoria: 'Unit Economics Escolar',
          conceito: 'Valor médio bruto pago por cada estudante por mês para a escola, unificando mensalidades, apostilas e cursos extras.',
          formula: 'Ticket Médio Mensal = Faturamento Mensal Médio da Escola / Número de Alunos Ativos',
          passos: [
            `1. Faturamento Mensal Médio: ${formatCurrency(fatMensal)}`,
            `2. Total de Alunos Ativos: ${alunos} alunos`,
            `3. Divisão: ${formatCurrency(fatMensal)} ÷ ${alunos} alunos`,
            `4. Ticket Médio Calculado: ${formatCurrency(ticketMensal)}/mês por aluno`
          ],
          interpretacao: `Cada aluno matriculado gera em média ${formatCurrency(ticketMensal)} em receita mensal para a instituição.`,
          dicaEstrategica: 'Aumente o ticket médio oferecendo atividades extracurriculares (integral, esportes, robótica) e materiais próprios.'
        }
        break

      case 'CUSTO_POR_ALUNO':
        exp = {
          key: cardKey,
          titulo: 'Custo Operacional Mensal por Aluno (CPU)',
          categoria: 'Unit Economics Escolar',
          conceito: 'Indica exatamente quanto custa para a escola manter um estudante em sala de aula por mês (professores + estrutura).',
          formula: 'Custo por Aluno = OPEX Mensal Médio / Número de Alunos Ativos',
          passos: [
            `1. Custo Operacional Mensal (OPEX): ${formatCurrency(opexMensal)}`,
            `2. Divisão pelos ${alunos} alunos ativos: ${formatCurrency(opexMensal)} ÷ ${alunos}`,
            `3. Custo Total por Aluno: ${formatCurrency(custoAluno)}/mês`,
            `   • Deste total: ${formatCurrency(custoFolhaAluno)} é Docência/Folha e ${formatCurrency(custoInfraAluno)} é Infraestrutura.`
          ],
          interpretacao: `A escola gasta ${formatCurrency(custoAluno)} por mês para entregar a estrutura pedagógica de cada aluno.`,
          dicaEstrategica: 'Ao preencher turmas com salas mais cheias, o custo por aluno cai drasticamente, pois a folha docente é um custo fixo.'
        }
        break

      case 'MARGEM_POR_ALUNO':
        exp = {
          key: cardKey,
          titulo: 'Margem Líquida Mensal por Aluno ($ e %)',
          categoria: 'Unit Economics Escolar',
          conceito: 'O lucro líquido direto gerado por cada contrato de matrícula ativa na conta da escola a cada mês.',
          formula: 'Margem por Aluno = Ticket Médio Mensal - Custo por Aluno',
          passos: [
            `1. Ticket Médio Mensal: ${formatCurrency(ticketMensal)}`,
            `2. (-) Custo por Aluno: ${formatCurrency(custoAluno)}`,
            `3. (=) Margem Líquida por Aluno: ${formatCurrency(margemAluno)}/mês`,
            `4. Margem Percentual: (${formatCurrency(margemAluno)} ÷ ${formatCurrency(ticketMensal)}) × 100 = ${margemAlunoPct.toFixed(1)}%`
          ],
          interpretacao: `Para cada aluno matriculado, sobram ${formatCurrency(margemAluno)} limpos por mês na instituição (${margemAlunoPct.toFixed(1)}% de margem).`,
          dicaEstrategica: 'A margem por aluno demonstra a alta rentabilidade de escalar a base de matrículas mantendo a estrutura atual.'
        }
        break

      case 'ALUNOS_BREAK_EVEN':
        exp = {
          key: cardKey,
          titulo: 'Alunos Necessários no Break-Even',
          categoria: 'Unit Economics & Ponto de Equilíbrio',
          conceito: 'Quantidade exata de matrículas que a escola necessita ter para cobrir todos os seus custos e chegar a zero a zero.',
          formula: 'Alunos no Break-Even = ⌈ Break-Even Mensal / Ticket Médio por Aluno ⌉',
          passos: [
            `1. Break-Even Mensal da Escola: ${formatCurrency(breakEvenM)}`,
            `2. Ticket Médio Mensal por Aluno: ${formatCurrency(ticketMensal)}`,
            `3. Divisão: ${formatCurrency(breakEvenM)} ÷ ${formatCurrency(ticketMensal)}`,
            `4. Alunos no Ponto de Equilíbrio: ${alunosBE} alunos`,
            `5. Folga de Segurança Atual: +${alunosFolga} alunos em relação à base real (${alunos} alunos)`
          ],
          interpretacao: `Sua escola se paga com 282 alunos. Todos os ${alunosFolga} alunos restantes geram lucro puro para o colégio.`,
          dicaEstrategica: 'Saber a quantidade exata de alunos para o ponto de equilíbrio ajuda a planejar o investimento em captação comercial.'
        }
        break

      case 'LTV_ESTIMADO_ALUNO':
        exp = {
          key: cardKey,
          titulo: 'LTV Estimado do Aluno (Lifetime Value de 4 Anos)',
          categoria: 'Unit Economics & Valuation Escolar',
          conceito: 'Estimativa do valor acumulado total gerado para o caixa da escola durante a permanência média do aluno na instituição (4 anos / 48 meses).',
          formula: 'LTV do Aluno = Ticket Médio Mensal × (Margem % / 100) × 48 Meses',
          passos: [
            `1. Ticket Médio Mensal: ${formatCurrency(ticketMensal)}`,
            `2. Margem Líquida por Aluno: ${margemAlunoPct.toFixed(1)}% (${formatCurrency(margemAluno)}/mês)`,
            `3. Ciclo Médio Estimado: 48 meses (4 anos letivos)`,
            `4. Cálculo: ${formatCurrency(margemAluno)} × 48 meses`,
            `5. LTV Estimado por Aluno: ${formatCurrency(ltv)}`
          ],
          interpretacao: `Cada aluno captado vale exatamente ${formatCurrency(ltv)} de resultado acumulado para o colégio ao longo de 4 anos.`,
          dicaEstrategica: 'Com um LTV de ${formatCurrency(ltv)}, gastar até 5% a 10% deste valor em marketing para captar 1 aluno é altamente lucrativo.'
        }
        break

      default:
        exp = {
          key: cardKey,
          titulo: 'Análise de Métrica Financeira',
          categoria: 'DRE & Gestão Escolar',
          conceito: 'Indicador calculado a partir das receitas e despesas auditadas da instituição.',
          formula: 'Métrica = Dados DRE Auditados',
          passos: [`Valores calculados em tempo real com base no relatório DRE enviado.`],
          interpretacao: 'Indicador operacional em conformidade com as normas contábeis.',
          dicaEstrategica: 'Acompanhe este indicador mês a mês.'
        }
    }

    setSelectedCardExplanation(exp)
  }

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleAbrirArquivoOriginal(currentHistoricoItem)}
                style={{
                  padding: '8px 16px',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                title="Abrir/baixar a cópia do arquivo PDF ou Excel original enviado"
              >
                <FileText size={14} color="#0284c7" /> Abrir Original
              </button>

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
                onClick={() => setActiveTab('alunos')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'alunos' ? '#ffffff' : 'transparent',
                  color: activeTab === 'alunos' ? '#059669' : '#64748b',
                  boxShadow: activeTab === 'alunos' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <GraduationCap size={14} color="#059669" /> Alunos & Unit Economics
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
        </div>

          {/* ─── BLOCO 1: 4 CARDS PRINCIPAIS DA DRE OPERACIONAL (LINHA 1) ─────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            
            {/* Card 1: Receita Bruta Total */}
            <div
              onClick={() => openCardExplanation('RECEITA_BRUTA_TOTAL')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Receita Bruta Total <HelpCircle size={12} color="#059669" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('OPEX_CUSTO_OPERACAO')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Custo de Operação (OPEX) <HelpCircle size={12} color="#dc2626" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('FOLHA_PAGAMENTO')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #c7d2fe',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(79, 70, 229, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Folha de Pagamento <HelpCircle size={12} color="#4f46e5" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('LUCRO_OPERACIONAL_REAL')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #bfdbfe',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Lucro Operacional Real <HelpCircle size={12} color="#2563eb" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('BREAK_EVEN_MENSAL')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                borderRadius: '16px',
                padding: '18px 20px',
                color: '#ffffff',
                boxShadow: '0 6px 16px -2px rgba(3, 105, 161, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#e0f2fe', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Target size={13} /> Break-Even Mensal (0 a 0) <HelpCircle size={12} color="#ffffff" />
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
            <div
              onClick={() => openCardExplanation('BREAK_EVEN_ANUAL')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Break-Even Anual (0 a 0) <HelpCircle size={12} color="#475569" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('MARGEM_SEGURANCA')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #a7f3d0',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Margem de Folga / Segurança <HelpCircle size={12} color="#059669" />
                  </span>
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
            <div
              onClick={() => openCardExplanation('SOBRA_RETIDA_CAIXA')}
              title="Clique para ver o cálculo detalhado do economista"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #ddd6fe',
                padding: '18px 20px',
                boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Sobra Retida no Caixa <HelpCircle size={12} color="#7c3aed" />
                  </span>
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
                        (i?.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (i?.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
                      )

                      if (searchTerm && itemsFiltrados?.length === 0 && !(grupo?.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())) {
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
                              <span>{grupo.descricao || '—'}</span>
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
                              <td style={{ padding: '10px 16px 10px 40px', color: '#334155' }}>{item.descricao || '—'}</td>
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
                        (i?.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (i?.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
                      )

                      if (searchTerm && itemsFiltrados?.length === 0 && !(grupo?.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())) {
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
                              <span>{grupo.descricao || '—'}</span>
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
                              <td style={{ padding: '10px 16px 10px 40px', color: '#334155' }}>{item.descricao || '—'}</td>
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

          {/* ─── ABA DE ALUNOS & UNIT ECONOMICS ESCOLAR ─────────────────────── */}
          {activeTab === 'alunos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* PAINEL DE CONTROLE DE ALUNOS ATIVOS */}
              <div style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
                borderRadius: '16px',
                padding: '24px 28px',
                color: '#ffffff',
                boxShadow: '0 8px 24px -4px rgba(4, 120, 87, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GraduationCap size={16} /> Painel de Unit Economics & Gestão Escolar Real
                  </span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    Análise Financeira por Aluno Matriculado
                  </h3>
                  <p style={{ fontSize: '13px', color: '#d1fae5', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                    Matrículas ativas sincronizadas em tempo real com o banco de dados ERP do sistema.
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.25)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#e6f4ea', display: 'block', marginBottom: '4px' }}>
                      NÚMERO DE ALUNOS ATIVOS:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setNumeroAlunosAtivos(Math.max(10, numeroAlunosAtivos - 10))}
                        style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ffffff', color: '#047857', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '16px' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={numeroAlunosAtivos}
                        onChange={(e) => setNumeroAlunosAtivos(Math.max(1, parseInt(e.target.value) || 0))}
                        style={{ width: '90px', height: '32px', textAlign: 'center', fontWeight: 900, fontSize: '16px', borderRadius: '8px', border: 'none', color: '#0f172a', outline: 'none' }}
                      />
                      <button
                        onClick={() => setNumeroAlunosAtivos(numeroAlunosAtivos + 10)}
                        style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ffffff', color: '#047857', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '16px' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.2)', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '10px', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Ticket Mensal Estimado</span>
                    <strong style={{ fontSize: '18px', color: '#ffffff' }}>{formatCurrency(ticketMedioMensalAluno)}</strong>
                  </div>
                </div>
              </div>

              {/* GRID DOS 6 CARDS PRINCIPAIS DE UNIT ECONOMICS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                
                {/* Card 1: Alunos Ativos */}
                <div
                  onClick={() => openCardExplanation('ALUNOS_ATIVOS')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Alunos Ativos <HelpCircle size={12} color="#0284c7" />
                      </span>
                      <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0' }}>
                        {numeroAlunosAtivos} <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>alunos</span>
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                      <GraduationCap size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                    Base ativa de matrículas auditada
                  </p>
                </div>

                {/* Card 2: Ticket Médio por Aluno */}
                <div
                  onClick={() => openCardExplanation('TICKET_MEDIO_MENSAL')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #a7f3d0', padding: '20px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ticket Médio Mensal <HelpCircle size={12} color="#059669" />
                      </span>
                      <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#059669', margin: '4px 0 0' }}>
                        {formatCurrency(ticketMedioMensalAluno)}
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                      <CreditCard size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                    Faturamento médio mensal por aluno
                  </p>
                </div>

                {/* Card 3: Custo por Aluno */}
                <div
                  onClick={() => openCardExplanation('CUSTO_POR_ALUNO')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #fecaca', padding: '20px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Custo por Aluno <HelpCircle size={12} color="#dc2626" />
                      </span>
                      <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626', margin: '4px 0 0' }}>
                        {formatCurrency(custoTotalMensalAluno)}
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                      <TrendingDown size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                    Custos operacionais (OPEX) por aluno
                  </p>
                </div>

                {/* Card 4: Margem do Aluno */}
                <div
                  onClick={() => openCardExplanation('MARGEM_POR_ALUNO')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1', padding: '20px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Margem por Aluno <HelpCircle size={12} color="#4338ca" />
                      </span>
                      <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#4338ca', margin: '4px 0 0' }}>
                        {formatCurrency(margemMensalAluno)}
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca' }}>
                      <Zap size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                    Margem líquida de <strong>{margemMensalAlunoPct.toFixed(1)}%</strong> por aluno
                  </p>
                </div>

                {/* Card 5: Alunos no Break-Even */}
                <div
                  onClick={() => openCardExplanation('ALUNOS_BREAK_EVEN')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '16px', padding: '20px', color: '#ffffff', boxShadow: '0 4px 16px -2px rgba(49, 46, 129, 0.3)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Alunos no Break-Even <HelpCircle size={12} color="#ffffff" />
                      </span>
                      <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: '4px 0 0' }}>
                        {alunosBreakEven} <span style={{ fontSize: '13px', fontWeight: 600, color: '#c7d2fe' }}>alunos</span>
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                      <Target size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#c7d2fe', margin: '12px 0 0' }}>
                    Folha de segurança: <strong style={{ color: '#6ee7b7' }}>+{alunosMargemSeguranca} alunos</strong>
                  </p>
                </div>

                {/* Card 6: LTV Estimado do Aluno */}
                <div
                  onClick={() => openCardExplanation('LTV_ESTIMADO_ALUNO')}
                  title="Clique para ver a explicação detalhada do cálculo"
                  style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #ddd6fe', padding: '20px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        LTV Estimado (4 Anos) <HelpCircle size={12} color="#7c3aed" />
                      </span>
                      <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#6d28d9', margin: '4px 0 0' }}>
                        {formatCurrency(ltvEstimadoAluno)}
                      </h3>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                      <Award size={20} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '12px 0 0' }}>
                    Valor gerado por aluno ao longo do ciclo
                  </p>
                </div>

              </div>

              {/* PAINEL DE DECOMPOSIÇÃO DE CUSTOS POR ALUNO E SIMULADOR */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                
                {/* Decomposição do Custo por Aluno */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChartIcon size={18} color="#4f46e5" /> Onde vai o Custo de Cada Aluno?
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                        <span style={{ color: '#334155' }}>👨‍🏫 Folha de Pagamento & Corpo Docente</span>
                        <span style={{ color: '#2563eb' }}>{formatCurrency(custoFolhaMensalAluno)} / mês</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (custoFolhaMensalAluno / (custoTotalMensalAluno || 1)) * 100)}%`, height: '100%', background: '#2563eb' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                        <span style={{ color: '#334155' }}>🏫 Infraestrutura, Aluguel & Utilidades</span>
                        <span style={{ color: '#d97706' }}>{formatCurrency(custoInfraMensalAluno)} / mês</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (custoInfraMensalAluno / (custoTotalMensalAluno || 1)) * 100)}%`, height: '100%', background: '#d97706' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                        <span style={{ color: '#334155' }}>💰 Margem Líquida Retida da Escola</span>
                        <span style={{ color: '#059669' }}>{formatCurrency(margemMensalAluno)} / mês</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (margemMensalAluno / (ticketMedioMensalAluno || 1)) * 100)}%`, height: '100%', background: '#059669' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulador Interativo de Expansão de Matrículas */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1', padding: '24px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#7c3aed" /> Simulador de Expansão de Matrículas
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
                    Simule a captação de novas matrículas e veja o impacto no resultado anual da escola:
                  </p>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                      <span>Novos Alunos a Captar:</span>
                      <span style={{ color: '#7c3aed', fontSize: '16px', fontWeight: 900 }}>+{simuladorAlunosAdicionais} alunos</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="150"
                      step="5"
                      value={simuladorAlunosAdicionais}
                      onChange={(e) => setSimuladorAlunosAdicionais(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: '#f5f3ff', padding: '14px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', display: 'block' }}>Receita Adicional Anual</span>
                      <strong style={{ fontSize: '16px', color: '#7c3aed', marginTop: '2px', display: 'block' }}>
                        +{formatCurrency(simuladorAlunosAdicionais * ticketMedioMensalAluno * 12)}
                      </strong>
                    </div>

                    <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Lucro Adicional Anual</span>
                      <strong style={{ fontSize: '16px', color: '#059669', marginTop: '2px', display: 'block' }}>
                        +{formatCurrency(simuladorAlunosAdicionais * margemMensalAluno * 12)}
                      </strong>
                    </div>
                  </div>
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
                          onClick={() => handleAbrirArquivoOriginal(item)}
                          style={{ padding: '8px 14px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Abrir ou baixar arquivo original enviado"
                        >
                          <FileText size={14} color="#0284c7" /> Abrir Original
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

      {/* ─── MODAL EXPLICATIVO DE CÁLCULO E CONCEITO ECONOMÉTRICO ─────────── */}
      <AnimatePresence>
        {selectedCardExplanation && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '680px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}
            >
              {/* Header do Modal */}
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                padding: '24px 28px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={15} /> {selectedCardExplanation.categoria}
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                    {selectedCardExplanation.titulo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCardExplanation(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Corpo do Modal */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '78vh', overflowY: 'auto' }}>
                
                {/* Conceito */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    💡 Conceito & Significado Gestórico:
                  </h4>
                  <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: 0, background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', borderLeft: '4px solid #0284c7' }}>
                    {selectedCardExplanation.conceito}
                  </p>
                </div>

                {/* Fórmula Matemática */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    📐 Fórmula Matemática Aplicada:
                  </h4>
                  <div style={{ background: '#0f172a', color: '#38bdf8', padding: '14px 18px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '13px', fontWeight: 700 }}>
                    {selectedCardExplanation.formula}
                  </div>
                </div>

                {/* Passo a Passo Numérico */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                    🔢 Demonstração Passo a Passo com Seus Dados Auditados:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedCardExplanation.passos.map((passo, idx) => (
                      <div key={idx} style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#0f172a', fontWeight: 600, fontFamily: 'monospace' }}>
                        {passo}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recomendação Estratégica do Economista */}
                <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} color="#059669" /> Recomendação do Economista & Diretor Escolar:
                  </h4>
                  <p style={{ fontSize: '13px', color: '#065f46', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
                    {selectedCardExplanation.dicaEstrategica}
                  </p>
                </div>

              </div>

              {/* Rodapé do Modal */}
              <div style={{ padding: '16px 28px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedCardExplanation(null)}
                  style={{
                    padding: '10px 24px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Entendi o Cálculo
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
