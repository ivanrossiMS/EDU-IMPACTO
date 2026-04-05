'use client'

import { useState } from 'react'
import { Package, Plus, Search, Download, Pencil, Trash2, X, Save } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId } from '@/lib/dataContext'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type Estado = 'ótimo' | 'bom' | 'regular' | 'ruim'
interface Item {
  id: string; codigo?: string; descricao: string; categoria: string; quantidade: number
  valor_unit: number; estado: Estado; localizacao: string; aquisicao: string
}
const BLANK: Omit<Item, 'id'> = { descricao: '', categoria: '', quantidade: 1, valor_unit: 0, estado: 'bom', localizacao: '', aquisicao: '' }

export default function PatrimonioPage() {
  const [items, setItems] = useLocalStorage<Item[]>('edu-patrimonio', [])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Item, 'id'>>(BLANK)
  const [del, setDel] = useState<string | null>(null)

  const filtered = items.filter(p =>
    p.descricao.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria.toLowerCase().includes(search.toLowerCase())
  )
  const valorTotal = items.reduce((s, p) => s + p.valor_unit * p.quantidade, 0)

  const openAdd = () => { setForm(BLANK); setModal('add') }
  const openEdit = (item: Item) => { setForm({ descricao: item.descricao, categoria: item.categoria, quantidade: item.quantidade, valor_unit: item.valor_unit, estado: item.estado, localizacao: item.localizacao, aquisicao: item.aquisicao }); setEditing(item.id); setModal('edit') }
  const gerarCodPat = () => {
    const existentes = items.map(p => (p as any).codigo).filter(Boolean)
    let i = items.length + 1
    let cod = `PAT${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `PAT${String(i).padStart(3, '0')}` }
    return cod
  }

  const save = () => {
    if (!form.descricao.trim()) return
    if (modal === 'add') {
      setItems(prev => [...prev, { ...form, codigo: gerarCodPat(), id: newId('PAT') }])
    } else if (editing) {
      setItems(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p))
    }
    setModal(null); setEditing(null)
  }
  const remove = () => { if (del) { setItems(prev => prev.filter(p => p.id !== del)); setDel(null) } }

  const f = (k: keyof Omit<Item, 'id'>, v: string | number) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Patrimônio & Inventário</h1>
          <p className="page-subtitle">{items.length} item(s) cadastrado(s) • Valor total: {formatCurrency(valorTotal)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {items.length > 0 && <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>}
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Novo Item</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Itens Cadastrados', value: items.reduce((s, p) => s + p.quantidade, 0), color: '#3b82f6' },
          { label: 'Valor Total Patrimônio', value: formatCurrency(valorTotal), color: '#10b981' },
          { label: 'Para Manutenção', value: items.filter(p => p.estado === 'regular' || p.estado === 'ruim').length, color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar bem ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum bem patrimonial cadastrado</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Cadastre bens para controlar o inventário da escola.</div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Cadastrar Primeiro Bem</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Bem</th><th>Categoria</th><th>Qtd.</th><th>Valor Unit.</th><th>Valor Total</th><th>Estado</th><th>Localização</th><th>Aquisição</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '1px 6px', borderRadius: 4 }}>{(p as any).codigo || '—'}</code></td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{p.descricao}</td>
                  <td><span className="badge badge-primary">{p.categoria}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.quantidade}</td>
                  <td>{formatCurrency(p.valor_unit)}</td>
                  <td style={{ fontWeight: 700, color: '#34d399' }}>{formatCurrency(p.valor_unit * p.quantidade)}</td>
                  <td><span className={`badge ${p.estado === 'ótimo' ? 'badge-success' : p.estado === 'bom' ? 'badge-primary' : 'badge-warning'}`}>{p.estado}</span></td>
                  <td style={{ fontSize: 12 }}>{p.localizacao || '—'}</td>
                  <td style={{ fontSize: 12 }}>{p.aquisicao || '—'}</td>
                  <td><div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Pencil size={11} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => setDel(p.id)}><Trash2 size={11} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-default))' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Cadastrar Bem' : 'Editar Bem'}</div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Descrição *</label><input className="form-input" value={form.descricao} onChange={e => f('descricao', e.target.value)} /></div>
                <div><label className="form-label">Categoria</label><input className="form-input" value={form.categoria} onChange={e => f('categoria', e.target.value)} placeholder="Ex: Mobiliário" /></div>
                <div><label className="form-label">Quantidade</label><input className="form-input" type="number" min={1} value={form.quantidade} onChange={e => f('quantidade', Number(e.target.value))} /></div>
                <div><label className="form-label">Valor Unitário (R$)</label><input className="form-input" type="number" min={0} step={0.01} value={form.valor_unit} onChange={e => f('valor_unit', Number(e.target.value))} /></div>
                <div><label className="form-label">Estado</label>
                  <select className="form-input" value={form.estado} onChange={e => f('estado', e.target.value as Estado)}>
                    {(['ótimo', 'bom', 'regular', 'ruim'] as Estado[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Localização</label><input className="form-input" value={form.localizacao} onChange={e => f('localizacao', e.target.value)} placeholder="Ex: Sala 10 — 2º andar" /></div>
                <div><label className="form-label">Data de Aquisição</label><input className="form-input" type="date" value={form.aquisicao} onChange={e => f('aquisicao', e.target.value)} /></div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={13} />{modal === 'add' ? 'Cadastrar' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 420, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir bem?</div>
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
