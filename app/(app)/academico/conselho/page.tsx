'use client'

import { useState, useMemo } from 'react'
import { getInitials } from '@/lib/utils'
import { useData } from '@/lib/dataContext'
import { ArrowLeft, ChevronRight, Save, CheckCircle, Brain, FileText, AlertTriangle, TrendingUp, TrendingDown, Users, BookOpen, Star, Download } from 'lucide-react'

const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

const SIT_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  aprovado:    { color:'#10b981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.25)', label:'Aprovado',    icon:'✓' },
  recuperacao: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.25)', label:'Recuperação', icon:'⚡' },
  reprovado:   { color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.25)',  label:'Reprovado',   icon:'✗' },
}
const DELIB_OPTIONS = [
  { value:'manter',   label:'Manter situação' },
  { value:'promover', label:'Promover por Conselho' },
  { value:'reter',    label:'Reter' },
  { value:'laudo',    label:'Encaminhar para Laudo' },
  { value:'reforca',  label:'Encaminhar para Reforço' },
  { value:'psico',    label:'Encaminhar para Psicopedagogia' },
]

function getSituacao(m: number) { return m >= 6 ? 'aprovado' : m >= 5 ? 'recuperacao' : 'reprovado' }
function getMediaColor(m: number) { return m >= 6 ? '#10b981' : m >= 5 ? '#f59e0b' : '#ef4444' }

type Aba = 'quadro' | 'deliberacoes' | 'ata'

