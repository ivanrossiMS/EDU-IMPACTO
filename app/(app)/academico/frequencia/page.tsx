'use client'

import { useData, newId } from '@/lib/dataContext'
import { useState, useMemo, useCallback } from 'react'
import { getInitials } from '@/lib/utils'
import {
  ArrowLeft, Save, Download, CheckCircle, BookOpen, ChevronRight,
  AlertTriangle, Search, Calendar, BarChart2, Users, Printer, FileText
} from 'lucide-react'

type PresStatus = 'P' | 'F' | 'J' | 'A'

const S_CONFIG: Record<PresStatus, { bg: string; color: string; label: string; border: string; full: string }> = {
  P: { bg:'rgba(16,185,129,0.12)', color:'#10b981', border:'rgba(16,185,129,0.35)', label:'P', full:'Presente' },
  F: { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', border:'rgba(239,68,68,0.35)',  label:'F', full:'Falta' },
  J: { bg:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'rgba(245,158,11,0.35)', label:'J', full:'Justificada' },
  A: { bg:'rgba(107,114,128,0.12)',color:'#6b7280', border:'rgba(107,114,128,0.35)',label:'A', full:'Atestado' },
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
  const { alunos, turmas, frequencias, setFrequencias, cfgCalendarioLetivo } = useData()
  const [turmaSel, setTurmaSel] = useState<string|null>(null)
  const [vista, setVista] = useState<'chamada'|'disciplina'|'relatorio'>('chamada')

  // Filtros home
  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const anosDisponiveis = useMemo(() => [...new Set(turmas.map(t => t.ano))].sort().reverse(), [turmas])

  // Estado chamada
  const [dataSel, setDataSel] = useState(todayStr())
  const [disciplinaSel, setDisciplinaSel] = useState(DISCIPLINAS[0])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvo, setSalvo] = useState(false)

  const today = todayStr()
  const anoAtual = new Date().getFullYear()
  const calAtual = useMemo(() => cfgCalendarioLetivo.find(c => c.ano === anoAtual), [cfgCalendarioLetivo, anoAtual])
  const freqMinima = calAtual?.frequenciaMinima ?? 75
  const totalDiasLetivos = calAtual?.totalDiasLetivos ?? 200

  const turmaObj = turmaSel ? turmas.find(t => t.nome === turmaSel) : null
  const turmaId = turmaObj?.id ?? ''
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'
  const alunosDaTurma = useMemo(() => turmaSel ? alunos.filter(a => a.turma === turmaSel) : [], [alunos, turmaSel])
  const alunosFiltrados = useMemo(() => !buscaAluno ? alunosDaTurma : alunosDaTurma.filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())), [alunosDaTurma, buscaAluno])

  // Registros da turma
  const regsFromTurma = useMemo(() => frequencias.filter(f => f.turmaId === turmaId), [frequencias, turmaId])

  // Chave composta: data + disciplina
  const regKey = (data: string, disc: string) => `${data}::${disc}`

  const getRegDia = useCallback((data: string, disc: string) =>
    frequencias.find(f => f.turmaId === turmaId && f.data === data && (f as any).disciplina === disc),
    [frequencias, turmaId])

  const getStatus = useCallback((alunoId: string, data: string = dataSel, disc: string = disciplinaSel): PresStatus => {
    const reg = getRegDia(data, disc)
    if (!reg) return 'P'
    return (reg.registros.find(r => r.alunoId === alunoId)?.status ?? 'P') as PresStatus
  }, [getRegDia, dataSel, disciplinaSel])

  const setStatus = (alunoId: string, statusNext: PresStatus, data = dataSel, disc = disciplinaSel) => {
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
      const existe = prev.find(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === disciplinaSel)
      const regs = alunosDaTurma.map(a => ({ alunoId: a.id, status }))
      if (existe) return prev.map(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === disciplinaSel ? { ...f, registros: regs } : f)
      return [...prev, { id: newId('RF'), turmaId, data: dataSel, registros: regs, criadoPor: 'Usuário', createdAt: new Date().toISOString(), disciplina: disciplinaSel } as any]
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
    const turmasHoje = turmas.filter(t => frequencias.some(f => f.turmaId === t.id && f.data === today)).length
    const turmasSemHoje = turmas.length - turmasHoje

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Controle de Frequência</h1>
            <p className="page-subtitle">Presença por aula e disciplina • Freq. mínima: {freqMinima}% ({totalDiasLetivos} dias letivos)</p>
          </div>
        </div>

        {turmasSemHoje > 0 && turmas.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:14, marginBottom:20, borderLeft:'4px solid #f59e0b' }}>
            <div style={{ fontSize:24 }}>⚠️</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#f59e0b' }}>{turmasSemHoje} turma{turmasSemHoje>1?'s':''} sem chamada registrada hoje</div>
              <div style={{ fontSize:12, color:'hsl(var(--text-secondary))' }}>Registre antes do fim do dia letivo</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.1)', padding:'4px 12px', borderRadius:20 }}>{turmasHoje}/{turmas.length}</div>
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
            const disciplinas = [...new Set(regs.map(r => (r as any).disciplina).filter(Boolean))]
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
                  {temHoje
                    ? <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700, height:'fit-content' }}>✓ Hoje</span>
                    : <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:700, height:'fit-content' }}>⚠ Pendente</span>
                  }
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {disciplinas.slice(0,4).map(d => (
                    <span key={d} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:`${c}10`, color:c, fontWeight:600 }}>{d}</span>
                  ))}
                  {disciplinas.length > 4 && <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>+{disciplinas.length-4}</span>}
                </div>
                {emRiscoTurma > 0 && (
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#ef4444', fontWeight:700 }}>
                    <AlertTriangle size={11} /> {emRiscoTurma} aluno{emRiscoTurma>1?'s':''} em risco de reprovação
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                  <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{regs.length} registros • {disciplinas.length} disciplinas</span>
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
  const jaRegistrado = !!frequencias.find(f => f.turmaId === turmaId && f.data === dataSel && (f as any).disciplina === disciplinaSel)

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setTurmaSel(null)}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ marginBottom:0 }}>Frequência — {turmaSel}</h1>
              <span style={{ padding:'2px 10px', borderRadius:20, background:`${color}15`, color, fontSize:11, fontWeight:700 }}>{turmaObj?.serie}</span>
              {jaRegistrado && <span style={{ padding:'2px 10px', borderRadius:20, background:'rgba(16,185,129,0.12)', color:'#10b981', fontSize:11, fontWeight:700 }}>✓ Registrado</span>}
            </div>
            <p className="page-subtitle">{alunosDaTurma.length} alunos • Freq. mínima: {freqMinima}%</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir</button>
          <button className="btn btn-primary btn-sm" onClick={() => marcarTodos('P')}>
            {salvo ? <><CheckCircle size={13} />Salvo!</> : <><Save size={13} />Marcar todos P</>}
          </button>
        </div>
      </div>

      {/* Abas vista */}
      <div className="tab-list" style={{ marginBottom:16, width:'fit-content' }}>
        <button className={`tab-trigger ${vista==='chamada'?'active':''}`} onClick={() => setVista('chamada')}>📋 Chamada</button>
        <button className={`tab-trigger ${vista==='disciplina'?'active':''}`} onClick={() => setVista('disciplina')}>📊 Por Disciplina</button>
        <button className={`tab-trigger ${vista==='relatorio'?'active':''}`} onClick={() => setVista('relatorio')}>📑 Relatório do Aluno</button>
      </div>

      {/* ── ABA CHAMADA ── */}
      {vista === 'chamada' && (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Total',      value:alunosDaTurma.length, color:'#3b82f6' },
              { label:'Presentes',  value:presentes,   color:'#10b981' },
              { label:'Faltas',     value:faltas,      color:'#ef4444' },
              { label:'Justific.',  value:justificadas,color:'#f59e0b' },
              { label:'Atestados',  value:atestados,   color:'#6b7280' },
              { label:'% Presença', value:`${pctPresenca}%`, color: pctPresenca>=freqMinima?'#10b981':'#ef4444' },
            ].map((c,i) => (
              <div key={i} className="kpi-card" style={{ borderTop:`3px solid ${c.color}`, padding:'12px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif' }}>{c.value}</div>
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:3 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Controles */}
          <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center', flexWrap:'wrap', background:'hsl(var(--bg-elevated))', padding:'12px 16px', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
            {/* Data */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Calendar size={14} style={{ color:'hsl(var(--text-muted))' }} />
              <input className="form-input" type="date" value={dataSel} onChange={e => setDataSel(e.target.value)} style={{ width:'auto' }} />
            </div>

            {/* Disciplina */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <BookOpen size={14} style={{ color:'hsl(var(--text-muted))' }} />
              <select className="form-input" style={{ width:'auto', fontSize:12 }} value={disciplinaSel} onChange={e => setDisciplinaSel(e.target.value)}>
                {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Busca */}
            <div style={{ position:'relative', flex:1, minWidth:160 }}>
              <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
              <input className="form-input" style={{ paddingLeft:28, fontSize:12 }} placeholder="Buscar aluno..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} />
            </div>

            {/* Marcar todos */}
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Marcar todos:</span>
              {(['P','F','J','A'] as PresStatus[]).map(s => (
                <button key={s} onClick={() => marcarTodos(s)}
                  style={{ width:32, height:32, borderRadius:8, fontSize:12, fontWeight:800, cursor:'pointer', background:S_CONFIG[s].bg, border:`1px solid ${S_CONFIG[s].border}`, color:S_CONFIG[s].color }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Legenda */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            {(Object.entries(S_CONFIG) as [PresStatus, typeof S_CONFIG['P']][]).map(([k,v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:8, background:v.bg, border:`1px solid ${v.border}` }}>
                <div style={{ width:16,height:16,borderRadius:4,background:v.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'#fff' }}>{k}</div>
                <span style={{ fontSize:11, color:v.color, fontWeight:600 }}>{v.full}</span>
              </div>
            ))}
            <span style={{ marginLeft:'auto', fontSize:11, color:'hsl(var(--text-muted))' }}>Discipline: <strong style={{ color }}>{disciplinaSel}</strong></span>
          </div>

          {/* Lista alunos */}
          {alunosDaTurma.length === 0 ? (
            <div className="card" style={{ padding:'30px', textAlign:'center', color:'hsl(var(--text-muted))' }}>Nenhum aluno nesta turma.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {/* Cabeçalho */}
              <div style={{ display:'grid', gridTemplateColumns:'40px 1fr repeat(4,50px) 80px 80px', gap:10, padding:'8px 16px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
                {['Nº','Aluno','P','F','J','A','Freq.Disc','Freq.Geral'].map(h => (
                  <div key={h} style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textAlign:['P','F','J','A'].includes(h)?'center':undefined }}>{h}</div>
                ))}
              </div>

              {alunosFiltrados.map((aluno, idx) => {
                const statusAtual = getStatus(aluno.id)
                const freqGeral = calcFreqGeral(aluno.id)
                const freqDisc = (() => {
                  const regsDisc = regsFromTurma.filter(r => (r as any).disciplina === disciplinaSel)
                  if (!regsDisc.length) return null
                  const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === aluno.id)?.status ?? 'P')).length
                  return Math.round((p / regsDisc.length) * 100)
                })()
                const geralBad = freqGeral !== null && freqGeral < freqMinima
                const discBad = freqDisc !== null && freqDisc < freqMinima
                const alertPct = freqMinima * 1.05 // 5% acima do mínimo = alerta amarelo

                return (
                  <div key={aluno.id}
                    style={{ display:'grid', gridTemplateColumns:'40px 1fr repeat(4,50px) 80px 80px', gap:10, padding:'11px 16px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:`1px solid ${geralBad?'rgba(239,68,68,0.35)':'hsl(var(--border-subtle))'}`, alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='hsl(var(--bg-overlay))' }}
                    onMouseLeave={e => { e.currentTarget.style.background='hsl(var(--bg-elevated))' }}>
                    <div style={{ width:32,height:32,borderRadius:9,background:`${color}15`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,fontFamily:'Outfit,monospace' }}>
                      {String(idx+1).padStart(2,'0')}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:30,height:30,borderRadius:8,background:S_CONFIG[statusAtual].bg,color:S_CONFIG[statusAtual].color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,flexShrink:0 }}>
                        {getInitials(aluno.nome)}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{aluno.nome}</div>
                        {geralBad && <div style={{ fontSize:9, color:'#ef4444', fontWeight:700 }}>⚠ Risco de reprovação por faltas</div>}
                      </div>
                    </div>

                    {/* Botões P/F/J/A */}
                    {(['P','F','J','A'] as PresStatus[]).map(s => {
                      const isSel = statusAtual === s
                      return (
                        <div key={s} style={{ display:'flex', justifyContent:'center' }}>
                          <button onClick={() => !isSel && setStatus(aluno.id, s)}
                            style={{ width:38,height:38,borderRadius:8,fontWeight:900,fontSize:13,cursor:isSel?'default':'pointer',transition:'all 0.15s',
                              background:isSel?S_CONFIG[s].bg:'transparent',
                              border:`${isSel?2:1}px solid ${isSel?S_CONFIG[s].border:'hsl(var(--border-subtle))'}`,
                              color:isSel?S_CONFIG[s].color:'hsl(var(--text-muted))',
                              transform:isSel?'scale(1.05)':'' }}>
                            {s}
                          </button>
                        </div>
                      )
                    })}

                    {/* Freq. disciplina */}
                    <div style={{ textAlign:'center' }}>
                      {freqDisc !== null ? (
                        <div>
                          <div style={{ fontSize:13, fontWeight:900, color:discBad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>{freqDisc}%</div>
                          <div style={{ height:3, borderRadius:2, background:'hsl(var(--bg-overlay))', marginTop:2 }}>
                            <div style={{ width:`${Math.min(freqDisc,100)}%`, height:'100%', borderRadius:2, background:discBad?'#ef4444':'#10b981' }} />
                          </div>
                        </div>
                      ) : <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>—</span>}
                    </div>

                    {/* Freq. geral */}
                    <div style={{ textAlign:'center' }}>
                      {freqGeral !== null ? (
                        <div>
                          <div style={{ fontSize:13, fontWeight:900, color:geralBad?'#ef4444':freqGeral<alertPct?'#f59e0b':'#10b981', fontFamily:'Outfit,sans-serif' }}>{freqGeral}%</div>
                          {geralBad && <div style={{ fontSize:8, color:'#ef4444', fontWeight:700 }}>⛔ RISCO</div>}
                          {!geralBad && freqGeral < alertPct && <div style={{ fontSize:8, color:'#f59e0b', fontWeight:700 }}>⚠ ATENÇÃO</div>}
                        </div>
                      ) : <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>—</span>}
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
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📊 Frequência por Disciplina — {turmaSel}</div>
          {disciplinasComReg.length === 0 ? (
            <div className="card" style={{ padding:'30px', textAlign:'center', color:'hsl(var(--text-muted))' }}>Nenhuma chamada registrada com disciplina. Use a aba Chamada e selecione a disciplina.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
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
                  <div key={disc} className="card" style={{ padding:'20px', borderLeft:`4px solid ${mediaFreq<freqMinima?'#ef4444':color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15 }}>{disc}</div>
                        <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{regsDisc.length} aula{regsDisc.length!==1?'s':''} registradas</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:28, fontWeight:900, color:mediaFreq<freqMinima?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>{mediaFreq}%</div>
                        <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>frequência média</div>
                      </div>
                    </div>
                    {alunosComRisco.length > 0 && (
                      <div style={{ marginBottom:12, padding:'8px 12px', background:'rgba(239,68,68,0.06)', borderRadius:8, fontSize:11, color:'#ef4444', fontWeight:600 }}>
                        ⚠ {alunosComRisco.length} aluno{alunosComRisco.length>1?'s':''} com frequência abaixo de {freqMinima}%
                      </div>
                    )}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                      {alunosDaTurma.map(a => {
                        const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === a.id)?.status ?? 'P')).length
                        const pct = regsDisc.length > 0 ? Math.round((p / regsDisc.length) * 100) : null
                        const bad = pct !== null && pct < freqMinima
                        return (
                          <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'hsl(var(--bg-elevated))', borderRadius:8, border:`1px solid ${bad?'rgba(239,68,68,0.3)':'hsl(var(--border-subtle))'}` }}>
                            <div style={{ width:26,height:26,borderRadius:7,background:`${color}15`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,flexShrink:0 }}>{getInitials(a.nome)}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome.split(' ')[0]}</div>
                              <div style={{ height:3, borderRadius:2, background:'hsl(var(--bg-overlay))', marginTop:2 }}>
                                <div style={{ width:`${Math.min(pct??0,100)}%`, height:'100%', borderRadius:2, background:bad?'#ef4444':'#10b981' }} />
                              </div>
                            </div>
                            <div style={{ fontSize:12, fontWeight:900, color:bad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif', flexShrink:0 }}>{pct !== null ? `${pct}%` : '—'}</div>
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
            <div style={{ fontWeight:700, fontSize:14 }}>📑 Relatório Individual de Frequência — {turmaSel}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir Relatório</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-elevated))', borderBottom:'2px solid hsl(var(--border-subtle))' }}>
                  <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'hsl(var(--text-muted))', whiteSpace:'nowrap' }}>Aluno</th>
                  {disciplinasComReg.map(d => (
                    <th key={d} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, fontSize:10, color:'hsl(var(--text-muted))' }}>{d}</th>
                  ))}
                  <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:800, fontSize:11, color:'hsl(var(--text-primary))' }}>GERAL</th>
                  <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, fontSize:11, color:'hsl(var(--text-muted))' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {alunosDaTurma.map((aluno, i) => {
                  const freqGeral = calcFreqGeral(aluno.id)
                  const geralBad = freqGeral !== null && freqGeral < freqMinima
                  return (
                    <tr key={aluno.id} style={{ borderBottom:'1px solid hsl(var(--border-subtle))', background: i%2===0?'transparent':'hsl(var(--bg-elevated))' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:24,height:24,borderRadius:7,background:`${color}15`,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800 }}>{getInitials(aluno.nome)}</div>
                          {aluno.nome}
                        </div>
                      </td>
                      {disciplinasComReg.map(disc => {
                        const regsDisc = regsFromTurma.filter(r => (r as any).disciplina === disc)
                        const p = regsDisc.filter(r => ['P','J'].includes(r.registros.find(rr => rr.alunoId === aluno.id)?.status ?? 'P')).length
                        const pct = regsDisc.length > 0 ? Math.round((p / regsDisc.length) * 100) : null
                        const bad = pct !== null && pct < freqMinima
                        return (
                          <td key={disc} style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:pct===null?'hsl(var(--text-muted))':bad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding:'10px 14px', textAlign:'center', fontWeight:900, fontSize:15, color:geralBad?'#ef4444':'#10b981', fontFamily:'Outfit,sans-serif' }}>
                        {freqGeral !== null ? `${freqGeral}%` : '—'}
                      </td>
                      <td style={{ padding:'10px 14px', textAlign:'center' }}>
                        {geralBad
                          ? <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:700 }}>⛔ Em Risco</span>
                          : <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700 }}>✓ Regular</span>
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

      <style>{`@media print { .page-header button, .tab-list { display:none!important; } }`}</style>
    </div>
  )
}
