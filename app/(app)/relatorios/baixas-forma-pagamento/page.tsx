'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, Download, FileSpreadsheet, Filter, Search, RefreshCw,
  Loader2, X, Check, ChevronDown, ChevronUp, BookOpen, Layers,
  CreditCard, BarChart3, TrendingUp, Banknote, Wallet, Building2,
  ArrowUpDown, LayoutList, Table2, PrinterIcon
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { useData } from '@/lib/dataContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#0ea5e9'
const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

const METODOS_PAGAMENTO = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Transferência', 'Cheque', 'Outros']

const NIVEIS_ENSINO = [
  'Educação Infantil', 'Ensino Fundamental I', 'Ensino Fundamental II',
  'Ensino Médio', 'EJA', 'Técnico', 'Outros'
]

const SORT_OPTIONS = [
  { value: 'dataPagamento_desc', label: 'Data Pagamento (mais novo)' },
  { value: 'dataPagamento_asc', label: 'Data Pagamento (mais antigo)' },
  { value: 'formaPagamento_asc', label: 'Forma de Pagamento (A→Z)' },
  { value: 'valorPago_desc', label: 'Valor Pago (maior)' },
  { value: 'valorPago_asc', label: 'Valor Pago (menor)' },
  { value: 'nome_asc', label: 'Aluno (A→Z)' },
  { value: 'turma_asc', label: 'Turma (A→Z)' },
]

const yrOptions = ['2026', '2025', '2024', '2023']

// ─── Types ────────────────────────────────────────────────────────────────────

interface Baixa {
  id: string
  nome: string
  turma: string
  serie?: string
  evento: string
  parcela: number
  competencia: string
  dataPagamento: string
  formaPagamento: string
  valor: number
  desconto: number
  juros: number
  multa: number
  valorPago: number
  unidade?: string
  nivelEnsino?: string
  responsavelFinanceiro?: string
}

