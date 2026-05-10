'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  TrendingUp, Filter, RefreshCw, FileSpreadsheet, Printer,
  ArrowLeft, Search, X, Check, Calendar, ChevronRight,
  DollarSign, Clock, Users, Building2, GraduationCap,
  BookOpen, Tag, Layers, AlertCircle, CheckCircle,
  ListFilter, SlidersHorizontal, Eye, EyeOff,
  ChevronDown, ChevronUp, Hash, BarChart3, FileText,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useData } from '@/lib/dataContext'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Parcela {
  alunoId: string
  codigo: string
  nome: string
  turma: string
  serie: string
  unidade: string
  responsavelFinanceiro: string
  cpfResponsavel: string
  emailResponsavel: string
  celularResponsavel: string
  telefoneResponsavel: string
  enderecoResponsavel: string
  numeroResponsavel: string
  bairroResponsavel: string
  cidadeResponsavel: string
  ufResponsavel: string
  cepResponsavel: string
  parentescoResponsavel: string
  evento: string
  parcela: string
  competencia: string
  vencimento: string
  valor: number
  desconto: number
  juros: number
  multa: number
  saldo: number
  statusFinanceiro: string
  anoLetivo: number
}

type ModeloRelatorio = 'resumo' | 'por-evento' | 'por-aluno' | 'com-responsavel'
type OpcaoParcelas = 'todas' | 'em-aberto'
type OrdenarPor = 'nome' | 'codigo' | 'turma' | 'evento' | 'vencimento'