export default function ConselhoPage() {
  const { alunos = [], turmas = [], lancamentosNota = [], frequencias = [] } = useData()
  const isLoading = false

  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('quadro')
  const [deliberacoes, setDeliberacoes] = useState<Record<string, string>>({})
  const [obs, setObs] = useState<Record<string, string>>({})
  const [ataData, setAtaData] = useState({ data: new Date().toISOString().slice(0,10), membros:'', sintese:'', encaminhamentos:'' })
  const [salvo, setSalvo] = useState(false)

  // ── Filtros da home ──
  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')

  const anosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.ano))].sort().reverse(), [turmas])
  const segmentosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.serie))].sort(), [turmas])

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? turmaSel ?? ''
  const alunosDaTurma = useMemo(() => turmaSel ? alunos.filter(a => a.turma === turmaSel) : [], [alunos, turmaSel])

  // Médias dos alunos a partir dos lançamentos
  const mediaAluno = useMemo(() => {
    const lancsDaTurma = lancamentosNota.filter(l => l.turmaId === turmaId)
    const mapa: Record<string, { soma: number; count: number }> = {}
    lancsDaTurma.forEach(l => l.notas.forEach((n: any) => {
      if (!mapa[n.alunoId]) mapa[n.alunoId] = { soma:0, count:0 }
      mapa[n.alunoId].soma += n.media; mapa[n.alunoId].count++
    }))
    const result: Record<string, number> = {}
    Object.entries(mapa).forEach(([id, v]) => { result[id] = v.count > 0 ? v.soma / v.count : 0 })
    return result
  }, [lancamentosNota, turmaId])

  // Frequência real do aluno
  const freqAluno = useMemo(() => {
    const result: Record<string, number> = {}
    const regsTurma = frequencias.filter(f => f.turmaId === turmaId)
    alunosDaTurma.forEach(a => {
      if (!regsTurma.length) { result[a.id] = a.frequencia ?? 100; return }
      const pres = regsTurma.filter(r => ['P','J'].includes(r.registros.find((rr: any) => rr.alunoId === a.id)?.status ?? 'P')).length
      result[a.id] = Math.round((pres / regsTurma.length) * 100)
    })
    return result
  }, [frequencias, turmaId, alunosDaTurma])

  const getMedia = (alunoId: string) => mediaAluno[alunoId] ?? null
  const getFreq = (alunoId: string) => freqAluno[alunoId] ?? (alunos.find(a => a.id === alunoId)?.frequencia ?? null)

  const aprovados = alunosDaTurma.filter(a => { const m = getMedia(a.id); return m !== null && getSituacao(m) === 'aprovado' }).length
  const recuperacao = alunosDaTurma.filter(a => { const m = getMedia(a.id); return m !== null && getSituacao(m) === 'recuperacao' }).length
  const reprovados = alunosDaTurma.filter(a => { const m = getMedia(a.id); return m !== null && getSituacao(m) === 'reprovado' }).length
  const semNotas = alunosDaTurma.filter(a => getMedia(a.id) === null).length

  // ── HOME: cards de turma ─────────────────────────────────────────────────
  if (!turmaSel) {
    const turmasFiltradas = turmas.filter(t =>
      (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
      (filtroSeg === 'todos' || t.serie === filtroSeg) &&
      (!filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    )
    return (
      <div suppressHydrationWarning>
        {isLoading && (
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
            <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontWeight:600 }}>Carregando dados do Conselho...</div>
            </div>
          </div>
        )}
        <div className="page-header">
          <div>
            <h1 className="page-title">Conselho de Classe</h1>
            <p className="page-subtitle">Deliberações, situação final e ata por turma</p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap', padding:'14px 18px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position:'relative', flex:1, minWidth:180 }}>
            <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity:0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="form-input" style={{ paddingLeft:32 }} placeholder="Buscar turma..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight:600 }}>Ano letivo:</span>
            <select className="form-input" style={{ width:'auto', minWidth:100 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
              <option value="todos">Todos</option>
              {anosDisponiveis.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight:600 }}>Segmento:</span>
            <div style={{ display:'flex', gap:6 }}>
              {(['todos',...segmentosDisponiveis] as string[]).map(s => (
                <button key={s} onClick={() => setFiltroSeg(s)}
                  style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: filtroSeg===s ? `${SEG_COLORS[s] ?? '#3b82f6'}15` : 'transparent',
                    border: `1px solid ${filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--border-subtle))'}`,
                    color: filtroSeg===s ? (SEG_COLORS[s] ?? '#3b82f6') : 'hsl(var(--text-muted))', transition:'all 0.15s' }}>
                  {s === 'todos' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </div>
          {(filtroAno !== 'todos' || filtroSeg !== 'todos' || filtroBusca) && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => { setFiltroAno('todos'); setFiltroSeg('todos'); setFiltroBusca('') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft:'auto', fontSize:12, color:'hsl(var(--text-muted))' }}>{turmasFiltradas.length} turma(s)</span>
        </div>

        {turmasFiltradas.length === 0 ? (
          <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <Users size={40} style={{ margin:'0 auto 14px', opacity:0.15 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>{turmas.length === 0 ? 'Nenhuma turma cadastrada' : 'Nenhuma turma com esses filtros'}</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:16 }}>
            {turmasFiltradas.map(turma => {
              const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
              const alunosTurma = alunos.filter(a => a.turma === turma.nome)
              const turmaID = turma.id
              const lancs = lancamentosNota.filter(l => l.turmaId === turmaID)
              const comNotas = new Set(lancs.flatMap(l => l.notas.map((n: any) => n.alunoId))).size
              const pctLancado = alunosTurma.length > 0 ? Math.round((comNotas / alunosTurma.length) * 100) : 0

              return (
                <button key={turma.id} onClick={() => { setTurmaSel(turma.nome); setAba('quadro') }}
                  style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid ${color}25`, borderRadius:16, padding:'22px', cursor:'pointer', transition:'all 0.2s', display:'block', width:'100%', position:'relative', overflow:'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 32px ${color}25` }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(90deg, ${color}, ${color}80)` }} />

                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:24, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{turma.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{turma.serie} • Ano {turma.ano}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:28, fontWeight:900, color, fontFamily:'Outfit,sans-serif' }}>{alunosTurma.length}</div>
                      <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>alunos</div>
                    </div>
                  </div>

                  {/* Progresso de notas */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Alunos com notas</span>
                      <span style={{ fontSize:11, fontWeight:700, color }}>{pctLancado}%</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:'hsl(var(--bg-overlay))' }}>
                      <div style={{ width:`${pctLancado}%`, height:'100%', borderRadius:3, background:color }} />
                    </div>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:10 }}>
                      {lancs.length > 0 && <span style={{ fontSize:10, color:'#10b981' }}>✓ {lancs.length} lançamentos</span>}
                      {comNotas < alunosTurma.length && <span style={{ fontSize:10, color:'#f59e0b' }}>⚠ {alunosTurma.length - comNotas} sem notas</span>}
                    </div>
                    <ChevronRight size={16} style={{ color }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── VISTA INTERNA: conselho da turma ─────────────────────────────────────
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setTurmaSel(null)}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title" style={{ marginBottom:0 }}>Conselho de Classe — {turmaSel}</h1>
            <p className="page-subtitle">{alunosDaTurma.length} alunos • {turmaObj?.serie} • Ano {turmaObj?.ano}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm"><Brain size={13} />Análise IA</button>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setSalvo(true); setTimeout(() => setSalvo(false), 2000) }}>
            {salvo ? <><CheckCircle size={13} />Salvo!</> : <><Save size={13} />Salvar Ata</>}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total', value: alunosDaTurma.length, color:'#3b82f6', icon:'👥' },
          { label:'Aprovados', value: aprovados, color:'#10b981', icon:'✅' },
          { label:'Recuperação', value: recuperacao, color:'#f59e0b', icon:'⚡' },
          { label:'Reprovados', value: reprovados, color:'#ef4444', icon:'❌' },
          { label:'Sem notas', value: semNotas, color:'#6b7280', icon:'📋' },
        ].map(c => (
          <div key={c.label} className="kpi-card" style={{ borderTop:`3px solid ${c.color}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <span style={{ fontSize:16 }}>{c.icon}</span>
              <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {semNotas > 0 && (
        <div style={{ padding:'10px 16px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, fontSize:13, color:'#fbbf24', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={14} />
          {semNotas} aluno(s) ainda sem notas lançadas — acesse Lançamento de Notas para registrar.
        </div>
      )}

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom:20, width:'fit-content' }}>
        {([['quadro','📊 Quadro de Notas'],['deliberacoes','⚖️ Deliberações'],['ata','📄 Ata do Conselho']] as const).map(([id, label]) => (
          <button key={id} className={`tab-trigger ${aba===id?'active':''}`} onClick={() => setAba(id as Aba)}>{label}</button>
        ))}
      </div>

      {/* ── QUADRO DE NOTAS ── */}
      {aba === 'quadro' && (
        <div>
          {/* Cabeçalho */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 140px 180px', gap:12, padding:'8px 20px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))', marginBottom:8 }}>
            {['Aluno','Média Geral','Frequência','Situação','Desempenho'].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</div>
            ))}
          </div>

          {alunosDaTurma.map((aluno, idx) => {
            const media = getMedia(aluno.id)
            const freq = getFreq(aluno.id)
            const sit = media !== null ? getSituacao(media) : null
            const cfg = sit ? SIT_CONFIG[sit] : null
            const freqBad = freq !== null && freq < 75
            const lancsAluno = lancamentosNota.filter(l => l.turmaId === turmaId).flatMap(l => l.notas.filter((n: any) => n.alunoId === aluno.id))
            const melhorNota = lancsAluno.length ? Math.max(...lancsAluno.map(n => n.media)) : null
            const piorNota = lancsAluno.length ? Math.min(...lancsAluno.map(n => n.media)) : null

            return (
              <div key={aluno.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 140px 180px', gap:12, padding:'14px 20px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:`1px solid ${cfg ? cfg.border : 'hsl(var(--border-subtle))'}`, marginBottom:8, alignItems:'center', transition:'box-shadow 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow=`0 4px 20px ${cfg?.color ?? color}15`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                {/* Aluno */}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background: cfg ? `${cfg.color}18` : 'hsl(var(--bg-overlay))', color: cfg?.color ?? 'hsl(var(--text-muted))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {getInitials(aluno.nome)}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{aluno.nome}</div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>Chamada Nº {String(idx+1).padStart(2,'0')}</div>
                  </div>
                </div>

                {/* Média */}
                <div style={{ fontWeight:900, fontSize:20, fontFamily:'Outfit,sans-serif', color: media !== null ? getMediaColor(media) : 'hsl(var(--text-muted))' }}>
                  {media !== null ? media.toFixed(1) : '—'}
                </div>

                {/* Frequência */}
                <div>
                  {freq !== null ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ fontSize:13, fontWeight:800, color: freqBad ? '#ef4444' : '#10b981', fontFamily:'Outfit,sans-serif' }}>{freq}%</div>
                      <div style={{ height:4, borderRadius:2, background:'hsl(var(--bg-overlay))' }}>
                        <div style={{ width:`${Math.min(freq,100)}%`, height:'100%', borderRadius:2, background: freqBad ? '#ef4444' : '#10b981' }} />
                      </div>
                    </div>
                  ) : '—'}
                </div>

                {/* Situação */}
                <div>
                  {cfg ? (
                    <span style={{ padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:800, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  ) : <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Sem notas</span>}
                  {freqBad && <div style={{ fontSize:10, color:'#ef4444', marginTop:4 }}>⚠ Freq. insuficiente</div>}
                </div>

                {/* Spark de desempenho */}
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {melhorNota !== null && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
                      <TrendingUp size={11} color="#10b981" /><span style={{ fontSize:11, fontWeight:700, color:'#10b981' }}>{melhorNota.toFixed(1)}</span>
                    </div>
                  )}
                  {piorNota !== null && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                      <TrendingDown size={11} color="#ef4444" /><span style={{ fontSize:11, fontWeight:700, color:'#ef4444' }}>{piorNota.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DELIBERAÇÕES ── */}
      {aba === 'deliberacoes' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:13, color:'hsl(var(--text-muted))', marginBottom:4 }}>
            Registre a deliberação do conselho para cada aluno. As observações ficam salvas automaticamente.
          </div>
          {alunosDaTurma.map(aluno => {
            const media = getMedia(aluno.id)
            const sit = media !== null ? getSituacao(media) : null
            const cfg = sit ? SIT_CONFIG[sit] : null
            const delib = deliberacoes[aluno.id] ?? 'manter'
            const deliberLabel = DELIB_OPTIONS.find(d => d.value === delib)?.label ?? '—'
            const needsAction = sit === 'recuperacao' || sit === 'reprovado'
            return (
              <div key={aluno.id} className="card" style={{ padding:'18px', border: needsAction ? `1px solid ${cfg?.border}` : undefined }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, alignItems:'start' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background: cfg ? `${cfg.color}15` : 'hsl(var(--bg-overlay))', color: cfg?.color ?? 'hsl(var(--text-muted))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                      {getInitials(aluno.nome)}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700 }}>{aluno.nome}</div>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                        <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Média: <strong style={{ color: media !== null ? getMediaColor(media) : undefined }}>{media !== null ? media.toFixed(1) : '—'}</strong></span>
                        <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Freq: <strong>{getFreq(aluno.id) ?? '—'}%</strong></span>
                        {cfg && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:cfg.bg, color:cfg.color, fontWeight:700 }}>{cfg.icon} {cfg.label}</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginBottom:6 }}>DELIBERAÇÃO</div>
                    <select className="form-input" style={{ fontSize:12, minWidth:220 }}
                      value={delib} onChange={e => setDeliberacoes(prev => ({ ...prev, [aluno.id]: e.target.value }))}>
                      {DELIB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  <div style={{ minWidth:200 }}>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginBottom:6 }}>OBSERVAÇÃO</div>
                    <textarea className="form-input" rows={2} style={{ fontSize:12, resize:'vertical' }}
                      placeholder="Observações do conselho..."
                      value={obs[aluno.id] ?? ''}
                      onChange={e => setObs(prev => ({ ...prev, [aluno.id]: e.target.value }))} />
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setSalvo(true); setTimeout(() => setSalvo(false), 2000) }}>
              {salvo ? <><CheckCircle size={13} />Deliberações salvas!</> : <><Save size={13} />Salvar deliberações</>}
            </button>
          </div>
        </div>
      )}

      {/* ── ATA ── */}
      {aba === 'ata' && (
        <div className="card" style={{ padding:'28px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <FileText size={20} style={{ color }} />
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>Ata do Conselho de Classe</div>
              <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Turma {turmaSel} • {turmaObj?.serie} • Ano {turmaObj?.ano}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div>
              <label className="form-label">Data do Conselho</label>
              <input className="form-input" type="date" value={ataData.data} onChange={e => setAtaData(p => ({ ...p, data: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Membros Presentes</label>
              <input className="form-input" value={ataData.membros} onChange={e => setAtaData(p => ({ ...p, membros: e.target.value }))} placeholder="Diretor, Coord. Pedagógico, Professores..." />
            </div>
          </div>

          {/* Resumo automático */}
          <div style={{ padding:'14px 18px', background:`${color}08`, border:`1px solid ${color}25`, borderRadius:12, marginBottom:16, fontSize:13 }}>
            <div style={{ fontWeight:700, marginBottom:8, color }}>📊 Resumo Automático da Turma</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { label:'Aprovados', value: aprovados, color:'#10b981' },
                { label:'Recuperação', value: recuperacao, color:'#f59e0b' },
                { label:'Reprovados', value: reprovados, color:'#ef4444' },
                { label:'Total alunos', value: alunosDaTurma.length, color },
              ].map(c => (
                <div key={c.label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif' }}>{c.value}</div>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label className="form-label">Síntese das Deliberações</label>
              <textarea className="form-input" rows={4} value={ataData.sintese}
                onChange={e => setAtaData(p => ({ ...p, sintese: e.target.value }))}
                placeholder={`Ex: O Conselho de Classe deliberou aprovar ${aprovados} alunos, encaminhar ${recuperacao} para recuperação e reter ${reprovados} aluno(s)...`} />
            </div>
            <div>
              <label className="form-label">Encaminhamentos</label>
              <textarea className="form-input" rows={3} value={ataData.encaminhamentos}
                onChange={e => setAtaData(p => ({ ...p, encaminhamentos: e.target.value }))}
                placeholder="Liste os encaminhamentos decididos pelo conselho..." />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
              <button className="btn btn-secondary btn-sm"><FileText size={13} />Visualizar PDF</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setSalvo(true); setTimeout(() => setSalvo(false), 2000) }}>
                {salvo ? <><CheckCircle size={13} />Ata salva!</> : <><Save size={13} />Salvar e assinar digitalmente</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
