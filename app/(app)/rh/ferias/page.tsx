'use client'
import { useState, useMemo } from 'react'
import { useData, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { formatCurrency } from '@/lib/utils'
import {
  Palmtree, Plus, X, Trash2, Calendar, Check, Search, Filter,
  TrendingDown, AlertTriangle, Clock, DollarSign, Users2, FileText,
  ChevronRight, Eye, Pencil, BarChart2, ShieldAlert, CheckCircle, Ban
} from 'lucide-react'

// ─── Tipos ─────────────────────────────────────────────────────────
type TipoAusencia = 'ferias' | 'afastamento_saude' | 'licenca_maternidade' | 'licenca_paternidade' | 'licenca_sem_vencimento' | 'acidente_trabalho' | 'luto' | 'outro'
type StatusAusencia = 'solicitado' | 'aprovado' | 'em_curso' | 'concluido' | 'cancelado' | 'rejeitado'

interface Ausencia {
  id: string
  codigo: string
  funcionarioId: string
  funcionarioNome: string
  cargo: string
  departamento: string
  tipo: TipoAusencia
  dataInicio: string
  dataFim: string
  diasCorridos: number
  diasUteis: number
  status: StatusAusencia
  cid?: string
  motivoCid?: string
  substitutoId?: string
  substitutoNome?: string
  aprovadoPor?: string
  impactoFinanceiro: number  // custo da ausência em R$
  provisaoFerias: number     // provisão acumulada utilizada
  abonoPecuniario: boolean   // 10 dias vendidos
  obs: string
  createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d: string) => { if (!d) return '—'; const [y,m,dia]=d.split('-'); return `${dia}/${m}/${y}` }
const fmtCur = formatCurrency
const diasEntre = (a: string, b: string) => {
  if (!a || !b) return 0
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1)
}
const genCod = (lista: Ausencia[], prefix: string) => {
  let i = lista.length + 1
  let cod = `${prefix}${String(i).padStart(3,'0')}`
  const existing = new Set(lista.map(x => x.codigo))
  while (existing.has(cod)) { i++; cod = `${prefix}${String(i).padStart(3,'0')}` }
  return cod
}

// ─── Configs UI ───────────────────────────────────────────────────
const TIPO_CFG: Record<TipoAusencia, { label: string; color: string; icon: string; prefix: string }> = {
  ferias:                  { label: 'Férias',             color: '#10b981', icon: '🏖️',  prefix: 'FER' },
  afastamento_saude:       { label: 'Afastamento Saúde',  color: '#f59e0b', icon: '🏥',  prefix: 'AFS' },
  licenca_maternidade:     { label: 'Lic. Maternidade',   color: '#ec4899', icon: '👶',  prefix: 'LMA' },
  licenca_paternidade:     { label: 'Lic. Paternidade',   color: '#3b82f6', icon: '👨‍👦',  prefix: 'LPA' },
  licenca_sem_vencimento:  { label: 'Lic. s/ Vencimento', color: '#6366f1', icon: '📋',  prefix: 'LSV' },
  acidente_trabalho:       { label: 'Acid. Trabalho',     color: '#ef4444', icon: '⚠️',  prefix: 'CAT' },
  luto:                    { label: 'Luto',               color: '#78716c', icon: '🕊️',  prefix: 'LUT' },
  outro:                   { label: 'Outro',              color: '#8b5cf6', icon: '📎',  prefix: 'AUS' },
}

const STATUS_CFG: Record<StatusAusencia, { label: string; color: string; badge: string }> = {
  solicitado: { label: '● Solicitado', color: '#6366f1', badge: 'badge-info' },
  aprovado:   { label: '✓ Aprovado',   color: '#10b981', badge: 'badge-success' },
  em_curso:   { label: '↺ Em Curso',   color: '#06b6d4', badge: 'badge-info' },
  concluido:  { label: '✔ Concluído',  color: '#34d399', badge: 'badge-success' },
  cancelado:  { label: '✕ Cancelado',  color: '#9ca3af', badge: 'badge-neutral' },
  rejeitado:  { label: '✗ Rejeitado',  color: '#ef4444', badge: 'badge-danger' },
}

const BLANK_FORM = {
  funcionarioId: '',
  tipo: 'ferias' as TipoAusencia,
  dataInicio: today(),
  dataFim: today(),
  status: 'solicitado' as StatusAusencia,
  cid: '',
  motivoCid: '',
  substitutoId: '',
  abonoPecuniario: false,
  obs: '',
}

