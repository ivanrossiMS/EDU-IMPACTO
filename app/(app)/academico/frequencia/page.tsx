'use client'

import { useData, newId } from '@/lib/dataContext'
import { useState, useMemo, useCallback } from 'react'
import { getInitials } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { useEnsalamento } from '@/lib/useEnsalamento'
import {
  ArrowLeft, Save, Download, CheckCircle, BookOpen, ChevronRight,
  AlertTriangle, Search, Calendar, BarChart2, Users, Printer, FileText, Check, X, Info
} from 'lucide-react'

type PresStatus = 'P' | 'F' | 'J' | 'A'

const S_CONFIG: Record<PresStatus, { bg: string; color: string; label: string; border: string; full: string }> = {
  P: { bg:'rgba(16,185,129,0.12)', color:'#10b981', border:'rgba(16,185,129,0.3)', label:'P', full:'Presente' },
  F: { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', border:'rgba(239,68,68,0.3)',  label:'F', full:'Falta' },
  J: { bg:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'rgba(245,158,11,0.3)', label:'J', full:'Justificada' },
  A: { bg:'rgba(107,114,128,0.12)',color:'#6b7280', border:'rgba(107,114,128,0.3)',label:'A', full:'Atestado' },
}

const STATUS_CYCLE: Record<PresStatus, PresStatus> = { P:'F', F:'J', J:'A', A:'P' }
const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }
const DISCIPLINAS = ['Matemática','Português','Ciências','História','Geografia','Inglês','Artes','Educação Física','Física','Química','Biologia','Filosofia','Sociologia']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDate(s: string, mode: 'short'|'full' = 'short') {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const dn = days[new Date(s).getDay()] || ''
  return mode === 'short' ? `${d}/${m}` : `${dn}, ${d}/${m}/${y}`
}

