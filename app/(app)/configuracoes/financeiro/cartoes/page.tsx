'use client'
import { useData, ConfigCartao, BandeiraCartao, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, CreditCard, Sparkles } from 'lucide-react'

const BANDEIRAS: BandeiraCartao[] = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outro']
const BANDEIRA_COLOR: Record<BandeiraCartao, string> = {
  Visa: '#1a1f71', Mastercard: '#eb001b', Elo: '#f4c400',
  Amex: '#007bc1', Hipercard: '#e11d48', Outro: '#6b7280',
}
const BANDEIRA_ICON: Record<BandeiraCartao, string> = {
  Visa: '🔵', Mastercard: '🔴', Elo: '🟡', Amex: '🔷', Hipercard: '🟣', Outro: '💳',
}

// ── Cartões padrão pré-definidos ──────────────────────────────────────────
const CARTOES_PADRAO: Omit<ConfigCartao, 'id' | 'createdAt'>[] = [
  { codigo: 'CART001', nome: 'Visa Crédito à Vista',        tipo: 'credito', bandeira: 'Visa',       diasCredito: 30, taxaTipo: 'percentual', taxaValor: 2.49, maquineta: 'Cielo',      situacao: 'ativo' },
  { codigo: 'CART002', nome: 'Visa Crédito Parcelado',      tipo: 'credito', bandeira: 'Visa',       diasCredito: 30, taxaTipo: 'percentual', taxaValor: 3.49, maquineta: 'Cielo',      situacao: 'ativo' },
  { codigo: 'CART003', nome: 'Visa Débito',                 tipo: 'debito',  bandeira: 'Visa',       diasCredito: 1,  taxaTipo: 'percentual', taxaValor: 1.49, maquineta: 'Cielo',      situacao: 'ativo' },
  { codigo: 'CART004', nome: 'Mastercard Crédito à Vista',  tipo: 'credito', bandeira: 'Mastercard', diasCredito: 30, taxaTipo: 'percentual', taxaValor: 2.49, maquineta: 'Stone',      situacao: 'ativo' },
  { codigo: 'CART005', nome: 'Mastercard Crédito Parcelado',tipo: 'credito', bandeira: 'Mastercard', diasCredito: 30, taxaTipo: 'percentual', taxaValor: 3.49, maquineta: 'Stone',      situacao: 'ativo' },
  { codigo: 'CART006', nome: 'Mastercard Débito',           tipo: 'debito',  bandeira: 'Mastercard', diasCredito: 1,  taxaTipo: 'percentual', taxaValor: 1.49, maquineta: 'Stone',      situacao: 'ativo' },
  { codigo: 'CART007', nome: 'Elo Crédito à Vista',         tipo: 'credito', bandeira: 'Elo',        diasCredito: 30, taxaTipo: 'percentual', taxaValor: 2.99, maquineta: 'PagSeguro',  situacao: 'ativo' },
  { codigo: 'CART008', nome: 'Elo Débito',                  tipo: 'debito',  bandeira: 'Elo',        diasCredito: 1,  taxaTipo: 'percentual', taxaValor: 1.69, maquineta: 'PagSeguro',  situacao: 'ativo' },
  { codigo: 'CART009', nome: 'Amex Crédito',                tipo: 'credito', bandeira: 'Amex',       diasCredito: 30, taxaTipo: 'percentual', taxaValor: 3.29, maquineta: 'Getnet',     situacao: 'ativo' },
  { codigo: 'CART010', nome: 'Hipercard Crédito',           tipo: 'credito', bandeira: 'Hipercard',  diasCredito: 30, taxaTipo: 'percentual', taxaValor: 2.99, maquineta: 'Cielo',      situacao: 'ativo' },
]

const BLANK: Omit<ConfigCartao, 'id' | 'createdAt'> = {
  codigo: '', nome: '', tipo: 'credito', bandeira: 'Visa',
  diasCredito: 30, taxaTipo: 'percentual', taxaValor: 2.5, maquineta: '', situacao: 'ativo',
}

