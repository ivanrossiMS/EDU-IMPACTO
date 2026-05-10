'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, Search, Filter, X, ChevronDown, ChevronUp,
  FileText, FileSpreadsheet, RefreshCw, Download, GraduationCap,
  Calendar, SortAsc, SortDesc, School, LayoutGrid, LayoutList,
  ChevronLeft, ChevronRight, Loader2, Check, AlertCircle,
  BookOpen, UserCheck, UserX, Clock, Star, Eye, Phone, Mail,
  BarChart3, TrendingUp, Info
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
  situacaoNome: string        // real situacao text from cfgSituacaoAluno
  grupoAlunos: string         // real grupo text from cfgGruposAlunos
  nivelEnsino: string         // resolved from turma/serie
  dataNascimento: string
  idade: number
  email: string
  telefone: string
  sexo: string
  anoLetivo: string
  dataMatricula: string
  responsavelPedagogico: string
  telefonePedagogico: string
  responsavelFinanceiro: string
}

interface FilterState {
  busca: string
  turma: string
  turmaId: string
  turmaNome: string
  grupoAluno: string
  nivelEnsino: string
  anoLetivo: string
  statusMatricula: string   // normalized for badge display
  situacaoNome: string      // exact cfgSituacaoAluno.nome for engine filter
  dataInicio: string
  dataFim: string
  turno: string
  sexo: string
  unidade: string
}

interface TurmaItem {
  id: string
  nome: string
  serie: string
  turno: string
  ano: number
  matriculados: number
  capacidade: number
}

// ─── Constants ────────────────────────────────────────────

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

const SORT_OPTIONS = [
  { value: 'nome|asc',          label: 'Nome (A→Z)' },
  { value: 'nome|desc',         label: 'Nome (Z→A)' },
  { value: 'turma|asc',         label: 'Turma (A→Z)' },
  { value: 'codigo|asc',        label: 'Matrícula (A→Z)' },
  { value: 'dataMatricula|asc', label: 'Dt. Matrícula (↑)' },
  { value: 'dataMatricula|desc',label: 'Dt. Matrícula (↓)' },
  { value: 'dataNascimento|asc',label: 'Dt. Nascimento (↑)' },
  { value: 'statusMatricula|asc', label: 'Situação (A→Z)' },
]

// STATUS_OPTIONS, NIVEL_ENSINO, and GRUPOS are now built dynamically
// from cfgSituacaoAluno, cfgNiveisEnsino, and cfgGruposAlunos via useData().
// The following are kept as fallback colors for the badge display.
const STATUS_BADGE_MAP: Record<string, { color: string; label: string }> = {
  'Ativo':     { color: '#10b981', label: 'Ativo'     },
  'Inativo':   { color: '#ef4444', label: 'Inativo'   },
  'Trancado':  { color: '#f59e0b', label: 'Trancado'  },
  'Cancelado': { color: '#6b7280', label: 'Cancelado' },
  'Formado':   { color: '#3b82f6', label: 'Formado'   },
}

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : s
}

function statusBadge(status: string) {
  const entry = STATUS_BADGE_MAP[status]
  return entry || { color: '#64748b', label: status || 'Desconhecido' }
}

function calcStats(data: AlunoRow[]) {
  const total    = data.length
  const ativos   = data.filter(a => a.statusMatricula === 'Ativo').length
  const inativos = data.filter(a => a.statusMatricula === 'Inativo' || a.statusMatricula === 'Trancado').length
  const masc     = data.filter(a => a.sexo === 'M').length
  const fem      = data.filter(a => a.sexo === 'F').length
  return { total, ativos, inativos, masc, fem }
}


// ─── DatePicker ───────────────────────────────────────────

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['D','S','T','Q','Q','S','S']

