'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useData, FornecedorCad, newId } from '@/lib/dataContext'
import { Plus, Search, Trash2, Pencil, Check, Building2, X, Layers, Upload, Download } from 'lucide-react'
import { CepAddressFields } from '@/components/ui/CepInput'
import * as XLSX from 'xlsx'

const CATEGORIAS = ['Material Didático', 'Tecnologia', 'Limpeza', 'Alimentação', 'Manutenção', 'Serviços Gerais', 'Papelaria', 'Outros']
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const BLANK: Omit<FornecedorCad, 'id' | 'createdAt'> = {
  codigo: '', razaoSocial: '', nomeFantasia: '', cnpj: '', cpf: '', tipo: 'juridico',
  categoria: 'Outros', email: '', telefone: '', celular: '', cep: '', logradouro: '',
  numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP', planoContasId: '',
  banco: '', agencia: '', conta: '', situacao: 'ativo', observacoes: '',
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
  const fileRef = useRef<HTMLInputElement>(null)

  const [categorias, setCategorias] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('edu-fornecedores-categorias')
      return saved ? JSON.parse(saved) : CATEGORIAS
    }
    return CATEGORIAS
  })

  useEffect(() => {
    localStorage.setItem('edu-fornecedores-categorias', JSON.stringify(categorias))
  }, [categorias])

  // Plano de contas modal
  const [modalPlanoSearch, setModalPlanoSearch] = useState('')
  const [showPlanoModal, setShowPlanoModal] = useState(false)
  const planosFiltrados = useMemo(() => {
    const q = modalPlanoSearch.toLowerCase()
    return (cfgPlanoContas || []).filter(p => p.situacao === 'ativo' &&
      (p.descricao?.toLowerCase().includes(q) || ((p as any).codPlano || '').toLowerCase().includes(q)))
  }, [cfgPlanoContas, modalPlanoSearch])

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json<any>(ws)
      
      let randCount = 0
      const novos: FornecedorCad[] = data.map((row: any) => ({
        id: newId('FN'),
        codigo: row.Codigo || row.codigo || `FOR-${Math.floor(Math.random() * 90000) + 10000 + (++randCount)}`,
        razaoSocial: row.RazaoSocial || row['Razão Social'] || row.razaoSocial || '',
        nomeFantasia: row.NomeFantasia || row['Nome Fantasia'] || row.nomeFantasia || '',
        cnpj: row.CNPJ || row.cnpj || '',
        cpf: row.CPF || row.cpf || '',
        tipo: ((row.CNPJ || row.cnpj) ? 'juridico' : 'fisico') as "juridico" | "fisico",
        categoria: row.Categoria || row.categoria || 'Outros',
        email: row.Email || row.email || '',
        telefone: String(row.Telefone || row.telefone || ''),
        celular: String(row.Celular || row.celular || ''),
        cep: String(row.CEP || row.cep || ''),
        logradouro: row.Logradouro || row.logradouro || '',
        numero: String(row.Numero || row.numero || ''),
        complemento: row.Complemento || row.complemento || '',
        bairro: row.Bairro || row.bairro || '',
        cidade: row.Cidade || row.cidade || '',
        uf: row.UF || row.uf || 'SP',
        banco: String(row.Banco || row.banco || ''),
        agencia: String(row.Agencia || row.agencia || ''),
        conta: String(row.Conta || row.conta || ''),
        situacao: 'ativo' as "ativo" | "inativo",
        observacoes: row.Observacoes || row.observacoes || '',
        createdAt: new Date().toISOString(),
      })).filter(f => f.razaoSocial)

      if (novos.length > 0) {
        setFornecedoresCad(prev => [...prev, ...novos])
        alert(`${novos.length} fornecedores importados com sucesso.`)
      } else {
        alert('Nenhum dado válido encontrado no arquivo.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const exportarModelo = () => {
    const headers = [[
      'Razão Social', 'Nome Fantasia', 'CNPJ', 'CPF', 'Categoria',
      'Email', 'Telefone', 'Celular', 'CEP', 'Logradouro', 'Numero',
      'Complemento', 'Bairro', 'Cidade', 'UF', 'Plano de Contas',
      'Banco', 'Agencia', 'Conta', 'Observacoes'
    ]]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(headers)
    
    // Auto-size columns slightly
    ws['!cols'] = headers[0].map(() => ({ wch: 15 }))
    
    XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores')
    XLSX.writeFile(wb, 'modelo_importacao_fornecedores.xlsx')
  }

  const handleDeleteAll = () => {
    if (confirm('Atenção: Você está prestes a excluir TODOS os fornecedores. Essa ação não poderá ser desfeita. Deseja continuar?')) {
      setFornecedoresCad([])
    }
  }

  const gerarCodFor = () => {
    const existentes = (fornecedoresCad || []).map(f => f.codigo).filter(Boolean)
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

  const filtered = useMemo(() => (fornecedoresCad || []).filter(f =>
    (filterSit === 'Todos' || f.situacao === filterSit) &&
    (!search || f.razaoSocial?.toLowerCase().includes(search.toLowerCase()) || f.nomeFantasia?.toLowerCase().includes(search.toLowerCase()) || f.cnpj?.includes(search))
  ), [fornecedoresCad, filterSit, search])

  const openNew = () => { setForm({ ...BLANK, codigo: gerarCodFor() }); setModalPlanoSearch(''); setEditId(null); setShowForm(true); setAbaForm('dados') }
  const openEdit = (f: FornecedorCad) => {
    const { id, createdAt, ...rest } = f
    setModalPlanoSearch('')
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
          <p className="page-subtitle">{(fornecedoresCad || []).length} fornecedores cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportarModelo} title="Baixar Modelo de Planilha"><Download size={13} />Baixar Modelo</button>
          <input type="file" accept=".xlsx, .xls" ref={fileRef} style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} title="Importar XLSX"><Upload size={13} />Importar XLSX</button>
          {(fornecedoresCad || []).length > 0 && <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} title="Excluir Todos"><Trash2 size={13} />Excluir Todos</button>}
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Fornecedor</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: (fornecedoresCad || []).length, color: '#3b82f6', icon: '🏢' },
          { label: 'Ativos', value: (fornecedoresCad || []).filter(f => f.situacao === 'ativo').length, color: '#10b981', icon: '✅' },
          { label: 'Categorias', value: new Set((fornecedoresCad || []).map(f => f.categoria)).size, color: '#8b5cf6', icon: '🗂️' },
          { label: 'Cpntas a Pagar', value: (contasPagar || []).length, color: '#f59e0b', icon: '💸' },
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

      {(fornecedoresCad || []).length === 0 ? (
        <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 14, color: 'hsl(var(--text-muted))' }}>
          <Building2 size={52} style={{ opacity: 0.08, marginBottom: 16 }} /><br />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum fornecedor cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Cadastre fornecedores para vincular às movimentações e contas a pagar.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Cadastrar Fornecedor</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Código</th><th>Razão Social / Fantasia</th><th>CNPJ/CPF</th><th>Categoria</th><th>Plano de Contas</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map(f => {
                const pc = (cfgPlanoContas || []).find(p => p.id === (f as any).planoContasId)
                return (
                <tr key={f.id}>
                  <td>
                    <code style={{ 
                      fontSize: 11, 
                      background: (pc as any)?.grupoConta === 'receitas' ? 'rgba(16,185,129,0.12)' : (pc as any)?.grupoConta === 'despesas' ? 'rgba(239,68,68,0.12)' : 'hsl(var(--bg-overlay))', 
                      color: (pc as any)?.grupoConta === 'receitas' ? '#10b981' : (pc as any)?.grupoConta === 'despesas' ? '#ef4444' : 'inherit', 
                      padding: '1px 6px', 
                      borderRadius: 4 
                    }}>
                      {f.codigo}
                    </code>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.razaoSocial}</div>
                    {f.nomeFantasia && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.nomeFantasia}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{f.tipo === 'juridico' ? f.cnpj : f.cpf}</td>
                  <td><span className="badge badge-primary">{f.categoria}</span></td>
                  <td>
                    <div style={{ fontSize: 12 }}>{pc?.descricao || '—'}</div>
                    {pc && (
                      <div style={{ 
                        fontSize: 11, 
                        color: (pc as any).grupoConta === 'receitas' ? '#10b981' : (pc as any).grupoConta === 'despesas' ? '#ef4444' : 'hsl(var(--text-muted))' 
                      }}>
                        {(pc as any).codPlano}
                      </div>
                    )}
                  </td>
                  <td>{f.situacao === 'ativo' ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-neutral">Inativo</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(f)}><Pencil size={12} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(f.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              )})}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">{form.tipo === 'juridico' ? 'CNPJ' : 'CPF'}</label><input className="form-input" value={form.tipo === 'juridico' ? form.cnpj : form.cpf} onChange={e => set(form.tipo === 'juridico' ? 'cnpj' : 'cpf', maskCnpjCpf(e.target.value, form.tipo))} placeholder={form.tipo === 'juridico' ? '00.000.000/0001-00' : '000.000.000-00'} /></div>
                    {/* Plano de Contas — Modal de seleçao */}
                    <div style={{ position: 'relative' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Layers size={10} />Plano de Contas
                        {(form as any).planoContasId && <button type="button" onClick={() => set('planoContasId', '')} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:0, margin:0, display:'flex' }} title="Remover plano"><X size={10}/></button>}
                      </label>
                      <div
                        className="form-input"
                        style={{ height: 38, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0 12px' }}
                        onClick={() => { setShowPlanoModal(true); setModalPlanoSearch(''); }}
                      >
                        {(() => {
                           const pcSel = (cfgPlanoContas || []).find(p => p.id === (form as any).planoContasId)
                           if (pcSel) {
                             return <span style={{ fontSize: 13, color: 'hsl(var(--text-default))' }}>{`${(pcSel as any).codPlano || ''} — ${pcSel.descricao}`}</span>
                           }
                           return <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Selecionar plano...</span>
                        })()}
                      </div>
                      
                      {showPlanoModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onMouseDown={(e) => e.stopPropagation()}>
                          <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', border: '1px solid hsl(var(--border-subtle))' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span>Selecione o Plano de Contas</span>
                               <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowPlanoModal(false)}><X size={16}/></button>
                            </div>
                            
                            <div style={{ position: 'relative', marginBottom: 16 }}>
                              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                              <input autoFocus className="form-input" placeholder="Buscar por código ou descrição..." style={{ paddingLeft: 34 }} value={modalPlanoSearch} onChange={e => setModalPlanoSearch(e.target.value)} />
                            </div>

                            <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                              {planosFiltrados.length === 0 ? (
                                <div style={{ padding: 30, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhuma conta encontrada.</div>
                              ) : planosFiltrados.map(p => (
                                <div key={p.id}
                                  onMouseDown={() => { set('planoContasId', p.id); setShowPlanoModal(false); }}
                                  style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 12 }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <code style={{ 
                                    fontSize: 11, 
                                    background: (p as any).grupoConta === 'receitas' ? 'rgba(16,185,129,0.12)' : (p as any).grupoConta === 'despesas' ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)', 
                                    color: (p as any).grupoConta === 'receitas' ? '#10b981' : (p as any).grupoConta === 'despesas' ? '#ef4444' : '#60a5fa', 
                                    padding: '2px 6px', 
                                    borderRadius: 4 
                                  }}>{(p as any).codPlano || 'S/C'}</code>
                                  <span style={{ fontWeight: 600 }}>{p.descricao}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Categoria interativa */}
                    <div>
                      <label className="form-label">Categoria</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select className="form-input" style={{ flex: 1, paddingRight: 6 }} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" className="btn btn-secondary btn-icon" style={{ flexShrink: 0 }} onClick={() => {
                          const nova = prompt('Nome da nova categoria:')
                          if (nova?.trim() && !categorias.includes(nova.trim())) {
                            setCategorias(prev => [...prev, nova.trim()])
                            set('categoria', nova.trim())
                          } else if (nova?.trim() && categorias.includes(nova.trim())) {
                            set('categoria', nova.trim())
                          }
                        }} title="Adicionar Categoria"><Plus size={14} /></button>
                      </div>
                    </div>
                    <div><label className="form-label">Situação</label>
                      <select className="form-input" value={form.situacao} onChange={e => set('situacao', e.target.value)}>
                        <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">E-mail</label><input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                    <div><label className="form-label">Telefone</label><input className="form-input" value={form.telefone} onChange={e => set('telefone', e.target.value)} /></div>
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
