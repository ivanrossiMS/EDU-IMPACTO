'use client'
import { useState, useMemo } from 'react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useData } from '@/lib/dataContext'
import {
  Plus, Pencil, Trash2, Check, X, Search, CreditCard,
  Banknote, Smartphone, FileText, RefreshCw, Wallet,
  ArrowLeftRight, Layers, Gift, Repeat2, AlertTriangle
} from 'lucide-react'

// ─── Tipos ─────────────────────────────────────────────────────────
interface MetodoPagamento {
  id: string
  codigo: string
  nome: string
  tipo: 'dinheiro' | 'pix' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'debito_automatico' | 'cheque' | 'transferencia' | 'bolsa' | 'permuta'
  taxaPercentual: number      // taxa cobrada pela operadora (%)
  diasCompensacao: number     // dias para compensar
  situacao: 'ativo' | 'inativo'
  obs: string
  createdAt: string
}

// ─── Config visual por tipo ────────────────────────────────────────
const TIPO_CFG: Record<MetodoPagamento['tipo'], { label: string; icon: React.ReactNode; color: string }> = {
  pix:              { label: 'PIX',               icon: <Smartphone size={14} />,     color: '#10b981' },
  dinheiro:         { label: 'Dinheiro',           icon: <Banknote size={14} />,       color: '#34d399' },
  boleto:           { label: 'Boleto',             icon: <FileText size={14} />,       color: '#f59e0b' },
  cartao_credito:   { label: 'Cartão de Crédito',  icon: <CreditCard size={14} />,     color: '#3b82f6' },
  cartao_debito:    { label: 'Cartão de Débito',   icon: <CreditCard size={14} />,     color: '#6366f1' },
  debito_automatico:{ label: 'Débito Automático',  icon: <Repeat2 size={14} />,        color: '#8b5cf6' },
  cheque:           { label: 'Cheque',             icon: <FileText size={14} />,       color: '#ec4899' },
  transferencia:    { label: 'Transferência',      icon: <ArrowLeftRight size={14} />, color: '#06b6d4' },
  bolsa:            { label: 'Bolsa',              icon: <Gift size={14} />,           color: '#a78bfa' },
  permuta:          { label: 'Permuta',            icon: <RefreshCw size={14} />,      color: '#f97316' },
}

const TIPOS_OPTIONS = Object.entries(TIPO_CFG) as [MetodoPagamento['tipo'], (typeof TIPO_CFG)[MetodoPagamento['tipo']]][]

// Métodos padrão pré-carregados
const DEFAULTS: MetodoPagamento[] = [
  { id: 'MP001', codigo: 'MP001', nome: 'PIX',               tipo: 'pix',              taxaPercentual: 0,   diasCompensacao: 0, situacao: 'ativo', obs: 'Transferência instantânea via Banco Central', createdAt: new Date().toISOString() },
  { id: 'MP002', codigo: 'MP002', nome: 'Dinheiro',          tipo: 'dinheiro',         taxaPercentual: 0,   diasCompensacao: 0, situacao: 'ativo', obs: '', createdAt: new Date().toISOString() },
  { id: 'MP003', codigo: 'MP003', nome: 'Boleto Bancário',   tipo: 'boleto',           taxaPercentual: 0,   diasCompensacao: 2, situacao: 'ativo', obs: 'Compensação em até 2 dias úteis', createdAt: new Date().toISOString() },
  { id: 'MP004', codigo: 'MP004', nome: 'Cartão de Crédito', tipo: 'cartao_credito',   taxaPercentual: 2.5, diasCompensacao: 30, situacao: 'ativo', obs: '', createdAt: new Date().toISOString() },
  { id: 'MP005', codigo: 'MP005', nome: 'Cartão de Débito',  tipo: 'cartao_debito',    taxaPercentual: 1.5, diasCompensacao: 2, situacao: 'ativo', obs: '', createdAt: new Date().toISOString() },
  { id: 'MP006', codigo: 'MP006', nome: 'Débito Automático', tipo: 'debito_automatico',taxaPercentual: 0,   diasCompensacao: 1, situacao: 'ativo', obs: '', createdAt: new Date().toISOString() },
  { id: 'MP007', codigo: 'MP007', nome: 'Cheque',            tipo: 'cheque',           taxaPercentual: 0,   diasCompensacao: 3, situacao: 'ativo', obs: 'Sujeito a compensação bancária', createdAt: new Date().toISOString() },
  { id: 'MP008', codigo: 'MP008', nome: 'Transferência',     tipo: 'transferencia',    taxaPercentual: 0,   diasCompensacao: 1, situacao: 'ativo', obs: 'TED/DOC/Wire', createdAt: new Date().toISOString() },
  { id: 'MP009', codigo: 'MP009', nome: 'Bolsa',             tipo: 'bolsa',            taxaPercentual: 0,   diasCompensacao: 0, situacao: 'ativo', obs: 'Bolsa integral ou parcial', createdAt: new Date().toISOString() },
  { id: 'MP010', codigo: 'MP010', nome: 'Permuta',           tipo: 'permuta',          taxaPercentual: 0,   diasCompensacao: 0, situacao: 'ativo', obs: 'Troca de serviços ou bens', createdAt: new Date().toISOString() },
]

