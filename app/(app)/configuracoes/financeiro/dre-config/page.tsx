'use client'

import { useState } from 'react'
import { useData, ConfigGrupoDRE, GrupoDRECodigo, newId } from '@/lib/dataContext'
import { Settings, GripVertical, Plus, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, AlertCircle, RefreshCw, Save } from 'lucide-react'

const GRUPO_TIPO_LABELS: Record<string, string> = {
  receita: 'Receita',
  deducao: 'Dedução',
  custo: 'Custo Direto',
  despesa: 'Despesa Op.',
  resultado: 'Resultado',
  imposto: 'Imposto',
  informativo: 'Informativo',
}

const GRUPO_NATUREZA_LABELS: Record<string, string> = {
  credora: '(+) Credora',
  devedora: '(-) Devedora',
  calculado: '= Calculado',
}

const NIVEL_LABELS: Record<string, string> = {
  grupo: 'Grupo',
  subtotal: 'Subtotal',
  total: 'Total Final',
}

const BLANK_GRUPO: Omit<ConfigGrupoDRE, 'id' | 'createdAt'> = {
  codigo: 'SEM_CLASSIFICACAO',
  nome: '',
  nomeCurto: '',
  tipo: 'despesa',
  natureza: 'devedora',
  formula: '',
  ordem: 99,
  exibir: true,
  nivel: 'grupo',
  corDestaque: '#3b82f6',
}

