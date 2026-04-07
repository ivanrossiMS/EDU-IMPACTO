'use client'

import { useData } from '@/lib/dataContext'
import { useState, useMemo, useCallback } from 'react'
import { getInitials } from '@/lib/utils'
import {
  ArrowLeft, Save, CheckCircle, Shuffle, Hash, Search, Users,
  ChevronRight, Edit3, X, GripVertical, ArrowUpDown, Printer
} from 'lucide-react'

const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

// Ensalamento de aluno: número de chamada, carteira, fileira
interface EnsalAluno {
  alunoId: string
  numeroChamada: number
  fileira: number
  carteira: number
  observacao: string
}

interface EnsalTurma {
  turmaId: string
  sala: string
  ensalamento: EnsalAluno[]
  updatedAt: string
}

// Ordenações para numeração de chamada
type OrdemTipo = 'alfa' | 'custom'

export default function EnsalamentoPage() {
  const { alunos, turmas } = useData()

  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [ensalData, setEnsalData] = useState<Record<string, EnsalTurma>>({})
  const [editSala, setEditSala] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [ordem, setOrdem] = useState<OrdemTipo>('alfa')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Filtros da home
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [filtroBuscaHome, setFiltroBuscaHome] = useState('')

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? turmaSel ?? ''
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  const alunosDaTurma = useMemo(() => {
    if (!turmaSel) return []
    return alunos.filter(a => a.turma === turmaSel)
  }, [alunos, turmaSel])

  // Ensalamento atual da turma
  const ensalTurma = useMemo<EnsalTurma>(() => {
    if (!turmaSel) return { turmaId:'', sala:'', ensalamento:[], updatedAt:'' }
    const saved = ensalData[turmaId]
    if (saved && saved.ensalamento.length === alunosDaTurma.length) return saved

    // Gera ensalamento padrão (ordem alfabética)
    const sorted = [...alunosDaTurma].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const cols = Math.ceil(sorted.length / 4) || 1
    const ensalamento: EnsalAluno[] = sorted.map((a, i) => ({
      alunoId: a.id,
      numeroChamada: i + 1,
      fileira: Math.floor(i / cols) + 1,
      carteira: (i % cols) + 1,
      observacao: '',
    }))
    return { turmaId, sala: turmaObj?.sala || '', ensalamento, updatedAt: '' }
  }, [turmaSel, turmaId, alunosDaTurma, ensalData, turmaObj])

  const [localEnsal, setLocalEnsal] = useState<EnsalAluno[]>([])
  const [localSala, setLocalSala] = useState('')

  // Inicializa ao entrar na turma
  const initTurma = useCallback((nome: string) => {
    setTurmaSel(nome)
    setBusca('')
    setOrdem('alfa')
    setEditSala(false)
  }, [])

  // Ao turmaSel mudar, inicializa localEnsal
  useMemo(() => {
    if (!turmaSel) return
    setLocalEnsal(ensalTurma.ensalamento)
    setLocalSala(ensalTurma.sala)
  }, [turmaSel, ensalTurma])

  const getAluno = (id: string) => alunos.find(a => a.id === id)

  const setObs = (alunoId: string, obs: string) =>
    setLocalEnsal(prev => prev.map(e => e.alunoId === alunoId ? { ...e, observacao: obs } : e))

  const renumerar = (list: EnsalAluno[]) => list.map((e, i) => ({ ...e, numeroChamada: i + 1 }))

  const sortAlfa = () => {
    const sorted = [...localEnsal].sort((a, b) => {
      const na = getAluno(a.alunoId)?.nome ?? ''
      const nb = getAluno(b.alunoId)?.nome ?? ''
      return na.localeCompare(nb, 'pt-BR')
    })
    setLocalEnsal(renumerar(sorted))
  }

  const handleSalvar = () => {
    setEnsalData(prev => ({
      ...prev,
      [turmaId]: { turmaId, sala: localSala, ensalamento: renumerar(localEnsal), updatedAt: new Date().toISOString() }
    }))
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  // Drag reorder
  const onDragStart = (i: number) => setDragIdx(i)
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIdx(i) }
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
    const copy = [...localEnsal]
    const [moved] = copy.splice(dragIdx, 1)
    copy.splice(i, 0, moved)
    setLocalEnsal(renumerar(copy))
    setDragIdx(null); setDragOverIdx(null)
  }

  const filteredEnsal = localEnsal.filter(e => {
    if (!busca) return true
    const nome = getAluno(e.alunoId)?.nome ?? ''
    return nome.toLowerCase().includes(busca.toLowerCase()) || String(e.numeroChamada).includes(busca)
  })

  // ── GRADE VISUAL da sala ──────────────────────────────────────────────────
  const numFileiras = turmaObj?.capacidade ? Math.ceil(localEnsal.length / 5) : Math.ceil(localEnsal.length / 5) || 1
  const numColunas = Math.min(5, localEnsal.length)
  const grid = Array.from({ length: numFileiras }, (_, fi) =>
    localEnsal.filter(e => e.fileira === fi + 1).sort((a, b) => a.carteira - b.carteira)
  )

  // ── VISTA HOME ────────────────────────────────────────────────────────────
  if (!turmaSel) {
    const turnosDisponiveis = [...new Set(turmas.map(t => t.turno).filter(Boolean))]
    const anosDisponiveis = [...new Set(turmas.map(t => String(t.ano)).filter(Boolean))].sort().reverse()
    const segsDisponiveis = [...new Set(turmas.map(t => t.serie).filter(Boolean))].sort()

    const turmasFiltradas = turmas.filter(t => {
      const mb = !filtroBuscaHome || t.nome.toLowerCase().includes(filtroBuscaHome.toLowerCase()) || (t.professor || '').toLowerCase().includes(filtroBuscaHome.toLowerCase())
      const ms = filtroSeg === 'todos' || t.serie === filtroSeg
      const mtu = filtroTurno === 'Todos' || t.turno === filtroTurno
      const ma = filtroAno === 'Todos' || String(t.ano) === filtroAno
      return mb && ms && mtu && ma
    })

    const hasFilters = !!(filtroBuscaHome || filtroSeg !== 'todos' || filtroTurno !== 'Todos' || filtroAno !== 'Todos')
    const clearFilters = () => { setFiltroBuscaHome(''); setFiltroSeg('todos'); setFiltroTurno('Todos'); setFiltroAno('Todos') }

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Ensalamento</h1>
            <p className="page-subtitle">Número de chamada, carteira e disposição de alunos por turma</p>
          </div>
        </div>

        {turmas.length === 0 ? (
          <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <Users size={40} style={{ margin:'0 auto 14px', opacity:0.15 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>Nenhuma turma cadastrada</div>
          </div>
        ) : (
          <>
            {/* ── Filtros ── */}
            <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center', padding:'14px 18px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
              <div style={{ position:'relative', flex:1, minWidth:180 }}>
                <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
                <input className="form-input" style={{ paddingLeft:30, fontSize:12 }} placeholder="Buscar turma ou professor..." value={filtroBuscaHome} onChange={e => setFiltroBuscaHome(e.target.value)} />
              </div>

              {/* Segmento */}
              {segsDisponiveis.length > 0 && (
                <div style={{ display:'flex', gap:5 }}>
                  {['todos', ...segsDisponiveis].map(s => (
                    <button key={s} onClick={() => setFiltroSeg(s)}
                      style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                        background: filtroSeg===s ? `${SEG_COLORS[s] ?? '#3b82f6'}15` : 'transparent',
                        border: `1px solid ${filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--border-subtle))'}`,
                        color: filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--text-muted))' }}>
                      {s === 'todos' ? 'Todos' : s}
                    </button>
                  ))}
                </div>
              )}

              {/* Turno */}
              {turnosDisponiveis.length > 0 && (
                <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                  <option value="Todos">Todos os turnos</option>
                  {turnosDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              {/* Ano */}
              {anosDisponiveis.length > 0 && (
                <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                  <option value="Todos">Todos os anos</option>
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {hasFilters && <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={clearFilters}>✕ Limpar</button>}
              <span style={{ marginLeft:'auto', fontSize:12, color:'hsl(var(--text-muted))' }}>{turmasFiltradas.length}/{turmas.length} turma(s)</span>
            </div>

            {turmasFiltradas.length === 0 ? (
              <div className="card" style={{ padding:'32px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
                <div style={{ fontSize:14, fontWeight:600 }}>Nenhuma turma com esses filtros</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={clearFilters}>✕ Limpar filtros</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
                {turmasFiltradas.map(turma => {
                  const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
                  const alunosTurma = alunos.filter(a => a.turma === turma.nome)
                  const saved = ensalData[turma.id]
                  const configurado = saved && saved.ensalamento.length > 0

                  return (
                    <button key={turma.id} onClick={() => initTurma(turma.nome)}
                      style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid ${color}25`, borderRadius:16, padding:'22px', cursor:'pointer', transition:'all 0.2s', display:'block', width:'100%', position:'relative', overflow:'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 32px ${color}25` }}
                      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(90deg, ${color}, ${color}80)` }} />

                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                        <div>
                          <div style={{ fontSize:24, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{turma.nome}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{turma.serie} • {turma.turno}{turma.ano ? ` • ${turma.ano}` : ''}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:28, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{alunosTurma.length}</div>
                          <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>alunos</div>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                        {turma.sala && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:`${color}12`, color, fontWeight:600 }}>🏫 {turma.sala}</span>}
                        {configurado
                          ? <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700 }}>✓ Ensalamento configurado</span>
                          : <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:700 }}>⚠ Não configurado</span>
                        }
                      </div>

                      {alunosTurma.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
                          {alunosTurma.slice(0,8).map((a, i) => (
                            <div key={a.id} style={{ width:26, height:26, borderRadius:7, background:`${color}15`, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>
                              {i+1}
                            </div>
                          ))}
                          {alunosTurma.length > 8 && <div style={{ width:26, height:26, borderRadius:7, background:'hsl(var(--bg-overlay))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'hsl(var(--text-muted))', fontWeight:700 }}>+{alunosTurma.length-8}</div>}
                        </div>
                      )}

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{turma.professor || 'Professor não definido'}</span>
                        <ChevronRight size={16} style={{ color }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── VISTA INTERNA: ensalamento da turma ───────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => { setTurmaSel(null); setBusca('') }}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Ensalamento — {turmaSel}</h1>
              <span style={{ padding:'2px 10px', borderRadius:20, background:`${color}15`, color, fontSize:11, fontWeight:700 }}>{turmaObj?.serie}</span>
            </div>
            <p className="page-subtitle">{alunosDaTurma.length} alunos • {localSala || 'Sala não definida'}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-ghost btn-sm" style={{ gap:6 }} onClick={() => window.print()}><Printer size={13} />Imprimir</button>
          <button className="btn btn-ghost btn-sm" onClick={sortAlfa}><ArrowUpDown size={13} />Ordenar A-Z</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditSala(p => !p)}><Edit3 size={13} />{editSala ? 'Fechar' : 'Editar Sala'}</button>
          <button className="btn btn-primary btn-sm" onClick={handleSalvar}>
            {salvo ? <><CheckCircle size={13} />Salvo!</> : <><Save size={13} />Salvar Ensalamento</>}
          </button>
        </div>
      </div>

      {/* Editar sala */}
      {editSala && (
        <div className="card" style={{ padding:'16px', marginBottom:16, border:'1px solid rgba(59,130,246,0.3)' }}>
          <label className="form-label">Sala / Local</label>
          <input className="form-input" value={localSala} onChange={e => setLocalSala(e.target.value)} placeholder="Ex: Sala 201, Bloco A, 2º Andar" />
        </div>
      )}

      {/* Layout: lista + grade da sala */}
      <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* ── Lista de chamada ── */}
        <div style={{ flex:1, minWidth:300 }}>
          {/* Cabeçalho filtro + acções */}
          <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
            <div style={{ position:'relative', flex:1 }}>
              <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
              <input className="form-input" style={{ paddingLeft:32 }} placeholder="Buscar por nome ou número..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))', whiteSpace:'nowrap' }}>{filteredEnsal.length} aluno(s)</span>
          </div>

          {/* Dica */}
          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
            <GripVertical size={12} />Arraste para reordenar • Número de chamada atualizado automaticamente
          </div>

          {/* Cabeçalho colunas */}
          <div style={{ display:'grid', gridTemplateColumns:'14px 44px 1fr 80px 80px', gap:12, padding:'8px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))', marginBottom:6 }}>
            {['','Nº','Aluno','Fileira','Carteira'].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filteredEnsal.map((e, displayIdx) => {
              const realIdx = localEnsal.findIndex(x => x.alunoId === e.alunoId)
              const aluno = getAluno(e.alunoId)
              const isDragging = dragIdx === realIdx
              const isDragOver = dragOverIdx === realIdx
              if (!aluno) return null
              return (
                <div key={e.alunoId}
                  draggable onDragStart={() => onDragStart(realIdx)} onDragOver={ev => onDragOver(ev, realIdx)} onDrop={() => onDrop(realIdx)} onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  style={{ display:'grid', gridTemplateColumns:'14px 44px 1fr 80px 80px', gap:12, padding:'11px 14px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:`1px solid ${isDragOver ? color : 'hsl(var(--border-subtle))'}`, alignItems:'center', cursor:'grab', opacity: isDragging ? 0.4 : 1, transition:'all 0.15s', boxShadow: isDragOver ? `0 4px 16px ${color}25` : '' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor=`${color}50`)}
                  onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.borderColor='hsl(var(--border-subtle))' }}>

                  {/* Drag handle */}
                  <GripVertical size={13} style={{ color:'hsl(var(--text-muted))', flexShrink:0 }} />

                  {/* Nº Chamada */}
                  <div style={{ width:36, height:36, borderRadius:10, background:`${color}15`, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, fontFamily:'Outfit,monospace', flexShrink:0 }}>
                    {e.numeroChamada}
                  </div>

                  {/* Aluno */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:'rgba(107,114,128,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#9ca3af', flexShrink:0 }}>
                      {getInitials(aluno.nome)}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{aluno.nome}</div>
                      {aluno.matricula && <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>Cód. {aluno.matricula}</div>}
                    </div>
                  </div>

                  {/* Fileira */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <input type="number" min={1} max={10} value={e.fileira}
                      onChange={ev => setLocalEnsal(prev => prev.map(x => x.alunoId === e.alunoId ? { ...x, fileira: Math.max(1, +ev.target.value) } : x))}
                      style={{ width:56, padding:'5px 8px', textAlign:'center', background:'hsl(var(--bg-overlay))', border:'1px solid hsl(var(--border-subtle))', borderRadius:8, fontWeight:700, color, fontFamily:'Outfit,monospace', fontSize:14 }} />
                  </div>

                  {/* Carteira */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <input type="number" min={1} max={10} value={e.carteira}
                      onChange={ev => setLocalEnsal(prev => prev.map(x => x.alunoId === e.alunoId ? { ...x, carteira: Math.max(1, +ev.target.value) } : x))}
                      style={{ width:56, padding:'5px 8px', textAlign:'center', background:'hsl(var(--bg-overlay))', border:'1px solid hsl(var(--border-subtle))', borderRadius:8, fontWeight:700, color, fontFamily:'Outfit,monospace', fontSize:14 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Grade visual da sala ── */}
        <div style={{ minWidth:320, flex:'0 0 380px' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color }}>🏫 Grade da Sala — {localSala || turmaSel}</div>

          {/* Quadro negro */}
          <div style={{ textAlign:'center', padding:'8px', background:color, borderRadius:'10px 10px 4px 4px', fontSize:11, fontWeight:700, color:'#fff', marginBottom:20, letterSpacing:'0.1em' }}>
            QUADRO NEGRO — FRENTE DA SALA
          </div>

          {/* Fileiras de carteiras */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {grid.map((fileira, fi) => (
              <div key={fi}>
                <div style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', marginBottom:8, letterSpacing:'0.04em' }}>FILEIRA {fi+1}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {fileira.map(e => {
                    const aluno = getAluno(e.alunoId)
                    if (!aluno) return null
                    return (
                      <div key={e.alunoId} style={{ width:70, padding:'10px 8px', background:'hsl(var(--bg-elevated))', border:`1px solid ${color}30`, borderRadius:10, textAlign:'center', position:'relative' }}>
                        {/* Número */}
                        <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', width:18, height:18, borderRadius:5, background:color, color:'#fff', fontSize:9, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit,monospace' }}>
                          {e.numeroChamada}
                        </div>
                        <div style={{ width:28, height:28, borderRadius:8, background:`${color}15`, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, margin:'8px auto 4px' }}>
                          {getInitials(aluno.nome)}
                        </div>
                        <div style={{ fontSize:9, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'hsl(var(--text-primary))' }}>
                          {aluno.nome.split(' ')[0]}
                        </div>
                        <div style={{ fontSize:8, color:'hsl(var(--text-muted))' }}>C{e.carteira}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div style={{ marginTop:20, padding:'10px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', marginBottom:8 }}>LEGENDA</div>
            <div style={{ display:'flex', gap:14, fontSize:10, color:'hsl(var(--text-muted))' }}>
              <span><strong style={{ color, fontFamily:'Outfit,monospace' }}>12</strong> = Nº Chamada</span>
              <span><strong>C3</strong> = Carteira 3</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`@media print{
        .page-header button, nav, aside, .tab-list { display:none!important; }
        body { background: white!important; }
      }`}</style>
    </div>
  )
}
