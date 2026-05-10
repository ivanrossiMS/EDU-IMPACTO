'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  TrendingUp, Filter, RefreshCw, FileSpreadsheet, Printer,
  ArrowLeft, Search, X, Check, Calendar, ChevronRight,
  DollarSign, Clock, Users, Building2, GraduationCap,
  BookOpen, Tag, Layers, AlertCircle, CheckCircle,
  ListFilter, SlidersHorizontal, Eye, EyeOff,
  ChevronDown, ChevronUp, Hash, BarChart3, FileText,
  Loader2, Download, CreditCard, Banknote, Wallet,
  ArrowUpDown, Target, Zap, Activity, PieChart as PieIcon,
  TrendingDown, Percent, Award, CalendarDays
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import { useData } from '@/lib/dataContext'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Parcela {
  alunoId: string; codigo: string; nome: string; turma: string; serie: string
  unidade: string; responsavelFinanceiro: string; cpfResponsavel: string
  emailResponsavel: string; telefoneResponsavel: string; celularResponsavel: string
  evento: string; parcela: string; competencia: string; vencimento: string
  dataPagamento: string; observacaoBaixa: string; valor: number; desconto: number
  juros: number; multa: number; valorPago: number; saldo: number
  formaPagamento: string; statusFinanceiro: string; anoLetivo: number
  caixa: string; nossoNumero: string; origemBaixa: string
  usuarioBaixa: string; dataBaixa: string; descricaoTitulo: string
  percDesconto: number
}

type VisaoPeriodo = 'vencimento' | 'competencia' | 'pagamento'
type ModoVis = 'executivo' | 'analitico'
type Agrupamento = 'nenhum' | 'dia' | 'aluno' | 'responsavel' | 'turma' | 'unidade' | 'status' | 'formaPagamento'

