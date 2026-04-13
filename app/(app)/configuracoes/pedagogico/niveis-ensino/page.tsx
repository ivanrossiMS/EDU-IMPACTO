'use client'
import { useData, ConfigNivelEnsino, SerieEnsino, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, GraduationCap, ChevronDown, ChevronUp, X, BookOpen, Hash, Sparkles, Building2 } from 'lucide-react'

// ─── Cores por código ──────────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  '1': '#ec4899', '2': '#3b82f6', '3': '#8b5cf6', '4': '#10b981', '5': '#f59e0b',
  EI: '#ec4899', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#10b981', EJA: '#f59e0b',
}
const getCor = (codigo: string) => LEVEL_COLORS[codigo] ?? '#6b7280'

// ─── Geração automática de código de nível ─────────────────────────
function gerarCodigoNivel(nome: string, existentes: string[]): string {
  const tokens = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(t => t.length > 2 || /^[IVX]+$/.test(t) || /^\d+$/.test(t))

  const sigla = tokens.map(t => /^[IVX]+$/.test(t) || /^\d+$/.test(t) ? t : t[0]).join('')
  if (!existentes.includes(sigla)) return sigla
  let i = 2
  while (existentes.includes(`${sigla}${i}`)) i++
  return `${sigla}${i}`
}

const gerarCodigoSerie = (codigoNivel: string, ordem: number): string =>
  `${codigoNivel}-${String(ordem).padStart(2, '0')}`

