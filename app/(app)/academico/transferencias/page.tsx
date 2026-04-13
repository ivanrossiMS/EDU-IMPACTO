'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData, Transferencia, newId } from '@/lib/dataContext'
import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowRightLeft, Plus, CheckCircle, FileText, Download, X, Search, Pencil } from 'lucide-react'
import { getInitials } from '@/lib/utils'

type StatusTransferencia = Transferencia['status']

const STATUS_CFG: Record<StatusTransferencia, { color: string; badge: string; label: string }> = {
  pendente:  { color: '#f59e0b', badge: 'badge-warning',  label: '⏳ Pendente' },
  aprovado:  { color: '#3b82f6', badge: 'badge-primary',  label: '✓ Aprovado' },
  enviado:   { color: '#10b981', badge: 'badge-success',  label: '📤 Enviado' },
  recebido:  { color: '#10b981', badge: 'badge-success',  label: '📥 Recebido' },
}

const BLANK: Omit<Transferencia, 'id' | 'createdAt'> = {
  alunoNome: '', tipo: 'saida', escola: '', motivo: '', data: '', status: 'pendente', docs: [],
}

// ── Autocomplete de aluno ────────────────────────────────────────────────────
function AlunoSearchInput({ value, onChange, alunos }: {
  value: string; onChange: (nome: string) => void
  alunos: { id: string; nome: string; turma: string }[]
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = alunos.filter(a => a.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Search size={12} style={{ color: 'hsl(var(--text-muted))' }} />
      </div>
      <input
        className="form-input"
        style={{ paddingLeft: 30 }}
        placeholder="Buscar aluno pelo nome..."
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', overflow: 'hidden', marginTop: 4 }}>
          {filtered.map(a => (
            <button key={a.id} type="button"
              onMouseDown={() => { onChange(a.nome); setQ(a.nome); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-hover))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
                {getInitials(a.nome)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function TransferenciasPage() {
  const { transferencias = [], setTransferencias } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [tab, setTab] = useState<'lista' | 'solicitar'>('lista')
  const [form, setForm] = useState<Omit<Transferencia, 'id' | 'createdAt'>>(BLANK)
  const [docsInput, setDocsInput] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  // ── Filtros ──
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'saida' | 'entrada'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusTransferencia>('todos')
  const [filtroTurma, setFiltroTurma] = useState('todas')
  const [filtroAno, setFiltroAno] = useState('todos')

  const anos = useMemo(() => {
    const set = new Set(
      transferencias
        .map(t => { try { return new Date(t.createdAt).getFullYear() } catch { return null } })
        .filter(Boolean) as number[]
    )
    return [...set].sort().reverse()
  }, [transferencias])

  const turmasDisponiveis = useMemo(() => [...new Set((alunos || []).map(a => a.turma))].filter(Boolean).sort(), [alunos])

  const filtered = useMemo(() => transferencias.filter(t => {
    const mb = !busca || t.alunoNome.toLowerCase().includes(busca.toLowerCase()) || (t.escola || '').toLowerCase().includes(busca.toLowerCase())
    const mt = filtroTipo === 'todos' || t.tipo === filtroTipo
    const ms = filtroStatus === 'todos' || t.status === filtroStatus
    const mtur = filtroTurma === 'todas' || (alunos || []).find(a => a.nome === t.alunoNome)?.turma === filtroTurma
    const mano = filtroAno === 'todos' || (() => { try { return String(new Date(t.createdAt).getFullYear()) === filtroAno } catch { return false } })()
    return mb && mt && ms && mtur && mano
  }), [transferencias, busca, filtroTipo, filtroStatus, filtroTurma, filtroAno, alunos])

  const hasFilters = !!(busca || filtroTipo !== 'todos' || filtroStatus !== 'todos' || filtroTurma !== 'todas' || filtroAno !== 'todos')
  const clearFilters = () => { setBusca(''); setFiltroTipo('todos'); setFiltroStatus('todos'); setFiltroTurma('todas'); setFiltroAno('todos') }

  const saidas = transferencias.filter(t => t.tipo === 'saida').length
  const entradas = transferencias.filter(t => t.tipo === 'entrada').length
  const pendentes = transferencias.filter(t => t.status === 'pendente').length

  const handleAdd = () => {
    if (!form.alunoNome.trim()) return
    const docs = docsInput.split(',').map(d => d.trim()).filter(Boolean)
    if (editId) {
      setTransferencias(prev => prev.map(t => t.id === editId ? { ...t, ...form, docs, data: form.data || t.data } : t))
      setEditId(null)
    } else {
      const nova: Transferencia = {
        ...form,
        id: newId('TR'),
        data: form.data || new Date().toLocaleDateString('pt-BR'),
        docs,
        createdAt: new Date().toISOString(),
      }
      setTransferencias(prev => [nova, ...prev])
    }
    setForm(BLANK)
    setDocsInput('')
    setTab('lista')
  }

  const handleEdit = (t: Transferencia) => {
    setForm({ alunoNome: t.alunoNome, tipo: t.tipo, escola: t.escola, motivo: t.motivo, data: t.data, status: t.status, docs: t.docs })
    setDocsInput(t.docs.join(', '))
    setEditId(t.id)
    setTab('solicitar')
  }

  const handleAvancar = (id: string) => {
    setTransferencias(prev => prev.map(t => {
      if (t.id !== id) return t
      const next: StatusTransferencia = t.status === 'pendente' ? 'aprovado' : t.status === 'aprovado' ? 'enviado' : 'recebido'
      return { ...t, status: next }
    }))
  }

  const handleDelete = (id: string) => setTransferencias(prev => prev.filter(t => t.id !== id))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transferências</h1>
          <p className="page-subtitle">{saidas} saídas • {entradas} entradas • {pendentes} pendentes</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setTab('solicitar')}><Plus size={13} />Nova Transferência</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: transferencias.length, color: '#3b82f6', icon: '🔄' },
          { label: 'Saídas', value: saidas, color: '#ef4444', icon: '📤' },
          { label: 'Entradas', value: entradas, color: '#10b981', icon: '📥' },
          { label: 'Pendentes', value: pendentes, color: '#f59e0b', icon: '⏳' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 16, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>Lista de Transferências</button>
        <button className={`tab-trigger ${tab === 'solicitar' ? 'active' : ''}`} onClick={() => setTab('solicitar')}>Solicitar Transferência</button>
      </div>

      {/* Formulário */}
      {tab === 'solicitar' && (
        <div className="card" style={{ padding: '24px', maxWidth: 700, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{editId ? 'Editar Transferência' : 'Nova Solicitação de Transferência'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Aluno *</label>
              <AlunoSearchInput value={form.alunoNome} onChange={v => setForm(p => ({ ...p, alunoNome: v }))} alunos={alunos || []} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'saida' | 'entrada' }))}>
                  <option value="saida">📤 Saída (aluno vai para outra escola)</option>
                  <option value="entrada">📥 Entrada (aluno vem de outra escola)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">{form.tipo === 'saida' ? 'Escola de Destino' : 'Escola de Origem'}</label>
              <input className="form-input" value={form.escola} onChange={e => setForm(p => ({ ...p, escola: e.target.value }))} placeholder="Nome da escola" />
            </div>
            <div>
              <label className="form-label">Motivo</label>
              <input className="form-input" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex: Mudança de bairro, troca de escola" />
            </div>
            <div>
              <label className="form-label">Documentos (separados por vírgula)</label>
              <input className="form-input" value={docsInput} onChange={e => setDocsInput(e.target.value)} placeholder="Ex: RG, Histórico, Declaração de Matrícula" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setTab('lista'); setEditId(null); setForm(BLANK); setDocsInput('') }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>{editId ? <><Pencil size={13} />Salvar Alterações</> : <><Plus size={13} />Registrar Transferência</>}</button>
          </div>
        </div>
      )}

      {tab === 'lista' && (
        <>
          {/* ── Barra de Filtros ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '14px 18px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Buscar aluno ou escola..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 5 }}>
              {[['todos', 'Todos'], ['saida', '📤 Saída'], ['entrada', '📥 Entrada']].map(([v, l]) => (
                <button key={v} onClick={() => setFiltroTipo(v as any)}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: filtroTipo === v ? '#3b82f620' : 'transparent',
                    border: `1px solid ${filtroTipo === v ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                    color: filtroTipo === v ? '#3b82f6' : 'hsl(var(--text-muted))' }}>{l}</button>
              ))}
            </div>

            {/* Status */}
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
              <option value="todos">Todos os status</option>
              <option value="pendente">⏳ Pendente</option>
              <option value="aprovado">✓ Aprovado</option>
              <option value="enviado">📤 Enviado</option>
              <option value="recebido">📥 Recebido</option>
            </select>

            {/* Turma */}
            {turmasDisponiveis.length > 0 && (
              <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                <option value="todas">Todas as turmas</option>
                {turmasDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {/* Ano */}
            {anos.length > 0 && (
              <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                <option value="todos">Todos os anos</option>
                {anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
              </select>
            )}

            {hasFilters && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={clearFilters}>✕ Limpar</button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length}/{transferencias.length} resultado(s)</span>
          </div>

          {/* ── Lista ── */}
          {transferencias.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <ArrowRightLeft size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhuma transferência registrada</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Registre transferências de entrada e saída de alunos.</div>
              <button className="btn btn-primary" onClick={() => setTab('solicitar')}><Plus size={14} />Registrar primeira transferência</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhuma transferência com esses filtros</div>
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Limpar filtros</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(t => {
                const cfg = STATUS_CFG[t.status]
                const turmaAluno = (alunos || []).find(a => a.nome === t.alunoNome)?.turma
                return (
                  <div key={t.id} className="card" style={{ padding: '20px', borderLeft: `4px solid ${t.tipo === 'saida' ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div className="avatar" style={{ width: 44, height: 44, fontSize: 14, background: t.tipo === 'saida' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: t.tipo === 'saida' ? '#f87171' : '#34d399', flexShrink: 0 }}>
                        {getInitials(t.alunoNome)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{t.alunoNome}</span>
                          {turmaAluno && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{turmaAluno}</span>}
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: t.tipo === 'saida' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: t.tipo === 'saida' ? '#f87171' : '#34d399', fontWeight: 700 }}>
                            {t.tipo === 'saida' ? '📤 Saída' : '📥 Entrada'}
                          </span>
                          <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12, marginBottom: 10 }}>
                          <div><span style={{ color: 'hsl(var(--text-muted))' }}>{t.tipo === 'saida' ? 'Destino' : 'Origem'}: </span><span style={{ fontWeight: 600 }}>{t.escola || '—'}</span></div>
                          <div><span style={{ color: 'hsl(var(--text-muted))' }}>Motivo: </span><span style={{ fontWeight: 600 }}>{t.motivo || '—'}</span></div>
                          <div><span style={{ color: 'hsl(var(--text-muted))' }}>Data: </span><span style={{ fontWeight: 600 }}>{t.data}</span></div>
                        </div>
                        {t.docs.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {t.docs.map(doc => (
                              <span key={doc} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))' }}>
                                <FileText size={9} style={{ display: 'inline', marginRight: 4 }} />{doc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {t.status !== 'recebido' && (
                          <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => handleAvancar(t.id)}>
                            <CheckCircle size={11} />Avançar
                          </button>
                        )}
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#3b82f6' }} onClick={() => handleEdit(t)} title="Editar transferência">
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(t.id)}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
