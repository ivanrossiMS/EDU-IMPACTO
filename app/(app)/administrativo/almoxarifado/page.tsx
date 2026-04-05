'use client'

import { useState } from 'react'
import { Package, Plus, Search, AlertTriangle, ShoppingCart, Download, Pencil, Trash2, X, Save } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId } from '@/lib/dataContext'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface ItemEstoque {
  id: string; codigo?: string; item: string; categoria: string; unidade: string
  quantidade: number; minimo: number; custo_unit: number; fornecedor: string
}
const BLANK: Omit<ItemEstoque, 'id'> = { item: '', categoria: '', unidade: 'Un', quantidade: 0, minimo: 0, custo_unit: 0, fornecedor: '' }

export default function AlmoxarifadoPage() {
  const [estoque, setEstoque] = useLocalStorage<ItemEstoque[]>('edu-almoxarifado', [])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ItemEstoque, 'id'>>(BLANK)
  const [del, setDel] = useState<string | null>(null)

  const filtered = estoque.filter(e =>
    e.item.toLowerCase().includes(search.toLowerCase()) ||
    e.categoria.toLowerCase().includes(search.toLowerCase())
  )
  const emFalta = estoque.filter(e => e.quantidade < e.minimo)
  const totalValor = estoque.reduce((s, e) => s + e.custo_unit * e.quantidade, 0)

  const openAdd = () => { setForm(BLANK); setModal('add') }
  const openEdit = (item: ItemEstoque) => {
    setForm({ item: item.item, categoria: item.categoria, unidade: item.unidade, quantidade: item.quantidade, minimo: item.minimo, custo_unit: item.custo_unit, fornecedor: item.fornecedor })
    setEditing(item.id); setModal('edit')
  }
  const gerarCodEst = () => {
    const existentes = estoque.map(e => (e as any).codigo).filter(Boolean)
    let i = estoque.length + 1
    let cod = `ENT${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `ENT${String(i).padStart(3, '0')}` }
    return cod
  }

  const save = () => {
    if (!form.item.trim()) return
    if (modal === 'add') {
      setEstoque(prev => [...prev, { ...form, codigo: gerarCodEst(), id: newId('EST') }])
    } else if (editing) {
      setEstoque(prev => prev.map(e => e.id === editing ? { ...e, ...form } : e))
    }
    setModal(null); setEditing(null)
  }
  const remove = () => { if (del) { setEstoque(prev => prev.filter(e => e.id !== del)); setDel(null) } }
  const f = (k: keyof Omit<ItemEstoque, 'id'>, v: string | number) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📚 Almoxarifado & Estoque</h1>
          <p className="page-subtitle">{estoque.length} item(s) • {emFalta.length} abaixo do mínimo</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {estoque.length > 0 && <button className="btn btn-secondary btn-sm"><Download size={13} />Relatório</button>}
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Entrada de Material</button>
        </div>
      </div>

      {emFalta.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24', marginBottom: 4 }}>Alerta de Estoque Crítico</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{emFalta.map(e => e.item).join(', ')} — abaixo do nível mínimo.</div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}><ShoppingCart size={12} />Solicitar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total em Estoque', value: `${estoque.length} itens`, color: '#3b82f6', icon: '📦' },
          { label: 'Valor Total', value: formatCurrency(totalValor), color: '#10b981', icon: '💰' },
          { label: 'Itens Críticos', value: emFalta.length, color: '#f59e0b', icon: '⚠️' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar item ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum item no estoque</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Cadastre materiais e insumos para controlar o almoxarifado.</div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Cadastrar Primeiro Item</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Item</th><th>Categoria</th><th>Qtd Atual</th><th>Mínimo</th><th>Status</th><th>Custo Unit.</th><th>Total</th><th>Fornecedor</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const abaixo = e.quantidade < e.minimo
                return (
                  <tr key={e.id}>
                    <td><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '1px 6px', borderRadius: 4 }}>{(e as any).codigo || '—'}</code></td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{e.item}</td>
                    <td><span className="badge badge-neutral">{e.categoria}</span></td>
                    <td style={{ fontWeight: 700, color: abaixo ? '#f87171' : 'hsl(var(--text-primary))' }}>{e.quantidade} {e.unidade}</td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>≥ {e.minimo}</td>
                    <td><span className={`badge ${abaixo ? 'badge-danger' : 'badge-success'}`}>{abaixo ? '⚠ Crítico' : '✓ OK'}</span></td>
                    <td style={{ fontSize: 12 }}>{formatCurrency(e.custo_unit)}</td>
                    <td style={{ fontWeight: 700, color: '#34d399' }}>{formatCurrency(e.custo_unit * e.quantidade)}</td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{e.fornecedor || '—'}</td>
                    <td><div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}><Pencil size={11} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => setDel(e.id)}><Trash2 size={11} /></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-default))' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Entrada de Material' : 'Editar Item'}</div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="form-label">Item *</label><input className="form-input" value={form.item} onChange={e => f('item', e.target.value)} placeholder="Ex: Resma de Papel A4" /></div>
              <div><label className="form-label">Categoria</label><input className="form-input" value={form.categoria} onChange={e => f('categoria', e.target.value)} placeholder="Papelaria, Limpeza..." /></div>
              <div><label className="form-label">Unidade</label><input className="form-input" value={form.unidade} onChange={e => f('unidade', e.target.value)} placeholder="Un, Cx, Pct..." /></div>
              <div><label className="form-label">Quantidade em estoque</label><input className="form-input" type="number" min={0} value={form.quantidade} onChange={e => f('quantidade', Number(e.target.value))} /></div>
              <div><label className="form-label">Quantidade mínima</label><input className="form-input" type="number" min={0} value={form.minimo} onChange={e => f('minimo', Number(e.target.value))} /></div>
              <div><label className="form-label">Custo unitário (R$)</label><input className="form-input" type="number" min={0} step={0.01} value={form.custo_unit} onChange={e => f('custo_unit', Number(e.target.value))} /></div>
              <div><label className="form-label">Fornecedor</label><input className="form-input" value={form.fornecedor} onChange={e => f('fornecedor', e.target.value)} /></div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={13} />{modal === 'add' ? 'Cadastrar' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 420, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir item do estoque?</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
