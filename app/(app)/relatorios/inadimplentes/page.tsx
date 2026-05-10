'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  TrendingDown, Filter, RefreshCw, FileSpreadsheet, Printer,
  ArrowLeft, Search, RotateCcw, Users, Calendar, ChevronRight,
  AlertTriangle, DollarSign, Hash, Tag, Clock, Eye, EyeOff, Layers, X, CheckCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'


// ─── Types ────────────────────────────────────────────────────────────────────

interface Parcela {
  alunoId: string
  codigo: string
  nome: string
  turma: string
  serie: string
  unidade: string
  responsavelFinanceiro: string
  cpfResponsavel: string
  rgResponsavel: string
  emailResponsavel: string
  telefoneResponsavel: string
  celularResponsavel: string
  enderecoResponsavel: string
  numeroResponsavel: string
  complementoResponsavel: string
  bairroResponsavel: string
  cidadeResponsavel: string
  ufResponsavel: string
  cepResponsavel: string
  profissaoResponsavel: string
  empresaResponsavel: string
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
  diasAtraso: number
  statusFinanceiro: string
  anoLetivo: number
}

interface Kpis {
  total: number; saldo: number; valor: number; juros: number
  multa: number; desconto: number; alunos: number; responsaveis: number; maxDias: number
}

type Visao = 'geral' | 'por-responsavel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCur = (n: number) => `R$ ${fmtR(Math.abs(n))}`

const todayISO = () => new Date().toISOString().slice(0, 10)
const thisMonthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const lastMonthStart = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
const lastMonthEnd = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10) }