export default function CartoesPage() {
  const { cfgCartoes, setCfgCartoes } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const gerarCodCART = (): string => {
    const existentes = cfgCartoes.map(c => (c as any).codigo).filter(Boolean)
    let i = cfgCartoes.length + 1
    let cod = `CART${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `CART${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? ((cfgCartoes.find(c => c.id === editId) as any)?.codigo || '') : gerarCodCART()

  const openNew = () => { setEditId(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (c: ConfigCartao) => {
    setEditId(c.id)
    setForm({ codigo: (c as any).codigo || '', nome: c.nome, tipo: c.tipo, bandeira: c.bandeira, diasCredito: c.diasCredito, taxaTipo: c.taxaTipo, taxaValor: c.taxaValor, maquineta: c.maquineta, situacao: c.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => setCfgCartoes(prev => prev.filter(c => c.id !== id))
  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = editId ? ((cfgCartoes.find(c => c.id === editId) as any)?.codigo || gerarCodCART()) : gerarCodCART()
    if (editId) {
      setCfgCartoes(prev => prev.map(c => c.id === editId ? { ...c, ...form, codigo } : c))
    } else {
      const novo: ConfigCartao = { ...form, codigo, id: newId('CART'), createdAt: new Date().toISOString() }
      setCfgCartoes(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  // Carrega padrões sem duplicar pelo nome
  const carregarPadroes = () => {
    const nomesExistentes = new Set(cfgCartoes.map(c => c.nome.trim().toLowerCase()))
    const codigosExistentes = new Set(cfgCartoes.map(c => (c as any).codigo).filter(Boolean))
    const novos = CARTOES_PADRAO.filter(c => !nomesExistentes.has(c.nome.trim().toLowerCase()))
    if (novos.length === 0) return
    const gerados: ConfigCartao[] = novos.map(c => {
      let codigo = c.codigo
      if (codigosExistentes.has(codigo)) {
        let i = cfgCartoes.length + 1
        codigo = `CART${String(i).padStart(3, '0')}`
        while (codigosExistentes.has(codigo)) { i++; codigo = `CART${String(i).padStart(3, '0')}` }
      }
      codigosExistentes.add(codigo)
      return { ...c, codigo, id: newId('CART'), createdAt: new Date().toISOString() }
    })
    setCfgCartoes(prev => [...prev, ...gerados])
  }

  const credito = cfgCartoes.filter(c => c.tipo === 'credito')
  const debito  = cfgCartoes.filter(c => c.tipo === 'debito')
  const padroesPendentes = CARTOES_PADRAO.filter(p => !cfgCartoes.some(c => c.nome.trim().toLowerCase() === p.nome.trim().toLowerCase())).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cartões</h1>
          <p className="page-subtitle">Formas de pagamento em cartão, bandeiras, taxas e prazos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {padroesPendentes > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={carregarPadroes} style={{ color: '#a78bfa', borderColor: 'rgba(139,92,246,0.3)' }}>
              <Sparkles size={13} style={{ color: '#a78bfa' }} />Carregar padrões ({padroesPendentes})
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Cartão</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgCartoes.length, color: '#3b82f6' },
          { label: 'Crédito', value: credito.length, color: '#8b5cf6' },
          { label: 'Débito', value: debito.length, color: '#10b981' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Banner padrões — só aparece quando está vazio */}
      {cfgCartoes.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, marginBottom: 20 }}>
          <Sparkles size={28} color="#a78bfa" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#a78bfa' }}>Cartões Padrão disponíveis</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
              Carregue os {CARTOES_PADRAO.length} cartões pré-configurados (Visa, Mastercard, Elo, Amex, Hipercard) com taxas de mercado e edite conforme seu contrato.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={carregarPadroes} style={{ flexShrink: 0 }}>
            <Sparkles size={13} />Carregar todos os padrões
          </button>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{editId ? 'Editar Cartão' : 'Novo Cartão'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 12, fontFamily: 'monospace', color: '#8b5cf6', letterSpacing: '0.03em' }}>{codigoPreview}</span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial auto</div>
            </div>
            <div>
              <label className="form-label">Nome / Identificação *</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Visa Crédito à Vista" />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'credito' | 'debito' }))}>
                <option value="credito">💳 Crédito</option>
                <option value="debito">💳 Débito</option>
              </select>
            </div>
            <div>
              <label className="form-label">Bandeira</label>
              <select className="form-input" value={form.bandeira} onChange={e => setForm(p => ({ ...p, bandeira: e.target.value as BandeiraCartao }))}>
                {BANDEIRAS.map(b => <option key={b} value={b}>{BANDEIRA_ICON[b]} {b}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Dias p/ Crédito</label>
              <input className="form-input" type="number" min={0} max={90} value={form.diasCredito}
                onChange={e => setForm(p => ({ ...p, diasCredito: +e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Tipo da Taxa</label>
              <select className="form-input" value={form.taxaTipo} onChange={e => setForm(p => ({ ...p, taxaTipo: e.target.value as 'percentual' | 'fixo' }))}>
                <option value="percentual">% Percentual</option>
                <option value="fixo">R$ Fixo</option>
              </select>
            </div>
            <div>
              <label className="form-label">Taxa {form.taxaTipo === 'percentual' ? '(%)' : '(R$)'}</label>
              <input className="form-input" type="number" step={0.01} min={0} value={form.taxaValor}
                onChange={e => setForm(p => ({ ...p, taxaValor: +e.target.value }))}
                style={{ fontWeight: 800, color: '#f59e0b' }} />
            </div>
            <div>
              <label className="form-label">Maquineta / Adquirente</label>
              <input className="form-input" value={form.maquineta} onChange={e => setForm(p => ({ ...p, maquineta: e.target.value }))} placeholder="Cielo, Stone, PagSeguro..." />
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
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {cfgCartoes.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <CreditCard size={44} style={{ margin: '0 auto 14px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Nenhum cartão cadastrado</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={carregarPadroes}><Sparkles size={14} />Carregar padrões</button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar manualmente</button>
          </div>
        </div>
      ) : (
        <>
          {/* Grupo Crédito */}
          {credito.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💳 Crédito</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.2)' }} />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{credito.length} cartão(ões)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {credito.map(c => <CartaoCard key={c.id} c={c} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
          {/* Grupo Débito */}
          {debito.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💳 Débito</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(16,185,129,0.2)' }} />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{debito.length} cartão(ões)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {debito.map(c => <CartaoCard key={c.id} c={c} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Card individual ────────────────────────────────────────────────────────
function CartaoCard({ c, onEdit, onDelete }: { c: ConfigCartao; onEdit: (c: ConfigCartao) => void; onDelete: (id: string) => void }) {
  const bc = BANDEIRA_COLOR[c.bandeira]
  const icon = BANDEIRA_ICON[c.bandeira]
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden', opacity: c.situacao === 'inativo' ? 0.55 : 1, borderTop: `3px solid ${bc}` }}>
      {/* Watermark bandeira — pointerEvents: none para não bloquear botões */}
      <div style={{ position: 'absolute', right: 14, top: 10, fontSize: 36, opacity: 0.06, userSelect: 'none', pointerEvents: 'none' }}>{icon}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
            {(c as any).codigo && <code style={{ fontSize: 10, fontWeight: 800, color: bc, background: `${bc}12`, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{(c as any).codigo}</code>}
            <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: `${bc}14`, color: bc, fontWeight: 700, border: `1px solid ${bc}28` }}>{icon} {c.bandeira}</span>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.tipo === 'credito' ? 'Crédito' : 'Débito'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(c)}><Edit2 size={12} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => onDelete(c.id)}><Trash2 size={12} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={{ textAlign: 'center', padding: '7px 6px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
            {c.taxaValor}{c.taxaTipo === 'percentual' ? '%' : ''}
          </div>
          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 1 }}>Taxa</div>
        </div>
        <div style={{ textAlign: 'center', padding: '7px 6px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{c.diasCredito}d</div>
          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 1 }}>Prazo</div>
        </div>
        <div style={{ textAlign: 'center', padding: '7px 6px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className={`badge ${c.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9 }}>{c.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}</span>
        </div>
      </div>

      {c.maquineta && <div style={{ marginTop: 10, fontSize: 11, color: 'hsl(var(--text-muted))' }}>🏦 {c.maquineta}</div>}
    </div>
  )
}
