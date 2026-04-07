'use client'
import { useConfigDb } from '@/lib/useConfigDb'
import { ConfigTipoDocumento, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, FileText, Sparkles, Search, Hash } from 'lucide-react'

const TIPOS_PADRAO: Omit<ConfigTipoDocumento, 'id' | 'createdAt'>[] = [
  { codigo: 'TD001', nome: 'Boleto Bancário',          descricao: 'Documento de cobrança bancária gerado para mensalidades e taxas.', categoria: 'receita', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD002', nome: 'Nota Fiscal de Serviço',   descricao: 'NFS-e emitida para prestação de serviços educacionais.', categoria: 'receita', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD003', nome: 'Recibo de Pagamento',      descricao: 'Comprovante de recebimento de valores pelo colégio.', categoria: 'receita', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD004', nome: 'Contrato de Matrícula',    descricao: 'Documento contratual firmado entre a escola e o responsável.', categoria: 'receita', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD005', nome: 'PIX / Transferência',      descricao: 'Comprovante de pagamento via PIX ou transferência bancária.', categoria: 'receita', requerNumeracao: false, situacao: 'ativo' },
  { codigo: 'TD006', nome: 'Cartão de Crédito/Débito', descricao: 'Comprovante de pagamento via maquineta de cartão.', categoria: 'receita', requerNumeracao: false, situacao: 'ativo' },
  { codigo: 'TD007', nome: 'Nota Fiscal de Compra',    descricao: 'NF de fornecedor para registro de despesas e compras.', categoria: 'despesa', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD008', nome: 'Ordem de Pagamento',       descricao: 'Documento interno que autoriza o pagamento a fornecedores.', categoria: 'despesa', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD009', nome: 'Fatura de Serviço',        descricao: 'Cobrança emitida por fornecedores de serviços contratados.', categoria: 'despesa', requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD010', nome: 'Cheque',                   descricao: 'Pagamento ou recebimento via cheque bancário.', categoria: 'ambos',   requerNumeracao: true,  situacao: 'ativo' },
  { codigo: 'TD011', nome: 'Dinheiro / Caixa',         descricao: 'Transação realizada em espécie no caixa da instituição.', categoria: 'ambos',   requerNumeracao: false, situacao: 'ativo' },
  { codigo: 'TD012', nome: 'Estorno / Devolução',      descricao: 'Documento de estorno ou reembolso de valores ao responsável.', categoria: 'ambos',   requerNumeracao: true,  situacao: 'ativo' },
]

const CAT_CONFIG = {
  receita:  { label: 'Receita',  color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)',  icon: '📥' },
  despesa:  { label: 'Despesa',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '📤' },
  ambos:    { label: 'Ambos',    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.3)',  icon: '↔️' },
}

const BLANK: Omit<ConfigTipoDocumento, 'id' | 'createdAt'> = {
  codigo: '', nome: '', descricao: '', categoria: 'receita', requerNumeracao: true, situacao: 'ativo',
}

export default function TipoDocumentosPage() {
  const { data: cfgTiposDocumento, setData: setCfgTiposDocumento, loading } = useConfigDb<ConfigTipoDocumento>('cfgTiposDocumento')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCateg, setFiltroCateg] = useState<'todos' | 'receita' | 'despesa' | 'ambos'>('todos')
  const [filtroSit, setFiltroSit] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const sf = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const gerarCod = (): string => {
    const existentes = new Set(cfgTiposDocumento.map(t => (t as any).codigo).filter(Boolean))
    let i = cfgTiposDocumento.length + 1
    let cod = `TD${String(i).padStart(3, '0')}`
    while (existentes.has(cod)) { i++; cod = `TD${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? ((cfgTiposDocumento.find(t => t.id === editId) as any)?.codigo || '') : gerarCod()

  const openNew = () => { setEditId(null); setForm(BLANK); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const openEdit = (t: ConfigTipoDocumento) => {
    setEditId(t.id)
    setForm({ codigo: (t as any).codigo || '', nome: t.nome, descricao: t.descricao, categoria: t.categoria, requerNumeracao: t.requerNumeracao, situacao: t.situacao })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleDelete = (id: string) => {
    if (!confirm('Excluir este tipo de documento?')) return
    setCfgTiposDocumento(prev => prev.filter(t => t.id !== id))
  }
  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = editId ? ((cfgTiposDocumento.find(t => t.id === editId) as any)?.codigo || gerarCod()) : gerarCod()
    if (editId) {
      setCfgTiposDocumento(prev => prev.map(t => t.id === editId ? { ...t, ...form, codigo } : t))
    } else {
      setCfgTiposDocumento(prev => [...prev, { ...form, codigo, id: newId('TD'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  const carregarPadroes = () => {
    const nomesExistentes = new Set(cfgTiposDocumento.map(t => t.nome.trim().toLowerCase()))
    const codigosExistentes = new Set(cfgTiposDocumento.map(t => (t as any).codigo).filter(Boolean))
    const novos = TIPOS_PADRAO.filter(t => !nomesExistentes.has(t.nome.trim().toLowerCase()))
    if (novos.length === 0) { alert('Todos os tipos padrão já estão cadastrados.'); return }
    const gerados = novos.map(t => {
      let codigo = t.codigo
      if (codigosExistentes.has(codigo)) {
        let i = cfgTiposDocumento.length + 1
        codigo = `TD${String(i).padStart(3, '0')}`
        while (codigosExistentes.has(codigo)) { i++; codigo = `TD${String(i).padStart(3, '0')}` }
      }
      codigosExistentes.add(codigo)
      return { ...t, codigo, id: newId('TD'), createdAt: new Date().toISOString() } as ConfigTipoDocumento
    })
    setCfgTiposDocumento(prev => [...prev, ...gerados])
  }

  const padroesPendentes = TIPOS_PADRAO.filter(p => !cfgTiposDocumento.some(t => t.nome.trim().toLowerCase() === p.nome.trim().toLowerCase())).length

  const filtered = useMemo(() => {
    let list = cfgTiposDocumento
    if (filtroCateg !== 'todos') list = list.filter(t => t.categoria === filtroCateg)
    if (filtroSit !== 'todos') list = list.filter(t => t.situacao === filtroSit)
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(t => t.nome.toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q) || (t as any).codigo?.toLowerCase().includes(q))
    }
    return list
  }, [cfgTiposDocumento, filtroCateg, filtroSit, busca])

  const porCategoria = (cat: keyof typeof CAT_CONFIG) => cfgTiposDocumento.filter(t => t.categoria === cat)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tipos de Documentos</h1>
          <p className="page-subtitle">Classifique os documentos financeiros utilizados em receitas e despesas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {padroesPendentes > 0 && !loading && (
            <button className="btn btn-secondary btn-sm" onClick={carregarPadroes} style={{ color: '#a78bfa', borderColor: 'rgba(139,92,246,0.3)' }}>
              <Sparkles size={13} style={{ color: '#a78bfa' }} />Carregar padrões ({padroesPendentes})
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openNew} disabled={loading}><Plus size={13} />Novo Tipo</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',   value: loading ? '…' : cfgTiposDocumento.length,       color: '#3b82f6', icon: '📄' },
          { label: 'Receita', value: loading ? '…' : porCategoria('receita').length,  color: '#10b981', icon: '📥' },
          { label: 'Despesa', value: loading ? '…' : porCategoria('despesa').length,  color: '#ef4444', icon: '📤' },
          { label: 'Ambos',   value: loading ? '…' : porCategoria('ambos').length,    color: '#60a5fa', icon: '↔️' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ borderLeft: `4px solid ${k.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
            </div>
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

      {/* Banner padrões */}
      {!loading && cfgTiposDocumento.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, marginBottom: 20 }}>
          <Sparkles size={28} color="#a78bfa" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#a78bfa' }}>Tipos de Documentos Padrão disponíveis</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
              Carregue os {TIPOS_PADRAO.length} tipos pré-configurados (Boleto, NFS-e, Recibo, PIX, Cartão, etc.) e edite conforme a realidade da escola.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={carregarPadroes} style={{ flexShrink: 0 }}>
            <Sparkles size={13} />Carregar todos
          </button>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="card" style={{ padding: '22px', marginBottom: 18, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>{editId ? 'Editar Tipo de Documento' : 'Novo Tipo de Documento'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 2fr 3fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 12, fontFamily: 'monospace', color: '#60a5fa', letterSpacing: '0.03em' }}>{codigoPreview}</span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial auto</div>
            </div>
            <div>
              <label className="form-label">Nome do Documento *</label>
              <input className="form-input" value={form.nome} onChange={e => sf('nome', e.target.value)} placeholder="Ex: Boleto Bancário" />
            </div>
            <div>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={form.descricao} onChange={e => sf('descricao', e.target.value)} placeholder="Descreva o uso deste tipo de documento" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label">Categoria / Contexto de Uso</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(Object.entries(CAT_CONFIG) as [typeof form.categoria, typeof CAT_CONFIG[keyof typeof CAT_CONFIG]][]).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => sf('categoria', key)}
                    style={{ padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center', border: `1px solid ${form.categoria === key ? cfg.color : 'hsl(var(--border-subtle))'}`, background: form.categoria === key ? cfg.bg : 'transparent', color: form.categoria === key ? cfg.color : 'hsl(var(--text-muted))', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>{cfg.icon}</div>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Requer Nº Doc.</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => sf('requerNumeracao', true)} className={`btn btn-sm ${form.requerNumeracao ? 'btn-primary' : 'btn-secondary'}`}><Hash size={11} />Sim</button>
                <button type="button" onClick={() => sf('requerNumeracao', false)} className={`btn btn-sm ${!form.requerNumeracao ? 'btn-primary' : 'btn-secondary'}`}>—Não</button>
              </div>
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => sf('situacao', e.target.value as 'ativo' | 'inativo')}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.nome.trim()}><Check size={13} />{editId ? 'Salvar Alterações' : 'Cadastrar'}</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      {!loading && cfgTiposDocumento.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Buscar nome, código ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroCateg} onChange={e => setFiltroCateg(e.target.value as typeof filtroCateg)}>
            <option value="todos">Todas as categorias</option>
            <option value="receita">📥 Receita</option>
            <option value="despesa">📤 Despesa</option>
            <option value="ambos">↔️ Ambos</option>
          </select>
          <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroSit} onChange={e => setFiltroSit(e.target.value as typeof filtroSit)}>
            <option value="todos">Todos os status</option>
            <option value="ativo">✓ Ativos</option>
            <option value="inativo">✗ Inativos</option>
          </select>
          {(busca || filtroCateg !== 'todos' || filtroSit !== 'todos') && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={() => { setBusca(''); setFiltroCateg('todos'); setFiltroSit('todos') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))' }}>{filtered.length}/{cfgTiposDocumento.length}</span>
        </div>
      )}

      {/* Lista */}
      {!loading && cfgTiposDocumento.length === 0 ? (
        <div className="card" style={{ padding: '52px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nenhum tipo de documento cadastrado</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={carregarPadroes}><Sparkles size={14} />Carregar padrões</button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar manualmente</button>
          </div>
        </div>
      ) : !loading && filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
          Nenhum tipo com esses filtros.
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, display: 'block', margin: '8px auto 0' }} onClick={() => { setBusca(''); setFiltroCateg('todos'); setFiltroSit('todos') }}>✕ Limpar filtros</button>
        </div>
      ) : !loading && (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Código</th>
                  <th>Nome do Documento</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'center', width: 100 }}>Categoria</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Nº Documento</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Situação</th>
                  <th style={{ width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const cfg = CAT_CONFIG[t.categoria]
                  return (
                    <tr key={t.id} style={{ opacity: t.situacao === 'inativo' ? 0.55 : 1 }}>
                      <td>
                        <code style={{ fontSize: 11, fontWeight: 800, color: cfg.color, background: cfg.bg, padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace', border: `1px solid ${cfg.border}` }}>
                          {(t as any).codigo}
                        </code>
                      </td>
                      <td><div style={{ fontWeight: 700, fontSize: 13 }}>{t.nome}</div></td>
                      <td style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {t.requerNumeracao
                          ? <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}><Hash size={10} style={{ display: 'inline', marginRight: 3 }} />Obrigatório</span>
                          : <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>—</span>
                        }
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${t.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                          {t.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(t)}><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            {cfgTiposDocumento.length} tipo(s) cadastrado(s) · <span style={{ color: '#10b981' }}>✓ Dados salvos no banco</span>
          </div>
        </>
      )}
    </div>
  )
}
