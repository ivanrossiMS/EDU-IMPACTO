'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Search,
  Plus,
  Edit3,
  Trash2,
  Printer,
  Lock,
  Unlock,
  Banknote,
  PieChart,
  Receipt,
  FileText,
  ArrowLeftRight,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
  FileSpreadsheet,
  LayoutList,
  BarChart3,
  Calendar,
  ShieldCheck,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useApp } from '@/lib/context'
import { apiFetch } from '@/lib/api/apiClient'
import { useConfigDb } from '@/lib/useConfigDb'
import {
  useData,
  type ConfigCaixa,
  type ConfigPlanoContas,
  type ConfigCentroCusto,
  type ConfigTipoDocumento,
} from '@/lib/dataContext'
import { ReceiptModal, type ReceiptProps } from '@/components/financeiro/ReceiptModal'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  resolvePlanoContasEscolares,
} from '@/app/(app)/financeiro/pagar/types'
import {
  type UnifiedMovimentacaoItem,
  type MovimentacaoCaixaRecord,
  type CategoriaMovimentacaoKey,
  type RateioCentroCustoItem,
  CATEGORIA_LEGEND_META,
  getCategoriaShortLabel,
  isCaixaDoUsuario,
  unificarMovimentacoesDoCaixa,
  calcularSaldosPorCaixaMap,
  formatCurrencyBRL,
  formatDateBR,
  getLocalISODate,
  normalizeText,
  extractCentrosCustoOptions,
} from './types'
import { CaixaSelectorModal } from './components/CaixaSelectorModal'
import { NovaMovimentacaoModal } from './components/NovaMovimentacaoModal'
import {
  RateioModal,
  TransferirValoresModal,
  EstornarMovimentacaoModal,
  ResumoCaixaModal,
  FecharReabrirCaixaModal,
  InfoDetalhesModal,
} from './components/MovimentacaoOperationalModals'

type MainTab = 'lancamentos' | 'conciliacao_diaria' | 'analise_contas' | 'auditoria_numerario'
type QuickStatusPill =
  | 'todos'
  | 'entradas'
  | 'saidas'
  | 'rec_aluno'
  | 'compromisso'
  | 'transf_valores'
  | 'mov_receita'
  | 'pendentes_banco'