export default function DREConfigPage() {
  const { cfgGruposDRE, setCfgGruposDRE, dreConfig, setDreConfig, cfgPlanoContas } = useData()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ConfigGrupoDRE, 'id' | 'createdAt'>>(BLANK_GRUPO)

  const openNew = () => { setForm(BLANK_GRUPO); setEditId(null); setShowForm(true) }
  const openEdit = (g: ConfigGrupoDRE) => {
    setEditId(g.id)
    setForm({ codigo: g.codigo, nome: g.nome, nomeCurto: g.nomeCurto, tipo: g.tipo, natureza: g.natureza, formula: g.formula, ordem: g.ordem, exibir: g.exibir, nivel: g.nivel, corDestaque: g.corDestaque })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    if (editId) {
      setCfgGruposDRE(prev => prev.map(g => g.id === editId ? { ...g, ...form } : g))
    } else {
      const novo: ConfigGrupoDRE = { ...form, id: newId('GD'), createdAt: new Date().toISOString() }
      setCfgGruposDRE(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este grupo da DRE? Isso não remove as contas vinculadas.')) return
    setCfgGruposDRE(prev => prev.filter(g => g.id !== id))
  }

  const toggleExibir = (id: string) =>
    setCfgGruposDRE(prev => prev.map(g => g.id === id ? { ...g, exibir: !g.exibir } : g))

  const moverOrdem = (id: string, dir: 'up' | 'down') => {
    const sorted = [...cfgGruposDRE].sort((a, b) => a.ordem - b.ordem)
    const idx = sorted.findIndex(g => g.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === sorted.length - 1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const [a, b] = [sorted[idx].ordem, sorted[swapIdx].ordem]
    setCfgGruposDRE(prev => prev.map(g => {
      if (g.id === id) return { ...g, ordem: b }
      if (g.id === sorted[swapIdx].id) return { ...g, ordem: a }
      return g
    }))
  }

  const gruposOrdenados = [...cfgGruposDRE].sort((a, b) => a.ordem - b.ordem)

  // Estatísticas de pendências
  const contasSemGrupo = cfgPlanoContas.filter(p => p.situacao === 'ativo' && !p.grupoDRE && p.tipo === 'analitico').length

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuração da DRE</h1>
          <p className="page-subtitle">Grupos, ordem, regime e configurações gerais do demonstrativo</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13}/> Novo Grupo</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Grupos Cadastrados', value: cfgGruposDRE.length, cor: '#3b82f6' },
          { label: 'Grupos Ativos', value: cfgGruposDRE.filter(g => g.exibir).length, cor: '#10b981' },
          { label: 'Contas Sem Grupo DRE', value: contasSemGrupo, cor: contasSemGrupo > 0 ? '#f59e0b' : '#10b981' },
          { label: 'Regime de Apuração', value: dreConfig.regimeApuracao === 'caixa' ? 'Caixa' : 'Competência', cor: '#8b5cf6', isText: true },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `4px solid ${k.cor}` }}>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: (k as any).isText ? 18 : 26, fontWeight: 900, color: k.cor, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Configurações Globais */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 20, border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          <Settings size={13} style={{ marginRight: 4, verticalAlign: 'middle' }}/>Configurações Globais da DRE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <label className="form-label">Regime Padrão de Apuração</label>
            <select className="form-input"
              value={dreConfig.regimeApuracao}
              onChange={e => setDreConfig(p => ({ ...p, regimeApuracao: e.target.value as any, updatedAt: new Date().toISOString() }))}>
              <option value="caixa">Regime de Caixa (padrão)</option>
              <option value="competencia">Regime de Competência</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={dreConfig.exibirZerados}
                onChange={e => setDreConfig(p => ({ ...p, exibirZerados: e.target.checked, updatedAt: new Date().toISOString() }))}/>
              <span>Exibir grupos zerados por padrão</span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={dreConfig.exibirContasInativas}
                onChange={e => setDreConfig(p => ({ ...p, exibirContasInativas: e.target.checked, updatedAt: new Date().toISOString() }))}/>
              <span>Exibir contas inativas no histórico</span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              Última atualização: {new Date(dreConfig.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Pendências */}
      {contasSemGrupo > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, border: '1px solid #f59e0b40', background: '#f59e0b08', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} color="#f59e0b"/>
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
            {contasSemGrupo} conta(s) analítica(s) não possuem grupo DRE definido. Acesse <strong>Plano de Contas</strong> para classificá-las.
          </span>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.01)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>
            {editId ? '✏️ Editar Grupo DRE' : '➕ Novo Grupo DRE'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <label className="form-label">Nome do Grupo *</label>
              <input className="form-input" value={form.nome} placeholder="Ex: Receita Bruta"
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Nome Curto (tabela)</label>
              <input className="form-input" value={form.nomeCurto || ''} placeholder="Ex: Rec. Bruta"
                onChange={e => setForm(p => ({ ...p, nomeCurto: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Cor de Destaque</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={form.corDestaque || '#3b82f6'}
                  onChange={e => setForm(p => ({ ...p, corDestaque: e.target.value }))}
                  style={{ width: 44, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2 }}/>
                <input className="form-input" value={form.corDestaque || ''} placeholder="#3b82f6"
                  onChange={e => setForm(p => ({ ...p, corDestaque: e.target.value }))}/>
              </div>
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}>
                {Object.entries(GRUPO_TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Natureza</label>
              <select className="form-input" value={form.natureza}
                onChange={e => setForm(p => ({ ...p, natureza: e.target.value as any }))}>
                {Object.entries(GRUPO_NATUREZA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nível Visual</label>
              <select className="form-input" value={form.nivel}
                onChange={e => setForm(p => ({ ...p, nivel: e.target.value as any }))}>
                {Object.entries(NIVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Ordem</label>
              <input className="form-input" type="number" min={1} value={form.ordem}
                onChange={e => setForm(p => ({ ...p, ordem: parseInt(e.target.value) || 1 }))}/>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Fórmula (apenas para grupos calculados)</label>
              <input className="form-input" value={form.formula || ''} placeholder="Ex: RECEITA_BRUTA - DEDUCAO_RECEITA"
                onChange={e => setForm(p => ({ ...p, formula: e.target.value }))}
                style={{ fontFamily: 'monospace' }}/>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                Use os códigos dos grupos separados por + ou -. Ex: <code>LUCRO_BRUTO - DESP_ADMINISTRATIVA - DESP_COMERCIAL</code>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13}/>{editId ? 'Salvar' : 'Criar Grupo'}</button>
          </div>
        </div>
      )}

      {/* Tabela de Grupos */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Ordem</th>
              <th>Nome do Grupo</th>
              <th style={{ textAlign: 'center', width: 110 }}>Tipo</th>
              <th style={{ textAlign: 'center', width: 130 }}>Natureza</th>
              <th style={{ textAlign: 'center', width: 100 }}>Nível</th>
              <th style={{ textAlign: 'center', width: 80 }}>Exibir</th>
              <th style={{ textAlign: 'center', width: 80 }}>Fórmula</th>
              <th style={{ width: 100 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {gruposOrdenados.map((g, idx) => (
              <tr key={g.id} style={{ opacity: g.exibir ? 1 : 0.5 }}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: 2 }} onClick={() => moverOrdem(g.id, 'up')} disabled={idx === 0}><ChevronUp size={12}/></button>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 800 }}>{g.ordem}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: 2 }} onClick={() => moverOrdem(g.id, 'down')} disabled={idx === gruposOrdenados.length - 1}><ChevronDown size={12}/></button>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: g.corDestaque || '#3b82f6', flexShrink: 0 }}/>
                    <div>
                      <div style={{ fontWeight: g.nivel !== 'grupo' ? 800 : 600, fontSize: 13 }}>{g.nome}</div>
                      {g.nomeCurto && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{g.nomeCurto}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    {GRUPO_TIPO_LABELS[g.tipo] || g.tipo}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                    background: g.natureza === 'credora' ? 'rgba(16,185,129,0.12)' : g.natureza === 'calculado' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                    color: g.natureza === 'credora' ? '#10b981' : g.natureza === 'calculado' ? '#3b82f6' : '#ef4444' }}>
                    {GRUPO_NATUREZA_LABELS[g.natureza] || g.natureza}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: g.nivel === 'total' ? 'rgba(16,185,129,0.12)' : g.nivel === 'subtotal' ? 'rgba(59,130,246,0.1)' : 'transparent', fontWeight: g.nivel !== 'grupo' ? 800 : 600, color: g.nivel === 'total' ? '#10b981' : g.nivel === 'subtotal' ? '#3b82f6' : 'hsl(var(--text-muted))' }}>
                    {NIVEL_LABELS[g.nivel]}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleExibir(g.id)} title={g.exibir ? 'Ocultar da DRE' : 'Exibir na DRE'}>
                    {g.exibir ? <ToggleRight size={18} color="#10b981"/> : <ToggleLeft size={18} color="hsl(var(--text-muted))"/>}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {g.formula ? (
                    <span title={g.formula} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontFamily: 'monospace', cursor: 'help' }}>
                      = f(x)
                    </span>
                  ) : <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>–</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(g)} title="Editar"><Edit2 size={12}/></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(g.id)} title="Excluir"><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
