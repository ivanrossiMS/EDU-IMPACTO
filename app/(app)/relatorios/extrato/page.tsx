'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  FileText, ArrowLeft, Search, X, Check, Calendar, ChevronRight,
  User, Users, BookOpen, Layers, Filter, Printer, FileSpreadsheet,
  Download, TrendingUp, TrendingDown, DollarSign, AlertCircle,
  CheckCircle, Clock, Loader2, Building2, FileSearch, Receipt,
  BarChart3, SlidersHorizontal, Eye, ChevronDown, CreditCard
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
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
  emailResponsavel: string
  telefoneResponsavel: string
  evento: string
  parcela: string
  competencia: string
  vencimento: string
  dataPagamento: string
  valor: number
  desconto: number
  juros: number
  multa: number
  valorPago: number
  saldo: number
  formaPagamento: string
  statusFinanceiro: string
  anoLetivo: number
  observacaoBaixa: string
}

interface Filters {
  dataInicio: string
  dataFim: string
  anoLetivo: string
  tipoBusca: 'aluno' | 'responsavel'
  alunoId: string
  alunoNome: string
  responsavelId: string
  responsavelNome: string
  turmas: string[]
  eventos: string[]
  tipo: 'todos' | 'debitos' | 'pagamentos'
  modelo: 'extrato' | 'declaracao'
}

