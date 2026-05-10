'use client'
import { useData, ConfigGrupoAvaliacao, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, Search, GraduationCap, Settings2 } from 'lucide-react'

const BLANK: Omit<ConfigGrupoAvaliacao, 'id' | 'createdAt'> = {
  codigo: '', descricao: ''
}

export default function GruposAvaliacaoPage() {
  const { cfgGruposAvaliacao, setCfgGruposAvaliacao } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busca, setBusca] = useState('')

  // Gera código sequencial garantindo unicidade restritamente numérica
  const gerarCodigo = (): string => {
    const existentes = cfgGruposAvaliacao.map(t => t.codigo)
    let i = cfgGruposAvaliacao.length + 1
    let cod = String(i)
    while (existentes.includes(cod)) { i++; cod = String(i) }
    return cod
  }
  const codigoPreview = editId ? form.codigo : gerarCodigo()

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (t: ConfigGrupoAvaliacao) => {
    setEditId(t.id)
    setForm({ codigo: t.codigo, descricao: t.descricao })
    setShowForm(true)
  }
  
  const handleDelete = (id: string) => {
    if(confirm('Tem certeza que deseja apagar este grupo de avaliação? O histórico relacionado poderá ser impactado.')) {
      setCfgGruposAvaliacao(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleSave = () => {
    if (!form.descricao.trim()) return
    const codigo = editId ? form.codigo : gerarCodigo()
    if (editId) {
      setCfgGruposAvaliacao(prev => prev.map(t => t.id === editId ? { ...t, ...form, codigo } : t))
    } else {
      const novo: ConfigGrupoAvaliacao = { ...form, codigo, id: newId('GA'), createdAt: new Date().toISOString() }
      setCfgGruposAvaliacao(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const list = cfgGruposAvaliacao.filter(g => g.descricao.toLowerCase().includes(busca.toLowerCase()) || g.codigo.includes(busca))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* --- HEADER ROBUSTO E BLINDADO --- */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            <GraduationCap size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a', margin: 0, lineHeight: 1.2 }}>Grupos de Avaliação</h1>
            <p className="page-subtitle" style={{ color: 'hsl(var(--text-muted))', margin: 0, marginTop: '2px', fontSize: '14px' }}>Gerencie as categorias de notas (Provas, Trabalhos, Lcto. Geral)</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
        {/* Toolbar superior dentro do card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          
          <button onClick={openNew} className="btn btn-primary" style={{ height: '42px', padding: '0 20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(59,130,246,0.25)' }}>
            <Plus size={18} strokeWidth={2.5} /> 
            <span>Novo Registro</span>
          </button>

          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} strokeWidth={2.5} />
            <input 
              type="text" 
              className="form-input"
              style={{ height: '42px', paddingLeft: '38px', borderRadius: '10px' }}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar registro..."
            />
          </div>
        </div>

        {/* --- FORMULÁRIO INLINE NO CARD PRINCIPAL --- */}
        {showForm && (
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '20px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={18} />
              {editId ? 'Editar Grupo de Avaliação' : 'Novo Grupo de Avaliação'}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '20px' }}>
              <div>
                <label className="form-label">Código</label>
                <div style={{ display: 'flex', alignItems: 'center', height: '44px', borderRadius: '10px', border: '1px solid hsl(var(--border-subtle))', background: '#f1f5f9' }}>
                  <span style={{ padding: '0 12px', fontSize: '12px', color: '#64748b', borderRight: '1px solid #e2e8f0', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 700 }}>AUT</span>
                  <span style={{ padding: '0 12px', fontWeight: 800, fontSize: '16px', color: '#3b82f6', letterSpacing: '0.05em' }}>
                    {codigoPreview}
                  </span>
                </div>
              </div>
              <div>
                <label className="form-label">Descrição <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  autoFocus
                  className="form-input"
                  style={{ height: '44px', fontWeight: 600, fontSize: '14px', borderRadius: '10px' }}
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: LANÇAMENTO GERAL DE NOTAS"
                  onKeyDown={e => { if(e.key === 'Enter') handleSave() }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ height: '40px', padding: '0 20px', fontWeight: 700 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} style={{ height: '40px', padding: '0 24px', fontWeight: 700, borderRadius: '8px' }}>
                <Check size={16} />
                {editId ? 'Salvar Edição' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* --- TABELA ROBUSTA DO CARD PRINCIPAL --- */}
        <div className="table-container" style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', width: '120px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição do Grupo</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', width: '120px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                    Nenhum grupo de avaliação encontrado no sistema.
                  </td>
                </tr>
              ) : (
                list.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '20px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {g.codigo}
                      </span>
                    </td>
                    <td style={{ padding: '20px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                      {g.descricao}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => openEdit(g)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(g.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
