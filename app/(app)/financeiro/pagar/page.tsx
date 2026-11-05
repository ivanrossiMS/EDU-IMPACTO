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
  QrCode, MoreVertical, Barcode, Copy, X, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type OrcamentoCategoriaItem,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  resolveCentrosCustoEscolares,
  STATUS_CONTA_PAGAR_CONFIG,
  PRIORIDADE_CONTA_PAGAR_CONFIG,
  TEMPLATES_DESPESAS_ESCOLARES,
  normalizarContaPagar,
  openPrintOrdemPagamento,
  openPrintBorderoPagamentos,
} from './types'
import { ContaPagarFormModal } from './components/ContaPagarFormModal'
import { BaixaContaModal } from './components/BaixaContaModal'
import { ContaFichaModal } from './components/ContaFichaModal'

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
  const { alunos, titulos, cfgPlanoContas, cfgEventos, cfgCentrosCusto } = useData()
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') toast.error(msg)
    else toast.success(msg)
  }, [])

  const centrosCustoAtivos = useMemo(
    () => resolveCentrosCustoEscolares(cfgCentrosCusto, 'despesa', false),
    [cfgCentrosCusto]
  )

  const todosCentrosCusto = useMemo(
    () => resolveCentrosCustoEscolares(cfgCentrosCusto, 'todos', true),
    [cfgCentrosCusto]
  )

  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const mesAtualStr = useMemo(() => hojeStr.slice(0, 7), [hojeStr])

  // Estado Principal
  const [contas, setContas] = useState<ContaPagarRecord[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorEscolar[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoCategoriaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MainTab>('lancamentos')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [currentPage, setCurrentPage] = useState(1)

  // Filtros e Busca
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch] = useDebounce(searchInput, 220)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fecha menu de 3 pontinhos ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = () => setOpenMenuId(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenuId])

  // Carregamento Inicial da API
  const fetchContasPagar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contas-pagar?includeMeta=true', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar Contas a Pagar')
      const json = await res.json()
      const rawList = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
      setContas(rawList.map((c: any, idx: number) => normalizarContaPagar(c, idx, hojeStr)))
      if (Array.isArray(json?.fornecedores)) setFornecedores(json.fornecedores)
      if (Array.isArray(json?.orcamentos)) setOrcamentos(json.orcamentos)
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
    return Math.max(1, ativos.length || 420)
  }, [alunos])

  // Receita prevista do mês atual (para indicador de Comprometimento da Receita)
  const receitaMensalReferencia = useMemo(() => {
    const somaTitulosMes = (titulos || [])
      .filter((t: any) => (t.vencimento || '').startsWith(mesAtualStr) && t.status !== 'cancelado')
      .reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)
    return somaTitulosMes > 10000 ? somaTitulosMes : 245000
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

      if (categoriaFilter !== 'todas' && c.categoria !== categoriaFilter) return false
      if (centroCustoFilter !== 'todos') {
        const matchMain = c.centroCusto === centroCustoFilter
        const matchRateio = c.rateio?.some((r) => r.centroCusto === centroCustoFilter)
        if (!matchMain && !matchRateio) return false
      }
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
    competenciaFilter,
    prioridadeFilter,
    tipoCustoFilter,
    sortBy,
    hojeStr,
  ])

  // Handlers de Persistência na API
  const handleSaveContas = async (records: Partial<ContaPagarRecord>[]) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: records }),
    })
    const json = await res.json()
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
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'baixa', ...payload }),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast(json?.error || 'Erro ao efetuar baixa', 'error')
      return
    }
    if (Array.isArray(json.data)) setContas(json.data)
    setSelectedIds(new Set())
    showToast(
      payload.baixaParcial
        ? 'Baixa parcial registrada e saldo remanescente gerado automaticamente!'
        : 'Pagamento liquidado com sucesso!',
      'success'
    )
  }

  const handleConfirmBaixaLote = async (payload: {
    ids: string[]
    dataPagamento: string
    formaPagamento: string
    caixaOrigem: string
    observacao: string
  }) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'baixa_lote', ...payload }),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast(json?.error || 'Erro na baixa em lote', 'error')
      return
    }
    if (Array.isArray(json.data)) setContas(json.data)
    setSelectedIds(new Set())
    showToast(`${payload.ids.length} títulos liquidados em lote com sucesso!`, 'success')
  }

  const handleAprovarLote = async (ids: string[]) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aprovar_lote', ids }),
    })
    const json = await res.json()
    if (res.ok && Array.isArray(json.data)) {
      setContas(json.data)
      setSelectedIds(new Set())
      showToast(`${ids.length} título(s) aprovados pela controladoria!`, 'success')
    }
  }

  const handleReverterBaixa = async (conta: ContaPagarRecord) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reverter_baixa', id: conta.id }),
    })
    const json = await res.json()
    if (res.ok && Array.isArray(json.data)) {
      setContas(json.data)
      showToast('Baixa estornada. O título voltou para aberto.', 'success')
    }
  }

  const handleDeleteIds = async (ids: string[]) => {
    if (ids.length === 0) return
    const res = await fetch(`/api/contas-pagar?ids=${encodeURIComponent(ids.join(','))}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (res.ok && Array.isArray(json.data)) {
      setContas(json.data)
      setSelectedIds(new Set())
      showToast(`${ids.length} registro(s) excluído(s).`, 'success')
    }
  }

  const handleSaveFornecedor = async (f: Partial<FornecedorEscolar>): Promise<FornecedorEscolar | null> => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_fornecedor', fornecedor: f }),
    })
    const json = await res.json()
    if (res.ok) {
      if (Array.isArray(json.fornecedores)) setFornecedores(json.fornecedores)
      showToast('Fornecedor salvo com sucesso!', 'success')
      return json.fornecedor || null
    }
    showToast(json?.error || 'Erro ao salvar fornecedor', 'error')
    return null
  }

  const handleDeleteFornecedor = async (id: string) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_fornecedor', id }),
    })
    const json = await res.json()
    if (res.ok && Array.isArray(json.fornecedores)) {
      setFornecedores(json.fornecedores)
      showToast('Fornecedor removido.', 'success')
    }
  }

  const handleSaveOrcamentos = async (novos: OrcamentoCategoriaItem[]) => {
    const res = await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_orcamentos', orcamentos: novos }),
    })
    const json = await res.json()
    if (res.ok && Array.isArray(json.orcamentos)) {
      setOrcamentos(json.orcamentos)
      showToast('Metas orçamentárias atualizadas!', 'success')
    }
  }

  // Gerar Despesa Recorrente a partir de Template Escolar
  const handleGerarDespesaTemplate = async (
    tpl: (typeof TEMPLATES_DESPESAS_ESCOLARES)[number],
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
        fornecedorNome: tpl.titulo.split('—')[0].trim(),
        categoria: tpl.categoria,
        centroCusto: tpl.centroCusto,
        tipoCusto: tpl.tipoCusto,
        prioridade: tpl.prioridade,
        competencia: comp,
        vencimento: venc,
        valorBase: tpl.valorEstimado,
        valor: tpl.valorEstimado,
        formaPagamento: tpl.formaPagamento,
        recorrente: true,
        frequenciaRecorrencia: 'mensal',
        aprovacaoStatus: 'aprovado',
      },
    ])
    setActiveTab('lancamentos')
  }

  const handleGerarLoteMensalFixo = async (comp: string) => {
    const [y, m] = comp.split('-').map(Number)
    const maxDay = new Date(y, m, 0).getDate()
    const novos: Partial<ContaPagarRecord>[] = TEMPLATES_DESPESAS_ESCOLARES.map((tpl, i) => {
      const safeDay = Math.min(tpl.diaVencimento, maxDay)
      return {
        codigo: `FIX-${comp.replace('-', '')}-0${i + 1}`,
        descricao: `${tpl.titulo} (${comp})`,
        fornecedorNome: tpl.titulo.split('—')[0].trim(),
        categoria: tpl.categoria,
        centroCusto: tpl.centroCusto,
        tipoCusto: tpl.tipoCusto,
        prioridade: tpl.prioridade,
        competencia: comp,
        vencimento: `${comp}-${String(safeDay).padStart(2, '0')}`,
        valorBase: tpl.valorEstimado,
        valor: tpl.valorEstimado,
        formaPagamento: tpl.formaPagamento,
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
      Descrição: c.descricao,
      Fornecedor: c.fornecedorNome,
      'CNPJ / CPF': c.fornecedorDocumento || '',
      Categoria: c.categoria,
      'Segmento / Centro de Custo': c.centroCusto,
      'Natureza Custo': c.tipoCusto,
      Competência: c.competencia,
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
      'Nº Documento / NF': c.numeroDocumento || '',
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
  }, [debouncedSearch, statusFilter, categoriaFilter, centroCustoFilter, competenciaFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(contasFiltradas.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const contasPaginadas = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return contasFiltradas.slice(start, start + PAGE_SIZE)
  }, [contasFiltradas, safePage])

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    statusFilter !== 'todos' ||
    categoriaFilter !== 'todas' ||
    centroCustoFilter !== 'todos' ||
    competenciaFilter !== 'todos'

  const clearAllFilters = useCallback(() => {
    setSearchInput('')
    setStatusFilter('todos')
    setCategoriaFilter('todas')
    setCentroCustoFilter('todos')
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
    <div style={{ padding: '20px 24px 60px', maxWidth: 1560, margin: '0 auto', color: '#0f172a' }}>
      {/* CSS de Tabela Responsiva Light Mode (Sem rolagem horizontal no desktop + @container para telas menores) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .table-wrapper.cp-table-region {
            container-type: inline-size;
            content-visibility: auto;
            contain-intrinsic-size: auto 600px;
            width: 100%;
            overflow: visible;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.05);
          }
          .cp-data-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 12.5px;
            color: #0f172a;
          }
          .cp-data-table thead th {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
            background: #f8fafc;
            color: #475569 !important;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 12px 10px;
            text-align: left;
            border-bottom: 1.5px solid #e2e8f0;
            white-space: normal !important;
            overflow-wrap: break-word;
            word-break: break-word;
            overflow: hidden;
          }
          .cp-data-table tbody th {
            background: #ffffff;
            text-align: left;
            padding: 12px 10px;
            font-weight: 700;
            color: #0f172a !important;
            border-top: 1px solid #f1f5f9;
            vertical-align: middle;
            white-space: normal !important;
            overflow-wrap: break-word;
            word-break: break-word;
            overflow: hidden;
          }
          .cp-data-table tbody td {
            padding: 12px 10px;
            border-top: 1px solid #f1f5f9;
            vertical-align: middle;
            color: #1e293b;
            background: #ffffff;
            white-space: normal !important;
            overflow-wrap: break-word;
            word-break: break-word;
            overflow: hidden;
          }
          .cp-data-table tbody td.cp-actions-cell {
            overflow: visible !important;
          }
          .cp-data-table tbody tr:hover th,
          .cp-data-table tbody tr:hover td {
            background: #f8fafc;
          }
          @container (width < 760px) {
            .cp-data-table {
              table-layout: auto;
            }
            .cp-data-table thead {
              display: none;
            }
            .cp-data-table tbody tr {
              display: grid;
              gap: 0.5rem;
              padding: 1rem;
              border-block-end: 1px solid #e2e8f0;
            }
            .cp-data-table tbody th,
            .cp-data-table tbody td {
              display: grid;
              grid-template-columns: 7.5rem 1fr;
              padding: 4px 0;
              border: none;
              position: static;
              background: transparent;
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

      {/* ── HEADER EXECUTIVO LIGHT ───────────────────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
          padding: '20px 24px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 60%, #f0f9ff 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: '#ffe4e6',
              border: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.12)',
            }}
          >
            <TrendingDown size={25} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#be123c',
                  background: '#ffe4e6',
                  padding: '3px 10px',
                  borderRadius: 99,
                  border: '1px solid #fecdd3',
                }}
              >
                Tesouraria & Controladoria Escolar
              </span>
              <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
                • Integrado ao DRE & Fluxo de Caixa
              </span>
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
              Contas a Pagar & Gestão de Passivos
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
              padding: '9px 14px',
              borderRadius: 11,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <Upload size={14} color="#475569" />
            Importar Planilha
          </button>

          <button
            type="button"
            onClick={handleExportListExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 11,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: 12,
              fontWeight: 800,
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
                competenciaFilter === 'todos' ? 'Programação Geral de Pagamentos' : `Competência ${competenciaFilter}`
              )
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 11,
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} />
            Borderô de Pagamentos
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
              padding: '10px 18px',
              borderRadius: 11,
              background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(225, 29, 72, 0.25)',
            }}
          >
            <Plus size={16} />
            Nova Conta a Pagar
          </button>
        </div>
      </div>

      {/* ── BANNER INTELIGENTE DE ALERTAS DE TESOURARIA (LIGHT) ──────────────── */}
      {(kpis.qtdVencido > 0 || kpis.venceHojeQtd > 0 || kpis.pendenteAprovacaoQtd > 0) && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 18px',
            borderRadius: 14,
            background: kpis.qtdVencido > 0 ? '#fff1f2' : '#fffbeb',
            border: kpis.qtdVencido > 0 ? '1px solid #fecdd3' : '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <AlertTriangle size={18} color={kpis.qtdVencido > 0 ? '#e11d48' : '#d97706'} />
            <div style={{ fontSize: 12.5, color: '#0f172a' }}>
              <strong style={{ color: '#0f172a' }}>Radar de Tesouraria:</strong>{' '}
              {kpis.qtdVencido > 0 && (
                <span style={{ color: '#be123c', marginRight: 12 }}>
                  • <strong>{kpis.qtdVencido} título(s) vencido(s)</strong> ({formatCurrency(kpis.totalVencido)})
                </span>
              )}
              {kpis.venceHojeQtd > 0 && (
                <span style={{ color: '#b45309', marginRight: 12 }}>
                  • <strong>{kpis.venceHojeQtd} vencendo HOJE</strong> ({formatCurrency(kpis.venceHojeValor)})
                </span>
              )}
              {kpis.pendenteAprovacaoQtd > 0 && (
                <span style={{ color: '#1d4ed8' }}>
                  • <strong>{kpis.pendenteAprovacaoQtd} aguardando alçada da diretoria</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {kpis.qtdVencido > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('lancamentos')
                  setStatusFilter('vencido')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#ffffff',
                  border: '1px solid #fda4af',
                  color: '#be123c',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Filtrar Vencidos
              </button>
            )}
            {kpis.venceHojeQtd > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('lancamentos')
                  setStatusFilter('hoje')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#ffffff',
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Ver Vencimentos de Hoje
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PAINEL DE 5 KPIS EXECUTIVOS ESCOLARES (LIGHT) ────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #bae6fd',
            borderTop: '4px solid #0284c7',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Comprometido ({competenciaFilter === 'todos' ? 'Geral' : competenciaFilter})
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>
            {formatCurrency(kpis.totalComprometido)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Folha & Encargos representam <strong style={{ color: '#0f172a' }}>{kpis.pctFolhaSobreDespesa}%</strong> das saídas
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #a7f3d0',
            borderTop: '4px solid #059669',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Liquidado / Pago (Caixa)
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#065f46', marginTop: 6 }}>
            {formatCurrency(kpis.totalPago)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {kpis.totalComprometido > 0
              ? `${Math.round((kpis.totalPago / kpis.totalComprometido) * 100)}% do total já quitado`
              : 'Sem baixas no período'}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #fde68a',
            borderTop: '4px solid #d97706',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Vence Hoje & Próximos 7 Dias
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#92400e', marginTop: 6 }}>
            {formatCurrency(kpis.venceHojeValor + kpis.vence7DiasValor)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Hoje: <strong style={{ color: '#b45309' }}>{formatCurrency(kpis.venceHojeValor)}</strong> ({kpis.venceHojeQtd}) • 7d:{' '}
            {formatCurrency(kpis.vence7DiasValor)}
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #fecdd3',
            borderTop: '4px solid #e11d48',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Passivo em Atraso (Vencidos)
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#9f1239', marginTop: 6 }}>
            {formatCurrency(kpis.totalVencido)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {kpis.qtdVencido} título(s) vencido(s) pendente(s) de regularização
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #e9d5ff',
            borderTop: '4px solid #7c3aed',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Indicador Escolar • Custo / Aluno
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#4c1d95', marginTop: 6 }}>
            {formatCurrency(kpis.custoMedioPorAluno)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Base: {totalAlunosAtivos} alunos • {kpis.pctComprometimentoReceita}% da receita mensal
          </div>
        </div>
      </div>

      {/* ── NAVEGAÇÃO PRINCIPAL EM 6 ABAS (LIGHT) ────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 16,
          background: '#ffffff',
          padding: 6,
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'lancamentos', label: `Lançamentos & Operação (${contasFiltradas.length})`, icon: <LayoutList size={15} /> },
            { id: 'relatorios', label: 'Central de Relatórios & BI (7)', icon: <BarChart3 size={15} />, badge: 'COMPLETO' },
            { id: 'calendario', label: 'Calendário de Desembolso', icon: <Calendar size={15} /> },
            { id: 'orcamento', label: 'Orçamento Escolar (Budget)', icon: <Target size={15} /> },
            { id: 'fornecedores', label: `Fornecedores (${fornecedores.length})`, icon: <Building2 size={15} /> },
            { id: 'recorrentes', label: 'Contratos & Recorrências Fixas', icon: <Repeat size={15} /> },
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
                  gap: 7,
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: active ? '#0f172a' : 'transparent',
                  border: active ? '1px solid #0f172a' : '1px solid transparent',
                  color: active ? '#ffffff' : '#475569',
                  fontSize: 12,
                  fontWeight: active ? 800 : 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: active ? '#10b981' : '#ecfdf5',
                      color: active ? '#ffffff' : '#047857',
                      fontSize: 9,
                      fontWeight: 900,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 1: LANÇAMENTOS & OPERAÇÃO DE TESOURARIA
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lancamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pills Rápidas de Status (Light Mode bem visíveis) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'todos', label: 'Todos os Títulos', count: contas.length },
                { id: 'pendente', label: 'Em Aberto / Agendados', count: contas.filter((c) => c.status === 'pendente' || c.status === 'agendado').length },
                { id: 'vencido', label: 'Vencidos em Atraso', count: kpis.qtdVencido },
                { id: 'hoje', label: 'Vencem Hoje', count: kpis.venceHojeQtd },
                { id: '7dias', label: 'Próximos 7 Dias', count: kpis.vence7DiasQtd },
                { id: 'aprovacao', label: 'Pendente Diretoria', count: kpis.pendenteAprovacaoQtd },
                { id: 'pago', label: 'Liquidados / Pagos', count: contas.filter((c) => c.status === 'pago').length },
              ].map((pill) => {
                const active = statusFilter === pill.id
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatusFilter(pill.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 99,
                      background: active ? '#eff6ff' : '#ffffff',
                      border: active ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      color: active ? '#1d4ed8' : '#334155',
                      fontSize: 11.5,
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{pill.label}</span>
                    <span
                      style={{
                        padding: '1px 7px',
                        borderRadius: 99,
                        background: active ? '#2563eb' : '#f1f5f9',
                        color: active ? '#ffffff' : '#475569',
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {pill.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Alternador Tabela vs Visão em Cards */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 9,
                  background: viewMode === 'table' ? '#0f172a' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: viewMode === 'table' ? '#ffffff' : '#475569',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <LayoutList size={14} /> Tabela Compacta
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 9,
                  background: viewMode === 'cards' ? '#0f172a' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: viewMode === 'cards' ? '#ffffff' : '#475569',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <LayoutGrid size={14} /> Visão em Cards
              </button>
            </div>
          </div>

          {/* Barra de Filtros Avançados em Light Mode */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
              display: 'grid',
              gridTemplateColumns: '1.6fr repeat(4, 1fr)',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <div>
              <label
                htmlFor="cp-search-input"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}
              >
                Pesquisar por Fornecedor, Descrição, Código ou NF
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                />
                <input
                  id="cp-search-input"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ex: Folha Docente, Energia, NFS-e 419, CP-2026..."
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="cp-filter-cat"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}
              >
                Categoria Escolar
              </label>
              <select
                id="cp-filter-cat"
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todas">Todas as Categorias</option>
                {CATEGORIAS_ESCOLARES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label
                  htmlFor="cp-filter-cc"
                  style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}
                >
                  Segmento / Centro Custo
                </label>
                <Link
                  href="/configuracoes/financeiro/centro-custo"
                  style={{ fontSize: 10, fontWeight: 800, color: '#0284c7', textDecoration: 'none' }}
                  title="Configurar Centros de Custo"
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
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todos os Segmentos</option>
                {todosCentrosCusto.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cp-filter-comp"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}
              >
                Mês de Competência
              </label>
              <select
                id="cp-filter-comp"
                value={competenciaFilter}
                onChange={(e) => setCompetenciaFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todas as Competências</option>
                {competenciasDisponiveis.map((comp) => (
                  <option key={comp} value={comp}>Competência {comp}</option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cp-filter-sort"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}
              >
                Ordenação
              </label>
              <select
                id="cp-filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="vencimento_asc">Vencimento (Mais Próximos)</option>
                <option value="vencimento_desc">Vencimento (Mais Recentes)</option>
                <option value="valor_desc">Maior Valor Líquido</option>
                <option value="valor_asc">Menor Valor Líquido</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <X size={13} /> Limpar Filtros Ativos
              </button>
            </div>
          )}

          {/* Barra de Ações em Lote quando há itens selecionados */}
          {selectedIds.size > 0 && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 14,
                background: '#ecfdf5',
                border: '1.5px solid #34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#065f46' }}>
                {selectedIds.size} título(s) selecionado(s) • Soma:{' '}
                <strong style={{ color: '#047857', fontSize: 15 }}>
                  {formatCurrency(contasSelecionadasObj.reduce((a, b) => a + (Number(b.valor) || 0), 0))}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() =>
                    setBaixaTargets(contasSelecionadasObj.filter((c) => c.status !== 'pago'))
                  }
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    background: '#059669',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Liquidar Selecionados em Lote
                </button>
                <button
                  type="button"
                  onClick={() => handleAprovarLote(Array.from(selectedIds))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    background: '#ffffff',
                    border: '1px solid #38bdf8',
                    color: '#0369a1',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Aprovar Alçada em Lote
                </button>
                <button
                  type="button"
                  onClick={() => openPrintBorderoPagamentos(contasSelecionadasObj, 'Seleção Personalizada')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Imprimir Borderô da Seleção
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
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

          {/* TABELA PRINCIPAL COMPACTA E SEM ROLAGEM HORIZONTAL */}
          {viewMode === 'table' ? (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="contas-pagar-table-caption"
              className="table-wrapper cp-table-region"
            >
              <table className="cp-data-table">
                <caption
                  id="contas-pagar-table-caption"
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#475569',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  Relação de Compromissos e Contas a Pagar ({contasFiltradas.length} registros • Soma Filtrada:{' '}
                  <strong style={{ color: '#0369a1' }}>
                    {formatCurrency(contasFiltradas.reduce((a, b) => a + (Number(b.valor) || 0), 0))}
                  </strong>
                  )
                </caption>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
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
                    <th style={{ width: '27%' }}>Descrição / Compromisso</th>
                    <th style={{ width: '19%' }}>Fornecedor / Credor</th>
                    <th style={{ width: '16%' }}>Categoria & Segmento</th>
                    <th style={{ width: '10%' }}>Vencimento</th>
                    <th style={{ width: '11%' }}>Status & Alçada</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>Valor Líquido</th>
                    <th style={{ width: 124, textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                        Carregando lançamentos financeiros da tesouraria escolar...
                      </td>
                    </tr>
                  ) : contasPaginadas.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                        Nenhuma conta a pagar encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    contasPaginadas.map((c) => {
                      const stCfg = STATUS_CONTA_PAGAR_CONFIG[c.status] || STATUS_CONTA_PAGAR_CONFIG.pendente
                      const prioCfg = PRIORIDADE_CONTA_PAGAR_CONFIG[c.prioridade] || PRIORIDADE_CONTA_PAGAR_CONFIG.media
                      const isVenceHoje = c.status !== 'pago' && c.vencimento === hojeStr
                      const isMenuOpen = openMenuId === c.id

                      return (
                        <tr key={c.id}>
                          <td style={{ '--label': 'Selecionar', textAlign: 'center' } as React.CSSProperties}>
                            <input
                              aria-label={`Selecionar ${c.descricao}`}
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

                          <th scope="row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: '#0369a1',
                                  background: '#f0f9ff',
                                  border: '1px solid #bae6fd',
                                  padding: '1px 6px',
                                  borderRadius: 5,
                                  fontWeight: 800,
                                }}
                              >
                                {c.codigo || c.id}
                              </span>
                              {c.parcelaAtual && c.totalParcelas && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: 5,
                                    background: '#f3e8ff',
                                    border: '1px solid #d8b4fe',
                                    color: '#6d28d9',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  {String(c.parcelaAtual).padStart(2, '0')}/{String(c.totalParcelas).padStart(2, '0')}
                                </span>
                              )}
                              {c.rateio && c.rateio.length > 0 && (
                                <span
                                  title="Possui rateio multicentro de custo"
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: 5,
                                    background: '#ecfeff',
                                    border: '1px solid #a5f3fc',
                                    color: '#0e7490',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  Rateio ({c.rateio.length})
                                </span>
                              )}
                            </div>
                            <div
                              onClick={() => setFichaConta(c)}
                              style={{
                                fontSize: 12.5,
                                fontWeight: 800,
                                color: '#0f172a',
                                marginTop: 4,
                                cursor: 'pointer',
                                lineHeight: 1.35,
                              }}
                            >
                              {c.descricao}
                            </div>
                            {c.numeroDocumento && (
                              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                                {c.tipoDocumento || 'Doc'}: {c.numeroDocumento}
                              </div>
                            )}
                          </th>

                          <td style={{ '--label': 'Fornecedor' } as React.CSSProperties}>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 12, lineHeight: 1.3 }}>
                              {c.fornecedorNome}
                            </div>
                            {c.fornecedorDocumento && (
                              <div style={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                                {c.fornecedorDocumento}
                              </div>
                            )}
                          </td>

                          <td style={{ '--label': 'Categoria' } as React.CSSProperties}>
                            <div style={{ fontWeight: 700, color: '#334155', fontSize: 11.5, lineHeight: 1.3 }}>
                              {c.categoria}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>{c.centroCusto}</div>
                          </td>

                          <td style={{ '--label': 'Vencimento' } as React.CSSProperties}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 12,
                                color:
                                  c.status === 'vencido'
                                    ? '#be123c'
                                    : isVenceHoje
                                      ? '#b45309'
                                      : '#0f172a',
                              }}
                            >
                              {c.vencimento?.split('-').reverse().join('/')}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                              Comp: {c.competencia}
                            </div>
                          </td>

                          <td style={{ '--label': 'Status' } as React.CSSProperties}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 99,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: stCfg.color,
                                  background: stCfg.bg,
                                  border: `1px solid ${stCfg.border}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isVenceHoje ? 'Vence Hoje!' : stCfg.label}
                              </span>
                              <span style={{ fontSize: 10, color: prioCfg.color, fontWeight: 700 }}>
                                ● Prio {prioCfg.label}
                                {c.aprovacaoStatus === 'pendente_aprovacao' ? ' • Diretoria' : ''}
                              </span>
                            </div>
                          </td>

                          <td style={{ '--label': 'Valor Líquido', textAlign: 'right' } as React.CSSProperties}>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
                              {formatCurrency(c.valor)}
                            </div>
                            {(c.retencaoImpostos > 0 || c.desconto > 0) && (
                              <div style={{ fontSize: 10, color: '#b45309', marginTop: 2, fontWeight: 600 }}>
                                Bruto: {formatCurrency(c.valorBase)}
                              </div>
                            )}
                          </td>

                          {/* COLUNA AÇÕES ENXUTA: 1 Botão Principal + Menu 3 Pontinhos (⋮) */}
                          <td
                            className="cp-actions-cell"
                            style={{ '--label': 'Ações', textAlign: 'right', position: 'relative' } as React.CSSProperties}
                          >
                            <div
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.status !== 'pago' && c.status !== 'cancelado' ? (
                                <button
                                  type="button"
                                  onClick={() => setBaixaTargets([c])}
                                  title="Dar Baixa / Liquidar Título"
                                  style={{
                                    padding: '6px 11px',
                                    borderRadius: 8,
                                    background: '#059669',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 5px rgba(5, 150, 105, 0.2)',
                                  }}
                                >
                                  Baixar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setFichaConta(c)}
                                  title="Ver Dossiê Completo"
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Ficha
                                </button>
                              )}

                              {/* Botão 3 Pontinhos (Mais Ações) */}
                              <div style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  aria-label={`Mais ações para ${c.descricao}`}
                                  aria-expanded={isMenuOpen}
                                  onClick={() => setOpenMenuId(isMenuOpen ? null : c.id)}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <MoreVertical size={15} />
                                </button>

                                {isMenuOpen && (
                                  <div
                                    role="menu"
                                    style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: 34,
                                      zIndex: 60,
                                      width: 235,
                                      background: '#ffffff',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 12,
                                      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.14)',
                                      padding: 6,
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
                                        setFichaConta(c)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 8,
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
                                        borderRadius: 8,
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
                                        borderRadius: 8,
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
                                          borderRadius: 8,
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
                                          showToast('Linha digitável do boleto copiada!', 'success')
                                          setOpenMenuId(null)
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          width: '100%',
                                          padding: '8px 10px',
                                          borderRadius: 8,
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
                                        openPrintOrdemPagamento(c)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 8,
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
                                          borderRadius: 8,
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
                                        borderRadius: 8,
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
          ) : (
            /* VISÃO EM CARDS KANBAN LIGHT MODE */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {contasPaginadas.map((c) => {
                const stCfg = STATUS_CONTA_PAGAR_CONFIG[c.status] || STATUS_CONTA_PAGAR_CONFIG.pendente
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: '#ffffff',
                      border: `1.5px solid ${stCfg.border}`,
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#0369a1' }}>{c.codigo || c.id}</span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: stCfg.color,
                            background: stCfg.bg,
                            border: `1px solid ${stCfg.border}`,
                          }}
                        >
                          {stCfg.label}
                        </span>
                      </div>
                      <div
                        onClick={() => setFichaConta(c)}
                        style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 6, cursor: 'pointer' }}
                      >
                        {c.descricao}
                      </div>
                      <div style={{ fontSize: 12, color: '#334155', fontWeight: 600, marginTop: 4 }}>{c.fornecedorNome}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {c.categoria} • {c.centroCusto}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 10,
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                          Venc: {c.vencimento?.split('-').reverse().join('/')}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{formatCurrency(c.valor)}</div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setFichaConta(c)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Ficha
                        </button>
                        {c.status !== 'pago' && (
                          <button
                            type="button"
                            onClick={() => setBaixaTargets([c])}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: '#059669',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Baixar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* RODAPÉ DE PAGINAÇÃO E RESUMO */}
          {contasFiltradas.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: 12,
                color: '#475569',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                Exibindo <strong>{(safePage - 1) * PAGE_SIZE + 1}</strong>–
                <strong>{Math.min(safePage * PAGE_SIZE, contasFiltradas.length)}</strong> de{' '}
                <strong>{contasFiltradas.length}</strong> lançamento(s) • Subtotal filtrado:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {formatCurrency(contasFiltradas.reduce((a, b) => a + (Number(b.valor) || 0), 0))}
                </strong>
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
                      padding: '6px 10px',
                      borderRadius: 8,
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
                  <span style={{ fontWeight: 700, padding: '0 8px' }}>
                    Página {safePage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 8,
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
          )}
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
          onSaveFornecedor={handleSaveFornecedor}
          onDeleteFornecedor={handleDeleteFornecedor}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          ABA 6: MATRIZ DE CONTRATOS & DESPESAS RECORRENTES ESCOLARES
         ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'recorrentes' && (
        <RecorrentesTemplatesTab
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
        planoContas={cfgPlanoContas || []}
        eventosFinanceiros={cfgEventos || []}
        centrosCusto={centrosCustoAtivos}
        onSave={handleSaveContas}
        onQuickCreateFornecedor={handleSaveFornecedor}
      />

      <BaixaContaModal
        isOpen={baixaTargets.length > 0}
        onClose={() => setBaixaTargets([])}
        targetContas={baixaTargets}
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
