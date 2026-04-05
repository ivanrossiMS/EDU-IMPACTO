'use client'

import { useState, useMemo } from 'react'
import { newId, Agendamento } from '@/lib/dataContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarCheck, Plus, X, Trash2, Clock, Search, Filter,
  Phone, Video, MessageSquare, Mail, MapPin, Pencil,
  CheckCircle, XCircle, ChevronLeft, ChevronRight, Users,
  BarChart2, Check, AlertCircle, Calendar
} from 'lucide-react'

const TIPOS = [
  { id: 'Visita Presencial', label: 'Visita Presencial', icon: MapPin, color: '#10b981' },
  { id: 'Videochamada',     label: 'Videochamada',     icon: Video,     color: '#3b82f6' },
  { id: 'Ligação',          label: 'Ligação',           icon: Phone,     color: '#f59e0b' },
  { id: 'WhatsApp',         label: 'WhatsApp',          icon: MessageSquare, color: '#25d366' },
  { id: 'E-mail',           label: 'E-mail',            icon: Mail,      color: '#8b5cf6' },
] as const

type TipoId = typeof TIPOS[number]['id']
const STATUS_OPTS = ['agendado', 'realizado', 'cancelado'] as const
type StatusAg = typeof STATUS_OPTS[number]

function getToday() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) { if (!d) return '—'; const [y, m, dia] = d.split('-'); return `${dia}/${m}/${y}` }
function fmtHora(h: string) { return h || '—' }

const STATUS_CFG: Record<StatusAg, { bg: string; cor: string; label: string; icon: React.ReactNode }> = {
  agendado:  { bg: 'rgba(99,102,241,0.12)',  cor: '#6366f1', label: 'Agendado',  icon: <Clock size={10} /> },
  realizado: { bg: 'rgba(16,185,129,0.12)',  cor: '#10b981', label: 'Realizado', icon: <CheckCircle size={10} /> },
  cancelado: { bg: 'rgba(239,68,68,0.12)',   cor: '#ef4444', label: 'Cancelado', icon: <XCircle size={10} /> },
}

interface FormState {
  lead: string; leadId: string; tipo: TipoId; data: string; hora: string
  responsavel: string; status: StatusAg; notas: string; local: string
  duracao: string
}

const BLANK_FORM: FormState = {
  lead: '', leadId: '', tipo: 'Visita Presencial', data: getToday(), hora: '09:00',
  responsavel: '', status: 'agendado', notas: '', local: '', duracao: '30',
}