interface Filters {
  dataInicio: string
  dataFim: string
  grupoAluno: string
  nivelEnsino: string
  statusPagamento: string   // '' | 'todos' | 'pago' | 'pendente' | 'vencido'
  unidade: string
  anoLetivo: string
  turmas: string[]
  eventos: string[]
  opcaoParcelas: OpcaoParcelas
  ordenarPor: OrdenarPor
  busca: string
  somarDesconto: boolean
  somarJurosMulta: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCur = (n: number) => `R$ ${fmtR(Math.abs(n))}`
const fmtPct = (n: number) => `${n.toFixed(1)}%`

const todayISO = () => new Date().toISOString().slice(0, 10)
// Default: full current year (jan-dez) so all installments are visible
const thisYearStart = () => `${new Date().getFullYear()}-01-01`
const thisYearEnd   = () => `${new Date().getFullYear()}-12-31`

function fmtDate(s: string): string {
  if (!s) return '—'
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function mesLabel(venc: string): string {
  const clean = (venc || '').slice(0, 10)
  const [y, m] = clean.split('-')
  if (!y || !m) return 'Sem data'
  return new Date(Number(y), Number(m) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function mesKey(venc: string): string {
  const raw = venc || ''
  if (raw.includes('/')) {
    const pts = raw.split('/')
    return `${pts[2]}-${pts[1].padStart(2, '0')}`
  }
  return raw.slice(0, 7)
}

function statusBadge(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'pago': return { label: 'Pago', bg: 'rgba(16,185,129,0.12)', color: '#059669' }
    case 'vencido': return { label: 'Vencido', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' }
    case 'cancelado': return { label: 'Cancelado', bg: 'rgba(107,114,128,0.12)', color: '#6b7280' }
    default: return { label: 'Em Aberto', bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
  }
}

const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const ACCENT = '#0ea5e9'     // sky-500 — financeiro azul premium
const ACCENT2 = '#10b981'    // emerald — recebimento confirmado
const ACCENT3 = '#f59e0b'    // amber — pendente
const ACCENT4 = '#ef4444'    // red — vencido

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, size = 'md' }: {
  label: string; value: string; sub?: string; icon: React.ReactNode
  color: string; size?: 'sm' | 'md'
}) {
  return (
    <div className="card" style={{
      padding: size === 'sm' ? '12px 16px' : '16px 20px',
      display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: size === 'sm' ? 120 : 150,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: size === 'sm' ? 15 : 18, fontWeight: 900, color, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Generic Selection Modal (Turmas or Eventos) ──────────────────────────────

function SelectionModal({ title, icon, items, selected, onClose, onApply, searchPlaceholder, extraContent }: {
  title: string; icon: React.ReactNode; items: string[]
  selected: string[]; onClose: () => void; onApply: (sel: string[]) => void
  searchPlaceholder: string; extraContent?: React.ReactNode
}) {
  const [local, setLocal] = useState<string[]>(selected)
  const [search, setSearch] = useState('')
  const filtered = items.filter(i => norm(i).includes(norm(search)))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>{icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{local.length === 0 ? 'Todos os itens' : `${local.length} selecionado(s)`}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 22px 8px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          {extraContent && <div style={{ marginBottom: 12 }}>{extraContent}</div>}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder} className="form-input" style={{ paddingLeft: 32, fontSize: 12 }} />
          </div>
        </div>

        <div style={{ padding: '8px 22px', display: 'flex', gap: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <button onClick={() => setLocal(items)} style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Todos</button>
          <button onClick={() => setLocal([])} style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Nenhum</button>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 12 }}>Nenhum item encontrado</div>
          ) : filtered.map(item => {
            const checked = local.includes(item)
            return (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderRadius: 4, margin: '2px 0', background: checked ? `${ACCENT}12` : 'transparent', transition: 'background 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, flexShrink: 0, border: checked ? `2px solid ${ACCENT}` : '2px solid hsl(var(--border-default))', background: checked ? ACCENT : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  {checked && <Check size={11} color="#fff" />}
                </div>
                <input type="checkbox" checked={checked} onChange={e => { if (e.target.checked) setLocal(p => [...p, item]); else setLocal(p => p.filter(x => x !== item)) }} style={{ display: 'none' }} />
                <span style={{ fontSize: 12, color: 'hsl(var(--text-primary))' }}>{item}</span>
              </label>
            )
          })}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid hsl(var(--border-default))', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'hsl(var(--bg-elevated))' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button onClick={() => { onApply(local); onClose() }} style={{ fontSize: 12, fontWeight: 700, padding: '7px 18px', borderRadius: 4, cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none' }}>
            Aplicar ({local.length === 0 ? 'Todos' : local.length})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Print Layout (hidden wrapper) ───────────────────────────────────────────

function PrintLayout({ parcelas, filters, modelo, kpis }: {
  parcelas: Parcela[]
  filters: Filters
  modelo: ModeloRelatorio
  kpis: { total: number; valor: number; saldo: number; desconto: number; alunos: number; qtdParcelas: number }
}) {
  const now = new Date().toLocaleString('pt-BR')

  const P = {
    page: { fontFamily: 'Arial, sans-serif', color: '#1a1a1a', fontSize: 10 } as React.CSSProperties,
    header: { borderBottom: '2px solid #0ea5e9', paddingBottom: 10, marginBottom: 14 } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 9 },
    th: { background: '#f0f9ff', padding: '4px 6px', textAlign: 'left' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: '#0369a1', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' as const },
    thR: { background: '#f0f9ff', padding: '4px 6px', textAlign: 'right' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: '#0369a1', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' as const },
    thC: { background: '#f0f9ff', padding: '4px 6px', textAlign: 'center' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: '#0369a1', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' as const },
    td: { padding: '4px 6px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    tdR: { padding: '4px 6px', textAlign: 'right' as const, fontFamily: 'monospace', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    tdC: { padding: '4px 6px', textAlign: 'center' as const, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    section: { marginBottom: 14, pageBreakInside: 'avoid' as const },
    sectionHead: { background: '#0ea5e9', color: '#fff', padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' } as React.CSSProperties,
    foot: { background: '#f0f9ff', fontWeight: 700 },
    totalRow: { borderTop: '2px solid #0ea5e9' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14, border: '1px solid #bae6fd', borderRadius: 6, padding: 8, background: '#f0f9ff' } as React.CSSProperties,
    kpiItem: { textAlign: 'center' as const, padding: '4px 2px' },
    kpiLabel: { fontSize: 7, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 2 },
    kpiVal: { fontSize: 13, fontWeight: 900, fontFamily: 'monospace' },
  }

  // Group by mes for resumo/por-evento; by aluno for por-aluno/com-responsavel
  const byMes = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => {
      const k = mesKey(p.vencimento)
      if (!map[k]) map[k] = []
      map[k].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({
      key: k, label: mesLabel(k + '-01'), items,
      totalValor: items.reduce((s, p) => s + p.valor, 0),
      totalDesconto: items.reduce((s, p) => s + p.desconto, 0),
      totalSaldo: items.reduce((s, p) => s + p.saldo, 0),
    }))
  }, [parcelas])

  const byEvento = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => {
      const k = p.evento || 'Sem evento'
      if (!map[k]) map[k] = []
      map[k].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({
      key: k, items,
      totalValor: items.reduce((s, p) => s + p.valor, 0),
      totalSaldo: items.reduce((s, p) => s + p.saldo, 0),
    }))
  }, [parcelas])

  const byAluno = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => {
      if (!map[p.alunoId]) map[p.alunoId] = []
      map[p.alunoId].push(p)
    })
    return Object.values(map).map(items => ({
      nome: items[0].nome,
      codigo: items[0].codigo,
      turma: items[0].turma,
      responsavel: items[0].responsavelFinanceiro,
      email: items[0].emailResponsavel,
      celular: items[0].celularResponsavel || items[0].telefoneResponsavel,
      items,
      totalValor: items.reduce((s, p) => s + p.valor, 0),
      totalSaldo: items.reduce((s, p) => s + p.saldo, 0),
    })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [parcelas])

  return (
    <div id="print-layout" style={P.page}>
      {/* Header */}
      <div style={P.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0ea5e9', margin: 0 }}>IMPACTO EDU — Sistema de Gestão Escolar</p>
            <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0' }}>
              PREVISÃO DE RECEBIMENTOS — {modelo === 'resumo' ? 'Resumo' : modelo === 'por-evento' ? 'Por Evento' : modelo === 'por-aluno' ? 'Por Aluno' : 'Com Dados do Responsável'}
            </p>
            <p style={{ fontSize: 9, color: '#777', marginTop: 4 }}>
              Período: {fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)}
              {filters.unidade ? ` · Unidade: ${filters.unidade}` : ''}
              {filters.anoLetivo ? ` · Ano letivo: ${filters.anoLetivo}` : ''}
              {filters.opcaoParcelas === 'em-aberto' ? ' · Somente parcelas em aberto' : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: '#888' }}>
            <div>Gerado em: {now}</div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: '#0ea5e9' }}>{kpis.qtdParcelas} parcela(s) · {kpis.alunos} aluno(s)</div>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div style={P.kpiGrid}>
        {[
          { label: 'Total Previsto', val: fmtCur(kpis.valor), color: '#0ea5e9' },
          { label: 'Descontos', val: fmtCur(kpis.desconto), color: '#059669' },
          { label: 'A Receber Líquido', val: fmtCur(kpis.saldo), color: '#0369a1' },
          { label: 'Parcelas', val: String(kpis.qtdParcelas), color: '#7c3aed' },
          { label: 'Alunos', val: String(kpis.alunos), color: '#d97706' },
        ].map(k => (
          <div key={k.label} style={P.kpiItem}>
            <span style={P.kpiLabel}>{k.label}</span>
            <span style={{ ...P.kpiVal, color: k.color }}>{k.val}</span>
          </div>
        ))}
      </div>

      {/* MODELO RESUMO: por mês */}
      {modelo === 'resumo' && byMes.map(({ key, label, items, totalValor, totalDesconto, totalSaldo }) => (
        <div key={key} style={P.section}>
          <div style={P.sectionHead}>
            <span style={{ textTransform: 'capitalize' }}>📅 {label}</span>
            <span style={{ fontSize: 10 }}>{items.length} parcela(s) · A receber: {fmtCur(totalSaldo)}</span>
          </div>
          <table style={P.table}>
            <thead><tr>
              <th style={P.th}>Aluno</th><th style={P.th}>Turma</th><th style={P.th}>Evento</th>
              <th style={P.thC}>Parc.</th><th style={P.thC}>Vencimento</th>
              <th style={P.thR}>Valor</th><th style={P.thR}>Desc.</th><th style={P.thR}>A Receber</th><th style={P.thC}>Status</th>
            </tr></thead>
            <tbody>{items.map((p, idx) => {
              const bd = statusBadge(p.statusFinanceiro)
              return (
                <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...P.td, fontWeight: 600 }}>{p.nome}</td>
                  <td style={P.td}>{p.turma || '—'}</td>
                  <td style={P.td}>{p.evento || '—'}</td>
                  <td style={P.tdC}>{String(p.parcela).padStart(2, '0')}</td>
                  <td style={P.tdC}>{fmtDate(p.vencimento)}</td>
                  <td style={P.tdR}>{fmtCur(p.valor)}</td>
                  <td style={{ ...P.tdR, color: p.desconto > 0 ? '#059669' : '#999' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                  <td style={{ ...P.tdR, fontWeight: 800, color: '#0369a1' }}>{fmtCur(p.saldo)}</td>
                  <td style={{ ...P.tdC, color: bd.color, fontWeight: 700, fontSize: 8 }}>{bd.label}</td>
                </tr>
              )
            })}</tbody>
            <tfoot><tr style={{ ...P.foot, ...P.totalRow }}>
              <td colSpan={5} style={{ ...P.td, fontWeight: 700, color: '#555' }}>Subtotal {label}</td>
              <td style={{ ...P.tdR, fontWeight: 700 }}>{fmtCur(totalValor)}</td>
              <td style={{ ...P.tdR, color: '#059669', fontWeight: 700 }}>{totalDesconto > 0 ? `-${fmtCur(totalDesconto)}` : '—'}</td>
              <td style={{ ...P.tdR, fontWeight: 900, color: '#0369a1', fontSize: 11 }}>{fmtCur(totalSaldo)}</td>
              <td style={P.tdC} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {/* MODELO POR EVENTO */}
      {modelo === 'por-evento' && byEvento.map(({ key, items, totalValor, totalSaldo }) => (
        <div key={key} style={P.section}>
          <div style={{ ...P.sectionHead, background: '#0369a1' }}>
            <span>🏷️ {key}</span>
            <span style={{ fontSize: 10 }}>{items.length} parcela(s) · A receber: {fmtCur(totalSaldo)}</span>
          </div>
          <table style={P.table}>
            <thead><tr>
              <th style={P.th}>Aluno</th><th style={P.th}>Turma</th><th style={P.thC}>Parc.</th>
              <th style={P.thC}>Vencimento</th><th style={P.thR}>Valor</th><th style={P.thR}>A Receber</th><th style={P.thC}>Status</th>
            </tr></thead>
            <tbody>{items.map((p, idx) => {
              const bd = statusBadge(p.statusFinanceiro)
              return (
                <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...P.td, fontWeight: 600 }}>{p.nome}</td>
                  <td style={P.td}>{p.turma || '—'}</td>
                  <td style={P.tdC}>{String(p.parcela).padStart(2, '0')}</td>
                  <td style={P.tdC}>{fmtDate(p.vencimento)}</td>
                  <td style={P.tdR}>{fmtCur(p.valor)}</td>
                  <td style={{ ...P.tdR, fontWeight: 800, color: '#0369a1' }}>{fmtCur(p.saldo)}</td>
                  <td style={{ ...P.tdC, color: bd.color, fontWeight: 700, fontSize: 8 }}>{bd.label}</td>
                </tr>
              )
            })}</tbody>
            <tfoot><tr style={{ ...P.foot, ...P.totalRow }}>
              <td colSpan={4} style={{ ...P.td, fontWeight: 700, color: '#555' }}>Subtotal {key}</td>
              <td style={{ ...P.tdR, fontWeight: 700 }}>{fmtCur(totalValor)}</td>
              <td style={{ ...P.tdR, fontWeight: 900, color: '#0369a1', fontSize: 11 }}>{fmtCur(totalSaldo)}</td>
              <td style={P.tdC} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {/* MODELO POR ALUNO */}
      {(modelo === 'por-aluno' || modelo === 'com-responsavel') && byAluno.map(g => (
        <div key={g.nome} style={{ ...P.section, border: '1px solid #bae6fd', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#e0f2fe', borderBottom: '1px solid #bae6fd', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#0369a1' }}>👤 {g.nome} — {g.codigo}</div>
              <div style={{ fontSize: 9, color: '#0284c7', marginTop: 2 }}>Turma: {g.turma || '—'}</div>
              {modelo === 'com-responsavel' && g.responsavel && (
                <div style={{ fontSize: 9, color: '#374151', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                  <span><b>Resp.:</b> {g.responsavel}</span>
                  {g.celular && <span><b>Tel.:</b> {g.celular}</span>}
                  {g.email && <span><b>E-mail:</b> {g.email}</span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>A Receber</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>{fmtCur(g.totalSaldo)}</div>
            </div>
          </div>
          <table style={P.table}>
            <thead><tr>
              <th style={P.th}>Evento</th><th style={P.thC}>Parc.</th>
              <th style={P.thC}>Vencimento</th><th style={P.thR}>Valor</th><th style={P.thR}>Desc.</th>
              <th style={P.thR}>A Receber</th><th style={P.thC}>Status</th>
            </tr></thead>
            <tbody>{g.items.map((p, idx) => {
              const bd = statusBadge(p.statusFinanceiro)
              return (
                <tr key={`${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f9ff' }}>
                  <td style={P.td}>{p.evento || '—'}</td>
                  <td style={P.tdC}>{String(p.parcela).padStart(2, '0')}</td>
                  <td style={P.tdC}>{fmtDate(p.vencimento)}</td>
                  <td style={P.tdR}>{fmtCur(p.valor)}</td>
                  <td style={{ ...P.tdR, color: p.desconto > 0 ? '#059669' : '#999' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                  <td style={{ ...P.tdR, fontWeight: 700, color: '#0369a1' }}>{fmtCur(p.saldo)}</td>
                  <td style={{ ...P.tdC, color: bd.color, fontWeight: 700, fontSize: 8 }}>{bd.label}</td>
                </tr>
              )
            })}</tbody>
            <tfoot><tr style={{ ...P.foot, ...P.totalRow }}>
              <td colSpan={5} style={{ ...P.td, fontSize: 9, fontWeight: 700, color: '#555' }}>Total {g.nome}</td>
              <td style={{ ...P.tdR, fontWeight: 900, color: '#0369a1' }}>{fmtCur(g.totalSaldo)}</td>
              <td style={P.tdC} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {/* Grand total */}
      <div style={{ marginTop: 14, border: '2px solid #0ea5e9', borderRadius: 6, padding: '8px 14px', background: '#f0f9ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>TOTAL GERAL — PREVISÃO DE RECEBIMENTOS</div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
            {fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)} · {kpis.alunos} alunos · {kpis.qtdParcelas} parcelas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>Valor Original</div><div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#0284c7' }}>{fmtCur(kpis.valor)}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Descontos</div><div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#059669' }}>{fmtCur(kpis.desconto)}</div></div>
          <div style={{ textAlign: 'right', borderLeft: '2px solid #0ea5e9', paddingLeft: 16 }}><div style={{ fontSize: 8, color: '#0ea5e9', fontWeight: 700, textTransform: 'uppercase' }}>A Receber (Líquido)</div><div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#0ea5e9' }}>{fmtCur(kpis.saldo)}</div></div>
        </div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af' }}>
        <span>IMPACTO EDU — Sistema de Gestão Escolar — Relatório confidencial</span>
        <span>Gerado em {now}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE VIEWS (Screen)
// ═══════════════════════════════════════════════════════════════════════════════

function Th({ label, f, sortField, sortDir, onSort, align = 'left' }: {
  label: string; f: string; sortField: string; sortDir: 'asc' | 'desc'
  onSort: (f: string) => void; align?: string
}) {
  const active = sortField === f
  return (
    <th onClick={() => onSort(f)} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: active ? ACCENT : 'hsl(var(--text-muted))', padding: '7px 10px', textAlign: align as any, cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap', background: 'hsl(var(--bg-elevated))', userSelect: 'none' }}>
      {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

/* Resumo agrupado por mês */
function ViewResumo({ parcelas, sortField, sortDir, onSort, filters }: { parcelas: Parcela[]; sortField: string; sortDir: 'asc' | 'desc'; onSort: (f: string) => void; filters: Filters }) {
  const byMes = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => { const k = mesKey(p.vencimento); if (!map[k]) map[k] = []; map[k].push(p) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => {
      const totalValor = items.reduce((s, p) => s + p.valor, 0)
      const totalDesconto = items.reduce((s, p) => s + p.desconto, 0)
      const totalSaldo = items.reduce((s, p) => s + p.saldo, 0)
      const totalLiq = items.reduce((s, p) => s + p.valor + (filters.somarJurosMulta ? (p.juros||0)+(p.multa||0) : 0) - (filters.somarDesconto ? p.desconto : 0), 0)
      return { key: k, label: mesLabel(k + '-01'), items, totalValor, totalDesconto, totalSaldo, totalLiq }
    })
  }, [parcelas, filters])

  const [open, setOpen] = useState<Set<string>>(new Set(['all']))
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div>
      {byMes.map(({ key, label, items, totalValor, totalDesconto, totalSaldo, totalLiq }) => {
        const isOpen = open.has(key) || open.has('all')
        return (
          <div key={key} style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
            <button onClick={() => toggle(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', borderBottom: isOpen ? '1px solid hsl(var(--border-subtle))' : 'none', borderLeft: `4px solid ${ACCENT}`, background: isOpen ? `${ACCENT}06` : 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}>
              <div style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}><ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} /></div>
              <Calendar size={13} style={{ color: ACCENT }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', textTransform: 'capitalize', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${ACCENT}15`, color: ACCENT }}>{items.length} parcela(s)</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: ACCENT2, fontWeight: 600, textTransform: 'uppercase' }}>Líquido</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, fontFamily: 'monospace' }}>{fmtCur(Math.max(0, totalLiq))}</div>
              </div>
            </button>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <Th f="nome" label="Aluno" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="turma" label="Turma" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="evento" label="Evento" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="parcela" label="Parc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="vencimento" label="Vencimento" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="valor" label="Valor" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="juros" label="Juros" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="multa" label="Multa" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="desconto" label="Desc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="saldo" label="Líquido" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="statusFinanceiro" label="Status" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                  </tr></thead>
                  <tbody>{items.map((p, idx) => {
                    const bd = statusBadge(p.statusFinanceiro)
                    // Lógica local para prever o liquido baseado na selecao do filtro de tela (se disponível) ou padrão
                    const liqOriginal = p.valor + (p.juros || 0) + (p.multa || 0) - p.desconto
                    return (
                      <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                        <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600 }}>{p.nome}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{p.turma || '—'}</td>
                        <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${ACCENT}12`, color: ACCENT, whiteSpace: 'nowrap' }}>{p.evento || '—'}</span></td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{String(p.parcela).padStart(2, '0')}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center' }}>{fmtDate(p.vencimento)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(p.valor)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.juros > 0 ? ACCENT4 : 'hsl(var(--text-disabled))' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.multa > 0 ? ACCENT4 : 'hsl(var(--text-disabled))' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? ACCENT2 : 'hsl(var(--text-disabled))' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: ACCENT }}>{fmtCur(Math.max(0, liqOriginal))}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: bd.bg, color: bd.color }}>{bd.label}</span></td>
                      </tr>
                    )
                  })}</tbody>
                  <tfoot><tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Subtotal {label} — {items.length} parcela(s)</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{fmtCur(totalValor)}</td>
                    <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: 11, fontFamily: 'monospace', color: ACCENT4 }}>{fmtCur(items.reduce((s, x) => s + (x.juros||0) + (x.multa||0), 0))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: ACCENT2 }}>{totalDesconto > 0 ? `-${fmtCur(totalDesconto)}` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: ACCENT }}>{fmtCur(Math.max(0, totalLiq))}</td>
                    <td />
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* Agrupado por evento */
function ViewPorEvento({ parcelas, sortField, sortDir, onSort, filters }: { parcelas: Parcela[]; sortField: string; sortDir: 'asc' | 'desc'; onSort: (f: string) => void; filters: Filters }) {
  const byEvento = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => { const k = p.evento || 'Sem evento'; if (!map[k]) map[k] = []; map[k].push(p) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => {
      const totalLiq = items.reduce((s, p) => s + p.valor + (filters.somarJurosMulta ? (p.juros||0)+(p.multa||0) : 0) - (filters.somarDesconto ? p.desconto : 0), 0)
      return { key: k, items, totalValor: items.reduce((s, p) => s + p.valor, 0), totalSaldo: items.reduce((s, p) => s + p.saldo, 0), totalLiq }
    })
  }, [parcelas, filters])

  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div>
      {byEvento.map(({ key, items, totalValor, totalSaldo, totalLiq }) => {
        const isOpen = open.has(key)
        return (
          <div key={key} style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
            <button onClick={() => toggle(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', borderBottom: isOpen ? '1px solid hsl(var(--border-subtle))' : 'none', borderLeft: `4px solid #0369a1`, background: isOpen ? 'rgba(3,105,161,0.04)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}>
              <div style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}><ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} /></div>
              <Tag size={13} style={{ color: '#0369a1' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', flex: 1 }}>{key}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(3,105,161,0.12)', color: '#0369a1' }}>{items.length} parc.</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: ACCENT, fontWeight: 600, textTransform: 'uppercase' }}>Líquido</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0369a1', fontFamily: 'monospace' }}>{fmtCur(Math.max(0, totalLiq))}</div>
              </div>
            </button>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <Th f="nome" label="Aluno" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="turma" label="Turma" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="parcela" label="Parc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="vencimento" label="Vencimento" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="valor" label="Valor" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="juros" label="J/M" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="desconto" label="Desc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="saldo" label="Líquido" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="statusFinanceiro" label="Status" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                  </tr></thead>
                  <tbody>{items.map((p, idx) => {
                    const bd = statusBadge(p.statusFinanceiro)
                    const jm = (p.juros || 0) + (p.multa || 0)
                    const liqOriginal = p.valor + (filters.somarJurosMulta ? jm : 0) - (filters.somarDesconto ? p.desconto : 0)
                    return (
                      <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                        <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600 }}>{p.nome}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{p.turma || '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{String(p.parcela).padStart(2, '0')}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center' }}>{fmtDate(p.vencimento)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(p.valor)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: jm > 0 ? ACCENT4 : 'hsl(var(--text-disabled))' }}>{jm > 0 ? `+${fmtCur(jm)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? ACCENT2 : 'hsl(var(--text-disabled))' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0369a1' }}>{fmtCur(Math.max(0, liqOriginal))}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: bd.bg, color: bd.color }}>{bd.label}</span></td>
                      </tr>
                    )
                  })}</tbody>
                  <tfoot><tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                    <td colSpan={4} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Subtotal {key}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{fmtCur(totalValor)}</td>
                    <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#666' }}>Resumo Base</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: '#0369a1' }}>{fmtCur(Math.max(0, totalLiq))}</td>
                    <td />
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* Agrupado por aluno + responsável */
function ViewPorAluno({ parcelas, showResponsavel, sortField, sortDir, onSort, filters }: {
  parcelas: Parcela[]; showResponsavel: boolean
  sortField: string; sortDir: 'asc' | 'desc'; onSort: (f: string) => void; filters: Filters
}) {
  const byAluno = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => { if (!map[p.alunoId]) map[p.alunoId] = []; map[p.alunoId].push(p) })
    return Object.values(map).map(items => {
      const totalLiq = items.reduce((s, p) => s + p.valor + (filters.somarJurosMulta ? (p.juros||0)+(p.multa||0) : 0) - (filters.somarDesconto ? p.desconto : 0), 0)
      return {
        nome: items[0].nome, codigo: items[0].codigo, turma: items[0].turma,
        responsavel: items[0].responsavelFinanceiro, cpf: items[0].cpfResponsavel,
        email: items[0].emailResponsavel, celular: items[0].celularResponsavel || items[0].telefoneResponsavel,
        endereco: [items[0].enderecoResponsavel, items[0].numeroResponsavel, items[0].bairroResponsavel, items[0].cidadeResponsavel, items[0].ufResponsavel].filter(Boolean).join(', '),
        parentesco: items[0].parentescoResponsavel,
        items, totalValor: items.reduce((s, p) => s + p.valor, 0), totalSaldo: items.reduce((s, p) => s + p.saldo, 0), totalLiq
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [parcelas, filters])

  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div>
      {byAluno.map(g => {
        const isOpen = open.has(g.codigo)
        return (
          <div key={g.codigo} style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
            <button onClick={() => toggle(g.codigo)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', border: 'none', borderBottom: isOpen ? '1px solid hsl(var(--border-subtle))' : 'none', borderLeft: `4px solid ${ACCENT2}`, background: isOpen ? `${ACCENT2}04` : 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}>
              <div style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', marginTop: 3 }}><ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: showResponsavel && g.responsavel ? 8 : 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ACCENT2}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} style={{ color: ACCENT2 }} /></div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{g.nome}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(0,0,0,0.06)', color: 'hsl(var(--text-muted))' }}>#{g.codigo}</span>
                  {g.turma && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${ACCENT}12`, color: ACCENT }}>{g.turma}</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${ACCENT2}12`, color: ACCENT2 }}>{g.items.length} parc.</span>
                </div>
                {showResponsavel && g.responsavel && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', padding: '7px 10px', borderRadius: 7, background: 'hsl(var(--bg-elevated))', marginLeft: 38 }}>
                    <InfoChip label="Responsável" value={g.responsavel} />
                    {g.parentesco && <InfoChip label="Parentesco" value={g.parentesco} />}
                    {g.cpf && <InfoChip label="CPF" value={g.cpf} mono />}
                    {g.celular && <InfoChip label="Celular" value={g.celular} />}
                    {g.email && <InfoChip label="E-mail" value={g.email} />}
                    {g.endereco && <InfoChip label="Endereço" value={g.endereco} />}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, alignSelf: 'center' }}>
                <div style={{ fontSize: 9, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Líquido</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT, fontFamily: 'monospace' }}>{fmtCur(Math.max(0, g.totalLiq))}</div>
              </div>
            </button>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <Th f="evento" label="Evento" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                    <Th f="parcela" label="Parc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="vencimento" label="Vencimento" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    <Th f="valor" label="Valor" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="juros" label="J/M" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="desconto" label="Desc." sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="saldo" label="Líquido" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    <Th f="statusFinanceiro" label="Status" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                  </tr></thead>
                  <tbody>{g.items.map((p, idx) => {
                    const bd = statusBadge(p.statusFinanceiro)
                    const jm = (p.juros || 0) + (p.multa || 0)
                    const liqOriginal = p.valor + (filters.somarJurosMulta ? jm : 0) - (filters.somarDesconto ? p.desconto : 0)
                    return (
                      <tr key={`${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                        <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${ACCENT}12`, color: ACCENT }}>{p.evento || '—'}</span></td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{String(p.parcela).padStart(2, '0')}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center' }}>{fmtDate(p.vencimento)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(p.valor)}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: jm > 0 ? ACCENT4 : 'hsl(var(--text-disabled))' }}>{jm > 0 ? `+${fmtCur(jm)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? ACCENT2 : 'hsl(var(--text-disabled))' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: ACCENT }}>{fmtCur(Math.max(0, liqOriginal))}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: bd.bg, color: bd.color }}>{bd.label}</span></td>
                      </tr>
                    )
                  })}</tbody>
                  <tfoot><tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                    <td colSpan={6} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Total {g.nome}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: ACCENT }}>{fmtCur(Math.max(0, g.totalLiq))}</td>
                    <td />
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_FILTERS: Filters = {
  dataInicio: thisYearStart(),
  dataFim: thisYearEnd(),
  grupoAluno: '', nivelEnsino: '', statusPagamento: '',
  unidade: '', anoLetivo: String(new Date().getFullYear()),
  turmas: [], eventos: [],
  opcaoParcelas: 'todas',
  ordenarPor: 'vencimento',
  busca: '',
  somarDesconto: true,
  somarJurosMulta: true,
}

export default function PrevisaoRecebimentosPage() {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const { mantenedores, cfgGruposAlunos, cfgNiveisEnsino, turmas: turmasCtx, cfgEventos } = useData() as any

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')

  const [modelo, setModelo] = useState<ModeloRelatorio>('resumo')
  const [showFilters, setShowFilters] = useState(true)
  const [sortField, setSortField] = useState('vencimento')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [busca, setBusca] = useState('')

  // Modal states
  const [showTurmasModal, setShowTurmasModal] = useState(false)
  const [showEventosModal, setShowEventosModal] = useState(false)

  // ── Derived options ──
  const grupoOptions = useMemo(() => (cfgGruposAlunos || []).filter((g: any) => g.situacao !== 'inativo'), [cfgGruposAlunos])
  const nivelOptions = useMemo(() => (cfgNiveisEnsino || []).filter((n: any) => n.situacao !== 'inativo'), [cfgNiveisEnsino])

  const turmaOptions = useMemo(() => {
    const items = turmasCtx || []
    return items.filter((t: any) => {
      if (filters.anoLetivo && String(t.ano) !== filters.anoLetivo) return false
      if (filters.unidade && !norm(t.unidade || '').includes(norm(filters.unidade))) return false
      return true
    }).map((t: any) => t.nome).filter(Boolean)
  }, [turmasCtx, filters.anoLetivo, filters.unidade])

  const unidadeOptions = useMemo(() => {
    const m = (mantenedores as any)?.[0]
    if (!m?.unidades) return []
    return m.unidades.map((u: any) => ({ id: u.id, label: u.nomeFantasia || u.razaoSocial }))
  }, [mantenedores])

  const eventosDisponiveis = useMemo(() => {
    const fromConfig = (cfgEventos || []).map((e: any) => e.descricao).filter(Boolean)
    const fromRows = [...new Set(parcelas.map(r => r.evento).filter(Boolean))]
    return [...new Set([...fromConfig, ...fromRows])].sort() as string[]
  }, [cfgEventos, parcelas])

  const yrOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y + 1, y, y - 1, y - 2].map(String)
  }, [])

  // ── Fetch ──
  const handleApply = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Send minimal server-side filters — let date range + status do the heavy lifting.
      // Do NOT send anoLetivo to server: the engine compares against matricula year,
      // but parcelas have their own vencimento year. Filter client-side instead.
      // Do NOT send turma to server for multi-select; always filter client-side.
      const serverFilters: Record<string, string> = {
        dataInicio: filters.dataInicio || '',
        dataFim: filters.dataFim || '',
        unidade: filters.unidade || '',
        // only send statusFinanceiro if a specific status was chosen (not 'todos' / '')
        statusFinanceiro: (filters.statusPagamento && filters.statusPagamento !== 'todos')
          ? filters.statusPagamento
          : '',
      }

      const body = {
        source: 'financeiro_previsao',
        filters: serverFilters,
        page: 1,
        pageSize: 99999,
        sortField,
        sortDir,
      }

      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `Erro ${res.status}`)
      }

      const data = await res.json()
      let rows: Parcela[] = data.data || []

      // ── Client-side filters ──────────────────────────────────────────────────

      // Turmas (multi-select, client-side only)
      if (filters.turmas.length > 0) {
        rows = rows.filter(p => filters.turmas.includes(p.turma))
      }

      // Eventos (multi-select, client-side only)
      if (filters.eventos.length > 0) {
        rows = rows.filter(p => filters.eventos.includes(p.evento))
      }

      // Opção de parcelas
      if (filters.opcaoParcelas === 'em-aberto') {
        rows = rows.filter(p => p.statusFinanceiro !== 'pago' && p.statusFinanceiro !== 'cancelado')
      }

      // Ano letivo — compare vencimento year (from DD/MM/YYYY or YYYY-MM-DD)
      if (filters.anoLetivo) {
        rows = rows.filter(p => {
          const v = p.vencimento || ''
          let year = ''
          if (v.includes('/')) {
            // DD/MM/YYYY → extract last 4 chars
            year = v.split('/')[2]?.slice(0, 4) || ''
          } else {
            year = v.slice(0, 4)
          }
          // also accept anoLetivo from the record itself
          if (!year) year = String(p.anoLetivo || '')
          return year === filters.anoLetivo
        })
      }

      // Nível de ensino — via série
      if (filters.nivelEnsino) {
        const nivel = nivelOptions.find((n: any) => n.id === filters.nivelEnsino)
        if (nivel) {
          const serieNomes = (nivel.series || []).map((s: any) => norm(s.nome))
          rows = rows.filter(p => serieNomes.some((s: string) => norm(p.serie || '').includes(s)))
        }
      }

      // Grupo de aluno (if grupoAluno has turmaIds or similar, filter here)
      // Currently groups may not map to parcelas directly — skip unless configured

      // Free-text busca
      if (filters.busca) {
        const q = norm(filters.busca)
        rows = rows.filter(p =>
          norm(p.nome).includes(q) ||
          norm(p.turma || '').includes(q) ||
          norm(p.evento || '').includes(q) ||
          (p.codigo || '').toLowerCase().includes(q) ||
          norm(p.responsavelFinanceiro || '').includes(q)
        )
      }

      setParcelas(rows)
      setHasLoaded(true)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar dados. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }, [filters, sortField, sortDir, nivelOptions])

  const handleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc') } }

  // Final display: quick search bar (separate from the main busca filter in handleApply)
  const filtered = useMemo(() => {
    if (!busca) return parcelas
    const q = norm(busca)
    return parcelas.filter(p =>
      norm(p.nome).includes(q) || norm(p.turma || '').includes(q) ||
      norm(p.evento || '').includes(q) || (p.codigo || '').toLowerCase().includes(q) ||
      norm(p.responsavelFinanceiro || '').includes(q)
    )
  }, [parcelas, busca])

  // Sort filtered
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = (a as any)[sortField], vb = (b as any)[sortField]
      if (va === vb) return 0
      if (typeof va === 'number') return (va - vb) * dir
      return String(va || '').localeCompare(String(vb || ''), 'pt-BR') * dir
    })
  }, [filtered, sortField, sortDir])

  const kpis = useMemo(() => ({
    total: sorted.length,
    valor: sorted.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    jurosMulta: sorted.reduce((s, p) => s + (Number(p.juros) || 0) + (Number(p.multa) || 0), 0),
    desconto: sorted.reduce((s, p) => s + (Number(p.desconto) || 0), 0),
    saldo: sorted.reduce((s, p) => s + (Number(p.saldo) || 0), 0),
    alunos: new Set(sorted.map(p => p.alunoId)).size,
    qtdParcelas: sorted.length,
    pendentes: sorted.filter(p => p.statusFinanceiro === 'pendente').length,
    vencidas: sorted.filter(p => p.statusFinanceiro === 'vencido').length,
  }), [sorted])

  const kpiLiquido = useMemo(() => {
    let liq = Number(kpis.valor) || 0
    if (filters.somarJurosMulta) liq += (Number(kpis.jurosMulta) || 0)
    if (filters.somarDesconto) liq -= (Number(kpis.desconto) || 0)
    return Math.max(0, liq)
  }, [kpis, filters])

  // Monthly summary for mini-chart
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    sorted.forEach(p => { const k = mesKey(p.vencimento); map[k] = (map[k] || 0) + p.saldo })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: mesLabel(k + '-01').slice(0, 3), value: v }))
  }, [sorted])

  const maxMonthly = Math.max(...monthlyData.map(m => m.value), 1)

  // Excel export
  const exportXLSX = () => {
    const rows: any[][] = [['PREVISÃO DE RECEBIMENTOS'], [`Período: ${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)}`], [], ['Código', 'Aluno', 'Turma', 'Série', 'Unidade', 'Responsável', 'Evento', 'Parcela', 'Vencimento', 'Valor', 'Juros', 'Multa', 'Desconto', 'Líquido', 'Sdo Devedor', 'Status']]
    sorted.forEach(p => {
      const liq = p.valor + (filters.somarJurosMulta ? (p.juros || 0) + (p.multa || 0) : 0) - (filters.somarDesconto ? p.desconto : 0)
      rows.push([p.codigo, p.nome, p.turma, p.serie, p.unidade, p.responsavelFinanceiro, p.evento, p.parcela, fmtDate(p.vencimento), p.valor, p.juros, p.multa, p.desconto, Math.max(0, liq), p.saldo, p.statusFinanceiro])
    })
    rows.push([])
    rows.push(['', '', '', '', '', '', '', '', 'TOTAL:', kpis.valor, kpis.jurosMulta, '', kpis.desconto, kpiLiquido, kpis.saldo, ''])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Previsão de Recebimentos')
    XLSX.writeFile(wb, `previsao-recebimentos-${filters.dataInicio || 'completo'}.xlsx`)
  }

  // PDF print
  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const html = el.innerHTML
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head>
  <meta charset="UTF-8">
  <title>Previsão de Recebimentos</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 10px; background: #fff; }
    table { border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 600)
  }

  const activeFilterCount = [
    filters.dataInicio, filters.dataFim, filters.grupoAluno, filters.nivelEnsino,
    filters.statusPagamento, filters.unidade, ...(filters.turmas.length > 0 ? ['t'] : []),
    ...(filters.eventos.length > 0 ? ['e'] : []),
  ].filter(Boolean).length

  const modeloLabels: Record<ModeloRelatorio, string> = {
    resumo: 'Resumo Mensal',
    'por-evento': 'Por Evento',
    'por-aluno': 'Por Aluno',
    'com-responsavel': 'Com Responsável',
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* PRINT LAYOUT hidden on screen */}
      {hasLoaded && (
        <div id="print-root" ref={printRef} style={{ display: 'none' }}>
          <PrintLayout parcelas={sorted} filters={filters} modelo={modelo} kpis={kpis} />
        </div>
      )}

      <div id="screen-root" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 0 80px' }}>

        {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}><ArrowLeft size={15} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #0369a1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="#fff" />
              </div>
              <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>Previsão de Recebimentos</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Financeiro</span>
            </div>
            <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
              Parcelas a receber — visão estratégica por período, evento, aluno e responsável
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowFilters(!showFilters)} className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} style={{ gap: 5 }}>
              <SlidersHorizontal size={11} /> Filtros {activeFilterCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>{activeFilterCount}</span>}
            </button>
            {hasLoaded && <>
              <button onClick={exportXLSX} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
                <FileSpreadsheet size={11} /> Excel
              </button>
              <button onClick={handlePrint} className="btn btn-sm" style={{ gap: 5, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                <Printer size={11} /> PDF
              </button>
            </>}
          </div>
        </div>

        {/* ═══ FILTER PANEL ═══════════════════════════════════════════════════ */}
        {showFilters && (
          <div className="card" style={{ padding: '20px 22px', marginBottom: 18 }}>
            {/* Filter header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Filter size={13} color={ACCENT} />
              <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtros do Relatório</span>
              {activeFilterCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${ACCENT}15`, color: ACCENT }}>{activeFilterCount} ativo(s)</span>
              )}
              <button onClick={() => setFilters(DEFAULT_FILTERS)} style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={11} /> Limpar tudo
              </button>
            </div>

            {/* Row 1: Dates + Period presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Data Início (vencimento)</label>
                <input type="date" className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.dataInicio} onChange={e => setFilters(f => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Data Fim (vencimento)</label>
                <input type="date" className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.dataFim} onChange={e => setFilters(f => ({ ...f, dataFim: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Users size={10} style={{ display: 'inline', marginRight: 3 }} /> Grupo de Alunos</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.grupoAluno} onChange={e => setFilters(f => ({ ...f, grupoAluno: e.target.value }))}>
                  <option value="">Todos os grupos</option>
                  {grupoOptions.map((g: any) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><GraduationCap size={10} style={{ display: 'inline', marginRight: 3 }} /> Nível de Ensino</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.nivelEnsino} onChange={e => setFilters(f => ({ ...f, nivelEnsino: e.target.value }))}>
                  <option value="">Todos os níveis</option>
                  {nivelOptions.map((n: any) => <option key={n.id} value={n.id}>{n.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><AlertCircle size={10} style={{ display: 'inline', marginRight: 3 }} /> Filtro de Pagamento</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.statusPagamento} onChange={e => setFilters(f => ({ ...f, statusPagamento: e.target.value }))}>
                  <option value="">Todos</option>
                  <option value="pago">Pagos</option>
                  <option value="pendente">Em Aberto</option>
                  <option value="vencido">Vencidos</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Building2 size={10} style={{ display: 'inline', marginRight: 3 }} /> Unidade</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.unidade} onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))}>
                  <option value="">Todas as unidades</option>
                  {unidadeOptions.map((u: any) => <option key={u.id} value={u.label}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Ano Letivo</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))}>
                  {yrOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Hash size={10} style={{ display: 'inline', marginRight: 3 }} /> Opções de Parcelas</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.opcaoParcelas} onChange={e => setFilters(f => ({ ...f, opcaoParcelas: e.target.value as OpcaoParcelas }))}>
                  <option value="todas">Toda a previsão</option>
                  <option value="em-aberto">Somente parcelas em aberto</option>
                </select>
              </div>
            </div>

            {/* Row 2: Modal triggers + ordenar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
              {/* Turmas modal */}
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><BookOpen size={10} style={{ display: 'inline', marginRight: 3 }} /> Turma</label>
                <button onClick={() => setShowTurmasModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', fontSize: 11, width: '100%', background: filters.turmas.length > 0 ? `${ACCENT}12` : 'hsl(var(--bg-input))', border: `1px solid ${filters.turmas.length > 0 ? ACCENT + '40' : 'hsl(var(--border-default))'}`, borderRadius: 4, cursor: 'pointer', color: 'hsl(var(--text-primary))' }}>
                  <span>{filters.turmas.length === 0 ? 'Selecionar turmas...' : `${filters.turmas.length} turma(s)`}</span>
                  <ListFilter size={11} color={ACCENT} />
                </button>
                {filters.turmas.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {filters.turmas.slice(0, 3).map(t => <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${ACCENT}15`, color: ACCENT }}>{t}</span>)}
                    {filters.turmas.length > 3 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'hsl(var(--text-muted))' }}>+{filters.turmas.length - 3}</span>}
                  </div>
                )}
              </div>

              {/* Eventos modal */}
              <div>
                <label className="form-label" style={{ fontSize: 10 }}><Layers size={10} style={{ display: 'inline', marginRight: 3 }} /> Evento</label>
                <button onClick={() => setShowEventosModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', fontSize: 11, width: '100%', background: filters.eventos.length > 0 ? `${ACCENT}12` : 'hsl(var(--bg-input))', border: `1px solid ${filters.eventos.length > 0 ? ACCENT + '40' : 'hsl(var(--border-default))'}`, borderRadius: 4, cursor: 'pointer', color: 'hsl(var(--text-primary))' }}>
                  <span>{filters.eventos.length === 0 ? 'Selecionar eventos...' : `${filters.eventos.length} evento(s)`}</span>
                  <ListFilter size={11} color={ACCENT} />
                </button>
                {filters.eventos.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {filters.eventos.slice(0, 2).map(e => <span key={e} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${ACCENT}15`, color: ACCENT }}>{e.length > 18 ? e.slice(0, 18) + '…' : e}</span>)}
                    {filters.eventos.length > 2 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'hsl(var(--text-muted))' }}>+{filters.eventos.length - 2}</span>}
                  </div>
                )}
                {/* Controls */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, marginTop: 4, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <button
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, somarDesconto: !f.somarDesconto }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                    ...(filters.somarDesconto
                      ? { background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }
                      : { background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', borderColor: 'hsl(var(--border-default))' })
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: filters.somarDesconto ? '#10b981' : 'transparent', border: filters.somarDesconto ? 'none' : '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {filters.somarDesconto && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  Deduzir Descontos da Tela
                </button>
                <button
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, somarJurosMulta: !f.somarJurosMulta }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                    ...(filters.somarJurosMulta
                      ? { background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }
                      : { background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', borderColor: 'hsl(var(--border-default))' })
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: filters.somarJurosMulta ? '#ef4444' : 'transparent', border: filters.somarJurosMulta ? 'none' : '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {filters.somarJurosMulta && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  Somar Juros/Multa no Líquido
                </button>
              </div>

            </div>

              {/* Ordenar por */}
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Ordenar por</label>
                <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.ordenarPor} onChange={e => { const v = e.target.value as OrdenarPor; setFilters(f => ({ ...f, ordenarPor: v })); setSortField(v === 'codigo' ? 'codigo' : v === 'nome' ? 'nome' : v === 'turma' ? 'turma' : v === 'evento' ? 'evento' : 'vencimento') }}>
                  <option value="vencimento">Vencimento</option>
                  <option value="nome">Nome do Aluno</option>
                  <option value="codigo">Código do Aluno</option>
                  <option value="turma">Turma</option>
                  <option value="evento">Código do Curso / Evento</option>
                </select>
              </div>
            </div>

            {/* Apply button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <X size={11} /> Limpar
              </button>
              <button onClick={handleApply} className="btn btn-primary btn-sm" style={{ gap: 5, background: ACCENT, minWidth: 120, borderColor: ACCENT }} disabled={loading}>
                {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                {loading ? 'Gerando...' : 'Gerar Relatório'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ MODELO SELECTOR ════════════════════════════════════════════════ */}
        {hasLoaded && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Modelo:</span>
            {(['resumo', 'por-evento', 'por-aluno', 'com-responsavel'] as ModeloRelatorio[]).map(m => (
              <button key={m} onClick={() => setModelo(m)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: modelo === m ? `1.5px solid ${ACCENT}` : '1px solid hsl(var(--border-default))', background: modelo === m ? `${ACCENT}15` : 'hsl(var(--bg-surface))', color: modelo === m ? ACCENT : 'hsl(var(--text-secondary))', transition: 'all 0.15s' }}>
                {m === 'resumo' && '📊 '}
                {m === 'por-evento' && '🏷️ '}
                {m === 'por-aluno' && '👤 '}
                {m === 'com-responsavel' && '📋 '}
                {modeloLabels[m]}
              </button>
            ))}

            {/* Quick search */}
            <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 220 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na lista..." className="form-input" style={{ paddingLeft: 28, fontSize: 11, padding: '6px 10px 6px 28px' }} />
            </div>
          </div>
        )}

        {/* ═══ ERROR ══════════════════════════════════════════════════════════ */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dc2626' }}>
            <AlertCircle size={14} />{error}
          </div>
        )}

        {/* ═══ EMPTY STATE ════════════════════════════════════════════════════ */}
        {!hasLoaded && !loading && (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))' }}>
            <TrendingUp size={40} style={{ color: ACCENT, margin: '0 auto 14px', display: 'block', opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>Relatório de Previsão de Recebimentos</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Configure os filtros e clique em <strong>Gerar Relatório</strong> para visualizar a previsão de recebimentos.</div>
            <button onClick={handleApply} className="btn btn-primary" style={{ background: ACCENT, borderColor: ACCENT, gap: 6, display: 'inline-flex', alignItems: 'center' }}>
              <TrendingUp size={14} /> Gerar Relatório
            </button>
          </div>
        )}

        {loading && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <Loader2 size={32} style={{ color: ACCENT, margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Gerando previsão de recebimentos...</div>
          </div>
        )}

        {/* ═══ RESULTS ════════════════════════════════════════════════════════ */}
        {hasLoaded && !loading && (
          <>
            {/* KPI Bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <KpiCard label="Total Previsto" value={fmtCur(kpis.valor)} icon={<DollarSign size={16} />} color={ACCENT} sub={`${kpis.qtdParcelas} parcela(s)`} />
              <KpiCard label="Descontos" value={fmtCur(kpis.desconto)} icon={<Tag size={16} />} color={ACCENT2} sub={kpis.valor > 0 ? fmtPct(kpis.desconto / kpis.valor * 100) : '0.0%'} />
              <KpiCard label="A Receber (Líquido)" value={fmtCur(kpiLiquido)} icon={<TrendingUp size={16} />} color="#0369a1" sub="c/ juros, multas e desc." />
              <KpiCard label="Em Aberto" value={String(kpis.pendentes)} icon={<Clock size={16} />} color={ACCENT3} sub="parcelas pendentes" size="sm" />
              <KpiCard label="Vencidas" value={String(kpis.vencidas)} icon={<AlertCircle size={16} />} color={ACCENT4} sub="a receber em atraso" size="sm" />
              <KpiCard label="Alunos" value={String(kpis.alunos)} icon={<Users size={16} />} color="#7c3aed" sub="com parcelas no período" size="sm" />
            </div>

            {/* Mini monthly chart */}
            {monthlyData.length > 1 && (
              <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <BarChart3 size={13} color={ACCENT} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previsão por Mês</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                  {monthlyData.map(m => (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                      <div style={{ width: '100%', maxWidth: 40, height: Math.max(4, (m.value / maxMonthly) * 48), background: ACCENT, borderRadius: '3px 3px 0 0', opacity: 0.85, transition: 'height 0.3s' }} title={fmtCur(m.value)} />
                      <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zero results */}
            {sorted.length === 0 && (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <CheckCircle size={32} style={{ color: ACCENT2, margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Nenhuma parcela encontrada</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Nenhuma parcela corresponde aos filtros selecionados.</div>
              </div>
            )}

            {/* Data views */}
            {sorted.length > 0 && (
              <>
                {modelo === 'resumo' && <ViewResumo parcelas={sorted} sortField={sortField} sortDir={sortDir} onSort={handleSort} filters={filters} />}
                {modelo === 'por-evento' && <ViewPorEvento parcelas={sorted} sortField={sortField} sortDir={sortDir} onSort={handleSort} filters={filters} />}
                {modelo === 'por-aluno' && <ViewPorAluno parcelas={sorted} showResponsavel={false} sortField={sortField} sortDir={sortDir} onSort={handleSort} filters={filters} />}
                {modelo === 'com-responsavel' && <ViewPorAluno parcelas={sorted} showResponsavel sortField={sortField} sortDir={sortDir} onSort={handleSort} filters={filters} />}

                {/* Grand total bar */}
                <div style={{ marginTop: 12, borderRadius: 12, border: `1.5px solid ${ACCENT}`, background: `${ACCENT}08`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TOTAL GERAL LÍQUIDO</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {kpis.alunos} alunos · {kpis.qtdParcelas} parcelas · {fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase' }}>Vlr. Original</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: 'hsl(var(--text-primary))' }}>{fmtCur(kpis.valor)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: ACCENT4, fontWeight: 700, textTransform: 'uppercase' }}>+ Juros/Multa</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: ACCENT4 }}>{fmtCur(kpis.jurosMulta)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: ACCENT2, fontWeight: 700, textTransform: 'uppercase' }}>- Descontos</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: ACCENT2 }}>{fmtCur(kpis.desconto)}</div>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: `2px solid ${ACCENT}`, paddingLeft: 20 }}>
                      <div style={{ fontSize: 9, color: ACCENT, fontWeight: 700, textTransform: 'uppercase' }}>Líquido (Base: {filters.somarDesconto && filters.somarJurosMulta ? 'Completa' : 'Parcial'})</div>
                      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: ACCENT }}>{fmtCur(kpiLiquido)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ═══ MODALS ═════════════════════════════════════════════════════════ */}
      {showTurmasModal && (
        <SelectionModal
          title="Selecionar Turmas"
          icon={<BookOpen size={15} />}
          items={turmaOptions}
          selected={filters.turmas}
          onClose={() => setShowTurmasModal(false)}
          onApply={sel => setFilters(f => ({ ...f, turmas: sel }))}
          searchPlaceholder="Buscar turma..."
          extraContent={
            <div>
              <label className="form-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} /> Localizar turmas registradas no Ano:
              </label>
              <select className="form-input" style={{ fontSize: 11, padding: '6px 10px', background: 'hsl(var(--bg-input))' }} value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))}>
                <option value="">Todos os anos vigentes</option>
                {yrOptions.map(y => <option key={y} value={y}>Ano Letivo {y}</option>)}
              </select>
            </div>
          }
        />
      )}
      {showEventosModal && (
        <SelectionModal
          title="Selecionar Eventos"
          icon={<Layers size={15} />}
          items={eventosDisponiveis}
          selected={filters.eventos}
          onClose={() => setShowEventosModal(false)}
          onApply={sel => setFilters(f => ({ ...f, eventos: sel }))}
          searchPlaceholder="Buscar evento..."
        />
      )}
    </>
  )
}
