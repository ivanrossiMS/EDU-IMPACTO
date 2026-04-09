'use client'
import { useData, ConfigSituacaoAluno, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Search, ToggleLeft, ToggleRight } from 'lucide-react'

const TIPOS_SITUACAO = ['Ativo', 'Inativo', 'Historico', 'Transferido', 'Cancelado'] as const

const BLANK: Omit<ConfigSituacaoAluno, 'id' | 'createdAt'> = {
  codigo: '', nome: '', tipo: 'Ativo', situacao: 'ativo', matriculaAtiva: true,
}

const PADROES_MEC: Omit<ConfigSituacaoAluno, 'id' | 'createdAt'>[] = [
  { codigo: '1',  nome: 'Apr.c/PP',            tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false },
  { codigo: '2',  nome: 'Aprovado',             tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false },
  { codigo: '3',  nome: 'Transferido',          tipo: 'Transferido', situacao: 'inativo', matriculaAtiva: false },
  { codigo: '4',  nome: 'Cursando',             tipo: 'Ativo',       situacao: 'ativo',   matriculaAtiva: true  },
  { codigo: '5',  nome: 'Matrícula cancelada',  tipo: 'Cancelado',   situacao: 'inativo', matriculaAtiva: false },
  { codigo: '6',  nome: 'Reprovado',            tipo: 'Historico',   situacao: 'ativo',   matriculaAtiva: false },
  { codigo: '7',  nome: 'Prog. Continuada',     tipo: 'Ativo',       situacao: 'ativo',   matriculaAtiva: true  },
  { codigo: '8',  nome: 'Remanejado',           tipo: 'Transferido', situacao: 'ativo',   matriculaAtiva: false },
  { codigo: '9',  nome: 'Concluído',            tipo: 'Historico',   situacao: 'inativo', matriculaAtiva: false },
]

