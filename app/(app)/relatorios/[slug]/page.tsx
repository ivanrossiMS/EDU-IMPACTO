'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, FileSpreadsheet, Filter, Columns3, ChevronDown,
  ChevronUp, Loader2, Search, Star, RefreshCw, BarChart3,
  ChevronLeft, ChevronRight as ChevRight, X, Check
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getReportBySlug, type ReportDefinition, type ColumnDef, type FilterDef } from '@/lib/reports/reportDefinitions'
import { exportPDF } from '@/lib/reports/exportPDF'
import { exportXLSX } from '@/lib/reports/exportXLSX'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/** Converte qualquer string de data (YYYY-MM-DD, YYYY-MM-DDTHH..., DD/MM/YYYY) para DD/MM/YYYY */
function fmtIso(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  if (s.includes('/')) return s.length >= 10 ? s.slice(0, 10) : s // já está em DD/MM/YYYY
  const clean = s.length > 10 ? s.slice(0, 10) : s // pega só YYYY-MM-DD
  const [y, m, d] = clean.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

// ─── Filter Bar ──────────────────────────────────────────

function FilterBar({ filters, values, onChange, onClear }: {
  filters: FilterDef[]; values: Record<string, string>; onChange: (key: string, val: string) => void; onClear: () => void
}) {
  if (filters.length === 0) return null
  return (
    <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
        <Filter size={12} style={{ color: '#3b82f6' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtros</span>
      </div>
      {filters.map(f => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label className="form-label" style={{ margin: 0 }}>{f.label}</label>
          {f.type === 'select' || f.type === 'multi-select' ? (
            <select value={values[f.key] || f.defaultValue || ''} onChange={e => onChange(f.key, e.target.value)} className="form-input" style={{ padding: '5px 8px', fontSize: 11, minWidth: 100 }}>
              {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="form-input"
              style={{ padding: '5px 8px', fontSize: 11, width: f.type === 'date' ? 130 : 120 }}
            />
          )}
        </div>
      ))}
      <button onClick={onClear} className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-end', gap: 4 }}>
        <X size={10} /> Limpar
      </button>
    </div>
  )
}

// ─── Aggregate Bar ───────────────────────────────────────

function AggregatesBar({ aggregates, total }: { aggregates: Record<string, number>; total: number }) {
  if (!total && !Object.keys(aggregates).length) return null
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <div className="badge badge-primary" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11 }}>
        <span style={{ fontWeight: 500, marginRight: 4 }}>Registros</span>
        <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>{total.toLocaleString('pt-BR')}</strong>
      </div>
      {aggregates.valor ? (
        <div className="badge badge-warning" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11 }}>
          <span style={{ fontWeight: 500, marginRight: 4 }}>Valor</span>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>R$ {fmt(aggregates.valor)}</strong>
        </div>
      ) : null}
      {aggregates.valorPago ? (
        <div className="badge badge-success" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11 }}>
          <span style={{ fontWeight: 500, marginRight: 4 }}>Pago</span>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>R$ {fmt(aggregates.valorPago)}</strong>
        </div>
      ) : null}
      {aggregates.saldo ? (
        <div className="badge badge-danger" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11 }}>
          <span style={{ fontWeight: 500, marginRight: 4 }}>Saldo Devedor</span>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>R$ {fmt(aggregates.saldo)}</strong>
        </div>
      ) : null}
      {aggregates.desconto ? (
        <div className="badge badge-purple" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 11 }}>
          <span style={{ fontWeight: 500, marginRight: 4 }}>Descontos</span>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>R$ {fmt(aggregates.desconto)}</strong>
        </div>
      ) : null}
    </div>
  )
}

// ─── Data Table ──────────────────────────────────────────

