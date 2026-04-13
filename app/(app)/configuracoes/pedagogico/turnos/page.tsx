'use client'
import { useData, ConfigTurno, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Clock, Search } from 'lucide-react'

const BLANK: Omit<ConfigTurno, 'id' | 'createdAt'> = {
  codigo: '', nome: '', horarioInicio: '', horarioFim: '', situacao: 'ativo',
}

const PADROES_TURNOS = [
  { codigo: '1', nome: 'Matutino', horarioInicio: '07:00', horarioFim: '12:00', situacao: 'ativo' },
  { codigo: '2', nome: 'Vespertino', horarioInicio: '13:00', horarioFim: '18:00', situacao: 'ativo' },
  { codigo: '3', nome: 'Noturno', horarioInicio: '19:00', horarioFim: '22:30', situacao: 'ativo' },
  { codigo: '4', nome: 'Integral', horarioInicio: '07:00', horarioFim: '17:00', situacao: 'ativo' },
] as const

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

  const loadPadroes = () => {
    setCfgTurnos(prev => {
      const existingCodes = new Set(prev.map(p => p.codigo))
      const news = PADROES_TURNOS.filter(p => !existingCodes.has(p.codigo)).map(p => ({
        ...p, id: newId('TRN'), createdAt: new Date().toISOString()
      }))
      return [...prev, ...news]
    })
  }

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja apagar TODOS os turnos? Essa ação afeta as matrículas e turmas deste turno.')) {
      setCfgTurnos([])
    }
  }

  const handleSave = () => {
    if (!form.nome.trim() || !form.codigo.trim()) return
    
    // Outer guard (uses closure state, works for normal clicks)
    if (!editId && cfgTurnos.some(t => t.codigo === form.codigo)) {
      alert('Já existe um turno com este código!')
      return
    }

    if (editId) {
      setCfgTurnos(prev => prev.map(t => t.id === editId ? { ...t, ...form } : t))
    } else {
      const novoId = newId('TRN')
      setCfgTurnos(prev => {
        // Inner guard (uses real-time queued state, works against double-click race conditions)
        if (prev.some(t => t.codigo === form.codigo || t.id === novoId)) return prev
        return [...prev, { ...form, id: novoId, createdAt: new Date().toISOString() }]
      })
    }
    setForm(BLANK)
    setShowForm(false)
  }

  const limparFiltros = () => {
    setSearch(''); setFiltroSituacao('todos')
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Turnos Escolares</h1>
          <p className="page-subtitle">Personalize os turnos de aula da instituição</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleClearAll} style={{ color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
            <Trash2 size={13} /> Limpar Tudo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadPadroes} style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <Clock size={13} /> Carregar Padrões
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} /> Novo Turno</button>
        </div>
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