export default function SituacaoAlunoPage() {
  const { cfgSituacaoAluno, setCfgSituacaoAluno } = useData()
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'Ativo' | 'Inativo' | 'Historico' | 'Transferido' | 'Cancelado'>('todos')
  const [filtroAtiva, setFiltroAtiva] = useState<'todos' | 'ativa' | 'desativada'>('todos')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() =>
    cfgSituacaoAluno.filter(s => {
      const matchSearch = search.trim().length < 3 || (s.nome.toLowerCase().includes(search.toLowerCase()) || s.codigo.toLowerCase().includes(search.toLowerCase()))
      const matchTipo = filtroTipo === 'todos' || s.tipo === filtroTipo
      const matchAtiva = filtroAtiva === 'todos' ||
        (filtroAtiva === 'ativa' && (s.matriculaAtiva ?? false)) ||
        (filtroAtiva === 'desativada' && !(s.matriculaAtiva ?? false))
      return matchSearch && matchTipo && matchAtiva
    }), [cfgSituacaoAluno, search, filtroTipo, filtroAtiva])

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (s: ConfigSituacaoAluno) => {
    setEditId(s.id)
    setForm({ codigo: s.codigo, nome: s.nome, tipo: s.tipo, situacao: s.situacao, matriculaAtiva: s.matriculaAtiva ?? false })
    setShowForm(true)
  }
  const handleDelete = (id: string) => setCfgSituacaoAluno(prev => prev.filter(s => s.id !== id))

  const loadPadroes = () => {
    setCfgSituacaoAluno(prev => {
      const existingCodes = new Set(prev.map(p => p.codigo))
      const news = PADROES_MEC.filter(p => !existingCodes.has(p.codigo)).map(p => ({
        ...p, id: newId('SIT'), createdAt: new Date().toISOString()
      }))
      return [...prev, ...news]
    })
  }

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja apagar TODAS as situações? Essa ação afeta todos que usam estas situações no ERP.')) {
      setCfgSituacaoAluno([])
    }
  }

  const handleSave = () => {
    if (!form.nome.trim() || !form.codigo.trim()) return
    if (editId) {
      setCfgSituacaoAluno(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s))
    } else {
      setCfgSituacaoAluno(prev => [...prev, { ...form, id: newId('SIT'), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }

  const toggleMatriculaAtiva = (id: string) => {
    setCfgSituacaoAluno(prev => prev.map(s => s.id === id ? { ...s, matriculaAtiva: !(s.matriculaAtiva ?? false) } : s))
  }

  const limparFiltros = () => {
    setSearch(''); setFiltroTipo('todos'); setFiltroAtiva('todos')
  }

  const getTipoColor = (tipo: string) => {
    switch(tipo){
      case 'Ativo': return '#10b981'
      case 'Inativo': return '#f59e0b'
      case 'Historico': return '#60a5fa'
      case 'Transferido': return '#8b5cf6'
      case 'Cancelado': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const qtdAtivas = cfgSituacaoAluno.filter(s => s.matriculaAtiva ?? false).length
  const qtdDesativadas = cfgSituacaoAluno.filter(s => !(s.matriculaAtiva ?? false)).length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Situação do Aluno</h1>
          <p className="page-subtitle">Configure os status acadêmicos e defina quais representam matrículas ativas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleClearAll} style={{ color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
            <Trash2 size={13} /> Limpar Tudo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadPadroes} style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <Check size={13} /> Carregar Padrões
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} /> Nova Situação</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* Matrícula Ativa KPI */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981', cursor:'pointer', opacity: filtroAtiva==='ativa'?1:0.85 }} onClick={() => setFiltroAtiva(f => f==='ativa'?'todos':'ativa')}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{qtdAtivas}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Matrícula Ativa</div>
          <div style={{ fontSize: 10, color: '#10b981', marginTop: 2, fontWeight:600 }}>✓ Cursando</div>
        </div>
        {/* Matrícula Desativada KPI */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b', cursor:'pointer', opacity: filtroAtiva==='desativada'?1:0.85 }} onClick={() => setFiltroAtiva(f => f==='desativada'?'todos':'desativada')}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{qtdDesativadas}</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Matr. Desativada</div>
          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight:600 }}>⚠ Histórico/Encerrado</div>
        </div>
        {TIPOS_SITUACAO.map(tipo => {
            const qtd = cfgSituacaoAluno.filter(s => s.tipo === tipo).length;
            if (qtd === 0 && tipo !== 'Ativo') return null;
            return (
              <div key={tipo} className="kpi-card" style={{ borderLeft: `4px solid ${getTipoColor(tipo)}` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: getTipoColor(tipo) }}>{qtd}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{tipo}</div>
              </div>
            )
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, padding:'10px 14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10 }}>
        <span style={{ fontSize:13 }}>ℹ️</span>
        <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
          <strong style={{color:'hsl(var(--text-base))'}}>Matrícula Ativa</strong> = aluno ainda está vinculado à turma.
          Situações <strong style={{color:'#f59e0b'}}>Desativadas</strong> geram <span style={{background:'rgba(245,158,11,0.15)',color:'#d97706',padding:'1px 6px',borderRadius:4,fontWeight:700}}>linha amarela</span> no histórico de matrículas do Step 4.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar situação..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">📋 Tipo: Todos</option>
          {TIPOS_SITUACAO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ width: 160 }} value={filtroAtiva} onChange={e => setFiltroAtiva(e.target.value as any)}>
          <option value="todos">🔲 Matr.: Todas</option>
          <option value="ativa">✅ Ativas</option>
          <option value="desativada">⚠️ Desativadas</option>
        </select>
        {(search || filtroTipo !== 'todos' || filtroAtiva !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={limparFiltros}>✕ Limpar</button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Situação' : '➕ Nova Situação'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Código *</label>
              <input className="form-input" value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex: APR, REP..." maxLength={6} />
            </div>
            <div>
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Aprovado, Matrícula Trancada..." />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Tipo de Status</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}>
                {TIPOS_SITUACAO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Situação do Cadastro</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
            <div>
              <label className="form-label">Matrícula</label>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, matriculaAtiva: !p.matriculaAtiva }))}
                style={{
                  width:'100%', height:38, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  borderRadius:8, border:`2px solid ${form.matriculaAtiva ? '#10b981' : '#f59e0b'}`,
                  background: form.matriculaAtiva ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                  color: form.matriculaAtiva ? '#10b981' : '#f59e0b',
                  fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s'
                }}
              >
                {form.matriculaAtiva ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                {form.matriculaAtiva ? 'Ativa' : 'Desativada'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />Salvar</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Código</th>
              <th>Situação / Status</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'center', width: 130 }}>Matrícula</th>
              <th style={{ textAlign: 'center', width: 80 }}>Ativo</th>
              <th style={{ width: 100 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const isAtiva = s.matriculaAtiva ?? false
              return (
                <tr key={s.id} style={{ background: isAtiva ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', borderLeft: `3px solid ${isAtiva ? '#10b981' : '#f59e0b'}`, transition:'all 0.2s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=isAtiva?'rgba(16,185,129,0.12)':'rgba(245,158,11,0.12)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=isAtiva?'rgba(16,185,129,0.08)':'rgba(245,158,11,0.08)'}>
                  <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 800 }}>{s.codigo}</code></td>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{s.nome}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${getTipoColor(s.tipo)}22`, color: getTipoColor(s.tipo), fontWeight: 700 }}>{s.tipo}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleMatriculaAtiva(s.id)}
                      title={isAtiva ? 'Clique para desativar' : 'Clique para ativar'}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20,
                        border:`1.5px solid ${isAtiva ? '#10b981' : '#f59e0b'}`,
                        background: isAtiva ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        color: isAtiva ? '#10b981' : '#d97706',
                        fontWeight:700, fontSize:11, cursor:'pointer', transition:'all 0.18s',
                      }}
                    >
                      {isAtiva ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                      {isAtiva ? 'Ativa' : 'Desativada'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${s.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{s.situacao === 'ativo' ? 'Sim' : 'Não'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(s)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
            Nenhuma situação com esses filtros — <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={limparFiltros}>limpar</button>
          </div>
        )}
      </div>
    </div>
  )
}
