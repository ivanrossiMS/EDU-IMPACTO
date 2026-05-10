'use client'

import {
  useState, useEffect, useCallback, useMemo, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, Filter, X, ChevronDown, ChevronUp,
  FileText, FileSpreadsheet, RefreshCw, GraduationCap,
  Calendar, School, ChevronLeft, ChevronRight, Loader2,
  BarChart3, BookOpen, UserCheck, LayoutList, BookMarked,
  TrendingUp, AlertCircle, SortAsc, Search, Building2
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { exportPDF } from '@/lib/reports/exportPDF'
import { exportXLSX } from '@/lib/reports/exportXLSX'

// ─── Types ────────────────────────────────────────────────

interface AlunoRow {
  id: string
  codigo: string
  nome: string
  turma: string
  turno: string
  unidade: string
  statusMatricula: string
  situacaoNome: string
  nivelEnsino: string
  anoLetivo: string
  dataMatricula: string
  dataNascimento: string
  idade: number
  sexo: string
  email: string
  telefone: string
  responsavelPedagogico: string
}

interface TurmaGroup {
  turma: string
  turno: string
  unidade: string
  nivelEnsino: string
  anoLetivo: string
  alunos: AlunoRow[]
  ativos: number
  inativos: number
}

interface FilterState {
  busca: string
  turma: string
  turmaId: string
  turmaNome: string
  nivelEnsino: string
  unidade: string
  anoLetivo: string
  situacaoNome: string
  turno: string
  dataInicio: string
  dataFim: string
}

interface TurmaItem {
  id: string
  nome: string
  turno: string
  unidade: string
  serie: string
  ano: number | string
  matriculados: number
  capacidade: number
}

// ─── Constants ────────────────────────────────────────────

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

const SORT_OPTIONS = [
  { value: 'turma|asc',          label: 'Turma (A→Z)' },
  { value: 'turma|desc',         label: 'Turma (Z→A)' },
  { value: 'alunos|desc',        label: 'Mais alunos primeiro' },
  { value: 'alunos|asc',         label: 'Menos alunos primeiro' },
  { value: 'nivelEnsino|asc',    label: 'Nível de Ensino (A→Z)' },
]

const NIVEL_OPTIONS = [
  'Educação Infantil',
  'Ensino Fundamental I',
  'Ensino Fundamental II',
  'Ensino Médio',
  'EJA',
  'Técnico',
]

const MODELOS = [
  { value: 'resumo',    label: 'Resumo por Turma',   icon: '📋', desc: 'Turma, turno e contagem de alunos' },
  { value: 'detalhado', label: 'Detalhado por Aluno', icon: '📄', desc: 'Lista completa com cada aluno' },
]

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : s
}

function groupByTurma(alunos: AlunoRow[], sortVal: string): TurmaGroup[] {
  const map = new Map<string, TurmaGroup>()
  alunos.forEach(a => {
    const key = a.turma || 'Sem Turma'
    if (!map.has(key)) {
      map.set(key, {
        turma: key,
        turno: a.turno,
        unidade: a.unidade,
        nivelEnsino: a.nivelEnsino,
        anoLetivo: a.anoLetivo,
        alunos: [],
        ativos: 0,
        inativos: 0,
      })
    }
    const g = map.get(key)!
    g.alunos.push(a)
    if (a.statusMatricula === 'Ativo' || a.situacaoNome?.toLowerCase() === 'cursando') g.ativos++
    else g.inativos++
  })

  const groups = Array.from(map.values())
  const [field, dir] = sortVal.split('|')
  const mult = dir === 'desc' ? -1 : 1
  groups.sort((a, b) => {
    if (field === 'alunos') return (a.alunos.length - b.alunos.length) * mult
    const va = field === 'turma' ? a.turma : (a as any)[field] || ''
    const vb = field === 'turma' ? b.turma : (b as any)[field] || ''
    return va.localeCompare(vb, 'pt-BR') * mult
  })
  return groups
}

// ─── DatePicker Premium ───────────────────────────────────

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEM = ['D','S','T','Q','Q','S','S']

