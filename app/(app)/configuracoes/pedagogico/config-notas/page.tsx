'use client'
import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { Check, Plus, Trash2, Pencil, FlaskConical, Calculator } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/CrudModal'

interface FormulaComponente {
  id: string; nome: string; peso: number; tipo: 'prova' | 'trabalho' | 'simulado' | 'participacao' | 'outro'
}

interface ConfigNota {
  id: string; nome: string; segmento: string; notaMinimaAprovacao: number; notaMaxima: number
  arredondamento: 'nenhum' | 'inteiro' | 'meio' | '0.1' | '0.5'
  casasDecimais: number; conceitual: boolean
  formula: FormulaComponente[]; situacao: 'ativo' | 'inativo'
}

const SEGMENTOS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const ARREDONDAMENTOS = [
  { value: 'nenhum', label: 'Sem arredondamento' },
  { value: '0.1',    label: 'Uma decimal (0.1)' },
  { value: 'meio',   label: 'Arredondar para 0.5' },
  { value: 'inteiro',label: 'Inteiro mais próximo' },
  { value: '0.5',    label: 'Sempre para cima (0.5)' },
]
const COMP_TIPOS = ['prova', 'trabalho', 'simulado', 'participacao', 'outro'] as const

function calcFormulaPreview(formula: FormulaComponente[], notaMaxima: number, arredondamento: string): string {
  const total = formula.reduce((s, c) => s + c.peso, 0)
  if (total === 0 || formula.length === 0) return '—'
  const expr = formula.map(c => `(${c.nome} × ${((c.peso / total) * 100).toFixed(1)}%)`).join(' + ')
  return `Média = ${expr}`
}

function applyRound(v: number, rule: string): number {
  if (rule === 'nenhum') return v
  if (rule === 'inteiro') return Math.round(v)
  if (rule === 'meio') return Math.round(v * 2) / 2
  if (rule === '0.1') return Math.round(v * 10) / 10
  if (rule === '0.5') return Math.ceil(v * 2) / 2
  return v
}

