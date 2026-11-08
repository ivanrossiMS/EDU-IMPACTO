'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  TrendingDown, Plus, Search, Upload, Printer,
  AlertTriangle, Calendar, BarChart3, Target,
  Building2, Repeat, Eye, Edit3, Trash2, Check,
  LayoutList, LayoutGrid, FileSpreadsheet, RotateCcw,
  QrCode, MoreVertical, Barcode, Copy, X, ChevronLeft, ChevronRight,
  Paperclip, Camera, FileText
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { apiFetch } from '@/lib/api/apiClient'
import { formatCurrency } from '@/lib/utils'
import { ReceiptModal, buildContaPagarReceiptData } from '@/components/financeiro/ReceiptModal'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type OrcamentoCategoriaItem,
  type PlanoContasEscolarOption,
  type AnexoContaPagarItem,
  type RecorrenciaFixaEscolar,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  resolveCentrosCustoEscolares,
  resolvePlanoContasEscolares,
  resolveUnidadesEscolares,
  resolveMetodosPagamentoEscolares,
  resolveCaixasEscolares,
  matchContaPlanoContas,
  STATUS_CONTA_PAGAR_CONFIG,
  PRIORIDADE_CONTA_PAGAR_CONFIG,
  normalizarContaPagar,
  openPrintOrdemPagamento,
  openPrintBorderoPagamentos,
} from './types'
import { ContaPagarFormModal } from './components/ContaPagarFormModal'
import { BaixaContaModal } from './components/BaixaContaModal'
import { ContaFichaModal } from './components/ContaFichaModal'
import { AnexosLancamentoModal } from './components/AnexosLancamentoModal'

const RelatoriosContasPagarTab = dynamic(
  () => import('./components/RelatoriosContasPagarTab').then((m) => m.RelatoriosContasPagarTab),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando Central de Relatórios & BI...</div> }
)
const CalendarioDesembolsoTab = dynamic(
  () => import('./components/CalendarioDesembolsoTab').then((m) => m.CalendarioDesembolsoTab),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando Calendário de Desembolso...</div> }
)
const OrcamentoEscolarTab = dynamic(
  () => import('./components/OrcamentoFornecedoresTabs').then((m) => m.OrcamentoEscolarTab),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando Orçamento Escolar...</div> }
)
const FornecedoresEscolaresTab = dynamic(
  () => import('./components/OrcamentoFornecedoresTabs').then((m) => m.FornecedoresEscolaresTab),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando Diretório de Fornecedores...</div> }
)
const RecorrentesTemplatesTab = dynamic(
  () => import('./components/OrcamentoFornecedoresTabs').then((m) => m.RecorrentesTemplatesTab),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando Matriz de Contratos & Recorrências...</div> }
)

type MainTab =
  | 'lancamentos'
  | 'relatorios'
  | 'calendario'
  | 'orcamento'
  | 'fornecedores'
  | 'recorrentes'

const PAGE_SIZE = 20

