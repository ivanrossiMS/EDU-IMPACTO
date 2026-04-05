'use client'
import { ConfigDisciplina, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, BookOpen, Search, Download } from 'lucide-react'

const NIVEIS_OPTS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const NIVEL_COLORS: Record<string, string> = { EI: '#ec4899', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#10b981', EJA: '#f59e0b' }
const TURNOS = ['Manhã', 'Tarde', 'Noite', 'Integral']

const BLANK: Omit<ConfigDisciplina, 'id' | 'createdAt'> = {
  codigo: '', nome: '', cargaHoraria: 2, niveisEnsino: ['EF1'], obrigatoria: true, situacao: 'ativa',
}

// Gera código a partir das iniciais do nome + número sequencial
// Ex: "Matemática" → "MAT", "Língua Portuguesa" → "LP", n=1 → "MAT001"
function gerarCodigoDisc(nome: string, existentes: string[]): string {
  const tokens = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(t => t.length > 1)
  const sigla = tokens.length >= 2 ? tokens.map(t => t[0]).join('') : tokens[0]?.slice(0, 3) ?? 'DSC'
  let i = 1
  let cod = `${sigla}${String(i).padStart(3, '0')}`
  while (existentes.includes(cod)) { i++; cod = `${sigla}${String(i).padStart(3, '0')}` }
  return cod
}

export default function DisciplinasPage() {
  const queryClient = useQueryClient()

  const { data: cfgDisciplinas = [], isLoading: loadDisc } = useQuery<ConfigDisciplina[]>({
    queryKey: ['cfgDisciplinas'], queryFn: async () => { const r = await fetch('/api/configuracoes/disciplinas'); return r.json() }
  })
  const { data: turmas = [], isLoading: loadTur } = useQuery<any[]>({
    queryKey: ['turmas'], queryFn: async () => { const r = await fetch('/api/turmas'); return r.json() }
  })
  const isLoading = loadDisc || loadTur

  const addMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch('/api/configuracoes/disciplinas', { method: 'POST', body: JSON.stringify(data) }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgDisciplinas'] })
  })
  const updateMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch(`/api/configuracoes/disciplinas/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgDisciplinas'] })
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/configuracoes/disciplinas/${id}`, { method: 'DELETE' }); return r.json() },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfgDisciplinas'] })
  })
  const [search, setSearch] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativa' | 'inativa'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'obrigatoria' | 'optativa'>('todos')
  const [filtroTurno, setFiltroTurno] = useState('todos')
  const [filtroTurma, setFiltroTurma] = useState('todos')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const codigosExistentes = cfgDisciplinas.map(d => d.codigo)
  // Preview em tempo real: gera código baseado no nome sendo digitado
  const codigoPreview = form.nome
    ? (editId ? form.codigo : gerarCodigoDisc(form.nome, codigosExistentes))
    : ''
  const turmasUnicas = useMemo(() => [...new Set(turmas.map(t => t.nome))].sort(), [turmas])

  const filtered = useMemo(() =>
    cfgDisciplinas.filter(d => {
      const matchSearch = search.trim().length < 3 || (d.nome.toLowerCase().includes(search.toLowerCase()) || d.codigo.includes(search.toUpperCase()))
      const matchNivel = filtroNivel === 'todos' || d.niveisEnsino.includes(filtroNivel)
      const matchSit = filtroSituacao === 'todos' || d.situacao === filtroSituacao
      const matchTipo = filtroTipo === 'todos' || (filtroTipo === 'obrigatoria' ? d.obrigatoria : !d.obrigatoria)
      return matchSearch && matchNivel && matchSit && matchTipo
    }), [cfgDisciplinas, search, filtroNivel, filtroSituacao, filtroTipo])

  const hasFilters = filtroNivel !== 'todos' || filtroSituacao !== 'todos' || filtroTipo !== 'todos' || filtroTurno !== 'todos' || filtroTurma !== 'todos' || !!search

  const ativas = cfgDisciplinas.filter(d => d.situacao === 'ativa').length
  const obrigatorias = cfgDisciplinas.filter(d => d.obrigatoria).length

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (d: ConfigDisciplina) => { setEditId(d.id); setForm({ codigo: d.codigo, nome: d.nome, cargaHoraria: d.cargaHoraria, niveisEnsino: d.niveisEnsino, obrigatoria: d.obrigatoria, situacao: d.situacao }); setShowForm(true) }
  const handleDelete = (id: string) => deleteMutation.mutate(id)

  const toggleNivel = (n: string) =>
    setForm(prev => ({
      ...prev,
      niveisEnsino: prev.niveisEnsino.includes(n) ? prev.niveisEnsino.filter(x => x !== n) : [...prev.niveisEnsino, n]
    }))

  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = editId ? form.codigo : gerarCodigoDisc(form.nome, codigosExistentes)
    if (editId) {
      updateMutation.mutate({ ...form, id: editId, codigo })
    } else {
      addMutation.mutate({ ...form, codigo })
    }
    setShowForm(false)
  }

  const limparFiltros = () => {
    setSearch(''); setFiltroNivel('todos'); setFiltroSituacao('todos')
    setFiltroTipo('todos'); setFiltroTurno('todos'); setFiltroTurma('todos')
  }

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando disciplinas...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Disciplinas</h1>
          <p className="page-subtitle">Cadastro global de disciplinas — {cfgDisciplinas.length} registradas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Disciplina</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgDisciplinas.length, color: '#3b82f6' },
          { label: 'Ativas', value: ativas, color: '#10b981' },
          { label: 'Obrigatórias', value: obrigatorias, color: '#8b5cf6' },
          { label: 'Filtradas', value: filtered.length, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar disciplina ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 130 }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
          <option value="todos">🕐 Turno</option>
          {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ width: 150 }} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
          <option value="todos">🏫 Turma</option>
          {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={limparFiltros}>✕ Limpar</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Nível */}
        <div className="tab-list">
          {['todos', ...NIVEIS_OPTS].map(n => (
            <button key={n} className={`tab-trigger ${filtroNivel === n ? 'active' : ''}`} onClick={() => setFiltroNivel(n)}
              style={filtroNivel === n && n !== 'todos' ? { color: NIVEL_COLORS[n], borderColor: `${NIVEL_COLORS[n]}60`, background: `${NIVEL_COLORS[n]}18` } : {}}>
              {n === 'todos' ? 'Todos os níveis' : n}
            </button>
          ))}
        </div>
        {/* Situação */}
        <div className="tab-list">
          {(['todos', 'ativa', 'inativa'] as const).map(s => (
            <button key={s} className={`tab-trigger ${filtroSituacao === s ? 'active' : ''}`} onClick={() => setFiltroSituacao(s)}>
              {s === 'todos' ? 'Situação' : s === 'ativa' ? '✓ Ativas' : '✗ Inativas'}
            </button>
          ))}
        </div>
        {/* Tipo */}
        <div className="tab-list">
          {(['todos', 'obrigatoria', 'optativa'] as const).map(t => (
            <button key={t} className={`tab-trigger ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}>
              {t === 'todos' ? 'Tipo' : t === 'obrigatoria' ? 'Obrigatórias' : 'Optativas'}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Disciplina' : '➕ Nova Disciplina'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Código auto-gerado — somente leitura */}
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', color: '#60a5fa', letterSpacing: '0.03em' }}>
                  {codigoPreview || '—'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Gerado das iniciais</div>
            </div>
            <div>
              <label className="form-label">Nome da Disciplina *</label>
              <input className="form-input" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Matemática, Língua Portuguesa..." />
            </div>
            <div>
              <label className="form-label">Carga Horária (h/sem)</label>
              <input className="form-input" type="number" min={1} max={20} value={form.cargaHoraria} onChange={e => setForm(p => ({ ...p, cargaHoraria: +e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Níveis de Ensino aplicáveis</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {NIVEIS_OPTS.map(n => (
                  <button key={n} type="button" onClick={() => toggleNivel(n)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${form.niveisEnsino.includes(n) ? NIVEL_COLORS[n] : 'hsl(var(--border-default))'}`,
                      background: form.niveisEnsino.includes(n) ? `${NIVEL_COLORS[n]}22` : 'transparent',
                      color: form.niveisEnsino.includes(n) ? NIVEL_COLORS[n] : 'hsl(var(--text-muted))',
                    }}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setForm(p => ({ ...p, obrigatoria: true }))} className={`btn btn-sm ${form.obrigatoria ? 'btn-primary' : 'btn-secondary'}`}>✓ Obrigatória</button>
                <button type="button" onClick={() => setForm(p => ({ ...p, obrigatoria: false }))} className={`btn btn-sm ${!form.obrigatoria ? 'btn-primary' : 'btn-secondary'}`}>Optativa</button>
              </div>
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativa' | 'inativa' }))}>
                <option value="ativa">✓ Ativa</option>
                <option value="inativa">✗ Inativa</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar Alterações' : 'Cadastrar Disciplina'}</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {cfgDisciplinas.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhuma disciplina cadastrada</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Ex: Matemática, Português, Ciências...</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Cadastrar primeira disciplina</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Código</th>
                <th>Nome</th>
                <th>Níveis de Ensino</th>
                <th style={{ textAlign: 'center' }}>Carga</th>
                <th style={{ textAlign: 'center' }}>Tipo</th>
                <th style={{ textAlign: 'center' }}>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 800 }}>{d.codigo}</code></td>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{d.nome}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {d.niveisEnsino.map(n => (
                        <span key={n} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${NIVEL_COLORS[n] ?? '#6b7280'}22`, color: NIVEL_COLORS[n] ?? '#6b7280', fontWeight: 700 }}>{n}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{d.cargaHoraria}h</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${d.obrigatoria ? 'badge-primary' : 'badge-neutral'}`}>{d.obrigatoria ? 'Obrigatória' : 'Optativa'}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${d.situacao === 'ativa' ? 'badge-success' : 'badge-neutral'}`}>{d.situacao === 'ativa' ? '✓ Ativa' : '✗ Inativa'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(d)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(d.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhuma disciplina com esses filtros — <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={limparFiltros}>limpar</button>
            </div>
          )}
          <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            {filtered.length} de {cfgDisciplinas.length} disciplinas
          </div>
        </div>
      )}
    </div>
  )
}
