'use client'
import { useState, useMemo } from 'react'
import { useData, FornecedorCad, newId } from '@/lib/dataContext'
import { Plus, Search, Trash2, Pencil, Check, Building2, X, Layers } from 'lucide-react'
import { CepAddressFields } from '@/components/ui/CepInput'

const CATEGORIAS = ['Material Didático', 'Tecnologia', 'Limpeza', 'Alimentação', 'Manutenção', 'Serviços Gerais', 'Papelaria', 'Outros']
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const BLANK: Omit<FornecedorCad, 'id' | 'createdAt'> & { planoContasId?: string } = {
  codigo: '', razaoSocial: '', nomeFantasia: '', cnpj: '', cpf: '', tipo: 'juridico',
  categoria: 'Outros', email: '', telefone: '', celular: '', cep: '', logradouro: '',
  numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP', contato: '',
  banco: '', agencia: '', conta: '', situacao: 'ativo', observacoes: '',
  planoContasId: '',
}

export default function FornecedoresPage() {
  const { fornecedoresCad, setFornecedoresCad, contasPagar, cfgPlanoContas } = useData()
  const [search, setSearch] = useState('')
  const [filterSit, setFilterSit] = useState('Todos')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof BLANK>(BLANK)
  const [abaForm, setAbaForm] = useState<'dados' | 'banco' | 'obs'>('dados')

  // Plano de contas typeahead
  const [planoSearch, setPlanoSearch] = useState('')
  const [showPlanoDrop, setShowPlanoDrop] = useState(false)
  const planosFiltrados = useMemo(() => {
    const q = planoSearch.toLowerCase()
    return cfgPlanoContas.filter(p => p.situacao === 'ativo' &&
      (p.descricao.toLowerCase().includes(q) || ((p as any).codPlano || '').toLowerCase().includes(q))).slice(0, 8)
  }, [cfgPlanoContas, planoSearch])

  const gerarCodFor = () => {
    const existentes = fornecedoresCad.map(f => f.codigo).filter(Boolean)
    let cod: string
    do { cod = `FOR-${Math.floor(Math.random() * 90000) + 10000}` } while (existentes.includes(cod))
    return cod
  }
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const maskCnpjCpf = (v: string, tipo: string) => {
    v = v.replace(/\D/g, '')
    if (tipo === 'juridico') {
      v = v.replace(/^(\d{2})(\d)/, '$1.$2')
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
      v = v.replace(/(\d{4})(\d)/, '$1-$2')
      return v.slice(0, 18)
    } else {
      v = v.replace(/(\d{3})(\d)/, '$1.$2')
      v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      return v.slice(0, 14)
    }
  }

  const filtered = useMemo(() => fornecedoresCad.filter(f =>
    (filterSit === 'Todos' || f.situacao === filterSit) &&
    (!search || f.razaoSocial.toLowerCase().includes(search.toLowerCase()) || f.nomeFantasia.toLowerCase().includes(search.toLowerCase()) || f.cnpj.includes(search))
  ), [fornecedoresCad, filterSit, search])

  const openNew = () => { setForm({ ...BLANK, codigo: gerarCodFor() }); setPlanoSearch(''); setEditId(null); setShowForm(true); setAbaForm('dados') }
  const openEdit = (f: FornecedorCad) => {
    const { id, createdAt, ...rest } = f
    const pc = cfgPlanoContas.find(p => p.id === (rest as any).planoContasId)
    setPlanoSearch(pc ? `${(pc as any).codPlano || ''} — ${pc.descricao}` : '')
    setForm({ ...rest, planoContasId: (rest as any).planoContasId || '' } as any); setEditId(id); setShowForm(true); setAbaForm('dados')
  }
  const handleSave = () => {
    if (!form.razaoSocial.trim()) return
    if (editId) {
      setFornecedoresCad(prev => prev.map(f => f.id === editId ? { ...form, id: editId, createdAt: f.createdAt } : f))
    } else {
      setFornecedoresCad(prev => [...prev, { ...form, id: newId('FN'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <p className="page-subtitle">{fornecedoresCad.length} fornecedores cadastrados</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Fornecedor</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: fornecedoresCad.length, color: '#3b82f6', icon: '🏢' },
          { label: 'Ativos', value: fornecedoresCad.filter(f => f.situacao === 'ativo').length, color: '#10b981', icon: '✅' },
          { label: 'Categorias', value: new Set(fornecedoresCad.map(f => f.categoria)).size, color: '#8b5cf6', icon: '🗂️' },
          { label: 'Cpntas a Pagar', value: contasPagar.length, color: '#f59e0b', icon: '💸' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar por razão social, CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 130 }} value={filterSit} onChange={e => setFilterSit(e.target.value)}>
            <option value="Todos">Situação</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {fornecedoresCad.length === 0 ? (
        <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 14, color: 'hsl(var(--text-muted))' }}>
          <Building2 size={52} style={{ opacity: 0.08, marginBottom: 16 }} /><br />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum fornecedor cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Cadastre fornecedores para vincular às movimentações e contas a pagar.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Cadastrar Fornecedor</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Código</th><th>Razão Social / Fantasia</th><th>CNPJ/CPF</th><th>Categoria</th><th>Contato</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '1px 6px', borderRadius: 4 }}>{f.codigo}</code></td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.razaoSocial}</div>
                    {f.nomeFantasia && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.nomeFantasia}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{f.tipo === 'juridico' ? f.cnpj : f.cpf}</td>
                  <td><span className="badge badge-primary">{f.categoria}</span></td>
                  <td>
                    <div style={{ fontSize: 12 }}>{f.email || '—'}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.telefone || f.celular}</div>
                  </td>
                  <td>{f.situacao === 'ativo' ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-neutral">Inativo</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(f)}><Pencil size={12} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(f.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 760, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Código: {form.codigo}</div>
            </div>
            <div className="tab-list" style={{ borderRadius: 0 }}>
              {[{ id: 'dados', label: '📋 Dados Gerais' }, { id: 'banco', label: '🏦 Dados Bancários' }, { id: 'obs', label: '📝 Observações' }].map(t => (
                <button key={t.id} className={`tab-trigger ${abaForm === t.id ? 'active' : ''}`} onClick={() => setAbaForm(t.id as typeof abaForm)}>{t.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {abaForm === 'dados' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">Tipo</label>
                      <select className="form-input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                        <option value="juridico">Jurídico (CNPJ)</option>
                        <option value="fisico">Físico (CPF)</option>
                      </select>
                    </div>
                    <div><label className="form-label">Razão Social / Nome *</label><input className="form-input" value={form.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} placeholder="Razão Social" /></div>
                    <div><label className="form-label">Nome Fantasia</label><input className="form-input" value={form.nomeFantasia} onChange={e => set('nomeFantasia', e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">{form.tipo === 'juridico' ? 'CNPJ' : 'CPF'}</label><input className="form-input" value={form.tipo === 'juridico' ? form.cnpj : form.cpf} onChange={e => set(form.tipo === 'juridico' ? 'cnpj' : 'cpf', maskCnpjCpf(e.target.value, form.tipo))} placeholder={form.tipo === 'juridico' ? '00.000.000/0001-00' : '000.000.000-00'} /></div>
                    {/* Plano de Contas — typeahead, substitui Categoria */}
                    <div style={{ position: 'relative' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Layers size={10} />Plano de Contas
                        {(form as any).planoContasId && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                        <input
                          className="form-input"
                          style={{ paddingLeft: 28 }}
                          value={planoSearch}
                          onChange={e => { setPlanoSearch(e.target.value); setShowPlanoDrop(true); if (!e.target.value) set('planoContasId', '') }}
                          onFocus={() => setShowPlanoDrop(true)}
                          onBlur={() => setTimeout(() => setShowPlanoDrop(false), 150)}
                          placeholder="Buscar conta..."
                        />
                        {planoSearch && <button type="button" onClick={() => { setPlanoSearch(''); set('planoContasId', '') }} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={11} /></button>}
                      </div>
                      {showPlanoDrop && planosFiltrados.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginTop: 4 }}>
                          {planosFiltrados.map(p => (
                            <div key={p.id}
                              onMouseDown={() => { set('planoContasId', p.id); setPlanoSearch(`${(p as any).codPlano || ''} — ${p.descricao}`); setShowPlanoDrop(false) }}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 7 }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <code style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '1px 5px', borderRadius: 3 }}>{(p as any).codPlano || 'S/C'}</code>
                              <span style={{ fontWeight: 600 }}>{p.descricao}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div><label className="form-label">Situação</label>
                      <select className="form-input" value={form.situacao} onChange={e => set('situacao', e.target.value)}>
                        <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">E-mail</label><input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                    <div><label className="form-label">Telefone</label><input className="form-input" value={form.telefone} onChange={e => set('telefone', e.target.value)} /></div>
                    <div><label className="form-label">Contato (nome)</label><input className="form-input" value={form.contato} onChange={e => set('contato', e.target.value)} /></div>
                  </div>
                  <CepAddressFields
                    cep={form.cep}
                    logradouro={form.logradouro}
                    numero={form.numero}
                    complemento={form.complemento}
                    bairro={form.bairro}
                    cidade={form.cidade}
                    estado={form.uf}
                    onChange={(field, value) => {
                      const map: Record<string, string> = {
                        cep: 'cep', logradouro: 'logradouro', numero: 'numero',
                        complemento: 'complemento', bairro: 'bairro',
                        cidade: 'cidade', estado: 'uf',
                      }
                      if (map[field]) set(map[field], value)
                    }}
                  />
                </div>
              )}
              {abaForm === 'banco' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div><label className="form-label">Banco</label><input className="form-input" value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="001 — Banco do Brasil" /></div>
                  <div><label className="form-label">Agência</label><input className="form-input" value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="0001-5" /></div>
                  <div><label className="form-label">Conta Corrente</label><input className="form-input" value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="12345-6" /></div>
                </div>
              )}
              {abaForm === 'obs' && (
                <div>
                  <label className="form-label">Observações internas</label>
                  <textarea className="form-input" style={{ minHeight: 120, resize: 'vertical' }} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Condições comerciais, prazo, histórico..." />
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.razaoSocial.trim()}><Check size={14} />{editId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 380, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', fontWeight: 700, color: '#f87171' }}>Excluir Fornecedor</div>
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>O fornecedor será removido permanentemente. Esta ação não pode ser desfeita.</div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { setFornecedoresCad(prev => prev.filter(f => f.id !== confirmId)); setConfirmId(null) }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