function DataTable({ data, columns, sortField, sortDir, onSort, loading }: {
  data: Record<string, unknown>[]; columns: ColumnDef[]; sortField: string; sortDir: string; onSort: (f: string) => void; loading: boolean
}) {
  function renderCell(value: unknown, col: ColumnDef): React.ReactNode {
    if (value === null || value === undefined || value === '') return <span style={{ color: 'hsl(var(--text-disabled))' }}>—</span>
    if (col.type === 'currency') return <span className="num">R$ {fmt(Number(value))}</span>
    if (col.type === 'percent') return <span>{Number(value).toFixed(1)}%</span>
    if (col.type === 'date') return <span>{fmtIso(value)}</span>
    if (col.type === 'badge') {
      const sv = String(value)
      const color = col.badgeColors?.[sv] || '#94a3b8'
      return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${color}20`, color, display: 'inline-block' }}>{sv}</span>
    }
    if (col.type === 'boolean') return value ? <Check size={13} color="#10b981" /> : <X size={13} color="#ef4444" />
    return <span>{String(value)}</span>
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={26} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6' }} />
    </div>
  )

  if (data.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'hsl(var(--text-muted))' }}>
      <Search size={34} style={{ opacity: 0.25, marginBottom: 10 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhum registro encontrado</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>Ajuste os filtros para ampliar a busca</div>
    </div>
  )

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSort(col.key)}
                style={{
                  textAlign: col.align as any || 'left',
                  color: sortField === col.key ? '#3b82f6' : undefined,
                  cursor: col.sortable ? 'pointer' : 'default',
                  width: col.width || 'auto', minWidth: col.width || 60,
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {col.sortable && sortField === col.key && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align as any || 'left' }}>
                  {renderCell(row[col.key], col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Chart Panel ─────────────────────────────────────────

function ChartPanel({ report, data }: { report: ReportDefinition; data: Record<string, unknown>[] }) {
  const chartData = useMemo(() => {
    const key = report.chartCategoryKey || 'nome'
    const valKey = report.chartDataKey || 'valor'
    if (valKey === 'count') {
      const counts: Record<string, number> = {}
      data.forEach(r => { const k = String(r[key] || 'N/A'); counts[k] = (counts[k] || 0) + 1 })
      return Object.entries(counts).slice(0, 12).map(([name, value]) => ({ name, value }))
    }
    const grouped: Record<string, number> = {}
    data.forEach(r => { const k = String(r[key] || 'N/A'); grouped[k] = (grouped[k] || 0) + (Number(r[valKey]) || 0) })
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({
      name: name.length > 20 ? name.slice(0, 20) + '…' : name,
      value: Math.round(value * 100) / 100,
    }))
  }, [data, report])

  if (report.chartType === 'none' || !chartData.length) return null

  const tooltipStyle = { background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--text-primary))' }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <BarChart3 size={12} /> Visualização
      </div>
      <ResponsiveContainer width="100%" height={240}>
        {report.chartType === 'pie' ? (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={46}
              label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} style={{ fontSize: 10 }}>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        ) : report.chartType === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
          </LineChart>
        ) : report.chartType === 'area' ? (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="rgba(59,130,246,0.12)" strokeWidth={2} />
          </AreaChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} angle={-15} textAnchor="end" height={55} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-muted))' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function ReportViewPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const report = getReportBySlug(slug)
  const { mantenedores } = useData()
  const { currentUser } = useApp()

  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [allData, setAllData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [loading, setLoading] = useState(true)
  const [aggregates, setAggregates] = useState<Record<string, number>>({})
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [sortField, setSortField] = useState(report?.defaultSort.field || 'nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(report?.defaultSort.dir || 'asc')
  const [showChart, setShowChart] = useState(true)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(report?.defaultColumns || [])
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    if (!report) return
    const defaults: Record<string, string> = {}
    report.availableFilters.forEach(f => { if (f.defaultValue) defaults[f.key] = f.defaultValue })
    setFilterValues(defaults)
    setVisibleColumns(report.defaultColumns)
    setSortField(report.defaultSort.field)
    setSortDir(report.defaultSort.dir)
  }, [slug])

  const fetchData = useCallback(async (pg = page) => {
    if (!report) return
    setLoading(true)
    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: report.source, filters: filterValues, page: pg, pageSize, sortField, sortDir }),
      })
      const result = await res.json()
      setData(result.data || [])
      setTotal(result.total || 0)
      setAggregates(result.aggregates || {})
      setPage(pg)

      if (result.total > pageSize && report.chartType !== 'none') {
        fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: report.source, filters: filterValues, page: 1, pageSize: 500, sortField, sortDir }),
        }).then(r => r.json()).then(r => setAllData(r.data || [])).catch(() => {})
      } else {
        setAllData(result.data || [])
      }
    } catch (err) {
      console.error('Report fetch error:', err)
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [report, filterValues, pageSize, sortField, sortDir])

  useEffect(() => { fetchData(1) }, [filterValues, sortField, sortDir, slug])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeColumns = useMemo(() => {
    if (!report) return []
    return report.availableColumns.filter(c => visibleColumns.includes(c.key))
  }, [report, visibleColumns])

  const totalPages = Math.ceil(total / pageSize)

  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const userName = currentUser?.nome || 'Usuário'

  const getExportData = () => {
    const exportData = allData.length > data.length ? allData : data
    const totals: Record<string, number> = {}
    activeColumns.forEach(c => { if (c.aggregate && aggregates[c.key]) totals[c.key] = aggregates[c.key] })
    const filterDescriptions: Record<string, string> = {}
    Object.entries(filterValues).forEach(([k, v]) => {
      if (v) { const fd = report?.availableFilters.find(f => f.key === k); filterDescriptions[fd?.label || k] = v }
    })
    return { exportData, totals, filterDescriptions }
  }

  const handleExportPDF = () => {
    if (!report) return
    const { exportData, totals, filterDescriptions } = getExportData()
    exportPDF({ title: report.name, subtitle: report.description, data: exportData, columns: activeColumns, filters: filterDescriptions, nomeEscola, cnpj, logo, userName, totals })
  }

  const handleExportXLSX = () => {
    if (!report) return
    const { exportData, totals, filterDescriptions } = getExportData()
    exportXLSX({ title: report.name, data: exportData, columns: activeColumns, filters: filterDescriptions, userName, totals })
  }

  const handleSaveReport = async () => {
    if (!saveName.trim() || !report) return
    try {
      await fetch('/api/relatorios/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.id || 'anon',
          nome: saveName, tipo_relatorio: report.category, subtipo: report.slug,
          configuracao: { columns: visibleColumns, sortField, sortDir }, filtros: filterValues, favorito: true,
        }),
      })
      setSaveModalOpen(false)
      setSaveName('')
    } catch {}
  }

  if (!report) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <div className="page-title" style={{ fontSize: 18 }}>Relatório não encontrado</div>
      <button onClick={() => router.push('/relatorios')} className="btn btn-primary" style={{ marginTop: 16 }}>← Voltar</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 60px' }}>

      {/* ─── HEADER ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon">
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{report.icon}</span> {report.name}
            </h1>
            <p className="page-subtitle" style={{ marginTop: 2 }}>{report.description}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => fetchData(page)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            <RefreshCw size={11} /> Atualizar
          </button>
          {report.chartType !== 'none' && (
            <button onClick={() => setShowChart(!showChart)} className={`btn btn-sm ${showChart ? 'btn-primary' : 'btn-secondary'}`} style={{ gap: 5, opacity: showChart ? 1 : 0.8 }}>
              <BarChart3 size={11} /> Gráfico
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
              <Columns3 size={11} /> Colunas
            </button>
            {showColumnPicker && (
              <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50, minWidth: 200, maxHeight: 280, overflowY: 'auto' }}>
                <div className="form-label" style={{ padding: '4px 6px', margin: 0 }}>Colunas Visíveis</div>
                {report.availableColumns.map(c => (
                  <label key={c.key} className="dropdown-item" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={e => {
                      if (e.target.checked) setVisibleColumns(prev => [...prev, c.key])
                      else setVisibleColumns(prev => prev.filter(k => k !== c.key))
                    }} />
                    <span style={{ fontSize: 12 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setSaveModalOpen(true)} className="btn btn-sm" style={{ gap: 5, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Star size={11} /> Salvar
          </button>
          <button onClick={handleExportPDF} className="btn btn-danger btn-sm" style={{ gap: 5 }}>
            <FileText size={11} /> PDF
          </button>
          <button onClick={handleExportXLSX} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
            <FileSpreadsheet size={11} /> Excel
          </button>
        </div>
      </div>

      {/* Filters, Aggregates, Chart, Table */}
      <FilterBar filters={report.availableFilters} values={filterValues} onChange={(k, v) => setFilterValues(prev => ({ ...prev, [k]: v }))} onClear={() => {
        const defaults: Record<string, string> = {}
        report.availableFilters.forEach(f => { if (f.defaultValue) defaults[f.key] = f.defaultValue })
        setFilterValues(defaults)
      }} />

      <AggregatesBar aggregates={aggregates} total={total} />

      {showChart && <ChartPanel report={report} data={allData.length > 0 ? allData : data} />}

      <DataTable data={data} columns={activeColumns} sortField={sortField} sortDir={sortDir} onSort={handleSort} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button disabled={page <= 1} onClick={() => fetchData(page - 1)} className="btn btn-secondary btn-icon" style={{ opacity: page <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            Página <strong style={{ color: 'hsl(var(--text-primary))' }}>{page}</strong> de {totalPages}
            <span style={{ marginLeft: 8, color: 'hsl(var(--text-disabled))' }}>({total.toLocaleString('pt-BR')} registros)</span>
          </span>
          <button disabled={page >= totalPages} onClick={() => fetchData(page + 1)} className="btn btn-secondary btn-icon" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>
            <ChevRight size={13} />
          </button>
        </div>
      )}

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="modal-overlay" onClick={() => setSaveModalOpen(false)}>
          <div className="modal" style={{ padding: 28, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={15} color="#f59e0b" /> Salvar Relatório
            </div>
            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Nome do relatório salvo..." className="form-input" style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSaveModalOpen(false)} className="btn btn-ghost btn-sm">Cancelar</button>
              <button onClick={handleSaveReport} disabled={!saveName.trim()} className="btn btn-primary btn-sm" style={{ opacity: saveName.trim() ? 1 : 0.5 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
