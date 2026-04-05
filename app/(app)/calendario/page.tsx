'use client'

import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Save, Filter, Users, Globe, UserCheck, Search, Edit2 } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface SysUser { id: string; nome: string; email: string; cargo: string; perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimoAcesso: string }

type TipoEvento = EventoAgenda['tipo']

const TIPO_CORES: Record<TipoEvento, string> = {
  aula: '#3b82f6', evento: '#f59e0b', prova: '#ef4444', reuniao: '#8b5cf6',
  feriado: '#6b7280', excursao: '#10b981', entrega: '#06b6d4', atividade: '#ec4899',
}
const TIPO_LABELS: Record<TipoEvento, string> = {
  aula: 'Aula', evento: 'Evento', prova: 'Prova/Avaliação', reuniao: 'Reunião',
  feriado: 'Feriado', excursao: 'Excursão', entrega: 'Entrega', atividade: 'Atividade'
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }
function todayStr() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

// ── Seletor multi-turma / visibilidade ───────────────────────────────────────
function VisibilidadeSelector({
  turmas,
  usuarios,
  valor,
  onChange,
}: {
  turmas: string[]
  usuarios: SysUser[]
  valor: { tipo: 'todos' | 'turmas' | 'usuario'; turmasSel: string[]; usuario: string }
  onChange: (v: typeof valor) => void
}) {
  const [searchTurma, setSearchTurma] = useState('')
  const filteredTurmas = turmas.filter(t => t.toLowerCase().includes(searchTurma.toLowerCase()))

  const toggleTurma = (nome: string) => {
    const novo = valor.turmasSel.includes(nome)
      ? valor.turmasSel.filter(t => t !== nome)
      : [...valor.turmasSel, nome]
    onChange({ ...valor, turmasSel: novo })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Tipo de visibilidade */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { v: 'todos', label: '🌐 Toda a instituição', icon: Globe },
          { v: 'turmas', label: '👥 Grupos específicos', icon: Users },
          { v: 'usuario', label: '👤 Usuário do sistema', icon: UserCheck },
        ].map(opt => (
          <button key={opt.v} type="button"
            onClick={() => onChange({ ...valor, tipo: opt.v as any })}
            style={{
              flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: valor.tipo === opt.v ? 'rgba(59,130,246,0.15)' : 'hsl(var(--bg-elevated))',
              border: `1px solid ${valor.tipo === opt.v ? 'rgba(59,130,246,0.5)' : 'hsl(var(--border-subtle))'}`,
              color: valor.tipo === opt.v ? '#60a5fa' : 'hsl(var(--text-muted))', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Turmas */}
      {valor.tipo === 'turmas' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Filtrar grupos..." value={searchTurma} onChange={e => setSearchTurma(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
            {filteredTurmas.map(t => {
              const sel = valor.turmasSel.includes(t)
              return (
                <button key={t} type="button" onClick={() => toggleTurma(t)}
                  style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${sel ? '#60a5fa' : 'hsl(var(--border-subtle))'}`, background: sel ? 'rgba(59,130,246,0.1)' : 'transparent', color: sel ? '#60a5fa' : 'hsl(var(--text-muted))' }}>
                  {sel ? '✓ ' : ''}{t}
                </button>
              )
            })}
            {filteredTurmas.length === 0 && <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Nenhum grupo cadastrado</span>}
          </div>
          {valor.turmasSel.length > 0 && (
            <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 6 }}>
              {valor.turmasSel.length} grupo(s) selecionado(s): {valor.turmasSel.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Usuário */}
      {valor.tipo === 'usuario' && (
        <div>
          <label className="form-label" style={{ fontSize: 11 }}>Para qual usuário do sistema</label>
          <select className="form-input" value={valor.usuario} onChange={e => onChange({ ...valor, usuario: e.target.value })}>
            <option value="">Selecione um usuário...</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.nome}>{u.nome}{u.cargo ? ` — ${u.cargo}` : ''}</option>
            ))}
            {usuarios.length === 0 && <option disabled>Nenhum usuário cadastrado</option>}
          </select>
        </div>
      )}
    </div>
  )
}

const BLANK_EVENTO: Omit<EventoAgenda, 'id' | 'createdAt'> = {
  titulo: '', descricao: '', tipo: 'evento', data: '', horaInicio: '', horaFim: '',
  turmas: [], local: '', cor: '#f59e0b', recorrente: false, criadoPor: 'Usuário',
  confirmacaoNecessaria: false, confirmados: [], unidade: '',
}

export default function CalendarioPage() {
  const { eventosAgenda, setEventosAgenda } = useData()
  const [gruposManuais] = useLocalStorage<{nome: string}[]>('ad_grupos_manuais', [])
  const turmasNomes = gruposManuais.map(t => t.nome)
  const [sysUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  const usuariosAtivos = sysUsers.filter(u => u.status === 'ativo')

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EventoAgenda, 'id' | 'createdAt'>>(BLANK_EVENTO)

  // Visibilidade do novo evento
  const [visibilidade, setVisibilidade] = useState<{ tipo: 'todos' | 'turmas' | 'usuario'; turmasSel: string[]; usuario: string }>({
    tipo: 'todos', turmasSel: [], usuario: 'Todos',
  })

  // Filtros da view
  const [filtroTurma, setFiltroTurma] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Eventos filtrados para a view
  const eventosFiltrados = useMemo(() => eventosAgenda.filter(e => {
    const matchTurma = filtroTurma === 'todas' || (e.turmas ?? []).includes(filtroTurma) || (e.turmas ?? []).length === 0
    const matchTipo = filtroTipo === 'todos' || e.tipo === filtroTipo
    const matchUsuario = filtroUsuario === 'todos' || (e as any).visibilidadeUsuario === filtroUsuario || (e as any).visibilidadeUsuario === undefined
    return matchTurma && matchTipo && matchUsuario
  }), [eventosAgenda, filtroTurma, filtroTipo, filtroUsuario])

  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const handleAdd = () => {
    if (!form.titulo.trim() || !form.data) return
    const turmasList = visibilidade.tipo === 'turmas' ? visibilidade.turmasSel
      : visibilidade.tipo === 'todos' ? ['TODOS']
      : []
    
    if (editingId) {
      setEventosAgenda(prev => prev.map(e => e.id === editingId ? {
        ...e,
        ...form,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : { visibilidadeUsuario: undefined }),
      } : e))
    } else {
      const novoEvento: EventoAgenda = {
        ...form,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        id: newId('EV'),
        createdAt: new Date().toISOString(),
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : {}),
      }
      setEventosAgenda(prev => [...prev, novoEvento])
    }

    setForm({ ...BLANK_EVENTO, data: form.data })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(false)
  }

  const handleDelete = (id: string) => setEventosAgenda(prev => prev.filter(e => e.id !== id))

  const handleEdit = (ev: EventoAgenda) => {
    setForm({
      titulo: ev.titulo, descricao: ev.descricao, tipo: ev.tipo, data: ev.data,
      horaInicio: ev.horaInicio, horaFim: ev.horaFim, local: ev.local,
      cor: ev.cor, recorrente: ev.recorrente, criadoPor: ev.criadoPor,
      confirmacaoNecessaria: ev.confirmacaoNecessaria, confirmados: ev.confirmados,
      unidade: ev.unidade, turmas: []
    })
    let t = 'todos';
    let turmasSel: string[] = [];
    let usuarioStr = 'Todos';

    if (ev.turmas && ev.turmas.length > 0 && ev.turmas[0] !== 'TODOS') {
      t = 'turmas';
      turmasSel = ev.turmas;
    } else if ((ev as any).visibilidadeUsuario) {
      t = 'usuario';
      usuarioStr = (ev as any).visibilidadeUsuario;
    }

    setVisibilidade({ tipo: t as any, turmasSel, usuario: usuarioStr })
    setEditingId(ev.id)
    setShowModal(true)
  }

  const openNewEventoForDay = (dateStr: string) => {
    setForm({ ...BLANK_EVENTO, data: dateStr })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(true)
  }

  const proximosEventos = eventosAgenda
    .filter(e => e.data >= today)
    .sort((a, b) => (a.data + a.horaInicio) < (b.data + b.horaInicio) ? -1 : 1)
    .slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendário Escolar</h1>
          <p className="page-subtitle">{eventosAgenda.length} evento(s) cadastrado(s) • Ano letivo {year}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' }); setEditingId(null); setShowModal(true) }}>
          <Plus size={13} />Novo Evento
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <Filter size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Filtrar:</span>

        {/* Turma / Grupo */}
        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
          <option value="todas">Todos os grupos</option>
          {turmasNomes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Tipo */}
        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Usuário */}
        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
          <option value="todos">Todos os usuários</option>
          {usuariosAtivos.map(u => <option key={u.id} value={u.nome}>{u.nome}{u.cargo ? ` — ${u.cargo}` : ''}</option>)}
          {usuariosAtivos.length === 0 && <option disabled>Nenhum usuário cadastrado</option>}
        </select>

        {(filtroTurma !== 'todas' || filtroTipo !== 'todos' || filtroUsuario !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setFiltroTurma('todas'); setFiltroTipo('todos'); setFiltroUsuario('todos') }}>
            ✕ Limpar
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'hsl(var(--text-muted))' }}>{eventosFiltrados.length} evento(s)</span>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(TIPO_CORES).map(([tipo, cor]) => (
          <button key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo as TipoEvento)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, opacity: filtroTipo !== 'todos' && filtroTipo !== tipo ? 0.4 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'capitalize' }}>{TIPO_LABELS[tipo as TipoEvento]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* Calendário */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{MESES[month]} {year}</div>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', padding: '6px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const dateStr = getDateStr(d)
              const events = eventosPorDia(dateStr)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              return (
                <button key={d} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{ position: 'relative', minHeight: 60, padding: '4px', borderRadius: 8, background: isSelected ? 'rgba(59,130,246,0.12)' : isToday ? 'rgba(59,130,246,0.06)' : 'transparent', border: `1px solid ${isSelected ? '#3b82f6' : isToday ? 'rgba(59,130,246,0.3)' : 'transparent'}`, cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                  onDoubleClick={() => openNewEventoForDay(dateStr)}>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? '#60a5fa' : 'hsl(var(--text-primary))', marginBottom: 2 }}>{d}</div>
                  {events.slice(0, 2).map(ev => (
                    <div key={ev.id} style={{ fontSize: 9, background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '22', color: ev.cor ?? TIPO_CORES[ev.tipo], padding: '1px 3px', borderRadius: 3, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {ev.titulo.slice(0, 14)}
                    </div>
                  ))}
                  {events.length > 2 && <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>+{events.length - 2}</div>}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 10, textAlign: 'center' }}>
            Clique para ver eventos do dia • Duplo clique para adicionar
          </div>
        </div>

        {/* Painel lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {selectedDay ? `${parseInt(selectedDay.split('-')[2])}/${parseInt(selectedDay.split('-')[1])}/${selectedDay.split('-')[0]}` : 'Selecione um dia'}
              </div>
              {selectedDay && (
                <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={() => openNewEventoForDay(selectedDay!)}>
                  <Plus size={11} />Adicionar
                </button>
              )}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>
                {selectedDay ? 'Nenhum evento — clique em Adicionar' : 'Clique em um dia'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedEvents.map(ev => (
                  <div key={ev.id} style={{ padding: '10px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, borderLeft: `3px solid ${ev.cor ?? TIPO_CORES[ev.tipo]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{ev.titulo}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#3b82f6' }} title="Editar" onClick={(evt) => { evt.stopPropagation(); handleEdit(ev) }}><Edit2 size={11} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={(evt) => { evt.stopPropagation(); handleDelete(ev.id) }}><X size={11} /></button>
                      </div>
                    </div>
                    {ev.horaInicio && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>🕐 {ev.horaInicio}{ev.horaFim ? ` — ${ev.horaFim}` : ''}</div>}
                    {ev.local && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>📍 {ev.local}</div>}
                    {(ev.turmas ?? []).length > 0 && (ev.turmas ?? [])[0] !== 'TODOS' && (
                      <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={9} />{(ev.turmas ?? []).join(', ')}
                      </div>
                    )}
                    {(ev.turmas ?? []).includes('TODOS') && <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>🌐 Toda a instituição</div>}
                    <div style={{ fontSize: 10, color: ev.cor ?? TIPO_CORES[ev.tipo], marginTop: 4, fontWeight: 600 }}>{TIPO_LABELS[ev.tipo]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📅 Próximos Eventos</div>
            {proximosEventos.length === 0 ? (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px 0' }}>Nenhum evento cadastrado</div>
            ) : (
              proximosEventos.map(ev => {
                const [y, m, d] = ev.data.split('-')
                return (
                  <div key={ev.id} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: ev.cor ?? TIPO_CORES[ev.tipo], width: 36, textAlign: 'center', background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '15', padding: '4px', borderRadius: 6, flexShrink: 0 }}>
                      {d}/{m}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.titulo}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                        {TIPO_LABELS[ev.tipo]}{ev.horaInicio ? ` • ${ev.horaInicio}` : ''}
                        {(ev.turmas ?? []).includes('TODOS') ? ' • 🌐 Todos' : (ev.turmas ?? []).length > 0 ? ` • ${(ev.turmas ?? []).join(', ')}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal novo evento */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: 580, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{editingId ? 'Editar Evento' : 'Novo Evento'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingId(null); }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Título *</label>
                <input className="form-input" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Nome do evento" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Data *</label>
                  <input className="form-input" type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoEvento, cor: TIPO_CORES[e.target.value as TipoEvento] }))}>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Hora início</label>
                  <input className="form-input" type="time" value={form.horaInicio} onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Hora fim</label>
                  <input className="form-input" type="time" value={form.horaFim} onChange={e => setForm(p => ({ ...p, horaFim: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Local</label>
                <input className="form-input" value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} placeholder="Ex: Auditório, Sala 01" />
              </div>
              <div>
                <label className="form-label">Descrição</label>
                <textarea className="form-input" rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes do evento..." />
              </div>

              {/* Visibilidade */}
              <div style={{ padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-secondary))' }}>
                  👁️ Visibilidade do evento
                </div>
                <VisibilidadeSelector
                  turmas={turmasNomes}
                  usuarios={usuariosAtivos}
                  valor={visibilidade}
                  onChange={setVisibilidade}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!form.titulo.trim() || !form.data}>
                <Save size={13} /> {editingId ? 'Salvar Alterações' : 'Salvar Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
