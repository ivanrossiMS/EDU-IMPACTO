'use client'
import { useData, ConfigSituacaoAluno, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, UserCheck, Search } from 'lucide-react'

const TIPOS_SITUACAO = ['Ativo', 'Inativo', 'Historico', 'Transferido', 'Cancelado'] as const

const BLANK: Omit<ConfigSituacaoAluno, 'id' | 'createdAt'> = {
  codigo: '', nome: '', tipo: 'Ativo', situacao: 'ativo',
}

export default function SituacaoAlunoPage() {
  const { cfgSituacaoAluno, setCfgSituacaoAluno } = useData()
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'Ativo' | 'Inativo' | 'Historico' | 'Transferido' | 'Cancelado'>('todos')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() =>
    cfgSituacaoAluno.filter(s => {
      const matchSearch = search.trim().length < 3 || (s.nome.toLowerCase().includes(search.toLowerCase()) || s.codigo.toLowerCase().includes(search.toLowerCase()))
      const matchTipo = filtroTipo === 'todos' || s.tipo === filtroTipo
      return matchSearch && matchTipo
    }), [cfgSituacaoAluno, search, filtroTipo])

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (s: ConfigSituacaoAluno) => { setEditId(s.id); setForm({ codigo: s.codigo, nome: s.nome, tipo: s.tipo, situacao: s.situacao }); setShowForm(true) }
  const handleDelete = (id: string) => setCfgSituacaoAluno(prev => prev.filter(s => s.id !== id))

  const handleSave = () => {
    if (!form.nome.trim() || !form.codigo.trim()) return
    if (editId) {
      setCfgSituacaoAluno(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s))
    } else {
      setCfgSituacaoAluno(prev => [...prev, { ...form, id: newId('SIT'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  const limparFiltros = () => {
    setSearch(''); setFiltroTipo('todos')
  }

  const getTipoColor = (tipo: string) => {
    switch(tipo){
      case 'Ativo': return '#10b981'
      case 'Inativo': return '#f59e0b'
      case 'Historico': return '#60a5fa'
      case 'Transferido': return '#8b5cf6'
      case 'Cancelado': return '#ef4444'
      default: return '#6b7280'
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Situação do Aluno</h1>
          <p className="page-subtitle">Personalize os status e situações acadêmicas dos alunos</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Situação</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {TIPOS_SITUACAO.map(tipo => {
            const qtd = cfgSituacaoAluno.filter(s => s.tipo === tipo).length;
            if (qtd === 0 && tipo !== 'Ativo') return null;
            return (
              <div key={tipo} className="kpi-card" style={{ borderLeft: `4px solid ${getTipoColor(tipo)}` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: getTipoColor(tipo) }}>{qtd}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{tipo}</div>
              </div>
            )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar situação..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">📋 Tipo: Todos</option>
          {TIPOS_SITUACAO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || filtroTipo !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={limparFiltros}>✕ Limpar</button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Situação' : '➕ Nova Situação'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código *</label>
              <input className="form-input" value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex: APR, REP..." maxLength={6} />
            </div>
            <div>
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Aprovado, Matrícula Trancada..." />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Tipo de Status</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}>
                {TIPOS_SITUACAO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Situação do Cadastro</label>
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

      {/* Tabela */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Código</th>
              <th>Situação / Status</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'center' }}>Ativo</th>
              <th style={{ width: 100 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 800 }}>{s.codigo}</code></td>
                <td style={{ fontWeight: 600, fontSize: 14 }}>{s.nome}</td>
                <td>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${getTipoColor(s.tipo)}22`, color: getTipoColor(s.tipo), fontWeight: 700 }}>{s.tipo}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${s.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{s.situacao === 'ativo' ? 'Sim' : 'Não'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(s)}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
            Nenhuma situação com esses filtros — <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={limparFiltros}>limpar</button>
          </div>
        )}
      </div>
    </div>
  )
}