function DatePicker({ label, value, onChange, minDate, maxDate }: {
  label: string; value: string; onChange: (v: string) => void; minDate?: string; maxDate?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    if (value) { const d = new Date(value + 'T12:00'); return { year: d.getFullYear(), month: d.getMonth() } }
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const display = value ? (() => { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}` })() : ''
  const firstDay = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const iso = (d: number) => `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const todayIso = today.toISOString().slice(0, 10)
  const isDisabled = (d: number) => { const v = iso(d); return (minDate && v < minDate) || (maxDate && v > maxDate) || false }
  const prevM = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  const nextM = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</label>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          background: value ? 'rgba(59,130,246,0.06)' : 'hsl(var(--bg-elevated))',
          border: `1px solid ${value ? 'rgba(59,130,246,0.35)' : 'hsl(var(--border-subtle))'}`,
          color: value ? '#3b82f6' : 'hsl(var(--text-muted))',
          fontSize: 12, fontWeight: value ? 600 : 400, fontFamily: 'inherit', transition: 'all 0.15s',
        }}
      >
        <Calendar size={13} style={{ flexShrink: 0, opacity: value ? 1 : 0.5 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{display || 'Selecionar...'}</span>
        {value && <span onClick={e => { e.stopPropagation(); onChange('') }} style={{ cursor: 'pointer', opacity: 0.6, lineHeight: 0 }}><X size={11} /></span>}
        {!value && <ChevronDown size={11} style={{ opacity: 0.4 }} />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-default))',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.28)', minWidth: 272, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.06))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <button onClick={prevM} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: '2px 6px', borderRadius: 6 }}><ChevronLeft size={14} /></button>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{MESES_FULL[view.month]} {view.year}</span>
            <button onClick={nextM} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: '2px 6px', borderRadius: 6 }}><ChevronRight size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 8px 4px' }}>
            {DIAS_SEM.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-disabled))', padding: '2px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 8px 8px', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const sel = iso(day) === value, tod = iso(day) === todayIso, dis = isDisabled(day)
              return (
                <button key={i} disabled={dis} onClick={() => { onChange(iso(day)); setOpen(false) }} style={{
                  width: '100%', aspectRatio: '1', borderRadius: 7, fontSize: 12, fontWeight: sel ? 800 : tod ? 700 : 400,
                  background: sel ? '#3b82f6' : tod ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: sel ? '#fff' : dis ? 'hsl(var(--text-disabled))' : tod ? '#3b82f6' : 'hsl(var(--text-primary))',
                  border: `1px solid ${sel ? '#3b82f6' : tod ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.35 : 1, fontFamily: 'inherit',
                }}>
                  {day}
                </button>
              )
            })}
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[
              { label: 'Hoje', val: todayIso },
              { label: 'Início do mês', val: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01` },
              { label: 'Início do ano', val: `${today.getFullYear()}-01-01` },
            ].map(s => (
              <button key={s.label} onClick={() => { onChange(s.val); setOpen(false) }} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', fontFamily: 'inherit' }}>
                {s.label}
              </button>
            ))}
            {value && <button onClick={() => onChange('')} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Limpar</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TurmaModal ──────────────────────────────────────────

function TurmaModal({ open, onClose, onSelect, selectedTurmaId }: {
  open: boolean
  onClose: () => void
  onSelect: (id: string, nome: string, turno: string, unidade: string) => void
  selectedTurmaId: string
}) {
  const ANO_ATUAL_M = new Date().getFullYear()
  const [search, setSearch] = useState('')
  const [anoFiltro, setAnoFiltro] = useState(String(ANO_ATUAL_M))
  const [turmas, setTurmas] = useState<TurmaItem[]>([])
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const ANOS_M = [ANO_ATUAL_M + 1, ANO_ATUAL_M, ANO_ATUAL_M - 1, ANO_ATUAL_M - 2]

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const filters: Record<string, string> = {}
    if (anoFiltro) filters.anoLetivo = anoFiltro
    fetch('/api/relatorios/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'turmas', filters, page: 1, pageSize: 999, sortField: 'nome', sortDir: 'asc' }),
    })
      .then(r => r.json())
      .then(d => setTurmas(d.data || []))
      .catch(() => setTurmas([]))
      .finally(() => setLoading(false))
  }, [open, anoFiltro])

  const filtered = useMemo(() => {
    if (!search.trim()) return turmas
    const s = search.toLowerCase()
    return turmas.filter(t => t.nome.toLowerCase().includes(s) || (t.unidade || '').toLowerCase().includes(s) || (t.turno || '').toLowerCase().includes(s))
  }, [turmas, search])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.4)', border: '1px solid hsl(var(--border-subtle))',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.03))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Selecionar Turma</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{filtered.length} turmas disponíveis</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'hsl(var(--text-muted))', lineHeight: 0 }}>
              <X size={16} />
            </button>
          </div>
          {/* Ano Letivo Selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Ano Letivo:</span>
            {ANOS_M.map(a => (
              <button
                key={a}
                onClick={() => setAnoFiltro(String(a))}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: anoFiltro === String(a) ? '#6366f1' : 'hsl(var(--bg-elevated))',
                  color: anoFiltro === String(a) ? '#fff' : 'hsl(var(--text-muted))',
                  border: `1px solid ${anoFiltro === String(a) ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >{a}</button>
            ))}
            <button
              onClick={() => setAnoFiltro('')}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: !anoFiltro ? '#6366f1' : 'hsl(var(--bg-elevated))', color: !anoFiltro ? '#fff' : 'hsl(var(--text-muted))', border: `1px solid ${!anoFiltro ? '#6366f1' : 'hsl(var(--border-subtle))'}`, cursor: 'pointer', fontFamily: 'inherit' }}
            >Todos</button>
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar turma, turno ou unidade..."
              className="form-input"
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {/* Clear option */}
          <button
            onClick={() => { onSelect('', '', '', ''); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 12, background: !selectedTurmaId ? 'rgba(99,102,241,0.08)' : 'transparent',
              border: `1px solid ${!selectedTurmaId ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', marginBottom: 6,
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} color="#6366f1" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>Todas as Turmas</span>
          </button>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: '#6366f1' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhuma turma encontrada</div>
          ) : (
            filtered.map(t => {
              const isSelected = selectedTurmaId === t.id
              const pct = t.capacidade > 0 ? Math.round((t.matriculados || 0) / t.capacidade * 100) : 0
              return (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.id, t.nome, t.turno || '', t.unidade || ''); onClose() }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                    borderRadius: 12, marginBottom: 4,
                    background: isSelected ? 'rgba(99,102,241,0.08)' : '',
                    border: `1px solid ${isSelected ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.1s', fontFamily: 'inherit', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'hsl(var(--bg-elevated))' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.1)', color: isSelected ? '#fff' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
                    {t.nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>{t.nome}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {t.turno && <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>🕐 {t.turno}</span>}
                      {t.unidade && <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>🏫 {t.unidade}</span>}
                      {t.serie && <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>📚 {t.serie}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{t.matriculados || 0}</div>
                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>alunos</div>
                    {t.capacidade > 0 && (
                      <div style={{ fontSize: 9, color: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{pct}%</div>
                    )}
                  </div>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; accent?: string
}) {
  return (
    <div style={{
      background: 'hsl(var(--bg-surface))',
      border: '1px solid hsl(var(--border-subtle))',
      borderTop: `3px solid ${color}`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      transition: 'all 0.2s', flex: 1, minWidth: 130,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}14`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function AlunosTurmaPage() {
  const router = useRouter()
  const { mantenedores, cfgSituacaoAluno, cfgTurnos, cfgNiveisEnsino } = useData()
  const { currentUser } = useApp()

  const [allData, setAllData] = useState<AlunoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(true)
  const [sortValue, setSortValue] = useState('turma|asc')
  const [modelo, setModelo] = useState<'resumo' | 'detalhado'>('resumo')
  const [expandedTurmas, setExpandedTurmas] = useState<Set<string>>(new Set())
  const [turmaModalOpen, setTurmaModalOpen] = useState(false)

  const [filters, setFilters] = useState<FilterState>({
    busca: '',
    turma: '',
    turmaId: '',
    turmaNome: '',
    nivelEnsino: '',
    unidade: '',
    anoLetivo: String(ANO_ATUAL),
    situacaoNome: '',
    turno: '',
    dataInicio: '',
    dataFim: '',
  })

  // School info
  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const userName = currentUser?.nome || 'Usuário'

  // Unidades list for dropdown
  const unidades: string[] = useMemo(() => {
    const all: string[] = []
    ;(mantenedores as any[])?.forEach((m: any) => {
      ;(m.unidades || []).forEach((u: any) => {
        const n = u.nomeFantasia || u.razaoSocial || u.nome || ''
        if (n && !all.includes(n)) all.push(n)
      })
    })
    return all
  }, [mantenedores])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const apiFilters: Record<string, string> = {}
    if (filters.busca)        apiFilters.busca        = filters.busca
    if (filters.anoLetivo)    apiFilters.anoLetivo    = filters.anoLetivo
    if (filters.situacaoNome) apiFilters.situacaoNome = filters.situacaoNome
    if (filters.turno)        apiFilters.turno        = filters.turno
    if (filters.nivelEnsino)  apiFilters.nivelEnsino  = filters.nivelEnsino
    if (filters.dataInicio)   apiFilters.dataInicio   = filters.dataInicio
    if (filters.dataFim)      apiFilters.dataFim      = filters.dataFim
    // Turma: prioridade ao ID (exact-match, muito mais preciso que nome)
    // quando turmaId está presente, não enviamos turma (nome) nem unidade separado
    if (filters.turmaId) {
      apiFilters.turmaId = filters.turmaId
      // unidade ainda pode ser enviado para pré-filtro na query SQL se o resolver suportar
      // mas o filtro real de turmaId já garante a precisão
    } else {
      if (filters.turma)   apiFilters.turma   = filters.turma
      if (filters.unidade) apiFilters.unidade = filters.unidade
    }

    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'alunos_relacao', filters: apiFilters, page: 1, pageSize: 9999, sortField: 'nome', sortDir: 'asc' }),
      })
      const json = await res.json()
      setAllData(json.data || [])
    } catch {
      setAllData([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const groups = useMemo(() => groupByTurma(allData, sortValue), [allData, sortValue])

  const stats = useMemo(() => {
    const totalAlunos = allData.length
    const totalTurmas = groups.length
    const ativos = allData.filter(a => a.statusMatricula === 'Ativo' || a.situacaoNome?.toLowerCase() === 'cursando').length
    const mediaPorTurma = totalTurmas > 0 ? Math.round(totalAlunos / totalTurmas) : 0
    return { totalAlunos, totalTurmas, ativos, mediaPorTurma }
  }, [allData, groups])

  const setFilter = (k: keyof FilterState, v: string) => setFilters(p => ({ ...p, [k]: v }))

  const clearFilters = () => setFilters({
    busca: '', turma: '', turmaId: '', turmaNome: '', nivelEnsino: '', unidade: '',
    anoLetivo: String(ANO_ATUAL), situacaoNome: '', turno: '', dataInicio: '', dataFim: '',
  })

  const activeCount = useMemo(() => {
    let c = 0
    if (filters.busca) c++
    if (filters.turmaNome) c++
    if (filters.nivelEnsino) c++
    if (filters.unidade) c++
    if (filters.situacaoNome) c++
    if (filters.turno) c++
    if (filters.dataInicio || filters.dataFim) c++
    return c
  }, [filters])

  const toggleTurma = (nome: string) => {
    setExpandedTurmas(prev => {
      const n = new Set(prev)
      if (n.has(nome)) n.delete(nome); else n.add(nome)
      return n
    })
  }

  const expandAll = () => setExpandedTurmas(new Set(groups.map(g => g.turma)))
  const collapseAll = () => setExpandedTurmas(new Set())

  // ─── Export ───────────────────────────────────────────────
  const filterDesc = useMemo(() => {
    const d: Record<string, string> = {}
    if (filters.anoLetivo) d['Ano Letivo'] = filters.anoLetivo
    if (filters.nivelEnsino) d['Nível'] = filters.nivelEnsino
    if (filters.unidade) d['Unidade'] = filters.unidade
    if (filters.turno) d['Turno'] = filters.turno
    if (filters.situacaoNome) d['Situação'] = filters.situacaoNome
    if (filters.dataInicio) d['De'] = filters.dataInicio
    if (filters.dataFim) d['Até'] = filters.dataFim
    return d
  }, [filters])

  const handleExportPDF = () => {
    if (modelo === 'resumo') {
      const resumoData = groups.map(g => ({
        turma: g.turma,
        turno: g.turno || '—',
        nivelEnsino: g.nivelEnsino || '—',
        unidade: g.unidade || '—',
        total: g.alunos.length,
        ativos: g.ativos,
        inativos: g.inativos,
        anoLetivo: g.anoLetivo || filters.anoLetivo,
      }))
      exportPDF({
        title: 'Alunos por Turma — Resumo',
        subtitle: `Ano Letivo ${filters.anoLetivo} · ${groups.length} turmas · ${allData.length} alunos`,
        data: resumoData,
        columns: [
          { key: 'turma',       label: 'Turma',         type: 'text'   },
          { key: 'turno',       label: 'Turno',         type: 'text'   },
          { key: 'nivelEnsino', label: 'Nível',         type: 'text'   },
          { key: 'unidade',     label: 'Unidade',       type: 'text'   },
          { key: 'total',       label: 'Total',         type: 'number', align: 'center' },
          { key: 'ativos',      label: 'Ativos',        type: 'number', align: 'center' },
          { key: 'inativos',    label: 'Inativos',      type: 'number', align: 'center' },
          { key: 'anoLetivo',   label: 'Ano Letivo',    type: 'text',   align: 'center' },
        ],
        filters: filterDesc,
        nomeEscola, cnpj, logo, userName,
        orientation: 'landscape',
      })
    } else {
      const detalhadoData: Record<string, unknown>[] = []
      groups.forEach(g => {
        g.alunos.forEach((a, i) => {
          detalhadoData.push({
            _indice: (detalhadoData.length + 1),
            turma: g.turma,
            turno: g.turno || '—',
            codigo: a.codigo,
            nome: a.nome,
            situacaoNome: a.situacaoNome || a.statusMatricula || '—',
            nivelEnsino: a.nivelEnsino || '—',
            dataMatricula: a.dataMatricula ? fmtDate(a.dataMatricula) : '—',
            dataNascimento: a.dataNascimento ? fmtDate(a.dataNascimento) : '—',
            responsavelPedagogico: a.responsavelPedagogico || '—',
          })
        })
      })
      exportPDF({
        title: 'Alunos por Turma — Detalhado',
        subtitle: `Ano Letivo ${filters.anoLetivo} · ${groups.length} turmas · ${allData.length} alunos`,
        data: detalhadoData,
        columns: [
          { key: '_indice',              label: 'Nº',            type: 'text',   align: 'center', width: 40 },
          { key: 'turma',                label: 'Turma',         type: 'text',   width: 120 },
          { key: 'turno',                label: 'Turno',         type: 'text',   width: 70 },
          { key: 'codigo',               label: 'Matrícula',     type: 'text',   width: 80 },
          { key: 'nome',                 label: 'Nome',          type: 'text' },
          { key: 'situacaoNome',         label: 'Situação',      type: 'text',   width: 100 },
          { key: 'nivelEnsino',          label: 'Nível',         type: 'text',   width: 120 },
          { key: 'dataMatricula',        label: 'Dt. Matrícul',  type: 'text',   width: 100 },
          { key: 'responsavelPedagogico',label: 'Responsável',   type: 'text',   width: 140 },
        ],
        filters: filterDesc,
        nomeEscola, cnpj, logo, userName,
        orientation: 'landscape',
      })
    }
  }

  const handleExportXLSX = () => {
    if (modelo === 'resumo') {
      const resumoData = groups.map(g => ({
        turma: g.turma, turno: g.turno || '', nivelEnsino: g.nivelEnsino || '',
        unidade: g.unidade || '', total: g.alunos.length, ativos: g.ativos,
        inativos: g.inativos, anoLetivo: g.anoLetivo || filters.anoLetivo,
      }))
      exportXLSX({
        title: 'Alunos por Turma — Resumo',
        data: resumoData,
        columns: [
          { key: 'turma',       label: 'Turma',      type: 'text'   },
          { key: 'turno',       label: 'Turno',      type: 'text'   },
          { key: 'nivelEnsino', label: 'Nível',      type: 'text'   },
          { key: 'unidade',     label: 'Unidade',    type: 'text'   },
          { key: 'total',       label: 'Total',      type: 'number' },
          { key: 'ativos',      label: 'Ativos',     type: 'number' },
          { key: 'inativos',    label: 'Inativos',   type: 'number' },
          { key: 'anoLetivo',   label: 'Ano Letivo', type: 'text'   },
        ],
        filters: filterDesc, userName,
      })
    } else {
      const rows: Record<string, unknown>[] = []
      groups.forEach(g => g.alunos.forEach(a => rows.push({
        turma: g.turma, turno: g.turno || '',
        codigo: a.codigo, nome: a.nome,
        situacaoNome: a.situacaoNome || a.statusMatricula || '',
        nivelEnsino: a.nivelEnsino || '',
        dataMatricula: a.dataMatricula || '',
        dataNascimento: a.dataNascimento || '',
        responsavelPedagogico: a.responsavelPedagogico || '',
      })))
      exportXLSX({
        title: 'Alunos por Turma — Detalhado',
        data: rows,
        columns: [
          { key: 'turma',                label: 'Turma',         type: 'text' },
          { key: 'turno',                label: 'Turno',         type: 'text' },
          { key: 'codigo',               label: 'Matrícula',     type: 'text' },
          { key: 'nome',                 label: 'Nome',          type: 'text' },
          { key: 'situacaoNome',         label: 'Situação',      type: 'text' },
          { key: 'nivelEnsino',          label: 'Nível',         type: 'text' },
          { key: 'dataMatricula',        label: 'Dt. Matrícula', type: 'text' },
          { key: 'dataNascimento',       label: 'Dt. Nascimento',type: 'text' },
          { key: 'responsavelPedagogico',label: 'Responsável',   type: 'text' },
        ],
        filters: filterDesc, userName,
      })
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ─── PAGE HEADER ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon">
            <ArrowLeft size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
            }}>
              <BookMarked size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>
                Alunos por Turma
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                Visão consolidada por agrupamento de turmas — Gestão Pedagógica
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            <RefreshCw size={11} /> Atualizar
          </button>

          <div style={{ height: 16, width: 1, background: 'hsl(var(--border-subtle))' }} />

          {/* Modelo Selector */}
          <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-elevated))', borderRadius: 10, padding: 3, border: '1px solid hsl(var(--border-subtle))' }}>
            {MODELOS.map(m => (
              <button
                key={m.value}
                onClick={() => setModelo(m.value as any)}
                style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: modelo === m.value ? '#6366f1' : 'transparent',
                  color: modelo === m.value ? '#fff' : 'hsl(var(--text-muted))',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span>{m.icon}</span> {m.label.split('—')[0].trim()}
              </button>
            ))}
          </div>

          <button onClick={handleExportPDF} className="btn btn-danger btn-sm" style={{ gap: 5, padding: '0 14px' }}>
            <FileText size={12} /> PDF
          </button>
          <button onClick={handleExportXLSX} className="btn btn-sm" style={{ gap: 5, padding: '0 14px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'inherit' }}>
            <FileSpreadsheet size={12} /> Excel
          </button>
        </div>
      </div>

      {/* ─── KPI BAR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard icon={<School size={18} />}    label="Total de Turmas"   value={stats.totalTurmas}    color="#6366f1" />
        <KPICard icon={<Users size={18} />}     label="Total de Alunos"   value={stats.totalAlunos}    color="#3b82f6" />
        <KPICard icon={<UserCheck size={18} />} label="Alunos Ativos"     value={stats.ativos}         color="#10b981" sub={stats.totalAlunos > 0 ? `${Math.round(stats.ativos/stats.totalAlunos*100)}% do total` : ''} />
        <KPICard icon={<TrendingUp size={18} />}label="Média por Turma"   value={stats.mediaPorTurma}  color="#f59e0b" sub="alunos/turma" />
        <KPICard icon={<Calendar size={18} />}  label="Ano Letivo"        value={filters.anoLetivo}   color="#8b5cf6" />
      </div>

      {/* ─── FILTER PANEL ────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
        <div
          onClick={() => setFilterOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: filterOpen ? '1px solid hsl(var(--border-subtle))' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color="#6366f1" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Filtros de Pesquisa
            </span>
            {activeCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: '#6366f1', color: '#fff' }}>
                {activeCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeCount > 0 && (
              <button
                onClick={e => { e.stopPropagation(); clearFilters() }}
                style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Limpar filtros
              </button>
            )}
            {filterOpen ? <ChevronUp size={14} color="hsl(var(--text-muted))" /> : <ChevronDown size={14} color="hsl(var(--text-muted))" />}
          </div>
        </div>

        {filterOpen && (
          <div style={{ padding: '18px 20px' }}>
            {/* Row 1: busca + Turma + Ano Letivo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Buscar</label>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input value={filters.busca} onChange={e => setFilter('busca', e.target.value)} placeholder="Nome ou matrícula do aluno..." className="form-input" style={{ paddingLeft: 30, fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Turma</label>
                <button
                  onClick={() => setTurmaModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                    background: filters.turmaNome ? 'rgba(99,102,241,0.08)' : 'hsl(var(--bg-elevated))',
                    border: `1px solid ${filters.turmaNome ? 'rgba(99,102,241,0.35)' : 'hsl(var(--border-subtle))'}`,
                    color: filters.turmaNome ? '#6366f1' : 'hsl(var(--text-secondary))',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  <School size={13} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{filters.turmaNome || 'Selecionar Turma...'}</span>
                  {filters.turmaNome && (
                    <span onClick={e => { e.stopPropagation(); setFilters(p => ({ ...p, turma: '', turmaId: '', turmaNome: '', unidade: '' })) }} style={{ cursor: 'pointer', opacity: 0.6, lineHeight: 0 }}><X size={11} /></span>
                  )}
                  {!filters.turmaNome && <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.5 }} />}
                </button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Ano Letivo</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6366f1', pointerEvents: 'none', zIndex: 1 }} />
                  <select value={filters.anoLetivo} onChange={e => setFilter('anoLetivo', e.target.value)} className="form-input" style={{ paddingLeft: 30, fontSize: 13, fontWeight: 700, minWidth: 110, color: 'hsl(var(--text-primary))', border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.05)' }}>
                    {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Nível + Unidade + Situação + Turno */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Nível de Ensino</label>
                <select value={filters.nivelEnsino} onChange={e => setFilter('nivelEnsino', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '7px 10px' }}>
                  <option value="">Todos os Níveis</option>
                  {(cfgNiveisEnsino || NIVEL_OPTIONS.map((n, i) => ({ id: i, nome: n }))).filter((n: any) => n.situacao !== 'inativo').map((n: any) => (
                    <option key={n.id} value={n.nome}>{n.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Unidade</label>
                {filters.turmaNome ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', minHeight: 36 }}>
                    <Building2 size={12} color="#6366f1" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>{filters.unidade || '—'}</span>
                    <span style={{ fontSize: 10, color: 'hsl(var(--text-disabled))', marginLeft: 'auto' }}>Da turma</span>
                  </div>
                ) : (
                  <select value={filters.unidade} onChange={e => setFilter('unidade', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '7px 10px' }}>
                    <option value="">Todas as Unidades</option>
                    {unidades.map((u, i) => <option key={i} value={u}>{u}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Situação da Matrícula</label>
                <select value={filters.situacaoNome} onChange={e => setFilter('situacaoNome', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '7px 10px' }}>
                  <option value="">Todas as Situações</option>
                  {(cfgSituacaoAluno || []).filter((s: any) => s.situacao !== 'inativo').map((s: any) => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Turno</label>
                <select value={filters.turno} onChange={e => setFilter('turno', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '7px 10px' }}>
                  <option value="">Todos os Turnos</option>
                  {(cfgTurnos || []).filter((t: any) => t.situacao !== 'inativo').map((t: any) => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Ordenar</label>
                <div style={{ position: 'relative' }}>
                  <SortAsc size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <select value={sortValue} onChange={e => setSortValue(e.target.value)} className="form-input" style={{ paddingLeft: 28, fontSize: 12 }}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3: Date Range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480 }}>
              <DatePicker label="Data de Matrícula — De" value={filters.dataInicio} onChange={v => setFilter('dataInicio', v)} maxDate={filters.dataFim || undefined} />
              <DatePicker label="Data de Matrícula — Até" value={filters.dataFim} onChange={v => setFilter('dataFim', v)} minDate={filters.dataInicio || undefined} />
            </div>
          </div>
        )}
      </div>

      {/* ─── TURMA MODAL ─────────────────────────────────── */}
      <TurmaModal
        open={turmaModalOpen}
        onClose={() => setTurmaModalOpen(false)}
        onSelect={(id, nome, turno, unidade) => {
          setFilters(prev => ({
            ...prev,
            turma: nome,
            turmaId: id,
            turmaNome: nome,
            unidade: unidade,
          }))
        }}
        selectedTurmaId={filters.turmaId}
      />

      {/* ─── RESULTS HEADER ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Carregando...
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{groups.length}</strong> turmas ·{' '}
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{allData.length.toLocaleString('pt-BR')}</strong> alunos
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: modelo === 'resumo' ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)', color: modelo === 'resumo' ? '#6366f1' : '#3b82f6', border: `1px solid ${modelo === 'resumo' ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
            {MODELOS.find(m => m.value === modelo)?.label}
          </span>
        </div>
        {modelo === 'detalhado' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={expandAll} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', fontFamily: 'inherit' }}>Expandir todos</button>
            <button onClick={collapseAll} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', fontFamily: 'inherit' }}>Recolher todos</button>
          </div>
        )}
      </div>

      {/* ─── CONTENT ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, gap: 14 }}>
          <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite', color: '#6366f1' }} />
          <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>Carregando dados por turma...</div>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, gap: 14 }}>
          <AlertCircle size={40} style={{ opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhuma turma encontrada</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Ajuste os filtros para ampliar a busca</div>
          <button onClick={clearFilters} className="btn btn-primary btn-sm">Limpar Filtros</button>
        </div>
      ) : modelo === 'resumo' ? (
        /* ─── RESUMO VIEW ──────────────────────────────── */
        <div className="card" style={{ overflow: 'hidden', borderRadius: 16, padding: 0, border: '1px solid hsl(var(--border-subtle))' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                {[
                  { label: 'Turma',           w: undefined },
                  { label: 'Nível de Ensino', w: 160 },
                  { label: 'Turno',           w: 90 },
                  { label: 'Unidade',         w: 140 },
                  { label: 'Ano Letivo',      w: 90 },
                  { label: 'Total',           w: 70 },
                  { label: 'Ativos',          w: 80 },
                  { label: 'Outros',          w: 80 },
                  { label: 'Ocupação',        w: 120 },
                ].map((col, i) => (
                  <th key={i} style={{ padding: '12px 14px', textAlign: i >= 5 ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', borderBottom: '1px solid hsl(var(--border-subtle))', width: col.w, minWidth: col.w }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                const pct = g.alunos.length > 0 ? Math.round(g.ativos / g.alunos.length * 100) : 0
                return (
                  <tr key={g.turma} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? '' : 'hsl(var(--bg-elevated))', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '' : 'hsl(var(--bg-elevated))'}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                          {g.turma.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{g.turma}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{g.nivelEnsino || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.15)' }}>{g.turno || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{g.unidade || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center' }}>{g.anoLetivo || filters.anoLetivo}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6', fontFamily: 'Outfit,sans-serif' }}>{g.alunos.length}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{g.ativos}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{g.inativos}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'hsl(var(--bg-elevated))', borderRadius: 6, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct > 75 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444', borderRadius: 6, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', minWidth: 32 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(99,102,241,0.05)', borderTop: '2px solid rgba(99,102,241,0.2)' }}>
                <td colSpan={5} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAIS</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 16, fontWeight: 900, color: '#3b82f6', fontFamily: 'Outfit,sans-serif' }}>{allData.length}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#10b981' }}>{stats.ativos}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#64748b' }}>{allData.length - stats.ativos}</td>
                <td style={{ padding: '10px 14px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ─── DETALHADO VIEW ───────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => {
            const expanded = expandedTurmas.has(g.turma)
            const pct = g.alunos.length > 0 ? Math.round(g.ativos / g.alunos.length * 100) : 0
            return (
              <div key={g.turma} className="card" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
                {/* Turma header */}
                <div
                  onClick={() => toggleTurma(g.turma)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    cursor: 'pointer', transition: 'background 0.15s',
                    background: expanded ? 'rgba(99,102,241,0.04)' : '',
                    borderBottom: expanded ? '1px solid hsl(var(--border-subtle))' : 'none',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
                    {g.turma.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{g.turma}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                      {g.nivelEnsino && <span>📚 {g.nivelEnsino}</span>}
                      {g.turno && <span>🕐 {g.turno}</span>}
                      {g.unidade && <span>🏫 {g.unidade}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#3b82f6', fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{g.alunos.length}</div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', letterSpacing: '0.07em' }}>Alunos</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{g.ativos}</div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', letterSpacing: '0.07em' }}>Ativos</div>
                    </div>
                    <div style={{ width: 60 }}>
                      <div style={{ height: 5, background: 'hsl(var(--bg-elevated))', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 75 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textAlign: 'center', marginTop: 3 }}>{pct}%</div>
                    </div>
                    {expanded ? <ChevronUp size={16} color="hsl(var(--text-muted))" /> : <ChevronDown size={16} color="hsl(var(--text-muted))" />}
                  </div>
                </div>

                {/* Alunos table */}
                {expanded && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                          {['Nº', 'Matrícula', 'Nome', 'Situação', 'Data Matrícula', 'Nascimento', 'Responsável'].map((h, i) => (
                            <th key={i} style={{ padding: '9px 12px', textAlign: i === 0 ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.alunos.map((a, idx) => (
                          <tr key={a.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: idx % 2 === 0 ? '' : 'hsl(var(--bg-elevated))', transition: 'background 0.1s', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '' : 'hsl(var(--bg-elevated))'}
                            onClick={() => router.push(`/academico/alunos/${a.id}`)}
                          >
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-disabled))' }}>{idx + 1}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{a.codigo || '—'}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: `hsl(${(a.nome?.charCodeAt(0) || 0) * 37 % 360},55%,50%)18`, color: `hsl(${(a.nome?.charCodeAt(0) || 0) * 37 % 360},55%,40%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                  {a.nome?.charAt(0)?.toUpperCase()}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{a.nome}</span>
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.2)' }}>
                                {a.situacaoNome || a.statusMatricula || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.dataMatricula ? fmtDate(a.dataMatricula) : '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.dataNascimento ? fmtDate(a.dataNascimento) : '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: 'hsl(var(--text-secondary))', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.responsavelPedagogico || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