export default function ContasPagarPage() {
  const { alunos, titulos, cfgPlanoContas, cfgEventos, cfgCentrosCusto, cfgMetodosPagamento, cfgCaixas, mantenedores } = useData()
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') toast.error(msg)
    else toast.success(msg)
  }, [])

  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const mesAtualStr = useMemo(() => hojeStr.slice(0, 7), [hojeStr])

  // Estado Principal
  const [contas, setContas] = useState<ContaPagarRecord[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorEscolar[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoCategoriaItem[]>([])
  const [recorrencias, setRecorrencias] = useState<RecorrenciaFixaEscolar[]>([])
  const [planoContasApi, setPlanoContasApi] = useState<any[]>([])
  const [centrosCustoApi, setCentrosCustoApi] = useState<any[]>([])
  const [mantenedoresApi, setMantenedoresApi] = useState<any[]>([])
  const [metodosPagamentoApi, setMetodosPagamentoApi] = useState<any[]>([])
  const [caixasApi, setCaixasApi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MainTab>('lancamentos')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [currentPage, setCurrentPage] = useState(1)

  const rawCentrosCusto = useMemo(
    () => (Array.isArray(cfgCentrosCusto) && cfgCentrosCusto.length > 0 ? cfgCentrosCusto : centrosCustoApi),
    [cfgCentrosCusto, centrosCustoApi]
  )

  const centrosCustoAtivos = useMemo(
    () => resolveCentrosCustoEscolares(rawCentrosCusto, 'despesa', false),
    [rawCentrosCusto]
  )

  const todosCentrosCusto = useMemo(
    () => resolveCentrosCustoEscolares(rawCentrosCusto, 'todos', true),
    [rawCentrosCusto]
  )

  const rawPlanoContas = useMemo(
    () => (Array.isArray(cfgPlanoContas) && cfgPlanoContas.length > 0 ? cfgPlanoContas : planoContasApi),
    [cfgPlanoContas, planoContasApi]
  )

  const unidadesEscolares = useMemo(
    () =>
      resolveUnidadesEscolares(
        Array.isArray(mantenedores) && mantenedores.length > 0 ? mantenedores : mantenedoresApi
      ),
    [mantenedores, mantenedoresApi]
  )

  const metodosPagamentoAtivos = useMemo(
    () =>
      resolveMetodosPagamentoEscolares(
        Array.isArray(cfgMetodosPagamento) && cfgMetodosPagamento.length > 0
          ? cfgMetodosPagamento
          : metodosPagamentoApi,
        false
      ),
    [cfgMetodosPagamento, metodosPagamentoApi]
  )

  const caixasEscolaresAtivos = useMemo(
    () =>
      resolveCaixasEscolares(
        Array.isArray(cfgCaixas) && cfgCaixas.length > 0 ? cfgCaixas : caixasApi,
        true
      ),
    [cfgCaixas, caixasApi]
  )

  const planosContasAtivos = useMemo(
    () => resolvePlanoContasEscolares(rawPlanoContas, 'todos', false),
    [rawPlanoContas]
  )

  const todosPlanosContas = useMemo(
    () => resolvePlanoContasEscolares(rawPlanoContas, 'todos', true),
    [rawPlanoContas]
  )

  // Filtros e Busca
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch] = useDebounce(searchInput, 220)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
  const [dataInicialFilter, setDataInicialFilter] = useState<string>('')
  const [dataFinalFilter, setDataFinalFilter] = useState<string>('')
  const [competenciaFilter, setCompetenciaFilter] = useState<string>('todos')
  const [prioridadeFilter] = useState<string>('todas')
  const [tipoCustoFilter] = useState<string>('todos')
  const [sortBy, setSortBy] = useState<'vencimento_asc' | 'vencimento_desc' | 'valor_desc' | 'valor_asc'>('vencimento_asc')

  // Seleção em Lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modais e Menu 3 Pontinhos
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ContaPagarRecord | null>(null)
  const [baixaTargets, setBaixaTargets] = useState<ContaPagarRecord[]>([])
  const [fichaConta, setFichaConta] = useState<ContaPagarRecord | null>(null)
  const [receiptContas, setReceiptContas] = useState<ContaPagarRecord[] | null>(null)
  const [anexosModalTarget, setAnexosModalTarget] = useState<{
    conta: ContaPagarRecord
    mode: 'arquivos' | 'camera'
  } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [openMenuPos, setOpenMenuPos] = useState<{
    top?: number
    bottom?: number
    right: number
  } | null>(null)
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fecha menu de 3 pontinhos ao clicar fora, rolar ou pressionar Escape
  useEffect(() => {
    if (!openMenuId) return
    const handleClose = () => {
      setOpenMenuId(null)
      setOpenMenuPos(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('click', handleClose)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [openMenuId])

  // Carregamento Inicial da API
  const fetchContasPagar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/contas-pagar?includeMeta=true', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar Contas a Pagar')
      const json = await res.json()
      const rawList = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
      setContas(rawList.map((c: any, idx: number) => normalizarContaPagar(c, idx, hojeStr)))
      if (Array.isArray(json?.fornecedores)) setFornecedores(json.fornecedores)
      if (Array.isArray(json?.orcamentos)) setOrcamentos(json.orcamentos)
      if (Array.isArray(json?.recorrencias)) setRecorrencias(json.recorrencias)
      if (Array.isArray(json?.planoContas)) setPlanoContasApi(json.planoContas)
      if (Array.isArray(json?.centrosCusto)) setCentrosCustoApi(json.centrosCusto)
      if (Array.isArray(json?.mantenedores)) setMantenedoresApi(json.mantenedores)
      if (Array.isArray(json?.metodosPagamento)) setMetodosPagamentoApi(json.metodosPagamento)
      if (Array.isArray(json?.caixas)) setCaixasApi(json.caixas)
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar Contas a Pagar', 'error')
    } finally {
      setLoading(false)
    }
  }, [hojeStr, showToast])

  useEffect(() => {
    fetchContasPagar()
  }, [fetchContasPagar])

  // Total de alunos ativos para cálculo de Custo por Aluno
  const totalAlunosAtivos = useMemo(() => {
    const ativos = (alunos || []).filter((a: any) => !a.status || a.status === 'matriculado' || a.status === 'ativo')
    return Math.max(1, ativos.length)
  }, [alunos])

  // Receita prevista do mês atual (para indicador de Comprometimento da Receita)
  const receitaMensalReferencia = useMemo(() => {
    const somaTitulosMes = (titulos || [])
      .filter((t: any) => (t.vencimento || '').startsWith(mesAtualStr) && t.status !== 'cancelado')
      .reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)
    return somaTitulosMes
  }, [titulos, mesAtualStr])

  // Competências disponíveis para filtro
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>([mesAtualStr])
    for (const c of contas) {
      if (c.competencia) set.add(c.competencia)
      else if (c.vencimento) set.add(c.vencimento.slice(0, 7))
    }
    return Array.from(set).sort().reverse()
  }, [contas, mesAtualStr])

  // KPIs Executivos Globais e do Filtro
  const kpis = useMemo(() => {
    const d7Str = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    let totalComprometido = 0
    let totalPago = 0
    let totalAberto = 0
    let totalVencido = 0
    let qtdVencido = 0
    let venceHojeValor = 0
    let venceHojeQtd = 0
    let vence7DiasValor = 0
    let vence7DiasQtd = 0
    let pendenteAprovacaoQtd = 0
    let totalFolhaPessoal = 0

    for (const c of contas) {
      if (c.status === 'cancelado') continue
      const refComp = c.competencia || c.vencimento.slice(0, 7)
      const matchesComp = competenciaFilter === 'todos' || refComp === competenciaFilter
      const val = Number(c.valor || 0)

      if (matchesComp) {
        totalComprometido += val
        if (c.status === 'pago') {
          totalPago += Number(c.valorPago || val)
        } else {
          totalAberto += val
        }
        if (
          c.categoria.includes('Pessoal') ||
          c.categoria.includes('Docente') ||
          c.categoria.includes('Encargos')
        ) {
          totalFolhaPessoal += val
        }
      }

      if (c.status !== 'pago') {
        if (c.vencimento < hojeStr || c.status === 'vencido') {
          totalVencido += val
          qtdVencido += 1
        }
        if (c.vencimento === hojeStr) {
          venceHojeValor += val
          venceHojeQtd += 1
        } else if (c.vencimento > hojeStr && c.vencimento <= d7Str) {
          vence7DiasValor += val
          vence7DiasQtd += 1
        }
        if (c.aprovacaoStatus === 'pendente_aprovacao') {
          pendenteAprovacaoQtd += 1
        }
      }
    }

    const custoMedioPorAluno = Math.round((totalComprometido / totalAlunosAtivos) * 100) / 100
    const pctFolhaSobreDespesa = totalComprometido > 0 ? Math.round((totalFolhaPessoal / totalComprometido) * 1000) / 10 : 0
    const pctComprometimentoReceita =
      receitaMensalReferencia > 0 ? Math.round((totalComprometido / receitaMensalReferencia) * 1000) / 10 : 0

    return {
      totalComprometido,
      totalPago,
      totalAberto,
      totalVencido,
      qtdVencido,
      venceHojeValor,
      venceHojeQtd,
      vence7DiasValor,
      vence7DiasQtd,
      pendenteAprovacaoQtd,
      custoMedioPorAluno,
      pctFolhaSobreDespesa,
      pctComprometimentoReceita,
    }
  }, [contas, competenciaFilter, hojeStr, totalAlunosAtivos, receitaMensalReferencia])

  // Lista Filtrada e Ordenada
  const contasFiltradas = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const d7Str = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    const filtered = contas.filter((c) => {
      if (statusFilter === 'vencido' && c.status !== 'vencido') return false
      if (statusFilter === 'pendente' && c.status !== 'pendente' && c.status !== 'agendado') return false
      if (statusFilter === 'pago' && c.status !== 'pago') return false
      if (statusFilter === 'hoje' && (c.status === 'pago' || c.vencimento !== hojeStr)) return false
      if (statusFilter === '7dias' && (c.status === 'pago' || c.vencimento < hojeStr || c.vencimento > d7Str)) return false
      if (statusFilter === 'aprovacao' && c.aprovacaoStatus !== 'pendente_aprovacao') return false

      if (categoriaFilter !== 'todas' && !matchContaPlanoContas(c, categoriaFilter, todosPlanosContas)) return false
      if (centroCustoFilter !== 'todos') {
        const matchMain = c.centroCusto === centroCustoFilter
        const matchRateio = c.rateio?.some((r) => r.centroCusto === centroCustoFilter)
        if (!matchMain && !matchRateio) return false
      }
      if (dataInicialFilter && (c.vencimento || '') < dataInicialFilter) return false
      if (dataFinalFilter && (c.vencimento || '') > dataFinalFilter) return false
      if (competenciaFilter !== 'todos') {
        const comp = c.competencia || c.vencimento.slice(0, 7)
        if (comp !== competenciaFilter) return false
      }
      if (prioridadeFilter !== 'todas' && c.prioridade !== prioridadeFilter) return false
      if (tipoCustoFilter !== 'todos' && c.tipoCusto !== tipoCustoFilter) return false

      if (q) {
        const hay = `${c.codigo || ''} ${c.descricao} ${c.fornecedorNome} ${c.fornecedorDocumento || ''} ${c.categoria} ${c.centroCusto} ${c.numeroDocumento || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'vencimento_asc') return (a.vencimento || '').localeCompare(b.vencimento || '')
      if (sortBy === 'vencimento_desc') return (b.vencimento || '').localeCompare(a.vencimento || '')
      if (sortBy === 'valor_desc') return (Number(b.valor) || 0) - (Number(a.valor) || 0)
      return (Number(a.valor) || 0) - (Number(b.valor) || 0)
    })
  }, [
    contas,
    debouncedSearch,
    statusFilter,
    categoriaFilter,
    centroCustoFilter,
    dataInicialFilter,
    dataFinalFilter,
    competenciaFilter,
    prioridadeFilter,
    tipoCustoFilter,
    sortBy,
    hojeStr,
    todosPlanosContas,
  ])

  // Handlers de Persistência na API
  const handleSaveContas = async (records: Partial<ContaPagarRecord>[]) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: records }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Erro ao salvar lançamento')
    if (Array.isArray(json.data)) setContas(json.data)
    showToast(
      records.length > 1
        ? `${records.length} parcelas geradas com sucesso!`
        : editingRecord
          ? 'Título atualizado com sucesso!'
          : 'Nova conta a pagar registrada com sucesso!',
      'success'
    )
  }

  const handleConfirmBaixaIndividual = async (payload: any) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'baixa', ...payload }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json?.error || 'Erro ao efetuar baixa', 'error')
      return
    }
    const nextList: ContaPagarRecord[] = Array.isArray(json.data) ? json.data : contas
    if (Array.isArray(json.data)) setContas(json.data)
    setSelectedIds(new Set())
    showToast(
      payload.baixaParcial
        ? 'Baixa parcial registrada e saldo remanescente gerado automaticamente!'
        : 'Pagamento liquidado com sucesso!',
      'success'
    )
    if (payload.emitirRecibo !== false) {
      const updated =
        nextList.find((c) => c.id === payload.id) ||
        (baixaTargets[0]
          ? {
              ...baixaTargets[0],
              status: 'pago' as const,
              dataPagamento: payload.dataPagamento,
              valorPago: payload.valorPago,
              formaPagamento: payload.formaPagamento,
              caixaOrigem: payload.caixaOrigem,
              juros: payload.juros,
              multa: payload.multa,
              desconto: payload.desconto,
              observacao: payload.observacao,
            }
          : null)
      if (updated) {
        setReceiptContas([updated])
      }
    }
  }

  const handleConfirmBaixaLote = async (payload: {
    ids: string[]
    dataPagamento: string
    formaPagamento: string
    caixaOrigem: string
    observacao: string
    emitirRecibo?: boolean
  }) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'baixa_lote', ...payload }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json?.error || 'Erro na baixa em lote', 'error')
      return
    }
    const nextList: ContaPagarRecord[] = Array.isArray(json.data) ? json.data : contas
    if (Array.isArray(json.data)) setContas(json.data)
    setSelectedIds(new Set())
    showToast(`${payload.ids.length} títulos liquidados em lote com sucesso!`, 'success')
    if (payload.emitirRecibo !== false) {
      const idSet = new Set(payload.ids)
      const updatedBatch = nextList.filter((c) => idSet.has(c.id))
      if (updatedBatch.length > 0) {
        setReceiptContas(updatedBatch)
      }
    }
  }

  const handleAprovarLote = async (ids: string[]) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aprovar_lote', ids }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(json.data)) {
      setContas(json.data)
      setSelectedIds(new Set())
      showToast(`${ids.length} título(s) aprovados pela controladoria!`, 'success')
    } else {
      showToast(json?.error || 'Erro ao aprovar títulos', 'error')
    }
  }

  const handleReverterBaixa = async (conta: ContaPagarRecord) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reverter_baixa', id: conta.id }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(json.data)) {
      setContas(json.data)
      showToast('Baixa estornada. O título voltou para aberto.', 'success')
    } else {
      showToast(json?.error || 'Erro ao estornar baixa', 'error')
    }
  }

  const handleUpdateAnexos = async (
    contaId: string,
    novosAnexos: AnexoContaPagarItem[],
    acaoHistorico?: string,
    detalhesHistorico?: string
  ) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_anexos',
        id: contaId,
        anexos: novosAnexos,
        acaoHistorico,
        detalhesHistorico,
      }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json?.error || 'Erro ao atualizar anexos do lançamento', 'error')
      return
    }
    if (Array.isArray(json.data)) {
      setContas(json.data)
      const updatedRecord = json.data.find((c: ContaPagarRecord) => c.id === contaId)
      if (updatedRecord) {
        setFichaConta((prev) => (prev && prev.id === contaId ? updatedRecord : prev))
        setAnexosModalTarget((prev) => (prev && prev.conta.id === contaId ? { ...prev, conta: updatedRecord } : prev))
      }
    }
    showToast(acaoHistorico || 'Anexos do lançamento atualizados!', 'success')
  }

  const handleDeleteIds = async (ids: string[]) => {
    if (ids.length === 0) return
    const prevContas = contas
    const idSet = new Set(ids)
    setContas((prev) => prev.filter((c) => !idSet.has(c.id)))
    try {
      const res = await apiFetch(`/api/contas-pagar?ids=${encodeURIComponent(ids.join(','))}`, {
        method: 'DELETE',
        skipRetry: true,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(json.data)) {
        setContas(json.data)
        setSelectedIds(new Set())
        showToast(`${ids.length} registro(s) excluído(s).`, 'success')
      } else {
        setContas(prevContas)
        showToast(json?.error || 'Erro ao excluir lançamento(s)', 'error')
      }
    } catch (err: any) {
      setContas(prevContas)
      showToast(err?.message || 'Erro ao excluir lançamento(s)', 'error')
    }
  }

  const handleSaveFornecedor = async (f: Partial<FornecedorEscolar>): Promise<FornecedorEscolar | null> => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_fornecedor', fornecedor: f }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      if (Array.isArray(json.fornecedores)) setFornecedores(json.fornecedores)
      showToast('Fornecedor salvo com sucesso!', 'success')
      return json.fornecedor || null
    }
    showToast(json?.error || 'Erro ao salvar fornecedor', 'error')
    return null
  }

  const handleDeleteFornecedor = async (id: string) => {
    const prevFornecedores = fornecedores
    const targetForn = fornecedores.find((f) => f.id === id)
    setFornecedores((prev) => prev.filter((f) => f.id !== id))
    try {
      const res = await apiFetch('/api/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_fornecedor', id, nome: targetForn?.nome }),
        skipRetry: true,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(json.fornecedores)) {
        setFornecedores(json.fornecedores)
        showToast('Fornecedor removido.', 'success')
      } else {
        setFornecedores(prevFornecedores)
        showToast(json?.error || 'Erro ao excluir fornecedor', 'error')
      }
    } catch (err: any) {
      setFornecedores(prevFornecedores)
      showToast(err?.message || 'Erro ao excluir fornecedor', 'error')
    }
  }

  const handleSaveOrcamentos = async (novos: OrcamentoCategoriaItem[]) => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_orcamentos', orcamentos: novos }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(json.orcamentos)) {
      setOrcamentos(json.orcamentos)
      showToast('Metas orçamentárias atualizadas!', 'success')
    } else {
      showToast(json?.error || 'Erro ao atualizar metas orçamentárias', 'error')
    }
  }

  const handleSaveRecorrencia = async (rec: Partial<RecorrenciaFixaEscolar>): Promise<RecorrenciaFixaEscolar | null> => {
    const res = await apiFetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_recorrencia', recorrencia: rec }),
      skipRetry: true,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      if (Array.isArray(json.recorrencias)) setRecorrencias(json.recorrencias)
      showToast('Recorrência fixa salva com sucesso!', 'success')
      return json.recorrencia || null
    }
    showToast(json?.error || 'Erro ao salvar recorrência fixa', 'error')
    return null
  }

  const handleDeleteRecorrencia = async (id: string) => {
    const prevRecs = recorrencias
    setRecorrencias((prev) => prev.filter((r) => r.id !== id))
    try {
      const res = await apiFetch('/api/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_recorrencia', id }),
        skipRetry: true,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(json.recorrencias)) {
        setRecorrencias(json.recorrencias)
        showToast('Recorrência fixa removida.', 'success')
      } else {
        setRecorrencias(prevRecs)
        showToast(json?.error || 'Erro ao excluir recorrência fixa', 'error')
      }
    } catch (err: any) {
      setRecorrencias(prevRecs)
      showToast(err?.message || 'Erro ao excluir recorrência fixa', 'error')
    }
  }

  // Gerar Despesa Recorrente a partir de Recorrência Fixa Cadastrada
  const handleGerarDespesaTemplate = async (
    tpl: RecorrenciaFixaEscolar,
    comp: string
  ) => {
    const [y, m] = comp.split('-').map(Number)
    const maxDay = new Date(y, m, 0).getDate()
    const safeDay = Math.min(tpl.diaVencimento, maxDay)
    const venc = `${comp}-${String(safeDay).padStart(2, '0')}`

    await handleSaveContas([
      {
        codigo: `REC-${comp.replace('-', '')}-${tpl.id.slice(-3).toUpperCase()}`,
        descricao: `${tpl.titulo} (${comp})`,
        fornecedorId: tpl.fornecedorId,
        fornecedorNome: tpl.fornecedorNome || tpl.titulo.split('—')[0].trim(),
        fornecedorDocumento: tpl.fornecedorDocumento,
        categoria: tpl.categoria,
        planoContasId: tpl.planoContasId,
        subcategoria: tpl.unidadePadrao,
        centroCusto: tpl.centroCusto,
        tipoCusto: tpl.tipoCusto,
        prioridade: tpl.prioridade,
        competencia: comp,
        vencimento: venc,
        valorBase: tpl.valorEstimado,
        valor: tpl.valorEstimado,
        formaPagamento: tpl.formaPagamento,
        chavePix: tpl.chavePix,
        recorrente: true,
        frequenciaRecorrencia: 'mensal',
        aprovacaoStatus: 'aprovado',
      },
    ])
    setActiveTab('lancamentos')
  }

  const handleGerarLoteMensalFixo = async (comp: string) => {
    if (recorrencias.length === 0) {
      showToast('Cadastre ao menos uma recorrência fixa para gerar em lote.', 'error')
      return
    }
    const [y, m] = comp.split('-').map(Number)
    const maxDay = new Date(y, m, 0).getDate()
    const novos: Partial<ContaPagarRecord>[] = recorrencias.map((tpl, i) => {
      const safeDay = Math.min(tpl.diaVencimento, maxDay)
      return {
        codigo: `FIX-${comp.replace('-', '')}-0${i + 1}`,
        descricao: `${tpl.titulo} (${comp})`,
        fornecedorId: tpl.fornecedorId,
        fornecedorNome: tpl.fornecedorNome || tpl.titulo.split('—')[0].trim(),
        fornecedorDocumento: tpl.fornecedorDocumento,
        categoria: tpl.categoria,
        planoContasId: tpl.planoContasId,
        subcategoria: tpl.unidadePadrao,
        centroCusto: tpl.centroCusto,
        tipoCusto: tpl.tipoCusto,
        prioridade: tpl.prioridade,
        competencia: comp,
        vencimento: `${comp}-${String(safeDay).padStart(2, '0')}`,
        valorBase: tpl.valorEstimado,
        valor: tpl.valorEstimado,
        formaPagamento: tpl.formaPagamento,
        chavePix: tpl.chavePix,
        recorrente: true,
        frequenciaRecorrencia: 'mensal',
        aprovacaoStatus: 'aprovado',
      }
    })
    await handleSaveContas(novos)
    setActiveTab('lancamentos')
  }

  // Exportar Lista Filtrada para Excel (.xlsx)
  const handleExportListExcel = () => {
    const rows = contasFiltradas.map((c) => ({
      Código: c.codigo || c.id,
      Fornecedor: c.fornecedorNome,
      'CNPJ / CPF': c.fornecedorDocumento || '',
      'Nº Documento / NF': c.numeroDocumento || '',
      'Tipo Documento': c.tipoDocumento || '',
      Categoria: c.categoria,
      'Segmento / Centro de Custo': c.centroCusto,
      'Natureza Custo': c.tipoCusto,
      Emissão: c.dataEmissao || '',
      Vencimento: c.vencimento,
      Status: STATUS_CONTA_PAGAR_CONFIG[c.status]?.label || c.status,
      'Valor Bruto (R$)': c.valorBase,
      'Desconto (R$)': c.desconto,
      'Juros (R$)': c.juros,
      'Multa (R$)': c.multa,
      'Retenções Fiscais (R$)': c.retencaoImpostos,
      'Valor Líquido (R$)': c.valor,
      'Data Pagamento': c.dataPagamento || '',
      'Forma Pagamento': c.formaPagamento,
      'Conta / Caixa': c.caixaOrigem || '',
      'Chave PIX': c.chavePix || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contas_a_Pagar')
    XLSX.writeFile(wb, `Contas_a_Pagar_Impacto_${hojeStr}.xlsx`)
  }

  // Importar Planilha Excel / CSV
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet)
      if (!rows.length) {
        showToast('A planilha selecionada está vazia.', 'error')
        return
      }
      const imported: Partial<ContaPagarRecord>[] = rows.map((r, i) => ({
        codigo: String(r['Código'] || r['codigo'] || `IMP-${i + 1}`),
        descricao: String(r['Descrição'] || r['descricao'] || r['Historico'] || 'Despesa Importada'),
        fornecedorNome: String(r['Fornecedor'] || r['fornecedor'] || r['Credor'] || 'Fornecedor Diverso'),
        fornecedorDocumento: String(r['CNPJ / CPF'] || r['cnpj'] || ''),
        categoria: String(r['Categoria'] || r['categoria'] || CATEGORIAS_ESCOLARES[0].id),
        centroCusto: String(r['Segmento / Centro de Custo'] || r['centroCusto'] || CENTROS_CUSTO_ESCOLARES[0].id),
        vencimento: String(r['Vencimento'] || r['vencimento'] || hojeStr).slice(0, 10),
        valorBase: Number(r['Valor Bruto (R$)'] || r['Valor Líquido (R$)'] || r['valor'] || 0),
        valor: Number(r['Valor Líquido (R$)'] || r['valor'] || 0),
        formaPagamento: String(r['Forma Pagamento'] || 'PIX'),
        numeroDocumento: String(r['Nº Documento / NF'] || ''),
      }))
      await handleSaveContas(imported)
    } catch {
      showToast('Falha ao importar planilha. Verifique as colunas.', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const contasSelecionadasObj = useMemo(
    () => contasFiltradas.filter((c) => selectedIds.has(c.id)),
    [contasFiltradas, selectedIds]
  )

  // Reset página ao alterar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter, categoriaFilter, centroCustoFilter, dataInicialFilter, dataFinalFilter, competenciaFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(contasFiltradas.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const contasPaginadas = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return contasFiltradas.slice(start, start + PAGE_SIZE)
  }, [contasFiltradas, safePage])

  const resumoFiltrado = useMemo(() => {
    let vencido = 0
    let pago = 0
    let aVencer = 0
    for (const c of contasFiltradas) {
      if (c.status === 'cancelado') continue
      const v = Number(c.valor || 0)
      if (c.status === 'pago') {
        pago += Number(c.valorPago || v)
      } else if (c.status === 'vencido' || (c.vencimento && c.vencimento < hojeStr)) {
        vencido += v
      } else {
        aVencer += v
      }
    }
    return {
      vencido,
      pago,
      aVencer,
      total: vencido + pago + aVencer,
    }
  }, [contasFiltradas, hojeStr])

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    statusFilter !== 'todos' ||
    categoriaFilter !== 'todas' ||
    centroCustoFilter !== 'todos' ||
    Boolean(dataInicialFilter) ||
    Boolean(dataFinalFilter) ||
    competenciaFilter !== 'todos'

  const clearAllFilters = useCallback(() => {
    setSearchInput('')
    setStatusFilter('todos')
    setCategoriaFilter('todas')
    setCentroCustoFilter('todos')
    setDataInicialFilter('')
    setDataFinalFilter('')
    setCompetenciaFilter('todos')
    setCurrentPage(1)
  }, [])

  // Duplicar título para o próximo mês
  const handleDuplicateNextMonth = async (c: ContaPagarRecord) => {
    const baseDate = new Date((c.vencimento || hojeStr) + 'T12:00:00')
    baseDate.setMonth(baseDate.getMonth() + 1)
    const nextVenc = baseDate.toISOString().slice(0, 10)
    const nextComp = nextVenc.slice(0, 7)

    await handleSaveContas([
      {
        codigo: `CP-${nextComp.replace('-', '')}-${String(Math.floor(100 + Math.random() * 899))}`,
        descricao: c.descricao,
        fornecedorId: c.fornecedorId,
        fornecedorNome: c.fornecedorNome,
        fornecedorDocumento: c.fornecedorDocumento,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        centroCusto: c.centroCusto,
        tipoCusto: c.tipoCusto,
        prioridade: c.prioridade,
        competencia: nextComp,
        vencimento: nextVenc,
        valorBase: c.valorBase,
        desconto: c.desconto,
        juros: 0,
        multa: 0,
        retencaoImpostos: c.retencaoImpostos,
        valor: c.valor,
        formaPagamento: c.formaPagamento,
        chavePix: c.chavePix,
        recorrente: c.recorrente,
        frequenciaRecorrencia: c.frequenciaRecorrencia,
        aprovacaoStatus: 'aprovado',
      },
    ])
  }

  return (
    <div style={{ padding: '18px 24px 56px', maxWidth: 1560, margin: '0 auto', color: '#0f172a' }}>
      {/* CSS de Tabela Responsiva Luxury Light Mode com cores de linha por status */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .table-wrapper.cp-table-region {
            width: 100%;
            max-inline-size: 100%;
            container-type: inline-size;
            overflow: visible !important;
            border-radius: 14px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.06);
          }
          .cp-data-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 12.5px;
            color: #0f172a;
          }
          .cp-data-table thead {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
          }
          .cp-data-table thead th {
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
          .cp-data-table thead th:last-child {
            border-inline-end: none;
          }
          .cp-data-table tbody th {
            position: sticky;
            inset-inline-start: 0;
            background: inherit;
            text-align: left;
            padding: 9px 10px;
            font-weight: 700;
            color: #0f172a !important;
            border-top: 1px solid rgba(203, 213, 225, 0.55);
            border-inline-end: 1px solid rgba(203, 213, 225, 0.5);
            vertical-align: middle;
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .cp-data-table tbody td {
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
          .cp-data-table tbody td:last-child {
            border-inline-end: none;
          }
          .cp-data-table tbody td.cp-actions-cell {
            overflow: visible !important;
            padding: 7px 8px;
          }
          /* Cores das linhas de acordo com o status do pagamento */
          .cp-data-table tbody tr.cp-row-pago {
            background-color: #ecfdf5;
          }
          .cp-data-table tbody tr.cp-row-pago:hover {
            background-color: #d1fae5;
          }
          .cp-data-table tbody tr.cp-row-vencido {
            background-color: #fff1f2;
          }
          .cp-data-table tbody tr.cp-row-vencido:hover {
            background-color: #ffe4e6;
          }
          .cp-data-table tbody tr.cp-row-hoje {
            background-color: #fffbeb;
          }
          .cp-data-table tbody tr.cp-row-hoje:hover {
            background-color: #fef3c7;
          }
          .cp-data-table tbody tr.cp-row-aberto {
            background-color: #ffffff;
          }
          .cp-data-table tbody tr.cp-row-aberto:hover {
            background-color: #f0f9ff;
          }
          .cp-data-table tbody tr.cp-row-cancelado {
            background-color: #f1f5f9;
            opacity: 0.75;
          }
          @container (width < 760px) {
            .cp-data-table,
            .cp-data-table thead,
            .cp-data-table tbody,
            .cp-data-table tr,
            .cp-data-table th,
            .cp-data-table td {
              display: block;
            }
            .cp-data-table thead {
              display: none;
            }
            .cp-data-table tbody tr {
              margin-block-end: 0.75rem;
              padding: 0.85rem;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
            }
            .cp-data-table tbody th {
              position: sticky;
              inset-block-start: 0;
              z-index: 2;
              padding: 4px 0 8px;
              border: none;
            }
            .cp-data-table tbody td {
              display: grid;
              grid-template-columns: 7.5rem 1fr;
              padding: 4px 0;
              border: none;
              position: static;
            }
            .cp-data-table tbody td::before {
              content: var(--label) ": ";
              font-weight: 700;
              color: #64748b;
            }
          }
        `,
        }}
      />

      {/* ── HEADER EXECUTIVO LUXURY & MINIMALISTA ────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 18px -6px rgba(15, 23, 42, 0.05)',
          padding: '14px 20px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.14)',
            }}
          >
            <TrendingDown size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#475569',
                }}
              >
                Tesouraria & Controladoria Escolar
              </span>
            </div>
            <h1 style={{ margin: '1px 0 0', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
              Contas a Pagar
            </h1>
          </div>
        </div>

        {/* Botões de Ação Primária */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 9,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Upload size={14} color="#475569" />
            Importar
          </button>

          <button
            type="button"
            onClick={handleExportListExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 9,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#047857',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={14} />
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={() =>
              openPrintBorderoPagamentos(
                contasFiltradas.filter((c) => c.status !== 'pago' && c.status !== 'cancelado'),
                dataInicialFilter || dataFinalFilter
                  ? `Período ${dataInicialFilter || 'Início'} a ${dataFinalFilter || 'Fim'}`
                  : 'Programação Geral de Pagamentos'
              )
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 9,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0369a1',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} />
            Borderô
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingRecord(null)
              setIsFormOpen(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              borderRadius: 9,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
            }}
          >
            <Plus size={15} />
            Inserir Parcelas / Nova Conta
          </button>
        </div>
      </div>

      {/* ── NAVEGAÇÃO PRINCIPAL EM ABAS ENXUTAS ──────────────────────────────── */}
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
            { id: 'lancamentos', label: `Lançamentos (${contasFiltradas.length})`, icon: <LayoutList size={14} /> },
            { id: 'relatorios', label: 'Relatórios & BI', icon: <BarChart3 size={14} /> },
            { id: 'calendario', label: 'Calendário', icon: <Calendar size={14} /> },
            { id: 'orcamento', label: 'Orçamento', icon: <Target size={14} /> },
            { id: 'fornecedores', label: `Fornecedores (${fornecedores.length})`, icon: <Building2 size={14} /> },
            { id: 'recorrentes', label: `Recorrências Fixas (${recorrencias.length})`, icon: <Repeat size={14} /> },
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

        {/* Resumo Executivo Compacto no Topo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, paddingRight: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#be123c', fontWeight: 700 }}>
            Vencido: <strong>{formatCurrency(resumoFiltrado.vencido)}</strong>
          </span>
          <span style={{ color: '#047857', fontWeight: 700 }}>
            Pago: <strong>{formatCurrency(resumoFiltrado.pago)}</strong>
          </span>
          <span style={{ color: '#334155', fontWeight: 700 }}>
            A Vencer: <strong>{formatCurrency(resumoFiltrado.aVencer)}</strong>
          </span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 1: LANÇAMENTOS & OPERAÇÃO DE TESOURARIA
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lancamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Barra de Filtros Organizada (Com Vencimento Inicial e Vencimento Final) */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
              display: 'grid',
              gridTemplateColumns: '1.45fr 1.15fr 1.1fr 0.9fr 0.9fr 0.95fr',
              gap: 10,
              alignItems: 'end',
            }}
          >
            <div>
              <label
                htmlFor="cp-search-input"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}
              >
                Fornecedor, Nº Doc ou Lcto.
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                />
                <input
                  id="cp-search-input"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Pesquisar fornecedor, Nº documento ou código..."
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  htmlFor="cp-filter-cat"
                  style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}
                >
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
                id="cp-filter-cat"
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
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
                {todosPlanosContas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  htmlFor="cp-filter-cc"
                  style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}
                >
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
                id="cp-filter-cc"
                value={centroCustoFilter}
                onChange={(e) => setCentroCustoFilter(e.target.value)}
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
                {todosCentrosCusto.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cp-filter-data-ini"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}
              >
                Data Inicial
              </label>
              <input
                id="cp-filter-data-ini"
                type="date"
                value={dataInicialFilter}
                onChange={(e) => setDataInicialFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="cp-filter-data-fim"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}
              >
                Data Final
              </label>
              <input
                id="cp-filter-data-fim"
                type="date"
                value={dataFinalFilter}
                onChange={(e) => setDataFinalFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="cp-filter-sort"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}
              >
                Ordenação
              </label>
              <select
                id="cp-filter-sort"
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
                <option value="vencimento_asc">Vencimento (Próximos)</option>
                <option value="vencimento_desc">Vencimento (Recentes)</option>
                <option value="valor_desc">Maior Valor</option>
                <option value="valor_asc">Menor Valor</option>
              </select>
            </div>
          </div>

          {/* Barra de Ações em Lote quando há itens selecionados */}
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
                {selectedIds.size} título(s) selecionado(s) • Total:{' '}
                <strong style={{ color: '#047857', fontSize: 14 }}>
                  {formatCurrency(contasSelecionadasObj.reduce((a, b) => a + (Number(b.valor) || 0), 0))}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setBaixaTargets(contasSelecionadasObj.filter((c) => c.status !== 'pago'))}
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
                  Baixar Selecionados
                </button>
                <button
                  type="button"
                  onClick={() => handleAprovarLote(Array.from(selectedIds))}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #38bdf8',
                    color: '#0369a1',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Aprovar em Lote
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptContas(contasSelecionadasObj)}
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
                  onClick={() => openPrintBorderoPagamentos(contasSelecionadasObj, 'Seleção Personalizada')}
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
                  Imprimir Borderô
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
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
                  Excluir ({selectedIds.size})
                </button>
              </div>
            </div>
          )}

          {/* TABELA PRINCIPAL ORGANIZADA COM CORES POR STATUS (Sem coluna de descrição, com Nº Doc e Emissão) */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="contas-pagar-table-caption"
            className="table-wrapper cp-table-region"
          >
            {/* Cabeçalho Integrado da Tabela: Resumo à esquerda + Segmented Control de Status à direita */}
            <div
              style={{
                padding: '8px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div
                id="contas-pagar-table-caption"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#475569',
                }}
              >
                Relação de Contas a Pagar ({contasFiltradas.length} registros • Soma Filtrada:{' '}
                <strong style={{ color: '#0f172a' }}>{formatCurrency(resumoFiltrado.total)}</strong>)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div
                  role="tablist"
                  aria-label="Filtrar contas por situação"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: 3,
                    borderRadius: 9,
                    background: '#eef2f6',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                  }}
                >
                  {[
                    { id: 'todos', label: 'Todos', count: contas.length, dot: '#475569' },
                    {
                      id: 'pendente',
                      label: 'Em Aberto',
                      count: contas.filter((c) => c.status === 'pendente' || c.status === 'agendado').length,
                      dot: '#0284c7',
                    },
                    { id: 'vencido', label: 'Vencidos', count: kpis.qtdVencido, dot: '#e11d48' },
                    { id: 'hoje', label: 'Hoje', count: kpis.venceHojeQtd, dot: '#d97706' },
                    { id: '7dias', label: 'Próx. 7d', count: kpis.vence7DiasQtd, dot: '#7c3aed' },
                    { id: 'pago', label: 'Pagos', count: contas.filter((c) => c.status === 'pago').length, dot: '#10b981' },
                  ].map((pill) => {
                    const active = statusFilter === pill.id
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setStatusFilter(pill.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: active ? '#ffffff' : 'transparent',
                          border: 'none',
                          boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                          color: active ? '#0f172a' : pill.count > 0 ? '#475569' : '#94a3b8',
                          fontSize: 11,
                          fontWeight: active ? 700 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              background: pill.dot,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span>{pill.label}</span>
                        {pill.count > 0 && (
                          <span
                            style={{
                              padding: '0px 5px',
                              borderRadius: 99,
                              background: active ? '#f1f5f9' : 'rgba(148, 163, 184, 0.16)',
                              color: active ? '#0f172a' : '#475569',
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {pill.count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 9px',
                      borderRadius: 7,
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#be123c',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <X size={12} /> Limpar
                  </button>
                )}
              </div>
            </div>

            <table className="cp-data-table">
              <thead>
                <tr>
                  <th style={{ width: '2.8%', textAlign: 'center', padding: '10px 4px' }}>
                    <input
                      aria-label="Selecionar todas as contas visíveis"
                      type="checkbox"
                      checked={
                        contasPaginadas.length > 0 &&
                        contasPaginadas.every((c) => selectedIds.has(c.id))
                      }
                      onChange={(e) => {
                        const next = new Set(selectedIds)
                        if (e.target.checked) {
                          contasPaginadas.forEach((c) => next.add(c.id))
                        } else {
                          contasPaginadas.forEach((c) => next.delete(c.id))
                        }
                        setSelectedIds(next)
                      }}
                    />
                  </th>
                  <th style={{ width: '6.7%', textAlign: 'center' }}>ID</th>
                  <th style={{ width: '16%' }}>Fornecedor / Credor</th>
                  <th style={{ width: '10.5%' }}>Nº do Doc</th>
                  <th style={{ width: '17.5%' }}>Plano de Contas & Centro de Custo</th>
                  <th style={{ width: '7.2%', textAlign: 'center' }}>Emissão</th>
                  <th style={{ width: '7.2%', textAlign: 'center' }}>Vencimento</th>
                  <th style={{ width: '9.6%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '8.5%', textAlign: 'right' }}>Valor Líquido</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      Carregando lançamentos financeiros...
                    </td>
                  </tr>
                ) : contasPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      Nenhuma conta a pagar encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  contasPaginadas.map((c) => {
                    const stCfg = STATUS_CONTA_PAGAR_CONFIG[c.status] || STATUS_CONTA_PAGAR_CONFIG.pendente
                    const isVenceHoje = c.status !== 'pago' && c.vencimento === hojeStr
                    const isMenuOpen = openMenuId === c.id

                    const rowClass =
                      c.status === 'pago'
                        ? 'cp-row-pago'
                        : c.status === 'vencido'
                          ? 'cp-row-vencido'
                          : isVenceHoje
                            ? 'cp-row-hoje'
                            : c.status === 'cancelado'
                              ? 'cp-row-cancelado'
                              : 'cp-row-aberto'

                    const leftStripeColor =
                      c.status === 'pago'
                        ? '#10b981'
                        : c.status === 'vencido'
                          ? '#f43f5e'
                          : isVenceHoje
                            ? '#f59e0b'
                            : c.status === 'cancelado'
                              ? '#94a3b8'
                              : '#0284c7'

                    return (
                      <tr key={c.id} className={rowClass}>
                        <td
                          style={
                            {
                              '--label': 'Selecionar',
                              textAlign: 'center',
                              borderLeft: `4px solid ${leftStripeColor}`,
                            } as React.CSSProperties
                          }
                        >
                          <input
                            aria-label={`Selecionar ${c.fornecedorNome}`}
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds)
                              if (e.target.checked) next.add(c.id)
                              else next.delete(c.id)
                              setSelectedIds(next)
                            }}
                          />
                        </td>

                        {/* ID / CÓDIGO DO LANÇAMENTO */}
                        <td
                          onClick={() => setFichaConta(c)}
                          title={`Código do lançamento: ${c.codigo || c.id}`}
                          style={
                            {
                              '--label': 'ID',
                              textAlign: 'center',
                              padding: '9px 6px',
                              cursor: 'pointer',
                            } as React.CSSProperties
                          }
                        >
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              letterSpacing: '-0.02em',
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.codigo || c.id}
                          </span>
                        </td>

                        {/* FORNECEDOR / CREDOR */}
                        <th scope="row">
                          <div
                            onClick={() => setFichaConta(c)}
                            title={`${c.fornecedorNome}${c.fornecedorDocumento ? ` (${c.fornecedorDocumento})` : ''}${c.formaPagamento ? ` • ${c.formaPagamento}` : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 800,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                              }}
                            >
                              {c.fornecedorNome}
                            </span>
                            {c.formaPagamento && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: '#64748b',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                • {c.formaPagamento}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* Nº DO DOC */}
                        <td style={{ '--label': 'Nº do Doc' } as React.CSSProperties}>
                          <div
                            title={`${c.numeroDocumento || 'S/N'} (${c.tipoDocumento || 'Doc'})${c.parcelaAtual && c.totalParcelas ? ` • ${String(c.parcelaAtual).padStart(2, '0')}/${String(c.totalParcelas).padStart(2, '0')}` : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                color: '#0f172a',
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                              }}
                            >
                              {c.numeroDocumento || 'S/N'}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                              {c.tipoDocumento || 'Doc'}
                            </span>
                            {c.parcelaAtual && c.totalParcelas && (
                              <span
                                style={{
                                  padding: '0px 5px',
                                  borderRadius: 4,
                                  background: '#ede9fe',
                                  color: '#6d28d9',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {String(c.parcelaAtual).padStart(2, '0')}/{String(c.totalParcelas).padStart(2, '0')}
                              </span>
                            )}
                            {c.anexos && c.anexos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setAnexosModalTarget({ conta: c, mode: 'arquivos' })}
                                title="Ver anexos e fotos deste lançamento"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '1px 5px',
                                  borderRadius: 99,
                                  background: '#eff6ff',
                                  border: '1px solid #93c5fd',
                                  color: '#1d4ed8',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                <Paperclip size={10} />
                                {c.anexos.length}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* PLANO DE CONTAS & CENTRO DE CUSTO */}
                        <td style={{ '--label': 'Plano de Contas' } as React.CSSProperties}>
                          <div
                            title={`${c.categoria}${c.centroCusto ? ` • ${c.centroCusto}` : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                color: '#1e293b',
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                              }}
                            >
                              {c.categoria}
                            </span>
                            {c.centroCusto && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#475569',
                                  background: 'rgba(255,255,255,0.75)',
                                  border: '1px solid #cbd5e1',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  flexShrink: 0,
                                }}
                              >
                                {c.centroCusto}
                              </span>
                            )}
                            {c.rateio && c.rateio.length > 0 && (
                              <span
                                style={{
                                  padding: '0px 5px',
                                  borderRadius: 4,
                                  background: '#ecfeff',
                                  border: '1px solid #a5f3fc',
                                  color: '#0e7490',
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                Rateio ({c.rateio.length})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* EMISSÃO */}
                        <td style={{ '--label': 'Emissão', textAlign: 'center' } as React.CSSProperties}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>
                            {(c.dataEmissao || c.vencimento)?.split('-').reverse().join('/') || '—'}
                          </div>
                        </td>

                        {/* VENCIMENTO */}
                        <td style={{ '--label': 'Vencimento', textAlign: 'center' } as React.CSSProperties}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 12,
                              whiteSpace: 'nowrap',
                              color:
                                c.status === 'vencido'
                                  ? '#be123c'
                                  : isVenceHoje
                                    ? '#b45309'
                                    : c.status === 'pago'
                                      ? '#047857'
                                      : '#0f172a',
                            }}
                          >
                            {c.vencimento?.split('-').reverse().join('/')}
                          </div>
                        </td>

                        {/* STATUS */}
                        <td style={{ '--label': 'Status', textAlign: 'center' } as React.CSSProperties}>
                          <div
                            title={
                              c.status === 'pago' && c.dataPagamento
                                ? `${stCfg.label} em ${c.dataPagamento.split('-').reverse().join('/')}`
                                : stCfg.label
                            }
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                          >
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 99,
                                fontSize: 10.5,
                                fontWeight: 800,
                                color: stCfg.color,
                                background: '#ffffff',
                                border: `1px solid ${stCfg.border}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isVenceHoje
                                ? 'Vence Hoje'
                                : c.status === 'pago' && c.dataPagamento
                                  ? `Pago ${c.dataPagamento.split('-').reverse().join('/')}`
                                  : stCfg.label}
                            </span>
                          </div>
                        </td>

                        {/* VALOR LÍQUIDO */}
                        <td style={{ '--label': 'Valor Líquido', textAlign: 'right' } as React.CSSProperties}>
                          <div
                            title={
                              c.retencaoImpostos > 0 || c.desconto > 0 || c.juros > 0 || c.multa > 0
                                ? `Valor Bruto: ${formatCurrency(c.valorBase)}`
                                : undefined
                            }
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color:
                                c.status === 'pago'
                                  ? '#065f46'
                                  : c.status === 'vencido'
                                    ? '#9f1239'
                                    : '#0f172a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCurrency(c.valor)}
                          </div>
                        </td>

                        {/* AÇÕES */}
                        <td
                          className="cp-actions-cell"
                          style={{ '--label': 'Ações', textAlign: 'right', position: 'relative' } as React.CSSProperties}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Botão Rápido: Anexar Arquivo */}
                            <button
                              type="button"
                              onClick={() => setAnexosModalTarget({ conta: c, mode: 'arquivos' })}
                              title="Anexar arquivo ou comprovante neste lançamento"
                              aria-label={`Anexar arquivo em ${c.fornecedorNome}`}
                              style={{
                                position: 'relative',
                                width: 27,
                                height: 27,
                                borderRadius: 7,
                                background: c.anexos && c.anexos.length > 0 ? '#eff6ff' : '#ffffff',
                                border:
                                  c.anexos && c.anexos.length > 0
                                    ? '1px solid #60a5fa'
                                    : '1px solid #cbd5e1',
                                color: c.anexos && c.anexos.length > 0 ? '#1d4ed8' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              <Paperclip size={13} />
                              {c.anexos && c.anexos.length > 0 && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: -5,
                                    right: -5,
                                    minWidth: 15,
                                    height: 15,
                                    padding: '0 3px',
                                    borderRadius: 99,
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    fontSize: 9,
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1.5px solid #ffffff',
                                  }}
                                >
                                  {c.anexos.length}
                                </span>
                              )}
                            </button>

                            {c.status !== 'pago' && c.status !== 'cancelado' ? (
                              <button
                                type="button"
                                onClick={() => setBaixaTargets([c])}
                                title="Dar Baixa / Liquidar Título"
                                style={{
                                  padding: '5px 9px',
                                  borderRadius: 7,
                                  background: '#059669',
                                  border: 'none',
                                  color: '#ffffff',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                Baixar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setReceiptContas([c])}
                                  title="Emitir Recibo de Pagamento & Quitação com QR Code"
                                  style={{
                                    padding: '5px 7px',
                                    borderRadius: 7,
                                    background: '#eff6ff',
                                    border: '1px solid #93c5fd',
                                    color: '#1d4ed8',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
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
                                  onClick={() => setFichaConta(c)}
                                  title="Ver Dossiê Completo"
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: 7,
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Ficha
                                </button>
                              </>
                            )}

                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <button
                                type="button"
                                aria-label={`Mais ações para ${c.fornecedorNome}`}
                                aria-expanded={isMenuOpen}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isMenuOpen) {
                                    setOpenMenuId(null)
                                    setOpenMenuPos(null)
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const estimatedMenuHeight = 310
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    const openUp = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow
                                    setOpenMenuPos({
                                      top: openUp ? undefined : rect.bottom + 6,
                                      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                                      right: Math.max(12, window.innerWidth - rect.right),
                                    })
                                    setOpenMenuId(c.id)
                                  }
                                }}
                                style={{
                                  width: 27,
                                  height: 27,
                                  borderRadius: 7,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <MoreVertical size={13.5} />
                              </button>

                              {isMenuOpen && (
                                <div
                                  role="menu"
                                  style={{
                                    position: openMenuPos ? 'fixed' : 'absolute',
                                    top: openMenuPos ? openMenuPos.top : 33,
                                    bottom: openMenuPos ? openMenuPos.bottom : undefined,
                                    right: openMenuPos ? openMenuPos.right : 0,
                                    zIndex: 9999,
                                    width: 235,
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 11,
                                    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.22)',
                                    padding: 5,
                                    textAlign: 'left',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                  }}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setAnexosModalTarget({ conta: c, mode: 'arquivos' })
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#1d4ed8',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Paperclip size={14} color="#2563eb" />
                                    Anexar Arquivo ({c.anexos?.length || 0})
                                  </button>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setAnexosModalTarget({ conta: c, mode: 'camera' })
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#6d28d9',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Camera size={14} color="#7c3aed" />
                                    Tirar Foto (Câmera)
                                  </button>

                                  <div style={{ height: 1, background: '#e2e8f0', margin: '3px 0' }} />

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setFichaConta(c)
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#1e293b',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Eye size={14} color="#0284c7" />
                                    Ver Ficha & Histórico
                                  </button>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setEditingRecord(c)
                                      setIsFormOpen(true)
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#1e293b',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Edit3 size={14} color="#475569" />
                                    Editar Lançamento
                                  </button>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      handleDuplicateNextMonth(c)
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#047857',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Copy size={14} color="#059669" />
                                    Duplicar para Próximo Mês
                                  </button>

                                  {c.chavePix && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(c.chavePix!)
                                        setCopiedPixId(c.id)
                                        showToast(`Chave PIX copiada: ${c.chavePix}`, 'success')
                                        setTimeout(() => setCopiedPixId(null), 1800)
                                        setOpenMenuId(null)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 7,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#0369a1',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      {copiedPixId === c.id ? <Check size={14} /> : <QrCode size={14} />}
                                      Copiar Chave PIX
                                    </button>
                                  )}

                                  {c.linhaDigitavel && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(c.linhaDigitavel!)
                                        showToast('Linha digitável copiada!', 'success')
                                        setOpenMenuId(null)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 7,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#6d28d9',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <Barcode size={14} />
                                      Copiar Linha Digitável
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setReceiptContas([c])
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#0369a1',
                                      fontSize: 12,
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <FileText size={14} color="#0284c7" />
                                    Emitir Recibo Oficial
                                  </button>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      openPrintOrdemPagamento(c)
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#1e293b',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Printer size={14} color="#475569" />
                                    Imprimir Ordem (OP)
                                  </button>

                                  {c.status === 'pago' && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleReverterBaixa(c)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 7,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#b45309',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <RotateCcw size={14} />
                                      Estornar Baixa
                                    </button>
                                  )}

                                  <div style={{ height: 1, background: '#e2e8f0', margin: '3px 0' }} />

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setConfirmDeleteIds([c.id])
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#be123c',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    Excluir Título
                                  </button>
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
          </div>

          {/* RODAPÉ EXECUTIVO COM TOTAIS POR STATUS, LEGENDA DE CORES E PAGINAÇÃO */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#475569',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Resumo Financeiro por Status (Estilo Mhund + Luxury) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: '#be123c', fontWeight: 800 }}>
                Vencido: {formatCurrency(resumoFiltrado.vencido)}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#047857', fontWeight: 800 }}>
                Pago: {formatCurrency(resumoFiltrado.pago)}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#0f172a', fontWeight: 800 }}>
                A Vencer: {formatCurrency(resumoFiltrado.aVencer)}
              </span>
              <span style={{ color: '#64748b', fontSize: 11.5 }}>
                (Mostrando {contasFiltradas.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0} até{' '}
                {Math.min(safePage * PAGE_SIZE, contasFiltradas.length)} de {contasFiltradas.length} registros)
              </span>
            </div>

            {/* Legenda Discreta de Cores das Linhas + Paginação */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {[
                  { id: 'pago', label: 'Pago', color: '#10b981' },
                  { id: 'vencido', label: 'Vencido', color: '#f43f5e' },
                  { id: 'hoje', label: 'Vence Hoje', color: '#f59e0b' },
                  { id: 'pendente', label: 'A Vencer', color: '#0284c7' },
                ].map((leg) => (
                  <span
                    key={leg.id}
                    onClick={() => setStatusFilter((prev) => (prev === leg.id ? 'todos' : leg.id))}
                    title={`Filtrar por ${leg.label}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      color: statusFilter === leg.id ? '#0f172a' : '#64748b',
                      fontWeight: statusFilter === leg.id ? 800 : 600,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        background: leg.color,
                        display: 'inline-block',
                      }}
                    />
                    {leg.label}
                  </span>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      background: safePage <= 1 ? '#f8fafc' : '#ffffff',
                      color: safePage <= 1 ? '#94a3b8' : '#334155',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span style={{ fontWeight: 700, padding: '0 6px' }}>
                    {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      background: safePage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: safePage >= totalPages ? '#94a3b8' : '#334155',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 2: CENTRAL DE RELATÓRIOS & BI ESCOLAR (7 RELATÓRIOS)
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'relatorios' && (
        <RelatoriosContasPagarTab
          contas={contas}
          totalAlunosAtivos={totalAlunosAtivos}
          centrosCusto={todosCentrosCusto}
          planoContas={todosPlanosContas}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 3: CALENDÁRIO INTERATIVO DE DESEMBOLSO DIÁRIO
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calendario' && (
        <CalendarioDesembolsoTab
          contas={contas}
          onInspect={(c) => setFichaConta(c)}
          onBaixar={(c) => setBaixaTargets([c])}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 4: ORÇAMENTO ESCOLAR (BUDGET VS. REALIZADO)
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orcamento' && (
        <OrcamentoEscolarTab
          contas={contas}
          orcamentos={orcamentos}
          competenciaFiltro={competenciaFilter}
          planoContas={planosContasAtivos}
          onSaveOrcamentos={handleSaveOrcamentos}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 5: DIRETÓRIO DE FORNECEDORES & CREDORES ESCOLARES
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fornecedores' && (
        <FornecedoresEscolaresTab
          fornecedores={fornecedores}
          contas={contas}
          centrosCusto={centrosCustoAtivos}
          planoContas={planosContasAtivos}
          unidades={unidadesEscolares}
          onSaveFornecedor={handleSaveFornecedor}
          onDeleteFornecedor={handleDeleteFornecedor}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 6: MATRIZ DE CONTRATOS & DESPESAS RECORRENTES ESCOLARES
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'recorrentes' && (
        <RecorrentesTemplatesTab
          recorrencias={recorrencias}
          contas={contas}
          fornecedores={fornecedores}
          centrosCusto={centrosCustoAtivos}
          planoContas={planosContasAtivos}
          unidades={unidadesEscolares}
          metodosPagamento={metodosPagamentoAtivos}
          onSaveRecorrencia={handleSaveRecorrencia}
          onDeleteRecorrencia={handleDeleteRecorrencia}
          onGerarDespesaTemplate={handleGerarDespesaTemplate}
          onGerarLoteMensalFixo={handleGerarLoteMensalFixo}
        />
      )}

      {/* ── MODAIS OPERACIONAIS ──────────────────────────────────────────────── */}
      <ContaPagarFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingRecord(null)
        }}
        editingRecord={editingRecord}
        fornecedores={fornecedores}
        planoContas={rawPlanoContas}
        eventosFinanceiros={cfgEventos || []}
        centrosCusto={centrosCustoAtivos}
        unidades={unidadesEscolares}
        onSave={handleSaveContas}
        onQuickCreateFornecedor={handleSaveFornecedor}
      />

      <BaixaContaModal
        isOpen={baixaTargets.length > 0}
        onClose={() => setBaixaTargets([])}
        targetContas={baixaTargets}
        metodosPagamento={metodosPagamentoAtivos}
        caixasEscolares={caixasEscolaresAtivos}
        onConfirmBaixaIndividual={handleConfirmBaixaIndividual}
        onConfirmBaixaLote={handleConfirmBaixaLote}
      />

      <ContaFichaModal
        conta={fichaConta}
        onClose={() => setFichaConta(null)}
        onEdit={(c) => {
          setEditingRecord(c)
          setIsFormOpen(true)
        }}
        onBaixar={(c) => setBaixaTargets([c])}
        onReverterBaixa={handleReverterBaixa}
        onUpdateAnexos={handleUpdateAnexos}
        onEmitirRecibo={(c) => {
          setFichaConta(null)
          setReceiptContas([c])
        }}
      />

      {receiptContas && receiptContas.length > 0 && (() => {
        const rData = buildContaPagarReceiptData(receiptContas)
        return (
          <ReceiptModal
            aluno={rData.aluno}
            parcelas={rData.parcelas}
            natureza={rData.natureza}
            turmaUnidade={rData.turmaUnidade}
            onClose={() => setReceiptContas(null)}
          />
        )
      })()}

      <AnexosLancamentoModal
        conta={anexosModalTarget?.conta || null}
        initialMode={anexosModalTarget?.mode || 'arquivos'}
        onClose={() => setAnexosModalTarget(null)}
        onUpdateAnexos={handleUpdateAnexos}
      />

      {/* Modal de Confirmação de Exclusão */}
      {confirmDeleteIds && confirmDeleteIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
          onClick={() => setConfirmDeleteIds(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #fecdd3',
              padding: 24,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: '#fff1f2',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Confirmar Exclusão</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Deseja realmente excluir {confirmDeleteIds.length} lançamento(s) selecionado(s)?
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ids = confirmDeleteIds
                  setConfirmDeleteIds(null)
                  await handleDeleteIds(ids)
                }}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: '#e11d48',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
