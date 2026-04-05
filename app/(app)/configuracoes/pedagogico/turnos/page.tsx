'use client'
import { useData, ConfigTurno, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Clock, Search } from 'lucide-react'

const BLANK: Omit<ConfigTurno, 'id' | 'createdAt'> = {
  codigo: '', nome: '', horarioInicio: '', horarioFim: '', situacao: 'ativo',
}

export default function TurnosPage() {
  const { cfgTurnos, setCfgTurnos } = useData()
  const [search, setSearch] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() =>
    cfgTurnos.filter(t => {
      const matchSearch = search.trim().length < 3 || (t.nome.toLowerCase().includes(search.toLowerCase()) || t.codigo.toLowerCase().includes(search.toLowerCase()))
      const matchSit = filtroSituacao === 'todos' || t.situacao === filtroSituacao
      return matchSearch && matchSit
    }), [cfgTurnos, search, filtroSituacao])

  const ativos = cfgTurnos.filter(t => t.situacao === 'ativo').length

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (t: ConfigTurno) => { setEditId(t.id); setForm({ codigo: t.codigo, nome: t.nome, horarioInicio: t.horarioInicio, horarioFim: t.horarioFim, situacao: t.situacao }); setShowForm(true) }
  const handleDelete = (id: string) => setCfgTurnos(prev => prev.filter(t => t.id !== id))

  const handleSave = () => {
    if (!form.nome.trim() || !form.codigo.trim()) return
    if (editId) {
      setCfgTurnos(prev => prev.map(t => t.id === editId ? { ...t, ...form } : t))
    } else {
      setCfgTurnos(prev => [...prev, { ...form, id: newId('TRN'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  const limparFiltros = () => {
    setSearch(''); setFiltroSituacao('todos')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Turnos Escolares</h1>
          <p className="page-subtitle">Personalize os turnos de aula da instituição</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Turno</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{cfgTurnos.length}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Turnos Cadastrados</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{ativos}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Turnos Ativos</div>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Turno' : '➕ Novo Turno'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código *</label>
              <input className="form-input" value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex: MN, TD, NT" maxLength={5} />
            </div>
            <div>
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Manhã, Tarde..." />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Horário Início</label>
              <input className="form-input" type="time" value={form.horarioInicio} onChange={e => setForm(p => ({ ...p, horarioInicio: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Horário Fim</label>
              <input className="form-input" type="time" value={form.horarioFim} onChange={e => setForm(p => ({ ...p, horarioFim: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />Salvar</button>
          </div>
        </div>
      )}

      {/* Tabela de Turnos */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Código</th>
              <th>Nome</th>
              <th>Horário Início</th>
              <th>Horário Fim</th>
              <th>Situação</th>
              <th style={{ width: 100 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 800 }}>{t.codigo}</code></td>
                <td style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</td>
                <td>{t.horarioInicio || '—'}</td>
                <td>{t.horarioFim || '—'}</td>
                <td>
                  <span className={`badge ${t.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{t.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(t)}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
            Nenhum turno com esses filtros — <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={limparFiltros}>limpar</button>
          </div>
        )}
      </div>
    </div>
  )
}
