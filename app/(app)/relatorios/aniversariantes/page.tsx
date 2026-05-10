'use client'

import {
  useState, useEffect, useCallback, useMemo, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Filter, X, ChevronDown, ChevronUp,
  FileText, FileSpreadsheet, RefreshCw, GraduationCap,
  Calendar, School, ChevronLeft, ChevronRight, Loader2,
  BookMarked, AlertCircle, SortAsc, Users, PartyPopper,
  Gift
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

interface FilterState {
  busca: string
  turma: string
  turmaId: string
  turmaNome: string
  nivelEnsino: string
  anoLetivo: string
  situacaoNome: string
  mesAniversario: string
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
const MES_ATUAL = new Date().getMonth() + 1
const ANOS = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

const MESES_OPCOES = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' }
]

const SORT_OPTIONS = [
  { value: 'dia|asc',          label: 'Dia do Aniversário (Crescente)' },
  { value: 'nome|asc',         label: 'Nome do Aluno (A→Z)' },
  { value: 'turma|asc',        label: 'Turma (A→Z)' },
]

const NIVEL_OPTIONS = [
  'Educação Infantil',
  'Ensino Fundamental I',
  'Ensino Fundamental II',
  'Ensino Médio',
  'EJA',
  'Técnico',
]

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  if (s.includes('/')) return s.slice(0, 10)
  const [y, m, d] = s.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : s
}

function getDiaMes(dateStr: string) {
  if (!dateStr) return { d: 0, m: 0 }
  const p = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-')
  if (dateStr.includes('/')) return { d: parseInt(p[0]) || 0, m: parseInt(p[1]) || 0 }
  return { d: parseInt(p[2]) || 0, m: parseInt(p[1]) || 0 }
}

function sortAniversariantes(alunos: AlunoRow[], sortVal: string) {
  const [field, dir] = sortVal.split('|')
  const mult = dir === 'desc' ? -1 : 1
  return [...alunos].sort((a, b) => {
    if (field === 'dia') {
      const da = getDiaMes(a.dataNascimento)
      const db = getDiaMes(b.dataNascimento)
      if (da.m !== db.m) return (da.m - db.m) * mult
      if (da.d !== db.d) return (da.d - db.d) * mult
      return (a.nome || '').localeCompare(b.nome || '')
    }
    const va = (a as any)[field] || ''
    const vb = (b as any)[field] || ''
    return String(va).localeCompare(String(vb), 'pt-BR') * mult
  })
}

// ─── TurmaModal ──────────────────────────────────────────

