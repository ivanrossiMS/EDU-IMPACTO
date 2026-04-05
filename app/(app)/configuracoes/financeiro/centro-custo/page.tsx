'use client'
import { ConfigCentroCusto, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, Layers, Search } from 'lucide-react'

const BLANK: Omit<ConfigCentroCusto, 'id' | 'createdAt'> = {
  codigo: '', descricao: '', tipo: 'receita', responsavel: '', situacao: 'ativo',
}

export default function CentroCustoPage() {
  const queryClient = useQueryClient()
  
  const { data: cfgCentrosCusto = [], isLoading } = useQuery<ConfigCentroCusto[]>({
    queryKey: ['cfgCentrosCusto'],
    queryFn: async () => {
      const res = await fetch('/api/configuracoes/centro-custo')
      return res.json()
    }
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<ConfigCentroCusto, 'id' | 'createdAt'>) => {
      const res = await fetch('/api/configuracoes/centro-custo', { method: 'POST', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgCentrosCusto'] })
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ConfigCentroCusto> & { id: string }) => {
      const res = await fetch(`/api/configuracoes/centro-custo/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgCentrosCusto'] })
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/configuracoes/centro-custo/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgCentrosCusto'] })
  })

  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  const gerarCodCC = (): string => {
    const existentes = cfgCentrosCusto.map(c => c.codigo)
    let i = cfgCentrosCusto.length + 1
    let cod = `CC${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `CC${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? form.codigo : gerarCodCC()

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (c: ConfigCentroCusto) => {
    setEditId(c.id)
    setForm({ codigo: c.codigo, descricao: c.descricao, tipo: c.tipo, responsavel: c.responsavel, situacao: c.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => {
    if (!confirm('Excluir este centro de custo?')) return
    deleteMutation.mutate(id)
  }
  const handleSave = () => {
    if (!form.descricao.trim()) return
    const codigo = editId ? form.codigo : gerarCodCC()
    if (editId) {
      updateMutation.mutate({ ...form, id: editId, codigo })
    } else {
      addMutation.mutate({ ...form, codigo })
    }
    setShowForm(false)
  }
  const handleToggleSituacao = (id: string) => {
    const c = cfgCentrosCusto.find(x => x.id === id)
    if (c) updateMutation.mutate({ id, situacao: c.situacao === 'ativo' ? 'inativo' : 'ativo' })
  }

  const ativos = cfgCentrosCusto.filter(c => c.situacao === 'ativo').length

  const filtered = cfgCentrosCusto.filter(c => {
    const matchSearch = search.trim().length < 3 || (c.descricao.toLowerCase().includes(search.toLowerCase()) || c.codigo.includes(search.toUpperCase()))
    const matchSit = filtroSituacao === 'todos' || c.situacao === filtroSituacao
    return matchSearch && matchSit
  })

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando centros de custo...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Custo</h1>
          <p className="page-subtitle">Centros para classificação financeira de lançamentos — {cfgCentrosCusto.length} cadastrados</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Centro</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgCentrosCusto.length, color: '#3b82f6' },
          { label: 'Ativos', value: ativos, color: '#10b981' },
          { label: 'Inativos', value: cfgCentrosCusto.length - ativos, color: '#6b7280' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar por código ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-list">
          {(['todos', 'ativo', 'inativo'] as const).map(s => (
            <button key={s} className={`tab-trigger ${filtroSituacao === s ? 'active' : ''}`} onClick={() => setFiltroSituacao(s)}>
              {s === 'todos' ? 'Todos' : s === 'ativo' ? '✓ Ativos' : '✗ Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.03)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>
            {editId ? '✏️ Editar Centro de Custo' : '➕ Novo Centro de Custo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px', gap: 12 }}>
            {/* Código auto-gerado */}
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: '#60a5fa', letterSpacing: '0.03em' }}>{codigoPreview}</span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial auto</div>
            </div>
            <div>
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Receitas de Mensalidades Ensino Fundamental" />
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao}
                onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              <Check size={13} />{editId ? 'Salvar Alterações' : 'Cadastrar Centro'}
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {cfgCentrosCusto.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Layers size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum centro de custo cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Crie centros de custo para categorizar lançamentos financeiros.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Cadastrar primeiro centro</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Código</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'center', width: 120 }}>Situação</th>
                <th style={{ width: 90 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <code style={{ fontSize: 13, background: 'hsl(var(--bg-overlay))', padding: '3px 8px', borderRadius: 5, color: '#60a5fa', fontWeight: 800, letterSpacing: '0.03em' }}>
                      {c.codigo}
                    </code>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{c.descricao}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => handleToggleSituacao(c.id)}
                      className={`badge ${c.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}
                      style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                      title="Clique para alternar">
                      {c.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum resultado para os filtros aplicados
            </div>
          )}
          <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            Exibindo {filtered.length} de {cfgCentrosCusto.length} centro{cfgCentrosCusto.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