// ─── Cálculo de impacto financeiro ────────────────────────────────
function calcImpacto(salario: number, diasUteis: number, tipo: TipoAusencia, abono: boolean) {
  const valorDia = salario / 30
  const custo = valorDia * diasUteis
  // Adicional de 1/3 nas férias
  const adicional = tipo === 'ferias' ? custo * (1/3) : 0
  // Abono pecuniário: 10 dias extras pagos
  const abonoPec = abono && tipo === 'ferias' ? valorDia * 10 : 0
  return +(custo + adicional + abonoPec).toFixed(2)
}

// ─── Provisão mensal de férias (1/12 avos) ────────────────────────
function calcProvisaoMensal(salario: number) {
  return +((salario / 12) * (4/3)).toFixed(2) // inclui 1/3
}

export default function FeriasAfastamentosPage() {
  const { funcionarios } = useData()
  const [ausencias, setAusencias] = useLocalStorage<Ausencia[]>('edu-rh-ausencias', [])

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoAusencia | 'todos'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<StatusAusencia | 'todos'>('todos')
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const [showFilters, setShowFilters] = useState(false)

  // Modal
  const [modal, setModal] = useState<'new' | 'view' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // Dados derivados
  const ativos = funcionarios.filter(f => f.status === 'ativo')
  const departamentos = [...new Set(funcionarios.map(f => f.departamento))].filter(Boolean)

  const funcById = (id: string) => funcionarios.find(f => f.id === id)

  const dias = useMemo(() => diasEntre(form.dataInicio, form.dataFim), [form.dataInicio, form.dataFim])
  const diasUteis = Math.round(dias * 5 / 7)

  const impactoPreview = useMemo(() => {
    const func = funcById(form.funcionarioId)
    if (!func) return 0
    return calcImpacto(func.salario, diasUteis, form.tipo, form.abonoPecuniario)
  }, [form.funcionarioId, diasUteis, form.tipo, form.abonoPecuniario, funcionarios])

  const filtered = useMemo(() => ausencias.filter(a => {
    const q = search.toLowerCase()
    const matchQ = !search || a.funcionarioNome.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)
    const matchT = filtroTipo === 'todos' || a.tipo === filtroTipo
    const matchS = filtroStatus === 'todos' || a.status === filtroStatus
    const matchD = filtroDepto === 'todos' || a.departamento === filtroDepto
    return matchQ && matchT && matchS && matchD
  }), [ausencias, search, filtroTipo, filtroStatus, filtroDepto])

  // KPIs Financeiros
  const totalImpacto = ausencias.reduce((s, a) => s + a.impactoFinanceiro, 0)
  const totalProvisao = ativos.reduce((s, f) => s + calcProvisaoMensal(f.salario), 0)
  const emCurso = ausencias.filter(a => a.status === 'em_curso').length
  const aguardandoAprov = ausencias.filter(a => a.status === 'solicitado').length
  const diasAusentesTotais = ausencias.filter(a => ['aprovado','em_curso','concluido'].includes(a.status)).reduce((s,a) => s + a.diasUteis, 0)

  // Abertura modal novo
  const openNew = () => {
    setForm({ ...BLANK_FORM })
    setModal('new')
  }

  const openView = (id: string) => { setSelectedId(id); setModal('view') }

  const handleSave = () => {
    if (!form.funcionarioId) return
    const func = funcById(form.funcionarioId)!
    const dCorridos = diasEntre(form.dataInicio, form.dataFim)
    const dUteis = Math.round(dCorridos * 5 / 7)
    const impacto = calcImpacto(func.salario, dUteis, form.tipo, form.abonoPecuniario)
    const tipo = form.tipo
    const nova: Ausencia = {
      id: newId('AUS'),
      codigo: genCod(ausencias, TIPO_CFG[tipo].prefix),
      funcionarioId: form.funcionarioId,
      funcionarioNome: func.nome,
      cargo: func.cargo,
      departamento: func.departamento,
      tipo,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      diasCorridos: dCorridos,
      diasUteis: dUteis,
      status: form.status,
      cid: form.cid,
      motivoCid: form.motivoCid,
      substitutoNome: funcById(form.substitutoId)?.nome ?? '',
      substitutoId: form.substitutoId,
      aprovadoPor: '',
      impactoFinanceiro: impacto,
      provisaoFerias: tipo === 'ferias' ? calcProvisaoMensal(func.salario) * Math.ceil(dCorridos / 30) : 0,
      abonoPecuniario: form.abonoPecuniario,
      obs: form.obs,
      createdAt: new Date().toISOString(),
    }
    setAusencias(prev => [nova, ...prev])
    setModal(null)
  }

  const handleDelete = (id: string) => { setAusencias(prev => prev.filter(a => a.id !== id)); setConfirmId(null) }

  const atualizarStatus = (id: string, status: StatusAusencia) => {
    setAusencias(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const selectedAus = ausencias.find(a => a.id === selectedId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Férias & Afastamentos</h1>
          <p className="page-subtitle">
            Gestão financeira de ausências • Provisão mensal: <strong style={{ color: '#f59e0b' }}>{fmtCur(totalProvisao)}</strong>
            {aguardandoAprov > 0 && <span style={{ marginLeft: 12, color: '#f59e0b', fontWeight: 700 }}>⚠ {aguardandoAprov} aguardando aprovação</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><BarChart2 size={13} />Relatório</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Solicitação</button>
        </div>
      </div>

      {/* KPIs Financeiros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Impacto Total Acumulado', value: fmtCur(totalImpacto), color: '#ef4444', icon: '💸', sub: `${ausencias.length} registros` },
          { label: 'Provisão Mensal (folha)', value: fmtCur(totalProvisao), color: '#f59e0b', icon: '📊', sub: `${ativos.length} funcionários ativos` },
          { label: 'Em Curso Agora', value: emCurso, color: '#06b6d4', icon: '↺', sub: 'funcionários ausentes' },
          { label: 'Dias Úteis Perdidos', value: diasAusentesTotais, color: '#8b5cf6', icon: '📅', sub: 'total aprovados + concluídos' },
          { label: 'Aguardando Aprovação', value: aguardandoAprov, color: aguardandoAprov > 0 ? '#f59e0b' : '#34d399', icon: aguardandoAprov > 0 ? '⏳' : '✅', sub: 'solicitações pendentes' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', lineHeight: 1.2 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: typeof k.value === 'string' ? 13 : 26, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de provisão visual */}
      {ativos.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>📊 Provisão de Férias — Análise Financeira</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ color: '#f59e0b' }}>Provisão mensal: <strong>{fmtCur(totalProvisao)}</strong></span>
              <span style={{ color: '#ef4444' }}>Utilizado (ano): <strong>{fmtCur(totalImpacto)}</strong></span>
            </div>
          </div>
          <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (totalImpacto / Math.max(totalProvisao * 12, 1)) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: 6, transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
            <span>0%</span>
            <span style={{ color: '#f59e0b' }}>{((totalImpacto / Math.max(totalProvisao * 12, 1)) * 100).toFixed(1)}% do orçamento anual utilizado</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar funcionário, código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-list">
          {(['todos','ferias','afastamento_saude','licenca_maternidade','acidente_trabalho'] as const).map(t => (
            <button key={t} className={`tab-trigger ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}>
              {t === 'todos' ? 'Todos' : TIPO_CFG[t as TipoAusencia]?.label ?? t}
            </button>
          ))}
        </div>
        <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}>
          <Filter size={13} />Filtros
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Status</label>
            <select className="form-input" style={{ width: 160 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 10 }}>Departamento</label>
            <select className="form-input" style={{ width: 180 }} value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}>
              <option value="todos">Todos</option>
              {departamentos.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Tabela */}
      {ausencias.length === 0 ? (
        <div className="card" style={{ padding: '72px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Palmtree size={52} style={{ opacity: 0.1, margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhuma ausência registrada</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Registre férias, licenças e afastamentos para controle financeiro e compliance trabalhista.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Nova Solicitação</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Funcionário</th>
                <th>Tipo</th>
                <th>Período</th>
                <th style={{ textAlign: 'center' }}>Dias</th>
                <th style={{ textAlign: 'right' }}>Impacto R$</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const tc = TIPO_CFG[a.tipo]
                const sc = STATUS_CFG[a.status]
                const isEmCurso = a.status === 'em_curso'
                return (
                  <tr key={a.id} onClick={() => openView(a.id)} style={{ cursor: 'pointer', background: isEmCurso ? 'rgba(6,182,212,0.03)' : undefined }}>
                    <td>
                      <code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: tc.color, fontWeight: 700 }}>
                        {a.codigo}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.funcionarioNome}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.cargo} • {a.departamento}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 8px', borderRadius: 8, background: `${tc.color}15`, color: tc.color, fontWeight: 600 }}>
                        {tc.icon} {tc.label}
                      </span>
                      {a.cid && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>CID: {a.cid}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{fmt(a.dataInicio)} → {fmt(a.dataFim)}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: '#8b5cf6', fontSize: 14 }}>{a.diasUteis}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.diasCorridos}d corridos</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 13 }}>{fmtCur(a.impactoFinanceiro)}</div>
                      {a.abonoPecuniario && <div style={{ fontSize: 10, color: '#f59e0b' }}>+ abono 10d</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: `${sc.color}18`, color: sc.color, fontWeight: 700 }}>
                        {sc.label}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ver detalhes" onClick={() => openView(a.id)}>
                          <Eye size={12} />
                        </button>
                        {a.status === 'solicitado' && (
                          <>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#10b981' }} title="Aprovar" onClick={() => atualizarStatus(a.id, 'aprovado')}>
                              <CheckCircle size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#ef4444' }} title="Rejeitar" onClick={() => atualizarStatus(a.id, 'rejeitado')}>
                              <Ban size={12} />
                            </button>
                          </>
                        )}
                        {a.status === 'aprovado' && (
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#06b6d4' }} title="Iniciar" onClick={() => atualizarStatus(a.id, 'em_curso')}>
                            <ChevronRight size={12} />
                          </button>
                        )}
                        {a.status === 'em_curso' && (
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#34d399' }} title="Concluir" onClick={() => atualizarStatus(a.id, 'concluido')}>
                            <Check size={12} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} title="Excluir" onClick={() => setConfirmId(a.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            <span>{filtered.length} de {ausencias.length} registros</span>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>Impacto selecionado: {fmtCur(filtered.reduce((s,a)=>s+a.impactoFinanceiro,0))}</span>
          </div>
        </div>
      )}

      {/* Modal Nova Solicitação */}
      {modal === 'new' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Palmtree size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Nova Solicitação de Ausência</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Férias, licença ou afastamento</div>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tipo */}
              <div>
                <label className="form-label">Tipo de Ausência</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {(Object.entries(TIPO_CFG) as [TipoAusencia, any][]).map(([k, v]) => (
                    <button key={k} onClick={() => set('tipo', k)}
                      style={{ padding: '8px 6px', borderRadius: 8, border: `2px solid ${form.tipo === k ? v.color : 'hsl(var(--border-subtle))'}`, background: form.tipo === k ? `${v.color}15` : 'transparent', color: form.tipo === k ? v.color : 'hsl(var(--text-muted))', fontWeight: 600, fontSize: 10, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{v.icon}</div>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Funcionário + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Funcionário *</label>
                  {ativos.length > 0 ? (
                    <select className="form-input" value={form.funcionarioId} onChange={e => set('funcionarioId', e.target.value)}>
                      <option value="">Selecionar</option>
                      {ativos.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" placeholder="Nome do funcionário" value={form.funcionarioId} onChange={e => set('funcionarioId', e.target.value)} />
                  )}
                </div>
                <div>
                  <label className="form-label">Status Inicial</label>
                  <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Período */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Data de Início *</label>
                  <input type="date" className="form-input" value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Data de Retorno *</label>
                  <input type="date" className="form-input" value={form.dataFim} onChange={e => set('dataFim', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 8, padding: '8px 12px', width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#8b5cf6', fontFamily: 'Outfit,sans-serif' }}>{dias}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{diasUteis}d úteis</div>
                  </div>
                </div>
              </div>

              {/* CID (só afastamentos de saúde) */}
              {(form.tipo === 'afastamento_saude' || form.tipo === 'acidente_trabalho') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                  <div>
                    <label className="form-label">CID-10</label>
                    <input className="form-input" placeholder="Ex: J11.1" value={form.cid} onChange={e => set('cid', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Diagnóstico / Motivo</label>
                    <input className="form-input" placeholder="Descrição do diagnóstico" value={form.motivoCid} onChange={e => set('motivoCid', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Substituto + Abono pecuniário */}
              <div style={{ display: 'grid', gridTemplateColumns: form.tipo === 'ferias' ? '1fr auto' : '1fr', gap: 14, alignItems: 'flex-end' }}>
                <div>
                  <label className="form-label">Substituto (opcional)</label>
                  <select className="form-input" value={form.substitutoId} onChange={e => set('substitutoId', e.target.value)}>
                    <option value="">Sem substituto definido</option>
                    {ativos.filter(f => f.id !== form.funcionarioId).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                {form.tipo === 'ferias' && (
                  <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Abono Pecuniário</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>Venda de 10 dias de férias</div>
                    <button onClick={() => set('abonoPecuniario', !form.abonoPecuniario)}
                      style={{ width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: form.abonoPecuniario ? '#10b981' : 'hsl(var(--border-default))', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.abonoPecuniario ? 25 : 3, transition: 'left 0.2s' }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-input" rows={2} value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Motivo, condições especiais, restrições..." />
              </div>

              {/* Preview financeiro */}
              {form.funcionarioId && dias > 0 && (
                <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(245,158,11,0.04))', borderRadius: 12, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DollarSign size={14} color="#ef4444" />Impacto Financeiro Estimado
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Custo da Ausência', value: fmtCur(impactoPreview), color: '#ef4444' },
                      { label: 'Dias Úteis', value: `${diasUteis}d`, color: '#8b5cf6' },
                      { label: form.tipo === 'ferias' ? '+ 1/3 Constitucional' : 'Sem adicional', value: form.tipo === 'ferias' ? fmtCur(impactoPreview * 0.25) : '—', color: '#f59e0b' },
                    ].map(row => (
                      <div key={row.label} style={{ textAlign: 'center', padding: '8px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: row.color, fontFamily: 'Outfit,sans-serif' }}>{row.value}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{row.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.funcionarioId}>
                <Check size={14} />Registrar Ausência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {modal === 'view' && selectedAus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setModal(null)}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${TIPO_CFG[selectedAus.tipo].color}12, transparent)`, borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>{TIPO_CFG[selectedAus.tipo].icon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedAus.funcionarioNome}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    <code style={{ background: `${TIPO_CFG[selectedAus.tipo].color}18`, padding: '1px 6px', borderRadius: 4, color: TIPO_CFG[selectedAus.tipo].color, fontWeight: 700 }}>{selectedAus.codigo}</code>
                    {' '}• {TIPO_CFG[selectedAus.tipo].label}
                  </div>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Status + Ações */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: `${STATUS_CFG[selectedAus.status].color}18`, color: STATUS_CFG[selectedAus.status].color, fontWeight: 700 }}>
                  {STATUS_CFG[selectedAus.status].label}
                </span>
                {selectedAus.status === 'solicitado' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => { atualizarStatus(selectedAus.id, 'aprovado'); setModal(null) }}><CheckCircle size={12} />Aprovar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { atualizarStatus(selectedAus.id, 'rejeitado'); setModal(null) }}><Ban size={12} />Rejeitar</button>
                  </>
                )}
                {selectedAus.status === 'aprovado' && (
                  <button className="btn btn-primary btn-sm" onClick={() => { atualizarStatus(selectedAus.id, 'em_curso'); setModal(null) }}><ChevronRight size={12} />Iniciar</button>
                )}
                {selectedAus.status === 'em_curso' && (
                  <button className="btn btn-success btn-sm" onClick={() => { atualizarStatus(selectedAus.id, 'concluido'); setModal(null) }}><Check size={12} />Concluir</button>
                )}
              </div>

              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Cargo', value: selectedAus.cargo },
                  { label: 'Departamento', value: selectedAus.departamento },
                  { label: 'Início', value: fmt(selectedAus.dataInicio) },
                  { label: 'Retorno', value: fmt(selectedAus.dataFim) },
                  { label: 'Dias Corridos', value: `${selectedAus.diasCorridos} dias` },
                  { label: 'Dias Úteis', value: `${selectedAus.diasUteis} dias` },
                ].map(r => (
                  <div key={r.label} style={{ padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* CID */}
              {selectedAus.cid && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <ShieldAlert size={16} color="#f59e0b" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>CID-10: {selectedAus.cid}</div>
                    {selectedAus.motivoCid && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{selectedAus.motivoCid}</div>}
                  </div>
                </div>
              )}

              {/* Impacto Financeiro */}
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <DollarSign size={12} />Impacto Financeiro
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit,sans-serif' }}>{fmtCur(selectedAus.impactoFinanceiro)}</div>
                    {selectedAus.abonoPecuniario && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Inclui abono pecuniário (10 dias)</div>}
                  </div>
                  {selectedAus.tipo === 'ferias' && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Provisão utilizada</div>
                      <div style={{ fontWeight: 700, color: '#f59e0b' }}>{fmtCur(selectedAus.provisaoFerias)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Substituto + Obs */}
              {selectedAus.substitutoNome && (
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  👤 Substituto: <strong>{selectedAus.substitutoNome}</strong>
                </div>
              )}
              {selectedAus.obs && (
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic', padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                  "{selectedAus.obs}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 380, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', fontWeight: 700, color: '#f87171', display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle size={16} />Excluir Registro
            </div>
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              Este registro de ausência será removido permanentemente.
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmId)}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
