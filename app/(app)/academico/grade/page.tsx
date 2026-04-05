'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotinaItem } from '@/lib/dataContext'
import { ArrowLeft, Download, Search, Clock, BookOpen, Users, Calendar } from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const DIA_IDX: Record<string, 1 | 2 | 3 | 4 | 5> = { Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5 }
const SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

const SEG_COLORS: Record<string, string> = {
  EI: '#10b981', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#f59e0b', EJA: '#ec4899',
}
const DISC_COLORS: Record<string, string> = {
  'Matemática':'#3b82f6','Português':'#10b981','História':'#f59e0b',
  'Geografia':'#8b5cf6','Ciências':'#06b6d4','Ed. Física':'#ef4444',
  'Arte':'#ec4899','Inglês':'#a78bfa','Filosofia':'#84cc16','Sociologia':'#f97316',
}
function getDiscColor(disc: string) { return DISC_COLORS[disc] ?? '#6366f1' }

// ─── Mini grade preview (para o card) ─────────────────────────────────────────
function MiniGrade({ turmaId, rotinaItems }: { turmaId: string; rotinaItems: RotinaItem[] }) {
  const aulas = rotinaItems.filter(r => r.turma === turmaId)
  if (aulas.length === 0) return (
    <div style={{ padding: '10px 0', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 11 }}>
      Sem horários configurados
    </div>
  )
  // dias com aulas
  const diasComAulas = DIAS.filter(d => aulas.some(r => r.diaSemana === DIA_IDX[d]))
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
      {diasComAulas.map(d => (
        <span key={d} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818cf8', letterSpacing: 0.3 }}>
          {d.substring(0, 3).toUpperCase()}
        </span>
      ))}
    </div>
  )
}