export default function ConfigNotasPage() {
  const { cfgEsquemasAvaliacao } = useData()
  const [configs, setConfigs] = useState<ConfigNota[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [simNota, setSimNota] = useState<Record<string, string>>({})

  const BLANK: Omit<ConfigNota, 'id'> = {
    nome: '', segmento: 'EF1', notaMinimaAprovacao: 5, notaMaxima: 10,
    arredondamento: 'nenhum', casasDecimais: 2, conceitual: false,
    formula: [], situacao: 'ativo',
  }
  const [form, setForm] = useState<Omit<ConfigNota, 'id'>>(BLANK)
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const mediaSimulada = useMemo(() => {
    if (form.formula.length === 0) return null
    const total = form.formula.reduce((s, c) => s + c.peso, 0)
    if (total === 0) return null
    let soma = 0; let valid = true
    for (const c of form.formula) {
      const v = parseFloat(simNota[c.id] ?? '')
      if (isNaN(v)) { valid = false; break }
      soma += (v * c.peso) / total
    }
    return valid ? applyRound(soma, form.arredondamento) : null
  }, [form.formula, simNota, form.arredondamento])

  const openNew = () => { setForm(BLANK); setEditId(null); setSimNota({}); setShowForm(true) }
  const openEdit = (c: ConfigNota) => { const { id, ...rest } = c; setForm(rest); setEditId(id); setSimNota({}); setShowForm(true) }

  const handleSave = () => {
    if (!form.nome.trim()) return
    if (editId) {
      setConfigs(prev => prev.map(c => c.id === editId ? { ...form, id: editId } : c))
    } else {
      setConfigs(prev => [...prev, { ...form, id: `CN${Date.now()}` }])
    }
    setShowForm(false)
  }

  const addComp = () => setForm(p => ({ ...p, formula: [...p.formula, { id: `C${Date.now()}`, nome: 'Prova', peso: 1, tipo: 'prova' }] }))
  const upComp = (id: string, k: string, v: unknown) => setForm(p => ({ ...p, formula: p.formula.map(c => c.id === id ? { ...c, [k]: v } : c) }))
  const delComp = (id: string) => { setForm(p => ({ ...p, formula: p.formula.filter(c => c.id !== id) })); setSimNota(p => { const n = { ...p }; delete n[id]; return n }) }

  const aprovacaoPct = (config: ConfigNota) => (config.notaMinimaAprovacao / config.notaMaxima * 100).toFixed(0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuração de Notas</h1>
          <p className="page-subtitle">Arredondamento, fórmulas de média e critérios de aprovação por segmento</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Config.</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Configs Ativas', value: configs.filter(c => c.situacao === 'ativo').length, color: '#10b981', icon: '✅' },
          { label: 'Segmentos Cobertos', value: new Set(configs.map(c => c.segmento)).size, color: '#3b82f6', icon: '🎓' },
          { label: 'Esquemas existentes', value: cfgEsquemasAvaliacao?.length ?? 0, color: '#8b5cf6', icon: '📋' },
          { label: 'Total Configs', value: configs.length, color: '#f59e0b', icon: '⚙️' },
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

      {configs.length === 0 && !showForm ? (
        <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 14, color: 'hsl(var(--text-muted))' }}>
          <FlaskConical size={48} style={{ opacity: 0.1, marginBottom: 16 }} /><br />
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nenhuma configuração de nota criada</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Configure fórmulas de média, arredondamentos e critérios de aprovação por segmento.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}><Plus size={14} />Criar Primeira Configuração</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {configs.map(c => (
            <div key={c.id} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{c.nome}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span className="badge badge-primary">{c.segmento}</span>
                    {c.situacao === 'ativo' ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-neutral">Inativo</span>}
                    {c.conceitual && <span className="badge badge-neutral">Conceitual</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Pencil size={12} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(c.id)}><Trash2 size={12} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, marginBottom: 10 }}>
                <div><div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Nota Máx.</div><div style={{ fontWeight: 700, fontSize: 14 }}>{c.notaMaxima}</div></div>
                <div><div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Mínima Aprovação</div><div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>{c.notaMinimaAprovacao} ({aprovacaoPct(c)}%)</div></div>
                <div><div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Arredondamento</div><div style={{ fontWeight: 700, fontSize: 12 }}>{ARREDONDAMENTOS.find(a => a.value === c.arredondamento)?.label ?? '—'}</div></div>
              </div>
              {c.formula.length > 0 && (
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontFamily: 'monospace', background: 'hsl(var(--bg-elevated))', padding: '8px 10px', borderRadius: 6 }}>
                  {calcFormulaPreview(c.formula, c.notaMaxima, c.arredondamento)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 760, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', fontWeight: 800, fontSize: 16 }}>
              {editId ? 'Editar Configuração' : 'Nova Configuração de Notas'}
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Média EF1 2026" /></div>
                <div><label className="form-label">Segmento</label>
                  <select className="form-input" value={form.segmento} onChange={e => set('segmento', e.target.value)}>
                    {SEGMENTOS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Situação</label>
                  <select className="form-input" value={form.situacao} onChange={e => set('situacao', e.target.value)}>
                    <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
                <div><label className="form-label">Nota Máxima</label><input type="number" className="form-input" value={form.notaMaxima} onChange={e => set('notaMaxima', +e.target.value)} min={1} /></div>
                <div><label className="form-label">Mínima Aprovação</label><input type="number" className="form-input" value={form.notaMinimaAprovacao} onChange={e => set('notaMinimaAprovacao', +e.target.value)} min={0} /></div>
                <div><label className="form-label">Casas Decimais</label><input type="number" className="form-input" value={form.casasDecimais} onChange={e => set('casasDecimais', +e.target.value)} min={0} max={4} /></div>
                <div><label className="form-label">Escala Conceitual?</label>
                  <select className="form-input" value={form.conceitual ? 'sim' : 'nao'} onChange={e => set('conceitual', e.target.value === 'sim')}>
                    <option value="nao">Não (numérica)</option><option value="sim">Sim (A/B/C/D)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Regra de Arredondamento</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                  {ARREDONDAMENTOS.map(a => (
                    <button key={a.value} onClick={() => set('arredondamento', a.value)}
                      style={{ padding: '10px 8px', borderRadius: 8, border: `2px solid ${form.arredondamento === a.value ? '#3b82f6' : 'hsl(var(--border-subtle))'}`, background: form.arredondamento === a.value ? 'rgba(59,130,246,0.1)' : 'transparent', color: form.arredondamento === a.value ? '#60a5fa' : 'hsl(var(--text-muted))', fontWeight: form.arredondamento === a.value ? 700 : 400, fontSize: 11, cursor: 'pointer', textAlign: 'center' }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fórmula de média */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Fórmula de Média <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 400 }}>— configure os componentes e seus pesos</span></div>
                  <button className="btn btn-secondary btn-sm" onClick={addComp}><Plus size={13} />Componente</button>
                </div>
                {form.formula.length === 0 ? (
                  <div style={{ padding: '20px', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    Nenhum componente — média simples (todos os lançamentos com peso igual)
                  </div>
                ) : (
                  <div>
                    {form.formula.map(c => (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 32px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                        <input className="form-input" value={c.nome} onChange={e => upComp(c.id, 'nome', e.target.value)} placeholder="Nome do componente" style={{ fontSize: 13 }} />
                        <select className="form-input" value={c.tipo} onChange={e => upComp(c.id, 'tipo', e.target.value)} style={{ fontSize: 12 }}>
                          {COMP_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div style={{ position: 'relative' }}>
                          <input type="number" className="form-input" value={c.peso} onChange={e => upComp(c.id, 'peso', +e.target.value)} min={0.1} step={0.1} placeholder="Peso" />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}>
                            {form.formula.reduce((s, x) => s + x.peso, 0) > 0 ? `${((c.peso / form.formula.reduce((s, x) => s + x.peso, 0)) * 100).toFixed(0)}%` : ''}
                          </span>
                        </div>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => delComp(c.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {/* Preview da fórmula */}
                    <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.07)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', marginBottom: 10 }}>
                      {calcFormulaPreview(form.formula, form.notaMaxima, form.arredondamento)}
                    </div>
                    {/* Simulador */}
                    <div style={{ padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Calculator size={14} />Simulador de Nota</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8, marginBottom: 10 }}>
                        {form.formula.map(c => (
                          <div key={c.id}>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 3 }}>{c.nome}</div>
                            <input type="number" className="form-input" value={simNota[c.id] ?? ''} onChange={e => setSimNota(p => ({ ...p, [c.id]: e.target.value }))} placeholder={`0–${form.notaMaxima}`} min={0} max={form.notaMaxima} step={0.1} style={{ fontSize: 13 }} />
                          </div>
                        ))}
                      </div>
                      {mediaSimulada !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Média calculada:</span>
                          <span style={{ fontSize: 22, fontWeight: 900, color: mediaSimulada >= form.notaMinimaAprovacao ? '#10b981' : '#ef4444', fontFamily: 'Outfit,sans-serif' }}>{mediaSimulada.toFixed(form.casasDecimais)}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: mediaSimulada >= form.notaMinimaAprovacao ? '#10b981' : '#ef4444' }}>
                            {mediaSimulada >= form.notaMinimaAprovacao ? '✅ APROVADO' : '❌ REPROVADO'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim()}><Check size={14} />{editId ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={confirmId !== null} onClose={() => setConfirmId(null)}
        onConfirm={() => { setConfigs(prev => prev.filter(c => c.id !== confirmId)); setConfirmId(null) }}
        message="Esta configuração de notas será excluída permanentemente." />
    </div>
  )
}
