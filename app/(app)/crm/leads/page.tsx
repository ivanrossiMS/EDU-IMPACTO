'use client'

import { useState, useMemo, useEffect } from 'react'
import { useData, Lead, newId } from '@/lib/dataContext'
import { formatCurrency, getInitials } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, ArrowRightCircle, TrendingUp,
  Target, Users, DollarSign, BarChart2, Filter, X, Phone,
  Mail, Calendar, Star, Zap, ChevronRight, Check, Eye
} from 'lucide-react'

const COLUMNS = [
  { id: 'novo',        label: 'Novos Leads',        color: '#60a5fa', emoji: '🎯', desc: 'Leads recém capturados' },
  { id: 'contato',     label: 'Em Contato',          color: '#fbbf24', emoji: '📞', desc: 'Primeiro contato feito' },
  { id: 'visita',      label: 'Visita Agendada',     color: '#a78bfa', emoji: '🏫', desc: 'Visita marcada' },
  { id: 'proposta',    label: 'Proposta Enviada',    color: '#34d399', emoji: '📄', desc: 'Aguardando decisão' },
  { id: 'matriculado', label: 'Matriculados',         color: '#10b981', emoji: '✅', desc: 'Conversão realizada' },
  { id: 'perdido',     label: 'Perdidos',             color: '#f87171', emoji: '❌', desc: 'Lead desistiu' },
] as const

type ColId = typeof COLUMNS[number]['id']

const STATUS_ORDER: ColId[] = ['novo', 'contato', 'visita', 'proposta', 'matriculado', 'perdido']
const ORIGENS = ['Site', 'Instagram', 'Facebook', 'Google Ads', 'WhatsApp', 'Indicação', 'Referral', 'Outdoor', 'YouTube', 'TikTok', 'Evento', 'Outro']
const INTERESSES = ['Educação Infantil', 'Ensino Fundamental I', 'Ensino Fundamental II', 'Ensino Médio', 'Período Integral', 'Bilíngue', 'Outro']

const BLANK: Omit<Lead, 'id'> = {
  nome: '', interesse: '', origem: 'Site', status: 'novo',
  responsavel: '', data: new Date().toISOString().slice(0, 10),
  telefone: '', email: '', score_ia: 75, valor_potencial: 0, notas: '',
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#fbbf24' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Quente' : score >= 60 ? 'Morno' : score >= 40 ? 'Frio' : 'Perdido'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `conic-gradient(${color} ${score * 3.6}deg, hsl(var(--bg-overlay)) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 800, color }}>{score}</span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{label}</span>
    </div>
  )
}

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div style={{ height: 3, background: 'hsl(var(--bg-overlay))', borderRadius: 2 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
    </div>
  )
}