interface SelectItem { id: string; label: string; sub?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCur = (v: number) => 'R$\u00a0' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s?: string | null) => {
  if (!s) return '—'
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const metodoPagtoIcon: Record<string, React.ReactNode> = {
  PIX: <span style={{ fontSize: 10, fontWeight: 900, color: '#10b981' }}>PIX</span>,
  Dinheiro: <Banknote size={12} />,
  'Cartão Crédito': <CreditCard size={12} />,
  'Cartão Débito': <CreditCard size={12} />,
  Boleto: <FileSpreadsheet size={12} />,
  Transferência: <ArrowUpDown size={12} />,
}

const metodoPagtoColor: Record<string, string> = {
  PIX: '#10b981',
  Dinheiro: '#0ea5e9',
  'Cartão Crédito': '#8b5cf6',
  'Cartão Débito': '#6366f1',
  Boleto: '#f59e0b',
  Transferência: '#06b6d4',
  Cheque: '#ec4899',
  Outros: '#94a3b8',
}

// ─── SelectionModal ───────────────────────────────────────────────────────────

function SelectionModal({ title, icon, items, selected, onClose, onApply, searchPlaceholder = 'Buscar...', hasAllOption = false, extraContent }: {
  title: string; icon: React.ReactNode; items: SelectItem[]; selected: string[]
  onClose: () => void; onApply: (s: string[]) => void; searchPlaceholder?: string; hasAllOption?: boolean; extraContent?: React.ReactNode
}) {
  const [search, setSearch] = useState('')
  const [local, setLocal] = useState<string[]>(selected)

  const filtered = useMemo(() =>
    items.filter(i => norm(i.label).includes(norm(search)) || norm(i.sub || '').includes(norm(search))),
    [items, search]
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: ACCENT }}>{icon}</div>
          <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={18} /></button>
        </div>
        {extraContent && <div style={{ padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>{extraContent}</div>}
        <div style={{ padding: '12px 20px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} className="form-input" placeholder={searchPlaceholder} style={{ paddingLeft: 32, fontSize: 12 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {hasAllOption && (
            <div onClick={() => setLocal([])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${local.length === 0 ? ACCENT : 'hsl(var(--border-default))'}`, background: local.length === 0 ? ACCENT : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {local.length === 0 && <Check size={11} color="#fff" />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: local.length === 0 ? ACCENT : 'hsl(var(--text-secondary))' }}>Todos</div>
            </div>
          )}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'hsl(var(--text-muted))', fontSize: 12 }}>Nenhum resultado encontrado</div>}
          {filtered.map(item => {
            const sel = local.includes(item.id)
            return (
              <div key={item.id} onClick={() => setLocal(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${sel ? ACCENT : 'hsl(var(--border-default))'}`, background: sel ? ACCENT : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {sel && <Check size={11} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{item.label}</div>
                  {item.sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.sub}</div>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setLocal([])} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Limpar seleção</button>
          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{local.length === 0 ? 'Todos' : `${local.length} selecionado(s)`}</span>
          <button onClick={() => { onApply(local); onClose() }} className="btn btn-primary btn-sm" style={{ background: ACCENT, borderColor: ACCENT }}>
            <Check size={12} /> Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon, trend }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode; trend?: number }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 160 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1.1, fontFamily: 'monospace' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Badge Pagamento ──────────────────────────────────────────────────────────

function BadgePagto({ method }: { method: string }) {
  const color = metodoPagtoColor[method] || '#94a3b8'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, background: `${color}18`, color, fontSize: 10, fontWeight: 700 }}>
      {metodoPagtoIcon[method] || <Wallet size={10} />} {method}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BaixasFormaPagamentoPage() {
  const router = useRouter()
  const data = useData()
  const mantenedores: any[] = (data as any).mantenedores || []
  const schoolLogo: string = mantenedores[0]?.logo || mantenedores[0]?.cabecalhoLogo || ''
  const schoolName: string = mantenedores[0]?.razaoSocial || mantenedores[0]?.nome || 'EDU IMPACTO'

  // ─── Filters state ────────────────────────────────────────────────────────
  const year = new Date().getFullYear()
  const [dataInicio, setDataInicio] = useState(`${year}-01-01`)
  const [dataFim, setDataFim] = useState(`${year}-12-31`)
  const [anoLetivo, setAnoLetivo] = useState(String(year))
  const [metodosSelecionados, setMetodosSelecionados] = useState<string[]>([])
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([])
  const [eventosSelecionados, setEventosSelecionados] = useState<string[]>([])
  const [nivelEnsino, setNivelEnsino] = useState('')
  const [unidade, setUnidade] = useState('')
  const [sortOption, setSortOption] = useState('dataPagamento_desc')
  const [modo, setModo] = useState<'resumo' | 'completo'>('completo')
  const [turmaModalAno, setTurmaModalAno] = useState(String(year))

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [baixas, setBaixas] = useState<Baixa[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showTurmasModal, setShowTurmasModal] = useState(false)
  const [showEventosModal, setShowEventosModal] = useState(false)
  const [showCharts, setShowCharts] = useState(true)

  const [dynamicTurmas, setDynamicTurmas] = useState<string[]>([])
  const [dynamicEventos, setDynamicEventos] = useState<string[]>([])

  // ─── DataContext Options ────────────────────────────────────────────────────
  const unidadeOptions = useMemo(() => {
    return (mantenedores[0]?.unidades || []).map((u: any) => ({
      id: u.nomeFantasia || u.razaoSocial || 'Unidade Padrão',
      label: u.nomeFantasia || u.razaoSocial || 'Unidade Padrão'
    }))
  }, [mantenedores])

  const ctxTurmas: any[] = (data as any).turmas || []
  const turmaOptions: SelectItem[] = useMemo(() => {
    const list = (Array.isArray(ctxTurmas) ? ctxTurmas : [])
      .filter((t: any) => !turmaModalAno || String(t.ano || '') === turmaModalAno)
      .map((t: any) => ({ id: t.nome || t.id, label: t.nome || t.id, sub: t.serie || t.turno || '' }))
    
    // add dynamic ones seen in results if they match the selected year
    dynamicTurmas.forEach(dt => {
      if (!list.find(t => t.id === dt)) list.push({ id: dt, label: dt, sub: 'Histórico' })
    })
    return list.sort((a,b) => a.label.localeCompare(b.label))
  }, [ctxTurmas, turmaModalAno, dynamicTurmas])

  const eventosDisponiveis: SelectItem[] = useMemo(() => {
    const evMap = new Map<string, SelectItem>()
    ;((data as any).cfgEventos || []).forEach((e: any) => {
      const desc = e.descricao || e.id
      evMap.set(desc, { id: desc, label: desc, sub: e.tipo === 'receita' ? 'Receita' : (e.tipo === 'despesa' ? 'Despesa' : '') })
    })
    dynamicEventos.forEach(e => {
      if (!evMap.has(e)) evMap.set(e, { id: e, label: e })
    })
    return Array.from(evMap.values()).sort((a,b) => a.label.localeCompare(b.label))
  }, [data, dynamicEventos])

  // ─── Fetch baixas ─────────────────────────────────────────────────────────
  const fetchBaixas = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = {
        anoLetivo,
        dataInicio,
        dataFim,
        statusPagamento: 'pago',
      }
      if (metodosSelecionados.length === 1) filters.formaPagamento = metodosSelecionados[0]
      if (turmasSelecionadas.length === 1) filters.turma = turmasSelecionadas[0]
      if (eventosSelecionados.length === 1) filters.evento = eventosSelecionados[0]
      if (nivelEnsino) filters.nivelEnsino = nivelEnsino
      if (unidade) filters.unidade = unidade

      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'financeiro_recebimentos', filters, page: 1, pageSize: 99999 })
      })
      const json = await res.json()
      let rows: Baixa[] = (json.data || []).map((r: any) => ({
        id: r.id || '',
        nome: r.nome || '',
        turma: r.turma || '',
        serie: r.serie || '',
        evento: r.evento || '',
        parcela: r.parcela || r.numeroParcela || 0,
        competencia: r.competencia || '',
        dataPagamento: r.dataPagamento || '',
        formaPagamento: r.formaPagamento || 'Outros',
        valor: Number(r.valor) || 0,
        desconto: Number(r.desconto) || 0,
        juros: Number(r.juros) || 0,
        multa: Number(r.multa) || 0,
        valorPago: Number(r.valorPago || r.valor) || 0,
        unidade: r.unidade || '',
        nivelEnsino: r.nivelEnsino || r.serie || '',
        responsavelFinanceiro: r.responsavelFinanceiro || '',
      }))

      // Client-side multi-filters
      if (metodosSelecionados.length > 1) rows = rows.filter(r => metodosSelecionados.includes(r.formaPagamento))
      if (turmasSelecionadas.length > 1) rows = rows.filter(r => turmasSelecionadas.includes(r.turma))
      if (eventosSelecionados.length > 1) rows = rows.filter(r => eventosSelecionados.includes(r.evento))

      // Populate dynamic dropdowns from returned data
      const seenTurmas = new Set<string>()
      const seenEventos = new Set<string>()
      rows.forEach(r => {
        if (r.turma && !seenTurmas.has(r.turma)) { seenTurmas.add(r.turma) }
        if (r.evento && !seenEventos.has(r.evento)) { seenEventos.add(r.evento) }
      })
      setDynamicTurmas(Array.from(seenTurmas))
      setDynamicEventos(Array.from(seenEventos))

      // Sort
      const [sortF, sortD] = sortOption.split('_')
      rows.sort((a, b) => {
        let va: any = (a as any)[sortF] || ''
        let vb: any = (b as any)[sortF] || ''
        if (typeof va === 'number' && typeof vb === 'number') return sortD === 'asc' ? va - vb : vb - va
        return sortD === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      })

      setBaixas(rows)
      setHasLoaded(true)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [dataInicio, dataFim, anoLetivo, metodosSelecionados, turmasSelecionadas, eventosSelecionados, nivelEnsino, unidade, sortOption])

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = baixas.reduce((s, b) => s + b.valorPago, 0)
    const totalDesc = baixas.reduce((s, b) => s + b.desconto, 0)
    const totalEnc = baixas.reduce((s, b) => s + b.juros + b.multa, 0)
    const count = baixas.length
    // Group by payment method
    const byMethod: Record<string, number> = {}
    baixas.forEach(b => {
      byMethod[b.formaPagamento] = (byMethod[b.formaPagamento] || 0) + b.valorPago
    })
    const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]
    return { total, totalDesc, totalEnc, count, byMethod, topMethod }
  }, [baixas])

  // ─── Chart data ───────────────────────────────────────────────────────────
  const chartByMethod = useMemo(() =>
    Object.entries(kpis.byMethod)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
    [kpis.byMethod]
  )

  const chartByDay = useMemo(() => {
    const byDay: Record<string, number> = {}
    baixas.forEach(b => {
      const d = b.dataPagamento?.slice(0, 10) || ''
      if (d) byDay[d] = (byDay[d] || 0) + b.valorPago
    })
    return Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ name: fmtDate(d), value: Math.round(v * 100) / 100 }))
  }, [baixas])

  // ─── Grouped by method (Resumo mode) ─────────────────────────────────────
  const groupedByMethod = useMemo(() => {
    const map = new Map<string, Baixa[]>()
    for (const b of baixas) {
      if (!map.has(b.formaPagamento)) map.set(b.formaPagamento, [])
      map.get(b.formaPagamento)!.push(b)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].reduce((s, x) => s + x.valorPago, 0) - a[1].reduce((s, x) => s + x.valorPago, 0))
  }, [baixas])

  // ─── Export XLSX ──────────────────────────────────────────────────────────
  const exportXlsx = () => {
    const headers = ['Aluno', 'Turma', 'Evento', 'Parcela', 'Competência', 'Dt. Pagamento', 'Forma Pagamento', 'Valor Bruto', 'Desconto', 'Juros', 'Multa', 'Valor Pago']
    const rows: any[][] = [
      ['BAIXAS POR FORMA DE PAGAMENTO'],
      [`Período: ${fmtDate(dataInicio)} a ${fmtDate(dataFim)} | Ano Letivo: ${anoLetivo}`],
      metodosSelecionados.length > 0 ? [`Métodos: ${metodosSelecionados.join(', ')}`] : [],
      [],
      headers,
      ...baixas.map(b => [b.nome, b.turma, b.evento, b.parcela, b.competencia, fmtDate(b.dataPagamento), b.formaPagamento, b.valor, b.desconto, b.juros, b.multa, b.valorPago]),
      [],
      ['', '', '', '', '', '', 'TOTAL:', '', '', '', '', kpis.total]
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Baixas')
    XLSX.writeFile(wb, `baixas-forma-pagamento-${dataInicio}-${dataFim}.xlsx`)
  }

  // ─── Print PDF ────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (baixas.length === 0) return
    const hoje = new Date().toLocaleDateString('pt-BR')
    const logoHtml = schoolLogo ? `<img src="${schoolLogo}" alt="Logo" style="max-height:48px;max-width:100px;object-fit:contain;" onerror="this.style.display='none'" />` : ''

    const buildRows = () => {
      if (modo === 'resumo') {
        let h = ''
        for (const [method, rows] of groupedByMethod) {
          const total = rows.reduce((s, r) => s + r.valorPago, 0)
          const color = metodoPagtoColor[method] || '#94a3b8'
          h += `<tr><td style="font-weight:800;color:${color}">${method}</td>`
          h += `<td class="num">${rows.length}</td><td class="num">${fmtCur(total)}</td>`
          h += `<td class="num">${total > 0 && kpis.total > 0 ? ((total / kpis.total) * 100).toFixed(1) + '%' : '—'}</td></tr>`
        }
        return h
      }
      let h = ''
      for (const b of baixas) {
        const color = metodoPagtoColor[b.formaPagamento] || '#94a3b8'
        h += `<tr><td>${b.nome}</td><td>${b.turma}</td><td>${b.evento}</td>`
        h += `<td style="text-align:center">${fmtDate(b.dataPagamento)}</td>`
        h += `<td style="text-align:center;color:${color};font-weight:700">${b.formaPagamento}</td>`
        h += `<td class="num">${fmtCur(b.valor)}</td>`
        h += `<td class="num" style="color:#059669">${b.desconto > 0 ? '-' + fmtCur(b.desconto) : '—'}</td>`
        h += `<td class="num" style="font-weight:800">${fmtCur(b.valorPago)}</td></tr>`
      }
      return h
    }

    const theadResumo = '<tr><th>Forma de Pagamento</th><th>Qtd.</th><th>Total Recebido</th><th>% do Total</th></tr>'
    const theadCompleto = '<tr><th>Aluno</th><th>Turma</th><th>Evento</th><th>Dt. Pagamento</th><th>Forma Pagto.</th><th>Valor Bruto</th><th>Desconto</th><th>Valor Pago</th></tr>'

    const css = '* {box-sizing:border-box;margin:0;padding:0} body{font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:18px 22px;font-size:10px;color:#1e293b}'
      + '.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:3px solid #0ea5e9;padding-bottom:10px}'
      + '.school{font-size:15px;font-weight:900;color:#0ea5e9}'
      + '.doc-title{font-size:14px;font-weight:800;text-align:right;text-transform:uppercase}'
      + '.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}'
      + '.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px}'
      + '.kpi-lbl{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px}'
      + '.kpi-val{font-size:13px;font-weight:900}'
      + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
      + 'th{background:#0ea5e9;color:#fff;padding:5px 6px;font-size:8px;font-weight:700;text-align:left;text-transform:uppercase;overflow:hidden;white-space:nowrap}'
      + 'td{padding:4px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
      + 'td.num{text-align:right;font-family:Courier New,monospace}'
      + 'tr:nth-child(even) td{background:#f8fafc}'
      + '.total-row td{font-weight:900;background:#dde3ec!important;border-top:2px solid #0ea5e9}'
      + '@media print{@page{size:A4 landscape;margin:10mm 12mm}body{padding:0}}'

    const html = `<!DOCTYPE html><html><head><title>Baixas por Forma de Pagamento</title><style>${css}</style></head><body>`
      + `<div class="header"><div style="display:flex;align-items:center;gap:10px">${logoHtml}<div><div class="school">${schoolName}</div><div style="font-size:9px;color:#64748b">Sistema de Gestão Escolar</div></div></div>`
      + `<div><div class="doc-title">Baixas por Forma de Pagamento</div><div style="font-size:9px;color:#64748b;text-align:right">Emitido em: ${hoje}</div></div></div>`
      + `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:12px;font-size:9px">Período: <strong>${fmtDate(dataInicio)} a ${fmtDate(dataFim)}</strong> · Ano Letivo: <strong>${anoLetivo}</strong>${metodosSelecionados.length > 0 ? ` · Métodos: <strong>${metodosSelecionados.join(', ')}</strong>` : ''}</div>`
      + `<div class="kpi-row">`
      + `<div class="kpi"><div class="kpi-lbl">Total Recebido</div><div class="kpi-val" style="color:#059669">${fmtCur(kpis.total)}</div></div>`
      + `<div class="kpi"><div class="kpi-lbl">Qtd. Baixas</div><div class="kpi-val" style="color:#0ea5e9">${kpis.count.toLocaleString('pt-BR')}</div></div>`
      + `<div class="kpi"><div class="kpi-lbl">Total Descontos</div><div class="kpi-val" style="color:#f59e0b">${fmtCur(kpis.totalDesc)}</div></div>`
      + `<div class="kpi"><div class="kpi-lbl">Encargos (J+M)</div><div class="kpi-val" style="color:#dc2626">${fmtCur(kpis.totalEnc)}</div></div>`
      + `</div>`
      + `<table><thead>${modo === 'resumo' ? theadResumo : theadCompleto}</thead><tbody>${buildRows()}`
      + `<tr class="total-row"><td colspan="${modo === 'resumo' ? 1 : 6}">TOTAL GERAL</td>${modo === 'resumo' ? `<td class="num">${kpis.count}</td><td class="num">${fmtCur(kpis.total)}</td><td class="num">100%</td>` : `<td class="num"></td><td class="num" style="font-weight:900">${fmtCur(kpis.total)}</td>`}</tr>`
      + `</tbody></table></body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  const tooltipStyle = { background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, fontSize: 11 }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-icon"><ArrowLeft size={15} /></button>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <CreditCard size={20} style={{ color: ACCENT }} /> Baixas por Forma de Pagamento
            </h1>
            <p className="page-subtitle" style={{ marginTop: 3 }}>Análise detalhada de recebimentos agrupados por método de pagamento</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Modo toggle */}
          <div style={{ display: 'flex', background: 'hsl(var(--bg-subtle))', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['resumo', 'completo'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={`btn btn-sm ${modo === m ? 'btn-primary' : 'btn-ghost'}`}
                style={{ gap: 5, background: modo === m ? ACCENT : undefined, color: modo === m ? '#fff' : undefined, fontSize: 11 }}>
                {m === 'resumo' ? <><LayoutList size={12} /> Resumo</> : <><Table2 size={12} /> Completo</>}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCharts(!showCharts)} className={`btn btn-sm ${showCharts ? 'btn-primary' : 'btn-secondary'}`} style={{ gap: 5, background: showCharts ? ACCENT : undefined, color: showCharts ? '#fff' : undefined }}>
            <BarChart3 size={12} /> Gráficos
          </button>
          <button onClick={fetchBaixas} disabled={loading} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Atualizar
          </button>
          <button onClick={exportXlsx} disabled={!hasLoaded || baixas.length === 0} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
            <FileSpreadsheet size={12} /> Excel
          </button>
          <button onClick={handlePrint} disabled={!hasLoaded || baixas.length === 0} className="btn btn-sm" style={{ gap: 5, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}>
            <PrinterIcon size={12} /> PDF
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Filter size={13} style={{ color: ACCENT }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtros</span>
        </div>

        {/* ── Row 1: campos principais em grid uniforme ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, marginBottom: 14 }}>
          <div>
            <label className="form-label">Data Início</label>
            <input type="date" className="form-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ fontSize: 11, padding: '6px 8px' }} />
          </div>
          <div>
            <label className="form-label">Data Fim</label>
            <input type="date" className="form-input" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ fontSize: 11, padding: '6px 8px' }} />
          </div>
          <div>
            <label className="form-label">Ano Letivo</label>
            <select className="form-input" value={anoLetivo} onChange={e => setAnoLetivo(e.target.value)} style={{ fontSize: 11, padding: '6px 8px' }}>
              {yrOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Turmas</label>
            <button className="form-input"
              onClick={() => setShowTurmasModal(true)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, cursor: 'pointer', padding: '6px 8px', color: turmasSelecionadas.length > 0 ? ACCENT : 'hsl(var(--text-muted))' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <BookOpen size={11} />
                {turmasSelecionadas.length === 0 ? 'Todas' : `${turmasSelecionadas.length} turma(s)`}
              </span>
              <ChevronDown size={11} style={{ flexShrink: 0 }} />
            </button>
          </div>
          <div>
            <label className="form-label">Eventos</label>
            <button className="form-input"
              onClick={() => setShowEventosModal(true)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, cursor: 'pointer', padding: '6px 8px', color: eventosSelecionados.length > 0 ? ACCENT : 'hsl(var(--text-muted))' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <Layers size={11} />
                {eventosSelecionados.length === 0 ? 'Todos' : `${eventosSelecionados.length} evento(s)`}
              </span>
              <ChevronDown size={11} style={{ flexShrink: 0 }} />
            </button>
          </div>
          <div>
            <label className="form-label">Nível de Ensino</label>
            <select className="form-input" value={nivelEnsino} onChange={e => setNivelEnsino(e.target.value)} style={{ fontSize: 11, padding: '6px 8px' }}>
              <option value="">Todos</option>
              {NIVEIS_ENSINO.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Unidade</label>
            <div style={{ position: 'relative' }}>
              <Building2 size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <select className="form-input" value={unidade} onChange={e => setUnidade(e.target.value)} style={{ paddingLeft: 24, fontSize: 11, padding: '6px 8px 6px 24px' }}>
                <option value="">Todas</option>
                {unidadeOptions.map((u: any) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Ordenar por</label>
            <div style={{ position: 'relative' }}>
              <ArrowUpDown size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <select className="form-input" value={sortOption} onChange={e => setSortOption(e.target.value)} style={{ paddingLeft: 24, fontSize: 11, padding: '6px 8px 6px 24px' }}>
                {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Row 2: Método de Pagamento — faixa full-width ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'hsl(var(--bg-subtle))', borderRadius: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <CreditCard size={12} style={{ color: ACCENT }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Método de Pgto.</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'hsl(var(--border-subtle))' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {METODOS_PAGAMENTO.map(m => {
              const sel = metodosSelecionados.includes(m)
              const color = metodoPagtoColor[m] || '#94a3b8'
              return (
                <button key={m}
                  onClick={() => setMetodosSelecionados(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${sel ? color : 'hsl(var(--border-default))'}`,
                    background: sel ? `${color}18` : 'hsl(var(--bg-card))',
                    color: sel ? color : 'hsl(var(--text-muted))',
                    transition: 'all 0.15s',
                    boxShadow: sel ? `0 0 0 2px ${color}22` : 'none',
                  }}>
                  {sel && <Check size={10} />}
                  {m}
                </button>
              )
            })}
            {metodosSelecionados.length > 0 && (
              <button onClick={() => setMetodosSelecionados([])}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid hsl(var(--border-default))', background: 'transparent', color: 'hsl(var(--text-muted))' }}>
                <X size={9} /> Todos
              </button>
            )}
          </div>
        </div>

        {/* ── Row 3: Ações ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchBaixas} disabled={loading} className="btn btn-primary" style={{ background: ACCENT, gap: 6, fontSize: 12 }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
            Gerar Relatório
          </button>
          <button onClick={() => {
            setMetodosSelecionados([]); setTurmasSelecionadas([]); setEventosSelecionados([])
            setNivelEnsino(''); setUnidade(''); setSortOption('dataPagamento_desc')
            setDataInicio(`${year}-01-01`); setDataFim(`${year}-12-31`)
          }} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
            <X size={12} /> Limpar tudo
          </button>
          {hasLoaded && (
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>
              {loading ? 'Carregando...' : `${baixas.length.toLocaleString('pt-BR')} baixa(s) encontrada(s)`}
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      {hasLoaded && !loading && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <KpiCard label="Total Recebido" value={fmtCur(kpis.total)} sub={`${kpis.count} baixas`} color="#059669" icon={<TrendingUp size={20} />} />
          <KpiCard label="Total Descontos" value={fmtCur(kpis.totalDesc)} color="#f59e0b" icon={<Wallet size={20} />} />
          <KpiCard label="Encargos (J+M)" value={fmtCur(kpis.totalEnc)} color="#dc2626" icon={<Banknote size={20} />} />
          <KpiCard label="Principal Método" value={kpis.topMethod?.[0] || '—'} sub={kpis.topMethod ? fmtCur(kpis.topMethod[1]) : undefined} color={metodoPagtoColor[kpis.topMethod?.[0] || ''] || '#0ea5e9'} icon={<CreditCard size={20} />} />
        </div>
      )}

      {/* ── Charts ── */}
      {hasLoaded && !loading && showCharts && baixas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          {/* Pie por método */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <BarChart3 size={12} /> Por Método de Pagamento
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={chartByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={44}
                  label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} style={{ fontSize: 10 }}>
                  {chartByMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => ['R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 'Total']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar por dia */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <TrendingUp size={12} /> Recebimentos por Dia
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartByDay.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--text-muted))' }} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--text-muted))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => ['R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 'Recebido']} />
                <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Loading / Empty ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: 'hsl(var(--text-muted))' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, color: ACCENT }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Carregando dados…</div>
        </div>
      )}

      {!loading && !hasLoaded && (
        <div style={{ textAlign: 'center', padding: 80, color: 'hsl(var(--text-muted))' }}>
          <CreditCard size={48} style={{ opacity: 0.15, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Configure os filtros e clique em Gerar Relatório</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Selecione o período, métodos de pagamento e outras opções acima</div>
        </div>
      )}

      {!loading && hasLoaded && baixas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Search size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Nenhuma baixa encontrada</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 6 }}>Tente ampliar o período ou alterar os filtros</div>
        </div>
      )}

      {/* ── RESUMO Mode ── */}
      {!loading && hasLoaded && baixas.length > 0 && modo === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groupedByMethod.map(([method, rows]) => {
            const total = rows.reduce((s, r) => s + r.valorPago, 0)
            const pct = kpis.total > 0 ? (total / kpis.total) * 100 : 0
            const color = metodoPagtoColor[method] || '#94a3b8'
            return (
              <div key={method} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: `${color}08`, borderBottom: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                      {metodoPagtoIcon[method] || <Wallet size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color }}>{method}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{rows.length} baixa(s)</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: 'monospace' }}>{fmtCur(total)}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{pct.toFixed(1)}% do total</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'hsl(var(--border-subtle))' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                </div>
                {/* Summary table */}
                <div style={{ padding: '10px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 3 }}>Valor Bruto</div><div style={{ fontSize: 12, fontWeight: 700 }}>{fmtCur(rows.reduce((s, r) => s + r.valor, 0))}</div></div>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 3 }}>Descontos</div><div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{fmtCur(rows.reduce((s, r) => s + r.desconto, 0))}</div></div>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 3 }}>Encargos</div><div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{fmtCur(rows.reduce((s, r) => s + r.juros + r.multa, 0))}</div></div>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 3 }}>Líquido Pago</div><div style={{ fontSize: 12, fontWeight: 800, color }}>{fmtCur(total)}</div></div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Grand total */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${ACCENT}08`, borderLeft: `4px solid ${ACCENT}` }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>TOTAL GERAL — {kpis.count} baixas</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>{fmtCur(kpis.total)}</span>
          </div>
        </div>
      )}

      {/* ── COMPLETO Mode ── */}
      {!loading && hasLoaded && baixas.length > 0 && modo === 'completo' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{baixas.length.toLocaleString('pt-BR')} registros</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>Total: {fmtCur(kpis.total)}</div>
          </div>
          <div className="table-container" style={{ maxHeight: 580 }}>
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Turma</th>
                  <th>Evento</th>
                  <th style={{ textAlign: 'center' }}>Parc.</th>
                  <th style={{ textAlign: 'center' }}>Competência</th>
                  <th style={{ textAlign: 'center' }}>Dt. Pagamento</th>
                  <th style={{ textAlign: 'center' }}>Forma Pgto.</th>
                  <th style={{ textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ textAlign: 'right' }}>Desconto</th>
                  <th style={{ textAlign: 'right' }}>Encargos</th>
                  <th style={{ textAlign: 'right' }}>Valor Pago</th>
                </tr>
              </thead>
              <tbody>
                {baixas.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nome}</td>
                    <td style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{b.turma || '—'}</td>
                    <td style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.evento || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>{b.parcela || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>{b.competencia || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 11, color: '#059669', fontWeight: 600 }}>{fmtDate(b.dataPagamento)}</td>
                    <td style={{ textAlign: 'center' }}><BadgePagto method={b.formaPagamento} /></td>
                    <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fmtCur(b.valor)}</td>
                    <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: b.desconto > 0 ? '#059669' : 'hsl(var(--text-disabled))' }}>{b.desconto > 0 ? '-' + fmtCur(b.desconto) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: (b.juros + b.multa) > 0 ? '#dc2626' : 'hsl(var(--text-disabled))' }}>{(b.juros + b.multa) > 0 ? '+' + fmtCur(b.juros + b.multa) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 800, color: '#059669' }}>{fmtCur(b.valorPago)}</td>
                  </tr>
                ))}
                {/* Footer total */}
                <tr style={{ background: 'hsl(var(--bg-subtle))', fontWeight: 900 }}>
                  <td colSpan={7} style={{ fontWeight: 800, fontSize: 12 }}>TOTAL GERAL</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCur(baixas.reduce((s, b) => s + b.valor, 0))}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#f59e0b' }}>{fmtCur(kpis.totalDesc)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#dc2626' }}>{fmtCur(kpis.totalEnc)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: '#059669' }}>{fmtCur(kpis.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showTurmasModal && (
        <SelectionModal
          title="Selecionar Turmas"
          icon={<BookOpen size={15} />}
          items={turmaOptions}
          selected={turmasSelecionadas}
          onClose={() => setShowTurmasModal(false)}
          onApply={s => { setTurmasSelecionadas(s); setEventosSelecionados([]) }}
          searchPlaceholder="Buscar turma..."
          hasAllOption
          extraContent={
            <div>
              <label className="form-label" style={{ fontSize: 10, marginBottom: 4, display: 'block' }}>Ano Letivo das Turmas</label>
              <select className="form-input" style={{ fontSize: 11 }} value={turmaModalAno} onChange={e => setTurmaModalAno(e.target.value)}>
                {yrOptions.map(y => <option key={y} value={y}>Ano {y}</option>)}
              </select>
            </div>
          }
        />
      )}

      {showEventosModal && (
        <SelectionModal
          title="Selecionar Eventos / Cursos"
          icon={<Layers size={15} />}
          items={eventosDisponiveis}
          selected={eventosSelecionados}
          onClose={() => setShowEventosModal(false)}
          onApply={s => setEventosSelecionados(s)}
          searchPlaceholder="Buscar evento/curso..."
          hasAllOption
        />
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .table-container { overflow-x: auto; overflow-y: auto; }
        .table-container table th { position: sticky; top: 0; z-index: 2; background: hsl(var(--bg-elevated)) !important; }
      `}</style>
    </div>
  )
}