interface SelectItem { id: string; label: string; sub?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = '#0ea5e9'
const ACCENT2 = '#10b981'
const DANGER = '#ef4444'
const WARNING = '#f59e0b'

const fmtCur = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) => {
  if (!d) return '—'
  if (d.includes('/')) return d
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

const statusBadge = (s: string) => {
  const map: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    pago:        { bg: 'rgba(16,185,129,0.12)', color: '#059669', label: 'PAGO',      icon: <CheckCircle size={10} /> },
    pendente:    { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: 'PENDENTE',  icon: <Clock size={10} /> },
    vencido:     { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', label: 'VENCIDO',   icon: <AlertCircle size={10} /> },
    cancelado:   { bg: 'rgba(107,114,128,0.12)',color: '#6b7280', label: 'CANCELADO', icon: <X size={10} /> },
    renegociado: { bg: 'rgba(139,92,246,0.12)', color: '#7c3aed', label: 'RENEG.',    icon: <RefreshCw size={10} /> },
  }
  return map[s] || map.pendente
}

// ─── Selection Modal (turmas / eventos) ──────────────────────────────────────

function SelectionModal({
  title, icon, items, selected, onClose, onApply, searchPlaceholder = 'Buscar...', hasAllOption = false
}: {
  title: string; icon: React.ReactNode; items: SelectItem[]; selected: string[]
  onClose: () => void; onApply: (s: string[]) => void; searchPlaceholder?: string; hasAllOption?: boolean
}) {
  const [search, setSearch] = useState('')
  const [local, setLocal] = useState<string[]>(selected)

  const filtered = useMemo(() =>
    items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || (i.sub || '').toLowerCase().includes(search.toLowerCase())),
    [items, search]
  )

  const toggle = (id: string) => {
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: ACCENT }}>{icon}</div>
          <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '12px 20px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} className="form-input" placeholder={searchPlaceholder} style={{ paddingLeft: 32, fontSize: 12 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {/* Opção "Todos" */}
          {hasAllOption && (
            <div onClick={() => setLocal([])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${local.length === 0 ? ACCENT : 'hsl(var(--border-default))'}`, background: local.length === 0 ? ACCENT : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {local.length === 0 && <Check size={11} color="#fff" />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: local.length === 0 ? ACCENT : 'hsl(var(--text-secondary))' }}>Todos</div>
            </div>
          )}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'hsl(var(--text-muted))', fontSize: 12 }}>Nenhum resultado encontrado</div>}
          {filtered.map(item => {
            const sel = local.includes(item.id)
            return (
              <div key={item.id} onClick={() => toggle(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
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

// ─── Pessoa Search Modal (busca inline com min 3 chars) ───────────────────────

function PessoaSearchModal({
  title, icon, items, loading: isLoading, onClose, onApply, searchPlaceholder = 'Digite ao menos 3 caracteres...'
}: {
  title: string; icon: React.ReactNode; items: SelectItem[]; loading: boolean
  onClose: () => void; onApply: (id: string, label: string) => void; searchPlaceholder?: string
}) {
  const [search, setSearch] = useState('')

  const MIN_CHARS = 3
  const filtered = useMemo(() => {
    if (search.trim().length < MIN_CHARS) return []
    return items.filter(i =>
      i.label.toLowerCase().includes(search.toLowerCase()) ||
      (i.sub || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [items, search])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: ACCENT }}>{icon}</div>
          <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              placeholder={searchPlaceholder}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
          {search.length > 0 && search.length < MIN_CHARS && (
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8, paddingLeft: 4 }}>
              Digite {MIN_CHARS - search.length} caractere(s) a mais para buscar…
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'hsl(var(--text-muted))', fontSize: 12 }}>
              <Loader2 size={18} style={{ display: 'inline', animation: 'spin 1s linear infinite', marginRight: 6 }} /> Carregando…
            </div>
          )}
          {!isLoading && search.trim().length >= MIN_CHARS && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'hsl(var(--text-muted))', fontSize: 12 }}>Nenhum resultado para "{search}"</div>
          )}
          {!isLoading && search.trim().length < MIN_CHARS && (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 12 }}>
              <Search size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
              Use o campo acima para buscar por nome
            </div>
          )}
          {!isLoading && filtered.map(item => (
            <div
              key={item.id}
              onClick={() => { onApply(item.id, item.label); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.1s' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
                <User size={15} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── RefreshCw icon fallback ──────────────────────────────────────────────────
function RefreshCw({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  dataInicio: `${new Date().getFullYear()}-01-01`,
  dataFim: `${new Date().getFullYear()}-12-31`,
  anoLetivo: String(new Date().getFullYear()),
  tipoBusca: 'aluno',
  alunoId: '',
  alunoNome: '',
  responsavelId: '',
  responsavelNome: '',
  turmas: [],
  eventos: [],
  tipo: 'todos',
  modelo: 'extrato',
}

const yrOptions = ['2026', '2025', '2024', '2023'].filter(Boolean)

export default function ExtratoPage() {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const data = useData()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [showTurmasModal, setShowTurmasModal] = useState(false)
  const [showEventosModal, setShowEventosModal] = useState(false)
  const [showPessoaModal, setShowPessoaModal] = useState(false)
  const [pessoasDisponiveis, setPessoasDisponiveis] = useState<SelectItem[]>([])
  const [loadingPessoas, setLoadingPessoas] = useState(false)

  // ─── Context data ─────────────────────────────────────────────────────────
  const mantenedores: any[] = (data as any).mantenedores || []
  const schoolLogo: string = mantenedores[0]?.logo || mantenedores[0]?.cabecalhoLogo || ''
  const schoolName: string = mantenedores[0]?.razaoSocial || mantenedores[0]?.nome || 'EDU IMPACTO'

  // ─── Pré-carregamento financeiro da pessoa ────────────────────────────────
  // parcelas pré-carregadas só para popular turmas/eventos nas cascatas
  const [preloadedParcelas, setPreloadedParcelas] = useState<Parcela[]>([])
  const [preloadingPessoa, setPreloadingPessoa] = useState(false)

  const preloadPessoaData = useCallback(async (alunoId: string, respNome: string, tipo: 'aluno' | 'responsavel') => {
    setPreloadingPessoa(true)
    setPreloadedParcelas([])
    try {
      const apiFilters: Record<string, string> = { anoLetivo: filters.anoLetivo }
      if (tipo === 'aluno' && alunoId) apiFilters.alunoId = alunoId
      // CRÍTICO: busca filtra por aluno.nome — para responsável usar responsavelNome
      if (tipo === 'responsavel' && respNome) apiFilters.responsavelNome = respNome
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'financeiro_extrato', filters: apiFilters, page: 1, pageSize: 99999 })
      })
      const json = await res.json()
      let rows: Parcela[] = json.data || []
      if (tipo === 'aluno' && alunoId) rows = rows.filter(p => p.alunoId === alunoId)
      if (tipo === 'responsavel' && respNome) rows = rows.filter(p => (p.responsavelFinanceiro || '').toLowerCase().includes(respNome.toLowerCase()))
      setPreloadedParcelas(rows)
    } catch {}
    setPreloadingPessoa(false)
  }, [filters.anoLetivo])

  // ─── Turmas em cascata (só da pessoa pré-carregada) ──────────────────────
  const turmaOptions: SelectItem[] = useMemo(() => {
    const baseParcelas = preloadedParcelas.length > 0 ? preloadedParcelas : parcelas
    if (baseParcelas.length > 0 && (filters.alunoId || filters.responsavelNome)) {
      const turmaSet = new Set(
        baseParcelas.map(p => p.turma).filter(Boolean)
      )
      return Array.from(turmaSet).map(t => ({ id: t, label: t }))
    }
    // Fallback DataContext
    const turmaObjects: any[] = (data as any).turmas || []
    return (Array.isArray(turmaObjects) ? turmaObjects : [])
      .filter((t: any) => !filters.anoLetivo || String(t.ano || '') === filters.anoLetivo)
      .map((t: any) => ({ id: t.nome || t.id, label: t.nome || t.id, sub: t.serie || '' }))
  }, [data, filters.anoLetivo, filters.alunoId, filters.responsavelNome, preloadedParcelas, parcelas])

  // ─── Eventos em cascata (da pessoa + turma selecionada) ──────────────────
  const [eventosDisponiveis, setEventosDisponiveis] = useState<SelectItem[]>([])

  const eventosFromData: SelectItem[] = useMemo(() => {
    const baseParcelas = preloadedParcelas.length > 0 ? preloadedParcelas : parcelas
    if (baseParcelas.length > 0 && (filters.alunoId || filters.responsavelNome)) {
      const scoped = filters.turmas.length > 0
        ? baseParcelas.filter(p => filters.turmas.includes(p.turma))
        : baseParcelas
      const seen = new Set<string>()
      return scoped
        .map(p => p.evento).filter(e => e && !seen.has(e) && seen.add(e))
        .map(e => ({ id: e, label: e }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    return eventosDisponiveis
  }, [preloadedParcelas, parcelas, filters.alunoId, filters.responsavelNome, filters.turmas, eventosDisponiveis])

  // ─── Fetch pessoas (alunos or responsaveis) ──────────────────────────────
  const openPessoaModal = async () => {
    setLoadingPessoas(true)
    setShowPessoaModal(true)
    try {
      if (filters.tipoBusca === 'aluno') {
        const res = await fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'alunos', filters: { anoLetivo: filters.anoLetivo }, page: 1, pageSize: 9999 })
        })
        const json = await res.json()
        setPessoasDisponiveis((json.data || []).map((a: any) => ({
          id: a.id,
          label: a.nome,
          sub: `${a.codigo ? `Cód: ${a.codigo} · ` : ''}Turma: ${a.turma || '—'}`
        })))
      } else {
        const rRes = await fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'financeiro_extrato', filters: { anoLetivo: filters.anoLetivo }, page: 1, pageSize: 9999 })
        })
        const rJson = await rRes.json()
        const seen = new Set<string>()
        const items: SelectItem[] = []
        ;(rJson.data || []).forEach((r: any) => {
          if (r.responsavelFinanceiro && !seen.has(r.responsavelFinanceiro)) {
            seen.add(r.responsavelFinanceiro)
            items.push({ id: r.responsavelFinanceiro, label: r.responsavelFinanceiro, sub: r.cpfResponsavel ? `CPF: ${r.cpfResponsavel}` : '' })
          }
        })
        setPessoasDisponiveis(items)
      }
    } catch {}
    setLoadingPessoas(false)
  }

  // ─── Fetch eventos available (global fallback) ────────────────────────────
  const openEventosModal = async () => {
    // If we have aluno-scoped events from loaded data, use those directly
    if (eventosFromData.length > 0) {
      setShowEventosModal(true)
      return
    }
    // Otherwise lazy-load all events from server
    if (eventosDisponiveis.length === 0) {
      try {
        const res = await fetch('/api/relatorios/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'financeiro_extrato', filters: {}, page: 1, pageSize: 9999 })
        })
        const json = await res.json()
        const seen = new Set<string>()
        const items: SelectItem[] = []
        ;(json.data || []).forEach((r: any) => {
          if (r.evento && !seen.has(r.evento)) {
            seen.add(r.evento)
            items.push({ id: r.evento, label: r.evento })
          }
        })
        setEventosDisponiveis(items.sort((a,b) => a.label.localeCompare(b.label)))
      } catch {}
    }
    setShowEventosModal(true)
  }

  // ─── Handle apply ─────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    setLoading(true)
    setHasLoaded(false)
    try {
      const apiFilters: Record<string, string> = {
        anoLetivo: filters.anoLetivo,
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
      }
      if (filters.alunoId) apiFilters.alunoId = filters.alunoId
      // CRÍTICO: para responsável usamos 'responsavelNome' (não 'busca' que filtra por aluno)
      if (filters.tipoBusca === 'responsavel' && filters.responsavelNome) {
        apiFilters.responsavelNome = filters.responsavelNome
      }

      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'financeiro_extrato', filters: apiFilters, page: 1, pageSize: 99999 })
      })
      const json = await res.json()
      let rows: Parcela[] = json.data || []

      // Client-side filters
      if (filters.tipoBusca === 'aluno' && filters.alunoId) {
        rows = rows.filter(p => p.alunoId === filters.alunoId)
      }
      if (filters.tipoBusca === 'responsavel' && filters.responsavelNome) {
        rows = rows.filter(p => (p.responsavelFinanceiro || '').toLowerCase().includes(filters.responsavelNome.toLowerCase()))
      }
      if (filters.turmas.length > 0) {
        rows = rows.filter(p => filters.turmas.includes(p.turma))
      }
      if (filters.eventos.length > 0) {
        rows = rows.filter(p => filters.eventos.includes(p.evento))
      }
      if (filters.tipo === 'debitos') {
        rows = rows.filter(p => !['pago', 'renegociado'].includes(p.statusFinanceiro))
      } else if (filters.tipo === 'pagamentos') {
        rows = rows.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
      }

      setParcelas(rows)
      setHasLoaded(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const headers = ['Aluno', 'Turma', 'Responsável', 'Evento', 'Parcela', 'Competência', 'Vencimento', 'Dt. Pagamento', 'Valor', 'Desconto', 'Juros', 'Multa', 'Valor Pago', 'Saldo', 'Forma Pagto', 'Status']
    const rows: any[][] = [
      ['EXTRATO FINANCEIRO'],
      ['Período: ' + fmtDate(filters.dataInicio) + ' a ' + fmtDate(filters.dataFim) + ' | Ano Letivo: ' + filters.anoLetivo],
      filters.alunoNome ? ['Aluno: ' + filters.alunoNome] : filters.responsavelNome ? ['Responsável: ' + filters.responsavelNome] : [],
      [],
      headers
    ]
    parcelas.forEach(p => {
      rows.push([p.nome, p.turma, p.responsavelFinanceiro, p.evento, p.parcela, p.competencia, fmtDate(p.vencimento), fmtDate(p.dataPagamento), p.valor, p.desconto, p.juros, p.multa, p.valorPago, p.saldo, p.formaPagamento, p.statusFinanceiro])
    })
    rows.push([])
    rows.push(['', '', '', '', '', '', '', 'TOTAIS:', kpis.totalPrevisto, kpis.totalDesconto, kpis.totalJurosMulta, '', kpis.totalRealizado, kpis.totalAberto, '', ''])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato')
    XLSX.writeFile(wb, 'extrato-financeiro-' + new Date().toISOString().slice(0,10) + '.xlsx')
  }

  // ─── Aggregates ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPrevisto = parcelas.reduce((s, p) => s + (p.valor - p.desconto), 0)
    const totalJurosMulta = parcelas.reduce((s, p) => s + (p.juros + p.multa), 0)
    const totalRealizado = parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro)).reduce((s, p) => s + p.valor - p.desconto + p.juros + p.multa, 0)
    const totalAberto = parcelas.filter(p => !['pago', 'renegociado', 'cancelado'].includes(p.statusFinanceiro)).reduce((s, p) => s + Math.max(0, p.valor - p.desconto + p.juros + p.multa), 0)
    const totalDesconto = parcelas.reduce((s, p) => s + p.desconto, 0)
    return { totalPrevisto, totalJurosMulta, totalRealizado, totalAberto, totalDesconto, count: parcelas.length }
  }, [parcelas])

  // ─── Group by aluno/responsavel for display ───────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; nome: string; sub: string; parcelas: Parcela[] }>()
    for (const p of parcelas) {
      const key = filters.tipoBusca === 'responsavel' ? (p.responsavelFinanceiro || 'Sem Responsável') : (p.alunoId || p.nome)
      const nome = filters.tipoBusca === 'responsavel' ? (p.responsavelFinanceiro || 'Sem Responsável') : p.nome
      const sub = filters.tipoBusca === 'responsavel' ? (p.cpfResponsavel ? `CPF: ${p.cpfResponsavel}` : '') : `Turma: ${p.turma || '—'}`
      if (!map.has(key)) map.set(key, { key, nome, sub, parcelas: [] })
      map.get(key)!.parcelas.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [parcelas, filters.tipoBusca])

  // ─── Print / PDF ──────────────────────────────────────────────
  const handlePrint = () => {
    if (parcelas.length === 0) return
    const hoje = new Date()
    const hojeStr = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const hojeData = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const logoHtml = schoolLogo
      ? '<img src="' + schoolLogo + '" alt="Logo" style="max-height:56px;max-width:130px;object-fit:contain;" onerror="this.style.display=\'none\'" />'
      : ''

    // ── DECLARAÇÃO IRPF ───────────────────────────────────────────────────────
    if (filters.modelo === 'declaracao') {
      const parcPagas = parcelas.filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
      const totalPago = parcPagas.reduce((s, p) => s + (p.valorPago || (p.valor - p.desconto + p.juros + p.multa)), 0)

      // Dados do aluno (usar primeiro registro)
      const primeiraP = parcelas[0]
      const nomeAluno   = filters.tipoBusca === 'aluno' ? filters.alunoNome : primeiraP?.nome || ''
      const nomeResp    = filters.tipoBusca === 'responsavel' ? filters.responsavelNome : (primeiraP?.responsavelFinanceiro || '')
      const cpfResp     = primeiraP?.cpfResponsavel || ''
      const emailResp   = primeiraP?.emailResponsavel || ''
      const telResp     = primeiraP?.telefoneResponsavel || ''
      const turmaAluno  = primeiraP?.turma || ''
      const serieAluno  = primeiraP?.serie || ''
      const turmaLabel  = [serieAluno, turmaAluno, filters.anoLetivo].filter(Boolean).join('/')
      const codigoAluno = primeiraP?.codigo || ''

      // ── Dados da escola: prioriza a unidade da turma do aluno ─────────────────
      const mant = mantenedores[0] || {}
      const unidadeNomeDaParcela = primeiraP?.unidade || ''

      // Busca a unidade específica dentro do mantenedor por nomeFantasia ou razaoSocial
      const unidadeObj: any = (mant.unidades || []).find((u: any) => {
        const nomeFant = (u.nomeFantasia || '').toLowerCase().trim()
        const razSoc   = (u.razaoSocial || '').toLowerCase().trim()
        const target   = unidadeNomeDaParcela.toLowerCase().trim()
        return target && (nomeFant === target || razSoc === target || nomeFant.includes(target) || target.includes(nomeFant))
      }) || null

      // Campos da unidade (fallback para o mantenedor principal se não achar)
      const schnome   = unidadeObj?.nomeFantasia || unidadeObj?.razaoSocial || mant.razaoSocial || mant.nome || 'COLÉGIO IMPACTO'
      const schCNPJ   = unidadeObj?.cnpj   || mant.cnpj   || ''
      const schEnder  = [unidadeObj?.endereco || mant.endereco, unidadeObj?.numero || mant.numero].filter(Boolean).join(', ')
      const schBairro = unidadeObj?.bairro  || mant.bairro  || ''
      const schCidade = [(unidadeObj?.cidade || mant.cidade), (unidadeObj?.estado || mant.estado)].filter(Boolean).join('/')
      const schCEP    = unidadeObj?.cep     || mant.cep     || ''
      const schTel    = unidadeObj?.telefone || mant.telefone || ''
      // Logo: prefer unidade logo, fallback to mantenedor logo
      const unitLogo  = unidadeObj?.logo || unidadeObj?.cabecalhoLogo || schoolLogo
      const logoHtmlDecl = unitLogo
        ? '<img src="' + unitLogo + '" alt="Logo" style="max-height:56px;max-width:130px;object-fit:contain;" onerror="this.style.display=\'none\'" />'
        : ''

      // Agrupamento por evento para a tabela
      const byEvento = new Map<string, typeof parcPagas>()
      for (const p of parcPagas) {
        if (!byEvento.has(p.evento)) byEvento.set(p.evento, [])
        byEvento.get(p.evento)!.push(p)
      }

      const buildDeclaracaoRows = (): string => {
        let h = ''
        for (const [evento, ps] of Array.from(byEvento.entries())) {
          const subTotal = ps.reduce((s, p) => s + (p.valorPago || (p.valor - p.desconto + p.juros + p.multa)), 0)
          h += '<tr class="ev-header"><td colspan="8">' + evento + '</td></tr>'
          for (const p of ps) {
            const liq = p.valorPago || (p.valor - p.desconto + p.juros + p.multa)
            h += '<tr>'
            h += '<td class="ctr">' + p.parcela + '</td>'
            h += '<td class="ctr">' + fmtDate(p.vencimento) + '</td>'
            h += '<td class="ctr">' + fmtDate(p.dataPagamento) + '</td>'
            h += '<td class="num">' + fmtCur(p.valor) + '</td>'
            h += '<td class="num" style="color:#059669">' + (p.desconto > 0 ? '-' + fmtCur(p.desconto) : '—') + '</td>'
            h += '<td class="num" style="color:#dc2626">' + (p.juros  > 0 ? '+' + fmtCur(p.juros)  : '—') + '</td>'
            h += '<td class="num" style="color:#dc2626">' + (p.multa  > 0 ? '+' + fmtCur(p.multa)  : '—') + '</td>'
            h += '<td class="num" style="font-weight:800;color:#0369a1">' + fmtCur(liq) + '</td>'
            h += '</tr>'
          }
          h += '<tr class="ev-subtotal"><td colspan="7" style="text-align:right">Subtotal — ' + evento + '</td>'
          h += '<td class="num">' + fmtCur(subTotal) + '</td></tr>'
        }
        return h
      }

      const declaracaoCSS =
        '* {box-sizing:border-box;margin:0;padding:0}'
        + 'html,body{width:100%;background:#fff}'
        + 'body{font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:20px 24px;font-size:10px;color:#1e293b}'
        + '.print-date{font-size:9px;color:#64748b;margin-bottom:6px}'
        + '.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0ea5e9;padding-bottom:12px;margin-bottom:18px}'
        + '.school-left{display:flex;align-items:center;gap:12px}'
        + '.school-name{font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.01em}'
        + '.school-sub{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}'
        + '.doc-right{text-align:right}'
        + '.doc-titulo{font-size:17px;font-weight:900;color:#0f172a}'
        + '.doc-periodo{font-size:10px;color:#475569;margin-top:4px}'
        + '.doc-emitido{font-size:9px;color:#94a3b8;margin-top:2px}'
        + '.dados-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:18px}'
        + '.dados-grid{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:5px 16px;align-items:start}'
        + '.dk{font-size:9px;font-weight:800;color:#0ea5e9;text-transform:uppercase;padding-top:1px}'
        + '.dv{font-size:11px;font-weight:700;color:#0f172a}'
        + '.dv.small{font-size:9px;color:#475569;font-weight:400;margin-top:2px}'
        + '.divider{grid-column:1/-1;height:1px;background:#e2e8f0;margin:4px 0}'
        + '.decl-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:10px;line-height:1.8;color:#1e3a5f}'
        + '.decl-box strong{font-weight:900;color:#0f172a}'
        + 'table{width:100%;border-collapse:collapse;margin-bottom:14px;table-layout:fixed}'
        + 'th{background:#0ea5e9;color:#fff;padding:5px 6px;font-size:8px;font-weight:800;text-align:left;text-transform:uppercase;overflow:hidden;white-space:nowrap}'
        + 'th.num{text-align:right}th.ctr{text-align:center}'
        + 'td{padding:4px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
        + 'td.num{text-align:right;font-family:"Courier New",monospace}td.ctr{text-align:center}'
        + 'tr:nth-child(even) td{background:#f8fafc}'
        + '.ev-header td{font-weight:900;background:#dbeafe!important;color:#1d4ed8;font-size:9px;border-top:2px solid #93c5fd;text-transform:uppercase;letter-spacing:.03em;padding:4px 6px}'
        + '.ev-subtotal td{font-weight:800!important;background:#f1f5f9!important;border-top:1px solid #cbd5e1;font-size:9px}'
        + '.total-final{display:flex;justify-content:space-between;align-items:center;background:#0ea5e9;color:#fff;border-radius:6px;padding:10px 16px;margin-bottom:20px}'
        + '.total-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}'
        + '.total-val{font-size:18px;font-weight:900;font-family:"Courier New",monospace}'
        + '.footer-assinaturas{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:60px}'
        + '.assinatura .linha{border-bottom:1px solid #94a3b8;margin-top:40px;margin-bottom:6px}'
        + '.assinatura .label{font-size:9px;color:#64748b;text-align:center}'
        + '.local-data{font-size:10px;color:#475569;margin-bottom:6px;text-align:right}'
        + '.nota-rodape{font-size:8px;color:#94a3b8;text-align:center;margin-top:16px;border-top:1px dashed #e2e8f0;padding-top:8px}'
        + '.school-info{font-size:8px;color:#64748b;margin-top:4px}'
        + 'col.c1{width:6%}col.c2,col.c3{width:10%}col.c4,col.c5,col.c6,col.c7,col.c8{width:10%}'
        + '@media print{@page{size:A4 portrait;margin:10mm 14mm}body{padding:0}}'

      const html = '<!DOCTYPE html><html lang="pt-BR"><head><title>Declaração IRPF — ' + nomeAluno + '</title><meta charset="UTF-8"><style>' + declaracaoCSS + '</style></head><body>'
        + '<div class="print-date">' + hojeStr + '</div>'
        + '<div class="doc-header">'
        +   '<div class="school-left">' + logoHtmlDecl
        +     '<div>'
        +       '<div class="school-name">' + schnome + '</div>'
        +       '<div class="school-sub">Central Financeira do Aluno</div>'
        +       (schCNPJ ? '<div class="school-info">CNPJ: ' + schCNPJ + (schEnder ? ' &nbsp;|&nbsp; ' + schEnder + (schBairro ? ' — ' + schBairro : '') + (schCidade ? ', ' + schCidade : '') + (schCEP ? ' — CEP: ' + schCEP : '') : '') + '</div>' : '')
        +       (schTel ? '<div class="school-info">Tel: ' + schTel + '</div>' : '')
        +     '</div>'
        +   '</div>'
        +   '<div class="doc-right">'
        +     '<div class="doc-titulo">Declaração para IRPF (' + filters.anoLetivo + ')</div>'
        +     '<div class="doc-periodo">Período: ' + fmtDate(filters.dataInicio) + ' → ' + fmtDate(filters.dataFim) + '</div>'
        +     '<div class="doc-emitido">Emitido em: ' + hojeStr + '</div>'
        +   '</div>'
        + '</div>'
        + '<div class="dados-box">'
        +   '<div class="dados-grid">'
        +     '<div class="dk">Aluno</div><div class="dv">' + nomeAluno + '</div>'
        +     '<div class="dk">RGA / Cód.</div><div class="dv">' + (codigoAluno || '—') + '</div>'
        +     '<div class="dk">CPF</div><div class="dv">' + (primeiraP?.cpfResponsavel || '—') + '</div>'
        +     '<div class="dk">Turma</div><div class="dv">' + turmaLabel + '</div>'
        +     '<div class="dk">Unidade</div><div class="dv">' + (unidadeNomeDaParcela || schnome) + '</div>'
        +     '<div class="divider"></div>'
        +     '<div class="dk">Responsável</div>'
        +     '<div>'
        +       '<div class="dv">' + (nomeResp || '—') + '</div>'
        +       (cpfResp ? '<div class="dv small">CPF: ' + cpfResp + '</div>' : '')
        +       (telResp ? '<div class="dv small">Celular: ' + telResp + '</div>' : '')
        +       (emailResp ? '<div class="dv small">E-mail: ' + emailResp + '</div>' : '')
        +     '</div>'
        +     '<div class="dk">Natureza</div>'
        +     '<div class="dv">Declaração de Quitação Fiscal (' + filters.anoLetivo + ')</div>'
        +   '</div>'
        + '</div>'
        + '<div class="decl-box">'
        + 'Declaramos para os devidos fins que o responsável financeiro <strong>' + (nomeResp || nomeAluno) + '</strong>'
        + (cpfResp ? ', inscrito no CPF sob o nº <strong>' + cpfResp + '</strong>,' : '')
        + ' efetuou os pagamentos de despesas com educação listados abaixo referentes ao aluno <strong>' + nomeAluno + '</strong>'
        + ', totalizando <strong>' + fmtCur(totalPago) + '</strong> no ano-calendário de ' + filters.anoLetivo + ','
        + ' servindo este documento como comprovante para declaração do Imposto de Renda.'
        + '</div>'
        + '<table>'
        +   '<colgroup><col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/><col class="c5"/><col class="c6"/><col class="c7"/><col class="c8"/></colgroup>'
        +   '<thead><tr>'
        +     '<th class="ctr">Parcela</th>'
        +     '<th class="ctr">Vencimento</th>'
        +     '<th class="ctr">Dt. Pagamento</th>'
        +     '<th class="num">Valor Bruto</th>'
        +     '<th class="num">Desconto</th>'
        +     '<th class="num">Juros</th>'
        +     '<th class="num">Multa</th>'
        +     '<th class="num">Valor Pago</th>'
        +   '</tr></thead>'
        +   '<tbody>' + buildDeclaracaoRows() + '</tbody>'
        + '</table>'
        + '<div class="total-final">'
        + '<div class="total-lbl">Total Pago no Ano-Calendário ' + filters.anoLetivo + '</div>'
        + '<div class="total-val">' + fmtCur(totalPago) + '</div>'
        + '</div>'
        + '<div class="local-data">' + (schCidade || 'Local') + ', ' + hojeData + '</div>'
        + '<div class="footer-assinaturas">'
        +   '<div class="assinatura"><div class="linha"></div><div class="label">' + (nomeResp || 'Responsável Financeiro') + (cpfResp ? ' — CPF: ' + cpfResp : '') + '</div></div>'
        +   '<div class="assinatura"><div class="linha"></div><div class="label">Direção / Secretaria &mdash; ' + schnome + '</div></div>'
        + '</div>'
        + '<div class="nota-rodape">Documento gerado pelo Sistema de Gestão Escolar — ' + schnome + ' · Este documento não dispensa a observação do art. 26 da Lei 9.532/97.</div>'
        + '</body></html>'

      const w = window.open('', '_blank')
      if (!w) return
      w.document.write(html)
      w.document.close()
      setTimeout(() => { w.print() }, 600)
      return
    }

    // ── EXTRATO NORMAL ────────────────────────────────────────────────────────
    const titulo = 'EXTRATO FINANCEIRO'

    const buildGroupedHtml = (): string => {
      let h = ''
      for (const g of grouped) {
        const gPago = g.parcelas.filter(p => ['pago','renegociado'].includes(p.statusFinanceiro)).reduce((s,p) => s + p.valor - p.desconto + p.juros + p.multa, 0)
        const gAberto = g.parcelas.filter(p => !['pago','renegociado','cancelado'].includes(p.statusFinanceiro)).reduce((s,p) => s + Math.max(0, p.valor - p.desconto + p.juros + p.multa), 0)
        const gPrev = g.parcelas.reduce((s,p) => s + p.valor - p.desconto, 0)
        h += '<div class="group-hdr"><div><div class="group-hdr-name">' + g.nome + '</div><div class="group-hdr-sub">' + g.sub + '</div></div>'
        h += '<div class="group-hdr-nums">'
        h += '<div class="gn"><div class="gn-lbl">Previsto</div><div class="gn-val" style="color:#0369a1">' + fmtCur(gPrev) + '</div></div>'
        h += '<div class="gn"><div class="gn-lbl">Realizado</div><div class="gn-val" style="color:#059669">' + fmtCur(gPago) + '</div></div>'
        h += '<div class="gn"><div class="gn-lbl">Em Aberto</div><div class="gn-val" style="color:' + (gAberto > 0 ? '#dc2626' : '#94a3b8') + '">' + fmtCur(gAberto) + '</div></div>'
        h += '</div></div>'
        h += '<div class="table-wrap"><table>'
        h += '<colgroup><col class="c-evento"/><col class="c-parc"/><col class="c-comp"/><col class="c-venc"/><col class="c-dtpag"/><col class="c-valor"/><col class="c-desc"/><col class="c-juros"/><col class="c-multa"/><col class="c-liq"/><col class="c-status"/></colgroup>'
        h += '<thead><tr><th>Evento</th><th>Parc.</th><th>Competencia</th><th>Vencimento</th><th>Dt.Pagto</th><th>Valor</th><th>Desconto</th><th>Juros</th><th>Multa</th><th>Liquido</th><th>Sit.</th></tr></thead><tbody>'
        for (const p of g.parcelas) {
          const liq = p.valor - p.desconto + p.juros + p.multa
          const bc = ['pago','renegociado'].includes(p.statusFinanceiro) ? 'badge-pago' : p.statusFinanceiro === 'vencido' ? 'badge-vencido' : p.statusFinanceiro === 'cancelado' ? 'badge-cancelado' : 'badge-pendente'
          const sl = ({'pago':'PAGO','vencido':'VENC.','cancelado':'CANC.','renegociado':'RENEG.'} as Record<string,string>)[p.statusFinanceiro] || 'PEND.'
          const lc = ['pago','renegociado'].includes(p.statusFinanceiro) ? '#059669' : p.statusFinanceiro === 'vencido' ? '#dc2626' : '#1e293b'
          h += '<tr>'
          h += '<td>' + p.evento + '</td><td class="ctr">' + p.parcela + '</td><td class="ctr">' + p.competencia + '</td>'
          h += '<td class="ctr">' + fmtDate(p.vencimento) + '</td>'
          h += '<td class="ctr" style="color:' + (p.dataPagamento ? '#059669' : '#94a3b8') + '">' + (fmtDate(p.dataPagamento) || '—') + '</td>'
          h += '<td class="num">' + fmtCur(p.valor) + '</td>'
          h += '<td class="num" style="color:' + (p.desconto > 0 ? '#059669' : '#94a3b8') + '">' + (p.desconto > 0 ? '-' + fmtCur(p.desconto) : '—') + '</td>'
          h += '<td class="num" style="color:' + (p.juros > 0 ? '#dc2626' : '#94a3b8') + '">' + (p.juros > 0 ? '+' + fmtCur(p.juros) : '—') + '</td>'
          h += '<td class="num" style="color:' + (p.multa > 0 ? '#dc2626' : '#94a3b8') + '">' + (p.multa > 0 ? '+' + fmtCur(p.multa) : '—') + '</td>'
          h += '<td class="num" style="font-weight:800;color:' + lc + '">' + fmtCur(liq) + '</td>'
          h += '<td class="ctr"><span class="badge ' + bc + '">' + sl + '</span></td></tr>'
        }
        const sv = g.parcelas.reduce((s,p) => s + p.valor,0)
        const sd = g.parcelas.reduce((s,p) => s + p.desconto,0)
        const sj = g.parcelas.reduce((s,p) => s + p.juros,0)
        const sm = g.parcelas.reduce((s,p) => s + p.multa,0)
        h += '<tr class="subtotal"><td colspan="5">SUBTOTAL — ' + g.nome + '</td>'
        h += '<td class="num">' + fmtCur(sv) + '</td><td class="num" style="color:#059669">' + fmtCur(sd) + '</td>'
        h += '<td class="num" style="color:#dc2626">' + fmtCur(sj) + '</td><td class="num" style="color:#dc2626">' + fmtCur(sm) + '</td>'
        h += '<td class="num" style="color:#0369a1;font-weight:900">' + fmtCur(gPrev + sj + sm) + '</td><td></td></tr>'
        h += '</tbody></table></div>'
      }
      return h
    }

    const nomePessoa = filters.tipoBusca === 'aluno' ? filters.alunoNome : filters.responsavelNome
    const pessoaInfo = nomePessoa ? '<div class="info-item"><label>' + (filters.tipoBusca === 'aluno' ? 'Aluno' : 'Responsavel') + '</label><span>' + nomePessoa + '</span></div>' : ''
    const turmasInfo = filters.turmas.length > 0 ? '<div class="info-item"><label>Turma(s)</label><span>' + filters.turmas.join(', ') + '</span></div>' : ''

    const css = '* {box-sizing:border-box;margin:0;padding:0} html,body{width:100%;overflow-x:hidden}'
      + 'body{font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:16px 20px;font-size:10px;color:#1e293b}'
      + '.header-logo{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:3px solid #0ea5e9;padding-bottom:10px}'
      + '.school-name{font-size:15px;font-weight:900;color:#0ea5e9}.doc-title{font-size:14px;font-weight:800;text-align:right;color:#1e293b;text-transform:uppercase}'
      + '.doc-date{font-size:9px;color:#64748b;text-align:right;margin-top:3px}'
      + '.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:12px}'
      + '.info-item label{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase}.info-item span{font-size:11px;font-weight:600;color:#1e293b;display:block}'
      + '.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}'
      + '.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px}'
      + '.kpi-label{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px}.kpi-value{font-size:12px;font-weight:900}'
      + '.kpi-value.green{color:#059669}.kpi-value.red{color:#dc2626}.kpi-value.blue{color:#0369a1}.kpi-value.gray{color:#4b5563}'
      + '.table-wrap{width:100%;overflow:hidden}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed}'
      + 'col.c-evento{width:21%}col.c-parc{width:5%}col.c-comp{width:12%}col.c-venc{width:9%}col.c-dtpag{width:8%}'
      + 'col.c-valor{width:9%}col.c-desc{width:9%}col.c-juros{width:8%}col.c-multa{width:7%}col.c-liq{width:9%}col.c-status{width:3%}'
      + 'th{background:#0ea5e9;color:#fff;padding:4px;font-size:8px;font-weight:700;text-align:left;text-transform:uppercase;overflow:hidden;white-space:nowrap}'
      + 'td{padding:4px;font-size:9px;border-bottom:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
      + 'td.num{text-align:right;font-family:Courier New,monospace}td.ctr{text-align:center}'
      + 'tr:nth-child(even) td{background:#f8fafc}'
      + '.group-hdr{display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin:10px 0 4px}'
      + '.group-hdr-name{font-size:11px;font-weight:800;color:#1e293b}.group-hdr-sub{font-size:9px;color:#64748b}'
      + '.group-hdr-nums{display:flex;gap:14px}.gn{text-align:right}'
      + '.gn-lbl{font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase}.gn-val{font-size:10px;font-weight:900;font-family:Courier New,monospace}'
      + '.badge{display:inline-block;padding:1px 4px;border-radius:8px;font-size:7px;font-weight:800}'
      + '.badge-pago{background:rgba(16,185,129,.12);color:#059669}.badge-vencido{background:rgba(239,68,68,.12);color:#dc2626}'
      + '.badge-pendente{background:rgba(245,158,11,.12);color:#d97706}.badge-cancelado{background:rgba(107,114,128,.12);color:#6b7280}'
      + '.subtotal td{font-weight:800!important;background:#dde3ec!important;border-top:2px solid #0ea5e9;font-size:9px}'
      + '.section-title{font-size:10px;font-weight:800;color:#0ea5e9;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}'
      + '.section-sub{font-size:9px;color:#64748b;margin-bottom:8px}'
      + '@media print{@page{size:A4 landscape;margin:10mm 12mm}body{padding:0}.table-wrap{overflow:visible!important}}'

    const html = '<!DOCTYPE html><html><head><title>' + titulo + '</title><style>' + css + '</style></head><body>'
      + '<div class="header-logo"><div style="display:flex;align-items:center;gap:10px">' + logoHtml
      + '<div><div class="school-name">' + schoolName + '</div><div style="font-size:9px;color:#64748b">Sistema de Gestao Escolar</div></div></div>'
      + '<div><div class="doc-title">' + titulo + '</div><div class="doc-date">Emitido em: ' + hojeStr + '</div></div></div>'
      + '<div class="info-grid"><div class="info-item"><label>Periodo</label><span>' + fmtDate(filters.dataInicio) + ' a ' + fmtDate(filters.dataFim) + '</span></div>'
      + '<div class="info-item"><label>Ano Letivo</label><span>' + filters.anoLetivo + '</span></div>'
      + pessoaInfo + turmasInfo + '</div>'
      + '<div class="kpi-row">'
      + '<div class="kpi"><div class="kpi-label">Total Previsto</div><div class="kpi-value blue">' + fmtCur(kpis.totalPrevisto) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">Total Realizado</div><div class="kpi-value green">' + fmtCur(kpis.totalRealizado) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">Em Aberto</div><div class="kpi-value red">' + fmtCur(kpis.totalAberto) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">Encargos (J+M)</div><div class="kpi-value gray">' + fmtCur(kpis.totalJurosMulta) + '</div></div>'
      + '</div>'
      + '<div class="section-title">EXTRATO DETALHADO</div>'
      + '<div class="section-sub">' + kpis.count + ' parcela(s) - ' + grouped.length + ' ' + (filters.tipoBusca === 'aluno' ? 'aluno(s)' : 'responsavel(eis)') + '</div>'
      + buildGroupedHtml()
      + '</body></html>'

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.print() }, 600)
  }


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #0284c7)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={19} color="#fff" />
            </div>
            <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>Extrato Financeiro</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Financeiro</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>Extrato completo por aluno ou responsável — débitos, pagamentos e declaração de crédito.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasLoaded && parcelas.length > 0 && (
            <>
              <button onClick={handleExportExcel} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700 }}>
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={handlePrint} className="btn btn-sm" style={{ gap: 5, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40`, fontWeight: 700 }}>
                <Printer size={13} /> {filters.modelo === 'declaracao' ? 'Declaração PDF' : 'Imprimir PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter Card ── */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <SlidersHorizontal size={14} color={ACCENT} />
          <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Configurar Extrato</span>
        </div>

        {/* Row 1: período / ano */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />Data Início</label>
            <input type="date" className="form-input" style={{ fontSize: 11, padding: '7px 10px' }} value={filters.dataInicio} onChange={e => setFilters(f => ({ ...f, dataInicio: e.target.value }))} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />Data Fim</label>
            <input type="date" className="form-input" style={{ fontSize: 11, padding: '7px 10px' }} value={filters.dataFim} onChange={e => setFilters(f => ({ ...f, dataFim: e.target.value }))} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />Ano Letivo</label>
            <select className="form-input" style={{ fontSize: 11, padding: '7px 10px' }} value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))}>
              {yrOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><Filter size={10} style={{ display: 'inline', marginRight: 3 }} />Tipo de Lançamento</label>
            <select className="form-input" style={{ fontSize: 11, padding: '7px 10px' }} value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value as any }))}>
              <option value="todos">Todos os lançamentos</option>
              <option value="debitos">Apenas Débitos (em aberto)</option>
              <option value="pagamentos">Apenas Pagamentos</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><FileText size={10} style={{ display: 'inline', marginRight: 3 }} />Modelo de Saída</label>
            <select className="form-input" style={{ fontSize: 11, padding: '7px 10px' }} value={filters.modelo} onChange={e => setFilters(f => ({ ...f, modelo: e.target.value as any }))}>
              <option value="extrato">Extrato Detalhado</option>
              <option value="declaracao">Declaração de Crédito</option>
            </select>
          </div>
        </div>

        {/* Row 2: busca por pessoa */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={12} /> Busca por Pessoa
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Tipo de Busca</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['aluno', 'responsavel'] as const).map(t => (
                  <button key={t} onClick={() => setFilters(f => ({ ...f, tipoBusca: t, alunoId: '', alunoNome: '', responsavelId: '', responsavelNome: '' }))}
                    style={{ flex: 1, padding: '7px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${filters.tipoBusca === t ? ACCENT : 'hsl(var(--border-default))'}`, background: filters.tipoBusca === t ? `${ACCENT}18` : 'transparent', color: filters.tipoBusca === t ? ACCENT : 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {t === 'aluno' ? '👤 Aluno' : '👨‍👩‍👧 Responsável'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>
                {filters.tipoBusca === 'aluno' ? 'Selecionar Aluno (opcional)' : 'Selecionar Responsável (opcional)'}
              </label>
              <button onClick={openPessoaModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${(filters.alunoId || filters.responsavelNome) ? ACCENT + '60' : 'hsl(var(--border-default))'}`, background: (filters.alunoId || filters.responsavelNome) ? `${ACCENT}0a` : 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ color: (filters.alunoId || filters.responsavelNome) ? ACCENT : 'hsl(var(--text-muted))', fontWeight: (filters.alunoId || filters.responsavelNome) ? 700 : 400 }}>
                  {filters.tipoBusca === 'aluno' ? (filters.alunoNome || 'Todos os alunos') : (filters.responsavelNome || 'Todos os responsáveis')}
                </span>
                <Search size={13} style={{ color: 'hsl(var(--text-muted))' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: turma/evento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><BookOpen size={10} style={{ display: 'inline', marginRight: 3 }} />Filtrar por Turma (opcional)</label>
            <button onClick={() => setShowTurmasModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${filters.turmas.length > 0 ? ACCENT + '60' : 'hsl(var(--border-default))'}`, background: filters.turmas.length > 0 ? `${ACCENT}0a` : 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ color: filters.turmas.length > 0 ? ACCENT : 'hsl(var(--text-muted))', fontWeight: filters.turmas.length > 0 ? 700 : 400 }}>
                {filters.turmas.length === 0 ? 'Todas as turmas' : `${filters.turmas.length} turma(s) selecionada(s)`}
              </span>
              <ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} />
            </button>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}><Layers size={10} style={{ display: 'inline', marginRight: 3 }} />Filtrar por Evento/Curso (opcional)</label>
            <button onClick={openEventosModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${filters.eventos.length > 0 ? ACCENT + '60' : 'hsl(var(--border-default))'}`, background: filters.eventos.length > 0 ? `${ACCENT}0a` : 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ color: filters.eventos.length > 0 ? ACCENT : 'hsl(var(--text-muted))', fontWeight: filters.eventos.length > 0 ? 700 : 400 }}>
                {filters.eventos.length === 0 ? 'Todos os eventos' : `${filters.eventos.length} evento(s) selecionado(s)`}
              </span>
              <ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))' }} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))' }}>
          <button onClick={() => { setFilters(DEFAULT_FILTERS); setHasLoaded(false); setParcelas([]) }} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
            Restaurar filtros
          </button>
          <button onClick={handleApply} className="btn btn-primary" style={{ background: ACCENT, borderColor: ACCENT, gap: 6 }} disabled={loading}>
            {loading ? <Loader2 size={13} className="spin" /> : <FileSearch size={13} />}
            Gerar Extrato
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Loader2 size={32} style={{ color: ACCENT, margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Gerando extrato...</div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!hasLoaded && !loading && (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))' }}>
          <FileText size={42} style={{ color: ACCENT, margin: '0 auto 16px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>Extrato Financeiro</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Configure os filtros acima e clique em <strong>Gerar Extrato</strong> para visualizar.</div>
        </div>
      )}

      {/* ── No results ── */}
      {hasLoaded && parcelas.length === 0 && !loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <CheckCircle size={32} style={{ color: ACCENT2, margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Nenhum lançamento encontrado</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Ajuste os filtros e tente novamente.</div>
        </div>
      )}

      {/* ── Results ── */}
      {hasLoaded && parcelas.length > 0 && !loading && (
        <>
          {/* KPI bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Previsto', value: kpis.totalPrevisto, color: ACCENT, icon: <BarChart3 size={15} /> },
              { label: 'Total Realizado', value: kpis.totalRealizado, color: ACCENT2, icon: <TrendingUp size={15} /> },
              { label: 'Em Aberto', value: kpis.totalAberto, color: DANGER, icon: <TrendingDown size={15} /> },
              { label: 'Descontos', value: kpis.totalDesconto, color: WARNING, icon: <DollarSign size={15} /> },
              { label: 'Juros + Multa', value: kpis.totalJurosMulta, color: '#8b5cf6', icon: <CreditCard size={15} /> },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ color: k.color }}>{k.icon}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: k.color, fontFamily: 'monospace' }}>{fmtCur(k.value)}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }} ref={printRef}>
            <div style={{ padding: '14px 20px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: ACCENT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {filters.modelo === 'declaracao' ? 'Declaração de Crédito' : 'Extrato Detalhado'}
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  {kpis.count} parcela(s) · {grouped.length} {filters.tipoBusca === 'aluno' ? 'aluno(s)' : 'responsável(eis)'}
                </p>
              </div>
            </div>

            {grouped.map(g => {
              const gPago = g.parcelas.filter(p => ['pago','renegociado'].includes(p.statusFinanceiro)).reduce((s,p) => s + p.valor - p.desconto + p.juros + p.multa, 0)
              const gAberto = g.parcelas.filter(p => !['pago','renegociado','cancelado'].includes(p.statusFinanceiro)).reduce((s,p) => s + Math.max(0, p.valor - p.desconto + p.juros + p.multa), 0)
              const gPrevisto = g.parcelas.reduce((s,p) => s + p.valor - p.desconto, 0)

              return (
                <div key={g.key} style={{ borderBottom: '2px solid hsl(var(--border-subtle))' }}>
                  {/* Group Header */}
                  <div style={{ padding: '10px 20px', background: 'hsl(var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                        {filters.tipoBusca === 'aluno' ? <User size={14} /> : <Users size={14} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontSize: 13 }}>{g.nome}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{g.sub}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>PREVISTO</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: ACCENT, fontFamily: 'monospace' }}>{fmtCur(gPrevisto)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>REALIZADO</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: ACCENT2, fontFamily: 'monospace' }}>{fmtCur(gPago)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>EM ABERTO</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: gAberto > 0 ? DANGER : 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{fmtCur(gAberto)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                          {['Evento', 'Parcela', 'Competência', 'Vencimento', 'Dt. Pagamento', 'Valor', 'Desconto', 'Juros', 'Multa', 'Líquido', 'Forma Pgto', 'Status'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: h.includes('Venc') || h.includes('Dt') ? 'center' : ['Valor','Desconto','Juros','Multa','Líquido'].includes(h) ? 'right' : 'left', fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.parcelas.map((p, idx) => {
                          const bd = statusBadge(p.statusFinanceiro)
                          const liq = p.valor - p.desconto + p.juros + p.multa
                          return (
                            <tr key={idx} style={{ background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.evento}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>{p.parcela}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: 'hsl(var(--text-muted))' }}>{p.competencia}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(p.vencimento)}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: p.dataPagamento ? ACCENT2 : 'hsl(var(--text-muted))' }}>{fmtDate(p.dataPagamento) || '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtCur(p.valor)}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: p.desconto > 0 ? ACCENT2 : 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{p.desconto > 0 ? `-${fmtCur(p.desconto)}` : '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: p.juros > 0 ? DANGER : 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{p.juros > 0 ? `+${fmtCur(p.juros)}` : '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: p.multa > 0 ? DANGER : 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{p.multa > 0 ? `+${fmtCur(p.multa)}` : '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, whiteSpace: 'nowrap', color: ['pago','renegociado'].includes(p.statusFinanceiro) ? ACCENT2 : p.statusFinanceiro === 'vencido' ? DANGER : 'hsl(var(--text-primary))' }}>{fmtCur(liq)}</td>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'hsl(var(--text-muted))', fontSize: 10 }}>{p.formaPagamento || '—'}</td>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bd.bg, color: bd.color, padding: '3px 7px', borderRadius: 10, fontSize: 9, fontWeight: 800 }}>
                                  {bd.icon} {bd.label}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Subtotal row */}
                        <tr style={{ background: 'hsl(var(--bg-elevated))', fontWeight: 800 }}>
                          <td colSpan={5} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-secondary))' }}>SUBTOTAL — {g.nome}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtCur(g.parcelas.reduce((s,p)=>s+p.valor,0))}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: ACCENT2, fontSize: 11 }}>{fmtCur(g.parcelas.reduce((s,p)=>s+p.desconto,0))}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: DANGER, fontSize: 11 }}>{fmtCur(g.parcelas.reduce((s,p)=>s+p.juros,0))}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: DANGER, fontSize: 11 }}>{fmtCur(g.parcelas.reduce((s,p)=>s+p.multa,0))}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: ACCENT, fontSize: 12, fontWeight: 900 }}>{fmtCur(gPrevisto + g.parcelas.reduce((s,p)=>s+p.juros+p.multa,0))}</td>
                          <td colSpan={2} style={{ padding: '7px 10px' }}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Turmas Modal ── */}
      {showTurmasModal && (
        <SelectionModal
          title="Selecionar Turmas"
          icon={<BookOpen size={15} />}
          items={turmaOptions}
          selected={filters.turmas}
          onClose={() => setShowTurmasModal(false)}
          onApply={s => setFilters(f => ({ ...f, turmas: s, eventos: [] }))}
          searchPlaceholder="Buscar turma..."
          hasAllOption
        />
      )}

      {/* ── Eventos Modal ── */}
      {showEventosModal && (
        <SelectionModal
          title="Selecionar Eventos / Cursos"
          icon={<Layers size={15} />}
          items={eventosFromData.length > 0 ? eventosFromData : eventosDisponiveis}
          selected={filters.eventos}
          onClose={() => setShowEventosModal(false)}
          onApply={s => setFilters(f => ({ ...f, eventos: s }))}
          searchPlaceholder="Buscar evento/curso..."
          hasAllOption
        />
      )}

      {/* ── Pessoa Search Modal ── */}
      {showPessoaModal && (
        <PessoaSearchModal
          title={filters.tipoBusca === 'aluno' ? 'Selecionar Aluno' : 'Selecionar Responsável'}
          icon={filters.tipoBusca === 'aluno' ? <User size={15} /> : <Users size={15} />}
          items={loadingPessoas ? [] : pessoasDisponiveis}
          loading={loadingPessoas}
          onClose={() => setShowPessoaModal(false)}
          onApply={(id, label) => {
            if (filters.tipoBusca === 'aluno') {
              setFilters(f => ({ ...f, alunoId: id, alunoNome: label, turmas: [], eventos: [] }))
              preloadPessoaData(id, '', 'aluno')
            } else {
              setFilters(f => ({ ...f, responsavelNome: label, responsavelId: id, turmas: [], eventos: [] }))
              preloadPessoaData('', label, 'responsavel')
            }
          }}
          searchPlaceholder={filters.tipoBusca === 'aluno' ? 'Digite o nome do aluno\u2026' : 'Digite o nome do responsável\u2026'}
        />
      )}

    </div>
  )
}
