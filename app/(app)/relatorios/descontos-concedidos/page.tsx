'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Download, FileSpreadsheet, RefreshCw, Filter,
  Tag, TrendingDown, Users, Layers, Building2, Calendar,
  ChevronDown, ChevronUp, X, Check, Search, Loader2, BarChart3,
  ChevronLeft, ChevronRight, Star, AlertCircle, Percent,
  GraduationCap, BookOpen, ListFilter, SlidersHorizontal,
  PrinterIcon, EyeOff, Eye
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { exportPDF } from '@/lib/reports/exportPDF'
import { exportXLSX } from '@/lib/reports/exportXLSX'

// ─── Types ───────────────────────────────────────────────────────────

interface Row {
  alunoId: string
  codigo: string
  nome: string
  turma: string
  serie: string
  unidade: string
  evento: string
  parcela: string
  competencia: string
  vencimento: string
  dataPagamento: string
  valor: number
  desconto: number
  valorPago: number
  percDesconto: number
  statusFinanceiro: string
  anoLetivo: number
}

interface Aggregates {
  totalRegistros: number
  totalValorOriginal: number
  totalDesconto: number
  totalPago: number
  percDescontoMedio: number
  alunosDistintos: number
}

interface Filters {
  dataInicio: string
  dataFim: string
  grupoAluno: string
  nivelEnsino: string
  turma: string
  eventos: string[]           // multi-select via modal
  statusFinanceiro: string    // '' | pago | em_aberto | vencido
  unidade: string
  busca: string
  anoLetivo: string
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

const GOLD = '#D4A017'
const GOLD_LIGHT = '#F0C040'
const GOLD_DIM = 'rgba(212,160,23,0.15)'
const GOLD_DARK = '#A07010'

// ─── KPI Card ────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent = false, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  accent?: boolean; color?: string
}) {
  return (
    <div style={{
      background: accent
        ? `linear-gradient(135deg, ${GOLD_DARK}20 0%, ${GOLD}15 100%)`
        : 'hsl(var(--bg-card))',
      border: `1px solid ${accent ? GOLD + '40' : 'hsl(var(--border-default))'}`,
      borderRadius: 6,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 80, height: 80,
          background: `radial-gradient(circle at 80% 20%, ${GOLD}20, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: color ? `${color}20` : accent ? GOLD_DIM : 'hsl(var(--bg-elevated))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} color={color || (accent ? GOLD : 'hsl(var(--text-secondary))')} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: accent ? GOLD_LIGHT : 'hsl(var(--text-primary))', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{sub}</div>}
    </div>
  )
}

// ─── Events Modal ────────────────────────────────────────────────────

function EventsModal({ events, selected, onClose, onApply }: {
  events: string[]
  selected: string[]
  onClose: () => void
  onApply: (sel: string[]) => void
}) {
  const [local, setLocal] = useState<string[]>(selected)
  const [search, setSearch] = useState('')

  const filtered = events.filter(e => e.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid hsl(var(--border-default))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'hsl(var(--bg-elevated))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, background: GOLD_DIM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ListFilter size={15} color={GOLD} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Selecionar Eventos</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                {local.length === 0 ? 'Todos os eventos' : `${local.length} selecionado(s)`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 22px 10px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar evento..."
              className="form-input"
              style={{ paddingLeft: 32, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '8px 22px', display: 'flex', gap: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <button
            onClick={() => setLocal(events)}
            style={{ fontSize: 11, fontWeight: 600, color: GOLD, background: GOLD_DIM, border: `1px solid ${GOLD}40`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
          >
            Todos
          </button>
          <button
            onClick={() => setLocal([])}
            style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
          >
            Nenhum
          </button>
        </div>

        {/* List */}
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 12 }}>
              Nenhum evento encontrado
            </div>
          ) : filtered.map(ev => {
            const checked = local.includes(ev)
            return (
              <label key={ev} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                cursor: 'pointer', borderRadius: 4, margin: '2px 0',
                background: checked ? GOLD_DIM : 'transparent',
                transition: 'background 0.15s',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                  border: checked ? `2px solid ${GOLD}` : '2px solid hsl(var(--border-default))',
                  background: checked ? GOLD : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {checked && <Check size={11} color="#000" />}
                </div>
                <input type="checkbox" checked={checked} onChange={e => {
                  if (e.target.checked) setLocal(prev => [...prev, ev])
                  else setLocal(prev => prev.filter(x => x !== ev))
                }} style={{ display: 'none' }} />
                <span style={{ fontSize: 12, color: 'hsl(var(--text-primary))' }}>{ev}</span>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid hsl(var(--border-default))',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: 'hsl(var(--bg-elevated))',
        }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button
            onClick={() => { onApply(local); onClose() }}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 18px', borderRadius: 4, cursor: 'pointer',
              background: GOLD, color: '#000', border: 'none',
            }}
          >
            Aplicar ({local.length === 0 ? 'Todos' : local.length})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

// Accent-insensitive normalization (same logic as reportEngine.ts)
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function DescontosConcedidosPage() {
  const router = useRouter()
  const { mantenedores, cfgGruposAlunos, cfgNiveisEnsino, turmas: turmasCtx, cfgEventos } = useData() as any
  const { currentUser } = useApp()

  // ── Data state ──
  const [rows, setRows] = useState<Row[]>([])
  const [allRows, setAllRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  // ── Filter state ──
  const [filters, setFilters] = useState<Filters>({
    dataInicio: '', dataFim: '',
    grupoAluno: '', nivelEnsino: '', turma: '',
    eventos: [], statusFinanceiro: '',
    unidade: '', busca: '',
    anoLetivo: String(new Date().getFullYear()),
  })
  const [showEventsModal, setShowEventsModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(true)

  // ── UI state ──
  const [sortField, setSortField] = useState<keyof Row>('desconto')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Default: hide less-critical columns so table fits without horizontal scroll
  const [hiddenCols, setHiddenCols] = useState<string[]>(['codigo', 'serie', 'parcela', 'competencia'])
  const [showColPicker, setShowColPicker] = useState(false)
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'area'>('bar')

  // ── Derived options ──
  const grupoOptions = useMemo(() => {
    const items = cfgGruposAlunos || []
    return items.filter((g: any) => g.situacao !== 'inativo')
  }, [cfgGruposAlunos])

  const nivelOptions = useMemo(() => {
    const items = cfgNiveisEnsino || []
    return items.filter((n: any) => n.situacao !== 'inativo')
  }, [cfgNiveisEnsino])

  const turmaOptions = useMemo(() => {
    const items = turmasCtx || []
    return items.filter((t: any) => {
      // Use ano (number field on Turma interface)
      if (filters.anoLetivo && String(t.ano) !== filters.anoLetivo) return false
      // Normalize accents so "COLEGIO IMPACTO EF" matches "Colégio Impacto EF"
      if (filters.unidade && !norm(t.unidade || '').includes(norm(filters.unidade))) return false
      return true
    })
  }, [turmasCtx, filters.anoLetivo, filters.unidade])

  // Auto-clear turma when unidade changes to prevent stale cross-unit combinations
  const prevUnidade = useRef(filters.unidade)
  useEffect(() => {
    if (prevUnidade.current !== filters.unidade) {
      prevUnidade.current = filters.unidade
      setFilters(f => ({ ...f, turma: '' }))
    }
  }, [filters.unidade])

  const eventosDisponiveis = useMemo(() => {
    const fromConfig = (cfgEventos || []).map((e: any) => e.descricao).filter(Boolean)
    const fromRows = [...new Set(allRows.map(r => r.evento).filter(Boolean))]
    return [...new Set([...fromConfig, ...fromRows])].sort()
  }, [cfgEventos, allRows])

  const unidadeOptions = useMemo(() => {
    const m = (mantenedores as any)?.[0]
    if (!m?.unidades) return []
    return m.unidades.map((u: any) => ({ id: u.id, label: u.nomeFantasia || u.razaoSocial }))
  }, [mantenedores])

  // ── Fetch data ──
  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true)
    setError('')
    try {
      const body = {
        source: 'financeiro_descontos',
        filters: {
          dataInicio: filters.dataInicio,
          dataFim: filters.dataFim,
          turma: filters.turma,
          unidade: filters.unidade,
          busca: filters.busca,
          anoLetivo: filters.anoLetivo,
          statusFinanceiro: filters.statusFinanceiro === 'pago' ? 'pago'
            : filters.statusFinanceiro === 'em_aberto' ? 'pendente'
            : filters.statusFinanceiro === 'vencido' ? 'vencido' : '',
        },
        page: 1,
        pageSize: 2000,
        sortField,
        sortDir,
      }
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      let data: Row[] = result.data || []

      // Client-side filters that the engine doesn't natively support
      if (filters.eventos.length > 0) {
        data = data.filter(r => filters.eventos.includes(r.evento))
      }
      if (filters.statusFinanceiro === 'em_aberto') {
        data = data.filter(r => r.statusFinanceiro !== 'pago')
      }
      // nivelEnsino filter via turma -> serie mapping
      if (filters.nivelEnsino) {
        const nivel = nivelOptions.find((n: any) => n.id === filters.nivelEnsino)
        if (nivel) {
          const serieNomes = (nivel.series || []).map((s: any) => s.nome.toLowerCase())
          data = data.filter(r => serieNomes.some((s: string) => (r.serie || '').toLowerCase().includes(s)))
        }
      }

      setAllRows(data)
      setPage(pg)
    } catch (err) {
      setError('Erro ao carregar dados. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }, [filters, sortField, sortDir, nivelOptions])

  // Sort all rows (no side effect)
  const sortedRows = useMemo(() => {
    return [...allRows].sort((a, b) => {
      const va = a[sortField], vb = b[sortField]
      if (va === vb) return 0
      const dir = sortDir === 'desc' ? -1 : 1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'pt-BR') * dir
    })
  }, [allRows, sortField, sortDir])

  // Paginate — proper useEffect, not side-effect inside useMemo
  useEffect(() => {
    const start = (page - 1) * PAGE_SIZE
    setRows(sortedRows.slice(start, start + PAGE_SIZE))
  }, [sortedRows, page])

  const totalPages = Math.ceil(allRows.length / PAGE_SIZE)

  // Reset to page 1 when filters/sort change
  useEffect(() => { fetchData(1); setPage(1) }, [filters, sortField, sortDir])

  // ── Aggregates ──
  const aggregates = useMemo<Aggregates>(() => {
    const total = allRows.reduce((s, r) => s + r.valor, 0)
    const desc = allRows.reduce((s, r) => s + r.desconto, 0)
    const pago = allRows.reduce((s, r) => s + r.valorPago, 0)
    const alunosSet = new Set(allRows.map(r => r.alunoId))
    return {
      totalRegistros: allRows.length,
      totalValorOriginal: total,
      totalDesconto: desc,
      totalPago: pago,
      percDescontoMedio: total > 0 ? (desc / total) * 100 : 0,
      alunosDistintos: alunosSet.size,
    }
  }, [allRows])

  // ── Chart data ──
  const chartData: any[] = useMemo(() => {
    if (chartType === 'area') {
      // group by competencia
      const map: Record<string, { valor: number; desconto: number }> = {}
      allRows.forEach(r => {
        const k = r.competencia || fmtDate(r.vencimento).slice(3) // MM/YYYY
        if (!map[k]) map[k] = { valor: 0, desconto: 0 }
        map[k].valor += r.valor
        map[k].desconto += r.desconto
      })
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([name, v]) => ({
        name, ...v,
        economia: Math.round(v.desconto * 100) / 100,
      }))
    }
    if (chartType === 'pie') {
      // group by evento
      const map: Record<string, number> = {}
      allRows.forEach(r => {
        const k = r.evento || 'Sem evento'
        map[k] = (map[k] || 0) + r.desconto
      })
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({
        name: name.length > 22 ? name.slice(0, 22) + '…' : name,
        value: Math.round(value * 100) / 100,
      }))
    }
    // bar: by turma
    const map: Record<string, { desconto: number; valorOriginal: number }> = {}
    allRows.forEach(r => {
      const k = r.turma || 'Sem turma'
      if (!map[k]) map[k] = { desconto: 0, valorOriginal: 0 }
      map[k].desconto += r.desconto
      map[k].valorOriginal += r.valor
    })
    return Object.entries(map).sort((a, b) => b[1].desconto - a[1].desconto).slice(0, 12).map(([name, v]) => ({
      name: name.length > 14 ? name.slice(0, 14) + '…' : name,
      desconto: Math.round(v.desconto * 100) / 100,
      original: Math.round(v.valorOriginal * 100) / 100,
    }))
  }, [allRows, chartType])

  // ── Columns — widths tuned to avoid horizontal scroll at 1200px+ ──
  const COLUMNS = [
    { key: 'codigo', label: 'Código', width: 72 },
    { key: 'nome', label: 'Aluno', width: undefined },
    { key: 'turma', label: 'Turma', width: 96 },
    { key: 'serie', label: 'Série', width: 64 },
    { key: 'evento', label: 'Evento', width: 130 },
    { key: 'parcela', label: 'Parc.', width: 52, align: 'center' as const },
    { key: 'competencia', label: 'Competência', width: 88, align: 'center' as const },
    { key: 'vencimento', label: 'Vencimento', width: 88, align: 'center' as const, isDate: true },
    { key: 'valor', label: 'Vl. Original', width: 106, align: 'right' as const, isCurrency: true },
    { key: 'desconto', label: 'Desconto', width: 106, align: 'right' as const, isCurrency: true, isAccent: true },
    { key: 'percDesconto', label: 'Desc %', width: 68, align: 'right' as const, isPercent: true },
    { key: 'valorPago', label: 'Vl. Pago', width: 96, align: 'right' as const, isCurrency: true },
    { key: 'statusFinanceiro', label: 'Status', width: 76, align: 'center' as const, isBadge: true },
  ]

  const visibleCols = COLUMNS.filter(c => !hiddenCols.includes(c.key))

  const handleSort = (field: string) => {
    if (sortField === field as keyof Row) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field as keyof Row); setSortDir('desc') }
  }

  // ── Export ──
  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || 'Escola'
  const cnpj = unidade?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || null
  const userName = currentUser?.nome || 'Usuário'

  const handleExportXLSX = () => {
    exportXLSX({
      title: 'Descontos Concedidos',
      data: allRows as unknown as Record<string, unknown>[],
      columns: COLUMNS.filter(c => !hiddenCols.includes(c.key)).map(c => ({
        key: c.key, label: c.label,
        type: (c.isCurrency ? 'currency' : c.isPercent ? 'percent' : c.isDate ? 'date' : c.isBadge ? 'badge' : 'text') as any,
        align: (c.align || 'left') as any,
        sortable: true,
      })),
      filters: {},
      userName,
      totals: {
        valor: aggregates.totalValorOriginal,
        desconto: aggregates.totalDesconto,
        valorPago: aggregates.totalPago,
      },
    })
  }

  const handleExportPDF = () => {
    exportPDF({
      title: 'Descontos Concedidos',
      subtitle: `Período: ${filters.dataInicio ? fmtDate(filters.dataInicio) : '—'} a ${filters.dataFim ? fmtDate(filters.dataFim) : '—'}`,
      data: allRows as unknown as Record<string, unknown>[],
      columns: COLUMNS.filter(c => !hiddenCols.includes(c.key)).map(c => ({
        key: c.key, label: c.label,
        type: (c.isCurrency ? 'currency' : c.isPercent ? 'percent' : c.isDate ? 'date' : c.isBadge ? 'badge' : 'text') as any,
        align: (c.align || 'left') as any,
        sortable: true,
      })),
      filters: {},
      nomeEscola, cnpj, logo, userName,
      totals: {
        valor: aggregates.totalValorOriginal,
        desconto: aggregates.totalDesconto,
        valorPago: aggregates.totalPago,
      },
    })
  }

  // ── Badge colors ──
  const statusColor: Record<string, { bg: string; text: string }> = {
    pago: { bg: '#10b98120', text: '#059669' },
    pendente: { bg: '#f59e0b20', text: '#d97706' },
    vencido: { bg: '#ef444420', text: '#dc2626' },
    cancelado: { bg: '#6b728020', text: '#6b7280' },
    renegociado: { bg: '#3b82f620', text: '#2563eb' },
  }

  const tooltipStyle = {
    background: 'hsl(var(--bg-elevated))',
    border: '1px solid hsl(var(--border-default))',
    borderRadius: 6,
    fontSize: 11,
    color: 'hsl(var(--text-primary))',
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ═══ HEADER ═════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, marginBottom: 22, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/relatorios')}
            className="btn btn-secondary btn-icon"
            style={{ flexShrink: 0 }}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `linear-gradient(135deg, ${GOLD_DARK}30, ${GOLD}20)`,
                border: `1px solid ${GOLD}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Tag size={18} color={GOLD} />
              </div>
              <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>
                Descontos Concedidos
              </h1>
            </div>
            <p className="page-subtitle" style={{ marginTop: 3 }}>
              Análise de descontos e bolsas aplicados — visão estratégica financeira
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setShowFilterPanel(p => !p)}
            className={`btn btn-sm ${showFilterPanel ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: 5 }}
          >
            <SlidersHorizontal size={12} />
            Filtros
          </button>
          <button onClick={() => fetchData(1)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            <RefreshCw size={12} />
            Atualizar
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColPicker(p => !p)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 5 }}
            >
              <Eye size={12} />
              Colunas
            </button>
            {showColPicker && (
              <div className="dropdown-menu" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                zIndex: 50, minWidth: 200, maxHeight: 300, overflowY: 'auto',
              }}>
                <div className="form-label" style={{ padding: '6px 10px 4px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
                  Colunas Visíveis
                </div>
                {COLUMNS.map(c => (
                  <label key={c.key} className="dropdown-item" style={{ cursor: 'pointer', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!hiddenCols.includes(c.key)}
                      onChange={e => {
                        if (!e.target.checked) setHiddenCols(p => [...p, c.key])
                        else setHiddenCols(p => p.filter(k => k !== c.key))
                      }}
                    />
                    <span style={{ fontSize: 12 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleExportPDF} className="btn btn-danger btn-sm" style={{ gap: 5 }}>
            <PrinterIcon size={12} />
            PDF
          </button>
          <button
            onClick={handleExportXLSX}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
              background: '#10b98115', color: '#059669', border: '1px solid #10b98130',
            }}
          >
            <FileSpreadsheet size={12} />
            Excel
          </button>
        </div>
      </div>

      {/* ═══ FILTER PANEL ═══════════════════════════════════════════ */}
      {showFilterPanel && (
        <div style={{
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-default))',
          borderRadius: 8,
          padding: '18px 22px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Filter size={13} color={GOLD} />
            <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Filtros do Relatório
            </span>
            {/* active count */}
            {Object.entries(filters).filter(([k, v]) => k !== 'anoLetivo' && (Array.isArray(v) ? v.length > 0 : Boolean(v))).length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                borderRadius: 10, background: GOLD_DIM, color: GOLD,
              }}>
                {Object.entries(filters).filter(([k, v]) => k !== 'anoLetivo' && (Array.isArray(v) ? v.length > 0 : Boolean(v))).length} ativo(s)
              </span>
            )}
            <button
              onClick={() => setFilters({ dataInicio: '', dataFim: '', grupoAluno: '', nivelEnsino: '', turma: '', eventos: [], statusFinanceiro: '', unidade: '', busca: '', anoLetivo: String(new Date().getFullYear()) })}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={11} /> Limpar tudo
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {/* Data Inicial */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={e => setFilters(f => ({ ...f, dataInicio: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              />
            </div>

            {/* Data Final */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                Data Final
              </label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={e => setFilters(f => ({ ...f, dataFim: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              />
            </div>

            {/* Grupo de Alunos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Users size={10} style={{ display: 'inline', marginRight: 4 }} />
                Grupo de Alunos
              </label>
              <select
                value={filters.grupoAluno}
                onChange={e => setFilters(f => ({ ...f, grupoAluno: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                <option value="">Todos os grupos</option>
                {grupoOptions.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </div>

            {/* Nível de Ensino */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <GraduationCap size={10} style={{ display: 'inline', marginRight: 4 }} />
                Nível de Ensino
              </label>
              <select
                value={filters.nivelEnsino}
                onChange={e => setFilters(f => ({ ...f, nivelEnsino: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                <option value="">Todos os níveis</option>
                {nivelOptions.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.nome}</option>
                ))}
              </select>
            </div>

            {/* Turma */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <BookOpen size={10} style={{ display: 'inline', marginRight: 4 }} />
                Turma
              </label>
              <select
                value={filters.turma}
                onChange={e => setFilters(f => ({ ...f, turma: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                <option value="">Todas as turmas</option>
                {turmaOptions.map((t: any) => (
                  <option key={t.id} value={t.nome}>{t.nome}</option>
                ))}
              </select>
            </div>

            {/* Eventos — modal trigger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Layers size={10} style={{ display: 'inline', marginRight: 4 }} />
                Eventos
              </label>
              <button
                onClick={() => setShowEventsModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', fontSize: 11,
                  background: filters.eventos.length > 0 ? GOLD_DIM : 'hsl(var(--bg-input))',
                  border: `1px solid ${filters.eventos.length > 0 ? GOLD + '60' : 'hsl(var(--border-default))'}`,
                  borderRadius: 4, cursor: 'pointer', color: filters.eventos.length > 0 ? GOLD : 'hsl(var(--text-secondary))',
                  transition: 'all 0.2s',
                }}
              >
                <span>
                  {filters.eventos.length === 0
                    ? 'Todos os eventos'
                    : `${filters.eventos.length} evento(s) selecionado(s)`}
                </span>
                <ListFilter size={12} />
              </button>
            </div>

            {/* Status Financeiro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Filter size={10} style={{ display: 'inline', marginRight: 4 }} />
                Status Financeiro
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { value: '', label: 'Todos' },
                  { value: 'pago', label: 'Pago' },
                  { value: 'em_aberto', label: 'Em Aberto' },
                  { value: 'vencido', label: 'Vencido' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters(f => ({ ...f, statusFinanceiro: opt.value }))}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 4px',
                      borderRadius: 4, cursor: 'pointer', border: '1px solid',
                      borderColor: filters.statusFinanceiro === opt.value ? GOLD + '60' : 'hsl(var(--border-default))',
                      background: filters.statusFinanceiro === opt.value ? GOLD_DIM : 'hsl(var(--bg-input))',
                      color: filters.statusFinanceiro === opt.value ? GOLD : 'hsl(var(--text-secondary))',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Unidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
                Unidade
              </label>
              <select
                value={filters.unidade}
                onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                <option value="">Todas as unidades</option>
                {unidadeOptions.map((u: any) => (
                  <option key={u.id} value={u.label}>{u.label}</option>
                ))}
              </select>
            </div>

            {/* Busca */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>
                <Search size={10} style={{ display: 'inline', marginRight: 4 }} />
                Busca
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  value={filters.busca}
                  onChange={e => setFilters(f => ({ ...f, busca: e.target.value }))}
                  placeholder="Nome do aluno, código..."
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: 11 }}
                />
              </div>
            </div>

            {/* Ano Letivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>Ano Letivo</label>
              <select
                value={filters.anoLetivo}
                onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))}
                className="form-input"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                {['2026', '2025', '2024', '2023'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ═══ KPI CARDS ══════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        <KpiCard
          icon={Tag}
          label="Total Descontado"
          value={`R$ ${fmt(aggregates.totalDesconto)}`}
          sub={`${aggregates.percDescontoMedio.toFixed(1)}% do valor original`}
          accent
        />
        <KpiCard
          icon={TrendingDown}
          label="Valor Original"
          value={`R$ ${fmt(aggregates.totalValorOriginal)}`}
          sub="Base para cálculo dos descontos"
          color="#3b82f6"
        />
        <KpiCard
          icon={Check}
          label="Total Recebido"
          value={`R$ ${fmt(aggregates.totalPago)}`}
          sub="Após aplicação dos descontos"
          color="#10b981"
        />
        <KpiCard
          icon={Users}
          label="Alunos Beneficiados"
          value={aggregates.alunosDistintos.toLocaleString('pt-BR')}
          sub={`${aggregates.totalRegistros} parcelas com desconto`}
          color="#f59e0b"
        />
        <KpiCard
          icon={Percent}
          label="Desc. Médio"
          value={`${aggregates.percDescontoMedio.toFixed(1)}%`}
          sub="Média ponderada sobre o total"
          color="#8b5cf6"
        />
      </div>

      {/* ═══ CHART ══════════════════════════════════════════════════ */}
      {allRows.length > 0 && (
        <div style={{
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-default))',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={13} color={GOLD} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--text-muted))' }}>
                {chartType === 'bar' ? 'Descontos por Turma' : chartType === 'pie' ? 'Descontos por Evento' : 'Evolução Mensal'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['bar', 'pie', 'area'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${chartType === t ? GOLD + '60' : 'hsl(var(--border-default))'}`,
                    background: chartType === t ? GOLD_DIM : 'transparent',
                    color: chartType === t ? GOLD : 'hsl(var(--text-muted))',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'bar' ? 'Por Turma' : t === 'pie' ? 'Por Evento' : 'Mensal'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90} innerRadius={42}
                  label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  style={{ fontSize: 10 }}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={[GOLD, '#F0A020', '#D4A017', '#C08010', '#A06000', '#E0B030', '#F0C020', '#D09010', '#B07000', '#906000'][i % 10]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `R$ ${fmt(Number(v))}`} />
              </PieChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `R$ ${fmt(Number(v))}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="valor" name="Valor Original" stroke="#3b82f6" fill="rgba(59,130,246,0.08)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="desconto" name="Desconto" stroke={GOLD} fill={GOLD_DIM} strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `R$ ${fmt(Number(v))}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="original" name="Valor Original" fill="rgba(59,130,246,0.3)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="desconto" name="Desconto" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ TABLE ══════════════════════════════════════════════════ */}
      <div style={{
        background: 'hsl(var(--bg-card))',
        border: '1px solid hsl(var(--border-default))',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {/* Table header bar */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid hsl(var(--border-default))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'hsl(var(--bg-elevated))',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: 4,
              background: GOLD_DIM, color: GOLD, fontSize: 11, fontWeight: 800,
            }}>
              {allRows.length}
            </span>
            {allRows.length === 1 ? 'parcela com desconto' : 'parcelas com desconto'}
            {allRows.length > 0 && (
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                · {aggregates.alunosDistintos} aluno(s)
              </span>
            )}
          </div>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
              Carregando...
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
            background: '#ef444410', borderBottom: '1px solid #ef444430',
          }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: GOLD, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Buscando dados financeiros...</div>
          </div>
        ) : rows.length === 0 && !loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Tag size={36} style={{ color: GOLD, opacity: 0.3, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 6 }}>
              Nenhum desconto encontrado
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Ajuste os filtros para ampliar a busca
            </div>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {visibleCols.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        textAlign: col.align || 'left',
                        width: col.width || 'auto',
                        padding: '9px 10px',
                        cursor: 'pointer', userSelect: 'none',
                        color: sortField === col.key ? GOLD : undefined,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        {sortField === col.key && (
                          sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.alunoId}-${row.parcela}-${i}`} style={{
                    background: row.desconto > row.valor * 0.5 ? `${GOLD}06` : undefined,
                  }}>
                    {visibleCols.map(col => {
                      const val = (row as any)[col.key]
                      return (
                    <td key={col.key} style={{ textAlign: col.align || 'left', padding: '10px 10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {col.isCurrency ? (
                            <span
                              className="num"
                              style={col.isAccent ? { color: GOLD_LIGHT, fontWeight: 700 } : undefined}
                            >
                              R$ {fmt(Number(val) || 0)}
                            </span>
                          ) : col.isPercent ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              background: Number(val) >= 50 ? '#ef444415' : Number(val) >= 20 ? `${GOLD}20` : '#10b98115',
                              color: Number(val) >= 50 ? '#ef4444' : Number(val) >= 20 ? GOLD : '#10b981',
                            }}>
                              {Number(val).toFixed(1)}%
                            </span>
                          ) : col.isDate ? (
                            <span>{fmtDate(val)}</span>
                          ) : col.isBadge ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                              background: statusColor[val]?.bg || '#6b728020',
                              color: statusColor[val]?.text || '#6b7280',
                              display: 'inline-block',
                            }}>
                              {String(val || '—')}
                            </span>
                          ) : (
                            <span>{val || '—'}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Totals row */}
                {rows.length > 0 && (
                  <tr style={{
                    background: `linear-gradient(90deg, ${GOLD}08, transparent)`,
                    borderTop: `2px solid ${GOLD}30`,
                    fontWeight: 800,
                  }}>
                    {visibleCols.map((col, i) => (
                      <td key={col.key} style={{ textAlign: col.align || 'left', padding: '10px 12px' }}>
                        {i === 0 ? (
                          <span style={{ fontSize: 11, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            TOTAL
                          </span>
                        ) : col.key === 'valor' ? (
                          <span className="num" style={{ color: 'hsl(var(--text-primary))' }}>
                            R$ {fmt(aggregates.totalValorOriginal)}
                          </span>
                        ) : col.key === 'desconto' ? (
                          <span className="num" style={{ color: GOLD_LIGHT, fontWeight: 800 }}>
                            R$ {fmt(aggregates.totalDesconto)}
                          </span>
                        ) : col.key === 'valorPago' ? (
                          <span className="num" style={{ color: '#10b981' }}>
                            R$ {fmt(aggregates.totalPago)}
                          </span>
                        ) : col.key === 'percDesconto' ? (
                          <span style={{ fontSize: 11, fontWeight: 800, color: GOLD }}>
                            {aggregates.percDescontoMedio.toFixed(1)}%
                          </span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid hsl(var(--border-default))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'hsl(var(--bg-elevated))',
          }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="btn btn-secondary btn-icon"
              style={{ opacity: page <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Página <strong style={{ color: 'hsl(var(--text-primary))' }}>{page}</strong> de {totalPages}
              <span style={{ marginLeft: 10, color: 'hsl(var(--text-disabled))' }}>
                ({allRows.length.toLocaleString('pt-BR')} registros)
              </span>
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="btn btn-secondary btn-icon"
              style={{ opacity: page >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Events modal */}
      {showEventsModal && (
        <EventsModal
          events={eventosDisponiveis}
          selected={filters.eventos}
          onClose={() => setShowEventsModal(false)}
          onApply={sel => setFilters(f => ({ ...f, eventos: sel }))}
        />
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
