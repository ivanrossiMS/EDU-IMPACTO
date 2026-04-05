'use client'

import { useState } from 'react'
import { Wrench, Plus, AlertTriangle, CheckCircle, Clock, Calendar, User, Trash2, X, Save, RotateCcw } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId } from '@/lib/dataContext'

type Status = 'aberto' | 'em_andamento' | 'concluido'
type Prioridade = 'urgente' | 'alta' | 'media' | 'baixa'

interface Chamado {
  id: string; codigo?: string; titulo: string; local: string; descricao: string
  tipo?: string; prioridade: Prioridade; status: Status; responsavel: string; abertura: string
}
const BLANK: Omit<Chamado, 'id' | 'abertura'> = {
  titulo: '', local: '', descricao: '', tipo: 'geral', prioridade: 'media', status: 'aberto', responsavel: ''
}

const P_CONFIG: Record<Prioridade, { color: string; label: string }> = {
  urgente: { color: '#ef4444', label: '🚨 Urgente' },
  alta: { color: '#f59e0b', label: '🔴 Alta' },
  media: { color: '#3b82f6', label: '🔵 Média' },
  baixa: { color: '#10b981', label: '🟢 Baixa' },
}
const S_CONFIG: Record<Status, { badge: string; label: string; icon: React.ReactNode }> = {
  aberto: { badge: 'badge-warning', label: 'Aberto', icon: <AlertTriangle size={11} /> },
  em_andamento: { badge: 'badge-primary', label: 'Em andamento', icon: <Clock size={11} /> },
  concluido: { badge: 'badge-success', label: 'Concluído', icon: <CheckCircle size={11} /> },
}

export default function ManutencaoPage() {
  const [chamados, setChamados] = useLocalStorage<Chamado[]>('edu-manutencao', [])
  const [filtro, setFiltro] = useState<Status | 'todos'>('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<Chamado, 'id' | 'abertura'>>(BLANK)
  const [del, setDel] = useState<string | null>(null)

  const filtered = chamados.filter(c => filtro === 'todos' || c.status === filtro)
  const abertos = chamados.filter(c => c.status === 'aberto').length
  const urgentes = chamados.filter(c => c.prioridade === 'urgente').length

  const gerarCodMP = () => {
    const existentes = chamados.map(c => (c as any).codigo).filter(Boolean)
    let i = chamados.length + 1
    let cod = `MP${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `MP${String(i).padStart(3, '0')}` }
    return cod
  }

  const save = () => {
    if (!form.titulo.trim()) return
    const codigo = gerarCodMP()
    setChamados(prev => [...prev, { ...form, codigo, id: newId('MAN'), abertura: new Date().toLocaleDateString('pt-BR') }])
    setModal(false); setForm(BLANK)
  }
  const concluir = (id: string) => setChamados(prev => prev.map(c => c.id === id ? { ...c, status: 'concluido' } : c))
  const remove = () => { if (del) { setChamados(prev => prev.filter(c => c.id !== del)); setDel(null) } }
  const f = (k: keyof typeof BLANK, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔧 Manutenção Predial</h1>
          <p className="page-subtitle">{abertos} chamado(s) aberto(s) • {urgentes} urgente(s)</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={13} />Novo Chamado</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Abertos', value: abertos, color: '#f59e0b', icon: '📋' },
          { label: 'Em andamento', value: chamados.filter(c => c.status === 'em_andamento').length, color: '#3b82f6', icon: '🔧' },
          { label: 'Concluídos', value: chamados.filter(c => c.status === 'concluido').length, color: '#10b981', icon: '✅' },
          { label: 'Urgentes', value: urgentes, color: '#ef4444', icon: '🚨' },
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['todos', 'aberto', 'em_andamento', 'concluido'] as const).map(s => (
          <button key={s} className={`btn ${filtro === s ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFiltro(s)}>
            {s === 'todos' ? 'Todos' : S_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Wrench size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum chamado de manutenção</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Registre chamados para acompanhar reparos e manutenções.</div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={13} />Abrir Primeiro Chamado</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const pc = P_CONFIG[c.prioridade]
            const sc = S_CONFIG[c.status]
            return (
              <div key={c.id} style={{ display: 'flex', gap: 14, padding: '16px 18px', background: c.status === 'concluido' ? 'hsl(var(--bg-surface))' : `${pc.color}06`, border: `1px solid ${c.status === 'concluido' ? 'hsl(var(--border-subtle))' : pc.color + '30'}`, borderLeft: `4px solid ${c.status === 'concluido' ? 'hsl(var(--border-subtle))' : pc.color}`, borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${pc.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: pc.color }}>
                  <Wrench size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    {(c as any).codigo && <code style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: 4, fontWeight: 700 }}>{(c as any).codigo}</code>}
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.titulo}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: `${pc.color}20`, color: pc.color, fontWeight: 700 }}>{pc.label}</span>
                    <span className={`badge ${sc.badge}`}>{sc.icon}{sc.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>{c.local}{c.descricao ? ` • ${c.descricao}` : ''}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    <span><Calendar size={9} style={{ display: 'inline', marginRight: 4 }} />Aberto: {c.abertura}</span>
                    {c.responsavel && <span><User size={9} style={{ display: 'inline', marginRight: 4 }} />{c.responsavel}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  {c.status !== 'concluido' ? (
                    <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => concluir(c.id)}><CheckCircle size={11} />Concluir</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f59e0b' }} onClick={() => setChamados(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: 'em_andamento' } : ch))} title="Reverter para 'Em andamento'"><RotateCcw size={11} />Reverter</button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={() => setDel(c.id)}><Trash2 size={11} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, width: '100%', maxWidth: 520, border: '1px solid hsl(var(--border-default))' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Novo Chamado de Manutenção</div>
              <button onClick={() => setModal(false)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e => f('titulo', e.target.value)} placeholder="Ex: Ar-condicionado com defeito" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Local</label><input className="form-input" value={form.local} onChange={e => f('local', e.target.value)} placeholder="Ex: Sala 12 — 2º andar" /></div>
                <div><label className="form-label">Tipo</label>
                  <select className="form-input" value={(form as any).tipo || 'geral'} onChange={e => f('tipo', e.target.value)}>
                    <option value="geral">🔧 Geral</option>
                    <option value="eletrico">⚡ Elétrico</option>
                    <option value="hidraulico">🚿 Hidráulico</option>
                    <option value="civil">🏗️ Civil/Estrutural</option>
                    <option value="ar-condicionado">❄️ Ar-condicionado</option>
                    <option value="ti">💻 TI/Redes</option>
                    <option value="pintura">🎨 Pintura</option>
                  </select>
                </div>
                <div><label className="form-label">Responsável</label><input className="form-input" value={form.responsavel} onChange={e => f('responsavel', e.target.value)} placeholder="Técnico responsável" /></div>
                <div><label className="form-label">Prioridade</label>
                  <select className="form-input" value={form.prioridade} onChange={e => f('prioridade', e.target.value)}>
                    <option value="baixa">🟢 Baixa</option>
                    <option value="media">🔵 Média</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="urgente">🚨 Urgente</option>
                  </select>
                </div>
                <div><label className="form-label">Status inicial</label>
                  <select className="form-input" value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                  </select>
                </div>
              </div>
              <div><label className="form-label">Descrição detalhada</label><textarea className="form-input" style={{ minHeight: 72 }} value={form.descricao} onChange={e => f('descricao', e.target.value)} /></div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={13} />Abrir Chamado</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 400, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Excluir chamado?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
