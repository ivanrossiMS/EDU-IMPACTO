'use client'
import { useData, ConfigEsquemaAvaliacao, ComponenteAvaliacao, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, Star, AlertCircle } from 'lucide-react'

const BLANK: Omit<ConfigEsquemaAvaliacao, 'id' | 'createdAt'> = {
  nome: '', nivelEnsino: 'EF1', tipo: 'bimestral',
  composicao: [{ label: 'Prova', peso: 60 }, { label: 'Trabalho', peso: 30 }, { label: 'Part. em Sala', peso: 10 }],
  mediaMinima: 6, mediaRecuperacao: 5, situacao: 'ativo',
}

const TIPO_OPTS = [
  { v: 'bimestral', l: 'Bimestral (4 períodos)' },
  { v: 'trimestral', l: 'Trimestral (3 períodos)' },
  { v: 'semestral', l: 'Semestral (2 períodos)' },
  { v: 'anual', l: 'Anual (1 período)' },
]

export default function EsquemaAvaliacaoPage() {
  const { cfgEsquemasAvaliacao, setCfgEsquemasAvaliacao, cfgNiveisEnsino } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const totalPesos = form.composicao.reduce((s, c) => s + c.peso, 0)
  const pesosOk = totalPesos === 100

  const openNew = () => { setEditId(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (e: ConfigEsquemaAvaliacao) => {
    setEditId(e.id)
    setForm({ nome: e.nome, nivelEnsino: e.nivelEnsino, tipo: e.tipo, composicao: [...e.composicao], mediaMinima: e.mediaMinima, mediaRecuperacao: e.mediaRecuperacao, situacao: e.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => setCfgEsquemasAvaliacao(prev => prev.filter(e => e.id !== id))

  const setComp = (idx: number, field: keyof ComponenteAvaliacao, val: string | number) => {
    setForm(prev => {
      const comp = [...prev.composicao]
      comp[idx] = { ...comp[idx], [field]: field === 'peso' ? +val : val }
      return { ...prev, composicao: comp }
    })
  }
  const addComp = () => setForm(prev => ({ ...prev, composicao: [...prev.composicao, { label: 'Componente', peso: 0 }] }))
  const removeComp = (i: number) => setForm(prev => ({ ...prev, composicao: prev.composicao.filter((_, idx) => idx !== i) }))

  const handleSave = () => {
    if (!form.nome.trim() || !pesosOk) return
    if (editId) {
      setCfgEsquemasAvaliacao(prev => prev.map(e => e.id === editId ? { ...e, ...form } : e))
    } else {
      const novo: ConfigEsquemaAvaliacao = { ...form, id: newId('EA'), createdAt: new Date().toISOString() }
      setCfgEsquemasAvaliacao(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Esquema de Avaliações</h1>
          <p className="page-subtitle">Defina como as notas são compostas e calculadas por nível de ensino</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Esquema</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: '24px', marginBottom: 20, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>{editId ? 'Editar Esquema' : 'Novo Esquema de Avaliação'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label">Nome do Esquema *</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Padrão EF2 Bimestral" />
            </div>
            <div>
              <label className="form-label">Nível de Ensino</label>
              <select className="form-input" value={form.nivelEnsino} onChange={e => setForm(p => ({ ...p, nivelEnsino: e.target.value }))}>
                {cfgNiveisEnsino.filter(n => n.situacao === 'ativo').map(n => <option key={n.codigo} value={n.codigo}>{n.codigo} — {n.nome}</option>)}
                <option value="TODOS">Todos os níveis</option>
              </select>
            </div>
            <div>
              <label className="form-label">Periodicidade</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as ConfigEsquemaAvaliacao['tipo'] }))}>
                {TIPO_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          </div>

          {/* Composição de notas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Composição da Nota (total deve ser 100%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: pesosOk ? '#34d399' : '#f87171' }}>
                  {pesosOk ? '✓' : '⚠'} Total: {totalPesos}%
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addComp}><Plus size={11} />Componente</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.composicao.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'hsl(var(--bg-overlay))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#60a5fa', flexShrink: 0 }}>{i + 1}</div>
                  <input className="form-input" style={{ flex: 1 }} value={c.label}
                    onChange={e => setComp(i, 'label', e.target.value)} placeholder="Nome do componente" />
                  <div style={{ position: 'relative', width: 110 }}>
                    <input className="form-input" type="number" min={0} max={100} value={c.peso}
                      onChange={e => setComp(i, 'peso', e.target.value)}
                      style={{ paddingRight: 30, fontWeight: 800, color: '#60a5fa' }} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'hsl(var(--text-muted))' }}>%</span>
                  </div>
                  <div style={{ width: 100, height: 6, borderRadius: 3, background: 'hsl(var(--bg-overlay))', overflow: 'hidden' }}>
                    <div style={{ width: `${c.peso}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s' }} />
                  </div>
                  {form.composicao.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => removeComp(i)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!pesosOk && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#f87171' }}>
                <AlertCircle size={12} />A soma dos pesos deve ser exatamente 100%. Faltam {100 - totalPesos}%.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Média Mínima (aprovação)</label>
              <input className="form-input" type="number" step={0.1} min={0} max={10} value={form.mediaMinima}
                onChange={e => setForm(p => ({ ...p, mediaMinima: +e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Média Mín. Recuperação</label>
              <input className="form-input" type="number" step={0.1} min={0} max={10} value={form.mediaRecuperacao}
                onChange={e => setForm(p => ({ ...p, mediaRecuperacao: +e.target.value }))} />
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
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!pesosOk}><Check size={13} />{editId ? 'Salvar' : 'Criar Esquema'}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {cfgEsquemasAvaliacao.length === 0 && !showForm ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Star size={44} style={{ margin: '0 auto 14px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum esquema definido</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Defina como as notas são compostas e quais são as médias mínimas.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar primeiro esquema</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cfgEsquemasAvaliacao.map(e => (
            <div key={e.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{e.nome}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                    {e.nivelEnsino} · {TIPO_OPTS.find(t => t.v === e.tipo)?.l} · Média mín.: {e.mediaMinima} · Recuperação: {e.mediaRecuperacao}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${e.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{e.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}</span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)}><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {e.composicao.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, flex: 1, minWidth: 120 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</div>
                      <div className="progress-bar" style={{ height: 3, marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: `${c.peso}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit, sans-serif' }}>{c.peso}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
