'use client'
import { useData, ConfigGrupoAluno, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Users2, Search } from 'lucide-react'

const BLANK: Omit<ConfigGrupoAluno, 'id' | 'createdAt'> = {
  codigo: '', nome: '', descricao: '', situacao: 'ativo',
}

export default function GrupoAlunosPage() {
  const { cfgGruposAlunos, setCfgGruposAlunos } = useData()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() =>
    cfgGruposAlunos.filter(g => 
      g.nome.toLowerCase().includes(search.toLowerCase()) || 
      g.codigo.toLowerCase().includes(search.toLowerCase()) ||
      g.descricao.toLowerCase().includes(search.toLowerCase())
    ), [cfgGruposAlunos, search])

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (g: ConfigGrupoAluno) => { setEditId(g.id); setForm({ codigo: g.codigo, nome: g.nome, descricao: g.descricao, situacao: g.situacao }); setShowForm(true) }
  const handleDelete = (id: string) => setCfgGruposAlunos(prev => prev.filter(g => g.id !== id))

  const handleSave = () => {
    if (!form.nome.trim() || !form.codigo.trim()) return
    if (editId) {
      setCfgGruposAlunos(prev => prev.map(g => g.id === editId ? { ...g, ...form } : g))
    } else {
      setCfgGruposAlunos(prev => [...prev, { ...form, id: newId('GPA'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  const handleCarregarPadroes = () => {
    const padroes: ConfigGrupoAluno[] = [
      { id: newId('GA')+'-1', codigo: 'REG', nome: 'Alunos Regulares', descricao: 'Alunos pagantes convencionais.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-2', codigo: 'B100', nome: 'Bolsistas 100%', descricao: 'Turmas/Grupos com isenção integral de mensalidade.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-3', codigo: 'B50', nome: 'Bolsistas 50%', descricao: 'Turmas/Grupos com bolsa parcial de desempenho ou social.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-4', codigo: 'ESP', nome: 'Bolsa Atleta / Esportes', descricao: 'Benefício por produtividade/atuação esportiva.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-5', codigo: 'FUNC', nome: 'Filhos de Funcionários', descricao: 'Isenções ou descontos atrelados à equipe escolar.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-6', codigo: 'IRM', nome: 'Desconto Irmãos', descricao: 'Grupo de fidelização com mais de uma matrícula ativa.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-7', codigo: 'CONV', nome: 'Convênios (Sindicatos/Parceiros)', descricao: 'Alunos atrelados a tabelas fixas B2B.', situacao: 'ativo', createdAt: new Date().toISOString() },
      { id: newId('GA')+'-8', codigo: 'AEE', nome: 'Atendimento Especializado (AEE)', descricao: 'Necessidades especiais e suporte adicional (Laudados).', situacao: 'ativo', createdAt: new Date().toISOString() },
    ]
    setCfgGruposAlunos(padroes)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Grupos de Alunos</h1>
          <p className="page-subtitle">Padrões editáveis para agrupamentos (Bolsistas, Reforço, Esportes, etc.)</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Grupo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{cfgGruposAlunos.length}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Grupos Criados</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{cfgGruposAlunos.filter(g => g.situacao === 'ativo').length}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Grupos Ativos</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input className="form-input" style={{ paddingLeft: 34, maxWidth: 350 }} placeholder="Buscar grupo por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Grupo' : '➕ Novo Grupo'}</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código *</label>
              <input className="form-input" value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex: REF, ESP, BOLSA..." maxLength={8} />
            </div>
            <div>
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Grupo de Reforço, Time Basquete, Bolsistas..." />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12 }}>
            <div>
              <label className="form-label">Descrição (Opcional)</label>
              <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes sobre o critério do grupo..." />
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />Salvar Padrão</button>
          </div>
        </div>
      )}

      {/* Tabela Modos Padrões */}
      {cfgGruposAlunos.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Users2 size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 8 }}>Nenhum Padrão Escolar Customizado Encontrado</div>
          <div style={{ fontSize: 13, maxWidth: 450, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Aqui o conselho e direção podem criar padrões e etiquetas únicas que definem coletivos de alunos.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar Primeiro Padrão</button>
            <button className="btn btn-secondary" onClick={handleCarregarPadroes} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', fontWeight: 700 }}><Users2 size={14} /> Carregar Sugestões da Direção</button>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Código</th>
                <th>Nome / Padrão</th>
                <th>Descrição / Notas</th>
                <th style={{ textAlign: 'center' }}>Situação</th>
                <th style={{ width: 100 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id}>
                  <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 800 }}>{g.codigo}</code></td>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{g.nome}</td>
                  <td style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>{g.descricao || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${g.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{g.situacao === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(g)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(g.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && search && (
            <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum grupo encontrado com '{search}'.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