const PRESET: Record<string, { nome: string; faixaEtaria: string; duracaoAnos: number; series: string[] }> = {
  EI:  { nome: 'Educação Infantil',           faixaEtaria: '0–5 anos',   duracaoAnos: 5, series: ['Berçário', 'Maternal I', 'Maternal II', 'Jardim', 'Pré-Escola'] },
  EF1: { nome: 'Ensino Fundamental I',         faixaEtaria: '6–10 anos',  duracaoAnos: 5, series: ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'] },
  EF2: { nome: 'Ensino Fundamental II',        faixaEtaria: '11–14 anos', duracaoAnos: 4, series: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
  EM:  { nome: 'Ensino Médio',                 faixaEtaria: '15–17 anos', duracaoAnos: 3, series: ['1ª Série', '2ª Série', '3ª Série'] },
  EJA: { nome: 'Educação de Jovens e Adultos', faixaEtaria: '18+ anos',   duracaoAnos: 3, series: ['Fase I', 'Fase II', 'Fase III'] },
}

const PADROES_NIVEIS_MEC = [
  { codigo: '1', nome: 'Educação Infantil', faixaEtaria: '0–5 anos', duracaoAnos: 5, situacao: 'ativo', series: PRESET['EI'].series },
  { codigo: '2', nome: 'Ensino Fundamental I', faixaEtaria: '6–10 anos', duracaoAnos: 5, situacao: 'ativo', series: PRESET['EF1'].series },
  { codigo: '3', nome: 'Ensino Fundamental II', faixaEtaria: '11–14 anos', duracaoAnos: 4, situacao: 'ativo', series: PRESET['EF2'].series },
  { codigo: '4', nome: 'Ensino Médio', faixaEtaria: '15–17 anos', duracaoAnos: 3, situacao: 'ativo', series: PRESET['EM'].series },
  { codigo: '5', nome: 'Educação de Jovens e Adultos', faixaEtaria: '18+ anos', duracaoAnos: 3, situacao: 'ativo', series: PRESET['EJA'].series },
] as const

const buildSeries = (nomes: string[], codigoNivel: string): SerieEnsino[] =>
  nomes.map((nome, i) => ({ id: newId('SE'), codigo: gerarCodigoSerie(codigoNivel, i + 1), nome, ordem: i + 1, ativo: true }))

function SeriesPanel({ nivel, onUpdate }: { nivel: ConfigNivelEnsino; onUpdate: (s: SerieEnsino[]) => void }) {
  const [newNome, setNewNome] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  const cor = getCor(nivel.codigo)
  const series = [...(nivel.series ?? [])].sort((a, b) => a.ordem - b.ordem)

  const adicionar = () => {
    if (!newNome.trim()) return
    const ordem = series.length + 1
    const nova: SerieEnsino = {
      id: newId('SE'),
      codigo: gerarCodigoSerie(nivel.codigo, ordem),
      nome: newNome.trim(),
      ordem,
      ativo: true,
    }
    onUpdate([...series, nova])
    setNewNome('')
  }

  const remover = (id: string) => {
    const nova = series.filter(s => s.id !== id)
      .map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(nivel.codigo, i + 1) }))
    onUpdate(nova)
  }

  const toggleAtivo = (id: string) => onUpdate(series.map(s => s.id === id ? { ...s, ativo: !s.ativo } : s))

  const startEdit = (s: SerieEnsino) => { setEditId(s.id); setEditNome(s.nome) }

  const saveEdit = () => {
    if (!editNome.trim()) return
    onUpdate(series.map(s => s.id === editId ? { ...s, nome: editNome.trim() } : s))
    setEditId(null)
  }

  const mover = (id: string, dir: 'cima' | 'baixo') => {
    const idx = series.findIndex(s => s.id === id)
    if (dir === 'cima' && idx <= 0) return
    if (dir === 'baixo' && idx >= series.length - 1) return
    const arr = [...series]
    const swapIdx = dir === 'cima' ? idx - 1 : idx + 1
    ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    onUpdate(arr.map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(nivel.codigo, i + 1) })))
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${cor}25` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Séries — {series.length} cadastrada(s)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {series.map((s, idx) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
            background: s.ativo ? `${cor}08` : 'hsl(var(--bg-elevated))',
            border: `1px solid ${s.ativo ? `${cor}25` : 'hsl(var(--border-subtle))'}`,
            opacity: s.ativo ? 1 : 0.5,
          }}>
            {/* Código auto gerado — read-only */}
            <code style={{ fontSize: 10, fontWeight: 800, color: cor, background: `${cor}15`, padding: '1px 6px', borderRadius: 4, minWidth: 62, textAlign: 'center', fontFamily: 'monospace', flexShrink: 0 }}>
              {s.codigo}
            </code>

            {editId === s.id ? (
              <>
                <input autoFocus className="form-input" value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                  style={{ flex: 1, fontSize: 12, padding: '3px 8px', height: 26 }} />
                <button onClick={saveEdit} style={{ padding: '2px 8px', height: 26, borderRadius: 5, background: cor, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
                <button onClick={() => setEditId(null)} style={{ padding: '2px 5px', height: 26, borderRadius: 5, background: 'hsl(var(--bg-overlay))', border: 'none', cursor: 'pointer' }}><X size={10} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{s.nome}</span>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button onClick={() => mover(s.id, 'cima')} disabled={idx === 0} style={{ padding: '2px 3px', border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.6 }}><ChevronUp size={11} /></button>
                  <button onClick={() => mover(s.id, 'baixo')} disabled={idx === series.length - 1} style={{ padding: '2px 3px', border: 'none', background: 'transparent', cursor: idx === series.length - 1 ? 'default' : 'pointer', opacity: idx === series.length - 1 ? 0.2 : 0.6 }}><ChevronDown size={11} /></button>
                  <button onClick={() => startEdit(s)} style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><Edit2 size={10} /></button>
                  <button onClick={() => toggleAtivo(s.id)} style={{ padding: '2px 3px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10 }}>{s.ativo ? '🟢' : '⚫'}</button>
                  <button onClick={() => remover(s.id)} style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171' }}><Trash2 size={10} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', background: `${cor}10`, border: `1px dashed ${cor}30`, borderRadius: 6, fontSize: 10, color: cor, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {gerarCodigoSerie(nivel.codigo, series.length + 1)}
        </div>
        <input className="form-input" value={newNome} onChange={e => setNewNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionar()}
          placeholder="Nome da série..." style={{ flex: 1, fontSize: 12, padding: '5px 10px', height: 32 }} />
        <button onClick={adicionar} disabled={!newNome.trim()}
          style={{ padding: '0 12px', height: 32, borderRadius: 8, background: cor, color: '#fff', border: 'none', cursor: newNome.trim() ? 'pointer' : 'not-allowed', opacity: newNome.trim() ? 1 : 0.4, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12} />Adicionar
        </button>
      </div>
    </div>
  )
}

export default function NiveisEnsinoPage() {
  const { cfgNiveisEnsino, setCfgNiveisEnsino, mantenedores = [] } = useData()
  const todasUnidades = (mantenedores || []).flatMap(m => m.unidades ?? [])

  type FormNivel = { nome: string; faixaEtaria: string; duracaoAnos: number; situacao: 'ativo' | 'inativo'; unidadeIds: string[] }
  const BLANK: FormNivel = { nome: '', faixaEtaria: '', duracaoAnos: 1, situacao: 'ativo', unidadeIds: [] }

  const [form, setForm] = useState<FormNivel>(BLANK)
  const [formSeries, setFormSeries] = useState<SerieEnsino[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [msNewNome, setMsNewNome] = useState('')
  const [msEditId, setMsEditId] = useState<string | null>(null)
  const [msEditNome, setMsEditNome] = useState('')

  const codigosExistentes = cfgNiveisEnsino.map(n => n.codigo)
  const codigoPreview = editId ? editCodigo : gerarCodigoNivel(form.nome, codigosExistentes)

  const openNew = () => {
    setEditId(null); setEditCodigo(''); setForm(BLANK); setFormSeries([])
    setMsNewNome(''); setMsEditId(null); setShowForm(true)
  }

  const openEdit = (n: ConfigNivelEnsino) => {
    setEditId(n.id); setEditCodigo(n.codigo)
    setForm({ nome: n.nome, faixaEtaria: n.faixaEtaria, duracaoAnos: n.duracaoAnos, situacao: n.situacao, unidadeIds: n.unidadeIds ?? [] })
    setFormSeries([...(n.series ?? [])])
    setMsNewNome(''); setMsEditId(null); setShowForm(true)
  }

  const usePreset = (key: string) => {
    const p = PRESET[key]
    const codigo = gerarCodigoNivel(p.nome, editId ? codigosExistentes.filter(c => c !== editCodigo) : codigosExistentes)
    setForm(prev => ({ ...prev, nome: p.nome, faixaEtaria: p.faixaEtaria, duracaoAnos: p.duracaoAnos }))
    setFormSeries(buildSeries(p.series, codigo))
  }

  const loadPadroes = () => {
    setCfgNiveisEnsino(prev => {
      const existingCodes = new Set(prev.map(p => p.codigo))
      const autoAssignedUnits = todasUnidades.map(u => u.id)
      
      const news = PADROES_NIVEIS_MEC.filter(p => !existingCodes.has(p.codigo)).map(p => ({
        id: newId('NE'), 
        codigo: p.codigo,
        nome: p.nome,
        faixaEtaria: p.faixaEtaria,
        duracaoAnos: p.duracaoAnos,
        situacao: p.situacao as 'ativo',
        unidadeIds: autoAssignedUnits,
        series: buildSeries([...p.series], p.codigo),
        createdAt: new Date().toISOString()
      }))
      return [...prev, ...news]
    })
  }

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja apagar TODOS os níveis de ensino? Isso removerá as referências de matrículas atreladas.')) {
      setCfgNiveisEnsino([])
    }
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    if (form.unidadeIds.length === 0) return
    const codigo = editId ? editCodigo : gerarCodigoNivel(form.nome, codigosExistentes)
    const series = formSeries.map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(codigo, i + 1) }))

    // Outer guard (uses closure state, works for normal clicks)
    if (!editId && cfgNiveisEnsino.some(n => n.nome.toLowerCase() === form.nome.trim().toLowerCase())) {
      alert('Já existe um nível de ensino com este nome!')
      return
    }

    if (editId) {
      setCfgNiveisEnsino(prev => prev.map(n => n.id === editId ? { ...n, ...form, codigo, series } : n))
    } else {
      const novoId = newId('NE')
      setCfgNiveisEnsino(prev => {
        // Inner guard (uses real-time queued state, works against double-click race conditions)
        if (prev.some(n => n.nome.toLowerCase() === form.nome.trim().toLowerCase() || n.id === novoId)) return prev
        const realCodigo = gerarCodigoNivel(form.nome, prev.map(p => p.codigo))
        const realSeries = formSeries.map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(realCodigo, i + 1) }))
        return [...prev, { ...form, codigo: realCodigo, id: novoId, series: realSeries, createdAt: new Date().toISOString() }]
      })
    }
    setShowForm(false)
  }

  const handleToggle = (id: string) =>
    setCfgNiveisEnsino(prev => prev.map(n => n.id === id ? { ...n, situacao: n.situacao === 'ativo' ? 'inativo' : 'ativo' } : n))

  const handleDelete = (id: string) => setCfgNiveisEnsino(prev => prev.filter(n => n.id !== id))
  const updateSeries = (nId: string, series: SerieEnsino[]) =>
    setCfgNiveisEnsino(prev => prev.map(n => n.id === nId ? { ...n, series } : n))

  const msAdicionarSerie = () => {
    if (!msNewNome.trim()) return
    const ordem = formSeries.length + 1
    setFormSeries(prev => [...prev, { id: newId('SE'), codigo: gerarCodigoSerie(codigoPreview, ordem), nome: msNewNome.trim(), ordem, ativo: true }])
    setMsNewNome('')
  }
  const msRemoverSerie = (id: string) =>
    setFormSeries(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(codigoPreview, i + 1) })))
  const msSaveEdit = () => {
    if (!msEditNome.trim()) return
    setFormSeries(prev => prev.map(s => s.id === msEditId ? { ...s, nome: msEditNome.trim() } : s))
    setMsEditId(null)
  }
  const msMover = (id: string, dir: 'cima' | 'baixo') => {
    const arr = [...formSeries].sort((a, b) => a.ordem - b.ordem)
    const idx = arr.findIndex(s => s.id === id)
    if (dir === 'cima' && idx <= 0) return
    if (dir === 'baixo' && idx >= arr.length - 1) return
    const swapIdx = dir === 'cima' ? idx - 1 : idx + 1
    ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    setFormSeries(arr.map((s, i) => ({ ...s, ordem: i + 1, codigo: gerarCodigoSerie(codigoPreview, i + 1) })))
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Níveis de Ensino</h1>
          <p className="page-subtitle">Segmentos padronizados com códigos paramétricos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleClearAll} style={{ color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
            <Trash2 size={13} /> Limpar Tudo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadPadroes} style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <GraduationCap size={13} /> Carregar Padrões
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} /> Novo Nível</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {cfgNiveisEnsino.map(n => {
          const cor = getCor(n.codigo)
          const series = (n.series ?? []).filter(s => s.ativo).sort((a, b) => a.ordem - b.ordem)
          const isExpanded = expandedId === n.id
          return (
            <div key={n.id} className="card" style={{ padding: '20px', borderTop: `3px solid ${cor}`, opacity: n.situacao === 'inativo' ? 0.55 : 1 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={22} color={cor} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: 'hsl(var(--text-primary))' }}>{n.nome}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(n)}><Edit2 size={12} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(n.id)}><Trash2 size={12} /></button>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 10 }}>
                {n.faixaEtaria} · {n.duracaoAnos} ano{n.duracaoAnos !== 1 ? 's' : ''} · {(n.series ?? []).length} série(s)
              </div>

              {/* Chips de unidade */}
              {(n.unidadeIds ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(n.unidadeIds ?? []).map(uid => {
                    const u = todasUnidades.find(x => x.id === uid)
                    return u ? (
                      <span key={uid} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${cor}15`, color: cor, fontWeight: 700, border: `1px solid ${cor}30`, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Building2 size={9} />{u.nomeFantasia || u.razaoSocial}
                      </span>
                    ) : null
                  })}
                </div>
              )}
              {(n.unidadeIds ?? []).length === 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚠ Nenhuma unidade vinculada
                </div>
              )}

              {/* Chips de séries */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                  {series.slice(0, 3).map(s => (
                    <div key={s.id} style={{ display: 'flex', borderRadius: 6, border: `1px solid ${cor}25`, overflow: 'hidden' }}>
                      <span style={{ fontSize: 9, padding: '2px 5px', background: `${cor}20`, color: cor, fontWeight: 800, fontFamily: 'monospace', borderRight: `1px solid ${cor}20` }}>{s.codigo}</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{s.nome}</span>
                    </div>
                  ))}
                  {series.length > 3 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>+{series.length - 3}</span>}
                  {series.length === 0 && <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Nenhuma série</span>}
                </div>
                <button onClick={() => setExpandedId(isExpanded ? null : n.id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${cor}35`, background: isExpanded ? `${cor}15` : 'transparent', cursor: 'pointer', color: cor, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <BookOpen size={11} />{isExpanded ? 'Fechar' : 'Séries'}
                </button>
              </div>

              {isExpanded && <SeriesPanel nivel={n} onUpdate={series => updateSeries(n.id, series)} />}

              <button onClick={() => handleToggle(n.id)}
                className={`btn btn-sm ${n.situacao === 'ativo' ? 'btn-success' : 'btn-secondary'}`}
                style={{ fontSize: 11, width: '100%', justifyContent: 'center', marginTop: 10 }}>
                {n.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo — ativar'}
              </button>
            </div>
          )
        })}

        <div className="card" style={{ padding: '20px', borderTop: '3px dashed hsl(var(--border-default))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 8, opacity: 0.5, minHeight: 160 }} onClick={openNew}>
          <Plus size={24} /><span style={{ fontSize: 13 }}>Adicionar nível</span>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 660, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', marginBottom: 24 }}>

            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{editId ? 'Editar Nível de Ensino' : 'Novo Nível de Ensino'}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={11} style={{ color: '#f59e0b' }} />
                  Códigos gerados automaticamente pelo sistema
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>
              {/* Presets */}
              {!editId && (
                <div style={{ marginBottom: 18 }}>
                  <label className="form-label">Preencher com preset MEC</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(PRESET).map(([key, p]) => (
                      <button key={key} type="button" className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, color: LEVEL_COLORS[key] ?? 'inherit', borderColor: LEVEL_COLORS[key] ? `${LEVEL_COLORS[key]}60` : 'inherit' }}
                        onClick={() => usePreset(key)}>
                        {key} — {p.nome.split(' ').slice(0, 2).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloco: Código gerado automaticamente */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, marginBottom: 16 }}>
                <Sparkles size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Código do nível (gerado automaticamente)</div>
                  <div style={{ fontWeight: 900, fontSize: 22, fontFamily: 'Outfit, monospace', color: codigoPreview ? (getCor(codigoPreview) !== '#6b7280' ? getCor(codigoPreview) : '#f59e0b') : '#aaa', letterSpacing: '-0.5px' }}>
                    {codigoPreview || '—'}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', maxWidth: 140, textAlign: 'right', lineHeight: 1.4 }}>
                  Gerado das iniciais do nome. Único por instituição.
                </div>
              </div>

              {/* Dados do nível */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Nome do Nível *</label>
                  <input className="form-input" value={form.nome}
                    onChange={e => {
                      setForm(p => ({ ...p, nome: e.target.value }))
                      // Ao mudar nome em criação, recalcula códigos das séries
                      if (!editId) {
                        const novoCod = gerarCodigoNivel(e.target.value, codigosExistentes)
                        setFormSeries(prev => prev.map((s, i) => ({ ...s, codigo: gerarCodigoSerie(novoCod, i + 1) })))
                      }
                    }}
                    placeholder="Ex: Ensino Fundamental I, Ensino Médio..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label className="form-label">Faixa Etária</label>
                  <input className="form-input" value={form.faixaEtaria} onChange={e => setForm(p => ({ ...p, faixaEtaria: e.target.value }))} placeholder="6–10 anos" />
                </div>
                <div>
                  <label className="form-label">Duração (anos)</label>
                  <input className="form-input" type="number" min={1} max={20} value={form.duracaoAnos} onChange={e => setForm(p => ({ ...p, duracaoAnos: +e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Situação</label>
                  <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                    <option value="ativo">✓ Ativo</option>
                    <option value="inativo">✗ Inativo</option>
                  </select>
                </div>
              </div>

              {/* ─── Unidades — campo obrigatório ─── */}
              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={13} />
                  Unidades que oferecem este nível *
                  {form.unidadeIds.length === 0 && (
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>⚠ obrigatório</span>
                  )}
                </label>

                {todasUnidades.length === 0 ? (
                  <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px dashed rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.05)', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    ⚠ Nenhuma unidade cadastrada. Acesse <strong>Configurações → Unidades</strong> para cadastrar.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {todasUnidades.map(u => {
                      const checked = form.unidadeIds.includes(u.id)
                      return (
                        <label key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'hsl(var(--border-subtle))'}`,
                          background: checked ? 'rgba(99,102,241,0.06)' : 'hsl(var(--bg-elevated))',
                          transition: 'all 0.15s'
                        }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setForm(p => ({
                              ...p,
                              unidadeIds: checked
                                ? p.unidadeIds.filter(id => id !== u.id)
                                : [...p.unidadeIds, u.id]
                            }))}
                            style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? '#818cf8' : 'hsl(var(--text-primary))' }}>
                              {u.nomeFantasia || u.razaoSocial}
                            </div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                              {u.cidade}/{u.estado} · CNPJ: {u.cnpj || '—'}
                            </div>
                          </div>
                          {checked && <Check size={14} color="#818cf8" style={{ flexShrink: 0 }} />}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Séries */}
              <div style={{ padding: '14px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={13} />Séries / Anos
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 400 }}>— {formSeries.length} cadastrada(s) · códigos sequenciais automáticos</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {[...formSeries].sort((a, b) => a.ordem - b.ordem).map((s, idx) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))' }}>
                      {/* Código automático — somente leitura */}
                      <code style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '2px 8px', borderRadius: 5, fontFamily: 'monospace', minWidth: 68, textAlign: 'center', flexShrink: 0 }}>
                        {s.codigo}
                      </code>

                      {msEditId === s.id ? (
                        <>
                          <input autoFocus className="form-input" value={msEditNome}
                            onChange={e => setMsEditNome(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') msSaveEdit(); if (e.key === 'Escape') setMsEditId(null) }}
                            style={{ flex: 1, fontSize: 13, padding: '4px 8px', height: 30 }} />
                          <button onClick={msSaveEdit} style={{ padding: '3px 10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                          <button onClick={() => setMsEditId(null)} style={{ padding: '3px 6px', background: 'hsl(var(--bg-overlay))', border: 'none', borderRadius: 6, cursor: 'pointer' }}><X size={11} /></button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{s.nome}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button disabled={idx === 0} onClick={() => msMover(s.id, 'cima')} style={{ padding: '2px', border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.6 }}><ChevronUp size={13} /></button>
                            <button disabled={idx === formSeries.length - 1} onClick={() => msMover(s.id, 'baixo')} style={{ padding: '2px', border: 'none', background: 'transparent', cursor: idx === formSeries.length - 1 ? 'default' : 'pointer', opacity: idx === formSeries.length - 1 ? 0.2 : 0.6 }}><ChevronDown size={13} /></button>
                            <button onClick={() => { setMsEditId(s.id); setMsEditNome(s.nome) }} style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><Edit2 size={12} /></button>
                            <button onClick={() => msRemoverSerie(s.id)} style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171' }}><Trash2 size={12} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Preview do próximo código */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', border: '1px dashed rgba(139,92,246,0.4)', borderRadius: 6, height: 38, fontSize: 11, color: '#8b5cf6', fontWeight: 800, fontFamily: 'monospace', flexShrink: 0, background: 'rgba(139,92,246,0.05)' }}>
                    {codigoPreview ? gerarCodigoSerie(codigoPreview, formSeries.length + 1) : '??-01'}
                  </div>
                  <input className="form-input" value={msNewNome}
                    onChange={e => setMsNewNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && msAdicionarSerie()}
                    placeholder="Nome da série (ex: 1º Ano, Berçário, Fase I...)"
                    style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-sm" onClick={msAdicionarSerie} disabled={!msNewNome.trim()}>
                    <Plus size={13} />Adicionar
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6 }}>
                  <Sparkles size={10} style={{ display: 'inline', marginRight: 4, color: '#f59e0b' }} />
                  O código da série é gerado automaticamente: <code style={{ fontSize: 10, background: 'hsl(var(--bg-base))', padding: '0 4px', borderRadius: 3 }}>{codigoPreview || 'NÍVEL'}-01</code>, <code style={{ fontSize: 10, background: 'hsl(var(--bg-base))', padding: '0 4px', borderRadius: 3 }}>{codigoPreview || 'NÍVEL'}-02</code>...
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={!form.nome.trim() || form.unidadeIds.length === 0}
                title={form.unidadeIds.length === 0 ? 'Selecione ao menos uma unidade' : ''}>
                <Check size={13} />{editId ? 'Salvar Alterações' : 'Cadastrar Nível'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