// ─── Grade completa de uma turma ──────────────────────────────────────────────
function GradeCompleta({ turmaId, rotinaItems }: { turmaId: string; rotinaItems: RotinaItem[] }) {
  const getCell = (dia: string, slot: string): RotinaItem | undefined =>
    rotinaItems.find(r => r.turma === turmaId && r.diaSemana === DIA_IDX[dia] && r.horaInicio === slot)

  const aulas = rotinaItems.filter(r => r.turma === turmaId)
  const disciplinas = [...new Set(aulas.map(a => a.disciplina))]

  if (aulas.length === 0) return (
    <div className="card" style={{ padding: '52px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🗓️</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhum horário configurado</div>
      <div style={{ fontSize: 13 }}>Configure em Configurações → Pedagógico → Horário de Aulas.</div>
    </div>
  )

  return (
    <>
      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid hsl(var(--border-subtle))' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr style={{ background: 'hsl(var(--bg-elevated))', borderBottom: '2px solid hsl(var(--border-subtle))' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 800, width: 90, letterSpacing: 0.5 }}>HORÁRIO</th>
              {DIAS.map(d => (
                <th key={d} style={{ padding: '12px 10px', textAlign: 'center', fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 800, letterSpacing: 0.5 }}>{d.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.slice(0, -1).map((slot, si) => {
              const cells = DIAS.map(dia => getCell(dia, slot))
              return (
                <tr key={slot} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding: '6px 16px', fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, whiteSpace: 'nowrap', background: 'hsl(var(--bg-elevated))', fontFamily: 'monospace' }}>
                    {slot}–{SLOTS[si + 1]}
                  </td>
                  {DIAS.map(dia => {
                    const cell = getCell(dia, slot)
                    const cor = cell ? getDiscColor(cell.disciplina) : 'transparent'
                    return (
                      <td key={dia} style={{ padding: '4px 5px', textAlign: 'center' }}>
                        {cell ? (
                          <div style={{
                            minHeight: 58, padding: '7px 8px', borderRadius: 10,
                            background: `${cor}14`, border: `1.5px solid ${cor}35`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: cor, lineHeight: 1.2 }}>{cell.disciplina}</div>
                            {cell.professor && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', lineHeight: 1 }}>{cell.professor.split(' ').slice(-1)[0]}</div>}
                            {cell.sala && <div style={{ fontSize: 9, color: 'hsl(var(--text-disabled))', fontWeight: 700, marginTop: 1 }}>🚪 {cell.sala}</div>}
                          </div>
                        ) : (
                          <div style={{ minHeight: 58, borderRadius: 10, border: '1px dashed hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 10, color: 'hsl(var(--text-disabled))' }}>—</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      {disciplinas.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', letterSpacing: 0.5 }}>LEGENDA:</span>
          {disciplinas.map(d => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: getDiscColor(d) }} />
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function GradePage() {
  const { data: turmas = [], isLoading: loadTur } = useQuery<any[]>({
    queryKey: ['turmas'], queryFn: async () => { const r = await fetch('/api/turmas'); return r.json() }
  })
  const { data: rotinaItems = [], isLoading: loadRot } = useQuery<any[]>({
    queryKey: ['rotinaItems'], queryFn: async () => { const r = await fetch('/api/academico/rotina'); return r.json() }
  })
  const { data: alunos = [], isLoading: loadAl } = useQuery<any[]>({
    queryKey: ['alunos'], queryFn: async () => { const r = await fetch('/api/alunos'); return r.json() }
  })

  const isLoading = loadTur || loadRot || loadAl

  const [mounted, setMounted] = useState(false)
  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtroSeg, setFiltroSeg] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [filtroTurno, setFiltroTurno] = useState('Todos')

  useEffect(() => setMounted(true), [])

  const anosDisponiveis = useMemo(() =>
    [...new Set(turmas.map(t => String(t.ano)).filter(Boolean))].sort().reverse(),
  [turmas])

  const turmasFiltradas = useMemo(() => turmas.filter(t => {
    const matchSeg = filtroSeg === 'Todos' || t.serie === filtroSeg
    const matchAno = filtroAno === 'Todos' || String(t.ano) === filtroAno
    const matchTurno = filtroTurno === 'Todos' || t.turno === filtroTurno
    const matchSearch = search.trim().length < 3 || (!search || t.nome.toLowerCase().includes(search.toLowerCase()) || t.professor?.toLowerCase().includes(search.toLowerCase()))
    return matchSeg && matchAno && matchTurno && matchSearch
  }), [turmas, filtroSeg, filtroAno, filtroTurno, search])

  const turmaAtiva = turmaSel ? turmas.find(t => t.id === turmaSel) : null

  // ── TELA DE GRADE DA TURMA ──
  if (turmaAtiva) {
    const segColor = SEG_COLORS[turmaAtiva.serie] ?? '#6366f1'
    const totalAulas = rotinaItems.filter(r => r.turma === turmaAtiva.id).length
    const qtdAlunos = alunos.filter(a => (a as any).turmaId === turmaAtiva.id || a.turma === turmaAtiva.nome).length

    return (
      <div>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <button
            onClick={() => setTurmaSel(null)}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <ArrowLeft size={14} /> Grade Horária
          </button>
          <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: segColor }}>{turmaAtiva.nome}</span>
        </div>

        {/* Header da turma */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: `linear-gradient(135deg,${segColor}12,${segColor}06)`,
          border: `1px solid ${segColor}25`, borderRadius: 16, marginBottom: 20, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${segColor}20`, border: `2px solid ${segColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: segColor, fontFamily: 'Outfit, sans-serif' }}>
              {turmaAtiva.nome.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: segColor, fontFamily: 'Outfit, sans-serif' }}>{turmaAtiva.nome}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {[turmaAtiva.serie, turmaAtiva.turno, `Ano ${turmaAtiva.ano}`].map(tag => (
                  <span key={tag} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: `${segColor}15`, color: segColor, fontWeight: 700 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { icon: '📚', label: 'Aulas/sem.', value: totalAulas },
              { icon: '👥', label: 'Alunos', value: qtdAlunos },
              { icon: '🚪', label: 'Sala', value: turmaAtiva.sala || '—' },
              { icon: '👨‍🏫', label: 'Professor(a)', value: turmaAtiva.professor || '—' },
            ].map(k => (
              <div key={k.label} style={{ padding: '8px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', minWidth: 80, textAlign: 'center' }}>
                <div style={{ fontSize: 14, marginBottom: 2 }}>{k.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: segColor }}>{k.value}</div>
                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700, letterSpacing: 0.4 }}>{k.label}</div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }}>
              <Download size={13} /> Exportar
            </button>
          </div>
        </div>

        <GradeCompleta turmaId={turmaAtiva.id} rotinaItems={rotinaItems} />
      </div>
    )
  }

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando grade horária...</div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Grade Horária</h1>
          <p className="page-subtitle" suppressHydrationWarning>
            {mounted ? `${turmas.length} turma${turmas.length !== 1 ? 's' : ''} cadastrada${turmas.length !== 1 ? 's' : ''} · Selecione uma turma para ver a grade` : 'Carregando...'}
          </p>
        </div>
      </div>

      {turmas.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhuma turma cadastrada</div>
          <div style={{ fontSize: 13 }}>Cadastre turmas em Acadêmico → Turmas para visualizar a grade horária.</div>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar turma ou professor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Segmento */}
            <div className="tab-list">
              {['Todos', 'EI', 'EF1', 'EF2', 'EM', 'EJA'].map(s => (
                <button key={s} className={`tab-trigger ${filtroSeg === s ? 'active' : ''}`} onClick={() => setFiltroSeg(s)}>{s}</button>
              ))}
            </div>
            {/* Turno */}
            <select className="form-input" style={{ width: 'auto' }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
              {['Todos', 'Manha', 'Tarde', 'Noite', 'Integral'].map(t => <option key={t}>{t}</option>)}
            </select>
            {/* Ano */}
            {anosDisponiveis.length > 0 && (
              <select className="form-input" style={{ width: 'auto' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                <option value="Todos">Todos os anos</option>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            {/* Limpar */}
            {(filtroSeg !== 'Todos' || filtroTurno !== 'Todos' || filtroAno !== 'Todos' || search) && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setFiltroSeg('Todos'); setFiltroTurno('Todos'); setFiltroAno('Todos'); setSearch('') }}>✕ Limpar</button>
            )}
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{turmasFiltradas.length}/{turmas.length} turma(s)</span>
          </div>

          {/* Cards */}
          {turmasFiltradas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Nenhuma turma com esses filtros</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
              {turmasFiltradas.map(turma => {
                const segColor = SEG_COLORS[turma.serie] ?? '#6366f1'
                const totalAulas = rotinaItems.filter(r => r.turma === turma.id).length
                const qtdAlunos = alunos.filter(a => (a as any).turmaId === turma.id || a.turma === turma.nome).length
                const temGrade = totalAulas > 0

                return (
                  <div
                    key={turma.id}
                    onClick={() => setTurmaSel(turma.id)}
                    className="card"
                    style={{
                      padding: '20px', cursor: 'pointer',
                      border: `1.5px solid ${segColor}18`,
                      transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
                      position: 'relative', overflow: 'hidden',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(-4px)'
                      el.style.borderColor = `${segColor}55`
                      el.style.boxShadow = `0 16px 40px ${segColor}20`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'translateY(0)'
                      el.style.borderColor = `${segColor}18`
                      el.style.boxShadow = 'none'
                    }}
                  >
                    {/* Barra colorida topo */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${segColor}, ${segColor}80)`, borderRadius: '10px 10px 0 0' }} />

                    {/* Header do card */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${segColor}18`, border: `2px solid ${segColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: segColor, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px', flexShrink: 0 }}>
                          {turma.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: segColor, fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>{turma.nome}</div>
                          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: `${segColor}15`, color: segColor, fontWeight: 700 }}>{turma.serie}</span>
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{turma.turno}</span>
                            {turma.ano && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{turma.ano}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Status da grade */}
                      <div style={{
                        fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 800,
                        background: temGrade ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                        color: temGrade ? '#10b981' : 'hsl(var(--text-muted))',
                        border: `1px solid ${temGrade ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.2)'}`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {temGrade ? `✓ ${totalAulas} aula${totalAulas !== 1 ? 's' : ''}` : '— Sem grade'}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { icon: <Users size={12} />, label: 'Alunos', value: qtdAlunos },
                        { icon: <Clock size={12} />, label: 'Aulas/sem.', value: totalAulas },
                        { icon: <BookOpen size={12} />, label: 'Professor(a)', value: turma.professor || '—' },
                        { icon: <Calendar size={12} />, label: 'Sala', value: turma.sala || '—' },
                      ].map(stat => (
                        <div key={stat.label} style={{ padding: '8px 10px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, color: 'hsl(var(--text-muted))' }}>{stat.icon}<span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{stat.label.toUpperCase()}</span></div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-base))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Mini preview dias */}
                    <MiniGrade turmaId={turma.id} rotinaItems={rotinaItems} />

                    {/* CTA */}
                    <div style={{ marginTop: 14, padding: '9px 14px', background: `${segColor}10`, border: `1px solid ${segColor}25`, borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: segColor }}>
                      Ver Grade Horária →
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
