'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, CheckCircle, Clock, Info, ShieldAlert,
  ArrowDownToLine, Printer, Filter, Calendar, BookOpen, AlertTriangle, UserMinus,
  Search, X, ChevronRight, Layers
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useApiQuery } from '@/hooks/useApi'
import { getInitials } from '@/lib/utils'

const fmtMoeda = (nv: number) => nv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AlunosFaltososPage() {
  const { frequencias = [], turmas = [], cfgCalendarioLetivo = [] } = useData()

  const { data: apiResponse } = useApiQuery<{data: any[], meta: any}>(
    ['alunos-core-faltosos'], 
    '/api/alunos', 
    { limit: 2000 }
  )
  const rawAlunos = apiResponse?.data || []

  // Base configurations
  const alunos = Array.isArray(rawAlunos) ? rawAlunos : []
  const freqMinima = cfgCalendarioLetivo[0]?.frequenciaMinima ?? 75

  // Scoped Filters State
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [filtroTurma, setFiltroTurma] = useState('Todas')
  const [filtroDisciplina, setFiltroDisciplina] = useState('Todas')
  const [filtroAluno, setFiltroAluno] = useState('Todos')
  const [filtroSituacao, setFiltroSituacao] = useState('matriculado') // default: apenas cursando
  const [ordenacao, setOrdenacao] = useState<'freq-asc' | 'freq-desc' | 'faltas-desc' | 'nome-asc'>('freq-asc')

  // Modals State
  const [modalTurmaOpen, setModalTurmaOpen] = useState(false)
  const [modalAnoSel, setModalAnoSel] = useState<string>('')
  
  const [modalAlunoOpen, setModalAlunoOpen] = useState(false)
  const [modalBuscaAluno, setModalBuscaAluno] = useState('')

  // Derive filter lists
  const anosDisponiveis = useMemo(() => {
    return [...new Set(turmas.map(t => String(t.ano)))].sort().reverse()
  }, [turmas])

  const turmasList = useMemo(() => turmas.map(t => t.nome).sort(), [turmas])
  
  const disciplinasList = useMemo(() => {
    const s = new Set<string>()
    frequencias.forEach((f: any) => { if (f.disciplina) s.add(f.disciplina) })
    return Array.from(s).sort()
  }, [frequencias])

  const alunosHabilitados = useMemo(() => {
    return alunos.filter(a => {
      if (filtroTurma !== 'Todas') {
         const tA = String(a.turma || '').trim().toLowerCase()
         const tF = String(filtroTurma).trim().toLowerCase()
         if (tA !== tF) return false
      }
      const st = a.status || a.statusMatricula || 'matriculado'
      if (filtroSituacao !== 'Todos' && st !== filtroSituacao) return false
      return true
    }).sort((a,b) => a.nome.localeCompare(b.nome))
  }, [alunos, filtroTurma, filtroSituacao])

  // Motor de Dados Principal
  const dataEngine = useMemo(() => {
    const freqNoPeriodo = frequencias.filter((f: any) => {
      if (dataInicial && f.data && new Date(f.data) < new Date(dataInicial + 'T00:00:00')) return false
      if (dataFinal && f.data && new Date(f.data) > new Date(dataFinal + 'T23:59:59')) return false
      if (filtroDisciplina !== 'Todas' && f.disciplina !== filtroDisciplina) return false
      
      const tId = turmas.find(t => String(t.nome || '').trim().toLowerCase() === String(filtroTurma).trim().toLowerCase())?.id
      if (filtroTurma !== 'Todas' && f.turmaId !== tId) return false
      
      return true
    })

    const alunoStats = new Map()

    alunosHabilitados.forEach(a => {
      if (filtroAluno !== 'Todos' && a.id !== filtroAluno) return
      alunoStats.set(a.id, {
        id: a.id,
        nome: a.nome,
        turma: a.turma,
        situacao: a.status || a.statusMatricula || 'matriculado',
        P: 0, F: 0, J: 0, A: 0,
        totalAulas: 0,
        freqPercent: 0
      })
    })

    freqNoPeriodo.forEach((f: any) => {
      f.registros.forEach((reg: any) => {
        const al = alunoStats.get(reg.alunoId)
        if (al) {
          al.totalAulas++
          if (reg.status === 'P') al.P++
          else if (reg.status === 'F') al.F++
          else if (reg.status === 'J') al.J++
          else if (reg.status === 'A') al.A++
          else al.P++
        }
      })
    })

    let listagem = Array.from(alunoStats.values())

    listagem.forEach(a => {
      const pres = a.P + a.J
      a.freqPercent = a.totalAulas > 0 ? Math.round((pres / a.totalAulas) * 100) : 100
    })

    if (ordenacao === 'freq-asc') listagem.sort((a,b) => a.freqPercent - b.freqPercent)
    else if (ordenacao === 'freq-desc') listagem.sort((a,b) => b.freqPercent - a.freqPercent)
    else if (ordenacao === 'faltas-desc') listagem.sort((a,b) => (b.F + b.A) - (a.F + a.A))
    else if (ordenacao === 'nome-asc') listagem.sort((a,b) => a.nome.localeCompare(b.nome))

    let totalFaltas = 0
    let totalJustificadas = 0
    let absenteistas = 0

    listagem.forEach(a => {
      totalFaltas += a.F
      totalJustificadas += a.J + a.A
      if (a.freqPercent < freqMinima) absenteistas++
    })

    return {
      totalAnalisados: listagem.length,
      absenteistas,
      totalFaltas,
      totalJustificadas,
      listagem
    }

  }, [frequencias, alunosHabilitados, turmas, dataInicial, dataFinal, filtroTurma, filtroDisciplina, filtroAluno, ordenacao, freqMinima])

  // --- PDF / Print ---
  const handleImprimirRelatorio = () => {
    const rowsHtml = dataEngine.listagem.map((a: any) => {
      const cls = a.freqPercent < freqMinima ? 'r-critica' : ''
      return `
        <tr class="${cls}">
          <td>${a.nome}</td>
          <td>${a.turma}</td>
          <td style="text-transform:capitalize">${a.situacao}</td>
          <td>${a.totalAulas}</td>
          <td>${a.P}</td>
          <td>${a.J + a.A}</td>
          <td>${a.F}</td>
          <td>${a.freqPercent}%</td>
        </tr>`
    }).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Relação de Alunos Faltosos</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #111827; background: #fff; }
            h1 { font-size: 24px; color: #111827; margin-bottom: 5px; }
            .header-info { font-size: 13px; color: #6b7280; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
            .kpi-row { display: flex; gap: 20px; margin-bottom: 30px; }
            .kpi { flex: 1; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; text-align: center; }
            .kpi-title { font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
            .kpi-value { font-size: 24px; font-weight: bold; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: bold; text-transform: uppercase; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; color: #374151; }
            .r-critica { color: #dc2626; font-weight: bold; background: #fef2f2; }
          </style>
        </head>
        <body>
          <h1>Relação de Alunos Faltosos (Absenteísmo)</h1>
          <div class="header-info">
            Filtros Aplicados: <br/>
            <strong>Período:</strong> ${dataInicial ? new Date(dataInicial + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início'} até ${dataFinal ? new Date(dataFinal + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'} | 
            <strong>Turma:</strong> ${filtroTurma} | 
            <strong>Disciplina:</strong> ${filtroDisciplina} | 
            <strong>Situação:</strong> ${filtroSituacao} |
            <strong>Aluno:</strong> ${filtroAluno === 'Todos' ? 'Todos' : alunos.find(a => a.id === filtroAluno)?.nome || 'Específico'}
          </div>
          
          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi-title">Alunos Analisados</div>
              <div class="kpi-value">${dataEngine.totalAnalisados}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Faltas Líquidas (F)</div>
              <div class="kpi-value" style="color: #ef4444">${dataEngine.totalFaltas}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Alunos Críticos (< ${freqMinima}%)</div>
              <div class="kpi-value" style="color: #dc2626">${dataEngine.absenteistas}</div>
            </div>
          </div>

          <h2>Detalhamento por Aluno</h2>
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th>Situação</th>
                <th>Aulas Total</th>
                <th>Presenças (P)</th>
                <th>Justificadas (J/A)</th>
                <th>Faltas (F)</th>
                <th>Frequência Real</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── MODAIS SOBREPOSTOS ── */}
      <AnimatePresence>
        
        {/* MODAL TURMA */}
        {modalTurmaOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <motion.div initial={{ scale: 0.95, y:20 }} animate={{ scale: 1, y:0 }} exit={{ scale:0.95, y:20 }} style={{ background:'hsl(var(--bg-elevated))', width:'100%', maxWidth:500, borderRadius:24, boxShadow:'0 24px 48px rgba(0,0,0,0.2)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
              
              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:'rgba(245,158,11,0.1)',color:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center' }}><Layers size={18}/></div>
                  <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Buscar Turma</h2>
                </div>
                <button onClick={() => setModalTurmaOpen(false)} style={{ background:'transparent', border:'none', color:'hsl(var(--text-muted))', cursor:'pointer', padding:4 }}><X size={20}/></button>
              </div>

              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))' }}>
                <label style={{ fontSize:11, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:8, display:'block' }}>1. Selecione o Ano Letivo</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {anosDisponiveis.length === 0 ? <span style={{fontSize:13, color:'hsl(var(--text-muted))'}}>Nenhum ano cadastrado.</span> : null}
                  {anosDisponiveis.map(ano => (
                    <button key={ano} onClick={() => setModalAnoSel(ano)} style={{ padding:'8px 16px', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', border: modalAnoSel === ano ? '2px solid #f59e0b' : '1px solid hsl(var(--border-subtle))', background: modalAnoSel === ano ? 'rgba(245,158,11,0.1)' : 'hsl(var(--bg-elevated))', color: modalAnoSel === ano ? '#f59e0b' : 'hsl(var(--text-primary))', transition:'all 0.2s' }}>
                      {ano}
                    </button>
                  ))}
                  {/* Opção para forçar ignorar o ano se tivermos de ver turmas de todos anos (fallback) */}
                  <button onClick={() => setModalAnoSel('')} style={{ padding:'8px 16px', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', border: modalAnoSel === '' ? '2px solid #3b82f6' : '1px solid hsl(var(--border-subtle))', background: modalAnoSel === '' ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-elevated))', color: modalAnoSel === '' ? '#3b82f6' : 'hsl(var(--text-primary))', transition:'all 0.2s' }}>Todos</button>
                </div>
              </div>

              <div style={{ padding:'12px 16px', overflowY:'auto', flex:1 }}>
                <label style={{ fontSize:11, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:12, display:'block', marginLeft:8 }}>2. Escolha a Turma</label>
                
                <button 
                  onClick={() => { setFiltroTurma('Todas'); setFiltroAluno('Todos'); setModalTurmaOpen(false) }}
                  style={{ width:'100%', padding:'14px 16px', background:filtroTurma==='Todas'?'rgba(245,158,11,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', fontWeight:filtroTurma==='Todas'?800:600, color:filtroTurma==='Todas'?'#f59e0b':'hsl(var(--text-primary))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}
                >
                  🏫 Todas as Turmas {filtroTurma==='Todas' && <CheckCircle size={16}/>}
                </button>

                {turmas.filter(t => !modalAnoSel ? true : String(t.ano) === modalAnoSel).map(t => (
                  <button key={t.id} 
                    onClick={() => { setFiltroTurma(t.nome); setFiltroAluno('Todos'); setModalTurmaOpen(false) }}
                    style={{ width:'100%', padding:'14px 16px', background:filtroTurma===t.nome?'rgba(245,158,11,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}
                  >
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:filtroTurma===t.nome?'#f59e0b':'hsl(var(--text-primary))' }}>{t.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>{t.serie} • {t.turno} • {String(t.ano)}</div>
                    </div>
                    {filtroTurma===t.nome && <CheckCircle size={18} color="#f59e0b"/>}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL BUSCA ALUNO */}
        {modalAlunoOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <motion.div initial={{ scale: 0.95, y:20 }} animate={{ scale: 1, y:0 }} exit={{ scale:0.95, y:20 }} style={{ background:'hsl(var(--bg-elevated))', width:'100%', maxWidth:540, borderRadius:24, boxShadow:'0 24px 48px rgba(0,0,0,0.2)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
              
              <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:'rgba(59,130,246,0.1)',color:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center' }}><Search size={18}/></div>
                  <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Buscar Aluno Específico</h2>
                </div>
                <button onClick={() => setModalAlunoOpen(false)} style={{ background:'transparent', border:'none', color:'hsl(var(--text-muted))', cursor:'pointer', padding:4 }}><X size={20}/></button>
              </div>

              <div style={{ padding:'16px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))' }}>
                <div style={{ position:'relative' }}>
                  <Search size={18} color="hsl(var(--text-muted))" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input autoFocus type="text" className="form-input" placeholder="Digite o nome do aluno..." value={modalBuscaAluno} onChange={e => setModalBuscaAluno(e.target.value)} style={{ width:'100%', paddingLeft:42, height:48, fontSize:15, borderRadius:12, fontWeight:600 }} />
                </div>
              </div>

              <div style={{ padding:'12px', overflowY:'auto', flex:1 }}>
                
                <button 
                  onClick={() => { setFiltroAluno('Todos'); setModalAlunoOpen(false) }}
                  style={{ width:'100%', padding:'14px 16px', background:filtroAluno==='Todos'?'rgba(59,130,246,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', fontWeight:filtroAluno==='Todos'?800:600, color:filtroAluno==='Todos'?'#3b82f6':'hsl(var(--text-primary))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:8 }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36,height:36,borderRadius:10,background:'hsl(var(--bg-overlay))',display:'flex',alignItems:'center',justifyContent:'center' }}><Users size={16}/></div>
                    Ver Todos os Alunos no Relatório
                  </div>
                  {filtroAluno==='Todos' && <CheckCircle size={18} color="#3b82f6"/>}
                </button>

                {modalBuscaAluno.trim().length >= 3 && alunosHabilitados.filter(a => a.nome.toLowerCase().includes(modalBuscaAluno.trim().toLowerCase())).slice(0, 50).map(a => (
                  <button key={a.id} 
                    onClick={() => { setFiltroAluno(a.id); setModalAlunoOpen(false) }}
                    style={{ width:'100%', padding:'10px 14px', background:filtroAluno===a.id?'rgba(59,130,246,0.08)':'transparent', border:'none', borderRadius:12, textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => { if(filtroAluno!==a.id) e.currentTarget.style.background='hsl(var(--bg-overlay))' }}
                    onMouseLeave={e => { if(filtroAluno!==a.id) e.currentTarget.style.background='transparent' }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:'rgba(59,130,246,0.1)',color:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11 }}>
                        {getInitials(a.nome)}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:filtroAluno===a.id?'#3b82f6':'hsl(var(--text-primary))' }}>{a.nome}</div>
                        <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>Turma: {a.turma} • Status: {a.status||a.statusMatricula||'matriculado'}</div>
                      </div>
                    </div>
                    {filtroAluno===a.id && <CheckCircle size={18} color="#3b82f6"/>}
                  </button>
                ))}
                
                {modalBuscaAluno.trim().length < 3 && (
                  <div style={{ padding:40, textAlign:'center', color:'hsl(var(--text-muted))' }}>
                     <Search size={30} style={{ margin:'0 auto 10px', opacity:0.3 }} />
                     Digite pelo menos 3 letras para buscar um aluno.
                  </div>
                )}

                {modalBuscaAluno.trim().length >= 3 && alunosHabilitados.filter(a => a.nome.toLowerCase().includes(modalBuscaAluno.trim().toLowerCase())).length === 0 && (
                  <div style={{ padding:40, textAlign:'center', color:'hsl(var(--text-muted))' }}>
                     <Users size={30} style={{ margin:'0 auto 10px', opacity:0.3 }} />
                     Nenhum aluno encontrado para essa busca.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HEADER COM GRADIENTE SUAVE ─── */}
      <div style={{ padding: '32px 32px 16px', background: 'var(--gradient-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `linear-gradient(135deg, #f59e0b, #f59e0b80)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 24px #f59e0b40`,
            color: '#fff'
          }}>
            <UserMinus size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-base))', margin: 0 }}>
              Relação de Alunos Faltosos
            </h1>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
              Indicadores de absenteísmo, risco de evasão e relatórios nominais consolidados. Frequência mínima alvo: {freqMinima}%.
            </p>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <button onClick={handleImprimirRelatorio} className="btn-elevated" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              borderRadius: 12, background: 'hsl(var(--text-base))', color: 'hsl(var(--bg-main))',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
            }}>
              <Printer size={16} /> Emitir Relatório
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ─── FILTROS GLOBAIS (MODAIS INTEGRADOS) ─── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'hsl(var(--bg-elevated))', padding: '16px 20px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-muted))', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', marginRight: 8 }}>
            <Filter size={15} /> Parametrização Pedagógica
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Data Inicial</label>
             <div style={{ position: 'relative' }}>
               <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
               <input type="date" className="form-input" value={dataInicial} onChange={e => setDataInicial(e.target.value)} style={{ fontWeight: 600, paddingLeft: 30, width: '100%', fontSize: 12 }} />
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Data Final</label>
             <div style={{ position: 'relative' }}>
               <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
               <input type="date" className="form-input" value={dataFinal} onChange={e => setDataFinal(e.target.value)} style={{ fontWeight: 600, paddingLeft: 30, width: '100%', fontSize: 12 }} />
             </div>
          </div>

          {/* TURMA VIA MODAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Turma (Com Ano Letivo)</label>
             <button 
                onClick={() => setModalTurmaOpen(true)}
                className="form-input" 
                style={{ fontWeight: filtroTurma!=='Todas'?800:600, color:filtroTurma!=='Todas'?'#f59e0b':'inherit', textAlign:'left', background:'hsl(var(--bg-overlay))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
              >
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {filtroTurma === 'Todas' ? 'Todas as Turmas' : filtroTurma}
                </span>
                <ChevronRight size={14} />
             </button>
          </div>

          {/* ALUNO VIA MODAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1.5 1 180px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Aluno Específico</label>
             <button 
                onClick={() => { setModalBuscaAluno(''); setModalAlunoOpen(true) }}
                className="form-input" 
                style={{ fontWeight: filtroAluno!=='Todos'?800:600, color:filtroAluno!=='Todos'?'#3b82f6':'inherit', textAlign:'left', background:'hsl(var(--bg-overlay))', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
              >
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {filtroAluno === 'Todos' ? 'Nenhum / Lista Completa' : alunos.find(a=>a.id===filtroAluno)?.nome || 'Selecionado...'}
                </span>
                <Search size={14} />
             </button>
          </div>

          <div style={{ width: 1, height: 32, background: 'hsl(var(--border-subtle))', margin: '0 4px' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Disciplina</label>
             <select className="form-input" value={filtroDisciplina} onChange={e => setFiltroDisciplina(e.target.value)} style={{ fontWeight: 600 }}>
                <option value="Todas">Todas / Geral</option>
                {disciplinasList.map(d => <option key={d} value={d}>{d}</option>)}
             </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
             <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Situação de Matrícula</label>
             <select className="form-input" value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} style={{ fontWeight: 600, color: filtroSituacao === 'matriculado' ? '#10b981' : 'inherit' }}>
                <option value="Todos">Todas as Matrículas</option>
                <option value="matriculado">Apenas Cursando Ativos</option>
             </select>
          </div>

        </div>

        {/* ─── KPIs ─── */}
        <AnimatePresence mode="popLayout">
          <motion.div key="kpis-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {/* KPI 1 */}
            <div style={{ background: 'hsl(var(--bg-elevated))', padding: 20, borderRadius: 16, border: `1px solid hsl(var(--border-subtle))`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Alunos Analisados</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-base))', fontFamily: 'Outfit, sans-serif' }}>
                 {dataEngine.totalAnalisados}
              </div>
            </div>

            {/* KPI 2 */}
            <div style={{ background: 'hsl(var(--bg-elevated))', padding: 20, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldAlert size={16} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Faltas (F) Somadas</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>
                {dataEngine.totalFaltas}
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>+{dataEngine.totalJustificadas} Justificadas/Atestadas</div>
            </div>

            {/* KPI 3 */}
            <div style={{ background: 'hsl(var(--bg-elevated))', padding: 20, borderRadius: 16, border: `1px solid ${dataEngine.absenteistas > 0 ? 'rgba(220,38,38,0.3)' : 'hsl(var(--border-subtle))'}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={16} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Alunos Críticos (&lt;{freqMinima}%)</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', fontFamily: 'Outfit, sans-serif' }}>
                 {dataEngine.absenteistas}
              </div>
              {dataEngine.absenteistas > 0 && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>Risco de evasão/reprovação!</div>}
            </div>
          </motion.div>

          <motion.div key="table-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <BookOpen size={18} color="#f59e0b" /> Extrato Nominal de Frequências ({dataEngine.listagem.length})
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Ordenar por:</span>
                <select className="form-input" style={{ fontSize: 12, padding: '6px 30px 6px 12px', minHeight: 32 }} value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}>
                  <option value="freq-asc">Frequência (+ Baixa primeiro)</option>
                  <option value="faltas-desc">Total Faltas (+ Faltas primeiro)</option>
                  <option value="freq-desc">Frequência (+ Alta primeiro)</option>
                  <option value="nome-asc">Ordem Alfabética</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ overflowX: 'auto', maxHeight: 600 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))', position: 'sticky', top: 0, zIndex: 5 }}>
                    <tr>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Aluno</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'center' }}>Total Aulas</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'center' }}>Presenças (P)</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'center' }}>Just./Ates. (J/A)</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'center' }}>Faltas Lqd (F)</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'right' }}>% Freq. Real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataEngine.listagem.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Nenhum aluno com aulas nesse recorte analítico.</td></tr>
                    ) : dataEngine.listagem.map((al: any) => {
                      const bad = al.freqPercent < freqMinima
                      return (
                      <tr key={al.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: bad ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                        <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{al.nome}</div>
                                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, textTransform:'capitalize' }}>Turma: {al.turma} • {al.situacao}</div>
                            </div>
                            {bad && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 800 }}>⛔ CRÍTICO</span>}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                          {al.totalAulas}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: '#10b981' }}>
                          {al.P}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: '#f59e0b' }}>
                          {al.J + al.A}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#ef4444' }}>
                          {al.F}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: bad ? '#ef4444' : '#10b981', fontFamily: 'Outfit, sans-serif' }}>
                            {al.freqPercent}%
                          </span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