function calcDiasAtraso(venc: string): number {
  if (!venc) return 0
  const iso = venc.includes('/') ? venc.split('/').reverse().join('-') : venc
  const diff = Date.now() - new Date(iso + 'T12:00:00').getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function fmtDate(s: string): string {
  if (!s) return '—'
  if (s.includes('/')) { const parts = s.split('/'); if (parts.length === 3 && parts[0].length <= 2) return s }
  const clean = s.slice(0, 10)
  const [y, m, d] = clean.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function atrasoBadge(dias: number): { label: string; bg: string; color: string } {
  if (dias <= 30) return { label: `${dias}d`, bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
  if (dias <= 60) return { label: `${dias}d`, bg: 'rgba(239,68,68,0.12)', color: '#dc2626' }
  if (dias <= 90) return { label: `${dias}d`, bg: 'rgba(220,38,38,0.18)', color: '#b91c1c' }
  return { label: `${dias}d`, bg: 'rgba(127,29,29,0.25)', color: '#7f1d1d' }
}

function mesLabel(venc: string): string {
  const clean = (venc || '').slice(0, 10)
  const [y, m] = clean.split('-')
  if (!y || !m) return 'Sem data'
  return new Date(Number(y), Number(m) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

// ─── InfoChip ─────────────────────────────────────────────────────────────────

function InfoChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, danger }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; danger?: boolean
}) {
  return (
    <div className="card" style={{
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 150,
      borderLeft: `3px solid ${color}`,
      background: danger ? `linear-gradient(135deg, hsl(var(--bg-surface)), ${color}06)` : undefined,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: danger ? color : 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── GeralView (Screen) ───────────────────────────────────────────────────────

function GeralView({ parcelas, sortField, sortDir, onSort }: {
  parcelas: Parcela[]; sortField: string; sortDir: 'asc' | 'desc'; onSort: (f: string) => void
}) {
  const byMes = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => {
      const raw = p.vencimento || ''
      let key = raw.slice(0, 7)
      if (raw.includes('/')) { const pts = raw.split('/'); key = `${pts[2]}-${pts[1].padStart(2, '0')}` }
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({
      key, label: mesLabel(key + '-01'), items,
      totalSaldo: items.reduce((s, p) => s + p.saldo, 0),
      totalValor: items.reduce((s, p) => s + p.valor, 0),
      totalJuros: items.reduce((s, p) => s + p.juros, 0),
      totalMulta: items.reduce((s, p) => s + p.multa, 0),
      totalDesc: items.reduce((s, p) => s + p.desconto, 0),
      qtd: items.length,
    }))
  }, [parcelas])

  const [openMeses, setOpenMeses] = useState<Set<string>>(new Set(['all']))
  const toggleMes = (key: string) => setOpenMeses(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const Th = ({ f, label, align = 'left' }: { f: string; label: string; align?: string }) => (
    <th onClick={() => onSort(f)} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: sortField === f ? '#3b82f6' : 'hsl(var(--text-muted))', padding: '7px 10px', textAlign: align as any, cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap', background: 'hsl(var(--bg-elevated))', userSelect: 'none' }}>
      {label} {sortField === f ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div>
      {byMes.map(({ key, label, items, totalSaldo, totalValor, totalJuros, totalMulta, totalDesc, qtd }) => {
        const isOpen = openMeses.has(key) || openMeses.has('all')
        const badge = atrasoBadge(Math.max(...items.map(p => p.diasAtraso)))
        return (
          <div key={key} style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
            <button onClick={() => toggleMes(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', borderBottom: isOpen ? '1px solid hsl(var(--border-subtle))' : 'none', borderLeft: '4px solid #ef4444', background: isOpen ? 'rgba(239,68,68,0.04)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}>
              <div style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}><ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={13} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', textTransform: 'capitalize' }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{qtd} parcela{qtd !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: badge.bg, color: badge.color }}>Máx {badge.label} atraso</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Valor</div><div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{fmtCur(totalValor)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>Em Aberto</div><div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>{fmtCur(totalSaldo)}</div></div>
              </div>
            </button>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th f="nome" label="Aluno" /><Th f="turma" label="Turma" /><Th f="responsavelFinanceiro" label="Responsável" /><Th f="evento" label="Evento" /><Th f="parcela" label="Parc." align="center" /><Th f="vencimento" label="Vencimento" align="center" /><Th f="diasAtraso" label="Atraso" align="center" /><Th f="valor" label="Valor" align="right" /><Th f="desconto" label="Desc." align="right" /><Th f="juros" label="Juros" align="right" /><Th f="multa" label="Multa" align="right" /><Th f="saldo" label="Saldo Due" align="right" /></tr></thead>
                  <tbody>
                    {items.map((p, idx) => {
                      const bd = atrasoBadge(p.diasAtraso)
                      return (
                        <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                          <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600 }}>{p.nome}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{p.turma || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{p.responsavelFinanceiro || '—'}</td>
                          <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(139,92,246,0.1)', color: '#7c3aed', whiteSpace: 'nowrap' }}>{p.evento || '—'}</span></td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{String(p.parcela).padStart(2, '0')}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center' }}>{fmtDate(p.vencimento)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: bd.bg, color: bd.color }}>{bd.label}</span></td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(p.valor)}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? '#10b981' : 'hsl(var(--text-disabled))' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.juros > 0 ? '#f59e0b' : 'hsl(var(--text-disabled))' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.multa > 0 ? '#dc2626' : 'hsl(var(--text-disabled))' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>{fmtCur(p.saldo)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                      <td colSpan={7} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Subtotal {label} — {qtd} parcela{qtd !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{fmtCur(totalValor)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#10b981' }}>{totalDesc > 0 ? `-${fmtCur(totalDesc)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#f59e0b' }}>{totalJuros > 0 ? `+${fmtCur(totalJuros)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#dc2626' }}>{totalMulta > 0 ? `+${fmtCur(totalMulta)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: '#ef4444' }}>{fmtCur(totalSaldo)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── RespView (Screen) ────────────────────────────────────────────────────────

function RespView({ parcelas }: { parcelas: Parcela[] }) {
  const byResp = useMemo(() => {
    const map: Record<string, { resp: string; sample: Parcela; items: Parcela[] }> = {}
    parcelas.forEach(p => {
      const key = p.responsavelFinanceiro || '(Sem responsável)'
      if (!map[key]) map[key] = { resp: key, sample: p, items: [] }
      map[key].items.push(p)
    })
    return Object.values(map)
      .sort((a, b) => b.items.reduce((s, p) => s + p.saldo, 0) - a.items.reduce((s, p) => s + p.saldo, 0))
      .map(g => ({ ...g, totalSaldo: g.items.reduce((s, p) => s + p.saldo, 0), totalValor: g.items.reduce((s, p) => s + p.valor, 0), totalJuros: g.items.reduce((s, p) => s + p.juros, 0), totalMulta: g.items.reduce((s, p) => s + p.multa, 0), totalDesc: g.items.reduce((s, p) => s + p.desconto, 0), qtdAlunos: new Set(g.items.map(p => p.alunoId)).size, qtdParcelas: g.items.length, maxAtraso: Math.max(...g.items.map(p => p.diasAtraso)) }))
  }, [parcelas])

  const [openResps, setOpenResps] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpenResps(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div>
      {byResp.map(g => {
        const isOpen = openResps.has(g.resp)
        const badge = atrasoBadge(g.maxAtraso)
        const s = g.sample
        const endLine1 = [s.enderecoResponsavel, s.numeroResponsavel, s.complementoResponsavel].filter(Boolean).join(', ')
        const endLine2 = [s.bairroResponsavel, s.cidadeResponsavel, s.ufResponsavel].filter(Boolean).join(' / ')
        const endCompleto = [endLine1, endLine2].filter(Boolean).join(' — ')
        return (
          <div key={g.resp} style={{ marginBottom: 10, borderRadius: 14, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
            <button onClick={() => toggle(g.resp)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', border: 'none', borderBottom: isOpen ? '1px solid hsl(var(--border-subtle))' : 'none', borderLeft: '4px solid #f59e0b', background: isOpen ? 'rgba(245,158,11,0.04)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}>
              <div style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', marginTop: 3, flexShrink: 0 }}><ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={15} style={{ color: '#f59e0b' }} /></div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{g.resp}</span>
                  {s.parentescoResponsavel && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{s.parentescoResponsavel}</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>{g.qtdAlunos} aluno{g.qtdAlunos !== 1 ? 's' : ''} · {g.qtdParcelas} parcela{g.qtdParcelas !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: badge.bg, color: badge.color }}>Máx {badge.label} atraso</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', padding: '8px 12px', borderRadius: 8, background: 'hsl(var(--bg-elevated))', marginLeft: 40 }}>
                  <InfoChip label="CPF" value={s.cpfResponsavel} mono />
                  <InfoChip label="RG" value={s.rgResponsavel} mono />
                  <InfoChip label="Celular" value={s.celularResponsavel || s.telefoneResponsavel} />
                  <InfoChip label="E-mail" value={s.emailResponsavel} />
                  {endCompleto && <InfoChip label="Endereço" value={endCompleto} />}
                  <InfoChip label="CEP" value={s.cepResponsavel} mono />
                  <InfoChip label="Profissão" value={s.profissaoResponsavel} />
                  <InfoChip label="Empresa" value={s.empresaResponsavel} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, alignSelf: 'center', paddingLeft: 12 }}>
                <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Total em Aberto</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>{fmtCur(g.totalSaldo)}</div>
                {(g.totalJuros + g.totalMulta) > 0 && <div style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'monospace', marginTop: 2 }}>+{fmtCur(g.totalJuros + g.totalMulta)} encargos</div>}
              </div>
            </button>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                    {['Aluno', 'Turma', 'Evento', 'Parc.', 'Vencimento', 'Atraso', 'Valor', 'Desc.', 'Juros', 'Multa', 'Saldo Due'].map(h => (
                      <th key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'hsl(var(--text-muted))', padding: '6px 10px', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: ['Valor', 'Desc.', 'Juros', 'Multa', 'Saldo Due'].includes(h) ? 'right' : h === 'Parc.' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {g.items.map((p, idx) => {
                      const bd = atrasoBadge(p.diasAtraso)
                      return (
                        <tr key={`${p.alunoId}-${p.parcela}-${idx}`} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                          <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600 }}>{p.nome}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{p.turma || '—'}</td>
                          <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}>{p.evento || '—'}</span></td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{String(p.parcela).padStart(2, '0')}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'center' }}>{fmtDate(p.vencimento)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: bd.bg, color: bd.color }}>{bd.label}</span></td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(p.valor)}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? '#10b981' : 'hsl(var(--text-disabled))' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.juros > 0 ? '#f59e0b' : 'hsl(var(--text-disabled))' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', color: p.multa > 0 ? '#dc2626' : 'hsl(var(--text-disabled))' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>{fmtCur(p.saldo)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                      <td colSpan={6} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Subtotal {g.resp}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{fmtCur(g.totalValor)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#10b981' }}>{g.totalDesc > 0 ? `-${fmtCur(g.totalDesc)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#f59e0b' }}>{g.totalJuros > 0 ? `+${fmtCur(g.totalJuros)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#dc2626' }}>{g.totalMulta > 0 ? `+${fmtCur(g.totalMulta)}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: '#ef4444' }}>{fmtCur(g.totalSaldo)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRINT LAYOUT — rendered flat (no accordions), shown only on @media print
// ═══════════════════════════════════════════════════════════════════════════════

function PrintLayout({ parcelas, kpis, filters, visao }: {
  parcelas: Parcela[]; kpis: Kpis; filters: Record<string, string>; visao: Visao
}) {
  const now = new Date().toLocaleString('pt-BR')

  // Group by month
  const byMes = useMemo(() => {
    const map: Record<string, Parcela[]> = {}
    parcelas.forEach(p => {
      const raw = p.vencimento || ''
      let key = raw.slice(0, 7)
      if (raw.includes('/')) { const pts = raw.split('/'); key = `${pts[2]}-${pts[1].padStart(2, '0')}` }
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({
      key, label: mesLabel(key + '-01'), items,
      totalSaldo: items.reduce((s, p) => s + p.saldo, 0),
      totalValor: items.reduce((s, p) => s + p.valor, 0),
      totalJuros: items.reduce((s, p) => s + p.juros, 0),
      totalMulta: items.reduce((s, p) => s + p.multa, 0),
      totalDesc: items.reduce((s, p) => s + p.desconto, 0),
    }))
  }, [parcelas])

  // Group by resp
  const byResp = useMemo(() => {
    const map: Record<string, { resp: string; sample: Parcela; items: Parcela[] }> = {}
    parcelas.forEach(p => {
      const key = p.responsavelFinanceiro || '(Sem responsável)'
      if (!map[key]) map[key] = { resp: key, sample: p, items: [] }
      map[key].items.push(p)
    })
    return Object.values(map)
      .sort((a, b) => b.items.reduce((s, p) => s + p.saldo, 0) - a.items.reduce((s, p) => s + p.saldo, 0))
      .map(g => ({ ...g, totalSaldo: g.items.reduce((s, p) => s + p.saldo, 0), totalValor: g.items.reduce((s, p) => s + p.valor, 0), totalJuros: g.items.reduce((s, p) => s + p.juros, 0), totalMulta: g.items.reduce((s, p) => s + p.multa, 0), totalDesc: g.items.reduce((s, p) => s + p.desconto, 0), qtdAlunos: new Set(g.items.map(p => p.alunoId)).size, maxAtraso: Math.max(...g.items.map(p => p.diasAtraso)) }))
  }, [parcelas])

  const P = { // print styles
    page: { fontFamily: 'Arial, sans-serif', color: '#1a1a1a', fontSize: 11 } as React.CSSProperties,
    header: { borderBottom: '2px solid #dc2626', paddingBottom: 10, marginBottom: 14 } as React.CSSProperties,
    school: { fontSize: 18, fontWeight: 700, color: '#dc2626', margin: 0 } as React.CSSProperties,
    subtitle: { fontSize: 11, color: '#555', margin: '2px 0 0' } as React.CSSProperties,
    meta: { fontSize: 9, color: '#777', marginTop: 4 } as React.CSSProperties,
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#fafafa' } as React.CSSProperties,
    kpiItem: { textAlign: 'center' as const, padding: '4px 2px' },
    kpiLabel: { fontSize: 7, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 2 },
    kpiVal: { fontSize: 13, fontWeight: 900, fontFamily: 'monospace' },
    section: { marginBottom: 14, pageBreakInside: 'avoid' as const },
    sectionHead: { background: '#dc2626', color: '#fff', padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' } as React.CSSProperties,
    sectionHeadAmber: { background: '#d97706', color: '#fff', padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 9 },
    th: { background: '#f3f4f6', padding: '4px 6px', textAlign: 'left' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#666', borderBottom: '1px solid #d1d5db', whiteSpace: 'nowrap' as const },
    thR: { background: '#f3f4f6', padding: '4px 6px', textAlign: 'right' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#666', borderBottom: '1px solid #d1d5db', whiteSpace: 'nowrap' as const },
    thC: { background: '#f3f4f6', padding: '4px 6px', textAlign: 'center' as const, fontWeight: 700, fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#666', borderBottom: '1px solid #d1d5db', whiteSpace: 'nowrap' as const },
    td: { padding: '4px 6px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    tdR: { padding: '4px 6px', textAlign: 'right' as const, fontFamily: 'monospace', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    tdC: { padding: '4px 6px', textAlign: 'center' as const, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const },
    foot: { background: '#f9fafb', fontWeight: 700, fontSize: 9 },
    totalRow: { background: '#fef2f2', borderTop: '2px solid #dc2626' },
    respCard: { border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 10, overflow: 'hidden', pageBreakInside: 'avoid' as const },
    respHead: { background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '6px 10px', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'flex-start' } as React.CSSProperties,
    infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '3px 10px', padding: '5px 10px', background: '#fffbf0', borderBottom: '1px solid #fde68a', fontSize: 8 } as React.CSSProperties,
  }

  return (
    <div id="print-layout" style={P.page}>
      {/* ── HEADER ── */}
      <div style={P.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={P.school}>IMPACTO EDU — Sistema de Gestão Escolar</p>
            <p style={P.subtitle}>RELATÓRIO DE INADIMPLÊNCIA — {visao === 'geral' ? 'Por Mês' : 'Por Responsável'}</p>
            <p style={P.meta}>
              Período: {fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)}
              {filters.turma ? ` · Turma: ${filters.turma}` : ''}
              {filters.anoLetivo ? ` · Ano letivo: ${filters.anoLetivo}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: '#888' }}>
            <div>Gerado em: {now}</div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>{parcelas.length} parcela{parcelas.length !== 1 ? 's' : ''} · {kpis.alunos} aluno{kpis.alunos !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* ── KPI SUMMARY ── */}
      <div style={P.kpiGrid}>
        {[
          { label: 'Saldo em Aberto', val: fmtCur(kpis.saldo), color: '#dc2626' },
          { label: 'Valor Original', val: fmtCur(kpis.valor), color: '#7c3aed' },
          { label: 'Juros', val: fmtCur(kpis.juros), color: '#d97706' },
          { label: 'Multa', val: fmtCur(kpis.multa), color: '#dc2626' },
          { label: 'Descontos', val: fmtCur(kpis.desconto), color: '#059669' },
          { label: 'Maior Atraso', val: `${kpis.maxDias} dias`, color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} style={P.kpiItem}>
            <span style={P.kpiLabel}>{k.label}</span>
            <span style={{ ...P.kpiVal, color: k.color }}>{k.val}</span>
          </div>
        ))}
      </div>

      {/* ══ VIEW: GERAL (por mês) ══ */}
      {visao === 'geral' && byMes.map(({ key, label, items, totalSaldo, totalValor, totalJuros, totalMulta, totalDesc }) => (
        <div key={key} style={P.section}>
          <div style={P.sectionHead}>
            <span style={{ textTransform: 'capitalize' }}>📅 {label}</span>
            <span style={{ fontSize: 10 }}>{items.length} parcela{items.length !== 1 ? 's' : ''} · Saldo: {fmtCur(totalSaldo)}</span>
          </div>
          <table style={P.table}>
            <thead>
              <tr>
                <th style={P.th}>Aluno</th>
                <th style={P.th}>Turma</th>
                <th style={P.th}>Responsável</th>
                <th style={P.th}>Evento</th>
                <th style={P.thC}>Parc.</th>
                <th style={P.thC}>Vencimento</th>
                <th style={P.thC}>Atraso</th>
                <th style={P.thR}>Valor</th>
                <th style={P.thR}>Desc.</th>
                <th style={P.thR}>Juros</th>
                <th style={P.thR}>Multa</th>
                <th style={P.thR}>Saldo Due</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, idx) => (
                <tr key={`${p.alunoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...P.td, fontWeight: 600 }}>{p.nome}</td>
                  <td style={P.td}>{p.turma || '—'}</td>
                  <td style={P.td}>{p.responsavelFinanceiro || '—'}</td>
                  <td style={P.td}>{p.evento || '—'}</td>
                  <td style={P.tdC}>{String(p.parcela).padStart(2, '0')}</td>
                  <td style={P.tdC}>{fmtDate(p.vencimento)}</td>
                  <td style={{ ...P.tdC, color: '#dc2626', fontWeight: 700 }}>{p.diasAtraso}d</td>
                  <td style={P.tdR}>{fmtCur(p.valor)}</td>
                  <td style={{ ...P.tdR, color: p.desconto > 0 ? '#059669' : '#999' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                  <td style={{ ...P.tdR, color: p.juros > 0 ? '#d97706' : '#999' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                  <td style={{ ...P.tdR, color: p.multa > 0 ? '#dc2626' : '#999' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                  <td style={{ ...P.tdR, fontWeight: 800, color: '#dc2626' }}>{fmtCur(p.saldo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ ...P.foot, ...P.totalRow }}>
                <td colSpan={7} style={{ ...P.td, fontWeight: 700, color: '#555' }}>Subtotal {label}</td>
                <td style={{ ...P.tdR, fontWeight: 700 }}>{fmtCur(totalValor)}</td>
                <td style={{ ...P.tdR, color: '#059669', fontWeight: 700 }}>{totalDesc > 0 ? `-${fmtCur(totalDesc)}` : '—'}</td>
                <td style={{ ...P.tdR, color: '#d97706', fontWeight: 700 }}>{totalJuros > 0 ? `+${fmtCur(totalJuros)}` : '—'}</td>
                <td style={{ ...P.tdR, color: '#dc2626', fontWeight: 700 }}>{totalMulta > 0 ? `+${fmtCur(totalMulta)}` : '—'}</td>
                <td style={{ ...P.tdR, fontWeight: 900, color: '#dc2626', fontSize: 11 }}>{fmtCur(totalSaldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* ══ VIEW: POR RESPONSÁVEL ══ */}
      {visao === 'por-responsavel' && byResp.map(g => {
        const s = g.sample
        const endLine1 = [s.enderecoResponsavel, s.numeroResponsavel, s.complementoResponsavel].filter(Boolean).join(', ')
        const endLine2 = [s.bairroResponsavel, s.cidadeResponsavel, s.ufResponsavel].filter(Boolean).join(' / ')
        const endCompleto = [endLine1, endLine2].filter(Boolean).join(' — ')
        return (
          <div key={g.resp} style={P.respCard}>
            {/* Responsible header */}
            <div style={P.respHead}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 12, color: '#92400e' }}>
                  👤 {g.resp}
                  {s.parentescoResponsavel && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 3 }}>{s.parentescoResponsavel}</span>}
                </div>
                <div style={{ fontSize: 9, color: '#78350f', marginTop: 2 }}>
                  {g.qtdAlunos} aluno{g.qtdAlunos !== 1 ? 's' : ''} · {g.items.length} parcela{g.items.length !== 1 ? 's' : ''} · Máx {g.maxAtraso} dias atraso
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Saldo em Aberto</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>{fmtCur(g.totalSaldo)}</div>
                {(g.totalJuros + g.totalMulta) > 0 && <div style={{ fontSize: 8, color: '#d97706', fontFamily: 'monospace' }}>+{fmtCur(g.totalJuros + g.totalMulta)} encargos</div>}
              </div>
            </div>

            {/* Contact info mini-grid */}
            <div style={P.infoGrid}>
              {s.cpfResponsavel && <span><b>CPF:</b> {s.cpfResponsavel}</span>}
              {s.rgResponsavel  && <span><b>RG:</b> {s.rgResponsavel}</span>}
              {(s.celularResponsavel || s.telefoneResponsavel) && <span><b>Tel:</b> {s.celularResponsavel || s.telefoneResponsavel}</span>}
              {s.emailResponsavel && <span><b>E-mail:</b> {s.emailResponsavel}</span>}
              {endCompleto && <span style={{ gridColumn: 'span 2' }}><b>End.:</b> {endCompleto} {s.cepResponsavel ? `· CEP: ${s.cepResponsavel}` : ''}</span>}
              {s.profissaoResponsavel && <span><b>Prof.:</b> {s.profissaoResponsavel}</span>}
              {s.empresaResponsavel && <span><b>Empresa:</b> {s.empresaResponsavel}</span>}
            </div>

            {/* Debts table */}
            <table style={P.table}>
              <thead>
                <tr>
                  <th style={P.th}>Aluno</th>
                  <th style={P.th}>Turma</th>
                  <th style={P.th}>Evento</th>
                  <th style={P.thC}>Parc.</th>
                  <th style={P.thC}>Vencimento</th>
                  <th style={P.thC}>Atraso</th>
                  <th style={P.thR}>Valor</th>
                  <th style={P.thR}>Desc.</th>
                  <th style={P.thR}>Juros</th>
                  <th style={P.thR}>Multa</th>
                  <th style={P.thR}>Saldo Due</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((p, idx) => (
                  <tr key={`${p.alunoId}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf0' }}>
                    <td style={{ ...P.td, fontWeight: 600 }}>{p.nome}</td>
                    <td style={P.td}>{p.turma || '—'}</td>
                    <td style={P.td}>{p.evento || '—'}</td>
                    <td style={P.tdC}>{String(p.parcela).padStart(2, '0')}</td>
                    <td style={P.tdC}>{fmtDate(p.vencimento)}</td>
                    <td style={{ ...P.tdC, color: '#dc2626', fontWeight: 700 }}>{p.diasAtraso}d</td>
                    <td style={P.tdR}>{fmtCur(p.valor)}</td>
                    <td style={{ ...P.tdR, color: p.desconto > 0 ? '#059669' : '#999' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                    <td style={{ ...P.tdR, color: p.juros > 0 ? '#d97706' : '#999' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                    <td style={{ ...P.tdR, color: p.multa > 0 ? '#dc2626' : '#999' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                    <td style={{ ...P.tdR, fontWeight: 800, color: '#dc2626' }}>{fmtCur(p.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ ...P.foot, ...P.totalRow }}>
                  <td colSpan={6} style={{ ...P.td, fontWeight: 700 }}>Subtotal {g.resp}</td>
                  <td style={{ ...P.tdR, fontWeight: 700 }}>{fmtCur(g.totalValor)}</td>
                  <td style={{ ...P.tdR, color: '#059669', fontWeight: 700 }}>{g.totalDesc > 0 ? `-${fmtCur(g.totalDesc)}` : '—'}</td>
                  <td style={{ ...P.tdR, color: '#d97706', fontWeight: 700 }}>{g.totalJuros > 0 ? `+${fmtCur(g.totalJuros)}` : '—'}</td>
                  <td style={{ ...P.tdR, color: '#dc2626', fontWeight: 700 }}>{g.totalMulta > 0 ? `+${fmtCur(g.totalMulta)}` : '—'}</td>
                  <td style={{ ...P.tdR, fontWeight: 900, color: '#dc2626', fontSize: 11 }}>{fmtCur(g.totalSaldo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      {/* ── GRAND TOTAL ── */}
      <div style={{ marginTop: 14, border: '2px solid #dc2626', borderRadius: 6, padding: '8px 14px', background: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>TOTAL GERAL INADIMPLÊNCIA</div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
            {fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)} · {kpis.alunos} alunos · {parcelas.length} parcelas · {kpis.responsaveis} responsáveis
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase' }}>Valor Original</div><div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#7c3aed' }}>{fmtCur(kpis.valor)}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Encargos (J+M)</div><div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#d97706' }}>{fmtCur(kpis.juros + kpis.multa)}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Descontos</div><div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#059669' }}>{fmtCur(kpis.desconto)}</div></div>
          <div style={{ textAlign: 'right', borderLeft: '2px solid #dc2626', paddingLeft: 16 }}><div style={{ fontSize: 8, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Total em Aberto</div><div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#dc2626' }}>{fmtCur(kpis.saldo)}</div></div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af' }}>
        <span>IMPACTO EDU — Sistema de Gestão Escolar — Relatório confidencial</span>
        <span>Gerado em {now}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function InadimplentesPage() {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)

  const [visao, setVisao] = useState<Visao>('geral')
  const [filters, setFilters] = useState({
    dataInicio: thisMonthStart(),
    dataFim: todayISO(),
    busca: '',
    turma: '',
    unidade: '',
    anoLetivo: String(new Date().getFullYear()),
  })
  const [showFilters, setShowFilters] = useState(true)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [sortField, setSortField] = useState('vencimento')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { turmas } = useData()
  const [modalTurmaOpen, setModalTurmaOpen] = useState(false)
  const [modalAnoSel, setModalAnoSel] = useState<string>(String(new Date().getFullYear()))
  const [modalBuscaOpen, setModalBuscaOpen] = useState(false)
  const [modalBuscaTemp, setModalBuscaTemp] = useState('')

  const anosDisponiveis = useMemo(() => {
    const years = new Set<number>()
    ;(turmas || []).forEach(t => t.ano && years.add(t.ano))
    return Array.from(years).sort((a,b)=>b-a).map(String)
  }, [turmas])

  const sugestoesBusca = useMemo(() => {
    const q = modalBuscaTemp.toLowerCase().trim()
    const set = new Set<string>()
    ;(parcelas || []).forEach(p => {
      if (p.nome && p.nome.toLowerCase().includes(q)) set.add(p.nome)
      if (p.responsavelFinanceiro && p.responsavelFinanceiro.toLowerCase().includes(q)) set.add(p.responsavelFinanceiro)
    })
    // Mostra até 100 nomes ordenados alfabeticamente para facilitar a busca livre imediata
    return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 100)
  }, [parcelas, modalBuscaTemp])

  const handleChange = (k: string, v: string) => setFilters(p => ({ ...p, [k]: v }))

  const handleApply = useCallback(async (flt = filters) => {
    setLoading(true)
    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'financeiro_inadimplentes', filters: flt, page: 1, pageSize: 9999, sortField, sortDir }),
      })
      const data = await res.json()
      const rows: Parcela[] = (data.data || []).map((r: any) => ({ ...r, diasAtraso: calcDiasAtraso(r.vencimento || '') }))
      setParcelas(rows)
      setHasLoaded(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters, sortField, sortDir])

  const handleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc') } }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...parcelas].sort((a, b) => {
      const va = (a as any)[sortField]; const vb = (b as any)[sortField]
      if (va === vb) return 0
      if (typeof va === 'number') return (va - vb) * dir
      return String(va || '').localeCompare(String(vb || ''), 'pt-BR') * dir
    })
  }, [parcelas, sortField, sortDir])

  const filtered = useMemo(() => {
    if (!filters.busca) return sorted
    const q = filters.busca.toLowerCase()
    return sorted.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.responsavelFinanceiro || '').toLowerCase().includes(q) ||
      (p.turma || '').toLowerCase().includes(q) ||
      (p.evento || '').toLowerCase().includes(q) ||
      (p.codigo || '').toLowerCase().includes(q) ||
      (p.emailResponsavel || '').toLowerCase().includes(q) ||
      (p.cpfResponsavel || '').includes(q)
    )
  }, [sorted, filters.busca])

  const kpis = useMemo<Kpis>(() => ({
    total: filtered.length,
    saldo: filtered.reduce((s, p) => s + p.saldo, 0),
    valor: filtered.reduce((s, p) => s + p.valor, 0),
    juros: filtered.reduce((s, p) => s + p.juros, 0),
    multa: filtered.reduce((s, p) => s + p.multa, 0),
    desconto: filtered.reduce((s, p) => s + p.desconto, 0),
    alunos: new Set(filtered.map(p => p.alunoId)).size,
    responsaveis: new Set(filtered.map(p => p.responsavelFinanceiro).filter(Boolean)).size,
    maxDias: filtered.length > 0 ? Math.max(...filtered.map(p => p.diasAtraso)) : 0,
  }), [filtered])

  const exportXLSX = () => {
    const rows: any[][] = [
      ['RELATÓRIO DE INADIMPLENTES'],
      [`Período: ${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)}`],
      [],
      ['Aluno', 'Turma', 'Responsável', 'CPF', 'RG', 'Celular', 'E-mail', 'Endereço', 'Parentesco', 'Evento', 'Parcela', 'Vencimento', 'Atraso (dias)', 'Valor', 'Desconto', 'Juros', 'Multa', 'Saldo em Aberto'],
    ]
    filtered.forEach(p => rows.push([
      p.nome, p.turma, p.responsavelFinanceiro, p.cpfResponsavel, p.rgResponsavel,
      p.celularResponsavel || p.telefoneResponsavel, p.emailResponsavel,
      [p.enderecoResponsavel, p.numeroResponsavel, p.bairroResponsavel, p.cidadeResponsavel, p.ufResponsavel].filter(Boolean).join(', '),
      p.parentescoResponsavel, p.evento, p.parcela, fmtDate(p.vencimento), p.diasAtraso,
      p.valor, p.desconto, p.juros, p.multa, p.saldo,
    ]))
    rows.push([])
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL:', kpis.saldo])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inadimplentes')
    XLSX.writeFile(wb, `inadimplentes-${filters.dataInicio || 'completo'}.xlsx`)
  }

  // PDF: open a new isolated window with the print content and print from there
  // This bypasses all Next.js layout wrappers that break @media print
  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const html = el.innerHTML
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Inadimplência</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 10px; background: #fff; }
    table { border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .print-section { page-break-inside: avoid; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${html}</body>
</html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 600)
  }

  const yrOptions = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2)]

  return (
    <>
      {/* ── MODAIS SOBREPOSTOS (PREMIUM UX) ── */}
      <AnimatePresence>
        
        {/* MODAL TURMA */}
        {modalTurmaOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <motion.div initial={{ scale: 0.95, y:20 }} animate={{ scale: 1, y:0 }} exit={{ scale:0.95, y:20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background:'hsl(var(--bg-elevated))', width:'100%', maxWidth:500, borderRadius:24, boxShadow:'0 24px 48px rgba(0,0,0,0.2)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:'rgba(245,158,11,0.1)',color:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center' }}><Layers size={18}/></div>
                  <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Buscar Turma</h2>
                </div>
                <button onClick={() => setModalTurmaOpen(false)} style={{ background:'transparent', border:'none', color:'hsl(var(--text-muted))', cursor:'pointer', padding:4 }}><X size={20}/></button>
              </div>

              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))' }}>
                <label style={{ fontSize:11, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:8, display:'block' }}>1. Selecione o Ano Letivo</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {anosDisponiveis.length === 0 ? <span style={{fontSize:13, color:'hsl(var(--text-muted))'}}>Nenhum ano cadastrado.</span> : null}
                  {anosDisponiveis.map(ano => (
                    <button key={ano} onClick={() => setModalAnoSel(ano)} style={{ padding:'8px 16px', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', border: modalAnoSel === ano ? '2px solid #f59e0b' : '1px solid hsl(var(--border-subtle))', background: modalAnoSel === ano ? 'rgba(245,158,11,0.1)' : 'hsl(var(--bg-elevated))', color: modalAnoSel === ano ? '#f59e0b' : 'hsl(var(--text-primary))', transition:'all 0.2s' }}>
                      {ano}
                    </button>
                  ))}
                  <button onClick={() => setModalAnoSel('')} style={{ padding:'8px 16px', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', border: modalAnoSel === '' ? '2px solid #3b82f6' : '1px solid hsl(var(--border-subtle))', background: modalAnoSel === '' ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-elevated))', color: modalAnoSel === '' ? '#3b82f6' : 'hsl(var(--text-primary))', transition:'all 0.2s' }}>Todos</button>
                </div>
              </div>

              <div style={{ padding:'12px 16px', overflowY:'auto', flex:1 }}>
                <label style={{ fontSize:11, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:12, display:'block', marginLeft:8 }}>2. Escolha a Turma</label>
                
                <button 
                  onClick={() => { handleChange('turma', ''); setModalTurmaOpen(false) }}
                  style={{ width:'100%', padding:'14px 16px', background:!filters.turma?'rgba(245,158,11,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', fontWeight:!filters.turma?800:600, color:!filters.turma?'#f59e0b':'hsl(var(--text-primary))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}
                >
                  🏫 Todas as Turmas {!filters.turma && <CheckCircle size={16}/>}
                </button>

                {turmas.filter(t => !modalAnoSel ? true : String(t.ano) === modalAnoSel).map(t => (
                  <button key={t.id} 
                    onClick={() => { handleChange('turma', t.nome); setModalTurmaOpen(false) }}
                    style={{ width:'100%', padding:'14px 16px', background:filters.turma===t.nome?'rgba(245,158,11,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}
                  >
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:filters.turma===t.nome?'#f59e0b':'hsl(var(--text-primary))' }}>{t.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>{t.serie} • {t.turno} • {String(t.ano)}</div>
                    </div>
                    {filters.turma===t.nome && <CheckCircle size={18} color="#f59e0b"/>}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL BUSCA RESPONSÁVEL/ALUNO */}
        {modalBuscaOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <motion.div initial={{ scale: 0.95, y:20 }} animate={{ scale: 1, y:0 }} exit={{ scale:0.95, y:20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background:'hsl(var(--bg-elevated))', width:'100%', maxWidth:540, borderRadius:24, boxShadow:'0 24px 48px rgba(0,0,0,0.2)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:'rgba(59,130,246,0.1)',color:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center' }}><Search size={18}/></div>
                  <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Buscar Específico</h2>
                </div>
                <button onClick={() => setModalBuscaOpen(false)} style={{ background:'transparent', border:'none', color:'hsl(var(--text-muted))', cursor:'pointer', padding:4 }}><X size={20}/></button>
              </div>

              <div style={{ padding:'16px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))' }}>
                <div style={{ position:'relative' }}>
                  <Search size={18} color="hsl(var(--text-muted))" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input autoFocus type="text" className="form-input" placeholder="Digite o nome do aluno ou responsável..." value={modalBuscaTemp} onChange={e => setModalBuscaTemp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { handleChange('busca', modalBuscaTemp); setModalBuscaOpen(false) } }} style={{ width:'100%', paddingLeft:42, height:48, fontSize:15, borderRadius:12, fontWeight:600 }} />
                </div>
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:8 }}>Você pode confirmar a busca livre apertando Enter, ou clicar nas sugestões extraídas das parcelas abaixo.</div>
              </div>

              <div style={{ padding:'12px', overflowY:'auto', flex:1 }}>
                <button 
                  onClick={() => { handleChange('busca', ''); setModalBuscaOpen(false) }}
                  style={{ width:'100%', padding:'14px 16px', background:!filters.busca?'rgba(59,130,246,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', fontWeight:!filters.busca?800:600, color:!filters.busca?'#3b82f6':'hsl(var(--text-primary))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:8 }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36,height:36,borderRadius:10,background:'hsl(var(--bg-overlay))',display:'flex',alignItems:'center',justifyContent:'center' }}><Users size={16}/></div>
                    Visualizar Lista Completa
                  </div>
                  {!filters.busca && <CheckCircle size={18} color="#3b82f6"/>}
                </button>

                {sugestoesBusca.map((nome, idx) => (
                  <button key={idx} 
                    onClick={() => { handleChange('busca', nome); setModalBuscaOpen(false) }}
                    style={{ width:'100%', padding:'10px 14px', background:filters.busca===nome?'rgba(59,130,246,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => { if(filters.busca!==nome) e.currentTarget.style.background='hsl(var(--bg-overlay))' }}
                    onMouseLeave={e => { if(filters.busca!==nome) e.currentTarget.style.background='transparent' }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:'rgba(59,130,246,0.1)',color:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11 }}>
                        {(nome||'').substring(0,2).toUpperCase()}
                      </div>
                      <div style={{ fontSize:14, fontWeight:800, color:filters.busca===nome?'#3b82f6':'hsl(var(--text-primary))' }}>
                        {nome}
                      </div>
                    </div>
                    {filters.busca===nome && <CheckCircle size={18} color="#3b82f6"/>}
                  </button>
                ))}
                
                {sugestoesBusca.length === 0 && modalBuscaTemp.trim().length > 0 && (
                  <div style={{ padding:40, textAlign:'center', color:'hsl(var(--text-muted))' }}>
                     <Users size={30} style={{ margin:'0 auto 10px', opacity:0.3 }} />
                     Nenhum aluno ou responsável encontrado nas parcelas carregadas com o nome "{modalBuscaTemp}".
                  </div>
                )}
                {sugestoesBusca.length === 0 && modalBuscaTemp.trim().length === 0 && (
                  <div style={{ padding:40, textAlign:'center', color:'hsl(var(--text-muted))' }}>
                     <Users size={30} style={{ margin:'0 auto 10px', opacity:0.3 }} />
                     Ainda não há inadimplentes carregados no período.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ PRINT LAYOUT (hidden on screen, shown on print) ══ */}
      {hasLoaded && (
        <div id="print-root" ref={printRef}>
          <PrintLayout parcelas={filtered} kpis={kpis} filters={filters} visao={visao} />
        </div>
      )}

      {/* ══ SCREEN LAYOUT ══ */}
      <div id="screen-root" style={{ maxWidth: 1300, margin: '0 auto', padding: '0 0 80px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}><ArrowLeft size={15} /></button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingDown size={18} color="#fff" /></div>
              <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>Inadimplência</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Financeiro</span>
            </div>
            <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>Parcelas vencidas — visão por mês e por responsável (dados de contato completos)</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
              {showFilters ? <EyeOff size={11} /> : <Eye size={11} />} {showFilters ? 'Ocultar' : 'Filtros'}
            </button>
            {hasLoaded && (
              <>
                <button onClick={exportXLSX} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <FileSpreadsheet size={11} /> Excel
                </button>
                <button onClick={handlePrint} className="btn btn-danger btn-sm" style={{ gap: 5 }}>
                  <Printer size={11} /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* FILTROS */}
        {showFilters && (
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Filter size={13} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtros</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <div><label className="form-label" style={{ fontSize: 10 }}>Venc. De</label><input type="date" className="form-input" style={{ fontSize: 12 }} value={filters.dataInicio} onChange={e => handleChange('dataInicio', e.target.value)} /></div>
              <div><label className="form-label" style={{ fontSize: 10 }}>Venc. Até</label><input type="date" className="form-input" style={{ fontSize: 12 }} value={filters.dataFim} onChange={e => handleChange('dataFim', e.target.value)} /></div>
              <div>
                 <label className="form-label" style={{ fontSize: 10 }}>Turma Selecionada</label>
                 <button 
                    onClick={() => setModalTurmaOpen(true)}
                    className="form-input" 
                    style={{ fontSize: 12, fontWeight: filters.turma ? 800 : 500, color: filters.turma ? '#f59e0b' : 'inherit', textAlign: 'left', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filters.turma || 'Todas'}
                    </span>
                    <ChevronRight size={14} />
                 </button>
              </div>
              <div><label className="form-label" style={{ fontSize: 10 }}>Ano Letivo Base</label><select className="form-input" style={{ fontSize: 12 }} value={filters.anoLetivo} onChange={e => handleChange('anoLetivo', e.target.value)}>{yrOptions.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              <div style={{ gridColumn: 'span 2' }}>
                 <label className="form-label" style={{ fontSize: 10 }}>Buscar Aluno ou Responsável Específico</label>
                 <button 
                    onClick={() => { setModalBuscaTemp(''); setModalBuscaOpen(true) }}
                    className="form-input" 
                    style={{ fontSize: 12, fontWeight: filters.busca ? 800 : 500, color: filters.busca ? '#3b82f6' : 'inherit', textAlign: 'left', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filters.busca || 'Buscador Global (Ver Todos)'}
                    </span>
                    <Search size={14} />
                 </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Atalhos:</span>
              {[{ label: 'Este mês', di: thisMonthStart(), df: todayISO() }, { label: 'Mês anterior', di: lastMonthStart(), df: lastMonthEnd() }, { label: `Todo ${new Date().getFullYear()}`, di: `${new Date().getFullYear()}-01-01`, df: `${new Date().getFullYear()}-12-31` }, { label: 'Tudo', di: '2020-01-01', df: todayISO() }].map(({ label, di, df }) => (
                <button key={label} onClick={() => { handleChange('dataInicio', di); handleChange('dataFim', df) }} className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '2px 10px', height: 24 }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ gap: 5, fontSize: 11 }} onClick={() => setFilters({ dataInicio: thisMonthStart(), dataFim: todayISO(), busca: '', turma: '', unidade: '', anoLetivo: String(new Date().getFullYear()) })}><RotateCcw size={11} /> Limpar</button>
              <button className="btn btn-danger btn-sm" style={{ gap: 5, fontSize: 11 }} onClick={() => handleApply()} disabled={loading}>
                {loading ? <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <TrendingDown size={11} />}
                {loading ? 'Consultando...' : 'Consultar Inadimplência'}
              </button>
            </div>
          </div>
        )}

        {/* KPIs */}
        {hasLoaded && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <KpiCard label="Saldo em Aberto" value={fmtCur(kpis.saldo)} icon={<DollarSign size={16} />} color="#ef4444" danger sub={`${kpis.total} parcelas vencidas`} />
            <KpiCard label="Alunos Inadimplentes" value={String(kpis.alunos)} icon={<Users size={16} />} color="#f59e0b" sub={`${kpis.responsaveis} responsáveis`} />
            <KpiCard label="Valor Original" value={fmtCur(kpis.valor)} icon={<Hash size={16} />} color="#8b5cf6" sub="sem encargos" />
            <KpiCard label="Juros + Multa" value={fmtCur(kpis.juros + kpis.multa)} icon={<AlertTriangle size={16} />} color="#dc2626" sub="encargos acumulados" />
            <KpiCard label="Maior Atraso" value={`${kpis.maxDias}d`} icon={<Clock size={16} />} color="#7c3aed" sub="dias em atraso" />
            <KpiCard label="Descontos" value={fmtCur(kpis.desconto)} icon={<Tag size={16} />} color="#10b981" sub="descontos aplicados" />
          </div>
        )}

        {/* ABAS */}
        {hasLoaded && !loading && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {([{ key: 'geral' as Visao, label: 'Inadimplente por Mês', icon: <Calendar size={13} /> }, { key: 'por-responsavel' as Visao, label: 'Por Responsável', icon: <Users size={13} /> }]).map(v => (
              <button key={v.key} onClick={() => setVisao(v.key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: visao === v.key ? (v.key === 'geral' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)') : 'transparent', border: visao === v.key ? `1px solid ${v.key === 'geral' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` : '1px solid transparent', color: visao === v.key ? (v.key === 'geral' ? '#ef4444' : '#f59e0b') : 'hsl(var(--text-muted))', fontSize: 12, fontWeight: visao === v.key ? 800 : 500, cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit' }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        )}

        {/* ESTADOS */}
        {!hasLoaded && !loading && (
          <div className="card" style={{ padding: 60, textAlign: 'center' }}>
            <TrendingDown size={48} style={{ opacity: 0.15, display: 'block', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Relatório de Inadimplência</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Configure os filtros e clique em <strong>Consultar Inadimplência</strong>.</div>
            <button onClick={() => handleApply()} className="btn btn-danger" style={{ gap: 8 }}><TrendingDown size={14} /> Consultar Agora</button>
          </div>
        )}
        {loading && (
          <div className="card" style={{ padding: 50, textAlign: 'center' }}>
            <RefreshCw size={28} style={{ animation: 'spin 0.8s linear infinite', color: '#ef4444', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Consultando inadimplência...</div>
          </div>
        )}
        {hasLoaded && !loading && filtered.length === 0 && (
          <div className="card" style={{ padding: 50, textAlign: 'center' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🎉</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>Nenhuma inadimplência encontrada!</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Sua escola está em dia no período selecionado.</div>
          </div>
        )}

        {/* CONTEÚDO SCREEN */}
        {hasLoaded && !loading && filtered.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 5, color: '#ef4444' }} />
                {filtered.length} parcela{filtered.length !== 1 ? 's' : ''} · {kpis.alunos} aluno{kpis.alunos !== 1 ? 's' : ''} · {kpis.responsaveis} responsáveis
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>Total: {fmtCur(kpis.saldo)}</div>
            </div>
            {visao === 'geral' && <GeralView parcelas={filtered} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
            {visao === 'por-responsavel' && <RespView parcelas={filtered} />}
            <div style={{ marginTop: 16, borderRadius: 12, padding: '16px 22px', background: 'linear-gradient(135deg, hsl(var(--bg-elevated)), rgba(239,68,68,0.06))', border: '2px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>▼ RESUMO DE INADIMPLÊNCIA</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{fmtDate(filters.dataInicio)} a {fmtDate(filters.dataFim)} · {kpis.alunos} alunos · {filtered.length} parcelas · {kpis.responsaveis} responsáveis</div>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase' }}>Valor Original</div><div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#8b5cf6' }}>{fmtCur(kpis.valor)}</div></div>
                <div><div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Encargos</div><div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#f59e0b' }}>{fmtCur(kpis.juros + kpis.multa)}</div></div>
                <div style={{ borderLeft: '1px solid rgba(239,68,68,0.3)', paddingLeft: 24 }}><div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Total em Aberto</div><div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#ef4444' }}>{fmtCur(kpis.saldo)}</div></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══ SCREEN-ONLY CSS ══ */}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        /* Hide the print root on screen — it only renders in the popup window */
        #print-root { display: none !important; }
      `}</style>
    </>
  )
}
