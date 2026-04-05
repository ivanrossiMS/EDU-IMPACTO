'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useData, Turma } from '@/lib/dataContext'
import { ConfirmModal, EmptyState } from '@/components/ui/CrudModal'
import TurmaModal from '@/components/turmas/TurmaModal'
import { Plus, Search, Grid, List, Pencil, Trash2, Users, BookOpen, Clock } from 'lucide-react'

const SEGMENTOS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const SEG_COLORS: Record<string, string> = {
  EI: '#10b981', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#f59e0b', EJA: '#ec4899',
}

function OccupancyRing({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={26} cy={26} r={20} fill="none" stroke="hsl(var(--bg-overlay))" strokeWidth={5} />
        <circle cx={26} cy={26} r={20} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${(pct / 100) * 125.7} 125.7`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color }}>
        {pct}%
      </div>
    </div>
  )
}

export default function TurmasPage() {
  const { alunos, logSystemAction } = useData()
  const queryClient = useQueryClient()

  const { data: turmas = [], isLoading } = useQuery<any[]>({
    queryKey: ['turmas'],
    queryFn: async () => {
      const res = await fetch('/api/turmas')
      if (!res.ok) throw new Error('Erro ao carregar turmas')
      return res.json()
    },
    staleTime: 30_000,
  })

  const [view, setView] = useState<'grid' | 'lista'>('grid')
  const [segmento, setSegmento] = useState('Todos')
  const [turno, setTurno] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Conta alunos: prioriza turmaId (vínculo direto) e faz fallback pelo nome da turma
  const alunosDaTurma = (turmaId: string, turmaNome: string) =>
    alunos.filter(a =>
      (a as any).turmaId === turmaId ||
      (!((a as any).turmaId) && a.turma === turmaNome)
    ).length
  const anosDisponiveis = [...new Set(turmas.map(t => String(t.ano)).filter(Boolean))].sort().reverse()

  const filtered = turmas.filter(t => {
    const matchSeg = segmento === 'Todos' || t.serie === segmento
    const matchTurno = turno === 'Todos' || t.turno === turno
    const matchAno = filtroAno === 'Todos' || String(t.ano) === filtroAno
    const matchSearch = search.trim().length < 3 || (t.nome.toLowerCase().includes(search.toLowerCase()) || t.professor.toLowerCase().includes(search.toLowerCase()))
    return matchSeg && matchTurno && matchAno && matchSearch
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/turmas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao deletar turma')
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] })
      const turmaAntiga = turmas.find((t: any) => t.id === deletedId)
      logSystemAction('Acadêmico (Turmas)', 'Exclusão', `Exclusão permanente da turma`, { registroId: turmaAntiga?.codigo, nomeRelacionado: turmaAntiga?.nome })
    }
  })

  const handleDelete = () => {
    if (confirmId) deleteMutation.mutate(confirmId)
    setConfirmId(null)
  }

  const totalAlunos = turmas.reduce((s, t) => s + alunosDaTurma(t.id, t.nome), 0)
  const totalVagas = turmas.reduce((s, t) => s + (t.capacidade - alunosDaTurma(t.id, t.nome)), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Turmas & Ensalamento</h1>
          <p className="page-subtitle" suppressHydrationWarning>
            {mounted ? `${turmas.length} turmas • ${totalAlunos} alunos ensalados • ${totalVagas} vagas livres` : 'Carregando...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="tab-list" style={{ padding: '3px' }}>
            <button className={`tab-trigger ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}><Grid size={13} />Cards</button>
            <button className={`tab-trigger ${view === 'lista' ? 'active' : ''}`} onClick={() => setView('lista')}><List size={13} />Lista</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setShowModal(true) }}>
            <Plus size={13} />Nova Turma
          </button>
        </div>
      </div>

      {/* KPIs */}
      {turmas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Turmas', value: turmas.length, color: '#3b82f6', icon: '📚' },
            { label: 'Vagas Livres', value: totalVagas, color: '#10b981', icon: '📋' },
            { label: 'Alunos Ensalados', value: totalAlunos, color: '#8b5cf6', icon: '👥' },
            { label: 'Turmas Lotadas', value: turmas.filter(t => alunosDaTurma(t.id, t.nome) >= t.capacidade).length, color: '#ef4444', icon: '⚠️' },
            { label: 'Median Ocup.', value: turmas.length > 0 ? `${Math.round(turmas.reduce((s, t) => s + (t.capacidade > 0 ? alunosDaTurma(t.id, t.nome) / t.capacidade * 100 : 0), 0) / turmas.length)}%` : '0%', color: '#f59e0b', icon: '📊' },
          ].map(c => (
            <div key={c.label} className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar turma ou professor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-list">
          {['Todos', ...SEGMENTOS].map(s => (
            <button key={s} className={`tab-trigger ${segmento === s ? 'active' : ''}`} onClick={() => setSegmento(s)}>{s}</button>
          ))}
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={turno} onChange={e => setTurno(e.target.value)}>
          {['Todos', 'Manha', 'Tarde', 'Noite', 'Integral'].map(t => <option key={t}>{t}</option>)}
        </select>
        {anosDisponiveis.length > 0 && (
          <select className="form-input" style={{ width: 'auto' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="Todos">Todos os anos</option>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {(segmento !== 'Todos' || turno !== 'Todos' || filtroAno !== 'Todos' || search) && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setSegmento('Todos'); setTurno('Todos'); setFiltroAno('Todos'); setSearch('') }}>✕ Limpar</button>
        )}
        <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length}/{turmas.length} turma(s)</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign:'center', padding:'48px 24px', color:'hsl(var(--text-muted))' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontWeight:600 }}>Carregando dados das turmas e ensalamento...</div>
        </div>
      ) : turmas.length === 0 ? (
        <EmptyState icon="📚" title="Nenhuma turma criada"
          description="Crie as turmas do ano letivo para iniciar o ensalamento de alunos."
          action={<button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true) }}><Plus size={14} />Criar Primeira Turma</button>} />
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {filtered.map(turma => {
            const mat = alunosDaTurma(turma.id, turma.nome)
            const pct = turma.capacidade > 0 ? Math.round((mat / turma.capacidade) * 100) : 0
            const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
            const lotada = mat >= turma.capacidade
            return (
              <div key={turma.id} className="card" style={{ padding: '20px', border: `1px solid ${color}20`, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}50`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}20`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <OccupancyRing pct={pct} color={lotada ? '#ef4444' : pct >= 85 ? '#f59e0b' : color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color }}>{turma.nome}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => { setEditingId(turma.id); setShowModal(true) }}><Pencil size={12} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={() => setConfirmId(turma.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="badge badge-primary" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{turma.serie}</span>
                      <span className="badge badge-neutral">{turma.turno}</span>
                      {turma.ano && <span className="badge badge-neutral">{turma.ano}</span>}
                      {lotada && <span className="badge badge-danger">Lotada</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Alunos</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color }}>{mat}<span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>/{turma.capacidade}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Sala</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{turma.sala || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Professor(a) Responsavel</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{turma.professor || '—'}</div>
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" style={{ width: '100%', fontSize: 12 }} onClick={() => { setEditingId(turma.id); setShowModal(true) }}>
                  Ver detalhes e gerenciar
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Turma</th><th>Segmento</th><th>Turno</th><th>Professor(a)</th><th>Sala</th><th>Ano</th><th>Ocupacao</th><th>Acoes</th></tr>
            </thead>
            <tbody>
              {filtered.map(turma => {
                const mat = alunosDaTurma(turma.id, turma.nome)
                const pct = turma.capacidade > 0 ? Math.round((mat / turma.capacidade) * 100) : 0
                const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
                return (
                  <tr key={turma.id}>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: 15, color, fontFamily: 'Outfit,sans-serif' }}>{turma.nome}</span>
                    </td>
                    <td><span className="badge badge-primary" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{turma.serie}</span></td>
                    <td style={{ fontSize: 12 }}>{turma.turno}</td>
                    <td style={{ fontSize: 12 }}>{turma.professor || '—'}</td>
                    <td style={{ fontSize: 12 }}>{turma.sala || '—'}</td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{turma.ano}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : color }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? '#ef4444' : 'hsl(var(--text-secondary))' }}>{mat}/{turma.capacidade}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Gerenciar" onClick={() => { setEditingId(turma.id); setShowModal(true) }}><Pencil size={12} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(turma.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhuma turma com esses filtros</div>}
        </div>
      )}

      <TurmaModal open={showModal} onClose={() => setShowModal(false)} editingId={editingId} />

      <ConfirmModal open={confirmId !== null} onClose={() => setConfirmId(null)} onConfirm={handleDelete}
        message="A turma sera excluida permanentemente. Os alunos matriculados ficao sem turma." />
    </div>
  )
}