export default function MovimentacaoFinanceiraPage() {
  const { currentUser, currentUserPerfil } = useApp()
  const {
    cfgCaixas: ctxCaixas = [],
    setCfgCaixas,
    cfgPlanoContas: ctxPlanoContas = [],
    cfgCentrosCusto: ctxCentrosCusto = [],
    cfgTiposDocumento: ctxTiposDocumento = [],
    mantenedores = [],
  } = useData()

  // Leitura direta de `cfgPlanoContas`, `cfgCentrosCusto` e `cfgTiposDocumento`
  const { data: dbPlanoContas = [] } = useConfigDb<ConfigPlanoContas>('cfgPlanoContas')
  const { data: dbCentrosCusto = [] } = useConfigDb<ConfigCentroCusto>('cfgCentrosCusto')
  const { data: dbTiposDocumento = [] } = useConfigDb<ConfigTipoDocumento>('cfgTiposDocumento')

  // ── Estado carregado da API unificada `/api/financeiro/movimentacoes` ──────
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [apiCaixas, setApiCaixas] = useState<ConfigCaixa[]>([])
  const [movsManuais, setMovsManuais] = useState<MovimentacaoCaixaRecord[]>([])
  const [overrides, setOverrides] = useState<Record<string, Partial<MovimentacaoCaixaRecord>>>({})
  const [contasPagarPagas, setContasPagarPagas] = useState<ContaPagarRecord[]>([])
  const [titulosPagos, setTitulosPagos] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorEscolar[]>([])
  const [apiPlanoContas, setApiPlanoContas] = useState<ConfigPlanoContas[]>([])
  const [apiCentrosCusto, setApiCentrosCusto] = useState<ConfigCentroCusto[]>([])
  const [apiTiposDocumento, setApiTiposDocumento] = useState<ConfigTipoDocumento[]>([])
  const [apiMetodosPagamento, setApiMetodosPagamento] = useState<string[]>([])

  // ── Seleção de Caixa (Abre modal ao iniciar a página) ──────────────────────
  const [selectedCaixaId, setSelectedCaixaId] = useState<string>('')
  const [showCaixaModal, setShowCaixaModal] = useState<boolean>(true)

  // ── Navegação Principal em Abas & Filtros Modernos ─────────────────────────
  const [activeTab, setActiveTab] = useState<MainTab>('lancamentos')
  const [quickPill, setQuickPill] = useState<QuickStatusPill>('todos')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filtroContaPlano, setFiltroContaPlano] = useState<string>('todas')
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>('todos')
  const [filtroTipoRecurso, setFiltroTipoRecurso] = useState<string>('Todos')
  const [periodoPreset, setPeriodoPreset] = useState<'tudo' | 'hoje' | '7dias' | 'mes_atual' | 'personalizado'>('tudo')
  const hojeISO = useMemo(() => getLocalISODate(), [])
  const inicioMesISO = useMemo(() => `${hojeISO.slice(0, 7)}-01`, [hojeISO])
  const [dataInicial, setDataInicial] = useState<string>('')
  const [dataFinal, setDataFinal] = useState<string>('')
  const [sortBy, setSortBy] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc')

  // ── Paginação e Seleção Múltipla em Lote ───────────────────────────────────
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Menu Contextual por Linha (`⋮`) e Modais Operacionais ──────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [novaMovModalOpen, setNovaMovModalOpen] = useState<boolean>(false)
  const [editingItem, setEditingItem] = useState<UnifiedMovimentacaoItem | null>(null)
  const [prefillNovaMov, setPrefillNovaMov] = useState<{
    tipoOperacao?: 'Pagamento' | 'Recebimento'
    valor?: number
    descricao?: string
  } | null>(null)
  const [targetModalItem, setTargetModalItem] = useState<UnifiedMovimentacaoItem | null>(null)
  const [rateioModalOpen, setRateioModalOpen] = useState<boolean>(false)
  const [resumoModalOpen, setResumoModalOpen] = useState<boolean>(false)
  const [transferirModalOpen, setTransferirModalOpen] = useState<boolean>(false)
  const [transferInitialValor, setTransferInitialValor] = useState<number | null>(null)
  const [estornarModalOpen, setEstornarModalOpen] = useState<boolean>(false)
  const [caixaStatusModalMode, setCaixaStatusModalMode] = useState<'fechar' | 'reabrir' | 'numerario' | null>(null)
  const [infoModalItem, setInfoModalItem] = useState<UnifiedMovimentacaoItem | null>(null)
  const [receiptModalData, setReceiptModalData] = useState<Omit<ReceiptProps, 'onClose' | 'onBack'> | null>(null)

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  // ── Carregamento de dados do servidor ──────────────────────────────────────
  const fetchMovimentacoesData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar movimentações financeiras')
      const data = await res.json()
      if (Array.isArray(data.caixas)) setApiCaixas(data.caixas)
      if (Array.isArray(data.movimentacoesManuais)) setMovsManuais(data.movimentacoesManuais)
      if (data.overrides && typeof data.overrides === 'object') setOverrides(data.overrides)
      if (Array.isArray(data.contasPagarPagas)) setContasPagarPagas(data.contasPagarPagas)
      if (Array.isArray(data.titulosPagos)) setTitulosPagos(data.titulosPagos)
      if (Array.isArray(data.fornecedores)) setFornecedores(data.fornecedores)
      if (Array.isArray(data.planoContas)) setApiPlanoContas(data.planoContas)
      if (Array.isArray(data.centrosCusto)) setApiCentrosCusto(data.centrosCusto)
      if (Array.isArray(data.tiposDocumento)) setApiTiposDocumento(data.tiposDocumento)
      if (Array.isArray(data.metodosPagamento)) {
        setApiMetodosPagamento(
          data.metodosPagamento
            .map((m: any) => (typeof m === 'string' ? m : m?.nome || m?.descricao || ''))
            .filter(Boolean)
        )
      }
    } catch (err: any) {
      console.error('[Movimentação Financeira] Erro:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMovimentacoesData(false)
  }, [fetchMovimentacoesData])

  // ── Consolidação das listas de configuração ────────────────────────────────
  const allCaixas = useMemo(() => {
    const map = new Map<string, ConfigCaixa>()
    for (const c of ctxCaixas || []) {
      if (c && c.id) map.set(c.id, c)
    }
    for (const c of apiCaixas || []) {
      if (c && c.id) map.set(c.id, c)
    }
    return Array.from(map.values()).sort((a, b) => Number(b.codigo || 0) - Number(a.codigo || 0))
  }, [ctxCaixas, apiCaixas])

  const planoContasMerged = useMemo(() => {
    if (dbPlanoContas.length > 0) return dbPlanoContas
    if (apiPlanoContas.length > 0) return apiPlanoContas
    return ctxPlanoContas
  }, [dbPlanoContas, apiPlanoContas, ctxPlanoContas])
  const centrosCustoMerged = useMemo(() => {
    if (dbCentrosCusto.length > 0) return dbCentrosCusto
    if (apiCentrosCusto.length > 0) return apiCentrosCusto
    return ctxCentrosCusto
  }, [dbCentrosCusto, apiCentrosCusto, ctxCentrosCusto])
  const tiposDocumentoMerged = useMemo(() => {
    if (dbTiposDocumento.length > 0) return dbTiposDocumento
    if (apiTiposDocumento.length > 0) return apiTiposDocumento
    return ctxTiposDocumento
  }, [dbTiposDocumento, apiTiposDocumento, ctxTiposDocumento])

  const unidadesDisponiveis = useMemo(() => {
    const list: string[] = []
    for (const m of mantenedores || []) {
      if (Array.isArray((m as any).unidades)) {
        for (const u of (m as any).unidades) {
          const nome = typeof u === 'string' ? u : u?.nome
          if (nome && !list.includes(nome)) list.push(nome)
        }
      }
    }
    if (list.length === 0) list.push('Colégio Impacto - Matriz')
    return list
  }, [mantenedores])

  const selectedCaixa = useMemo(() => {
    if (!selectedCaixaId) return null
    return allCaixas.find((c) => c.id === selectedCaixaId) || null
  }, [allCaixas, selectedCaixaId])

  // ── Mapa de Saldos Reais de TODOS os Caixas do Sistema ─────────────────────
  const saldosPorCaixaMap = useMemo(
    () =>
      calcularSaldosPorCaixaMap({
        allCaixas,
        movimentacoesManuais: movsManuais,
        overrides,
        contasPagarPagas,
        titulosPagos,
        planoContas: planoContasMerged,
        centrosCusto: centrosCustoMerged,
      }),
    [allCaixas, movsManuais, overrides, contasPagarPagas, titulosPagos, planoContasMerged, centrosCustoMerged]
  )

  // ── Unificação de todos os lançamentos do Caixa selecionado ────────────────
  const todosLancamentosDoCaixa = useMemo(
    () =>
      unificarMovimentacoesDoCaixa({
        selectedCaixa,
        allCaixas,
        movimentacoesManuais: movsManuais,
        overrides,
        contasPagarPagas,
        titulosPagos,
        planoContas: planoContasMerged,
        centrosCusto: centrosCustoMerged,
      }),
    [selectedCaixa, allCaixas, movsManuais, overrides, contasPagarPagas, titulosPagos, planoContasMerged, centrosCustoMerged]
  )

  // ── KPIs Executivos do Caixa Selecionado ───────────────────────────────────
  const kpisCaixa = useMemo(() => {
    const saldoInicial = Number(selectedCaixa?.saldoInicial || 0)
    let entradas = 0
    let saidas = 0
    let qtdEntradas = 0
    let qtdSaidas = 0
    let valorConciliadoLiquido = saldoInicial
    let qtdConciliados = 0
    let qtdPendentesBanco = 0

    for (const item of todosLancamentosDoCaixa) {
      const val = Number(item.valorLiquido || 0)
      if (item.tipoOperacao === 'Recebimento') {
        entradas += val
        qtdEntradas += 1
        if (item.compensadoBanco === 'Sim') valorConciliadoLiquido += val
      } else {
        saidas += val
        qtdSaidas += 1
        if (item.compensadoBanco === 'Sim') valorConciliadoLiquido -= val
      }

      if (item.compensadoBanco === 'Sim') qtdConciliados += 1
      else qtdPendentesBanco += 1
    }

    return {
      saldoInicial,
      entradas,
      saidas,
      qtdEntradas,
      qtdSaidas,
      saldoAtual: saldoInicial + entradas - saidas,
      valorConciliadoLiquido,
      totalRegistros: todosLancamentosDoCaixa.length,
      qtdConciliados,
      qtdPendentesBanco,
    }
  }, [selectedCaixa, todosLancamentosDoCaixa])

  // ── Opções dinâmicas de filtro ─────────────────────────────────────────────
  const opcoesFiltroRecurso = useMemo(() => {
    const set = new Set<string>([
      'PIX',
      'Dinheiro',
      'Boleto Bancário',
      'Transferência / TED',
      'Cartão de Crédito',
      'Cartão de Débito',
      'Débito Automático',
    ])
    for (const item of todosLancamentosDoCaixa) {
      if (item.tipoRecurso) set.add(item.tipoRecurso)
    }
    return Array.from(set)
  }, [todosLancamentosDoCaixa])

  const opcoesFiltroContaPlano = useMemo(() => {
    const set = new Set<string>()
    for (const item of todosLancamentosDoCaixa) {
      if (item.contaPlanoLabel) set.add(item.contaPlanoLabel)
    }
    const configuradas = resolvePlanoContasEscolares(planoContasMerged, 'todos', false)
    for (const p of configuradas) {
      set.add(`${p.codPlano} • ${p.descricao}`)
    }
    return Array.from(set).sort()
  }, [todosLancamentosDoCaixa, planoContasMerged])

  const opcoesFiltroCentroCusto = useMemo(() => {
    return extractCentrosCustoOptions(centrosCustoMerged)
  }, [centrosCustoMerged])

  // ── Filtragem e Ordenação Inteligente ──────────────────────────────────────
  const lancamentosFiltrados = useMemo(() => {
    let list = [...todosLancamentosDoCaixa]

    // 1. Filtro Rápido (Pills de Status/Origem)
    if (quickPill === 'entradas') {
      list = list.filter((x) => x.tipoOperacao === 'Recebimento')
    } else if (quickPill === 'saidas') {
      list = list.filter((x) => x.tipoOperacao === 'Pagamento')
    } else if (
      quickPill === 'rec_aluno' ||
      quickPill === 'compromisso' ||
      quickPill === 'transf_valores' ||
      quickPill === 'mov_receita'
    ) {
      list = list.filter((x) => x.categoriaOrigem === quickPill)
    } else if (quickPill === 'pendentes_banco') {
      list = list.filter((x) => x.compensadoBanco === 'Não')
    }

    // 2. Filtro de Período (Data Inicial e Data Final diretas + Presets)
    if (dataInicial) {
      list = list.filter((x) => (x.dataLcto || '') >= dataInicial)
    }
    if (dataFinal) {
      list = list.filter((x) => (x.dataLcto || '') <= dataFinal)
    }
    if (!dataInicial && !dataFinal) {
      if (periodoPreset === 'hoje') {
        list = list.filter((x) => x.dataLcto === hojeISO)
      } else if (periodoPreset === '7dias') {
        const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
        list = list.filter((x) => x.dataLcto >= seteDiasAtras && x.dataLcto <= hojeISO)
      } else if (periodoPreset === 'mes_atual') {
        list = list.filter((x) => x.dataLcto >= inicioMesISO && x.dataLcto <= hojeISO)
      }
    }

    // 3. Filtro Conta Plano
    if (filtroContaPlano !== 'todas') {
      list = list.filter((x) => x.contaPlanoLabel === filtroContaPlano)
    }

    // 4. Filtro Centro de Custo
    if (filtroCentroCusto !== 'todos') {
      list = list.filter((x) => x.centroCusto === filtroCentroCusto)
    }

    // 5. Filtro Tipo de Recurso
    if (filtroTipoRecurso !== 'Todos') {
      const recNorm = normalizeText(filtroTipoRecurso)
      list = list.filter((x) => normalizeText(x.tipoRecurso).includes(recNorm))
    }

    // 6. Busca Textual
    if (searchQuery.trim()) {
      const q = normalizeText(searchQuery)
      list = list.filter(
        (x) =>
          String(x.codigoLcto).includes(q) ||
          normalizeText(x.fornecedorNome).includes(q) ||
          normalizeText(x.descricao).includes(q) ||
          normalizeText(x.numeroDocumento).includes(q) ||
          normalizeText(x.contaPlanoLabel).includes(q) ||
          normalizeText(x.centroCusto).includes(q) ||
          normalizeText(x.tipoRecurso).includes(q) ||
          String(x.valorLiquido).includes(q)
      )
    }

    // 7. Ordenação (Novos lançamentos sempre em primeiro)
    if (sortBy !== 'data_desc') {
      list.sort((a, b) => {
        if (sortBy === 'data_asc') {
          const c = (a.dataLcto || '').localeCompare(b.dataLcto || '')
          if (c !== 0) return c
          const tA = a.createdAtMs || 0
          const tB = b.createdAtMs || 0
          if (tA !== tB) return tA - tB
          return a.codigoLcto - b.codigoLcto
        }
        if (sortBy === 'valor_desc') return b.valorLiquido - a.valorLiquido
        if (sortBy === 'valor_asc') return a.valorLiquido - b.valorLiquido
        return 0
      })
    }

    return list
  }, [
    todosLancamentosDoCaixa,
    quickPill,
    periodoPreset,
    hojeISO,
    inicioMesISO,
    dataInicial,
    dataFinal,
    filtroContaPlano,
    filtroCentroCusto,
    filtroTipoRecurso,
    searchQuery,
    sortBy,
  ])

  const resumoFiltrado = useMemo(() => {
    let entradas = 0
    let saidas = 0
    for (const item of lancamentosFiltrados) {
      if (item.tipoOperacao === 'Recebimento') entradas += item.valorLiquido
      else saidas += item.valorLiquido
    }
    return {
      entradas,
      saidas,
      saldoLiquido: entradas - saidas,
    }
  }, [lancamentosFiltrados])

  const hasActiveFilters =
    quickPill !== 'todos' ||
    periodoPreset !== 'tudo' ||
    Boolean(dataInicial) ||
    Boolean(dataFinal) ||
    filtroContaPlano !== 'todas' ||
    filtroCentroCusto !== 'todos' ||
    filtroTipoRecurso !== 'Todos' ||
    Boolean(searchQuery.trim())

  const handleApplyPeriodoPreset = (preset: 'tudo' | 'hoje' | '7dias' | 'mes_atual' | 'personalizado') => {
    setPeriodoPreset(preset)
    if (preset === 'tudo') {
      setDataInicial('')
      setDataFinal('')
    } else if (preset === 'hoje') {
      setDataInicial(hojeISO)
      setDataFinal(hojeISO)
    } else if (preset === '7dias') {
      const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      setDataInicial(seteDiasAtras)
      setDataFinal(hojeISO)
    } else if (preset === 'mes_atual') {
      setDataInicial(inicioMesISO)
      setDataFinal(hojeISO)
    }
  }

  const clearAllFilters = () => {
    setQuickPill('todos')
    setPeriodoPreset('tudo')
    setDataInicial('')
    setDataFinal('')
    setFiltroContaPlano('todas')
    setFiltroCentroCusto('todos')
    setFiltroTipoRecurso('Todos')
    setSearchQuery('')
  }

  // Paginação
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(lancamentosFiltrados.length / pageSize)),
    [lancamentosFiltrados.length, pageSize]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [quickPill, periodoPreset, dataInicial, dataFinal, filtroContaPlano, filtroCentroCusto, filtroTipoRecurso, searchQuery])

  const lancamentosPaginados = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return lancamentosFiltrados.slice(start, start + pageSize)
  }, [lancamentosFiltrados, currentPage, pageSize])

  const selecionadosObjs = useMemo(
    () => lancamentosFiltrados.filter((x) => selectedIds.has(x.id)),
    [lancamentosFiltrados, selectedIds]
  )

  // ── Evolução Diária de Saldo (Para Aba 2: Conciliação & Saldo Diário) ──────
  const evolucaoDiaria = useMemo(() => {
    const mapDia = new Map<
      string,
      { data: string; entradas: number; saidas: number; qtd: number; conciliados: number }
    >()
    for (const item of todosLancamentosDoCaixa) {
      const dt = item.dataLcto || hojeISO
      const cur = mapDia.get(dt) || { data: dt, entradas: 0, saidas: 0, qtd: 0, conciliados: 0 }
      if (item.tipoOperacao === 'Recebimento') cur.entradas += item.valorLiquido
      else cur.saidas += item.valorLiquido
      cur.qtd += 1
      if (item.compensadoBanco === 'Sim') cur.conciliados += 1
      mapDia.set(dt, cur)
    }

    const sortedAsc = Array.from(mapDia.values()).sort((a, b) => a.data.localeCompare(b.data))
    let acumulado = Number(selectedCaixa?.saldoInicial || 0)
    return sortedAsc
      .map((dia) => {
        const saldoAnterior = acumulado
        const variacao = dia.entradas - dia.saidas
        acumulado = Math.round((acumulado + variacao) * 100) / 100
        return {
          ...dia,
          saldoAnterior,
          variacao,
          saldoFinalDia: acumulado,
        }
      })
      .reverse()
  }, [todosLancamentosDoCaixa, selectedCaixa, hojeISO])

  // ── Handlers Operacionais ──────────────────────────────────────────────────
  const handleSelectCaixa = (cx: ConfigCaixa) => {
    if (!isCaixaDoUsuario(cx, currentUser)) {
      toast.error(`Acesso bloqueado: O Caixa ${cx.codigo} pertence exclusivamente ao operador ${cx.operador}.`)
      return
    }
    setSelectedCaixaId(cx.id)
    setSelectedIds(new Set())
    setShowCaixaModal(false)
    toast.success(`Caixa ${cx.codigo} - ${cx.descricao} ativo!`)
  }

  const handleQuickCreateCaixa = async (partial: Partial<ConfigCaixa>): Promise<ConfigCaixa | null> => {
    const nowISO = new Date().toISOString()
    const novo: ConfigCaixa = {
      id: `CX-${Date.now().toString(36).toUpperCase()}`,
      codigo: partial.codigo || '108',
      descricao: partial.descricao || 'CAIXA-OPERADOR',
      tipoCaixa: 'Geral / Tesouraria',
      operador: partial.operador || `11 - ${currentUser?.nome || 'Administrador'}`,
      abertoPor: partial.abertoPor || `11 - ${currentUser?.nome || 'Administrador'}`,
      vistoriadoPor: '',
      unidadeEmpresa: partial.unidadeEmpresa || unidadesDisponiveis[0] || 'Colégio Impacto - Matriz',
      agencia: '',
      conta: '',
      dataAbertura: partial.dataAbertura || hojeISO,
      situacao: 'Aberto',
      saldoInicial: Number(partial.saldoInicial || 0),
      totalEntradas: 0,
      totalSaidas: 0,
      aceitaTransferenciaOutrosCaixas: true,
      aceitaBaixaContasPagarOutroUsuario: true,
      aceitaTransferencias: 'Sim',
      createdAt: nowISO,
      updatedAt: nowISO,
      historico: [
        {
          id: `HCX-INIT-${Date.now()}`,
          dataHora: nowISO,
          acao: 'Abertura de Caixa',
          usuario: currentUser?.nome || 'Administrador',
          detalhes: 'Caixa aberto diretamente na Movimentação Financeira.',
        },
      ],
    }

    const updatedList = [novo, ...allCaixas]
    setApiCaixas(updatedList)
    setCfgCaixas(updatedList)

    try {
      await apiFetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'cfgCaixas', valor: updatedList }),
      })
      toast.success(`Caixa ${novo.codigo} - ${novo.descricao} aberto com sucesso!`)
      return novo
    } catch {
      toast.error('Erro ao salvar caixa no servidor.')
      return novo
    }
  }

  const handleSaveMovimentacao = async (payload: any) => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_movimentacao',
          operador: currentUser?.nome || selectedCaixa?.operador || 'Operador',
          movimentacao: payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gravar movimentação')

      await fetchMovimentacoesData(true)
      setNovaMovModalOpen(false)
      setEditingItem(null)
      toast.success(editingItem ? 'Movimentação atualizada com sucesso!' : 'Lançamento gravado no caixa!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gravar movimentação')
    } finally {
      setSaving(false)
    }
  }

  // Alterna conciliação bancária ("Sim" / "Não") em 1 clique direto na linha!
  const handleToggleCompensado = async (item: UnifiedMovimentacaoItem) => {
    if (selectedCaixa?.situacao === 'Fechado') {
      toast.warning('O caixa está Fechado. Reabra o caixa antes de alterar a conciliação.')
      return
    }
    const novoStatus: 'Sim' | 'Não' = item.compensadoBanco === 'Sim' ? 'Não' : 'Sim'
    try {
      await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_movimentacao',
          operador: currentUser?.nome || 'Operador',
          movimentacao: {
            ...item,
            compensadoBanco: novoStatus,
          },
        }),
      })
      await fetchMovimentacoesData(true)
      toast.success(
        novoStatus === 'Sim'
          ? `Lançamento #${item.codigoLcto} marcado como Conciliado no Banco!`
          : `Lançamento #${item.codigoLcto} marcado como Em Trânsito!`
      )
    } catch {
      toast.error('Erro ao atualizar conciliação bancária.')
    }
  }

  const handleConciliarLote = async () => {
    if (selecionadosObjs.length === 0) return
    if (selectedCaixa?.situacao === 'Fechado') {
      toast.warning('O caixa está Fechado. Reabra o caixa antes de conciliar lançamentos.')
      return
    }
    setSaving(true)
    try {
      for (const item of selecionadosObjs) {
        if (item.compensadoBanco !== 'Sim') {
          await apiFetch('/api/financeiro/movimentacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_movimentacao',
              operador: currentUser?.nome || 'Operador',
              movimentacao: { ...item, compensadoBanco: 'Sim' },
            }),
          })
        }
      }
      await fetchMovimentacoesData(true)
      setSelectedIds(new Set())
      toast.success(`${selecionadosObjs.length} lançamento(s) conciliado(s) no banco!`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (item: UnifiedMovimentacaoItem) => {
    if (selectedCaixa?.situacao === 'Fechado') {
      toast.warning('O caixa está Fechado. Reabra o caixa antes de excluir ou estornar lançamentos.')
      return
    }
    if (item.isAutomaticOrigin) {
      setTargetModalItem(item)
      setEstornarModalOpen(true)
      return
    }
    if (!window.confirm(`Deseja realmente excluir o lançamento #${item.codigoLcto} (${item.descricao})?`)) {
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_movimentacao',
          id: item.id,
          operador: currentUser?.nome || 'Operador',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir lançamento')
      await fetchMovimentacoesData(true)
      toast.success(`Lançamento #${item.codigoLcto} excluído com sucesso!`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir lançamento')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRateio = async (rateio: RateioCentroCustoItem[], centroPrincipal: string) => {
    if (!targetModalItem) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_rateio',
          id: targetModalItem.id,
          sourceId: targetModalItem.sourceId,
          isAutomaticOrigin: targetModalItem.isAutomaticOrigin,
          rateio,
          centroCusto: centroPrincipal,
          operador: currentUser?.nome || 'Operador',
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar rateio')
      await fetchMovimentacoesData(true)
      setRateioModalOpen(false)
      toast.success('Rateio de Centro de Custo gravado com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gravar rateio')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmTransfer = async (payload: {
    caixaOrigemId: string
    caixaDestinoId: string
    valor: number
    dataTransferencia: string
    tipoRecurso: string
    numeroDocumento: string
    observacao: string
    fecharCaixaOrigemAposTransferencia?: boolean
  }) => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transferir_valores',
          operador: currentUser?.nome || selectedCaixa?.operador || 'Operador',
          saldoOrigemAtual: kpisCaixa.saldoAtual,
          ...payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar transferência')
      if (Array.isArray(data.caixas)) {
        setApiCaixas(data.caixas)
        setCfgCaixas(data.caixas)
      }
      await fetchMovimentacoesData(true)
      setTransferirModalOpen(false)
      setTransferInitialValor(null)
      if (data.caixaOrigemFechado) {
        toast.success(
          `Transferência de ${formatCurrencyBRL(payload.valor)} concluída e Caixa ${selectedCaixa?.codigo} fechado com saldo zerado (R$ 0,00)!`
        )
      } else {
        toast.success(`Transferência de ${formatCurrencyBRL(payload.valor)} realizada com sucesso!`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao transferir valores')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmEstorno = async (motivo: string) => {
    if (!targetModalItem) return
    const itemToEstornar = targetModalItem
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'estornar_movimentacao',
          id: itemToEstornar.id,
          sourceId: itemToEstornar.sourceId,
          categoriaOrigem: itemToEstornar.categoriaOrigem,
          motivo,
          operador: currentUser?.nome || selectedCaixa?.operador || 'Operador',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao estornar lançamento')

      const nowISO = new Date().toISOString()
      const cleanSourceId = String(itemToEstornar.sourceId || itemToEstornar.id).replace(/^(CP-|REC-)/, '')
      setOverrides((prev) => {
        const base = data.overrides && typeof data.overrides === 'object' ? { ...prev, ...data.overrides } : { ...prev }
        base[itemToEstornar.id] = { ...(base[itemToEstornar.id] || {}), estornado: true, estornadoEm: nowISO, motivoEstorno: motivo }
        if (cleanSourceId) {
          base[cleanSourceId] = { ...(base[cleanSourceId] || {}), estornado: true, estornadoEm: nowISO, motivoEstorno: motivo }
        }
        return base
      })
      if (Array.isArray(data.movimentacoesManuais)) {
        setMovsManuais(data.movimentacoesManuais)
      } else {
        setMovsManuais((prev) => prev.filter((m) => m.id !== itemToEstornar.id && m.id !== cleanSourceId))
      }
      if (Array.isArray(data.contasPagarPagas)) {
        setContasPagarPagas(data.contasPagarPagas)
      } else if (itemToEstornar.categoriaOrigem === 'compromisso') {
        setContasPagarPagas((prev) => prev.filter((c) => c.id !== cleanSourceId))
      }
      if (itemToEstornar.categoriaOrigem === 'rec_aluno') {
        setTitulosPagos((prev) => prev.filter((t) => String(t.id) !== cleanSourceId))
      }

      setEstornarModalOpen(false)
      setTargetModalItem(null)
      toast.success(data.message || 'Lançamento estornado com sucesso!')
      await fetchMovimentacoesData(true)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao estornar lançamento')
    } finally {
      setSaving(false)
    }
  }

  const handleAlterarSituacaoCaixa = async (payload: {
    novaSituacao?: 'Aberto' | 'Fechado'
    acaoLabel: string
    detalhes: string
    saldoInformado?: number
  }) => {
    if (!selectedCaixa) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'alterar_situacao_caixa',
          caixaId: selectedCaixa.id,
          operador: currentUser?.nome || selectedCaixa.operador,
          saldoCalculado: kpisCaixa.saldoAtual,
          ...payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar situação do caixa')
      if (Array.isArray(data.caixas)) {
        setApiCaixas(data.caixas)
        setCfgCaixas(data.caixas)
      }
      setCaixaStatusModalMode(null)
      toast.success(`${payload.acaoLabel} registrado com sucesso!`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar caixa')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenReceipt = (items: UnifiedMovimentacaoItem | UnifiedMovimentacaoItem[]) => {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean)
    if (list.length === 0) return
    const first = list[0]
    const hasAluno = Boolean(first.hasAlunoVinculado)
    setReceiptModalData({
      natureza: first.tipoOperacao === 'Pagamento' ? 'pagar' : 'receber',
      turmaUnidade: first.unidade || selectedCaixa?.unidadeEmpresa,
      aluno: {
        id: hasAluno ? first.fornecedorId : undefined,
        nome: hasAluno ? first.alunoNome || first.fornecedorNome : first.fornecedorNome,
        codigo: undefined,
        unidade: first.unidade || selectedCaixa?.unidadeEmpresa || 'Colégio Impacto',
        responsavelFinanceiro: first.responsavelNome || first.fornecedorNome,
        semVinculoAluno: !hasAluno,
      },
      parcelas: list.map((item, idx) => ({
        num: idx + 1,
        evento: item.descricao,
        competencia: (item.dataLcto || '').slice(0, 7),
        vencimento: item.emissaoDocto || item.dataLcto,
        valor: item.valor,
        desconto: item.desconto,
        juros: item.juros,
        multa: item.multa,
        valorFinal: item.valorLiquido,
        dtPagto: item.dataLcto,
        formaPagto: item.tipoRecurso,
        caixaOrigem: `${item.caixaCodigo} - ${item.caixaDescricao}`,
        codBaixa: `LCTO-${item.codigoLcto}`,
        documentoFiscal: item.numeroDocumento || undefined,
        centroCusto: item.centroCusto,
        categoria: item.contaPlanoLabel,
        obs: item.observacao,
        status: 'pago',
      })),
    })
  }

  const handleExportExcel = (customList?: UnifiedMovimentacaoItem[]) => {
    const target = customList || lancamentosFiltrados
    if (target.length === 0) {
      toast.warning('Não há lançamentos para exportar.')
      return
    }
    const rows = target.map((item) => ({
      'Cód. Lcto': item.codigoLcto,
      Data: formatDateBR(item.dataLcto),
      'Favorecido / Aluno / Credor': item.fornecedorNome,
      'Nº Docto': item.numeroDocumento || '—',
      'Tipo Docto': item.tipoDocumento || '—',
      Descrição: item.descricao,
      'Plano de Contas': item.contaPlanoLabel,
      'Centro de Custo': item.centroCusto,
      Natureza: item.tipoOperacao === 'Recebimento' ? 'Entrada (+)' : 'Saída (-)',
      'Forma Pagto / Recurso': item.tipoRecurso,
      'Conciliado Banco': item.compensadoBanco,
      Origem: CATEGORIA_LEGEND_META[item.categoriaOrigem]?.label || item.categoriaOrigem,
      'Valor Líquido (R$)': item.tipoOperacao === 'Recebimento' ? item.valorLiquido : -item.valorLiquido,
      'Saldo Após Lcto (R$)': item.saldoAposLancamento ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Caixa_${selectedCaixa?.codigo || 'Mov'}`)
    XLSX.writeFile(wb, `Livro_Caixa_${selectedCaixa?.codigo || 'Geral'}_${hojeISO}.xlsx`)
    toast.success('Planilha Excel exportada com sucesso!')
  }

  return (
    <div style={{ padding: '18px 24px 56px', maxWidth: 1560, margin: '0 auto', color: '#0f172a' }}>
      {/* CSS de Tabela Responsiva Luxury Light Mode (Coerente com Contas a Pagar & Receber) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .table-wrapper.mv-table-region {
            width: 100%;
            max-inline-size: 100%;
            container-type: inline-size;
            overflow: visible !important;
            border-radius: 14px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.06);
          }
          .mv-data-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 12.5px;
            color: #0f172a;
          }
          .mv-data-table thead {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
          }
          .mv-data-table thead th {
            background: #f8fafc;
            color: #475569 !important;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 10px 10px;
            text-align: left;
            border-bottom: 1.5px solid #cbd5e1;
            border-inline-end: 1px solid rgba(203, 213, 225, 0.65);
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .mv-data-table thead th:last-child {
            border-inline-end: none;
          }
          .mv-data-table tbody td {
            padding: 9px 10px;
            border-top: 1px solid rgba(203, 213, 225, 0.55);
            border-inline-end: 1px solid rgba(203, 213, 225, 0.5);
            vertical-align: middle;
            color: #1e293b;
            background: inherit;
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .mv-data-table tbody td:last-child {
            border-inline-end: none;
          }
          .mv-data-table tbody td.mv-actions-cell {
            overflow: visible !important;
            padding: 7px 8px;
          }
          .mv-data-table tbody tr.mv-row-entrada {
            background-color: #f0fdf4;
          }
          .mv-data-table tbody tr.mv-row-entrada:hover {
            background-color: #dcfce7;
          }
          .mv-data-table tbody tr.mv-row-saida {
            background-color: #fff1f2;
          }
          .mv-data-table tbody tr.mv-row-saida:hover {
            background-color: #ffe4e6;
          }
          .mv-data-table tbody tr.mv-row-transf {
            background-color: #f0f9ff;
          }
          .mv-data-table tbody tr.mv-row-transf:hover {
            background-color: #e0f2fe;
          }
          @container (width < 760px) {
            .mv-data-table,
            .mv-data-table thead,
            .mv-data-table tbody,
            .mv-data-table tr,
            .mv-data-table th,
            .mv-data-table td {
              display: block;
            }
            .mv-data-table thead {
              display: none;
            }
            .mv-data-table tbody tr {
              margin-block-end: 0.75rem;
              padding: 0.85rem;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
            }
            .mv-data-table tbody td {
              display: grid;
              grid-template-columns: 7.5rem 1fr;
              padding: 4px 0;
              border: none;
              position: static;
            }
            .mv-data-table tbody td::before {
              content: var(--label) ": ";
              font-weight: 700;
              color: #64748b;
            }
          }
        `,
        }}
      />

      {/* ── HEADER EXECUTIVO & PAINEL DE CONTROLE DO CAIXA OPERACIONAL ───────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -6px rgba(15, 23, 42, 0.06)',
          marginBottom: 14,
          overflow: 'hidden',
        }}
      >
        {/* Faixa Superior: Identidade da Página + Exportação & Novo Lançamento */}
        <div
          style={{
            padding: '14px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.14)',
                flexShrink: 0,
              }}
            >
              <Wallet size={19} />
            </div>
            <div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#64748b',
                  display: 'block',
                }}
              >
                Tesouraria & Controladoria Escolar
              </span>
              <h1 style={{ margin: '1px 0 0', fontSize: 18.5, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                Movimentação Financeira
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 3,
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => handleExportExcel()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 7,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#047857',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                }}
              >
                <FileSpreadsheet size={13.5} />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 7,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                }}
              >
                <Printer size={13.5} />
                <span>Extrato</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!selectedCaixa) {
                  setShowCaixaModal(true)
                  return
                }
                if (selectedCaixa.situacao === 'Fechado') {
                  toast.warning('Este caixa está fechado. Reabra o caixa antes de registrar novas movimentações.')
                  return
                }
                setEditingItem(null)
                setPrefillNovaMov(null)
                setNovaMovModalOpen(true)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 38,
                padding: '0 16px',
                borderRadius: 10,
                background:
                  selectedCaixa?.situacao === 'Fechado'
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
              }}
            >
              <Plus size={15} />
              <span>Novo Lançamento no Caixa</span>
            </button>
          </div>
        </div>

        {/* Card do Caixa Operacional com Borda 3D e Sombra de Elevação Diferenciada */}
        <div
          style={{
            margin: '0 16px 16px',
            padding: '13px 18px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderTop: '1px solid #e2e8f0',
            borderBottom: '3px solid #94a3b8',
            boxShadow:
              '0 10px 22px -5px rgba(15, 23, 42, 0.14), 0 4px 8px -2px rgba(15, 23, 42, 0.08), inset 0 1px 0 0 #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Grade de Metadados do Caixa Ativo (Leitura Leve por Colunas) */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
            {/* Coluna 1: Caixa Selecionado + Botão Trocar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingRight: 18,
                borderRight: '1px solid #cbd5e1',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Caixa Selecionado
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                  {selectedCaixa ? `Caixa ${selectedCaixa.codigo} — ${selectedCaixa.descricao}` : 'Nenhum Caixa'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCaixaModal(true)}
                title="Trocar Caixa Operacional"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 7,
                  background: '#ffffff',
                  border: '1px solid #93c5fd',
                  color: '#1d4ed8',
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(29, 78, 216, 0.08)',
                }}
              >
                <RefreshCw size={11.5} />
                <span>Trocar Caixa</span>
              </button>
            </div>

            {/* Coluna 2: Status */}
            <div
              style={{
                padding: '0 18px',
                borderRight: '1px solid #cbd5e1',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Situação
              </div>
              <div style={{ marginTop: 2 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: selectedCaixa?.situacao === 'Aberto' ? '#dcfce7' : '#ffe4e6',
                    border: selectedCaixa?.situacao === 'Aberto' ? '1px solid #86efac' : '1px solid #fda4af',
                    color: selectedCaixa?.situacao === 'Aberto' ? '#15803d' : '#be123c',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: selectedCaixa?.situacao === 'Aberto' ? '#16a34a' : '#e11d48',
                    }}
                  />
                  {selectedCaixa ? selectedCaixa.situacao : 'Indefinido'}
                </span>
              </div>
            </div>

            {/* Coluna 3: Operador */}
            {selectedCaixa && (
              <div
                style={{
                  padding: '0 18px',
                  borderRight: '1px solid #cbd5e1',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Operador Responsável
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                  {selectedCaixa.operador}
                </div>
              </div>
            )}

            {/* Coluna 4: Data de Abertura */}
            {selectedCaixa && (
              <div
                style={{
                  padding: '0 18px',
                  borderRight: '1px solid #cbd5e1',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Abertura
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                  {formatDateBR(selectedCaixa.dataAbertura)}
                </div>
              </div>
            )}

            {/* Coluna 5: Saldo Atual Rápido */}
            {selectedCaixa && (
              <div style={{ paddingLeft: 18 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Saldo Disponível
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: kpisCaixa.saldoAtual >= 0 ? '#0369a1' : '#be123c',
                    marginTop: 1,
                  }}
                >
                  {formatCurrencyBRL(kpisCaixa.saldoAtual)}
                </div>
              </div>
            )}
          </div>

          {/* Grupo de Operações do Caixa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                if (!selectedCaixa) {
                  setShowCaixaModal(true)
                  return
                }
                if (selectedCaixa.situacao !== 'Aberto') {
                  toast.warning('Este caixa está Fechado. Reabra o caixa para realizar transferências.')
                  return
                }
                if (kpisCaixa.saldoAtual <= 0.009) {
                  toast.warning('Transferência indisponível: só é permitido transferir quando o caixa possui saldo positivo.')
                }
                setTransferInitialValor(null)
                setTransferirModalOpen(true)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 13px',
                borderRadius: 8,
                background: '#ffffff',
                border:
                  kpisCaixa.saldoAtual > 0.009 && selectedCaixa?.situacao === 'Aberto'
                    ? '1px solid #86efac'
                    : '1px solid #cbd5e1',
                color: kpisCaixa.saldoAtual > 0.009 && selectedCaixa?.situacao === 'Aberto' ? '#15803d' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <ArrowLeftRight size={13.5} />
              <span>Transferir</span>
            </button>

            <button
              type="button"
              onClick={() => setCaixaStatusModalMode('numerario')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 13px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0369a1',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Banknote size={13.5} />
              <span>Numerário</span>
            </button>

            {selectedCaixa && (
              <button
                type="button"
                onClick={() => {
                  if (selectedCaixa.situacao === 'Aberto' && Math.abs(kpisCaixa.saldoAtual) >= 0.01) {
                    toast.warning(
                      `O caixa possui saldo de ${formatCurrencyBRL(kpisCaixa.saldoAtual)}. Só é permitido fechar o caixa quando estiver zerado (R$ 0,00).`
                    )
                  }
                  setCaixaStatusModalMode(selectedCaixa.situacao === 'Aberto' ? 'fechar' : 'reabrir')
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 34,
                  padding: '0 13px',
                  borderRadius: 8,
                  background: selectedCaixa.situacao === 'Aberto' ? '#fff1f2' : '#ecfdf5',
                  border: selectedCaixa.situacao === 'Aberto' ? '1px solid #fda4af' : '1px solid #6ee7b7',
                  color: selectedCaixa.situacao === 'Aberto' ? '#be123c' : '#047857',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
              >
                {selectedCaixa.situacao === 'Aberto' ? <Lock size={13.5} /> : <Unlock size={13.5} />}
                <span>
                  {selectedCaixa.situacao === 'Aberto'
                    ? Math.abs(kpisCaixa.saldoAtual) < 0.01
                      ? 'Fechar Caixa (Zerado ✓)'
                      : 'Fechar Caixa'
                    : 'Reabrir Caixa'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── BANNER DE GOVERNANÇA QUANDO O CAIXA ESTÁ FECHADO ─────────────────── */}
      {selectedCaixa && selectedCaixa.situacao !== 'Aberto' && (
        <div
          role="status"
          style={{
            background: '#fff1f2',
            border: '1px solid #fda4af',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={17} style={{ color: '#be123c', flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: '#881337' }}>
              <strong>Caixa {selectedCaixa.codigo} - {selectedCaixa.descricao} está FECHADO (Somente Consulta):</strong>{' '}
              Novos lançamentos, edições, estornos e transferências estão bloqueados. Para movimentar este caixa,
              reabra-o primeiro.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCaixaStatusModalMode('reabrir')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #059669',
              background: '#059669',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Unlock size={13.5} />
            <span>Reabrir Caixa Agora</span>
          </button>
        </div>
      )}

      {/* ── FAIXA DE KPIS EXECUTIVOS DO CAIXA SELECIONADO ────────────────────── */}
      {selectedCaixa && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '12px 16px',
              boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo de Abertura
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {formatCurrencyBRL(kpisCaixa.saldoInicial)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Aberto em {formatDateBR(selectedCaixa.dataAbertura)}
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #bbf7d0',
              padding: '12px 16px',
              boxShadow: '0 2px 10px -4px rgba(16, 185, 129, 0.08)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
              Entradas / Recebimentos
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 4 }}>
              + {formatCurrencyBRL(kpisCaixa.entradas)}
            </div>
            <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
              {kpisCaixa.qtdEntradas} recebimento(s) no caixa
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #fecdd3',
              padding: '12px 16px',
              boxShadow: '0 2px 10px -4px rgba(225, 29, 72, 0.08)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>
              Saídas / Compromissos
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e11d48', marginTop: 4 }}>
              - {formatCurrencyBRL(kpisCaixa.saidas)}
            </div>
            <div style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>
              {kpisCaixa.qtdSaidas} pagamento(s) efetuado(s)
            </div>
          </div>

          <div
            style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: 14,
              border: '1px solid #7dd3fc',
              padding: '12px 16px',
              boxShadow: '0 4px 12px -4px rgba(2, 132, 199, 0.12)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
              Saldo Atual do Caixa ({selectedCaixa.codigo})
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 900,
                color: kpisCaixa.saldoAtual >= 0 ? '#0369a1' : '#be123c',
                marginTop: 4,
              }}
            >
              {formatCurrencyBRL(kpisCaixa.saldoAtual)}
            </div>
            <div style={{ fontSize: 11, color: '#0c4a6e', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span>{kpisCaixa.totalRegistros} lcto(s)</span>
              {Math.abs(kpisCaixa.saldoAtual) < 0.01 ? (
                <span style={{ fontWeight: 800, color: '#059669' }}>✓ Zerado (Apto p/ Fechar)</span>
              ) : kpisCaixa.saldoAtual > 0 && selectedCaixa.situacao === 'Aberto' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTransferInitialValor(kpisCaixa.saldoAtual)
                    setTransferirModalOpen(true)
                  }}
                  style={{
                    padding: '1px 6px',
                    borderRadius: 5,
                    border: '1px solid #0284c7',
                    background: '#ffffff',
                    color: '#0284c7',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Zerar / Transferir →
                </button>
              ) : null}
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '12px 16px',
              boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase' }}>
              Saldo Conciliado no Banco
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {formatCurrencyBRL(kpisCaixa.valorConciliadoLiquido)}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              {kpisCaixa.qtdConciliados} conciliados •{' '}
              <span style={{ color: kpisCaixa.qtdPendentesBanco > 0 ? '#d97706' : '#64748b', fontWeight: 700 }}>
                {kpisCaixa.qtdPendentesBanco} em trânsito
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── NAVEGAÇÃO PRINCIPAL EM ABAS ENXUTAS (Padrão Contas a Pagar) ──────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
          background: '#ffffff',
          padding: '5px 8px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            {
              id: 'lancamentos',
              label: `Livro Caixa & Lançamentos (${lancamentosFiltrados.length})`,
              icon: <LayoutList size={14} />,
            },
            {
              id: 'conciliacao_diaria',
              label: `Evolução Diária & Conciliação (${evolucaoDiaria.length} dias)`,
              icon: <Calendar size={14} />,
            },
            {
              id: 'analise_contas',
              label: 'Raio-X por Plano de Contas & C. Custo',
              icon: <BarChart3 size={14} />,
            },
            {
              id: 'auditoria_numerario',
              label: 'Auditoria & Histórico do Caixa',
              icon: <ShieldCheck size={14} />,
            },
          ].map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as MainTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  background: active ? '#0f172a' : 'transparent',
                  border: active ? '1px solid #0f172a' : '1px solid transparent',
                  color: active ? '#ffffff' : '#475569',
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 1: LIVRO CAIXA & LANÇAMENTOS (UNIFICADO E RESPONSIVO)
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lancamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Barra de Filtros em Grid Moderno e Limpo (Sem poluição de pílulas soltas) */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.05fr 0.8fr 0.8fr 0.95fr 0.9fr 0.8fr 0.78fr',
              gap: 10,
              alignItems: 'end',
            }}
          >
            {/* Busca Textual */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Favorecido, Aluno ou Doc
                </label>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#be123c',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Limpar todos os filtros ativos"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar favorecido, aluno, doc..."
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Natureza / Origem do Lançamento (Substitui as 8 pílulas soltas) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Natureza / Origem
                </label>
                {quickPill !== 'todos' && (
                  <button
                    type="button"
                    onClick={() => setQuickPill('todos')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#2563eb',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Todos
                  </button>
                )}
              </div>
              <select
                value={quickPill}
                onChange={(e) => setQuickPill(e.target.value as QuickStatusPill)}
                style={{
                  width: '100%',
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: quickPill !== 'todos' ? '#eff6ff' : '#f8fafc',
                  border: quickPill !== 'todos' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todos os Lançamentos ({todosLancamentosDoCaixa.length})</option>
                <option value="entradas">Entradas (+) ({kpisCaixa.qtdEntradas})</option>
                <option value="saidas">Saídas (-) ({kpisCaixa.qtdSaidas})</option>
                <option value="rec_aluno">
                  Contas a Receber • Recebimentos ({todosLancamentosDoCaixa.filter((x) => x.categoriaOrigem === 'rec_aluno').length})
                </option>
                <option value="compromisso">
                  Contas a Pagar • Compromissos ({todosLancamentosDoCaixa.filter((x) => x.categoriaOrigem === 'compromisso').length})
                </option>
                <option value="transf_valores">
                  Transferências ({todosLancamentosDoCaixa.filter((x) => x.categoriaOrigem === 'transf_valores').length})
                </option>
                <option value="mov_receita">
                  Lançamentos Diretos ({todosLancamentosDoCaixa.filter((x) => x.categoriaOrigem === 'mov_receita').length})
                </option>
                <option value="pendentes_banco">
                  Em Trânsito / Não Conciliados ({kpisCaixa.qtdPendentesBanco})
                </option>
              </select>
            </div>

            {/* Data Inicial */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Data Inicial
                </label>
                {dataInicial && (
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicial('')
                      if (!dataFinal) setPeriodoPreset('tudo')
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Limpar data inicial"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => {
                  const val = e.target.value
                  setDataInicial(val)
                  setPeriodoPreset(val || dataFinal ? 'personalizado' : 'tudo')
                }}
                style={{
                  width: '100%',
                  padding: '7.5px 9px',
                  borderRadius: 8,
                  background: dataInicial ? '#eff6ff' : '#f8fafc',
                  border: dataInicial ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Data Final + Atalhos Rápidos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 4 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Data Final
                </label>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {(
                    [
                      { id: 'hoje', label: 'Hoje' },
                      { id: 'mes_atual', label: 'Mês' },
                      { id: 'tudo', label: 'Tudo' },
                    ] as const
                  ).map((p) => {
                    const isAct =
                      (p.id === 'tudo' && !dataInicial && !dataFinal && periodoPreset === 'tudo') ||
                      (p.id !== 'tudo' && periodoPreset === p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPeriodoPreset(p.id)}
                        style={{
                          border: 'none',
                          background: isAct ? '#dbeafe' : 'transparent',
                          color: isAct ? '#1d4ed8' : '#2563eb',
                          fontSize: 9.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: isAct ? '1px 5px' : '1px 2px',
                          borderRadius: 4,
                        }}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => {
                  const val = e.target.value
                  setDataFinal(val)
                  setPeriodoPreset(dataInicial || val ? 'personalizado' : 'tudo')
                }}
                style={{
                  width: '100%',
                  padding: '7.5px 9px',
                  borderRadius: 8,
                  background: dataFinal ? '#eff6ff' : '#f8fafc',
                  border: dataFinal ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Plano de Contas */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Plano de Contas
                </label>
                <Link
                  href="/configuracoes/financeiro/plano-contas"
                  style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}
                >
                  Configurar
                </Link>
              </div>
              <select
                value={filtroContaPlano}
                onChange={(e) => setFiltroContaPlano(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todas">Todos os Planos</option>
                {opcoesFiltroContaPlano.map((cp) => (
                  <option key={cp} value={cp}>
                    {cp}
                  </option>
                ))}
              </select>
            </div>

            {/* Centro de Custo */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Centro de Custo
                </label>
                <Link
                  href="/configuracoes/financeiro/centro-custo"
                  style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}
                >
                  Configurar
                </Link>
              </div>
              <select
                value={filtroCentroCusto}
                onChange={(e) => setFiltroCentroCusto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todos os Centros</option>
                {opcoesFiltroCentroCusto.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>

            {/* Forma de Pagamento / Recurso */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                Meio de Pagto / Recurso
              </label>
              <select
                value={filtroTipoRecurso}
                onChange={(e) => setFiltroTipoRecurso(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="Todos">Todos os Recursos</option>
                {opcoesFiltroRecurso.map((rec) => (
                  <option key={rec} value={rec}>
                    {rec}
                  </option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                Ordenação
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="data_desc">Data (Mais Recentes)</option>
                <option value="data_asc">Data (Mais Antigos)</option>
                <option value="valor_desc">Maior Valor</option>
                <option value="valor_asc">Menor Valor</option>
              </select>
            </div>
          </div>

          {/* Barra Flutuante de Ações em Lote quando há itens marcados */}
          {selectedIds.size > 0 && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                background: '#ecfdf5',
                border: '1.5px solid #34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#065f46' }}>
                {selectedIds.size} lançamento(s) selecionado(s) • Soma Líquida:{' '}
                <strong style={{ color: '#047857', fontSize: 14 }}>
                  {formatCurrencyBRL(
                    selecionadosObjs.reduce(
                      (acc, x) => acc + (x.tipoOperacao === 'Recebimento' ? x.valorLiquido : -x.valorLiquido),
                      0
                    )
                  )}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleConciliarLote}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: '#059669',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Conciliar no Banco ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenReceipt(selecionadosObjs)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    border: '1px solid #93c5fd',
                    color: '#1d4ed8',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Emitir Recibo ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => handleExportExcel(selecionadosObjs)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Exportar Seleção
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: '#fff1f2',
                    border: '1px solid #fda4af',
                    color: '#be123c',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Limpar Seleção
                </button>
              </div>
            </div>
          )}

          {/* TABELA DE MOVIMENTAÇÃO FINANCEIRA (Padrão Luxury Light Mode) */}
          <div role="region" aria-labelledby="movimentacao-table-caption" className="table-wrapper mv-table-region">
            <table className="mv-data-table">
              <caption
                id="movimentacao-table-caption"
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ color: '#334155', fontWeight: 800 }}>
                      Extrato de Movimentações do Caixa ({lancamentosFiltrados.length} registros)
                    </span>
                    <span style={{ color: '#cbd5e1' }} aria-hidden="true">
                      •
                    </span>
                    <span style={{ color: '#047857', fontWeight: 700 }}>
                      Entradas: <strong>{formatCurrencyBRL(resumoFiltrado.entradas)}</strong>
                    </span>
                    <span style={{ color: '#be123c', fontWeight: 700 }}>
                      Saídas: <strong>{formatCurrencyBRL(resumoFiltrado.saidas)}</strong>
                    </span>
                    <span style={{ color: '#0369a1', fontWeight: 700 }}>
                      Resultado Filtrado:{' '}
                      <strong style={{ color: resumoFiltrado.saldoLiquido >= 0 ? '#0369a1' : '#be123c' }}>
                        {formatCurrencyBRL(resumoFiltrado.saldoLiquido)}
                      </strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 9px',
                          borderRadius: 6,
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#be123c',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <X size={12} /> Limpar Filtros
                      </button>
                    )}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#e2e8f0',
                        padding: 2,
                        borderRadius: 8,
                        gap: 2,
                      }}
                    >
                      {(
                        [
                          { id: 'todos', label: `Todos (${todosLancamentosDoCaixa.length})` },
                          { id: 'entradas', label: `Entradas (${kpisCaixa.qtdEntradas})` },
                          { id: 'saidas', label: `Saídas (${kpisCaixa.qtdSaidas})` },
                        ] as const
                      ).map((seg) => {
                        const active = quickPill === seg.id
                        return (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => setQuickPill(seg.id)}
                            style={{
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: active ? 800 : 600,
                              background: active ? '#ffffff' : 'transparent',
                              color:
                                active && seg.id === 'entradas'
                                  ? '#047857'
                                  : active && seg.id === 'saidas'
                                    ? '#be123c'
                                    : active
                                      ? '#0f172a'
                                      : '#475569',
                              boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {seg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </caption>
              <thead>
                <tr>
                  <th style={{ width: '3%', textAlign: 'center', padding: '10px 4px' }}>
                    <input
                      aria-label="Selecionar todos os lançamentos visíveis"
                      type="checkbox"
                      checked={
                        lancamentosPaginados.length > 0 &&
                        lancamentosPaginados.every((x) => selectedIds.has(x.id))
                      }
                      onChange={(e) => {
                        const next = new Set(selectedIds)
                        if (e.target.checked) lancamentosPaginados.forEach((x) => next.add(x.id))
                        else lancamentosPaginados.forEach((x) => next.delete(x.id))
                        setSelectedIds(next)
                      }}
                    />
                  </th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Lcto / Data</th>
                  <th style={{ width: '18%' }}>Favorecido / Aluno / Credor</th>
                  <th style={{ width: '19%' }}>Descrição & Nº Doc</th>
                  <th style={{ width: '18%' }}>Plano de Contas & C. Custo</th>
                  <th style={{ width: '10.5%', textAlign: 'center' }}>Recurso & Banco</th>
                  <th style={{ width: '9%', textAlign: 'right' }}>Valor Líquido</th>
                  <th style={{ width: '9%', textAlign: 'right' }}>Saldo Caixa</th>
                  <th style={{ width: '13.5%', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCaixa ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 42, textAlign: 'center', color: '#64748b' }}>
                      Selecione um Caixa Operacional para visualizar as movimentações.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 42, textAlign: 'center', color: '#64748b' }}>
                      Carregando lançamentos do Caixa {selectedCaixa.codigo}...
                    </td>
                  </tr>
                ) : lancamentosPaginados.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 42, textAlign: 'center', color: '#64748b' }}>
                      Nenhuma movimentação encontrada para os filtros selecionados neste caixa.
                    </td>
                  </tr>
                ) : (
                  lancamentosPaginados.map((item) => {
                    const meta = CATEGORIA_LEGEND_META[item.categoriaOrigem]
                    const isEntrada = item.tipoOperacao === 'Recebimento'
                    const isMenuOpen = openMenuId === item.id
                    const rowClass =
                      item.categoriaOrigem === 'transf_valores'
                        ? 'mv-row-transf'
                        : isEntrada
                          ? 'mv-row-entrada'
                          : 'mv-row-saida'

                    return (
                      <tr key={item.id} className={rowClass}>
                        {/* Checkbox + Faixa Lateral Semântica */}
                        <td
                          style={
                            {
                              '--label': 'Selecionar',
                              textAlign: 'center',
                              borderLeft: `4px solid ${meta.stripeColor}`,
                            } as React.CSSProperties
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds)
                              if (e.target.checked) next.add(item.id)
                              else next.delete(item.id)
                              setSelectedIds(next)
                            }}
                          />
                        </td>

                        {/* LCTO / DATA */}
                        <td
                          onClick={() => setInfoModalItem(item)}
                          style={{ '--label': 'Lcto / Data', textAlign: 'center', cursor: 'pointer' } as React.CSSProperties}
                        >
                          <div style={{ fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
                            {formatDateBR(item.dataLcto)}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#64748b',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            }}
                          >
                            #{item.codigoLcto}
                          </div>
                        </td>

                        {/* FAVORECIDO / ALUNO / CREDOR */}
                        <td
                          onClick={() => setInfoModalItem(item)}
                          title={`${item.fornecedorNome} (${meta.label})`}
                          style={{ '--label': 'Favorecido', cursor: 'pointer' } as React.CSSProperties}
                        >
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 800,
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.fornecedorNome}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: meta.pillBg,
                                color: meta.pillColor,
                                border: `1px solid ${meta.pillBorder}`,
                                fontSize: 9.5,
                                fontWeight: 800,
                              }}
                            >
                              {getCategoriaShortLabel(item)}
                            </span>
                            {item.fornecedorSubtitulo && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: '#64748b',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.fornecedorSubtitulo}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* DESCRIÇÃO & Nº DO DOC (Descrição em cima e Nº do Doc embaixo) */}
                        <td
                          onClick={() => setInfoModalItem(item)}
                          title={`${item.descricao}${item.numeroDocumento ? ` • Doc: ${item.numeroDocumento}` : ''}`}
                          style={{ '--label': 'Descrição & Nº Doc', cursor: 'pointer' } as React.CSSProperties}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.descricao}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 10.5, color: '#64748b' }}>
                              {item.numeroDocumento ? `Doc: ${item.numeroDocumento}` : 'Sem nº doc'}
                            </span>
                            {item.parcelaInfo && (
                              <span
                                style={{
                                  padding: '0px 5px',
                                  borderRadius: 4,
                                  background: '#ede9fe',
                                  color: '#6d28d9',
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                }}
                              >
                                {item.parcelaInfo}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* PLANO DE CONTAS & CENTRO DE CUSTO */}
                        <td
                          onClick={() => setInfoModalItem(item)}
                          title={`${item.contaPlanoLabel}${item.centroCusto ? ` • ${item.centroCusto}` : ''}`}
                          style={{ '--label': 'Plano de Contas', cursor: 'pointer' } as React.CSSProperties}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: '#0369a1',
                              fontSize: 11.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.contaPlanoLabel}
                          </div>
                          {(item.centroCusto || (item.rateio && item.rateio.length > 1)) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              {item.centroCusto && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#475569',
                                    background: 'rgba(255,255,255,0.8)',
                                    border: '1px solid #cbd5e1',
                                    padding: '0px 5px',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {item.centroCusto}
                                </span>
                              )}
                              {item.rateio && item.rateio.length > 1 && (
                                <span
                                  style={{
                                    padding: '0px 5px',
                                    borderRadius: 4,
                                    background: '#ecfeff',
                                    border: '1px solid #a5f3fc',
                                    color: '#0e7490',
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                  }}
                                >
                                  Rateio ({item.rateio.length})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* RECURSO & CONCILIAÇÃO BANCÁRIA EM 1 CLIQUE */}
                        <td style={{ '--label': 'Recurso', textAlign: 'center' } as React.CSSProperties}>
                          <div style={{ fontWeight: 800, fontSize: 11.5, color: '#0f172a' }}>{item.tipoRecurso}</div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleCompensado(item)
                            }}
                            title="Clique para alternar entre Conciliado no Banco e Em Trânsito"
                            style={{
                              marginTop: 2,
                              padding: '1px 7px',
                              borderRadius: 99,
                              fontSize: 9.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: item.compensadoBanco === 'Sim' ? '#dcfce7' : '#fef3c7',
                              color: item.compensadoBanco === 'Sim' ? '#166534' : '#92400e',
                              border: item.compensadoBanco === 'Sim' ? '1px solid #86efac' : '1px solid #fde68a',
                            }}
                          >
                            {item.compensadoBanco === 'Sim' ? '✓ Conciliado' : '⏳ Em Trânsito'}
                          </button>
                        </td>

                        {/* VALOR LÍQUIDO */}
                        <td style={{ '--label': 'Valor Líquido', textAlign: 'right' } as React.CSSProperties}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color: isEntrada ? '#047857' : '#be123c',
                            }}
                          >
                            {isEntrada ? '+ ' : '- '}
                            {formatCurrencyBRL(item.valorLiquido)}
                          </div>
                        </td>

                        {/* SALDO APÓS LANÇAMENTO (Diferencial de Auditoria) */}
                        <td style={{ '--label': 'Saldo Caixa', textAlign: 'right' } as React.CSSProperties}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: (item.saldoAposLancamento ?? 0) >= 0 ? '#334155' : '#be123c',
                            }}
                          >
                            {formatCurrencyBRL(item.saldoAposLancamento ?? 0)}
                          </div>
                        </td>

                        {/* AÇÕES DIRETAS NA LINHA (Padrão Contas a Pagar) */}
                        <td
                          className="mv-actions-cell"
                          style={{ '--label': 'Ações', textAlign: 'right', position: 'relative' } as React.CSSProperties}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              justifyContent: 'flex-end',
                              flexWrap: 'nowrap',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(item)}
                              title="Emitir Recibo Oficial (A4 / Bobina / WhatsApp)"
                              style={{
                                padding: '5px 8px',
                                borderRadius: 7,
                                background: '#eff6ff',
                                border: '1px solid #93c5fd',
                                color: '#1d4ed8',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <FileText size={11.5} />
                              Recibo
                            </button>

                            <button
                              type="button"
                              onClick={() => setInfoModalItem(item)}
                              title="Abrir Ficha Detalhada & Auditoria"
                              style={{
                                padding: '5px 8px',
                                borderRadius: 7,
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Ficha
                            </button>

                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(isMenuOpen ? null : item.id)
                                }}
                                style={{
                                  width: 27,
                                  height: 27,
                                  borderRadius: 7,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <MoreVertical size={14} />
                              </button>

                              {isMenuOpen && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 'calc(100% + 4px)',
                                    width: 205,
                                    background: '#ffffff',
                                    borderRadius: 10,
                                    border: '1px solid #cbd5e1',
                                    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.18)',
                                    padding: '5px 0',
                                    zIndex: 300,
                                    textAlign: 'left',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setEditingItem(item)
                                      setNovaMovModalOpen(true)
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Edit3 size={13.5} color="#0284c7" />
                                    Editar / Classificar Conta
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setTargetModalItem(item)
                                      setRateioModalOpen(true)
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <PieChart size={13.5} color="#7c3aed" />
                                    Rateio de Centro de Custo
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      handleToggleCompensado(item)
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <CheckCircle2 size={13.5} color="#059669" />
                                    {item.compensadoBanco === 'Sim' ? 'Marcar Em Trânsito' : 'Conciliar no Banco'}
                                  </button>

                                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setTargetModalItem(item)
                                      setEstornarModalOpen(true)
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: '#be123c',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <RotateCcw size={13.5} />
                                    Estornar / Reverter Baixa
                                  </button>

                                  {!item.isAutomaticOrigin && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleDeleteItem(item)
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: '#dc2626',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Trash2 size={13.5} />
                                      Excluir Lançamento Manual
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            {/* Rodapé de Paginação Limpo */}
            <div
              style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                Exibindo {lancamentosFiltrados.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a{' '}
                {Math.min(currentPage * pageSize, lancamentosFiltrados.length)} de {lancamentosFiltrados.length}{' '}
                movimentações
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  <option value={15}>15 por página</option>
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>

                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 2: EVOLUÇÃO DIÁRIA DE SALDO & CONCILIAÇÃO BANCÁRIA
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'conciliacao_diaria' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              Fechamento Diário Acumulado do Caixa {selectedCaixa?.codigo}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
              Acompanhe o Saldo Inicial do Dia, Total de Entradas, Total de Saídas e o Saldo Final Acumulado dia a dia.
            </p>
          </div>
          <table className="mv-data-table">
            <thead>
              <tr>
                <th>Data do Movimento</th>
                <th style={{ textAlign: 'center' }}>Qtd. Lctos</th>
                <th style={{ textAlign: 'right' }}>Saldo Anterior</th>
                <th style={{ textAlign: 'right' }}>Entradas do Dia (+)</th>
                <th style={{ textAlign: 'right' }}>Saídas do Dia (-)</th>
                <th style={{ textAlign: 'right' }}>Resultado do Dia</th>
                <th style={{ textAlign: 'right' }}>Saldo Final Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {evolucaoDiaria.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                    Nenhuma movimentação registrada neste caixa.
                  </td>
                </tr>
              ) : (
                evolucaoDiaria.map((d) => (
                  <tr key={d.data}>
                    <td style={{ fontWeight: 800 }}>{formatDateBR(d.data)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{d.qtd}</td>
                    <td style={{ textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                      {formatCurrencyBRL(d.saldoAnterior)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#047857', fontWeight: 800 }}>
                      + {formatCurrencyBRL(d.entradas)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#be123c', fontWeight: 800 }}>
                      - {formatCurrencyBRL(d.saidas)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        color: d.variacao >= 0 ? '#047857' : '#be123c',
                      }}
                    >
                      {formatCurrencyBRL(d.variacao)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#0369a1' }}>
                      {formatCurrencyBRL(d.saldoFinalDia)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 3: RAIO-X POR PLANO DE CONTAS, CENTRO DE CUSTO E RECURSO
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analise_contas' && selectedCaixa && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
              Movimentação por Plano de Contas
            </div>
            <table className="mv-data-table">
              <thead>
                <tr>
                  <th>Plano de Contas</th>
                  <th style={{ textAlign: 'right' }}>Entradas (+)</th>
                  <th style={{ textAlign: 'right' }}>Saídas (-)</th>
                </tr>
              </thead>
              <tbody>
                {opcoesFiltroContaPlano.map((cp) => {
                  const itemsCp = lancamentosFiltrados.filter((x) => x.contaPlanoLabel === cp)
                  const ent = itemsCp.filter((x) => x.tipoOperacao === 'Recebimento').reduce((s, x) => s + x.valorLiquido, 0)
                  const sai = itemsCp.filter((x) => x.tipoOperacao === 'Pagamento').reduce((s, x) => s + x.valorLiquido, 0)
                  return (
                    <tr key={cp}>
                      <td style={{ fontWeight: 700 }}>{cp}</td>
                      <td style={{ textAlign: 'right', color: '#047857', fontWeight: 700 }}>{formatCurrencyBRL(ent)}</td>
                      <td style={{ textAlign: 'right', color: '#be123c', fontWeight: 700 }}>{formatCurrencyBRL(sai)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
              Movimentação por Centro de Custo & Meio de Pagamento
            </div>
            <table className="mv-data-table">
              <thead>
                <tr>
                  <th>Centro de Custo</th>
                  <th style={{ textAlign: 'right' }}>Entradas (+)</th>
                  <th style={{ textAlign: 'right' }}>Saídas (-)</th>
                </tr>
              </thead>
              <tbody>
                {opcoesFiltroCentroCusto.map((cc) => {
                  const itemsCc = lancamentosFiltrados.filter((x) => x.centroCusto === cc)
                  const ent = itemsCc.filter((x) => x.tipoOperacao === 'Recebimento').reduce((s, x) => s + x.valorLiquido, 0)
                  const sai = itemsCc.filter((x) => x.tipoOperacao === 'Pagamento').reduce((s, x) => s + x.valorLiquido, 0)
                  return (
                    <tr key={cc}>
                      <td style={{ fontWeight: 700 }}>{cc}</td>
                      <td style={{ textAlign: 'right', color: '#047857', fontWeight: 700 }}>{formatCurrencyBRL(ent)}</td>
                      <td style={{ textAlign: 'right', color: '#be123c', fontWeight: 700 }}>{formatCurrencyBRL(sai)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 4: AUDITORIA & HISTÓRICO DE OPERAÇÕES DO CAIXA
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'auditoria_numerario' && selectedCaixa && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                Trilha de Auditoria do Caixa {selectedCaixa.codigo} — {selectedCaixa.descricao}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Registro de aberturas, fechamentos, conferências de numerário e transferências deste caixa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCaixaStatusModalMode('numerario')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Nova Conferência de Cédulas e Moedas
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(selectedCaixa.historico || []).map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                    {h.acao} — <span style={{ color: '#0284c7' }}>{h.usuario}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {h.detalhes || (h as any).observacao || 'Movimentação operacional do caixa.'}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                  {formatDateBR(h.dataHora)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAIS OPERACIONAIS ────────────────────────────────────────────── */}
      <CaixaSelectorModal
        open={showCaixaModal}
        caixas={allCaixas}
        selectedCaixa={selectedCaixa}
        currentUser={currentUser}
        currentUserPerfil={currentUserPerfil}
        unidadesDisponiveis={unidadesDisponiveis}
        saldosPorCaixaMap={saldosPorCaixaMap}
        onSelectCaixa={handleSelectCaixa}
        onQuickCreateCaixa={handleQuickCreateCaixa}
        onClose={selectedCaixa ? () => setShowCaixaModal(false) : undefined}
      />

      {selectedCaixa && (
        <>
          <NovaMovimentacaoModal
            open={novaMovModalOpen}
            editingItem={editingItem}
            prefillData={prefillNovaMov}
            selectedCaixa={selectedCaixa}
            saldoAtualCaixa={kpisCaixa.saldoAtual}
            totalRegistrosCaixa={kpisCaixa.totalRegistros}
            fornecedores={fornecedores}
            planoContas={planoContasMerged}
            centrosCusto={centrosCustoMerged}
            tiposDocumento={tiposDocumentoMerged}
            metodosPagamento={apiMetodosPagamento}
            saving={saving}
            onSave={handleSaveMovimentacao}
            onClose={() => {
              setNovaMovModalOpen(false)
              setEditingItem(null)
              setPrefillNovaMov(null)
            }}
          />

          <RateioModal
            open={rateioModalOpen}
            item={targetModalItem}
            centrosCusto={centrosCustoMerged}
            saving={saving}
            onSaveRateio={handleSaveRateio}
            onClose={() => setRateioModalOpen(false)}
          />

          <TransferirValoresModal
            open={transferirModalOpen}
            selectedCaixa={selectedCaixa}
            allCaixas={allCaixas}
            saldoAtual={kpisCaixa.saldoAtual}
            saldosPorCaixaMap={saldosPorCaixaMap}
            initialValor={transferInitialValor}
            saving={saving}
            onConfirmTransfer={handleConfirmTransfer}
            onClose={() => {
              setTransferirModalOpen(false)
              setTransferInitialValor(null)
            }}
          />

          <EstornarMovimentacaoModal
            open={estornarModalOpen}
            item={targetModalItem}
            saving={saving}
            onConfirmEstorno={handleConfirmEstorno}
            onClose={() => setEstornarModalOpen(false)}
          />

          <ResumoCaixaModal
            open={resumoModalOpen}
            selectedCaixa={selectedCaixa}
            items={lancamentosFiltrados}
            onClose={() => setResumoModalOpen(false)}
          />

          {caixaStatusModalMode && (
            <FecharReabrirCaixaModal
              open={Boolean(caixaStatusModalMode)}
              mode={caixaStatusModalMode}
              selectedCaixa={selectedCaixa}
              saldoCalculado={kpisCaixa.saldoAtual}
              resumoCaixa={saldosPorCaixaMap[selectedCaixa.id]}
              saving={saving}
              onConfirm={handleAlterarSituacaoCaixa}
              onRequestTransferToZero={(valPositivo) => {
                setTransferInitialValor(valPositivo)
                setTransferirModalOpen(true)
              }}
              onRequestSuprimentoToZero={(valFaltante) => {
                setEditingItem(null)
                setPrefillNovaMov({
                  tipoOperacao: 'Recebimento',
                  valor: valFaltante,
                  descricao: 'Suprimento / Regularização de Saldo para Fechamento de Caixa',
                })
                setNovaMovModalOpen(true)
              }}
              onClose={() => setCaixaStatusModalMode(null)}
            />
          )}

          <InfoDetalhesModal
            open={Boolean(infoModalItem)}
            item={infoModalItem}
            onClose={() => setInfoModalItem(null)}
            onEdit={(it) => {
              setEditingItem(it)
              setNovaMovModalOpen(true)
            }}
            onOpenReceipt={(it) => handleOpenReceipt(it)}
            onOpenRateio={(it) => {
              setTargetModalItem(it)
              setRateioModalOpen(true)
            }}
            onOpenEstorno={(it) => {
              setTargetModalItem(it)
              setEstornarModalOpen(true)
            }}
          />
        </>
      )}

      {receiptModalData && (
        <ReceiptModal
          {...receiptModalData}
          onClose={() => setReceiptModalData(null)}
        />
      )}
    </div>
  )
}