function DatePicker({ label, value, onChange, minDate, maxDate }: {
  label: string; value: string; onChange: (v: string) => void; minDate?: string; maxDate?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    if (value) { const d = new Date(value + 'T12:00'); return { year: d.getFullYear(), month: d.getMonth() } }
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Display value
  const displayVal = value ? (() => {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  })() : ''

  // Build calendar grid
  const firstDay = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isoVal = (d: number) => `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isSelected = (d: number) => isoVal(d) === value
  const isToday = (d: number) => isoVal(d) === today.toISOString().slice(0, 10)
  const isDisabled = (d: number) => {
    const v = isoVal(d)
    if (minDate && v < minDate) return true
    if (maxDate && v > maxDate) return true
    return false
  }

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })

  // Quick shortcuts
  const shortcuts = [
    { label: 'Hoje', val: today.toISOString().slice(0, 10) },
    { label: 'Início do mês', val: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01` },
    { label: 'Início do ano', val: `${today.getFullYear()}-01-01` },
  ]

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
        {label}
      </label>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          background: value ? 'rgba(59,130,246,0.06)' : 'hsl(var(--bg-elevated))',
          border: `1px solid ${value ? 'rgba(59,130,246,0.35)' : 'hsl(var(--border-subtle))'}`,
          color: value ? '#3b82f6' : 'hsl(var(--text-muted))',
          fontSize: 12, fontWeight: value ? 600 : 400, fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
      >
        <Calendar size={13} style={{ flexShrink: 0, opacity: value ? 1 : 0.5 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{displayVal || 'Selecionar data...'}</span>
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{ cursor: 'pointer', opacity: 0.6, lineHeight: 0 }}
          >
            <X size={11} />
          </span>
        )}
        {!value && <ChevronDown size={11} style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            background: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-default))',
            borderRadius: 16, zIndex: 9999,
            boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
            minWidth: 280, overflow: 'hidden',
          }}
        >
          {/* Month nav */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.04))',
            borderBottom: '1px solid hsl(var(--border-subtle))',
          }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: '2px 6px', borderRadius: 6, transition: 'all 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-elevated))'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
              {MESES[view.month]} {view.year}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: '2px 6px', borderRadius: 6, transition: 'all 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-elevated))'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 10px 4px' }}>
            {DIAS_SEMANA.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-disabled))', textTransform: 'uppercase', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px 8px', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const sel = isSelected(day)
              const tod = isToday(day)
              const dis = isDisabled(day)
              return (
                <button
                  key={i}
                  disabled={dis}
                  onClick={() => { onChange(isoVal(day)); setOpen(false) }}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 8, fontSize: 12, fontWeight: sel ? 800 : tod ? 700 : 400,
                    background: sel ? '#3b82f6' : tod ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: sel ? '#fff' : dis ? 'hsl(var(--text-disabled))' : tod ? '#3b82f6' : 'hsl(var(--text-primary))',
                    border: `1px solid ${sel ? '#3b82f6' : tod ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                    cursor: dis ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s', fontFamily: 'inherit',
                    opacity: dis ? 0.35 : 1,
                  }}
                  onMouseEnter={e => { if (!dis && !sel) e.currentTarget.style.background = 'hsl(var(--bg-elevated))' }}
                  onMouseLeave={e => { if (!dis && !sel) e.currentTarget.style.background = 'transparent' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Shortcuts */}
          <div style={{ padding: '8px 10px 12px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shortcuts.map(s => (
              <button
                key={s.label}
                onClick={() => {
                  const d = new Date(s.val + 'T12:00')
                  setView({ year: d.getFullYear(), month: d.getMonth() })
                  onChange(s.val)
                  setOpen(false)
                }}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 8,
                  background: value === s.val ? 'rgba(59,130,246,0.12)' : 'hsl(var(--bg-elevated))',
                  color: value === s.val ? '#3b82f6' : 'hsl(var(--text-muted))',
                  border: `1px solid ${value === s.val ? 'rgba(59,130,246,0.3)' : 'hsl(var(--border-subtle))'}`,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                {s.label}
              </button>
            ))}
            {value && (
              <button
                onClick={() => onChange('')}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                  cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Turma ──────────────────────────────────────────

function TurmaModal({
  open, onClose, onSelect, selectedTurmaId
}: {
  open: boolean
  onClose: () => void
  onSelect: (id: string, nome: string) => void
  selectedTurmaId: string
}) {
  const [anoFiltro, setAnoFiltro] = useState(String(ANO_ATUAL))
  const [busca, setBusca] = useState('')
  const [turmas, setTurmas] = useState<TurmaItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/relatorios/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'turmas', filters: { anoLetivo: anoFiltro }, page: 1, pageSize: 500, sortField: 'nome', sortDir: 'asc' }),
    })
      .then(r => r.json())
      .then(d => setTurmas(d.data || []))
      .catch(() => setTurmas([]))
      .finally(() => setLoading(false))
  }, [open, anoFiltro])

  const filtered = useMemo(() => {
    if (!busca.trim()) return turmas
    const b = busca.toLowerCase()
    return turmas.filter(t => t.nome?.toLowerCase().includes(b) || t.serie?.toLowerCase().includes(b) || t.turno?.toLowerCase().includes(b))
  }, [turmas, busca])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 560, width: '90vw', padding: 0, overflow: 'hidden',
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-default))',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.04))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(59,130,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <School size={17} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Selecionar Turma</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Escolha o ano letivo e a turma</div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ borderRadius: 8 }}>
              <X size={15} />
            </button>
          </div>

          {/* Ano Selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center', marginRight: 4 }}>Ano:</span>
            {ANOS.map(ano => (
              <button
                key={ano}
                onClick={() => setAnoFiltro(String(ano))}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: anoFiltro === String(ano) ? '#3b82f6' : 'hsl(var(--bg-elevated))',
                  color: anoFiltro === String(ano) ? '#fff' : 'hsl(var(--text-secondary))',
                  border: `1px solid ${anoFiltro === String(ano) ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {ano}
              </button>
            ))}
          </div>

          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar turma, série, turno..."
              className="form-input"
              style={{ paddingLeft: 34, fontSize: 12, borderRadius: 10 }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 36, color: 'hsl(var(--text-muted))' }}>
              <School size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>Nenhuma turma encontrada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Option: Todas */}
              <button
                onClick={() => { onSelect('', 'Todas as Turmas'); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: selectedTurmaId === '' ? 'rgba(59,130,246,0.08)' : 'transparent',
                  border: `1px solid ${selectedTurmaId === '' ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  transition: 'all 0.12s', fontFamily: 'inherit',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(100,116,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LayoutGrid size={14} color="#64748b" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Todas as Turmas</div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Exibir todos os alunos</div>
                </div>
                {selectedTurmaId === '' && <Check size={14} color="#3b82f6" />}
              </button>

              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.nome, t.nome); onClose() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                    background: selectedTurmaId === t.nome ? 'rgba(59,130,246,0.08)' : 'transparent',
                    border: `1px solid ${selectedTurmaId === t.nome ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                    transition: 'all 0.12s', fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(59,130,246,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#3b82f6',
                  }}>
                    {t.serie?.charAt(0) || t.nome?.charAt(0) || 'T'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nome}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                      {[t.serie, t.turno].filter(Boolean).join(' · ')}
                      {t.matriculados != null && <span style={{ marginLeft: 6 }}> · {t.matriculados} alunos</span>}
                    </div>
                  </div>
                  {selectedTurmaId === t.nome && <Check size={14} color="#3b82f6" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fechar</button>
        </div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div style={{
      background: 'hsl(var(--bg-surface))',
      border: '1px solid hsl(var(--border-subtle))',
      borderRadius: 16, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'all 0.2s',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: `${color}14`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-disabled))', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function RelacaoAlunosPage() {
  const router = useRouter()
  const { mantenedores, cfgSituacaoAluno, cfgTurnos, cfgGruposAlunos, cfgNiveisEnsino } = useData()
  const { currentUser } = useApp()

  // Data
  const [data, setData] = useState<AlunoRow[]>([])
  const [allData, setAllData] = useState<AlunoRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [filterOpen, setFilterOpen] = useState(true)
  const [turmaModalOpen, setTurmaModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [sortValue, setSortValue] = useState('nome|asc')
  const [modeloRelatorio, setModeloRelatorio] = useState<'normal' | 'chamada_paisagem' | 'chamada_retrato'>('normal')

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    busca: '',
    turma: '',
    turmaId: '',
    turmaNome: '',
    grupoAluno: '',
    nivelEnsino: '',
    anoLetivo: String(ANO_ATUAL),
    statusMatricula: 'Ativo',
    situacaoNome: '',
    dataInicio: '',
    dataFim: '',
    turno: '',
    sexo: '',
    unidade: '',
  })

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let c = 0
    if (filters.turma) c++
    if (filters.grupoAluno) c++
    if (filters.nivelEnsino) c++
    if (filters.statusMatricula && filters.statusMatricula !== 'Ativo') c++
    if (filters.dataInicio || filters.dataFim) c++
    if (filters.turno) c++
    if (filters.sexo) c++
    return c
  }, [filters])

  const [sortField, sortDir] = sortValue.split('|') as [string, 'asc' | 'desc']

  // School info
  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const userName = currentUser?.nome || 'Usuário'

  // Fetch
  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true)
    const apiFilters: Record<string, string> = {}
    if (filters.busca)          apiFilters.busca          = filters.busca
    if (filters.turma)          apiFilters.turma          = filters.turma
    if (filters.anoLetivo)      apiFilters.anoLetivo      = filters.anoLetivo
    if (filters.statusMatricula) apiFilters.statusMatricula = filters.statusMatricula
    if (filters.situacaoNome)   apiFilters.situacaoNome   = filters.situacaoNome
    if (filters.dataInicio)     apiFilters.dataInicio     = filters.dataInicio
    if (filters.dataFim)        apiFilters.dataFim        = filters.dataFim
    if (filters.turno)          apiFilters.turno          = filters.turno
    if (filters.grupoAluno)     apiFilters.grupoAluno     = filters.grupoAluno
    if (filters.nivelEnsino)    apiFilters.nivelEnsino    = filters.nivelEnsino
    if (filters.sexo)           apiFilters.sexo           = filters.sexo
    if (filters.unidade)        apiFilters.unidade        = filters.unidade

    try {
      const [pageRes, allRes] = await Promise.all([
        fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'alunos_relacao', filters: apiFilters, page: pg, pageSize, sortField, sortDir }),
        }).then(r => r.json()),
        fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'alunos_relacao', filters: apiFilters, page: 1, pageSize: 5000, sortField, sortDir }),
        }).then(r => r.json()),
      ])

      setData(pageRes.data || [])
      setTotal(pageRes.total || 0)
      setAllData(allRes.data || [])
      setPage(pg)
    } catch {
      setData([])
      setTotal(0)
      setAllData([])
    } finally {
      setLoading(false)
    }
  }, [filters, sortField, sortDir])

  useEffect(() => { fetchData(1) }, [filters, sortField, sortDir])

  const stats = useMemo(() => calcStats(allData), [allData])
  const totalPages = Math.ceil(total / pageSize)

  const exportColumns = useMemo(() => {
    if (modeloRelatorio.includes('chamada')) {
      return [
        { key: '_indice',              label: 'Nº',               type: 'text'   as const, align: 'center' as const, width: 40 },
        { key: 'codigo',               label: 'Matrícula',        type: 'text'   as const, width: 80 },
        { key: 'nome',                 label: 'Nome',              type: 'text'   as const },
        { key: 'situacaoNome',         label: 'Situação',          type: 'text'   as const, width: 120 },
        { key: '_assinatura',          label: 'Assinatura',        type: 'signature' as any },
      ]
    }
    return [
      { key: 'codigo',               label: 'Matrícula',        type: 'text'   as const },
      { key: 'nome',                 label: 'Nome',              type: 'text'   as const },
      { key: 'turma',                label: 'Turma',             type: 'text'   as const },
      { key: 'turno',                label: 'Turno',             type: 'text'   as const },
      { key: 'unidade',              label: 'Unidade',           type: 'text'   as const },
      { key: 'situacaoNome',         label: 'Situação',          type: 'text'   as const },
      { key: 'dataMatricula',        label: 'Dt. Matrícula',     type: 'date'   as const },
      { key: 'dataNascimento',       label: 'Dt. Nascimento',    type: 'date'   as const },
      { key: 'idade',                label: 'Idade',             type: 'number' as const },
      { key: 'sexo',                 label: 'Sexo',              type: 'text'   as const },
      { key: 'responsavelPedagogico',label: 'Resp. Pedagógico',  type: 'text'   as const },
      { key: 'telefonePedagogico',   label: 'Tel. Pedagógico',   type: 'text'   as const },
      { key: 'email',                label: 'E-mail',            type: 'text'   as const },
      { key: 'anoLetivo',            label: 'Ano Letivo',        type: 'text'   as const },
    ]
  }, [modeloRelatorio])

  const filterDesc = useMemo(() => {
    const d: Record<string, string> = {}
    if (filters.turmaNome) d['Turma'] = filters.turmaNome
    if (filters.grupoAluno) d['Grupo'] = filters.grupoAluno
    if (filters.nivelEnsino) d['Nível de Ensino'] = filters.nivelEnsino
    if (filters.anoLetivo) d['Ano Letivo'] = filters.anoLetivo
    if (filters.statusMatricula) d['Situação'] = filters.statusMatricula
    if (filters.dataInicio) d['Data Início'] = filters.dataInicio
    if (filters.dataFim) d['Data Fim'] = filters.dataFim
    return d
  }, [filters])

  const handleExportPDF = () => {
    let sub = `${nomeEscola} · Ano Letivo ${filters.anoLetivo}`
    if (modeloRelatorio.includes('chamada')) {
      sub = `Turma: ${filters.turmaNome || 'Todas'} · Turno: ${filters.turno || 'Todos'} · Ano Letivo: ${filters.anoLetivo}`
    }
    exportPDF({
      title: modeloRelatorio.includes('chamada') ? 'Lista de Chamada' : 'Relação de Alunos',
      subtitle: sub,
      data: allData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      filters: filterDesc,
      nomeEscola,
      cnpj,
      logo,
      userName,
      totals: { count: total },
      orientation: modeloRelatorio === 'chamada_retrato' ? 'portrait' : 'landscape'
    })
  }

  const handleExportXLSX = () => {
    exportXLSX({
      title: modeloRelatorio.includes('chamada') ? 'Lista de Chamada' : 'Relação de Alunos',
      data: allData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      filters: filterDesc,
      userName,
      totals: { count: total },
    })
  }

  const setFilter = (key: keyof FilterState, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  const clearFilters = () => setFilters({
    busca: '',
    turma: '',
    turmaId: '',
    turmaNome: '',
    grupoAluno: '',
    nivelEnsino: '',
    anoLetivo: String(ANO_ATUAL),
    statusMatricula: '',
    situacaoNome: '',
    dataInicio: '',
    dataFim: '',
    turno: '',
    sexo: '',
    unidade: '',
  })

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ─── HEADER ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon">
            <ArrowLeft size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(59,130,246,0.35)',
            }}>
              <GraduationCap size={21} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>
                Relação de Alunos
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                Listagem completa de alunos matriculados
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => fetchData(page)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            <RefreshCw size={11} /> Atualizar
          </button>
          <button
            onClick={() => setViewMode(v => v === 'table' ? 'grid' : 'table')}
            className="btn btn-secondary btn-sm"
            style={{ gap: 5 }}
          >
            {viewMode === 'table' ? <LayoutGrid size={11} /> : <LayoutList size={11} />}
            {viewMode === 'table' ? 'Cards' : 'Tabela'}
          </button>

          <div style={{ height: 16, width: 1, background: 'hsl(var(--border-subtle))', margin: '0 4px' }} />

          <select 
            value={modeloRelatorio} 
            onChange={e => setModeloRelatorio(e.target.value as any)}
            className="form-input"
            style={{ height: 32, fontSize: 11, padding: '0 8px 0 10px', borderRadius: 8, width: 190, background: 'hsl(var(--bg-elevated))' }}
          >
             <option value="normal">Modelo Normal</option>
             <option value="chamada_paisagem">Lista de Chamada (Paisagem)</option>
             <option value="chamada_retrato">Lista de Chamada (Retrato)</option>
          </select>
          <button onClick={handleExportPDF} className="btn btn-danger btn-sm" style={{ gap: 5, padding: '0 12px' }}>
            <FileText size={12} /> PDF
          </button>
          <button onClick={handleExportXLSX} className="btn btn-sm" style={{ gap: 5, padding: '0 12px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'inherit' }}>
            <FileSpreadsheet size={12} /> Excel
          </button>
        </div>
      </div>

      {/* ─── KPI BAR ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <KPICard icon={<Users size={18} />} label="Total" value={stats.total} sub="alunos filtrados" color="#3b82f6" />
        <KPICard icon={<UserCheck size={18} />} label="Ativos" value={stats.ativos} sub={`${stats.total ? Math.round(stats.ativos / stats.total * 100) : 0}% do total`} color="#10b981" />
        <KPICard icon={<UserX size={18} />} label="Inativos/Trancados" value={stats.inativos} color="#ef4444" />
        <KPICard icon={<Users size={18} />} label="Masculino" value={stats.masc} color="#6366f1" />
        <KPICard icon={<Users size={18} />} label="Feminino" value={stats.fem} color="#ec4899" />
      </div>

      {/* ─── FILTER PANEL ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
        {/* Filter header */}
        <div
          onClick={() => setFilterOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', width: '100%', background: 'transparent',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: filterOpen ? '1px solid hsl(var(--border-subtle))' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color="#3b82f6" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Filtros de Pesquisa
            </span>
            {activeFilterCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                background: '#3b82f6', color: '#fff',
              }}>
                {activeFilterCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeFilterCount > 0 && (
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
            {/* Row 1: Busca + Turma + Ano Letivo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              {/* Busca */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Buscar Aluno
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    value={filters.busca}
                    onChange={e => setFilter('busca', e.target.value)}
                    placeholder="Nome, código ou matrícula..."
                    className="form-input"
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Turma */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Turma
                </label>
                <button
                  onClick={() => setTurmaModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                    background: filters.turma ? 'rgba(59,130,246,0.08)' : 'hsl(var(--bg-elevated))',
                    border: `1px solid ${filters.turma ? 'rgba(59,130,246,0.35)' : 'hsl(var(--border-subtle))'}`,
                    color: filters.turma ? '#3b82f6' : 'hsl(var(--text-secondary))',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    minWidth: 180, maxWidth: 220, transition: 'all 0.15s',
                  }}
                >
                  <School size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
                    {filters.turmaNome || 'Todas as Turmas'}
                  </span>
                  <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                </button>
              </div>

              {/* Ano Letivo */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Ano Letivo
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#3b82f6', pointerEvents: 'none', zIndex: 1 }} />
                  <select
                    value={filters.anoLetivo}
                    onChange={e => setFilter('anoLetivo', e.target.value)}
                    className="form-input"
                    style={{
                      paddingLeft: 30, fontSize: 13, fontWeight: 700, minWidth: 100,
                      color: 'hsl(var(--text-primary))',
                      border: '1px solid rgba(59,130,246,0.35)',
                      background: 'rgba(59,130,246,0.05)',
                    }}
                  >
                    {ANOS.map(ano => (
                      <option key={ano} value={String(ano)}>{ano}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Situação + Nível + Grupo + Turno + Sexo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>

              {/* Situação da Matrícula — usa cfgSituacaoAluno real */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Situação da Matrícula
                </label>
                <select
                  value={filters.situacaoNome}
                  onChange={e => setFilter('situacaoNome', e.target.value)}
                  className="form-input"
                  style={{ fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Todas as Situações</option>
                  {(cfgSituacaoAluno || []).filter(s => s.situacao !== 'inativo').map(s => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>

              {/* Nível de Ensino — usa cfgNiveisEnsino real */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Nível de Ensino
                </label>
                <select
                  value={filters.nivelEnsino}
                  onChange={e => setFilter('nivelEnsino', e.target.value)}
                  className="form-input"
                  style={{ fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Todos os Níveis</option>
                  {(cfgNiveisEnsino || []).filter(n => n.situacao !== 'inativo').map(n => (
                    <option key={n.id} value={n.nome}>{n.nome}</option>
                  ))}
                </select>
              </div>

              {/* Grupo — usa cfgGruposAlunos real */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Grupo de Alunos
                </label>
                <select
                  value={filters.grupoAluno}
                  onChange={e => setFilter('grupoAluno', e.target.value)}
                  className="form-input"
                  style={{ fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Todos os Grupos</option>
                  {(cfgGruposAlunos || []).filter(g => g.situacao !== 'inativo').map(g => (
                    <option key={g.id} value={g.nome}>{g.nome}</option>
                  ))}
                </select>
              </div>

              {/* Turno — usa cfgTurnos real */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Turno
                </label>
                <select
                  value={filters.turno}
                  onChange={e => setFilter('turno', e.target.value)}
                  className="form-input"
                  style={{ fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Todos os Turnos</option>
                  {(cfgTurnos || []).filter(t => t.situacao !== 'inativo').map(t => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {/* Sexo */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Sexo
                </label>
                <select
                  value={filters.sexo}
                  onChange={e => setFilter('sexo', e.target.value)}
                  className="form-input"
                  style={{ fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>

            {/* Row 3: Datas + Ordenação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              <DatePicker
                label="Data De (matrícula)"
                value={filters.dataInicio}
                onChange={v => setFilter('dataInicio', v)}
                maxDate={filters.dataFim || undefined}
              />
              <DatePicker
                label="Data Até"
                value={filters.dataFim}
                onChange={v => setFilter('dataFim', v)}
                minDate={filters.dataInicio || undefined}
              />
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  Ordenar por
                </label>
                <div style={{ position: 'relative' }}>
                  <SortAsc size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <select
                    value={sortValue}
                    onChange={e => setSortValue(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: 28, fontSize: 12 }}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── RESULTS HEADER ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                Carregando...
              </span>
            ) : (
              <span>
                Exibindo <strong style={{ color: 'hsl(var(--text-primary))' }}>{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}</strong> de{' '}
                <strong style={{ color: 'hsl(var(--text-primary))' }}>{total.toLocaleString('pt-BR')}</strong> alunos
              </span>
            )}
          </div>
          {/* Active filter pills */}
          {filters.turmaNome && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
              <School size={9} /> {filters.turmaNome}
              <button onClick={() => setFilters(p => ({ ...p, turma: '', turmaId: '', turmaNome: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0, lineHeight: 1 }}><X size={9} /></button>
            </span>
          )}
          {filters.statusMatricula && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {filters.statusMatricula}
            </span>
          )}
          {filters.anoLetivo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Calendar size={9} /> {filters.anoLetivo}
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          {SORT_OPTIONS.find(o => o.value === sortValue)?.label}
        </div>
      </div>

      {/* ─── TABLE VIEW ───────────────────────────────────── */}
      {viewMode === 'table' ? (
        <div className="card" style={{ overflow: 'hidden', borderRadius: 16, padding: 0, border: '1px solid hsl(var(--border-subtle))' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 14 }}>
              <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6' }} />
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Carregando alunos...</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 14 }}>
              <AlertCircle size={36} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhum aluno encontrado</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Ajuste os filtros para ampliar a busca</div>
              <button onClick={clearFilters} className="btn btn-primary btn-sm">Limpar Filtros</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                    {[
                      { key: 'codigo',               label: 'Matrícula',       w: 90  },
                      { key: 'nome',                 label: 'Nome',             w: undefined },
                      { key: 'turma',                label: 'Turma',            w: 120 },
                      { key: 'turno',                label: 'Turno',            w: 80  },
                      { key: 'situacaoNome',         label: 'Situação',         w: 100 },
                      { key: 'dataMatricula',        label: 'Dt. Matrícula',    w: 110 },
                      { key: 'responsavelPedagogico',label: 'Responsável Ped.', w: 160 },
                      { key: 'telefonePedagogico',   label: 'Telefone',         w: 120 },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => {
                          const [sf] = sortValue.split('|')
                          if (sf === col.key) {
                            setSortValue(prev => prev.endsWith('asc') ? prev.replace('asc', 'desc') : prev.replace('desc', 'asc'))
                          } else {
                            setSortValue(`${col.key}|asc`)
                          }
                        }}
                        style={{
                          padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800,
                          color: sortField === col.key ? '#3b82f6' : 'hsl(var(--text-muted))',
                          textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer',
                          userSelect: 'none', whiteSpace: 'nowrap',
                          width: col.w, minWidth: col.w,
                          borderBottom: '1px solid hsl(var(--border-subtle))',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col.label}
                          {sortField === col.key && (
                            sortDir === 'asc'
                              ? <ChevronUp size={10} />
                              : <ChevronDown size={10} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((aluno, i) => {
                    const badge = statusBadge(aluno.statusMatricula)
                    return (
                      <tr
                        key={aluno.id || i}
                        style={{
                          borderBottom: '1px solid hsl(var(--border-subtle))',
                          transition: 'background 0.1s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onClick={() => router.push(`/academico/alunos/${aluno.id}`)}
                      >
                        <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>
                          {aluno.codigo || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                              background: `hsl(${(aluno.nome?.charCodeAt(0) || 0) * 37 % 360},60%,50%)20`,
                              color: `hsl(${(aluno.nome?.charCodeAt(0) || 0) * 37 % 360},60%,40%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 800,
                            }}>
                              {aluno.nome?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                                {aluno.nome}
                              </div>
                              {aluno.email && (
                                <div style={{ fontSize: 10, color: 'hsl(var(--text-disabled))', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Mail size={9} />{aluno.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                          {aluno.turma || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          {aluno.turno || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                            background: `rgba(100,116,139,0.1)`, color: '#475569',
                            border: `1px solid rgba(100,116,139,0.2)`,
                            whiteSpace: 'nowrap'
                          }}>
                            {aluno.situacaoNome || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          {aluno.dataMatricula ? fmtDate(aluno.dataMatricula) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-secondary))', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {aluno.responsavelPedagogico || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          {aluno.telefonePedagogico ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={10} />{aluno.telefonePedagogico}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ─── GRID VIEW ──────────────────────────────────── */
        <div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6' }} />
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: 'hsl(var(--text-muted))' }}>
              <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhum aluno encontrado</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {data.map((aluno, i) => {
                  const badge = statusBadge(aluno.statusMatricula)
                  const hue = (aluno.nome?.charCodeAt(0) || 0) * 37 % 360
                return (
                  <button
                    key={aluno.id || i}
                    onClick={() => router.push(`/academico/alunos/${aluno.id}`)}
                    style={{
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 16, padding: '16px', textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
                      e.currentTarget.style.borderColor = 'hsl(var(--border-default))'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = ''
                      e.currentTarget.style.boxShadow = ''
                      e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                        background: `hsl(${hue},55%,50%)18`,
                        color: `hsl(${hue},55%,40%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 900,
                      }}>
                        {aluno.nome?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {aluno.nome}
                        </div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>
                          {aluno.codigo}
                        </div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `rgba(100,116,139,0.1)`, color: '#475569', border: `1px solid rgba(100,116,139,0.2)`, flexShrink: 0 }}>
                        {aluno.situacaoNome || '—'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        { icon: <School size={10} />,   val: aluno.turma || '—' },
                        { icon: <Clock size={10} />,    val: aluno.turno || '—' },
                        { icon: <Calendar size={10} />, val: aluno.dataMatricula ? fmtDate(aluno.dataMatricula) : '—' },
                        { icon: <Star size={10} />,     val: aluno.anoLetivo || '—' },
                      ].map((item, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          <span style={{ opacity: 0.5, flexShrink: 0 }}>{item.icon}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                    {aluno.responsavelPedagogico && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))', fontSize: 10, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        👤 {aluno.responsavelPedagogico}
                        {aluno.telefonePedagogico && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {aluno.telefonePedagogico}</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── PAGINATION ──────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button
            disabled={page <= 1}
            onClick={() => fetchData(page - 1)}
            className="btn btn-secondary btn-icon"
            style={{ opacity: page <= 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={13} />
          </button>

          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p: number
            if (totalPages <= 7) p = i + 1
            else if (page <= 4) p = i + 1
            else if (page >= totalPages - 3) p = totalPages - 6 + i
            else p = page - 3 + i
            return (
              <button
                key={p}
                onClick={() => fetchData(p)}
                style={{
                  width: 34, height: 34, borderRadius: 9, fontSize: 12, fontWeight: 700,
                  background: page === p ? '#3b82f6' : 'hsl(var(--bg-elevated))',
                  color: page === p ? '#fff' : 'hsl(var(--text-secondary))',
                  border: `1px solid ${page === p ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {p}
              </button>
            )
          })}

          <button
            disabled={page >= totalPages}
            onClick={() => fetchData(page + 1)}
            className="btn btn-secondary btn-icon"
            style={{ opacity: page >= totalPages ? 0.4 : 1 }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Modal */}
      <TurmaModal
        open={turmaModalOpen}
        onClose={() => setTurmaModalOpen(false)}
        onSelect={(id, nome) => {
          setFilters(prev => ({ ...prev, turma: id, turmaId: id, turmaNome: id === '' ? '' : nome }))
        }}
        selectedTurmaId={filters.turmaId}
      />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
