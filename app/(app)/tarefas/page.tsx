'use client'

import { Tarefa, useData, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, CheckCircle, Clock, AlertTriangle, Brain, X } from 'lucide-react'

type Priority = 'urgente' | 'alta' | 'media' | 'baixa'
type Status = 'pendente' | 'em-andamento' | 'concluida'

const P_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  urgente: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: '🚨 Urgente' },
  alta:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '🔴 Alta' },
  media:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', label: '🔵 Média' },
  baixa:   { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: '🟢 Baixa' },
}

const S_CONFIG: Record<Status, { badge: string; label: string }> = {
  pendente:      { badge: 'badge-warning', label: '⏳ Pendente' },
  'em-andamento': { badge: 'badge-primary', label: '▶ Em andamento' },
  concluida:     { badge: 'badge-success', label: '✓ Concluída' },
}

const BLANK: Omit<Tarefa, 'id'> = {
  titulo: '',
  descricao: '',
  responsavel: '',
  prazo: '',
  status: 'pendente',
  prioridade: 'media',
}

export default function TarefasPage() {
  const { tarefas = [], setTarefas } = useData()
  const isLoading = false

  const [filtroStatus, setFiltroStatus] = useState<Status | 'todas'>('todas')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<Omit<Tarefa, 'id'>>(BLANK)

  const filtered = tarefas.filter(t => filtroStatus === 'todas' || t.status === filtroStatus)
  const pendentes = tarefas.filter(t => t.status === 'pendente').length
  const andamento = tarefas.filter(t => t.status === 'em-andamento').length
  const concluidas = tarefas.filter(t => t.status === 'concluida').length
  const urgentes = tarefas.filter(t => t.prioridade === 'urgente' && t.status !== 'concluida').length

  const handleAdd = () => {
    if (!form.titulo.trim()) return
    setTarefas((prev: Tarefa[]) => [...prev, { ...form, id: newId('TAR') }])
    setForm(BLANK)
    setShowNew(false)
  }

  const toggleStatus = (id: string, current: Status) => {
    const next: Status = current === 'pendente' ? 'em-andamento' : current === 'em-andamento' ? 'concluida' : 'pendente'
    setTarefas((prev: Tarefa[]) => prev.map(t => t.id === id ? { ...t, status: next } : t))
  }

  const handleDelete = (id: string) => {
    setTarefas((prev: Tarefa[]) => prev.filter(t => t.id !== id))
  }

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando tarefas...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Minhas Tarefas</h1>
          <p className="page-subtitle">{pendentes} pendentes • {andamento} em andamento • {concluidas} concluídas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Brain size={13} />IA: Priorizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={13} />Nova Tarefa</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Urgentes', value: urgentes, color: '#ef4444', icon: '🚨' },
          { label: 'Pendentes', value: pendentes, color: '#f59e0b', icon: '⏳' },
          { label: 'Em andamento', value: andamento, color: '#3b82f6', icon: '▶' },
          { label: 'Concluídas', value: concluidas, color: '#10b981', icon: '✅' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['todas', 'pendente', 'em-andamento', 'concluida'] as const).map(s => (
          <button key={s} className={`btn ${filtroStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFiltroStatus(s)}>
            {s === 'todas' ? 'Todas' : S_CONFIG[s as Status].label}
          </button>
        ))}
      </div>

      {/* Formulário nova tarefa */}
      {showNew && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Nova Tarefa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Título *</label>
              <input className="form-input" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Descreva a tarefa..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Descrição</label>
              <textarea className="form-input" rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes adicionais..." />
            </div>
            <div>
              <label className="form-label">Responsável</label>
              <input className="form-input" value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div>
              <label className="form-label">Prazo</label>
              <input className="form-input" type="date" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-input" value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value as Priority }))}>
                <option value="baixa">🟢 Baixa</option>
                <option value="media">🔵 Média</option>
                <option value="alta">🔴 Alta</option>
                <option value="urgente">🚨 Urgente</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}>
                <option value="pendente">⏳ Pendente</option>
                <option value="em-andamento">▶ Em andamento</option>
                <option value="concluida">✓ Concluída</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowNew(false); setForm(BLANK) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleAdd}><Plus size={13} />Criar Tarefa</button>
          </div>
        </div>
      )}

      {tarefas.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--text-primary))' }}>
            Nenhuma tarefa cadastrada
          </div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>
            Crie tarefas para organizar o trabalho da equipe escolar.
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} />Criar primeira tarefa</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => {
            const pc = P_CONFIG[t.prioridade as Priority]
            const sc = S_CONFIG[t.status as Status]
            return (
              <div key={t.id} style={{ display: 'flex', gap: 14, padding: '16px 20px', background: t.status === 'concluida' ? 'hsl(var(--bg-surface))' : pc.bg, border: `1px solid ${t.status === 'concluida' ? 'hsl(var(--border-subtle))' : pc.color + '30'}`, borderLeft: `4px solid ${t.status === 'concluida' ? 'hsl(var(--border-subtle))' : pc.color}`, borderRadius: 12, opacity: t.status === 'concluida' ? 0.6 : 1, alignItems: 'flex-start' }}>
                <div style={{ paddingTop: 2, flexShrink: 0 }}>
                  <input type="checkbox" checked={t.status === 'concluida'} onChange={() => toggleStatus(t.id, t.status as Status)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', textDecoration: t.status === 'concluida' ? 'line-through' : 'none' }}>{t.titulo}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: `${pc.color}20`, color: pc.color, fontWeight: 700 }}>{pc.label}</span>
                    <span className={`badge ${sc.badge}`} style={{ fontSize: 10 }}>{sc.label}</span>
                  </div>
                  {t.descricao && <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>{t.descricao}</div>}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    {t.prazo && <span>📅 Prazo: {t.prazo}</span>}
                    {t.responsavel && <span>👤 {t.responsavel}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {t.status !== 'concluida' && (
                    <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => toggleStatus(t.id, t.status as Status)}>
                      <CheckCircle size={11} />Avançar
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(t.id)} title="Excluir">
                    <X size={13} />
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              Nenhuma tarefa com os filtros selecionados
            </div>
          )}
        </div>
      )}
    </div>
  )
}