interface Filters {
  dataInicio: string; dataFim: string; anoLetivo: string
  unidade: string; turmas: string[]; series: string[]; eventos: string[]
  statusFinanceiro: string[]; formaPagamento: string[]
  busca: string; responsavelNome: string; alunoId: string; alunoNome: string
  visaoPeriodo: VisaoPeriodo
  comDesconto: 'todos' | 'sim' | 'nao'
  comJuros: 'todos' | 'sim' | 'nao'
  comMulta: 'todos' | 'sim' | 'nao'
  renegociado: 'todos' | 'sim' | 'nao'
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const ACCENT = '#0ea5e9'
const GREEN = '#10b981'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const PURPLE = '#8b5cf6'
const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const STATUS_COLORS: Record<string, string> = { pago: GREEN, vencido: RED, pendente: AMBER, cancelado: '#6b7280', renegociado: PURPLE }
const STATUS_LABELS: Record<string, string> = { pago: 'Pago', vencido: 'Vencido', pendente: 'Pendente', cancelado: 'Cancelado', renegociado: 'Renegociado' }

const fmtR = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCur = (n: number) => `R$ ${fmtR(Math.abs(n || 0))}`
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`
const fmtDate = (s?: string | null) => {
  if (!s) return '—'
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : s
}
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const thisMonthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const thisMonthEnd = () => { const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0); return d.toISOString().slice(0, 10) }
const thisYearStart = () => `${new Date().getFullYear()}-01-01`
const thisYearEnd = () => `${new Date().getFullYear()}-12-31`
const todayISO = () => new Date().toISOString().slice(0, 10)

const DEFAULT_FILTERS: Filters = {
  dataInicio: thisMonthStart(), dataFim: thisMonthEnd(), anoLetivo: String(new Date().getFullYear()),
  unidade: '', turmas: [], series: [], eventos: [], statusFinanceiro: [], formaPagamento: [],
  busca: '', responsavelNome: '', alunoId: '', alunoNome: '',
  visaoPeriodo: 'vencimento',
  comDesconto: 'todos', comJuros: 'todos', comMulta: 'todos', renegociado: 'todos',
}

const QUICK_FILTERS = [
  { label: 'Hoje', fn: () => ({ dataInicio: todayISO(), dataFim: todayISO() }) },
  { label: 'Semana', fn: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - d.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { dataInicio: s.toISOString().slice(0, 10), dataFim: e.toISOString().slice(0, 10) } } },
  { label: 'Mês atual', fn: () => ({ dataInicio: thisMonthStart(), dataFim: thisMonthEnd() }) },
  { label: 'Próx. mês', fn: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() + 1, 1); const e = new Date(d.getFullYear(), d.getMonth() + 2, 0); return { dataInicio: s.toISOString().slice(0, 10), dataFim: e.toISOString().slice(0, 10) } } },
  { label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(e); s.setDate(e.getDate() - 30); return { dataInicio: s.toISOString().slice(0, 10), dataFim: e.toISOString().slice(0, 10) } } },
  { label: 'Ano atual', fn: () => ({ dataInicio: thisYearStart(), dataFim: thisYearEnd() }) },
  { label: 'Vencidos', fn: () => ({ statusFinanceiro: ['vencido'] }) },
  { label: 'Recebidos', fn: () => ({ statusFinanceiro: ['pago'] }) },
  { label: 'Previsão', fn: () => ({ statusFinanceiro: ['pendente'] }) },
  { label: 'Inadimplência', fn: () => ({ statusFinanceiro: ['vencido'], dataFim: todayISO() }) },
]

const METODOS_PAGAMENTO = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Transferência', 'Cheque']
const STATUS_OPTIONS = ['pago', 'pendente', 'vencido', 'cancelado', 'renegociado']
const YR_OPTIONS = ['2026', '2025', '2024', '2023']
const AGRUPAMENTOS: { value: Agrupamento; label: string }[] = [
  { value: 'nenhum', label: 'Sem agrupamento' },
  { value: 'dia', label: 'Por dia' },
  { value: 'aluno', label: 'Por aluno' },
  { value: 'responsavel', label: 'Por responsável' },
  { value: 'turma', label: 'Por turma' },
  { value: 'unidade', label: 'Por unidade' },
  { value: 'status', label: 'Por status' },
  { value: 'formaPagamento', label: 'Por forma pagto' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FluxoRecebimentosPage() {
  const router = useRouter()
  const { mantenedores, turmas: ctxTurmas, cfgEventos } = useData()

  // ─── State ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS })
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [modo, setModo] = useState<ModoVis>('executivo')
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum')
  const [sortField, setSortField] = useState('vencimento')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [activeChip, setActiveChip] = useState<number | null>(2) // Mês atual
  const [drillModal, setDrillModal] = useState<{ type: string; data: any } | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'nome', 'turma', 'unidade', 'responsavelFinanceiro', 'evento', 'parcela',
    'vencimento', 'dataPagamento', 'valor', 'desconto', 'juros', 'multa',
    'valorPago', 'saldo', 'formaPagamento', 'statusFinanceiro'
  ])
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // ─── Data fetching ────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    setLoading(true)
    setHasLoaded(false)
    try {
      const apiFilters: Record<string, string> = {
        anoLetivo: filters.anoLetivo,
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
      }
      if (filters.unidade) apiFilters.unidade = filters.unidade
      if (filters.busca) apiFilters.busca = filters.busca
      if (filters.alunoId) apiFilters.alunoId = filters.alunoId
      if (filters.responsavelNome) apiFilters.responsavelNome = filters.responsavelNome

      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'financeiro_extrato', filters: apiFilters, page: 1, pageSize: 99999 })
      })
      const json = await res.json()
      let rows: Parcela[] = json.data || []

      // Client-side filters
      if (filters.turmas.length > 0) rows = rows.filter(p => filters.turmas.includes(p.turma))
      if (filters.series.length > 0) rows = rows.filter(p => filters.series.includes(p.serie))
      if (filters.eventos.length > 0) rows = rows.filter(p => filters.eventos.includes(p.evento))
      if (filters.statusFinanceiro.length > 0) rows = rows.filter(p => filters.statusFinanceiro.includes(p.statusFinanceiro))
      if (filters.formaPagamento.length > 0) rows = rows.filter(p => filters.formaPagamento.includes(p.formaPagamento))
      if (filters.comDesconto === 'sim') rows = rows.filter(p => p.desconto > 0)
      if (filters.comDesconto === 'nao') rows = rows.filter(p => p.desconto === 0)
      if (filters.comJuros === 'sim') rows = rows.filter(p => p.juros > 0)
      if (filters.comJuros === 'nao') rows = rows.filter(p => p.juros === 0)
      if (filters.comMulta === 'sim') rows = rows.filter(p => p.multa > 0)
      if (filters.comMulta === 'nao') rows = rows.filter(p => p.multa === 0)
      if (filters.renegociado === 'sim') rows = rows.filter(p => p.statusFinanceiro === 'renegociado')
      if (filters.renegociado === 'nao') rows = rows.filter(p => p.statusFinanceiro !== 'renegociado')

      // Visão by period
      if (filters.visaoPeriodo === 'competencia') {
        rows = rows.filter(p => {
          const c = p.competencia || ''
          return c >= filters.dataInicio && c <= filters.dataFim
        })
      }

      setParcelas(rows)
      setHasLoaded(true)
      setPage(1)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [filters])

  // Auto-load on mount
  useEffect(() => { handleApply() }, [])

  // ─── Derived data ─────────────────────────────────────────────────────────
  const unidadesOptions = useMemo(() => {
    const uns = (mantenedores[0]?.unidades || []).map((u: any) => u.nomeFantasia || u.razaoSocial || u.nome || '')
    return Array.from(new Set(uns)).filter(Boolean).sort()
  }, [mantenedores])

  const turmaOptions = useMemo(() => {
    const arr: any[] = ctxTurmas || []
    return arr
      .filter((t: any) => !filters.anoLetivo || String(t.ano || '') === filters.anoLetivo)
      .filter((t: any) => !filters.unidade || norm(t.unidade || '').includes(norm(filters.unidade)))
      .map((t: any) => t.nome || t.id)
      .filter(Boolean)
      .sort()
  }, [ctxTurmas, filters.anoLetivo, filters.unidade])

  const eventoOptions = useMemo(() => {
    const set = new Set<string>()
    parcelas.forEach(p => { if (p.evento) set.add(p.evento) })
    ;(cfgEventos || []).forEach((e: any) => { if (e.nome) set.add(e.nome) })
    return Array.from(set).sort()
  }, [parcelas, cfgEventos])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const pagos = parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
    const vencidos = parcelas.filter(p => p.statusFinanceiro === 'vencido')
    const pendentes = parcelas.filter(p => p.statusFinanceiro === 'pendente')
    const cancelados = parcelas.filter(p => p.statusFinanceiro === 'cancelado')
    const renegociados = parcelas.filter(p => p.statusFinanceiro === 'renegociado')
    const ativos = parcelas.filter(p => p.statusFinanceiro !== 'cancelado')

    const totalPrevisto = ativos.reduce((s, p) => s + (p.valor - p.desconto), 0)
    const totalRecebido = pagos.reduce((s, p) => s + p.valorPago, 0)
    const totalAberto = parcelas.filter(p => !['pago', 'renegociado', 'cancelado'].includes(p.statusFinanceiro)).reduce((s, p) => s + p.saldo, 0)
    const totalVencido = vencidos.reduce((s, p) => s + p.saldo, 0)
    const totalAVencer = pendentes.reduce((s, p) => s + p.saldo, 0)
    const parciais = parcelas.filter(p => p.valorPago > 0 && p.saldo > 0)
    const totalDescontos = parcelas.reduce((s, p) => s + p.desconto, 0)
    const totalJurosRecebidos = pagos.reduce((s, p) => s + p.juros, 0)
    const totalMultasRecebidas = pagos.reduce((s, p) => s + p.multa, 0)
    const totalRenegociado = renegociados.reduce((s, p) => s + p.valor, 0)
    const taxaRecebimento = totalPrevisto > 0 ? (totalRecebido / totalPrevisto) * 100 : 0
    const taxaInadimplencia = totalPrevisto > 0 ? (totalVencido / totalPrevisto) * 100 : 0
    const ticketMedio = pagos.length > 0 ? totalRecebido / pagos.length : 0
    const qtdTitulos = parcelas.length
    const qtdBaixas = pagos.length

    // Maior dia
    const byDay = new Map<string, number>()
    pagos.forEach(p => {
      const d = p.dataPagamento?.slice(0, 10) || ''
      if (d) byDay.set(d, (byDay.get(d) || 0) + p.valorPago)
    })
    let maiorDia = ''
    let maiorDiaVal = 0
    byDay.forEach((v, k) => { if (v > maiorDiaVal) { maiorDiaVal = v; maiorDia = k } })

    return {
      totalPrevisto, totalRecebido, totalAberto, totalVencido, totalAVencer,
      parciais: parciais.length, totalDescontos, totalJurosRecebidos, totalMultasRecebidas,
      totalRenegociado, taxaRecebimento, taxaInadimplencia, ticketMedio,
      qtdTitulos, qtdBaixas, maiorDia, maiorDiaVal,
      pagos: pagos.length, pendentes: pendentes.length, vencidos: vencidos.length,
      cancelados: cancelados.length, renegociados: renegociados.length,
    }
  }, [parcelas])

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartRecebDia = useMemo(() => {
    const map = new Map<string, { dia: string; previsto: number; recebido: number; vencido: number }>()
    parcelas.forEach(p => {
      const d = p.vencimento?.slice(0, 10) || ''
      if (!d) return
      if (!map.has(d)) map.set(d, { dia: d, previsto: 0, recebido: 0, vencido: 0 })
      const e = map.get(d)!
      e.previsto += p.valor - p.desconto
      if (['pago', 'renegociado'].includes(p.statusFinanceiro)) e.recebido += p.valorPago
      if (p.statusFinanceiro === 'vencido') e.vencido += p.saldo
    })
    return Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia)).map(d => ({ ...d, dia: fmtDate(d.dia) }))
  }, [parcelas])

  const chartFormaPagto = useMemo(() => {
    const map = new Map<string, number>()
    parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro) && p.formaPagamento).forEach(p => {
      const k = p.formaPagamento || 'Outros'
      map.set(k, (map.get(k) || 0) + p.valorPago)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [parcelas])

  const chartUnidade = useMemo(() => {
    const map = new Map<string, { unidade: string; recebido: number; aberto: number }>()
    parcelas.forEach(p => {
      const u = p.unidade || 'Sem Unidade'
      if (!map.has(u)) map.set(u, { unidade: u, recebido: 0, aberto: 0 })
      const e = map.get(u)!
      if (['pago', 'renegociado'].includes(p.statusFinanceiro)) e.recebido += p.valorPago
      else if (p.statusFinanceiro !== 'cancelado') e.aberto += p.saldo
    })
    return Array.from(map.values()).sort((a, b) => b.recebido - a.recebido)
  }, [parcelas])

  const chartTurma = useMemo(() => {
    const map = new Map<string, number>()
    parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro)).forEach(p => {
      const t = p.turma || 'Sem Turma'
      map.set(t, (map.get(t) || 0) + p.valorPago)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [parcelas])

  const chartAging = useMemo(() => {
    const today = todayISO()
    const buckets = [
      { label: 'A vencer', min: -99999, max: 0, value: 0 },
      { label: '1-30 dias', min: 1, max: 30, value: 0 },
      { label: '31-60 dias', min: 31, max: 60, value: 0 },
      { label: '61-90 dias', min: 61, max: 90, value: 0 },
      { label: '+90 dias', min: 91, max: 99999, value: 0 },
    ]
    parcelas.filter(p => !['pago', 'renegociado', 'cancelado'].includes(p.statusFinanceiro)).forEach(p => {
      const v = p.vencimento?.slice(0, 10) || ''
      if (!v) return
      const dias = Math.floor((new Date(today).getTime() - new Date(v + 'T12:00').getTime()) / 86400000)
      const b = buckets.find(b => dias >= b.min && dias <= b.max)
      if (b) b.value += p.saldo
    })
    return buckets.map(b => ({ name: b.label, value: b.value }))
  }, [parcelas])

  const chartDescontoEncargos = useMemo(() => {
    const pagos = parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
    return [
      { name: 'Descontos', value: parcelas.reduce((s, p) => s + p.desconto, 0), fill: GREEN },
      { name: 'Juros', value: pagos.reduce((s, p) => s + p.juros, 0), fill: RED },
      { name: 'Multas', value: pagos.reduce((s, p) => s + p.multa, 0), fill: AMBER },
    ]
  }, [parcelas])

  const chartCurvaAcumulada = useMemo(() => {
    const pagos = parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
    const map = new Map<string, number>()
    pagos.forEach(p => {
      const d = p.dataPagamento?.slice(0, 10) || ''
      if (d) map.set(d, (map.get(d) || 0) + p.valorPago)
    })
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    let acc = 0
    return sorted.map(([dia, val]) => { acc += val; return { dia: fmtDate(dia), acumulado: acc } })
  }, [parcelas])

  // ── Sorted/paged data ──────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    const arr = [...parcelas]
    arr.sort((a: any, b: any) => {
      const va = a[sortField]; const vb = b[sortField]
      if (va === vb) return 0
      const dir = sortDir === 'desc' ? -1 : 1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va || '').localeCompare(String(vb || ''), 'pt-BR') * dir
    })
    return arr
  }, [parcelas, sortField, sortDir])

  const pagedData = useMemo(() => sortedData.slice((page - 1) * pageSize, page * pageSize), [sortedData, page, pageSize])
  const totalPages = Math.ceil(sortedData.length / pageSize)

  // ── Grouped data ──────────────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (agrupamento === 'nenhum') return null
    const map = new Map<string, Parcela[]>()
    const keyFn = (p: Parcela): string => {
      switch (agrupamento) {
        case 'dia': return p.vencimento?.slice(0, 10) || 'Sem data'
        case 'aluno': return p.nome || 'Sem nome'
        case 'responsavel': return p.responsavelFinanceiro || 'Sem responsável'
        case 'turma': return p.turma || 'Sem turma'
        case 'unidade': return p.unidade || 'Sem unidade'
        case 'status': return STATUS_LABELS[p.statusFinanceiro] || p.statusFinanceiro
        case 'formaPagamento': return p.formaPagamento || 'Sem forma'
        default: return 'Outros'
      }
    }
    sortedData.forEach(p => {
      const k = keyFn(p)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(p)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sortedData, agrupamento])

  // ── Summary text ──────────────────────────────────────────────────────────
  const resumoGerencial = useMemo(() => {
    if (parcelas.length === 0) return ''
    const pct = kpis.taxaRecebimento.toFixed(0)
    const periodo = `${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)}`
    const maiorDiaStr = kpis.maiorDia ? fmtDate(kpis.maiorDia) : '—'
    let text = `No período de ${periodo}, foram recebidos ${pct}% dos valores previstos (${fmtCur(kpis.totalRecebido)} de ${fmtCur(kpis.totalPrevisto)})`
    if (kpis.maiorDia) text += `, com maior concentração no dia ${maiorDiaStr} (${fmtCur(kpis.maiorDiaVal)})`
    if (kpis.taxaInadimplencia > 0) text += `. A inadimplência está em ${kpis.taxaInadimplencia.toFixed(1)}% do previsto`
    text += '.'
    return text
  }, [parcelas, kpis, filters])

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT XLSX
  // ═══════════════════════════════════════════════════════════════════════════

  const handleExportXLSX = useCallback(() => {
    const wb = XLSX.utils.book_new()
    const ts = new Date().toLocaleString('pt-BR')

    // Aba 1: Resumo
    const resumo = [
      ['FLUXO DE RECEBIMENTOS MENSAL'],
      [`Gerado em: ${ts}`],
      [`Período: ${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)} | Ano Letivo: ${filters.anoLetivo}`],
      [], ['INDICADOR', 'VALOR'],
      ['Previsto', kpis.totalPrevisto],
      ['Recebido', kpis.totalRecebido],
      ['Em Aberto', kpis.totalAberto],
      ['Vencido', kpis.totalVencido],
      ['A Vencer', kpis.totalAVencer],
      ['Descontos', kpis.totalDescontos],
      ['Juros Recebidos', kpis.totalJurosRecebidos],
      ['Multas Recebidas', kpis.totalMultasRecebidas],
      ['Taxa Recebimento', fmtPct(kpis.taxaRecebimento)],
      ['Taxa Inadimplência', fmtPct(kpis.taxaInadimplencia)],
      ['Ticket Médio', kpis.ticketMedio],
      ['Qtd Títulos', kpis.qtdTitulos],
      ['Qtd Baixas', kpis.qtdBaixas],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo Executivo')

    // Aba 2: Detalhado
    const headers = ['Aluno', 'Código', 'Turma', 'Série', 'Unidade', 'Responsável', 'Evento', 'Parcela', 'Competência', 'Vencimento', 'Dt. Pagamento', 'Valor', 'Desconto', 'Juros', 'Multa', 'Valor Pago', 'Saldo', 'Forma Pagto', 'Status', 'Caixa', 'Observação']
    const detRows = sortedData.map(p => [p.nome, p.codigo, p.turma, p.serie, p.unidade, p.responsavelFinanceiro, p.evento, p.parcela, p.competencia, fmtDate(p.vencimento), fmtDate(p.dataPagamento), p.valor, p.desconto, p.juros, p.multa, p.valorPago, p.saldo, p.formaPagamento, p.statusFinanceiro, p.caixa, p.observacaoBaixa])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...detRows]), 'Recebimentos Detalhados')

    // Aba 3: Inadimplência
    const inad = sortedData.filter(p => p.statusFinanceiro === 'vencido')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...inad.map(p => [p.nome, p.codigo, p.turma, p.serie, p.unidade, p.responsavelFinanceiro, p.evento, p.parcela, p.competencia, fmtDate(p.vencimento), fmtDate(p.dataPagamento), p.valor, p.desconto, p.juros, p.multa, p.valorPago, p.saldo, p.formaPagamento, p.statusFinanceiro, p.caixa, p.observacaoBaixa])]), 'Inadimplência')

    // Aba 4: Recebimentos por Dia
    const byDayH = ['Dia', 'Previsto', 'Recebido', 'Vencido']
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([byDayH, ...chartRecebDia.map(d => [d.dia, d.previsto, d.recebido, d.vencido])]), 'Por Dia')

    // Aba 5: Recebimentos por Forma
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Forma', 'Valor'], ...chartFormaPagto.map(d => [d.name, d.value])]), 'Por Forma Pagamento')

    // Aba 6: Por Unidade
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Unidade', 'Recebido', 'Em Aberto'], ...chartUnidade.map(d => [d.unidade, d.recebido, d.aberto])]), 'Por Unidade')

    // Aba 7: Renegociações
    const reneg = sortedData.filter(p => p.statusFinanceiro === 'renegociado')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...reneg.map(p => [p.nome, p.codigo, p.turma, p.serie, p.unidade, p.responsavelFinanceiro, p.evento, p.parcela, p.competencia, fmtDate(p.vencimento), fmtDate(p.dataPagamento), p.valor, p.desconto, p.juros, p.multa, p.valorPago, p.saldo, p.formaPagamento, p.statusFinanceiro, p.caixa, p.observacaoBaixa])]), 'Renegociações')

    // Aba 8: Conferência de Baixas
    const baixas = sortedData.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
    const hBaixa = ['Aluno', 'Evento', 'Parcela', 'Valor', 'Desconto', 'Juros', 'Multa', 'Valor Pago', 'Forma', 'Dt. Pagamento', 'Caixa', 'Observação']
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hBaixa, ...baixas.map(p => [p.nome, p.evento, p.parcela, p.valor, p.desconto, p.juros, p.multa, p.valorPago, p.formaPagamento, fmtDate(p.dataPagamento), p.caixa, p.observacaoBaixa])]), 'Conferência Baixas')

    XLSX.writeFile(wb, `fluxo-recebimentos-${filters.anoLetivo}-${todayISO()}.xlsx`)
  }, [sortedData, kpis, filters, chartRecebDia, chartFormaPagto, chartUnidade])

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT PDF
  // ═══════════════════════════════════════════════════════════════════════════

  const handleExportPDF = useCallback((tipo: 'executivo' | 'detalhado') => {
    const mant = mantenedores[0] || {}
    const schnome = mant.razaoSocial || mant.nome || 'Colégio'
    const logo = mant.logo || ''
    const logoH = logo ? `<img src="${logo}" style="max-height:48px;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />` : ''
    const hoje = new Date().toLocaleString('pt-BR')

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;overflow-x:hidden}
      body{font-family:'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:16px 20px;font-size:9px;color:#1e293b}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0ea5e9;padding-bottom:10px;margin-bottom:14px}
      .school{font-size:16px;font-weight:900;color:#0f172a}.sub{font-size:9px;color:#64748b}
      .title{font-size:14px;font-weight:800;text-align:right}.emitido{font-size:8px;color:#94a3b8;text-align:right;margin-top:3px}
      .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
      .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px}
      .kpi-lbl{font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:2px}
      .kpi-val{font-size:11px;font-weight:900}
      .kpi-val.green{color:#059669}.kpi-val.red{color:#dc2626}.kpi-val.blue{color:#0369a1}.kpi-val.amber{color:#d97706}.kpi-val.gray{color:#4b5563}
      table{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed}
      th{background:#0ea5e9;color:#fff;padding:4px;font-size:7px;font-weight:700;text-align:left;text-transform:uppercase}
      td{padding:3px 4px;font-size:8px;border-bottom:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      td.num{text-align:right;font-family:'Courier New',monospace}td.ctr{text-align:center}
      tr:nth-child(even) td{background:#f8fafc}
      .badge{display:inline-block;padding:1px 4px;border-radius:8px;font-size:6px;font-weight:800}
      .resumo{background:#f1f5f9;padding:10px;border-radius:6px;margin-bottom:14px;font-size:9px;color:#334155;line-height:1.5}
      .footer{font-size:7px;color:#94a3b8;text-align:center;margin-top:14px;border-top:1px dashed #e2e8f0;padding-top:6px}
      @media print{@page{size:A4 landscape;margin:8mm 10mm}body{padding:0}}
    `

    const kpiCards = [
      { l: 'Previsto', v: fmtCur(kpis.totalPrevisto), c: 'blue' },
      { l: 'Recebido', v: fmtCur(kpis.totalRecebido), c: 'green' },
      { l: 'Em Aberto', v: fmtCur(kpis.totalAberto), c: 'amber' },
      { l: 'Vencido', v: fmtCur(kpis.totalVencido), c: 'red' },
      { l: 'A Vencer', v: fmtCur(kpis.totalAVencer), c: 'blue' },
      { l: 'Descontos', v: fmtCur(kpis.totalDescontos), c: 'green' },
      { l: 'Juros Receb.', v: fmtCur(kpis.totalJurosRecebidos), c: 'red' },
      { l: 'Multas Receb.', v: fmtCur(kpis.totalMultasRecebidas), c: 'red' },
      { l: 'Taxa Receb.', v: fmtPct(kpis.taxaRecebimento), c: 'green' },
      { l: 'Inadimpl.', v: fmtPct(kpis.taxaInadimplencia), c: 'red' },
      { l: 'Ticket Médio', v: fmtCur(kpis.ticketMedio), c: 'blue' },
      { l: 'Títulos', v: String(kpis.qtdTitulos), c: 'gray' },
    ]

    let tableH = ''
    let tableB = ''
    const dataToPrint = tipo === 'executivo' ? sortedData.slice(0, 50) : sortedData

    tableH = '<tr><th>Aluno</th><th>Turma</th><th>Evento</th><th>Parc.</th><th>Vencimento</th><th>Dt.Pagto</th><th>Valor</th><th>Desc.</th><th>Juros</th><th>Multa</th><th>Pago</th><th>Saldo</th><th>Forma</th><th>Status</th></tr>'
    dataToPrint.forEach(p => {
      const sc = STATUS_COLORS[p.statusFinanceiro] || '#6b7280'
      tableB += `<tr><td>${p.nome}</td><td class="ctr">${p.turma}</td><td>${p.evento}</td><td class="ctr">${p.parcela}</td><td class="ctr">${fmtDate(p.vencimento)}</td><td class="ctr">${fmtDate(p.dataPagamento)}</td><td class="num">${fmtCur(p.valor)}</td><td class="num">${p.desconto > 0 ? fmtCur(p.desconto) : '—'}</td><td class="num">${p.juros > 0 ? fmtCur(p.juros) : '—'}</td><td class="num">${p.multa > 0 ? fmtCur(p.multa) : '—'}</td><td class="num" style="font-weight:700;color:${['pago', 'renegociado'].includes(p.statusFinanceiro) ? '#059669' : '#94a3b8'}">${fmtCur(p.valorPago)}</td><td class="num" style="color:${p.saldo > 0 ? '#dc2626' : '#94a3b8'}">${fmtCur(p.saldo)}</td><td class="ctr">${p.formaPagamento || '—'}</td><td class="ctr"><span class="badge" style="background:${sc}20;color:${sc}">${STATUS_LABELS[p.statusFinanceiro] || p.statusFinanceiro}</span></td></tr>`
    })

    const html = `<!DOCTYPE html><html><head><title>Fluxo de Recebimentos</title><style>${css}</style></head><body>`
      + `<div class="hdr"><div style="display:flex;align-items:center;gap:10px">${logoH}<div><div class="school">${schnome}</div><div class="sub">Fluxo de Recebimentos Mensal</div></div></div>`
      + `<div><div class="title">${tipo === 'executivo' ? 'RELATÓRIO EXECUTIVO' : 'RELATÓRIO DETALHADO'}</div><div class="emitido">Emitido: ${hoje}</div></div></div>`
      + `<div class="resumo">${resumoGerencial}</div>`
      + `<div class="kpi-row">${kpiCards.map(k => `<div class="kpi"><div class="kpi-lbl">${k.l}</div><div class="kpi-val ${k.c}">${k.v}</div></div>`).join('')}</div>`
      + `<table><thead>${tableH}</thead><tbody>${tableB}</tbody></table>`
      + `<div class="footer">Período: ${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)} | ${sortedData.length} título(s) | Gerado por ${schnome}</div>`
      + `</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }, [sortedData, kpis, filters, mantenedores, resumoGerencial])

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS DEFINITION
  // ═══════════════════════════════════════════════════════════════════════════

  const ALL_COLUMNS: { key: string; label: string; width?: number; align?: string }[] = [
    { key: 'nome', label: 'Aluno', width: 180 },
    { key: 'codigo', label: 'Código', width: 80 },
    { key: 'turma', label: 'Turma', width: 120 },
    { key: 'serie', label: 'Série', width: 90 },
    { key: 'unidade', label: 'Unidade', width: 120 },
    { key: 'responsavelFinanceiro', label: 'Responsável', width: 160 },
    { key: 'cpfResponsavel', label: 'CPF Resp.', width: 110 },
    { key: 'evento', label: 'Evento', width: 140 },
    { key: 'descricaoTitulo', label: 'Descrição', width: 140 },
    { key: 'parcela', label: 'Parcela', width: 60 },
    { key: 'competencia', label: 'Competência', width: 100 },
    { key: 'vencimento', label: 'Vencimento', width: 95 },
    { key: 'dataPagamento', label: 'Dt. Pagamento', width: 100 },
    { key: 'valor', label: 'Valor', width: 95, align: 'right' },
    { key: 'desconto', label: 'Desconto', width: 90, align: 'right' },
    { key: 'juros', label: 'Juros', width: 80, align: 'right' },
    { key: 'multa', label: 'Multa', width: 80, align: 'right' },
    { key: 'valorPago', label: 'Valor Pago', width: 100, align: 'right' },
    { key: 'saldo', label: 'Saldo', width: 90, align: 'right' },
    { key: 'formaPagamento', label: 'Forma Pagto', width: 100 },
    { key: 'statusFinanceiro', label: 'Status', width: 85 },
    { key: 'caixa', label: 'Caixa', width: 80 },
    { key: 'nossoNumero', label: 'Nosso Nº', width: 100 },
    { key: 'observacaoBaixa', label: 'Observação', width: 140 },
    { key: 'origemBaixa', label: 'Origem Baixa', width: 100 },
    { key: 'anoLetivo', label: 'Ano Letivo', width: 80 },
  ]

  const displayCols = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key))

  // ─── Totals for footer ────────────────────────────────────────────────
  const footerTotals = useMemo(() => {
    const sumFields = ['valor', 'desconto', 'juros', 'multa', 'valorPago', 'saldo']
    const totals: Record<string, number> = {}
    sumFields.forEach(f => { totals[f] = sortedData.reduce((s, p) => s + (Number((p as any)[f]) || 0), 0) })
    return totals
  }, [sortedData])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const renderCellValue = (p: Parcela, key: string) => {
    const v = (p as any)[key]
    if (['valor', 'desconto', 'juros', 'multa', 'valorPago', 'saldo'].includes(key)) {
      const n = Number(v) || 0
      const color = key === 'saldo' && n > 0 ? RED : key === 'valorPago' && n > 0 ? GREEN : key === 'desconto' && n > 0 ? GREEN : key === 'juros' && n > 0 ? RED : key === 'multa' && n > 0 ? RED : 'inherit'
      return <span style={{ fontFamily: "'Courier New', monospace", fontWeight: n > 0 ? 700 : 400, color }}>{n > 0 ? fmtCur(n) : '—'}</span>
    }
    if (['vencimento', 'dataPagamento', 'dataBaixa'].includes(key)) return <span>{fmtDate(v)}</span>
    if (key === 'statusFinanceiro') {
      const c = STATUS_COLORS[v] || '#6b7280'
      return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, background: `${c}18`, color: c }}>{STATUS_LABELS[v] || v}</span>
    }
    return <span>{v || '—'}</span>
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${ACCENT}, #0284c7)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#fff" />
            </div>
            <h1 className="page-title" style={{ fontSize: 24, margin: 0 }}>Fluxo de Recebimentos Mensal</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT, textTransform: 'uppercase' }}>Financeiro</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
            Visão completa de recebimentos, inadimplência, fluxo de caixa e análise financeira por período.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid hsl(var(--border-default))', overflow: 'hidden' }}>
            {(['executivo', 'analitico'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: modo === m ? 700 : 500, background: modo === m ? `${ACCENT}14` : 'transparent', color: modo === m ? ACCENT : 'hsl(var(--text-muted))', border: 'none', cursor: 'pointer' }}>
                {m === 'executivo' ? '📊 Executivo' : '🔍 Analítico'}
              </button>
            ))}
          </div>
          <button onClick={handleApply} className="btn btn-secondary btn-icon" title="Atualizar"><RefreshCw size={14} /></button>
          <button onClick={handleExportXLSX} className="btn btn-secondary" style={{ gap: 5, fontSize: 11 }}><FileSpreadsheet size={13} /> XLSX</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => handleExportPDF('executivo')} className="btn btn-secondary" style={{ gap: 5, fontSize: 11 }}><FileText size={13} /> PDF</button>
          </div>
          <button onClick={() => handleExportPDF('detalhado')} className="btn btn-secondary" style={{ gap: 5, fontSize: 11 }}><Printer size={13} /> Imprimir</button>
        </div>
      </div>

      {/* ── QUICK CHIPS ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {QUICK_FILTERS.map((qf, i) => (
          <button key={i} onClick={() => { setFilters(f => ({ ...f, ...qf.fn() } as Filters)); setActiveChip(i) }}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: activeChip === i ? 700 : 500, border: `1px solid ${activeChip === i ? ACCENT : 'hsl(var(--border-default))'}`, background: activeChip === i ? `${ACCENT}14` : 'transparent', color: activeChip === i ? ACCENT : 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.15s' }}>
            {qf.label}
          </button>
        ))}
      </div>

      {/* ── FILTERS ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <button onClick={() => setShowFilters(!showFilters)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={14} color={ACCENT} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Filtros Avançados</span>
            {(filters.turmas.length > 0 || filters.statusFinanceiro.length > 0 || filters.formaPagamento.length > 0 || filters.unidade) && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT }}>ATIVO</span>
            )}
          </div>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showFilters && (
          <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {/* Row 1: Period */}
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Data Início</label>
              <input type="date" className="form-input" value={filters.dataInicio} onChange={e => setFilters(f => ({ ...f, dataInicio: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Data Fim</label>
              <input type="date" className="form-input" value={filters.dataFim} onChange={e => setFilters(f => ({ ...f, dataFim: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Ano Letivo</label>
              <select className="form-input" value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))} style={{ fontSize: 12 }}>
                {YR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Visão por</label>
              <select className="form-input" value={filters.visaoPeriodo} onChange={e => setFilters(f => ({ ...f, visaoPeriodo: e.target.value as VisaoPeriodo }))} style={{ fontSize: 12 }}>
                <option value="vencimento">Vencimento</option>
                <option value="competencia">Competência</option>
                <option value="pagamento">Dt. Pagamento</option>
              </select>
            </div>

            {/* Row 2: Entity */}
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Unidade</label>
              <select className="form-input" value={filters.unidade} onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">Todas</option>
                {unidadesOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Turma</label>
              <select className="form-input" value={filters.turmas[0] || ''} onChange={e => setFilters(f => ({ ...f, turmas: e.target.value ? [e.target.value] : [] }))} style={{ fontSize: 12 }}>
                <option value="">Todas</option>
                {turmaOptions.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Busca (aluno)</label>
              <input className="form-input" placeholder="Nome, código..." value={filters.busca} onChange={e => setFilters(f => ({ ...f, busca: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Responsável</label>
              <input className="form-input" placeholder="Nome do responsável..." value={filters.responsavelNome} onChange={e => setFilters(f => ({ ...f, responsavelNome: e.target.value }))} style={{ fontSize: 12 }} />
            </div>

            {/* Row 3: Status / Form */}
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Status</label>
              <select className="form-input" value={filters.statusFinanceiro[0] || ''} onChange={e => setFilters(f => ({ ...f, statusFinanceiro: e.target.value ? [e.target.value] : [] }))} style={{ fontSize: 12 }}>
                <option value="">Todos</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Forma Pagto</label>
              <select className="form-input" value={filters.formaPagamento[0] || ''} onChange={e => setFilters(f => ({ ...f, formaPagamento: e.target.value ? [e.target.value] : [] }))} style={{ fontSize: 12 }}>
                <option value="">Todas</option>
                {METODOS_PAGAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Com desconto?</label>
              <select className="form-input" value={filters.comDesconto} onChange={e => setFilters(f => ({ ...f, comDesconto: e.target.value as any }))} style={{ fontSize: 12 }}>
                <option value="todos">Todos</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Renegociado?</label>
              <select className="form-input" value={filters.renegociado} onChange={e => setFilters(f => ({ ...f, renegociado: e.target.value as any }))} style={{ fontSize: 12 }}>
                <option value="todos">Todos</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>

            {/* Actions */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => { setFilters({ ...DEFAULT_FILTERS }); setActiveChip(2) }} className="btn btn-secondary" style={{ fontSize: 11 }}>Limpar filtros</button>
              <button onClick={handleApply} className="btn btn-primary" style={{ fontSize: 11, gap: 5 }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Gerar Relatório
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RESUMO GERENCIAL ──────────────────────────────────────────────── */}
      {hasLoaded && parcelas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 20px', background: 'linear-gradient(135deg, hsl(var(--bg-surface)), hsl(var(--bg-elevated)))', borderLeft: `4px solid ${ACCENT}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Zap size={14} color={ACCENT} />
            <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resumo Inteligente</span>
          </div>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-primary))', lineHeight: 1.55, margin: 0 }}>{resumoGerencial}</p>
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      {hasLoaded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { icon: <Target size={16} />, label: 'Previsto', value: fmtCur(kpis.totalPrevisto), color: '#0369a1' },
            { icon: <CheckCircle size={16} />, label: 'Recebido', value: fmtCur(kpis.totalRecebido), color: GREEN },
            { icon: <Clock size={16} />, label: 'Em Aberto', value: fmtCur(kpis.totalAberto), color: AMBER },
            { icon: <AlertCircle size={16} />, label: 'Vencido', value: fmtCur(kpis.totalVencido), color: RED },
            { icon: <CalendarDays size={16} />, label: 'A Vencer', value: fmtCur(kpis.totalAVencer), color: '#0369a1' },
            { icon: <Activity size={16} />, label: 'Parciais', value: String(kpis.parciais), color: '#f97316' },
            { icon: <Tag size={16} />, label: 'Descontos', value: fmtCur(kpis.totalDescontos), color: GREEN },
            { icon: <TrendingUp size={16} />, label: 'Juros Receb.', value: fmtCur(kpis.totalJurosRecebidos), color: RED },
            { icon: <TrendingDown size={16} />, label: 'Multas Receb.', value: fmtCur(kpis.totalMultasRecebidas), color: RED },
            { icon: <Award size={16} />, label: 'Renegociado', value: fmtCur(kpis.totalRenegociado), color: PURPLE },
            { icon: <Percent size={16} />, label: 'Taxa Receb.', value: fmtPct(kpis.taxaRecebimento), color: GREEN },
            { icon: <Percent size={16} />, label: 'Inadimpl.', value: fmtPct(kpis.taxaInadimplencia), color: RED },
            { icon: <DollarSign size={16} />, label: 'Ticket Médio', value: fmtCur(kpis.ticketMedio), color: '#0369a1' },
            { icon: <Hash size={16} />, label: 'Títulos', value: String(kpis.qtdTitulos), color: '#4b5563' },
            { icon: <CheckCircle size={16} />, label: 'Baixas', value: String(kpis.qtdBaixas), color: GREEN },
            { icon: <Calendar size={16} />, label: 'Maior Dia', value: kpis.maiorDia ? `${fmtDate(kpis.maiorDia)}` : '—', color: GREEN, sub: kpis.maiorDiaVal > 0 ? fmtCur(kpis.maiorDiaVal) : '' },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ color: k.color }}>{k.icon}</div>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>{k.label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, fontFamily: "'Outfit', sans-serif" }}>{k.value}</div>
              {'sub' in k && k.sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── CHARTS ─────────────────────────────────────────────────────────── */}
      {hasLoaded && parcelas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
          {/* Chart 1: Recebimentos por dia */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>📊 Recebimentos por Dia</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartRecebDia.slice(0, 31)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="dia" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => fmtCur(v)} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="previsto" fill="#0ea5e920" stroke={ACCENT} name="Previsto" />
                <Bar dataKey="recebido" fill={GREEN} name="Recebido" radius={[2, 2, 0, 0]} />
                <Bar dataKey="vencido" fill={RED} name="Vencido" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 3: Por Forma de Pagamento */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>💳 Recebido por Forma de Pagamento</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartFormaPagto} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: 9 }}>
                  {chartFormaPagto.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <RTooltip formatter={(v: any) => fmtCur(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 4: Por Unidade */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>🏫 Recebimentos por Unidade</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartUnidade} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis type="number" tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="unidade" type="category" tick={{ fontSize: 9 }} width={100} />
                <RTooltip formatter={(v: any) => fmtCur(v)} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="recebido" fill={GREEN} name="Recebido" radius={[0, 3, 3, 0]} />
                <Bar dataKey="aberto" fill={AMBER} name="Em Aberto" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 6: Aging */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>📅 Aging de Recebíveis</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartAging} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => fmtCur(v)} />
                <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
                  {chartAging.map((_, i) => <Cell key={i} fill={[ACCENT, AMBER, '#f97316', RED, '#991b1b'][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {modo === 'analitico' && (
            <>
              {/* Chart 5: Por Turma */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>🎓 Receita por Turma (Top 10)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartTurma} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: any) => fmtCur(v)} />
                    <Bar dataKey="value" name="Recebido" radius={[4, 4, 0, 0]}>
                      {chartTurma.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 7: Descontos x Encargos */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>⚖️ Descontos × Juros × Multas</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartDescontoEncargos} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: any) => fmtCur(v)} />
                    <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
                      {chartDescontoEncargos.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 8: Curva Acumulada */}
              <div className="card" style={{ padding: 16, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))' }}>📈 Curva Acumulada de Recebimento</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartCurvaAcumulada} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: any) => fmtCur(v)} />
                    <Area type="monotone" dataKey="acumulado" stroke={ACCENT} fillOpacity={1} fill="url(#colorAcc)" strokeWidth={2} name="Acumulado" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TABLE CONTROLS ─────────────────────────────────────────────────── */}
      {hasLoaded && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={15} color={ACCENT} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento</span>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{sortedData.length} registro(s)</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Agrupamento */}
              <select value={agrupamento} onChange={e => setAgrupamento(e.target.value as Agrupamento)} className="form-input" style={{ fontSize: 11, padding: '4px 8px', width: 'auto' }}>
                {AGRUPAMENTOS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {/* Page size */}
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="form-input" style={{ fontSize: 11, padding: '4px 8px', width: 'auto' }}>
                {[25, 50, 100, 200].map(s => <option key={s} value={s}>{s}/pág</option>)}
              </select>
              {/* Column picker */}
              <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="btn btn-secondary btn-icon" title="Colunas" style={{ padding: 5 }}>
                <Eye size={13} />
              </button>
            </div>
          </div>

          {/* Column picker dropdown */}
          {showColumnPicker && (
            <div style={{ padding: '10px 18px', borderBottom: '1px solid hsl(var(--border-default))', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_COLUMNS.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: visibleColumns.includes(c.key) ? `${ACCENT}14` : 'transparent', border: `1px solid ${visibleColumns.includes(c.key) ? ACCENT + '40' : 'hsl(var(--border-subtle))'}` }}>
                  <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => setVisibleColumns(v => v.includes(c.key) ? v.filter(x => x !== c.key) : [...v, c.key])} style={{ display: 'none' }} />
                  <span style={{ color: visibleColumns.includes(c.key) ? ACCENT : 'hsl(var(--text-muted))', fontWeight: visibleColumns.includes(c.key) ? 700 : 400 }}>{c.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {displayCols.map(col => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} style={{ padding: '8px 10px', textAlign: (col.align || 'left') as any, background: 'hsl(var(--bg-elevated))', borderBottom: '2px solid hsl(var(--border-default))', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', minWidth: col.width || 80, position: 'sticky', top: 0 }}>
                      {col.label}
                      {sortField === col.key && <span style={{ marginLeft: 3, fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={displayCols.length} style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} /></td></tr>
                ) : sortedData.length === 0 ? (
                  <tr><td colSpan={displayCols.length} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum registro encontrado para os filtros aplicados.</td></tr>
                ) : agrupamento !== 'nenhum' && groupedData ? (
                  groupedData.map(([group, items], gi) => ([
                      <tr key={`g-${gi}`}>
                        <td colSpan={displayCols.length} style={{ padding: '8px 10px', fontWeight: 800, fontSize: 11, background: 'hsl(var(--bg-elevated))', borderTop: `2px solid ${ACCENT}40`, color: 'hsl(var(--text-primary))' }}>
                          {group} <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))', marginLeft: 6 }}>({items.length} título(s) · Prev.: {fmtCur(items.reduce((s, p) => s + p.valor - p.desconto, 0))} · Receb.: {fmtCur(items.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro)).reduce((s, p) => s + p.valorPago, 0))})</span>
                        </td>
                      </tr>,
                      ...items.slice(0, pageSize).map((p, j) => (
                        <tr key={`${gi}-${j}`} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                          {displayCols.map(col => (
                            <td key={col.key} style={{ padding: '6px 10px', textAlign: (col.align || 'left') as any, maxWidth: col.width || 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {renderCellValue(p, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))
                    ]))
                ) : (
                  pagedData.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--bg-elevated) / 50%)' }}>
                      {displayCols.map(col => (
                        <td key={col.key} style={{ padding: '6px 10px', textAlign: (col.align || 'left') as any, maxWidth: col.width || 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderCellValue(p, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {/* Footer totals */}
              {sortedData.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${ACCENT}`, background: 'hsl(var(--bg-elevated))' }}>
                    {displayCols.map(col => {
                      const isSum = ['valor', 'desconto', 'juros', 'multa', 'valorPago', 'saldo'].includes(col.key)
                      return (
                        <td key={col.key} style={{ padding: '8px 10px', fontWeight: 900, fontSize: 11, textAlign: (col.align || 'left') as any, fontFamily: isSum ? "'Courier New', monospace" : 'inherit', color: col.key === 'saldo' ? RED : col.key === 'valorPago' ? GREEN : 'hsl(var(--text-primary))' }}>
                          {col.key === displayCols[0]?.key ? `TOTAL (${sortedData.length})` : isSum ? fmtCur(footerTotals[col.key] || 0) : ''}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {agrupamento === 'nenhum' && totalPages > 1 && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedData.length)} de {sortedData.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-icon" style={{ padding: '4px 10px', fontSize: 11 }}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page + i - 2
                  if (p < 1 || p > totalPages) return null
                  return <button key={p} onClick={() => setPage(p)} className={`btn ${page === p ? 'btn-primary' : 'btn-secondary'} btn-icon`} style={{ padding: '4px 10px', fontSize: 11 }}>{p}</button>
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary btn-icon" style={{ padding: '4px 10px', fontSize: 11 }}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOADING STATE ──────────────────────────────────────────────────── */}
      {loading && !hasLoaded && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: ACCENT, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Carregando dados financeiros...</div>
        </div>
      )}

      {/* ── EMPTY STATE ────────────────────────────────────────────────────── */}
      {hasLoaded && parcelas.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '50px 30px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>Nenhum registro encontrado</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto' }}>Ajuste os filtros ou selecione um período diferente para visualizar os recebimentos.</div>
        </div>
      )}
    </div>
  )
}