export default function AgendamentosPage() {
  const queryClient = useQueryClient()
  
  const { data: agendamentos = [], isLoading: loadingAg } = useQuery<Agendamento[]>({
    queryKey: ['agendamentos'],
    queryFn: async () => { const r = await fetch('/api/crm/agendamentos'); return r.json() }
  })
  
  const { data: leads = [], isLoading: loadingLeads } = useQuery<any[]>({
    queryKey: ['leads'],
    queryFn: async () => { const r = await fetch('/api/crm/leads'); return r.json() }
  })

  const isLoading = loadingAg || loadingLeads

  const addMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch('/api/crm/agendamentos', { method: 'POST', body: JSON.stringify(data) }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] })
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch(`/api/crm/agendamentos/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] })
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/crm/agendamentos/${id}`, { method: 'DELETE' }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] })
  })
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [tab, setTab] = useState<'lista' | 'calendario'>('lista')
  const [filtroStatus, setFiltroStatus] = useState<StatusAg | ''>('')
  const [filtroTipo, setFiltroTipo] = useState<TipoId | ''>('')
  const [filtroData, setFiltroData] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [calMes, setCalMes] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  function openAdd() { setForm(BLANK_FORM); setEditingId(null); setShowModal(true) }
  function openEdit(a: Agendamento) {
    setForm({ lead: a.lead, leadId: (a as any).leadId || '', tipo: (a.tipo || 'Visita Presencial') as TipoId, data: a.data, hora: a.hora, responsavel: a.responsavel || '', status: a.status, notas: a.notas || '', local: (a as any).local || '', duracao: (a as any).duracao || '30' })
    setEditingId(a.id); setShowModal(true)
  }

  function handleSave() {
    if (!form.lead) return
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId })
    } else {
      addMutation.mutate(form)
    }
    setShowModal(false); setEditingId(null)
  }

  function handleDelete() {
    if (confirmId) deleteMutation.mutate(confirmId)
    setConfirmId(null)
  }

  function changeStatus(id: string, status: StatusAg) {
    updateMutation.mutate({ id, status })
  }

  // Filtros
  const filtered = useMemo(() => agendamentos.filter(a => {
    if (filtroStatus && a.status !== filtroStatus) return false
    if (filtroTipo && a.tipo !== filtroTipo) return false
    if (filtroData && a.data !== filtroData) return false
    if (search && !a.lead.toLowerCase().includes(search.toLowerCase()) && !a.responsavel?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`)), [agendamentos, filtroStatus, filtroTipo, filtroData, search])

  const hasFilter = !!(filtroStatus || filtroTipo || filtroData || search)
  const hoje = getToday()
  const proximos = agendamentos.filter(a => a.data >= hoje && a.status === 'agendado').sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))
  const realizadosMes = agendamentos.filter(a => a.data.startsWith(calMes.slice(0, 7)) && a.status === 'realizado').length
  const taxaRealizacao = agendamentos.length > 0 ? Math.round((agendamentos.filter(a => a.status === 'realizado').length / agendamentos.length) * 100) : 0

  // Calendário simples
  const calDays = useMemo(() => {
    const [ano, mes] = calMes.split('-').map(Number)
    const primeiroDia = new Date(ano, mes - 1, 1).getDay()
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const days: { day: number; date: string; ags: Agendamento[] }[] = []
    for (let i = 0; i < primeiroDia; i++) days.push({ day: 0, date: '', ags: [] })
    for (let d = 1; d <= ultimoDia; d++) {
      const date = `${calMes}-${String(d).padStart(2, '0')}`
      days.push({ day: d, date, ags: agendamentos.filter(a => a.data === date) })
    }
    return days
  }, [calMes, agendamentos])

  const prevMes = () => {
    const [y, m] = calMes.split('-').map(Number)
    const d = new Date(y, m - 2); setCalMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMes = () => {
    const [y, m] = calMes.split('-').map(Number)
    const d = new Date(y, m); setCalMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando CRM...</div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Agendamentos</h1>
          <p className="page-subtitle">Central de visitas, contatos e follow-ups com leads</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', padding: 3, gap: 2 }}>
            <button className={`btn btn-sm ${tab === 'lista' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('lista')} style={{ fontSize: 11 }}>📋 Lista</button>
            <button className={`btn btn-sm ${tab === 'calendario' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('calendario')} style={{ fontSize: 11 }}>📅 Calendário</button>
          </div>
          <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(p => !p)}><Filter size={12} />Filtros</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Novo Agendamento</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total', value: agendamentos.length, cor: '#6366f1', icon: <Calendar size={18} /> },
          { label: 'Próximos (agendados)', value: proximos.length, cor: '#3b82f6', icon: <Clock size={18} /> },
          { label: 'Realizados', value: agendamentos.filter(a => a.status === 'realizado').length, cor: '#10b981', icon: <CheckCircle size={18} /> },
          { label: 'Taxa de Realização', value: `${taxaRealizacao}%`, cor: taxaRealizacao >= 70 ? '#10b981' : '#f59e0b', icon: <BarChart2 size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.cor }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.cor, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Próximos agendamentos rápidos */}
      {proximos.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(79,70,229,0.03))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 10 }}>📅 PRÓXIMOS AGENDAMENTOS</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {proximos.slice(0, 5).map(a => {
              const tipo = TIPOS.find(t => t.id === a.tipo) || TIPOS[0]
              const Ico = tipo.icon
              return (
                <div key={a.id} style={{ minWidth: 160, padding: '10px 14px', background: 'hsl(var(--bg-base))', borderRadius: 10, border: `1px solid ${tipo.color}30`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ico size={12} color={tipo.color} />
                    <span style={{ fontSize: 10, color: tipo.color, fontWeight: 600 }}>{tipo.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{a.lead}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{fmtDate(a.data)} às {fmtHora(a.hora)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label className="form-label">Buscar</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Lead ou responsável..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoId | '')}>
                <option value="">Todos os tipos</option>
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusAg | '')}>
                <option value="">Todos os status</option>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Data específica</label>
              <input type="date" className="form-input" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
            </div>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFiltroStatus(''); setFiltroTipo(''); setFiltroData('') }}><X size={12} />Limpar</button>
            )}
          </div>
          {hasFilter && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 10 }}>{filtered.length} agendamento(s) encontrado(s)</div>}
        </div>
      )}

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        agendamentos.length === 0 ? (
          <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nenhum agendamento cadastrado</div>
            <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>Crie agendamentos de visitas, ligações e contatos com seus leads.</div>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={14} />Novo Agendamento</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(a => {
              const tipo = TIPOS.find(t => t.id === a.tipo) || TIPOS[0]
              const Ico = tipo.icon
              const badge = STATUS_CFG[a.status as StatusAg] || STATUS_CFG.agendado
              const isHoje = a.data === hoje
              const isPast = a.data < hoje && a.status === 'agendado'
              return (
                <div key={a.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: `4px solid ${tipo.color}`, background: isHoje ? `${tipo.color}04` : undefined }}>
                  {/* Ícone tipo */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${tipo.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ico size={20} color={tipo.color} />
                  </div>

                  {/* Data/hora box */}
                  <div style={{ textAlign: 'center', minWidth: 60, flexShrink: 0, padding: '6px 10px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: isHoje ? tipo.color : 'hsl(var(--text-primary))' }}>{a.data.split('-')[2]}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { month: 'short' })}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tipo.color }}>{a.hora}</div>
                  </div>

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.lead}</div>
                      {isHoje && <span style={{ fontSize: 9, padding: '1px 6px', background: '#f59e0b20', color: '#f59e0b', borderRadius: 4, fontWeight: 700 }}>HOJE</span>}
                      {isPast && <span style={{ fontSize: 9, padding: '1px 6px', background: '#ef444420', color: '#ef4444', borderRadius: 4, fontWeight: 700 }}>ATRASADO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ico size={10} color={tipo.color} />{tipo.label}</span>
                      {a.responsavel && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} />{a.responsavel}</span>}
                      {(a as any).local && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{(a as any).local}</span>}
                      {(a as any).duracao && <span><Clock size={10} /> {(a as any).duracao} min</span>}
                    </div>
                    {a.notas && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{a.notas}</div>}
                  </div>

                  {/* Status badge */}
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700, background: badge.bg, color: badge.cor, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {badge.icon}{badge.label}
                  </span>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {a.status === 'agendado' && (
                      <button className="btn btn-sm" style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }} onClick={() => changeStatus(a.id, 'realizado')}>
                        <Check size={11} />Realizado
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(a)}><Pencil size={12} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(a.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && hasFilter && (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                <CalendarCheck size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div style={{ fontWeight: 700 }}>Nenhum agendamento encontrado</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => { setSearch(''); setFiltroStatus(''); setFiltroTipo(''); setFiltroData('') }}>Limpar filtros</button>
              </div>
            )}
          </div>
        )
      )}

      {/* ── CALENDÁRIO ── */}
      {tab === 'calendario' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button className="btn btn-ghost btn-icon" onClick={prevMes}><ChevronLeft size={18} /></button>
            <div style={{ fontWeight: 800, fontSize: 16, textTransform: 'capitalize' }}>
              {new Date(calMes + '-01T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>{agendamentos.filter(a => a.data.startsWith(calMes)).length} agendamentos</span>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={nextMes}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
              <div key={d} style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', padding: '6px 0' }}>{d}</div>
            ))}
            {calDays.map((d, i) => (
              <div key={i} style={{ minHeight: 72, padding: 4, borderRadius: 8, background: d.date === hoje ? 'rgba(99,102,241,0.08)' : d.day ? 'hsl(var(--bg-elevated))' : 'transparent', border: d.date === hoje ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', opacity: d.day ? 1 : 0 }}>
                {d.day > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: d.date === hoje ? 800 : 400, color: d.date === hoje ? '#6366f1' : 'hsl(var(--text-primary))' }}>{d.day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                      {d.ags.slice(0, 2).map(a => {
                        const tipo = TIPOS.find(t => t.id === a.tipo) || TIPOS[0]
                        return <div key={a.id} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: `${tipo.color}20`, color: tipo.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.hora} {a.lead.split(' ')[0]}</div>
                      })}
                      {d.ags.length > 2 && <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>+{d.ags.length - 2}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Add/Edit ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 640, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', marginBottom: 24 }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(79,70,229,0.03))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarCheck size={20} color="#6366f1" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Registrar contato com lead</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Lead */}
              <div>
                <label className="form-label">Lead / Responsável *</label>
                {leads.length > 0 ? (
                  <select className="form-input" value={form.leadId} onChange={e => { const l = leads.find(x => x.id === e.target.value); set('leadId', e.target.value); set('lead', l?.nome || '') }}>
                    <option value="">Selecionar lead...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.nome} {l.status ? `(${l.status})` : ''}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={form.lead} onChange={e => set('lead', e.target.value)} placeholder="Nome do lead / responsável *" />
                )}
              </div>

              {/* Tipo de contato */}
              <div>
                <label className="form-label">Tipo de Contato</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                  {TIPOS.map(t => {
                    const Ico = t.icon
                    return (
                      <button key={t.id} type="button" onClick={() => set('tipo', t.id)}
                        style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${form.tipo === t.id ? t.color : 'hsl(var(--border-subtle))'}`, background: form.tipo === t.id ? `${t.color}12` : 'hsl(var(--bg-elevated))', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <Ico size={16} color={form.tipo === t.id ? t.color : 'hsl(var(--text-muted))'} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: form.tipo === t.id ? t.color : 'hsl(var(--text-muted))' }}>{t.label.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Data + Hora + Duração */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Data *</label><input type="date" className="form-input" value={form.data} onChange={e => set('data', e.target.value)} /></div>
                <div><label className="form-label">Hora</label><input type="time" className="form-input" value={form.hora} onChange={e => set('hora', e.target.value)} /></div>
                <div>
                  <label className="form-label">Duração (min)</label>
                  <select className="form-input" value={form.duracao} onChange={e => set('duracao', e.target.value)}>
                    {['15','30','45','60','90','120'].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              {/* Local + Responsável */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Local / Link</label><input className="form-input" value={form.local} onChange={e => set('local', e.target.value)} placeholder="Ex: Sala de reuniões ou meet.google.com/..." /></div>
                <div><label className="form-label">Responsável</label><input className="form-input" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Ex: Maria Santos" /></div>
              </div>

              {/* Status */}
              <div>
                <label className="form-label">Status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUS_OPTS.map(s => {
                    const cfg = STATUS_CFG[s]
                    return (
                      <button key={s} type="button" onClick={() => set('status', s)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.status === s ? cfg.cor : 'hsl(var(--border-subtle))'}`, background: form.status === s ? cfg.bg : 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: form.status === s ? cfg.cor : 'hsl(var(--text-muted))' }}>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-input" rows={3} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Contexto do contato, pontos a discutir..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.lead}>
                <Check size={14} />{editingId ? 'Salvar Alterações' : 'Criar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '28px', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir agendamento?</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Este agendamento será removido permanentemente.</div>
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
