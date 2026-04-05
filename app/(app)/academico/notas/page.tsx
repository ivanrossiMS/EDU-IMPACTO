'use client'

import { useData, LancamentoNota, newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { useState, useMemo } from 'react'
import { Save, Download, BookOpen, ArrowLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'

const BIMESTRES = ['1º Bim', '2º Bim', '3º Bim', '4º Bim']
const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

function mediaColor(m: number) { return m >= 6 ? '#10b981' : m >= 5 ? '#f59e0b' : '#ef4444' }
function situacaoBadge(m: number) {
  if (m >= 6) return { label:'Aprovado', color:'#10b981', bg:'rgba(16,185,129,0.1)' }
  if (m >= 5) return { label:'Recuperação', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' }
  return { label:'Reprovado', color:'#ef4444', bg:'rgba(239,68,68,0.1)' }
}

export default function NotasPage() {
  const { alunos, turmas, lancamentosNota, setLancamentosNota, cfgDisciplinas, logSystemAction } = useData()

  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [bimestre, setBimestre] = useState('1º Bim')
  const [disciplina, setDisciplina] = useState('')
  const [notas, setNotas] = useState<Record<string, { n1: string; n2: string; n3: string }>>({})
  const [salvo, setSalvo] = useState(false)

  // Filtros da home
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [filtroBusca, setFiltroBusca] = useState('')

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? turmaSel ?? ''
  const alunosDaTurma = useMemo(() => turmaSel ? alunos.filter(a => a.turma === turmaSel) : [], [alunos, turmaSel])

  const disciplinas = useMemo(() => {
    if (!turmaObj) return []
    const extra = turmaObj as any
    if (extra?.disciplinas?.length > 0) return (extra.disciplinas as any[]).map(d => d.nome ?? d) as string[]
    if (cfgDisciplinas?.length) {
      return cfgDisciplinas.filter(d => d.situacao === 'ativa' && (!turmaObj.serie || !d.niveisEnsino?.length || d.niveisEnsino.includes(turmaObj.serie))).map(d => d.nome)
    }
    return ['Matemática','Português','História','Ciências','Inglês','Educação Física','Arte','Geografia']
  }, [turmaObj, cfgDisciplinas])

  const discEfetiva = disciplinas.includes(disciplina) ? disciplina : (disciplinas[0] ?? '')
  const bimIdx = BIMESTRES.indexOf(bimestre) + 1
  const lancExistente = lancamentosNota.find(l => l.turmaId === turmaId && l.disciplina === discEfetiva && l.bimestre === bimIdx)

  const getNotas = (alunoId: string) => {
    if (notas[alunoId]) return notas[alunoId]
    if (lancExistente) {
      const n = lancExistente.notas.find(n => n.alunoId === alunoId)
      if (n) return { n1: n.n1.toString(), n2: n.n2.toString(), n3: n.n3.toString() }
    }
    return { n1:'', n2:'', n3:'' }
  }

  const setNota = (alunoId: string, key: 'n1'|'n2'|'n3', value: string) =>
    setNotas(prev => ({ ...prev, [alunoId]: { ...getNotas(alunoId), [key]: value } }))

  const calcMedia = (n: { n1: string; n2: string; n3: string }) => {
    const v1 = parseFloat(n.n1) || 0, v2 = parseFloat(n.n2) || 0, v3 = parseFloat(n.n3) || 0
    return (v1 * 2 + v2 * 3 + v3 * 5) / 10
  }

  const handleSalvar = () => {
    const notasArr = alunosDaTurma.map(a => {
      const n = getNotas(a.id)
      const v1 = parseFloat(n.n1) || 0, v2 = parseFloat(n.n2) || 0, v3 = parseFloat(n.n3) || 0
      return { alunoId: a.id, n1: v1, n2: v2, n3: v3, media: (v1*2 + v2*3 + v3*5) / 10 }
    })
    setLancamentosNota(prev => {
      if (lancExistente) {
        return prev.map(l => l.id === lancExistente.id ? { ...l, notas: notasArr } : l)
      }
      return [...prev, { id: newId('LN'), turmaId, disciplina: discEfetiva, bimestre: bimIdx, notas: notasArr, criadoPor:'Usuário', createdAt: new Date().toISOString() }]
    })
    logSystemAction(
      'Acadêmico (Notas)', 
      lancExistente ? 'Edição' : 'Cadastro', 
      `${lancExistente ? 'Atualização' : 'Lançamento'} de notas: ${discEfetiva} / Bim. ${bimIdx} / Turma: ${turmaObj?.nome || turmaId}`, 
      { registroId: turmaId, detalhesDepois: { disciplina: discEfetiva, bimestre: bimIdx, turmaId, notas: notasArr } }
    )
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
    setNotas({})
  }

  // ── VISTA HOME ─────────────────────────────────────────────────────────────
  if (!turmaSel) {
    const totalAlunos = alunos.length
    const totalLancs = lancamentosNota.length
    const bimestresComLanc = [...new Set(lancamentosNota.map(l => l.bimestre))].length
    const turmasComLanc = [...new Set(lancamentosNota.map(l => l.turmaId))].length

    const mediasPorBim = BIMESTRES.map((b, i) => {
      const lancsB = lancamentosNota.filter(l => l.bimestre === i + 1)
      if (!lancsB.length) return { bim: b, media: null, alunos: 0 }
      const todasNotas = lancsB.flatMap(l => l.notas.map(n => n.media))
      const media = todasNotas.length ? todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length : null
      return { bim: b, media: media ? +media.toFixed(1) : null, alunos: todasNotas.length }
    })

    const turmaStats = turmas.map(t => {
      const lancs = lancamentosNota.filter(l => l.turmaId === t.id)
      if (!lancs.length) return { turma: t, media: null, aprovados: null, reprovados: null, pctLancado: 0 }
      const medias = lancs.flatMap(l => l.notas.map(n => n.media))
      const media = medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null
      const aprovados = medias.filter(m => m >= 6).length
      const reprovados = medias.filter(m => m < 5).length
      const discsEsperadas = cfgDisciplinas.filter(d => d.situacao === 'ativa').length || 8
      const pctLancado = Math.round((lancs.length / (discsEsperadas * 4)) * 100)
      return { turma: t, media: media ? +media.toFixed(1) : null, aprovados, reprovados, pctLancado }
    }).filter(s => s.media !== null).sort((a, b) => (a.media ?? 10) - (b.media ?? 10))

    const turmasCriticas = turmaStats.filter(s => s.media !== null && s.media < 6)
    const turmasDestaque = turmaStats.filter(s => s.media !== null && s.media >= 8).slice(-3).reverse()
    const maxMedia = 10

    // Filtros da home
    const segsDisp = [...new Set(turmas.map(t => t.serie).filter(Boolean))].sort()
    const turnosDisp = [...new Set(turmas.map(t => t.turno).filter(Boolean))]
    const anosDisp = [...new Set(turmas.map(t => String(t.ano)).filter(Boolean))].sort().reverse()
    const hasF = !!(filtroBusca || filtroSeg !== 'todos' || filtroTurno !== 'Todos' || filtroAno !== 'Todos')
    const clearF = () => { setFiltroBusca(''); setFiltroSeg('todos'); setFiltroTurno('Todos'); setFiltroAno('Todos') }
    const turmasFiltradas = turmas.filter(t => {
      const mb = !filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase())
      const ms = filtroSeg === 'todos' || t.serie === filtroSeg
      const mtu = filtroTurno === 'Todos' || t.turno === filtroTurno
      const ma = filtroAno === 'Todos' || String(t.ano) === filtroAno
      return mb && ms && mtu && ma
    })

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Lançamento de Notas</h1>
            <p className="page-subtitle">Visão pedagógica consolidada • {lancamentosNota.length} lançamentos registrados</p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:'Turmas ativas', value: turmas.length, sub: `${turmasComLanc} com notas`, color:'#3b82f6', icon:'🏫' },
            { label:'Alunos matriculados', value: totalAlunos, sub: 'em todas as turmas', color:'#8b5cf6', icon:'👨‍🎓' },
            { label:'Lançamentos feitos', value: totalLancs, sub: `${bimestresComLanc} bimestre(s) cobertos`, color:'#10b981', icon:'📝' },
            { label:'Turmas em alerta', value: turmasCriticas.length, sub: 'média geral < 6,0', color: turmasCriticas.length > 0 ? '#ef4444' : '#10b981', icon: turmasCriticas.length > 0 ? '⚠️' : '✅' },
          ].map(c => (
            <div key={c.label} style={{ padding:'20px', background:'hsl(var(--bg-elevated))', borderRadius:16, border:`1px solid ${c.color}20`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:c.color }} />
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ fontSize:22 }}>{c.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))', fontWeight:600, marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontSize:32, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{c.value}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'hsl(var(--text-muted))', paddingTop:8, borderTop:'1px solid hsl(var(--border-subtle))' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Evolução + Alertas */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <div className="card" style={{ padding:'22px' }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:18 }}>📊 Evolução por Bimestre</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {mediasPorBim.map(({ bim, media, alunos: al }) => {
                const pct = media !== null ? (media / maxMedia) * 100 : 0
                const cor = media === null ? '#6b7280' : media >= 8 ? '#10b981' : media >= 6 ? '#3b82f6' : '#ef4444'
                return (
                  <div key={bim}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12, fontWeight:700 }}>{bim}</span>
                        {media !== null && <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{al} notas registradas</span>}
                      </div>
                      <span style={{ fontSize:14, fontWeight:900, color: media !== null ? cor : 'hsl(var(--text-muted))', fontFamily:'Outfit,sans-serif' }}>
                        {media !== null ? `${media}` : 'Sem dados'}
                      </span>
                    </div>
                    <div style={{ height:10, borderRadius:6, background:'hsl(var(--bg-overlay))', position:'relative', overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:6, background:cor, transition:'width 0.6s ease' }} />
                    </div>
                    {media !== null && media < 6 && (
                      <div style={{ fontSize:10, color:'#f87171', marginTop:3, fontWeight:600 }}>⚠ Abaixo da média mínima (6,0)</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="card" style={{ padding:'20px', flex:1, borderLeft:'3px solid #ef4444' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ width:32, height:32, borderRadius:10, background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⛔</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:13 }}>Turmas em Alerta</div>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Média geral abaixo de 6,0</div>
                </div>
              </div>
              {turmasCriticas.length === 0 ? (
                <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:'#10b981', fontWeight:600 }}>✓ Todas as turmas estão acima da média!</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {turmasCriticas.slice(0, 4).map(s => (
                    <button key={s.turma.id} onClick={() => { setTurmaSel(s.turma.nome); setDisciplina(''); setNotas({}) }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(239,68,68,0.05)', borderRadius:10, border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', textAlign:'left', width:'100%' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700 }}>{s.turma.nome}</div>
                        <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{s.turma.serie} • {s.reprovados} alunos em recuperação</div>
                      </div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#ef4444', fontFamily:'Outfit,sans-serif' }}>{s.media}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {turmasDestaque.length > 0 && (
              <div className="card" style={{ padding:'20px', borderLeft:'3px solid #10b981' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏆</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13 }}>Turmas em Destaque</div>
                    <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Média ≥ 8,0</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {turmasDestaque.map(s => (
                    <button key={s.turma.id} onClick={() => { setTurmaSel(s.turma.nome); setDisciplina(''); setNotas({}) }}
                      style={{ padding:'6px 14px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', cursor:'pointer', fontSize:12, fontWeight:700, color:'#10b981' }}>
                      {s.turma.nome} · {s.media}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid de turmas */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>📚 Selecione a Turma para Lançar Notas</div>
          <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{turmas.length} turma(s)</span>
        </div>

        {turmas.length === 0 ? (
          <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <BookOpen size={40} style={{ margin:'0 auto 14px', opacity:0.15 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>Nenhuma turma cadastrada</div>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center', padding:'12px 16px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
              <div style={{ position:'relative', flex:1, minWidth:160 }}>
                <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:12 }}>🔍</span>
                <input className="form-input" style={{ paddingLeft:28, fontSize:12 }} placeholder="Buscar turma..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
              </div>
              {segsDisp.length > 0 && (
                <div style={{ display:'flex', gap:5 }}>
                  {['todos', ...segsDisp].map(s => (
                    <button key={s} onClick={() => setFiltroSeg(s)}
                      style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                        background: filtroSeg===s ? `${SEG_COLORS[s] ?? '#3b82f6'}15` : 'transparent',
                        border: `1px solid ${filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--border-subtle))'}`,
                        color: filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--text-muted))' }}>{s === 'todos' ? 'Todos' : s}</button>
                  ))}
                </div>
              )}
              {turnosDisp.length > 0 && (
                <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                  <option value="Todos">Todos os turnos</option>
                  {turnosDisp.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {anosDisp.length > 0 && (
                <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                  <option value="Todos">Todos os anos</option>
                  {anosDisp.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {hasF && <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={clearF}>✕ Limpar</button>}
              <span style={{ marginLeft:'auto', fontSize:12, color:'hsl(var(--text-muted))' }}>{turmasFiltradas.length}/{turmas.length} turma(s)</span>
            </div>

            {turmasFiltradas.length === 0 ? (
              <div className="card" style={{ padding:'32px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
                <div style={{ fontSize:14, fontWeight:600 }}>Nenhuma turma com esses filtros</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={clearF}>✕ Limpar filtros</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:16 }}>
                {turmasFiltradas.map(turma => {
                  const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
                  const alunosTurma = alunos.filter(a => a.turma === turma.nome)
                  const lancs = lancamentosNota.filter(l => l.turmaId === turma.id)
                  const discsLancadas = [...new Set(lancs.map(l => l.disciplina))].length
                  const extra = turma as any
                  const totalDiscs = extra?.disciplinas?.length || cfgDisciplinas?.filter(d => d.situacao === 'ativa' && (!turma.serie || !d.niveisEnsino?.length || d.niveisEnsino.includes(turma.serie))).length || 8
                  const pct = totalDiscs > 0 ? Math.round((discsLancadas / (totalDiscs * 4)) * 100) : 0
                  const stat = turmaStats.find(s => s.turma.id === turma.id)
                  const mediaGeral = stat?.media

                  return (
                    <button key={turma.id} onClick={() => { setTurmaSel(turma.nome); setDisciplina(''); setNotas({}) }}
                      style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid ${color}25`, borderRadius:16, padding:'22px', cursor:'pointer', transition:'all 0.2s', display:'block', width:'100%', position:'relative', overflow:'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 32px ${color}25` }}
                      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(to right, ${color}, ${color}80)` }} />

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                        <div>
                          <div style={{ fontSize:24, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{turma.nome}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{turma.serie} • {turma.turno}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          {mediaGeral !== null && mediaGeral !== undefined ? (
                            <>
                              <div style={{ fontSize:28, fontWeight:900, color: mediaGeral >= 6 ? '#10b981' : '#ef4444', fontFamily:'Outfit,sans-serif' }}>{mediaGeral}</div>
                              <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>média geral</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize:28, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{alunosTurma.length}</div>
                              <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>alunos</div>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ marginBottom:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Notas lançadas</span>
                          <span style={{ fontSize:11, fontWeight:700, color }}>{lancs.length} lançamento(s)</span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:'hsl(var(--bg-overlay))' }}>
                          <div style={{ width:`${Math.min(pct, 100)}%`, height:'100%', borderRadius:3, background:color, transition:'width 0.4s' }} />
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                        {BIMESTRES.map((b, i) => {
                          const temLanc = lancs.some(l => l.bimestre === i + 1)
                          return <span key={b} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background: temLanc ? `${color}15` : 'hsl(var(--bg-overlay))', color: temLanc ? color : 'hsl(var(--text-muted))', fontWeight:700, border:`1px solid ${temLanc ? color+'30' : 'transparent'}` }}>{temLanc ? '✓ ' : ''}{b}</span>
                        })}
                      </div>

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

  // ── VISTA INTERNA: lançamento de notas ─────────────────────────────────────
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => { setTurmaSel(null); setNotas({}) }}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Notas — {turmaSel}</h1>
              {lancExistente && <span style={{ padding:'2px 10px', borderRadius:20, background:'rgba(16,185,129,0.12)', color:'#10b981', fontSize:11, fontWeight:700 }}>✓ Já lançado</span>}
            </div>
            <p className="page-subtitle">{alunosDaTurma.length} alunos • {discEfetiva} • {bimestre}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSalvar} disabled={!discEfetiva || alunosDaTurma.length === 0}>
            {salvo ? <><CheckCircle size={13} />Salvo!</> : <><Save size={13} />Salvar Notas</>}
          </button>
        </div>
      </div>

      {/* Seletores */}
      <div style={{ display:'flex', gap:12, marginBottom:20, padding:'16px 20px', background:'hsl(var(--bg-elevated))', borderRadius:14, border:'1px solid hsl(var(--border-subtle))', alignItems:'center', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>Bimestre</div>
          <div className="tab-list" style={{ padding:'3px' }}>
            {BIMESTRES.map(b => (
              <button key={b} className={`tab-trigger ${bimestre===b?'active':''}`} onClick={() => { setBimestre(b); setNotas({}) }}>{b}</button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>
            Disciplina <span style={{ color }}>{disciplinas.length > 0 ? `(${disciplinas.length} disponíveis)` : ''}</span>
          </div>
          {disciplinas.length > 0 ? (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {disciplinas.map(d => {
                const temLanc = lancamentosNota.some(l => l.turmaId === turmaId && l.disciplina === d && l.bimestre === bimIdx)
                const sel = discEfetiva === d
                return (
                  <button key={d} onClick={() => { setDisciplina(d); setNotas({}) }}
                    style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${sel ? color : temLanc ? `${color}50` : 'hsl(var(--border-subtle))'}`, background: sel ? `${color}15` : 'transparent', color: sel ? color : temLanc ? `${color}90` : 'hsl(var(--text-muted))', transition:'all 0.15s' }}>
                    {temLanc && !sel ? '✓ ' : ''}{d}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#f59e0b', display:'flex', alignItems:'center', gap:8 }}>
              <AlertTriangle size={13} />Configure disciplinas em Acadêmico → Turmas
            </div>
          )}
        </div>
      </div>

      {!discEfetiva ? (
        <div className="card" style={{ padding:'30px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
          <BookOpen size={28} style={{ opacity:0.15, margin:'0 auto 10px' }} />
          <div style={{ fontSize:13 }}>Selecione uma disciplina para lançar notas.<br />Configure em <strong>Acadêmico → Turmas → Disciplinas</strong>.</div>
        </div>
      ) : alunosDaTurma.length === 0 ? (
        <div className="card" style={{ padding:'30px', textAlign:'center', color:'hsl(var(--text-muted))' }}>Nenhum aluno nesta turma.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px 90px 120px', gap:12, padding:'8px 20px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
            {['Aluno','Nota 1 ×2','Nota 2 ×3','Nota 3 ×5','Média','Situação'].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.04em', textAlign: h==='Aluno' ? 'left' : 'center' }}>{h}</div>
            ))}
          </div>

          {alunosDaTurma.map((aluno, idx) => {
            const n = getNotas(aluno.id)
            const media = calcMedia(n)
            const hasNotas = n.n1 !== '' || n.n2 !== '' || n.n3 !== ''
            const sit = hasNotas ? situacaoBadge(media) : null

            return (
              <div key={aluno.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px 90px 120px', gap:12, padding:'14px 20px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))', alignItems:'center', transition:'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor=`${color}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor='hsl(var(--border-subtle))')}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:`${color}15`, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {getInitials(aluno.nome)}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{aluno.nome}</div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>Nº {String(idx+1).padStart(2,'0')} {aluno.matricula ? `• Mat. ${aluno.matricula}` : ''}</div>
                  </div>
                </div>

                {(['n1','n2','n3'] as const).map(key => (
                  <div key={key} style={{ display:'flex', justifyContent:'center' }}>
                    <input type="number" min={0} max={10} step={0.1} value={n[key]}
                      onChange={e => setNota(aluno.id, key, e.target.value)}
                      placeholder="—"
                      style={{ width:72, padding:'8px', background:'hsl(var(--bg-overlay))', border:`1px solid ${parseFloat(n[key]) < 5 && n[key] !== '' ? 'rgba(239,68,68,0.5)' : 'hsl(var(--border-subtle))'}`, borderRadius:10, textAlign:'center', color: parseFloat(n[key]) < 5 && n[key] ? '#f87171' : parseFloat(n[key]) >= 6 && n[key] ? '#34d399' : 'hsl(var(--text-primary))', fontWeight:800, fontSize:16, fontFamily:'Outfit,monospace', outline:'none', transition:'border-color 0.15s' }}
                      onFocus={e => (e.currentTarget.style.borderColor=color)}
                      onBlur={e => (e.currentTarget.style.borderColor = parseFloat(n[key]) < 5 && n[key] !== '' ? 'rgba(239,68,68,0.5)' : 'hsl(var(--border-subtle))')} />
                  </div>
                ))}

                <div style={{ textAlign:'center', fontWeight:900, fontSize:20, fontFamily:'Outfit,sans-serif', color: !hasNotas ? 'hsl(var(--text-muted))' : mediaColor(media) }}>
                  {hasNotas ? media.toFixed(1) : '—'}
                </div>

                <div style={{ display:'flex', justifyContent:'center' }}>
                  {sit ? (
                    <span style={{ padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:700, background:sit.bg, color:sit.color }}>{sit.label}</span>
                  ) : <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Aguardando</span>}
                </div>
              </div>
            )
          })}

          {alunosDaTurma.some(a => getNotas(a.id).n1 !== '' || getNotas(a.id).n2 !== '' || getNotas(a.id).n3 !== '') && (
            <div style={{ display:'flex', gap:12, padding:'12px 20px', background:`${color}08`, border:`1px solid ${color}25`, borderRadius:12 }}>
              {['aprovado','recuperacao','reprovado'].map(sit => {
                const count = alunosDaTurma.filter(a => {
                  const n = getNotas(a.id); const hasN = n.n1 !== '' || n.n2 !== '' || n.n3 !== ''; if (!hasN) return false
                  const m = calcMedia(n)
                  return sit === 'aprovado' ? m >= 6 : sit === 'recuperacao' ? m >= 5 && m < 6 : m < 5
                }).length
                const labels = { aprovado:{ label:'Aprovados', color:'#10b981' }, recuperacao:{ label:'Recuperação', color:'#f59e0b' }, reprovado:{ label:'Reprovados', color:'#ef4444' } }
                const cfg = labels[sit as keyof typeof labels]
                return (
                  <div key={sit} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:cfg.color, fontFamily:'Outfit,sans-serif' }}>{count}</span>
                    <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