const BLANK: Omit<MetodoPagamento, 'id' | 'codigo' | 'createdAt'> = {
  nome: '', tipo: 'pix', taxaPercentual: 0, diasCompensacao: 0, situacao: 'ativo', obs: ''
}

const genCod = (lista: MetodoPagamento[]) => {
  const existentes = new Set(lista.map(m => m.codigo))
  let i = lista.length + 1
  let cod = `MP${String(i).padStart(3, '0')}`
  while (existentes.has(cod)) { i++; cod = `MP${String(i).padStart(3, '0')}` }
  return cod
}

export default function MetodosPagamentoPage() {
  const { cfgMetodosPagamento, setCfgMetodosPagamento } = useData()
  const metodos = (cfgMetodosPagamento && cfgMetodosPagamento.length > 0) ? cfgMetodosPagamento : DEFAULTS
  const setMetodos = setCfgMetodosPagamento

  const [search, setSearch] = useState('')
  const [filtroSit, setFiltroSit] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<MetodoPagamento['tipo'] | 'todos'>('todos')
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<MetodoPagamento, 'id' | 'codigo' | 'createdAt'>>({ ...BLANK })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const filtered = useMemo(() => metodos.filter(m => {
    const q = search.toLowerCase()
    if (search && !m.nome.toLowerCase().includes(q) && !m.codigo.toLowerCase().includes(q)) return false
    if (filtroSit !== 'todos' && m.situacao !== filtroSit) return false
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
    return true
  }), [metodos, search, filtroSit, filtroTipo])

  const ativos = metodos.filter(m => m.situacao === 'ativo').length

  const openNew = () => { setForm({ ...BLANK }); setEditId(null); setModal('new') }
  const openEdit = (m: MetodoPagamento) => {
    setForm({ nome: m.nome, tipo: m.tipo, taxaPercentual: m.taxaPercentual, diasCompensacao: m.diasCompensacao, situacao: m.situacao, obs: m.obs })
    setEditId(m.id); setModal('edit')
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    if (modal === 'new') {
      const cod = genCod(metodos)
      setMetodos(prev => [...prev, { ...form, id: `MP_${Date.now()}`, codigo: cod, createdAt: new Date().toISOString() }])
    } else if (editId) {
      setMetodos(prev => prev.map(m => m.id === editId ? { ...m, ...form } : m))
    }
    setModal(null); setEditId(null)
  }

  const handleDelete = () => {
    if (confirmId) setMetodos(prev => prev.filter(m => m.id !== confirmId))
    setConfirmId(null)
  }

  const toggleSituacao = (id: string) => {
    setMetodos(prev => prev.map(m => m.id === id ? { ...m, situacao: m.situacao === 'ativo' ? 'inativo' : 'ativo' } : m))
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Métodos de Pagamento</h1>
          <p className="page-subtitle">
            Configure as formas de pagamento aceitas pela instituição •{' '}
            <strong style={{ color: '#10b981' }}>{ativos} ativo{ativos !== 1 ? 's' : ''}</strong> de {metodos.length}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={13} />Novo Método
        </button>
      </div>

      {/* Cards de resumo por tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {TIPOS_OPTIONS.slice(0, 10).map(([tipo, cfg]) => {
          const count = metodos.filter(m => m.tipo === tipo && m.situacao === 'ativo').length
          return (
            <button key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
              style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${filtroTipo === tipo ? cfg.color : 'hsl(var(--border-subtle))'}`, background: filtroTipo === tipo ? `${cfg.color}12` : 'hsl(var(--surface))', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: cfg.color }}>
                {cfg.icon}
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: count > 0 ? cfg.color : 'hsl(var(--text-muted))', fontFamily: 'Outfit,sans-serif' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar método ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-list">
          {(['todos', 'ativo', 'inativo'] as const).map(s => (
            <button key={s} className={`tab-trigger ${filtroSit === s ? 'active' : ''}`} onClick={() => setFiltroSit(s)} style={{ textTransform: 'capitalize' }}>
              {s === 'todos' ? 'Todos' : s === 'ativo' ? '● Ativos' : '○ Inativos'}
            </button>
          ))}
        </div>
        {(search || filtroSit !== 'todos' || filtroTipo !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => { setSearch(''); setFiltroSit('todos'); setFiltroTipo('todos') }}>
            <X size={12} />Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'center' }}>Taxa (%)</th>
              <th style={{ textAlign: 'center' }}>Compensação</th>
              <th>Observações</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                  Nenhum método encontrado
                </td>
              </tr>
            ) : filtered.map(m => {
              const tc = TIPO_CFG[m.tipo]
              return (
                <tr key={m.id} style={{ opacity: m.situacao === 'inativo' ? 0.55 : 1 }}>
                  <td>
                    <code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: tc.color, fontWeight: 700 }}>
                      {m.codigo}
                    </code>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.nome}</div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 8, background: `${tc.color}15`, color: tc.color, fontWeight: 600 }}>
                      {tc.icon}{tc.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {m.taxaPercentual > 0
                      ? <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>{m.taxaPercentual}%</span>
                      : <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>Isento</span>}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 12 }}>
                    {m.diasCompensacao === 0
                      ? <span style={{ color: '#10b981', fontWeight: 700 }}>Imediato</span>
                      : <span>{m.diasCompensacao}d úteis</span>}
                  </td>
                  <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))', maxWidth: 200 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {m.obs || '—'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => toggleSituacao(m.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: m.situacao === 'ativo' ? '#10b981' : '#6b7280', padding: 0 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: m.situacao === 'ativo' ? '#10b981' : 'hsl(var(--border-default))', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: m.situacao === 'ativo' ? 17 : 3, transition: 'left 0.2s' }} />
                      </div>
                      {m.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)} title="Editar">
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(m.id)} title="Excluir">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} de {metodos.length} métodos</span>
          <span>{ativos} ativo{ativos !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ─── Modal Novo/Editar ─── */}
      {(modal === 'new' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(16,185,129,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{modal === 'new' ? 'Novo Método de Pagamento' : 'Editar Método'}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Configurações financeiras</div>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tipo (seleção visual) */}
              <div>
                <label className="form-label">Tipo *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                  {TIPOS_OPTIONS.map(([tipo, cfg]) => (
                    <button key={tipo} type="button" onClick={() => set('tipo', tipo)}
                      style={{ padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.tipo === tipo ? cfg.color : 'hsl(var(--border-subtle))'}`, background: form.tipo === tipo ? `${cfg.color}15` : 'transparent', color: form.tipo === tipo ? cfg.color : 'hsl(var(--text-muted))', fontWeight: 600, fontSize: 9, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>{cfg.icon}</div>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome + Situação */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'flex-end' }}>
                <div>
                  <label className="form-label">Nome do Método *</label>
                  <input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder={`Ex: ${TIPO_CFG[form.tipo].label}`} />
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Ativo</label>
                  <button type="button" onClick={() => set('situacao', form.situacao === 'ativo' ? 'inativo' : 'ativo')}
                    style={{ width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: form.situacao === 'ativo' ? '#10b981' : 'hsl(var(--border-default))', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.situacao === 'ativo' ? 25 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>

              {/* Taxa + Dias */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Taxa Operadora (%)</label>
                  <input type="number" className="form-input" style={{ color: form.taxaPercentual > 0 ? '#f59e0b' : undefined, fontWeight: form.taxaPercentual > 0 ? 700 : undefined }} value={form.taxaPercentual} onChange={e => set('taxaPercentual', +e.target.value)} min={0} max={100} step={0.1} placeholder="0" />
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>0 = isento de taxa</div>
                </div>
                <div>
                  <label className="form-label">Dias para Compensação</label>
                  <input type="number" className="form-input" value={form.diasCompensacao} onChange={e => set('diasCompensacao', +e.target.value)} min={0} max={60} step={1} placeholder="0" />
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>0 = imediato</div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-input" rows={2} value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Informações adicionais sobre este método..." style={{ resize: 'none' }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim()}>
                <Check size={14} />{modal === 'new' ? 'Criar Método' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Delete ─── */}
      {confirmId && (() => {
        const m = metodos.find(x => x.id === confirmId)!
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 380, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
              <div style={{ padding: '14px 24px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid hsl(var(--border-subtle))', fontWeight: 700, color: '#f87171', display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <AlertTriangle size={15} />Excluir Método de Pagamento
              </div>
              <div style={{ padding: '18px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                Excluir <strong style={{ color: 'hsl(var(--text-primary))' }}>{m?.nome}</strong>? Esta ação não pode ser desfeita.
              </div>
              <div style={{ padding: '12px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={13} />Excluir</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