function TurmaModal({ open, onClose, onSelect, selectedTurmaId }: {
  open: boolean
  onClose: () => void
  onSelect: (id: string, nome: string) => void
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
            onClick={() => { onSelect('', ''); onClose() }}
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
                  onClick={() => { onSelect(t.id, t.nome); onClose() }}
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
                  </div>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginLeft: 10 }} />}
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

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div style={{
      background: 'hsl(var(--bg-surface))',
      border: '1px solid hsl(var(--border-subtle))',
      borderTop: `3px solid ${color}`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      transition: 'all 0.2s', flex: 1, minWidth: 160,
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

export default function AniversariantesPage() {
  const router = useRouter()
  const { mantenedores, cfgSituacaoAluno, cfgNiveisEnsino } = useData()
  const { currentUser } = useApp()

  const [allData, setAllData] = useState<AlunoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(true)
  const [sortValue, setSortValue] = useState('dia|asc')
  const [turmaModalOpen, setTurmaModalOpen] = useState(false)

  const [filters, setFilters] = useState<FilterState>({
    busca: '',
    turma: '',
    turmaId: '',
    turmaNome: '',
    nivelEnsino: '',
    anoLetivo: String(ANO_ATUAL),
    situacaoNome: '',
    mesAniversario: String(MES_ATUAL).padStart(2, '0') // default to current month
  })

  // School info
  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const userName = currentUser?.nome || 'Usuário'

  const fetchData = useCallback(async () => {
    setLoading(true)
    const apiFilters: Record<string, string> = {}
    if (filters.busca)          apiFilters.busca          = filters.busca
    if (filters.anoLetivo)      apiFilters.anoLetivo      = filters.anoLetivo
    if (filters.situacaoNome)   apiFilters.situacaoNome   = filters.situacaoNome
    if (filters.nivelEnsino)    apiFilters.nivelEnsino    = filters.nivelEnsino
    if (filters.mesAniversario) apiFilters.mesAniversario = filters.mesAniversario

    if (filters.turmaId) {
      apiFilters.turmaId = filters.turmaId
    } else if (filters.turma) {
      apiFilters.turma = filters.turma
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

  const sortedData = useMemo(() => sortAniversariantes(allData, sortValue), [allData, sortValue])

  const stats = useMemo(() => {
    const total = sortedData.length
    const ativos = sortedData.filter(a => a.statusMatricula === 'Ativo' || a.situacaoNome?.toLowerCase() === 'cursando').length
    // Count birthdays today (regardless of the year logic, just matching D and M against today's date)
    const today = new Date()
    const dToday = today.getDate()
    const mToday = today.getMonth() + 1
    const hoje = sortedData.filter(a => {
      const dm = getDiaMes(a.dataNascimento)
      return dm.d === dToday && dm.m === mToday
    }).length
    return { total, ativos, hoje }
  }, [sortedData])

  const setFilter = (k: keyof FilterState, v: string) => setFilters(p => ({ ...p, [k]: v }))

  const clearFilters = () => setFilters({
    busca: '', turma: '', turmaId: '', turmaNome: '', nivelEnsino: '',
    anoLetivo: String(ANO_ATUAL), situacaoNome: '', mesAniversario: String(MES_ATUAL).padStart(2, '0')
  })

  const activeCount = useMemo(() => {
    let c = 0
    if (filters.busca) c++
    if (filters.turmaNome) c++
    if (filters.nivelEnsino) c++
    if (filters.situacaoNome) c++
    if (filters.mesAniversario) c++
    return c
  }, [filters])

  // ─── Export ───────────────────────────────────────────────
  const filterDesc = useMemo(() => {
    const d: Record<string, string> = {}
    if (filters.mesAniversario) d['Mês'] = MESES_OPCOES.find(m => m.value === filters.mesAniversario)?.label || filters.mesAniversario
    if (filters.anoLetivo) d['Ano Letivo'] = filters.anoLetivo
    if (filters.nivelEnsino) d['Nível'] = filters.nivelEnsino
    if (filters.turmaNome) d['Turma'] = filters.turmaNome
    if (filters.situacaoNome) d['Situação'] = filters.situacaoNome
    return d
  }, [filters])

  const handleExportPDF = () => {
    const data = sortedData.map((a, i) => {
      const dm = getDiaMes(a.dataNascimento)
      return {
        _indice: i + 1,
        dia: String(dm.d).padStart(2, '0'),
        nome: a.nome,
        turma: a.turma || '—',
        codigo: a.codigo,
        dataNascimento: a.dataNascimento ? fmtDate(a.dataNascimento) : '—',
        situacaoNome: a.situacaoNome || a.statusMatricula || '—',
        idade: a.idade ? `${a.idade} anos` : '—'
      }
    })
    exportPDF({
      title: `Aniversariantes — ${MESES_OPCOES.find(m => m.value === filters.mesAniversario)?.label || 'Todos'}`,
      subtitle: `${data.length} alunos encontrados`,
      data,
      columns: [
        { key: '_indice',       label: 'Nº',           type: 'text', align: 'center', width: 40 },
        { key: 'dia',           label: 'Dia',          type: 'text', align: 'center', width: 50 },
        { key: 'nome',          label: 'Nome do Aluno',type: 'text' },
        { key: 'turma',         label: 'Turma',        type: 'text', width: 140 },
        { key: 'codigo',        label: 'Matrícula',    type: 'text', width: 90 },
        { key: 'dataNascimento',label: 'Nascimento',   type: 'text', width: 100 },
        { key: 'idade',         label: 'Idade',        type: 'text', width: 70 },
        { key: 'situacaoNome',  label: 'Situação',     type: 'text', width: 100 },
      ],
      filters: filterDesc,
      nomeEscola, cnpj, logo, userName,
      orientation: 'portrait',
    })
  }

  const handleExportXLSX = () => {
    const data = sortedData.map(a => ({
      dia: String(getDiaMes(a.dataNascimento).d).padStart(2, '0'),
      nome: a.nome,
      turma: a.turma || '',
      codigo: a.codigo,
      dataNascimento: a.dataNascimento ? fmtDate(a.dataNascimento) : '',
      idade: a.idade || '',
      situacaoNome: a.situacaoNome || a.statusMatricula || '',
    }))
    exportXLSX({
      title: `Aniversariantes — ${MESES_OPCOES.find(m => m.value === filters.mesAniversario)?.label || 'Todos'}`,
      data,
      columns: [
        { key: 'dia',           label: 'Dia',          type: 'text' },
        { key: 'nome',          label: 'Nome do Aluno',type: 'text' },
        { key: 'turma',         label: 'Turma',        type: 'text' },
        { key: 'codigo',        label: 'Matrícula',    type: 'text' },
        { key: 'dataNascimento',label: 'Data Nasc.',   type: 'text' },
        { key: 'idade',         label: 'Idade',        type: 'number' },
        { key: 'situacaoNome',  label: 'Situação',     type: 'text' },
      ],
      filters: filterDesc, userName,
    })
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
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(225,29,72,0.35)',
            }}>
              <PartyPopper size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>
                Aniversariantes
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                Relação de aniversariantes por mês — Gestão de Retenção
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            <RefreshCw size={11} /> Atualizar
          </button>
          <div style={{ height: 16, width: 1, background: 'hsl(var(--border-subtle))' }} />
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
        <KPICard icon={<Users size={18} />}     label="Aniversariantes" value={stats.total}  color="#3b82f6" sub={`${MESES_OPCOES.find(m => m.value === filters.mesAniversario)?.label || 'No período'}`} />
        <KPICard icon={<Gift size={18} />}      label="Hoje"            value={stats.hoje}   color="#f43f5e" sub={stats.hoje > 0 ? 'Parabéns para eles!' : 'Nenhum hoje'} />
        <KPICard icon={<Calendar size={18} />}  label="Mês Filtrado"    value={MESES_OPCOES.find(m => m.value === filters.mesAniversario)?.label || 'Todos'} color="#8b5cf6" />
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
            <Filter size={14} color="#f43f5e" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Filtros de Pesquisa
            </span>
            {activeCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: '#f43f5e', color: '#fff' }}>
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
            {/* Row 1: MÊS (Destacado) + Ano Letivo + Turma */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 2fr', gap: 12, marginBottom: 12, alignItems: 'end' }}>
              <div style={{ background: 'rgba(244,63,94,0.05)', borderRadius: 12, padding: '8px 12px', border: '1px solid rgba(244,63,94,0.2)' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Mês do Aniversário</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#f43f5e', pointerEvents: 'none', zIndex: 1 }} />
                  <select
                    value={filters.mesAniversario}
                    onChange={e => setFilter('mesAniversario', e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: 30, fontSize: 13, fontWeight: 700, color: '#be123c', border: 'none', background: 'transparent' }}
                  >
                    <option value="">Todos os Meses</option>
                    {MESES_OPCOES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Ano Letivo</label>
                <select value={filters.anoLetivo} onChange={e => setFilter('anoLetivo', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '8px 12px' }}>
                  <option value="">Todos</option>
                  {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Filtrar por Turma</label>
                <button
                  onClick={() => setTurmaModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                    background: filters.turmaNome ? 'rgba(99,102,241,0.08)' : 'hsl(var(--bg-elevated))',
                    border: `1px solid ${filters.turmaNome ? 'rgba(99,102,241,0.35)' : 'hsl(var(--border-subtle))'}`,
                    color: filters.turmaNome ? '#6366f1' : 'hsl(var(--text-secondary))',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    transition: 'all 0.15s', height: 35
                  }}
                >
                  <School size={13} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{filters.turmaNome || 'Selecionar Turma...'}</span>
                  {filters.turmaNome && (
                    <span onClick={e => { e.stopPropagation(); setFilters(p => ({ ...p, turma: '', turmaId: '', turmaNome: '' })) }} style={{ cursor: 'pointer', opacity: 0.6, lineHeight: 0 }}><X size={11} /></span>
                  )}
                  {!filters.turmaNome && <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.5 }} />}
                </button>
              </div>
            </div>

            {/* Row 2: Nível + Situação + Ordenar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
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
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Situação da Matrícula</label>
                <select value={filters.situacaoNome} onChange={e => setFilter('situacaoNome', e.target.value)} className="form-input" style={{ fontSize: 12, padding: '7px 10px' }}>
                  <option value="">Todas as Situações</option>
                  {(cfgSituacaoAluno || []).filter((s: any) => s.situacao !== 'inativo').map((s: any) => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
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
          </div>
        )}
      </div>

      {/* ─── TURMA MODAL ─────────────────────────────────── */}
      <TurmaModal
        open={turmaModalOpen}
        onClose={() => setTurmaModalOpen(false)}
        onSelect={(id, nome) => setFilters(prev => ({ ...prev, turma: nome, turmaId: id, turmaNome: nome }))}
        selectedTurmaId={filters.turmaId}
      />

      {/* ─── RESULTS HEADER ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Buscando...
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{sortedData.length}</strong> alunos encontrados
            </span>
          )}
        </div>
      </div>

      {/* ─── CONTENT (TABLE) ─────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, gap: 14 }}>
          <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite', color: '#f43f5e' }} />
          <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>Listando aniversariantes...</div>
        </div>
      ) : sortedData.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, gap: 14 }}>
          <Gift size={48} style={{ opacity: 0.15, color: '#f43f5e' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nenhum aniversariante encontrado</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Nenhum aluno atende aos filtros atuais para o mês selecionado.</div>
          <button onClick={clearFilters} className="btn btn-sm" style={{ background: 'rgba(244,63,94,0.1)', color: '#e11d48', marginTop: 10 }}>Limpar Filtros</button>
        </div>
      ) : (
        <div className="card" style={{ borderRadius: 16, overflow: 'hidden', padding: 0, border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                  {['Dia', 'Aluno', 'Idade', 'Turma', 'Situação', 'Contato'].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', textAlign: i === 0 || i === 2 ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((a, idx) => {
                  const dm = getDiaMes(a.dataNascimento)
                  const isToday = dm.d === new Date().getDate() && dm.m === new Date().getMonth() + 1
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: isToday ? 'rgba(244,63,94,0.03)' : idx % 2 !== 0 ? 'hsl(var(--bg-elevated))' : '', transition: 'background 0.1s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = isToday ? 'rgba(244,63,94,0.06)' : 'rgba(99,102,241,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = isToday ? 'rgba(244,63,94,0.03)' : idx % 2 !== 0 ? 'hsl(var(--bg-elevated))' : ''}
                      onClick={() => router.push(`/academico/alunos/${a.id}`)}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: isToday ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'hsl(var(--bg-surface))', border: isToday ? 'none' : '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '4px 8px', minWidth: 42, color: isToday ? '#fff' : 'hsl(var(--text-primary))', boxShadow: isToday ? '0 4px 10px rgba(225,29,72,0.3)' : 'none' }}>
                          <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{String(dm.d).padStart(2,'0')}</span>
                          {isToday && <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>hoje</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: `hsl(${(a.nome?.charCodeAt(0) || 0) * 37 % 360},55%,50%)18`, color: `hsl(${(a.nome?.charCodeAt(0) || 0) * 37 % 360},55%,40%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                            {a.nome?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {a.nome}
                              {isToday && <Gift size={12} color="#f43f5e" />}
                            </div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>MA: {a.codigo || '—'} · DN: {a.dataNascimento ? fmtDate(a.dataNascimento) : '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {a.idade ? <span style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>{a.idade}</span> : <span style={{ color: 'hsl(var(--text-disabled))' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{a.turma || '—'}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.nivelEnsino || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(100,116,139,0.08)', color: '#475569', border: '1px solid rgba(100,116,139,0.15)' }}>
                          {a.situacaoNome || a.statusMatricula || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{a.responsavelPedagogico || '—'}</div>
                        {a.telefone && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.telefone}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