export default function LeadsPage() {
  const { leads = [], setLeads } = useData()
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban')
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Lead, 'id'>>(BLANK)
  const [searchQ, setSearchQ] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewLead, setViewLead] = useState<Lead | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Métricas
  const totalAtivo   = leads.filter(l => l.status !== 'perdido').length
  const totalPotential = leads.filter(l => l.status !== 'perdido').reduce((s, l) => s + l.valor_potencial, 0)
  const convRate     = leads.length > 0 ? Math.round((leads.filter(l => l.status === 'matriculado').length / leads.length) * 100) : 0
  const hotLeads     = leads.filter(l => l.score_ia >= 80 && l.status !== 'matriculado' && l.status !== 'perdido').length

  // Taxa de conversão por etapa
  const taxaConversao = useMemo(() => {
    const total = leads.length
    return COLUMNS.map(col => ({ ...col, count: leads.filter(l => l.status === col.id).length, pct: total > 0 ? Math.round((leads.filter(l => l.status === col.id).length / total) * 100) : 0 }))
  }, [leads])

  // Leads filtrados base
  const leadsFiltered = useMemo(() => leads.filter(l => {
    if (searchQ && !l.nome.toLowerCase().includes(searchQ.toLowerCase()) && !l.interesse.toLowerCase().includes(searchQ.toLowerCase()) && !l.email.toLowerCase().includes(searchQ.toLowerCase())) return false
    if (filtroOrigem && l.origem !== filtroOrigem) return false
    if (filtroStatus && l.status !== filtroStatus) return false
    return true
  }), [leads, searchQ, filtroOrigem, filtroStatus])

  // Reset paginação ao buscar
  useEffect(() => setCurrentPage(1), [searchQ, filtroOrigem, filtroStatus])

  const totalPages = Math.ceil(leadsFiltered.length / itemsPerPage)
  
  const leadsLista = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return leadsFiltered.slice(start, start + itemsPerPage)
  }, [leadsFiltered, currentPage])

  const hasFilter = !!(searchQ || filtroOrigem || filtroStatus)

  const openAdd  = (status: ColId = 'novo') => { setForm({ ...BLANK, status }); setModal('add') }
  const openEdit = (l: Lead) => { setForm({ ...l }); setEditingId(l.id); setModal('edit') }
  const openView = (l: Lead) => { setViewLead(l); setModal('view') }
  const closeModal = () => { setModal(null); setEditingId(null); setViewLead(null) }
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.nome.trim()) return
    const payload = { ...form }
    if (modal === 'add') {
      const novo = { ...payload, id: newId() }
      setLeads((p: any[]) => [...p, novo])
    } else if (editingId) {
      setLeads((p: any[]) => p.map(l => l.id === editingId ? { ...l, ...payload } : l))
    }
    closeModal()
  }

  const handleDelete = async () => {
    if (confirmId) {
      setLeads((p: any[]) => p.filter(l => l.id !== confirmId))
    }
    setConfirmId(null)
  }

  const advanceStatus = async (lead: Lead) => {
    const idx = STATUS_ORDER.indexOf(lead.status as any)
    if (idx < STATUS_ORDER.length - 1) {
      const next = STATUS_ORDER[idx + 1]
      setLeads((p: any[]) => p.map(l => l.id === lead.id ? { ...l, status: next } : l))
    }
  }

  const fmtDate = (s: string) => s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'

  return (
    <div>
      {/* Header premium */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Funil de Captação — CRM
          </h1>
          <p className="page-subtitle">
            {leads.length > 0
              ? `${leads.length} leads • ${formatCurrency(totalPotential)} potencial • ${convRate}% conversão`
              : 'Pipeline inteligente de captação de alunos'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', padding: 3, gap: 2 }}>
            <button className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('kanban')} style={{ fontSize: 11 }}>📋 Kanban</button>
            <button className={`btn btn-sm ${viewMode === 'lista' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('lista')} style={{ fontSize: 11 }}>📃 Lista</button>
          </div>
          <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}>
            <Filter size={12} />Filtros {hasFilter && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{[searchQ, filtroOrigem, filtroStatus].filter(Boolean).length}</span>}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
            <Plus size={13} />Novo Lead
          </button>
        </div>
      </div>

      {/* KPIs premium */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Leads Ativos', value: totalAtivo, sub: `${leads.filter(l => l.status === 'novo').length} novos hoje`, color: '#60a5fa', icon: <Target size={18} /> },
          { label: 'Potencial', value: formatCurrency(totalPotential), sub: 'receita estimada anual', color: '#10b981', icon: <DollarSign size={18} /> },
          { label: 'Conversão', value: `${convRate}%`, sub: `${leads.filter(l => l.status === 'matriculado').length} matriculados`, color: '#a78bfa', icon: <TrendingUp size={18} /> },
          { label: 'Leads Quentes', value: hotLeads, sub: 'score IA ≥ 80', color: '#f59e0b', icon: <Zap size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: `${k.color}10` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-elevated))', padding: '2px 8px', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))' }}>Tempo real</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de progresso do funil */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))' }}>DISTRIBUIÇÃO DO FUNIL</div>
        <div style={{ display: 'flex', gap: 0,  }}>
          {taxaConversao.map((col, i) => (
            <div key={col.id} style={{ flex: Math.max(col.count, 1), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px', borderRight: i < taxaConversao.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none' }}>
              <div style={{ height: 32, background: `${col.color}20`, borderRadius: 4, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${col.color}30` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: col.color }}>{col.count}</span>
              </div>
              <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{col.emoji} {col.label.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, border: '1px solid rgba(96,165,250,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label className="form-label">Buscar lead</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Nome, e-mail, interesse..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Origem</label>
              <select className="form-input" value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}>
                <option value="">Todas as origens</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Estágio</label>
              <select className="form-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                <option value="">Todos os estágios</option>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearchQ(''); setFiltroOrigem(''); setFiltroStatus('') }}><X size={12} />Limpar</button>
            )}
          </div>
          {hasFilter && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 10 }}>{leadsFiltered.length} lead(s) encontrado(s)</div>}
        </div>
      )}

      {/* ── KANBAN PREMIUM ── */}
      {leads.length === 0 ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Nenhum lead cadastrado</div>
          <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>Registre os primeiros leads para iniciar seu funil de captação.</div>
          <button className="btn btn-primary" onClick={() => openAdd()}><Plus size={14} />Cadastrar Primeiro Lead</button>
        </div>
      ) : viewMode === 'kanban' ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {COLUMNS.map(col => {
            const colLeads = leadsFiltered.filter(l => l.status === col.id)
            const colValue = colLeads.reduce((s, l) => s + l.valor_potencial, 0)
            return (
              <div key={col.id} style={{ minWidth: 240, maxWidth: 260, flex: '0 0 auto', background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: `1px solid hsl(var(--border-subtle))`, overflow: 'hidden' }}>
                {/* Header da coluna */}
                <div style={{ padding: '12px 14px', background: `${col.color}0A`, borderBottom: `2px solid ${col.color}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.emoji} {col.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                      {colLeads.length} lead(s) • {colValue > 0 ? formatCurrency(colValue) : '—'}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, color: col.color }} onClick={() => openAdd(col.id)}>
                    <Plus size={12} />
                  </button>
                </div>

                {/* Cards */}
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120, maxHeight: 520, overflowY: 'auto' }}>
                  {colLeads.map(lead => (
                    <div key={lead.id} style={{ background: 'hsl(var(--bg-base))', borderRadius: 10, padding: '12px', border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = col.color + '60')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))')}
                      onClick={() => openView(lead)}>
                      {/* Avatar + nome */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${col.color}20`, color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {getInitials(lead.nome)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{lead.nome}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{lead.interesse}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="btn btn-ghost btn-icon" style={{ width: 20, height: 20 }} onClick={e => { e.stopPropagation(); openEdit(lead) }}><Pencil size={9} /></button>
                          <button className="btn btn-ghost btn-icon" style={{ width: 20, height: 20, color: '#f87171' }} onClick={e => { e.stopPropagation(); setConfirmId(lead.id) }}><Trash2 size={9} /></button>
                        </div>
                      </div>

                      {/* Score IA */}
                      <div style={{ marginBottom: 8 }}>
                        <ScoreRing score={lead.score_ia} />
                      </div>

                      {/* Origem + valor */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: 'hsl(var(--bg-overlay))', borderRadius: 4, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{lead.origem}</span>
                        {lead.valor_potencial > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{formatCurrency(lead.valor_potencial)}</span>}
                      </div>

                      {/* Data + avançar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{fmtDate(lead.data)}</span>
                        {col.id !== 'matriculado' && col.id !== 'perdido' && (
                          <button className="btn btn-sm" style={{ fontSize: 9, padding: '3px 8px', background: `${col.color}15`, color: col.color, border: `1px solid ${col.color}30` }}
                            onClick={e => { e.stopPropagation(); advanceStatus(lead) }}>
                            Avançar <ChevronRight size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div style={{ padding: '20px 10px', textAlign: 'center', color: 'hsl(var(--text-disabled))', fontSize: 11 }}>
                      {col.emoji} Vazio<br /><span style={{ fontSize: 10, opacity: 0.6 }}>{col.desc}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── LISTA PREMIUM ── */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Lead</th><th>Interesse</th><th>Origem</th><th>Score IA</th><th>Potencial</th><th>Estágio</th><th>Data</th><th>Responsável</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leadsLista.map(lead => {
                const col = COLUMNS.find(c => c.id === lead.status)!
                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${col.color}20`, color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{getInitials(lead.nome)}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{lead.email || lead.telefone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{lead.interesse}</td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{lead.origem}</span></td>
                    <td style={{ width: 120 }}><ScoreRing score={lead.score_ia} /></td>
                    <td style={{ fontWeight: 700, color: '#10b981', fontSize: 13 }}>{formatCurrency(lead.valor_potencial)}</td>
                    <td><span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${col.color}18`, color: col.color, fontWeight: 700 }}>{col.emoji} {col.label}</span></td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{fmtDate(lead.data)}</td>
                    <td style={{ fontSize: 12 }}>{lead.responsavel || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Ver" onClick={() => openView(lead)}><Eye size={12} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(lead)}><Pencil size={12} /></button>
                        {lead.status !== 'matriculado' && lead.status !== 'perdido' && (
                          <button className="btn btn-ghost btn-icon btn-sm" title="Avançar estágio" onClick={() => advanceStatus(lead)} style={{ color: '#10b981' }}><ArrowRightCircle size={12} /></button>
                        )}
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(lead.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:'1px solid hsl(var(--border-subtle))' }}>
              <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, leadsFiltered.length)} de {leadsFiltered.length} leads
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Anterior</button>
                <div style={{ display:'flex', alignItems:'center', padding:'0 10px', fontSize:13, fontWeight:600 }}>Página {currentPage} de {totalPages}</div>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Add/Edit ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 680, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', marginBottom: 24 }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(96,165,250,0.06),rgba(167,139,250,0.04))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(96,165,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={20} color="#60a5fa" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Novo Lead' : 'Editar Lead'}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Pipeline CRM</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={18} /></button>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Nome + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Nome completo *</label><input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Ana Lima" style={{ fontWeight: 600 }} /></div>
                <div><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ana@gmail.com" /></div>
              </div>
              {/* Telefone + Data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Telefone / WhatsApp</label><input className="form-input" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 98888-0001" /></div>
                <div><label className="form-label">Data de entrada</label><input type="date" className="form-input" value={form.data} onChange={e => set('data', e.target.value)} /></div>
              </div>
              {/* Interesse + Origem */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Interesse / Segmento</label>
                  <select className="form-input" value={form.interesse} onChange={e => set('interesse', e.target.value)}>
                    <option value="">Selecionar...</option>
                    {INTERESSES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Canal de Origem</label>
                  <select className="form-input" value={form.origem} onChange={e => set('origem', e.target.value)}>
                    {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              {/* Estágio + Responsável */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Estágio no Funil</label>
                  <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Responsável CRM</label><input className="form-input" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Ex: Maria Santos" /></div>
              </div>
              {/* Valor + Score */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Valor Potencial (R$/ano)</label><input type="number" className="form-input" value={form.valor_potencial || ''} onChange={e => set('valor_potencial', +e.target.value)} min={0} step={100} style={{ fontWeight: 800, color: '#10b981' }} /></div>
                <div>
                  <label className="form-label">Score IA (0–100) — <span style={{ color: form.score_ia >= 80 ? '#10b981' : form.score_ia >= 60 ? '#fbbf24' : '#ef4444' }}>{form.score_ia >= 80 ? '🔥 Quente' : form.score_ia >= 60 ? '🟡 Morno' : '❄️ Frio'}</span></label>
                  <input type="range" min={0} max={100} value={form.score_ia} onChange={e => set('score_ia', +e.target.value)} style={{ width: '100%', accentColor: '#60a5fa' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--text-muted))' }}><span>0</span><span style={{ fontWeight: 800, color: '#60a5fa' }}>{form.score_ia}</span><span>100</span></div>
                </div>
              </div>
              {/* Notas */}
              <div>
                <label className="form-label">Observações / Contexto</label>
                <textarea className="form-input" rows={3} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Informações relevantes sobre o lead, histórico de contato..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim()}>
                <Check size={14} />{modal === 'add' ? 'Cadastrar Lead' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal View Lead ── */}
      {modal === 'view' && viewLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 520, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            {(() => {
              const col = COLUMNS.find(c => c.id === viewLead.status)!
              return (
                <>
                  <div style={{ padding: '20px 24px', background: `linear-gradient(135deg,${col.color}12,${col.color}06)`, borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${col.color}25`, color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{getInitials(viewLead.nome)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{viewLead.nome}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{viewLead.interesse}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${col.color}20`, color: col.color, fontWeight: 700, marginTop: 4, display: 'inline-block' }}>{col.emoji} {col.label}</span>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
                  </div>
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                      {[
                        { icon: <Phone size={13} />, label: 'Telefone', value: viewLead.telefone || '—' },
                        { icon: <Mail size={13} />, label: 'E-mail', value: viewLead.email || '—' },
                        { icon: <Star size={13} />, label: 'Origem', value: viewLead.origem },
                        { icon: <Calendar size={13} />, label: 'Entrada', value: fmtDate(viewLead.data) },
                        { icon: <DollarSign size={13} />, label: 'Potencial', value: formatCurrency(viewLead.valor_potencial) },
                        { icon: <Users size={13} />, label: 'Responsável', value: viewLead.responsavel || '—' },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                          <div style={{ color: 'hsl(var(--text-muted))' }}>{item.icon}</div>
                          <div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{item.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>SCORE IA</div><ScoreRing score={viewLead.score_ia} /></div>
                    {viewLead.notas && (
                      <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>
                        &quot;{viewLead.notas}&quot;
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { closeModal(); openEdit(viewLead) }}><Pencil size={12} />Editar</button>
                    {viewLead.status !== 'matriculado' && viewLead.status !== 'perdido' && (
                      <button className="btn btn-primary btn-sm" onClick={() => { advanceStatus(viewLead); closeModal() }}><ArrowRightCircle size={12} />Avançar Estágio</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: '#f87171' }} onClick={() => { setConfirmId(viewLead.id); closeModal() }}><Trash2 size={12} /></button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '28px', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir lead?</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Este lead será removido permanentemente do funil.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