export default function FrequenciaPage() {
  const { turmas = [], frequencias = [], setFrequencias, cfgCalendarioLetivo } = useData()
  
  const { data: apiResponse, isLoading: isLoadingAlunos } = useApiQuery<{data: any[], meta: any}>(
    ['alunos-core-frequencia'], 
    '/api/alunos', 
    { limit: 2000 }
  )
  const alunos = apiResponse?.data || []

  const [turmaSel, setTurmaSel] = useState<string|null>(null)
  const [vista, setVista] = useState<'chamada'|'disciplina'|'relatorio'>('chamada')

  // Filtros home
  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const anosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.ano))].sort().reverse(), [turmas])

  // Estado chamada
  const [dataSel, setDataSel] = useState(todayStr())
  const [modoLancamento, setModoLancamento] = useState<'geral'|'disciplina'>('geral')
  const [disciplinaSel, setDisciplinaSel] = useState(DISCIPLINAS[0])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvo, setSalvo] = useState(false)

  const activeDisc = modoLancamento === 'geral' ? 'Geral' : disciplinaSel

  const today = todayStr()
  const anoAtual = new Date().getFullYear()
  const calAtual = useMemo(() => cfgCalendarioLetivo.find(c => c.ano === anoAtual), [cfgCalendarioLetivo, anoAtual])
  const freqMinima = calAtual?.frequenciaMinima ?? 75
  const totalDiasLetivos = calAtual?.totalDiasLetivos ?? 200

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? ''
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'
  
  const { getNumeroChamada, ordenarPorChamada, formatarNumero } = useEnsalamento(turmaObj)

  const alunosDaTurma = useMemo(() => {
    const lista = turmaSel ? alunos.filter((a: any) => a.turma === turmaSel) : []
    return ordenarPorChamada(lista)
  }, [alunos, turmaSel, ordenarPorChamada])
  const alunosFiltrados = useMemo(() => !buscaAluno ? alunosDaTurma : alunosDaTurma.filter((a: any) => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())), [alunosDaTurma, buscaAluno])

  // Registros da turma
  const regsFromTurma = useMemo(() => frequencias.filter(f => f.turmaId === turmaId), [frequencias, turmaId])

  const getRegDia = useCallback((data: string, disc: string) =>
    frequencias.find(f => f.turmaId === turmaId && f.data === data && (f as any).disciplina === disc),
    [frequencias, turmaId])

  const getStatus = useCallback((alunoId: string, data: string = dataSel, disc: string = activeDisc): PresStatus => {
    const reg = getRegDia(data, disc)
    if (!reg) return 'P'
    return (reg.registros.find(r => r.alunoId === alunoId)?.status ?? 'P') as PresStatus
  }, [getRegDia, dataSel, activeDisc])

  const setStatus = (alunoId: string, statusNext: PresStatus, data = dataSel, disc = activeDisc) => {
    setFrequencias(prev => {
      const existe = prev.find(f => f.turmaId === turmaId && f.data === data && (f as any).disciplina === disc)
      if (existe) {
        return prev.map(f => {
          if (f.turmaId !== turmaId || f.data !== data || (f as any).disciplina !== disc) return f
          const hasReg = f.registros.find(r => r.alunoId === alunoId)
          const registros = hasReg
            ? f.registros.map(r => r.alunoId === alunoId ? { ...r, status: statusNext } : r)
            : [...f.registros, { alunoId, status: statusNext }]
          return { ...f, registros }
        })
      }
      return [...prev, {
        id: newId('RF'), turmaId, data,
        registros: alunosDaTurma.map(a => ({ alunoId: a.id, status: a.id === alunoId ? statusNext : 'P' as PresStatus })),
        criadoPor: 'Usuário', createdAt: new Date().toISOString(),
        disciplina: disc,
      } as any]
    })
  }

  const marcarTodos = (status: PresStatus) => {
    setFrequencias(prev => {
      const existe = prev.find(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === activeDisc)
      const regs = alunosDaTurma.map(a => ({ alunoId: a.id, status }))
      if (existe) return prev.map(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === activeDisc ? { ...f, registros: regs } : f)
      return [...prev, { id: newId('RF'), turmaId, data: dataSel, registros: regs, criadoPor: 'Usuário', createdAt: new Date().toISOString(), disciplina: activeDisc } as any]
    })
    setSalvo(true); setTimeout(() => setSalvo(false), 2000)
  }

  // Calc freq geral do aluno (todas as disciplinas)
  const calcFreqGeral = useCallback((alunoId: string) => {
    if (!regsFromTurma.length) return null
    const pres = regsFromTurma.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === alunoId)?.status ?? 'P')).length
    return Math.round((pres / regsFromTurma.length) * 100)
  }, [regsFromTurma])

  // Freq por disciplina para um aluno
  const freqPorDisc = useCallback((alunoId: string) => {
    const discs: Record<string, { total: number; pres: number }> = {}
    regsFromTurma.forEach(r => {
      const disc = (r as any).disciplina || 'Geral'
      if (!discs[disc]) discs[disc] = { total: 0, pres: 0 }
      discs[disc].total++
      const st = r.registros.find(rr => rr.alunoId === alunoId)?.status ?? 'P'
      if (['P','J'].includes(st)) discs[disc].pres++
    })
    return Object.entries(discs).map(([disc, d]) => ({ disc, ...d, pct: Math.round((d.pres / d.total) * 100) }))
  }, [regsFromTurma])

  // Disciplinas com registros
  const disciplinasComReg = useMemo(() => {
    const set = new Set<string>()
    regsFromTurma.forEach(r => set.add((r as any).disciplina || 'Geral'))
    return [...set].sort()
  }, [regsFromTurma])

  // Alunos em risco (freq < freqMinima)
  const alunosEmRisco = useMemo(() => {
    if (!turmaSel) {
      return alunos.flatMap(a => {
        const tid = turmas.find(t => t.nome === a.turma)?.id ?? ''
        const regs = frequencias.filter(f => f.turmaId === tid)
        if (!regs.length) return []
        const pres = regs.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
        const freq = Math.round((pres / regs.length) * 100)
        return freq < freqMinima ? [{ nome: a.nome, turma: a.turma, freq, critico: freq < freqMinima * 0.8 }] : []
      }).sort((a, b) => a.freq - b.freq)
    }
    return alunosDaTurma.flatMap(a => {
      const freq = calcFreqGeral(a.id)
      if (freq === null || freq >= freqMinima) return []
      return [{ nome: a.nome, turma: a.turma, freq, critico: freq < freqMinima * 0.8 }]
    })
  }, [alunos, turmas, frequencias, turmaSel, alunosDaTurma, calcFreqGeral, freqMinima])

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (!turmaSel) {
    const turmasFiltradas = turmas.filter(t =>
      (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
      (!filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    )
    const turmasComAlunos = turmas.filter(t => alunos.some(a => a.turma === t.nome))
    const turmasHoje = turmasComAlunos.filter(t => frequencias.some(f => f.turmaId === t.id && f.data === today)).length
    const turmasSemHoje = turmasComAlunos.length - turmasHoje

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Controle de Frequência</h1>
            <p className="page-subtitle">Presença por aula e disciplina • Freq. mínima: {freqMinima}% ({totalDiasLetivos} dias letivos)</p>
          </div>
        </div>

        {turmasSemHoje > 0 && turmasComAlunos.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:14, marginBottom:20, borderLeft:'4px solid #f59e0b' }}>
            <div style={{ fontSize:24 }}>⚠️</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#f59e0b' }}>{turmasSemHoje} turma{turmasSemHoje>1?'s':''} sem chamada registrada hoje</div>
              <div style={{ fontSize:12, color:'hsl(var(--text-secondary))' }}>Registre antes do fim do dia letivo</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.1)', padding:'4px 12px', borderRadius:20 }}>{turmasHoje}/{turmasComAlunos.length}</div>
          </div>
        )}

        {/* Alunos em risco */}
        {alunosEmRisco.length > 0 && (
          <div className="card" style={{ padding:'20px', borderLeft:'4px solid #ef4444', marginBottom:22 }}>
            <div style={{ fontWeight:800, fontSize:13, marginBottom:12 }}>🚨 {alunosEmRisco.length} Aluno{alunosEmRisco.length>1?'s':''} em Risco de Reprovação por Faltas</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {alunosEmRisco.slice(0,8).map(a => (
                <div key={a.nome} style={{ padding:'6px 12px', borderRadius:20, background:a.critico?'rgba(220,38,38,0.1)':'rgba(245,158,11,0.1)', border:`1px solid ${a.critico?'rgba(220,38,38,0.3)':'rgba(245,158,11,0.3)'}`, fontSize:11, fontWeight:700, color:a.critico?'#dc2626':'#f59e0b' }}>
                  {a.nome} — {a.freq}% {a.critico?'⛔':'⚠'}
                </div>
              ))}
              {alunosEmRisco.length > 8 && <span style={{ fontSize:11, color:'hsl(var(--text-muted))', alignSelf:'center' }}>+{alunosEmRisco.length-8} mais</span>}
            </div>
          </div>
        )}

        {/* Filtros + grid turmas */}
        <div style={{ display:'flex', gap:10, marginBottom:18, alignItems:'center', flexWrap:'wrap', padding:'12px 16px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
            <input className="form-input" style={{ paddingLeft:30, fontSize:12 }} placeholder="Buscar turma..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
          </div>
          <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map(a => <option key={a} value={String(a)}>{a}</option>)}
          </select>
          <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{turmasFiltradas.length}/{turmas.length}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {turmasFiltradas.map(turma => {
            const c = SEG_COLORS[turma.serie] ?? '#3b82f6'
            const alunosTurma = alunos.filter(a => a.turma === turma.nome)
            const temHoje = frequencias.some(f => f.turmaId === turma.id && f.data === today)
            const regs = frequencias.filter(f => f.turmaId === turma.id)
            const disciplinas = [...new Set(regs.map(r => (r as any).disciplina).filter(x => x !== 'Geral'))]
            const emRiscoTurma = alunosTurma.filter(a => {
              if (!regs.length) return false
              const pres = regs.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
              return Math.round((pres / regs.length) * 100) < freqMinima
            }).length
            return (
              <button key={turma.id} onClick={() => { setTurmaSel(turma.nome); setDataSel(today); setVista('chamada') }}
                style={{ textAlign:'left', background:'hsl(var(--bg-elevated))', border:`1px solid ${emRiscoTurma>0?'rgba(239,68,68,0.35)':temHoje?'rgba(16,185,129,0.35)':c+'25'}`, borderRadius:16, padding:'22px', cursor:'pointer', transition:'all 0.2s', display:'block', width:'100%', position:'relative', overflow:'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 32px ${c}25` }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(90deg,${c},${c}80)` }} />
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:20, fontWeight:900, color:c, fontFamily:'Outfit,sans-serif' }}>{turma.nome}</div>
                    <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{turma.serie} • {turma.turno} • {alunosTurma.length} alunos</div>
                  </div>
                  {alunosTurma.length === 0
                    ? <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(107,114,128,0.1)', color:'#6b7280', fontWeight:700, height:'fit-content' }}>Sem alunos</span>
                    : temHoje
                      ? <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700, height:'fit-content' }}>✓ Hoje</span>
                      : <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:700, height:'fit-content' }}>⚠ Pendente</span>
                  }
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'hsl(var(--bg-overlay))', color:'hsl(var(--text-secondary))', fontWeight:600 }}>Diário Global</span>
                  {disciplinas.slice(0,3).map(d => (
                    <span key={d} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:`${c}10`, color:c, fontWeight:600 }}>{d}</span>
                  ))}
                  {disciplinas.length > 3 && <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>+{disciplinas.length-3}</span>}
                </div>
                {emRiscoTurma > 0 && (
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#ef4444', fontWeight:700 }}>
                    <AlertTriangle size={11} /> {emRiscoTurma} aluno{emRiscoTurma>1?'s':''} em risco de reprovação
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                  <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{regs.length} registros no diário</span>
                  <ChevronRight size={16} style={{ color:c }} />
                </div>
              </button>
            )
          })}
        </div>

        {turmasFiltradas.length === 0 && (
          <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <BookOpen size={40} style={{ margin:'0 auto 14px', opacity:0.15 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>{turmas.length===0?'Nenhuma turma cadastrada':'Nenhuma turma com esses filtros'}</div>
          </div>
        )}
      </div>
    )
  }

  // ── VISTA INTERNA ─────────────────────────────────────────────────────────
  const presentes = alunosDaTurma.filter(a => getStatus(a.id) === 'P').length
  const faltas = alunosDaTurma.filter(a => getStatus(a.id) === 'F').length
  const justificadas = alunosDaTurma.filter(a => getStatus(a.id) === 'J').length
  const atestados = alunosDaTurma.filter(a => getStatus(a.id) === 'A').length
  const pctPresenca = alunosDaTurma.length > 0 ? Math.round((presentes / alunosDaTurma.length) * 100) : 0
  const jaRegistrado = !!frequencias.find(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === activeDisc)

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setTurmaSel(null)}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Diário de Frequência</h1>
              <span style={{ padding:'3px 12px', borderRadius:20, background:`${color}15`, color, fontSize:12, fontWeight:800 }}>{turmaSel}</span>
            </div>
            <p className="page-subtitle">{alunosDaTurma.length} alunos cadastrados nesta turma</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir Diário</button>
        </div>
      </div>

      {/* Abas Superiores */}
      <div className="tab-list" style={{ marginBottom:20, width:'fit-content' }}>
        <button className={`tab-trigger ${vista==='chamada'?'active':''}`} onClick={() => setVista('chamada')}>📋 Fazer Chamada</button>
        <button className={`tab-trigger ${vista==='disciplina'?'active':''}`} onClick={() => setVista('disciplina')}>📊 Histórico/Disciplinas</button>
        <button className={`tab-trigger ${vista==='relatorio'?'active':''}`} onClick={() => setVista('relatorio')}>📑 Diário do Aluno</button>
      </div>

      {/* ── ABA CHAMADA ── */}
      {vista === 'chamada' && (
        <>
          {/* Controles de Lançamento (Toolbar Produtividade) */}
          <div style={{ padding:'16px 20px', background:'hsl(var(--bg-elevated))', borderRadius:16, border:'1px solid hsl(var(--border-subtle))', marginBottom:20, display:'flex', flexDirection:'column', gap:16, boxShadow:'0 4px 20px rgba(0,0,0,0.02)' }}>
            
            {/* Top Toolbar */}
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:20, alignItems:'center' }}>
              
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                {/* Data Selector */}
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'hsl(var(--bg-overlay))', padding:'6px 12px', borderRadius:10 }}>
                  <Calendar size={15} style={{ color:'hsl(var(--text-muted))' }} />
                  <input className="form-input" style={{ width:'auto', background:'transparent', border:'none', padding:0, height:24, fontWeight:600, fontSize:14 }} type="date" value={dataSel} onChange={e => setDataSel(e.target.value)} />
                </div>

                <div style={{ width:1, height:24, background:'hsl(var(--border-subtle))' }} />

                {/* Switch Diário x Disciplina */}
                <div style={{ display:'flex', gap:4, padding:4, background:'hsl(var(--bg-overlay))', borderRadius:10 }}>
                  <button onClick={() => setModoLancamento('geral')} style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background: modoLancamento === 'geral' ? 'hsl(var(--bg-elevated))' : 'transparent', color: modoLancamento === 'geral' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', boxShadow: modoLancamento==='geral'?'0 2px 8px rgba(0,0,0,0.05)':'none', transition:'all 0.2s' }}>
                    Diário Geral da Turma
                  </button>
                  <button onClick={() => setModoLancamento('disciplina')} style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background: modoLancamento === 'disciplina' ? 'hsl(var(--bg-elevated))' : 'transparent', color: modoLancamento === 'disciplina' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', boxShadow: modoLancamento==='disciplina'?'0 2px 8px rgba(0,0,0,0.05)':'none', transition:'all 0.2s' }}>
                    Por Disciplina
                  </button>
                </div>
                
                {/* Selector Condicional */}
                {modoLancamento === 'disciplina' && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, animation:'fade-in 0.2s ease' }}>
                    <BookOpen size={14} style={{ color:'hsl(var(--text-muted))' }} />
                    <select className="form-input" style={{ width:'auto', fontSize:13, height:36, borderRadius:8 }} value={disciplinaSel} onChange={e => setDisciplinaSel(e.target.value)}>
                      {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Mega CTA Preenchimento Automático */}
              <button 
                onClick={() => marcarTodos('P')} 
                style={{ 
                  background: salvo ? '#10b981' : 'linear-gradient(135deg, #10b981, #059669)', 
                  color:'#fff', border:'none', padding:'0 24px', height:44, borderRadius:12, fontWeight:800, fontSize:14, 
                  display:'flex', alignItems:'center', gap:8, cursor:'pointer', transition:'all 0.2s',
                  boxShadow: '0 8px 16px rgba(16,185,129,0.25)', flexShrink:0
                }}
                onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
              >
                {salvo ? <CheckCircle size={18} /> : <span>✔️</span>}
                {salvo ? 'Presenças Salvas!' : 'Preencher Todos como Presentes'}
              </button>

            </div>

            <div style={{ height:1, background:'hsl(var(--border-subtle))' }} />

            {/* Bottom Toolbar: KPIs and Search */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
               
               <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                 {jaRegistrado && <span style={{ padding:'4px 10px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', gap:5 }}><Check size={13}/> Diário do dia contêm salvamentos</span>}
                 {!jaRegistrado && <span style={{ padding:'4px 10px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', gap:5 }}><Info size={13}/> Chamada Pendente Oficialmente</span>}
                 
                 <div style={{ borderLeft:'2px solid hsl(var(--border-subtle))', paddingLeft:14, display:'flex', gap:14 }}>
                    <div style={{ display:'flex', flexDirection:'column' }}><span style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600}}>Presentes</span><span style={{fontSize:14,fontWeight:900,color:'#10b981'}}>{presentes}</span></div>
                    <div style={{ display:'flex', flexDirection:'column' }}><span style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600}}>Faltas</span><span style={{fontSize:14,fontWeight:900,color:faltas>0?'#ef4444':'hsl(var(--text-muted))'}}>{faltas}</span></div>
                 </div>
               </div>

               <div style={{ position:'relative', width:260 }}>
                 <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
                 <input className="form-input" style={{ paddingLeft:34, fontSize:13, borderRadius:10, background:'hsl(var(--bg-overlay))', border:'none' }} placeholder="Procurar aluno pelo nome..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} />
               </div>

            </div>
          </div>

          {/* Legenda Helper */}
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'hsl(var(--text-muted))', fontWeight:700 }}>ATALHOS DA LISTA:</span>
            {(Object.entries(S_CONFIG) as [PresStatus, typeof S_CONFIG['P']][]).map(([k,v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:8, background:v.bg, border:`1px solid ${v.border}` }}>
                <div style={{ width:16,height:16,borderRadius:4,background:v.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'#fff' }}>{k}</div>
                <span style={{ fontSize:11, color:v.color, fontWeight:700 }}>{v.full}</span>
              </div>
            ))}
          </div>

          {/* Lista alunos Ledger-style */}
          {alunosDaTurma.length === 0 ? (
            <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <Users size={40} style={{ margin:'0 auto 16px', opacity:0.2 }} />
              <div style={{ fontSize:16, fontWeight:700 }}>Nenhum aluno cadastrado nesta turma.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {/* Header Listagem */}
              <div style={{ display:'grid', gridTemplateColumns:'44px 1fr repeat(4, 52px) 140px', gap:12, padding:'0 16px 8px 16px', borderBottom:'2px solid hsl(var(--border-subtle))', alignItems:'center' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))' }}>Nº</div>
                <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))' }}>NOME DO ALUNO</div>
                {['P','F','J','A'].map(h => (
                   <div key={h} style={{ fontSize:11, fontWeight:900, color:'hsl(var(--text-primary))', textAlign:'center' }}>{h}</div>
                ))}
                <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textAlign:'right' }}>% ATUAL (GERAL)</div>
              </div>

              {alunosFiltrados.map((aluno, idx) => {
                const statusAtual = getStatus(aluno.id)
                const isFalta = statusAtual === 'F'
                const isWarning = statusAtual === 'J' || statusAtual === 'A'
                
                const freqGeral = calcFreqGeral(aluno.id)
                const geralBad = freqGeral !== null && freqGeral < freqMinima
                const alertPct = freqMinima * 1.05

                return (
                  <div key={aluno.id}
                    style={{ 
                      display:'grid', gridTemplateColumns:'44px 1fr repeat(4, 52px) 140px', gap:12, padding:'14px 16px', 
                      background: isFalta ? 'rgba(239,68,68,0.04)' : isWarning ? 'rgba(245,158,11,0.03)' : 'hsl(var(--bg-elevated))', 
                      borderRadius:12, 
                      border: `1px solid ${isFalta ? 'rgba(239,68,68,0.3)' : isWarning ? 'rgba(245,158,11,0.3)' : 'hsl(var(--border-subtle))'}`, 
                      borderLeft: isFalta ? '4px solid #ef4444' : isWarning ? '4px solid #f59e0b' : '4px solid transparent',
                      alignItems:'center', transition:'all 0.15s' 
                    }}
                    onMouseEnter={e => { if(!isFalta) e.currentTarget.style.background='hsl(var(--bg-overlay))' }}
                    onMouseLeave={e => { if(!isFalta) e.currentTarget.style.background='hsl(var(--bg-elevated))' }}
                  >
                    <div style={{ width:34,height:34,borderRadius:10,background:`${color}12`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,fontFamily:'Outfit,monospace' }}>
                      {formatarNumero(aluno.id)}
                    </div>
                    
                    <div style={{ display:'flex', alignItems:'center', gap:12, overflow:'hidden' }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:S_CONFIG[statusAtual].bg,color:S_CONFIG[statusAtual].color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0, transition:'all 0.2s' }}>
                        {getInitials(aluno.nome)}
                      </div>
                      <div style={{ minWidth:0, overflow:'hidden' }}>
                        <div style={{ fontSize:14, fontWeight:800, color: isFalta ? '#ef4444' : 'hsl(var(--text-primary))', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{aluno.nome}</div>
                        {geralBad && <div style={{ fontSize:9, color:'#ef4444', fontWeight:800, marginTop:1, display:'flex', gap:3, alignItems:'center' }}><AlertTriangle size={9}/> Risco de reprovação ({freqGeral}%)</div>}
                      </div>
                    </div>

                    {/* Botões Lançamento (Chunky Targets) */}
                    {(['P','F','J','A'] as PresStatus[]).map(s => {
                      const isSel = statusAtual === s
                      return (
                        <div key={s} style={{ display:'flex', justifyContent:'center' }}>
                          <button onClick={() => !isSel && setStatus(aluno.id, s)}
                            style={{ 
                              width:44, height:44, borderRadius:12, fontWeight:900, fontSize:15, cursor:isSel?'default':'pointer', transition:'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                              background: isSel ? S_CONFIG[s].bg : 'hsl(var(--bg-overlay))',
                              border: isSel ? `2px solid ${S_CONFIG[s].border}` : '1px solid hsl(var(--border-subtle))',
                              color: isSel ? S_CONFIG[s].color : 'hsl(var(--text-muted))',
                              transform: isSel ? 'scale(1.08)' : 'scale(1)',
                              boxShadow: isSel ? `0 4px 12px ${S_CONFIG[s].bg}` : 'none'
                             }}>
                            {s}
                          </button>
                        </div>
                      )
                    })}

                    {/* Freq. geral lateral */}
                    <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
                      {freqGeral !== null ? (
                        <>
                          <div style={{ fontSize:15, fontWeight:900, color:geralBad?'#ef4444':freqGeral<alertPct?'#f59e0b':'#10b981', fontFamily:'Outfit,sans-serif' }}>{freqGeral}%</div>
                          <div style={{ width:60, height:4, borderRadius:2, background:'hsl(var(--bg-overlay))', marginTop:4, overflow:'hidden' }}>
                            <div style={{ width:`${Math.min(freqGeral,100)}%`, height:'100%', background:geralBad?'#ef4444':freqGeral<alertPct?'#f59e0b':'#10b981' }} />
                          </div>
                        </>
                      ) : <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── ABA POR DISCIPLINA ── */}
      {vista === 'disciplina' && (
        <div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📊 Histórico de Frequência vs Disciplinas</div>
          {disciplinasComReg.length === 0 ? (
            <div className="card" style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <BarChart2 size={40} style={{ margin:'0 auto 12px', opacity:0.2 }} />
              <div style={{ fontWeight:700 }}>Sem dados para exibir.</div>
              <div style={{ fontSize:12 }}>Use a opção 'Por Disciplina' ou 'Diário Geral' para gerar relatórios.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {disciplinasComReg.map(disc => {
                const regsDisc = regsFromTurma.filter(r => (r as any).disciplina === disc)
                const alunosComRisco = alunosDaTurma.filter(a => {
                  const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
                  return regsDisc.length > 0 && Math.round((p / regsDisc.length) * 100) < freqMinima
                })
                const mediaFreq = alunosDaTurma.length > 0 ? Math.round(
                  alunosDaTurma.reduce((acc, a) => {
                    const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
                    return acc + (regsDisc.length > 0 ? p / regsDisc.length : 0)
                  }, 0) / alunosDaTurma.length * 100
                ) : 0
                return (
                  <div key={disc} className="card" style={{ padding:'24px', borderLeft:`4px solid ${mediaFreq<freqMinima?'#ef4444':color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                      <div>
                        <div style={{ fontWeight:900, fontSize:18 }}>{disc === 'Geral' ? 'Diário Global (Sem Disciplina Curricular)' : disc}</div>
                        <div style={{ fontSize:12, color:'hsl(var(--text-muted))', fontWeight:600, marginTop:2 }}>{regsDisc.length} dias lançados oficialmente</div>
                      </div>
                      <div style={{ textAlign:'right', background:'hsl(var(--bg-overlay))', padding:'10px 20px', borderRadius:12 }}>
                        <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:800, letterSpacing:1 }}>MÉDIA DA TURMA</div>
                        <div style={{ fontSize:32, fontWeight:900, color:mediaFreq<freqMinima?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif', lineHeight:1.1 }}>{mediaFreq}%</div>
                      </div>
                    </div>
                    {alunosComRisco.length > 0 && (
                      <div style={{ marginBottom:16, padding:'10px 16px', background:'rgba(239,68,68,0.06)', borderRadius:10, fontSize:12, color:'#ef4444', fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                        <AlertTriangle size={14} /> {alunosComRisco.length} aluno{alunosComRisco.length>1?'s':''} com frequência abaixo da meta estipulada de {freqMinima}% nesta aba
                      </div>
                    )}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
                      {alunosDaTurma.map(a => {
                        const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
                        const pct = regsDisc.length > 0 ? Math.round((p / regsDisc.length) * 100) : null
                        const bad = pct !== null && pct < freqMinima
                        return (
                          <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'hsl(var(--bg-overlay))', borderRadius:10, border:`1px solid ${bad?'rgba(239,68,68,0.3)':'transparent'}` }}>
                            <div style={{ width:30,height:30,borderRadius:8,background:`${color}15`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,flexShrink:0 }}>{getInitials(a.nome)}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:bad?'#ef4444':'hsl(var(--text-primary))' }}>{a.nome}</div>
                              <div style={{ height:4, borderRadius:2, background:'hsl(var(--border-subtle))', marginTop:4 }}>
                                <div style={{ width:`${Math.min(pct??0,100)}%`, height:'100%', borderRadius:2, background:bad?'#ef4444':'#10b981' }} />
                              </div>
                            </div>
                            <div style={{ fontSize:13, fontWeight:900, color:bad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif', flexShrink:0 }}>{pct !== null ? `${pct}%` : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA RELATÓRIO DO ALUNO ── */}
      {vista === 'relatorio' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>📑 Resumo Consolidado de Extrato do Diário</div>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir Relatório Formato Tabela</button>
          </div>
          <div className="card" style={{ overflowX:'auto', padding:'2px', borderRadius:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                  <th style={{ padding:'14px 16px', textAlign:'left', fontWeight:800, fontSize:11, color:'hsl(var(--text-muted))', whiteSpace:'nowrap', borderTopLeftRadius:14 }}>NOME DO ESTUDANTE</th>
                  {disciplinasComReg.map(d => (
                    <th key={d} style={{ padding:'14px 10px', textAlign:'center', fontWeight:800, fontSize:10, color:'hsl(var(--text-muted))' }}>{d.toUpperCase() === 'GERAL' ? 'GLOBAL' : d.toUpperCase()}</th>
                  ))}
                  <th style={{ padding:'14px 16px', textAlign:'center', fontWeight:900, fontSize:11, color:'hsl(var(--text-primary))' }}>AGREGADO TOTAL</th>
                  <th style={{ padding:'14px 16px', textAlign:'center', fontWeight:800, fontSize:11, color:'hsl(var(--text-muted))', borderTopRightRadius:14 }}>SITUAÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {alunosDaTurma.map((aluno, i) => {
                  const freqGeral = calcFreqGeral(aluno.id)
                  const geralBad = freqGeral !== null && freqGeral < freqMinima
                  return (
                    <tr key={aluno.id} style={{ borderBottom: i === alunosDaTurma.length-1 ? 'none' : '1px solid hsl(var(--border-subtle))', background: i%2===0?'transparent':'hsl(var(--bg-overlay))' }}>
                      <td style={{ padding:'12px 16px', fontWeight:700, whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:28,height:28,borderRadius:8,background:`${color}15`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900 }}>{getInitials(aluno.nome)}</div>
                          {aluno.nome}
                        </div>
                      </td>
                      {disciplinasComReg.map(disc => {
                        const regsDisc = regsFromTurma.filter(r => (r as any).disciplina === disc)
                        const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === aluno.id)?.status ?? 'P')).length
                        const pct = regsDisc.length > 0 ? Math.round((p / regsDisc.length) * 100) : null
                        const bad = pct !== null && pct < freqMinima
                        return (
                          <td key={disc} style={{ padding:'12px 10px', textAlign:'center', fontWeight:800, color:pct===null?'hsl(var(--text-muted))':bad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:900, fontSize:14, color:geralBad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>
                        {freqGeral !== null ? `${freqGeral}%` : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'center' }}>
                        {geralBad
                          ? <span style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:800 }}>⛔ Risco Reprov.</span>
                          : <span style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:800 }}>✓ Amparado</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@media print { .page-header button, .tab-list { display:none!important; } }
      
      @keyframes fade-in {
        from { opacity: 0; transform: translateX(-5px); }
        to { opacity: 1; transform: translateX(0); }
      }
      `}</style>
    </div>
  )
}
