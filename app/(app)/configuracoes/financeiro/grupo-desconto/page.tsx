'use client'
import { useConfigDb } from '@/lib/useConfigDb'
import { ConfigGrupoDesconto, ConfigEvento, newId } from '@/lib/dataContext'
import { useData } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Percent, Search, Sparkles } from 'lucide-react'

const GRUPOS_PADRAO: Omit<ConfigGrupoDesconto, 'id' | 'createdAt'>[] = [
  { codigo: 'GD001', nome: 'Desconto Irmãos (2 filhos)',       descricao: 'Aplicável quando há 2 irmãos matriculados na mesma instituição.', tipo: 'percentual', valor: 10, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD002', nome: 'Desconto Irmãos (3+ filhos)',      descricao: 'Aplicável quando há 3 ou mais irmãos matriculados.', tipo: 'percentual', valor: 15, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD003', nome: 'Desconto Funcionário',             descricao: 'Desconto concedido a filhos de colaboradores da instituição.', tipo: 'percentual', valor: 20, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD004', nome: 'Desconto Bolsista',                descricao: 'Bolsa de estudos parcial para alunos em situação socioeconômica.', tipo: 'percentual', valor: 50, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD005', nome: 'Desconto Pagamento Antecipado',    descricao: 'Desconto para pagamento anual à vista ou antes do vencimento.', tipo: 'percentual', valor: 5,  dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD006', nome: 'Desconto Convênio / Parceria',     descricao: 'Desconto para beneficiários de convênios corporativos.', tipo: 'percentual', valor: 10, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD007', nome: 'Rematrícula Fidelidade',           descricao: 'Desconto concedido a alunos que rematriculam antes do prazo.', tipo: 'percentual', valor: 5,  dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
  { codigo: 'GD008', nome: 'Desconto Social / PROUNI',         descricao: 'Benefício social concedido por política interna de inclusão.', tipo: 'percentual', valor: 100, dataInicio: new Date().toISOString().slice(0,10), dataFim: '', eventoId: '', situacao: 'ativo' },
]

const BLANK: Omit<ConfigGrupoDesconto, 'id' | 'createdAt'> = {
  codigo: '', nome: '', descricao: '', tipo: 'percentual', valor: 10,
  dataInicio: new Date().toISOString().slice(0, 10),
  dataFim: '', eventoId: '', situacao: 'ativo',
}

const fmtValor = (tipo: string, valor: number) => tipo === 'percentual' ? `${valor}%` : `R$ ${valor.toFixed(2)}`

const valorColor = (tipo: string, valor: number) => {
  if (tipo === 'percentual') {
    if (valor >= 80) return '#dc2626'
    if (valor >= 50) return '#ef4444'
    if (valor >= 20) return '#f59e0b'
    return '#10b981'
  }
  return '#3b82f6'
}

const SUGESTOES = ['Desconto Irmãos (2)', 'Desconto Irmãos (3+)', 'Desconto Bolsista', 'Desconto Funcionário', 'Desconto Pagamento Antecipado', 'Desconto Anuidade', 'Desconto Pontualidade']

export default function GrupoDescontoPage() {
  const { data: cfgGruposDesconto, setData: setCfgGruposDesconto, loading } = useConfigDb<ConfigGrupoDesconto>('cfgGruposDesconto')
  const { cfgEventos } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'percentual' | 'fixo'>('todos')
  const [filtroSit, setFiltroSit] = useState<'todos' | 'ativo' | 'inativo' | 'expirado'>('todos')

  const gerarCodGD = (): string => {
    const existentes = cfgGruposDesconto.map(g => (g as any).codigo).filter(Boolean)
    let i = cfgGruposDesconto.length + 1
    let cod = `GD${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `GD${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? (form as any).codigo || '' : gerarCodGD()

  const openNew = () => { setEditId(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (g: ConfigGrupoDesconto) => {
    setEditId(g.id)
    setForm({ codigo: (g as any).codigo || '', nome: g.nome, descricao: g.descricao, tipo: g.tipo, valor: g.valor, dataInicio: g.dataInicio, dataFim: g.dataFim, eventoId: g.eventoId, situacao: g.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => {
    if (!confirm('Excluir este grupo de desconto?')) return
    setCfgGruposDesconto(prev => prev.filter(g => g.id !== id))
  }
  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = editId ? ((form as any).codigo || codigoPreview) : gerarCodGD()
    if (editId) {
      setCfgGruposDesconto(prev => prev.map(g => g.id === editId ? { ...g, ...form, codigo } : g))
    } else {
      const novo: ConfigGrupoDesconto = { ...form, codigo, id: newId('GD'), createdAt: new Date().toISOString() }
      setCfgGruposDesconto(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const carregarPadroes = () => {
    const nomesExistentes = new Set(cfgGruposDesconto.map(g => g.nome.trim().toLowerCase()))
    const codigosExistentes = new Set(cfgGruposDesconto.map(g => (g as any).codigo).filter(Boolean))
    const novos = GRUPOS_PADRAO.filter(g => !nomesExistentes.has(g.nome.trim().toLowerCase()))
    if (novos.length === 0) { alert('Todos os grupos padrão já estão cadastrados.'); return }
    const gerados = novos.map(g => {
      let codigo = g.codigo
      if (codigosExistentes.has(codigo)) {
        let i = cfgGruposDesconto.length + 1
        codigo = `GD${String(i).padStart(3, '0')}`
        while (codigosExistentes.has(codigo)) { i++; codigo = `GD${String(i).padStart(3, '0')}` }
      }
      codigosExistentes.add(codigo)
      return { ...g, codigo, id: newId('GD'), createdAt: new Date().toISOString() } as ConfigGrupoDesconto
    })
    setCfgGruposDesconto(prev => [...prev, ...gerados])
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const ativos    = cfgGruposDesconto.filter(g => g.situacao === 'ativo' && g.dataInicio <= hoje && (!g.dataFim || g.dataFim >= hoje))
  const expirados = cfgGruposDesconto.filter(g => g.dataFim && g.dataFim < hoje)

  const gruposFiltrados = useMemo(() => {
    let list = cfgGruposDesconto
    if (filtroTipo !== 'todos') list = list.filter(g => g.tipo === filtroTipo)
    if (filtroSit === 'ativo')    list = list.filter(g => g.situacao === 'ativo' && g.dataInicio <= hoje && (!g.dataFim || g.dataFim >= hoje))
    else if (filtroSit === 'inativo')  list = list.filter(g => g.situacao === 'inativo')
    else if (filtroSit === 'expirado') list = list.filter(g => g.dataFim && g.dataFim < hoje)
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(g => g.nome.toLowerCase().includes(q) || (g as any).codigo?.toLowerCase().includes(q) || g.descricao?.toLowerCase().includes(q))
    }
    return list
  }, [cfgGruposDesconto, filtroTipo, filtroSit, busca, hoje])

  const padroesPendentes = GRUPOS_PADRAO.filter(g => !cfgGruposDesconto.some(ex => ex.nome.trim().toLowerCase() === g.nome.trim().toLowerCase())).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Grupo de Descontos</h1>
          <p className="page-subtitle">Configure políticas de desconto aplicáveis em mensalidades e eventos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {padroesPendentes > 0 && !loading && (
            <button className="btn btn-secondary btn-sm" onClick={carregarPadroes} style={{ gap: 6, color: '#a78bfa', borderColor: 'rgba(139,92,246,0.3)' }}>
              <Sparkles size={13} style={{ color: '#a78bfa' }} />Carregar padrões ({padroesPendentes})
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openNew} disabled={loading}><Plus size={13} />Novo Grupo</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: loading ? '…' : cfgGruposDesconto.length, color: '#3b82f6' },
          { label: 'Ativos agora', value: loading ? '…' : ativos.length, color: '#10b981' },
          { label: 'Expirados', value: loading ? '…' : expirados.length, color: '#6b7280' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
          ↻ Carregando do banco de dados…
        </div>
      )}

      {/* Banner padrões disponíveis */}
      {!loading && cfgGruposDesconto.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, marginBottom: 20 }}>
          <Sparkles size={28} color="#a78bfa" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#a78bfa' }}>Grupos de Desconto Padrão disponíveis</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
              Carregue os {GRUPOS_PADRAO.length} grupos pré-configurados (Irmãos, Funcionário, Bolsista, etc.) e edite conforme necessário.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={carregarPadroes} style={{ flexShrink: 0 }}>
            <Sparkles size={13} />Carregar todos os padrões
          </button>
        </div>
      )}

      {/* Filtros */}
      {!loading && cfgGruposDesconto.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center', padding:'10px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft:28, fontSize:12 }} placeholder="Buscar por nome, código ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}>
            <option value="todos">% Todos os tipos</option>
            <option value="percentual">% Percentual</option>
            <option value="fixo">R$ Valor Fixo</option>
          </select>
          <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroSit} onChange={e => setFiltroSit(e.target.value as typeof filtroSit)}>
            <option value="todos">Todos os status</option>
            <option value="ativo">✓ Vigentes</option>
            <option value="inativo">✗ Inativos</option>
            <option value="expirado">⏱ Expirados</option>
          </select>
          {(busca || filtroTipo !== 'todos' || filtroSit !== 'todos') && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#f87171' }} onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroSit('todos') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft:'auto', fontSize:11, color:'hsl(var(--text-muted))' }}>{gruposFiltrados.length}/{cfgGruposDesconto.length}</span>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{editId ? 'Editar Grupo de Desconto' : 'Novo Grupo de Desconto'}</div>
          {!editId && (
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Sugestões rápidas</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUGESTOES.map(s => <button key={s} type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setForm(p => ({ ...p, nome: s }))}>{s}</button>)}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 2fr 3fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: '#34d399', letterSpacing: '0.03em' }}>{codigoPreview}</span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial auto</div>
            </div>
            <div>
              <label className="form-label">Nome do Grupo *</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Desconto Irmãos" />
            </div>
            <div>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Aplicável quando há 2 ou mais irmãos matriculados" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'percentual' | 'fixo' }))}>
                <option value="percentual">% Percentual</option>
                <option value="fixo">R$ Valor Fixo</option>
              </select>
            </div>
            <div>
              <label className="form-label">Valor ({form.tipo === 'percentual' ? '%' : 'R$'})</label>
              <input className="form-input" type="number" step={0.01} min={0} value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: +e.target.value }))}
                style={{ fontWeight: 800, color: '#34d399' }} />
            </div>
            <div>
              <label className="form-label">Data Início</label>
              <input className="form-input" type="date" value={form.dataInicio} onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Data Fim (opcional)</label>
              <input className="form-input" type="date" value={form.dataFim} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          {cfgEventos.filter(e => e.tipo === 'receita').length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label className="form-label">Evento financeiro vinculado (opcional)</label>
              <select className="form-input" value={form.eventoId} onChange={e => setForm(p => ({ ...p, eventoId: e.target.value }))}>
                <option value="">Qualquer evento</option>
                {cfgEventos.filter(e => e.tipo === 'receita').map(e => <option key={e.id} value={e.id}>{e.codigo} — {e.descricao}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      )}

      {/* Lista ou estado vazio */}
      {!loading && cfgGruposDesconto.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Percent size={44} style={{ margin: '0 auto 14px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum grupo de desconto cadastrado</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={carregarPadroes}><Sparkles size={14} />Carregar padrões</button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar manualmente</button>
          </div>
        </div>
      ) : !loading && gruposFiltrados.length === 0 ? (
        <div style={{ padding:'32px', textAlign:'center', color:'hsl(var(--text-muted))', fontSize:13 }}>
          Nenhum grupo com esses filtros.
          <button className="btn btn-ghost btn-sm" style={{ marginTop:8 }} onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroSit('todos') }}>✕ Limpar filtros</button>
        </div>
      ) : !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {gruposFiltrados.map(g => {
              const isAtivo = g.situacao === 'ativo' && g.dataInicio <= hoje && (!g.dataFim || g.dataFim >= hoje)
              const isExp   = g.dataFim && g.dataFim < hoje
              const cor     = isAtivo ? '#10b981' : isExp ? '#6b7280' : '#f59e0b'
              const vcor    = valorColor(g.tipo, g.valor)
              const ev      = cfgEventos.find(e => e.id === g.eventoId)
              return (
                <div key={g.id} className="card" style={{ padding: '20px', borderTop: `3px solid ${vcor}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: 12, top: 12, fontSize: 42, fontWeight: 900, color: `${vcor}08`, fontFamily: 'Outfit, sans-serif', userSelect: 'none', lineHeight: 1, pointerEvents: 'none' }}>
                    {fmtValor(g.tipo, g.valor)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        {(g as any).codigo && <code style={{ fontSize: 10, fontWeight: 800, color: vcor, background: `${vcor}12`, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{(g as any).codigo}</code>}
                        <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</div>
                      </div>
                      {g.descricao && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>{g.descricao}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(g)}><Edit2 size={12} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(g.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ padding: '8px 16px', borderRadius: 10, background: `${vcor}12`, border: `1px solid ${vcor}25`, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 26, fontWeight: 900, color: vcor, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{fmtValor(g.tipo, g.valor)}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{g.tipo === 'percentual' ? 'Percentual' : 'Valor fixo'}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Vigência</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {g.dataInicio}
                        {g.dataFim ? <> → <span style={{ color: isExp ? '#6b7280' : 'inherit' }}>{g.dataFim}</span></> : <span style={{ color: '#10b981' }}> (sem fim)</span>}
                      </div>
                      {ev && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>🔗 {ev.descricao}</div>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: `${cor}18`, color: cor, fontWeight: 700, border: `1px solid ${cor}30` }}>
                    {isAtivo ? '✓ Vigente' : isExp ? '✗ Expirado' : g.situacao === 'inativo' ? '✗ Inativo' : '⏳ Aguardando início'}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            {cfgGruposDesconto.length} grupo(s) cadastrado(s) · <span style={{ color: '#10b981' }}>✓ Dados salvos no banco</span>
          </div>
        </>
      )}
    </div>
  )
}
