'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { ConfirmModal, EmptyState } from '@/components/ui/CrudModal'
import CadastroAlunoModal from '@/components/alunos/CadastroAlunoModal'
import {
  Search, UserPlus, Download, Trash2, Pencil, Eye,
  ClipboardList, Users, AlertTriangle, TrendingDown,
  CircleDollarSign, GraduationCap, X, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const riskColor = (r: string) =>
  r === 'alto' ? '#ef4444' : r === 'medio' ? '#f59e0b' : '#10b981'

// Extracts financial and pedagogical responsibles from any Aluno data shape
function getResp(a: any): { fin: string; ped: string } {
  // Priority 1: dedicated flat fields (added by our latest fixes)
  if (a.responsavelFinanceiro || a.responsavelPedagogico) {
    return { fin: a.responsavelFinanceiro || '', ped: a.responsavelPedagogico || '' }
  }
  // Priority 2: _responsaveis array (CadastroAlunoModal)
  const arr1: any[] = a._responsaveis || []
  if (arr1.length > 0) {
    const fin1 = arr1.find((r: any) => r.respFinanceiro)
    const ped1 = arr1.find((r: any) => r.respPedagogico)
    if (fin1 || ped1) return { fin: fin1?.nome || '', ped: ped1?.nome || '' }
  }
  // Priority 3: responsaveis array (TestDataSection legacy path)
  const arr2: any[] = a.responsaveis || []
  if (arr2.length > 0) {
    const fin2 = arr2.find((r: any) => r.respFinanceiro)
    const ped2 = arr2.find((r: any) => r.respPedagogico)
    if (fin2 || ped2) return { fin: fin2?.nome || '', ped: ped2?.nome || '' }
  }
  // Priority 4: single legacy field — show as generic responsible
  return { fin: '', ped: '' }
}

export default function AlunosPage() {
  const router = useRouter()
  const { alunos, setAlunos, logSystemAction } = useData()
  const isLoading = false
  const [search, setSearch]         = useState('')
  const [filterSerie, setFilterSerie]   = useState('Todos')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [showCadastro, setShowCadastro] = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [confirmId, setConfirmId]   = useState<string | null>(null)
  const [mounted, setMounted]       = useState(false)
  const [activeKpi, setActiveKpi]   = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  // CSS animation
  useEffect(() => {
    const id = 'kpi-panel-style'
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = `
      @keyframes kpi-slide-in { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      .kpi-panel { animation: kpi-slide-in 0.22s ease; }
    `
    document.head.appendChild(st)
  }, [])

  const hasSearch = search.trim().length >= 3

  const displayed = alunos.filter(a => {
    const q = search.toLowerCase()
    const matchCod = ((a as any).codigo || a.matricula || a.id).toLowerCase()
    return (
      (a.nome.toLowerCase().includes(q) || matchCod.includes(q) || a.turma.toLowerCase().includes(q)) &&
      (filterSerie === 'Todos' || a.serie === filterSerie) &&
      (filterStatus === 'Todos' || a.status === filterStatus)
    )
  })

  const handleDelete = () => {
    if (confirmId) {
      const alunoDel = alunos.find((a: any) => a.id === confirmId)
      setAlunos((prev: any[]) => prev.filter((a: any) => a.id !== confirmId))
      logSystemAction('Acadêmico (Alunos)', 'Exclusão', `Exclusão permanente do aluno/matrícula`, { registroId: (alunoDel as any)?.codigo || alunoDel?.id, nomeRelacionado: alunoDel?.nome })
    }
    setConfirmId(null)
  }

  // ── KPI data ───────────────────────────────────────────────────────────────
  const total    = mounted ? alunos.length : 0
  const matric   = mounted ? alunos.filter(a => a.status === 'matriculado').length : 0
  const riskAlto = mounted ? alunos.filter(a => a.risco_evasao === 'alto').length : 0
  const inadimpl = mounted ? alunos.filter(a => a.inadimplente).length : 0
  const freqCrit = mounted ? alunos.filter(a => a.frequencia < 75).length : 0
  const riskMed  = mounted ? alunos.filter(a => a.risco_evasao === 'medio').length : 0
  const segmentos = mounted ? [...new Set(alunos.map(a => a.serie).filter(Boolean))].length : 0

  const KPI_FILTERS: Record<string, (a: typeof alunos[0]) => boolean> = {
    total:    () => true,
    evasao:   a => a.risco_evasao === 'alto',
    inadimpl: a => a.inadimplente,
    freq:     a => a.frequencia < 75,
    segmentos: () => true,
  }

  const KPIS = [
    { id:'total',    label:'Total de Alunos',     value: total,    sub: `${matric} matriculados`,                                        color:'#6366f1', bg:'rgba(99,102,241,0.08)',  border:'rgba(99,102,241,0.2)',  Icon:Users,           trend:null,                          clickable:true },
    { id:'evasao',   label:'Risco de Evasão',     value: riskAlto, sub: `${riskMed} risco médio`,                                        color:'#ef4444', bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.2)',   Icon:AlertTriangle,   trend:riskAlto>0?'danger':'ok',    clickable:riskAlto>0 },
    { id:'inadimpl', label:'Inadimplentes',        value: inadimpl, sub: total ? `${((inadimpl/total)*100).toFixed(1)}% do total` : '—', color:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', Icon:CircleDollarSign, trend:inadimpl>0?'warn':'ok',       clickable:inadimpl>0 },
    { id:'freq',     label:'Freq. Crítica (<75%)', value: freqCrit, sub: `de ${total} alunos`,                                           color:'#8b5cf6', bg:'rgba(139,92,246,0.08)',  border:'rgba(139,92,246,0.2)',  Icon:TrendingDown,    trend:freqCrit>0?'warn':'ok',       clickable:freqCrit>0 },
    { id:'segmentos',label:'Segmentos Ativos',    value: segmentos,sub:'turmas em andamento',                                           color:'#10b981', bg:'rgba(16,185,129,0.08)',  border:'rgba(16,185,129,0.2)',  Icon:GraduationCap,   trend:null,                          clickable:segmentos>0 },
  ]

  const kpiAlunos = useMemo(() => {
    if (!activeKpi || !mounted) return []
    return alunos.filter(KPI_FILTERS[activeKpi] ?? (() => true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKpi, alunos, mounted])

  const toggleKpi = (id: string) => setActiveKpi(p => p === id ? null : id)

  const activeKpiData = KPIS.find(k => k.id === activeKpi)

  // ── Mini row for KPI panel ─────────────────────────────────────────────────
  const MiniAlunoRow = ({ a }: { a: typeof alunos[0] }) => {
    const rc = riskColor(a.risco_evasao)
    const { fin, ped } = getResp(a)
    return (
      <tr style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
        <td>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="avatar" style={{ width:32, height:32, fontSize:11, background:`${rc}22`, color:rc, borderRadius:9, border:`2px solid ${rc}40`, flexShrink:0 }}>
              {getInitials(a.nome)}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>{a.nome}</div>
              {(fin || ped) ? (
                <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2 }}>
                  {fin && (
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:3 }}>
                      <span style={{ color:'#f59e0b', fontWeight:700, fontSize:9 }}>FIN</span>{fin}
                    </div>
                  )}
                  {ped && (
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:3 }}>
                      <span style={{ color:'#6366f1', fontWeight:700, fontSize:9 }}>PED</span>{ped}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{a.responsavel || '—'}</div>
              )}
            </div>
          </div>
        </td>
        <td><code style={{ fontSize:11, background:'hsl(var(--bg-overlay))', padding:'2px 6px', borderRadius:4 }}>{(a as any).codigo || a.matricula || a.id}</code></td>
        <td><span className="badge badge-neutral" style={{ fontSize:10 }}>{a.turma || '—'}</span></td>
        <td style={{ fontSize:12 }}>{a.serie || '—'}</td>
        <td>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div className="progress-bar" style={{ width:44 }}>
              <div className="progress-fill" style={{ width:`${a.frequencia}%`, background:a.frequencia<65?'#ef4444':a.frequencia<80?'#f59e0b':'#10b981' }}/>
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:a.frequencia<65?'#f87171':a.frequencia<80?'#fbbf24':'#34d399' }}>{a.frequencia}%</span>
          </div>
        </td>
        <td>{a.inadimplente ? <span className="badge badge-danger" style={{ fontSize:10 }}>Inadimplente</span> : <span className="badge badge-success" style={{ fontSize:10 }}>Regular</span>}</td>
        <td><span className={`badge ${a.risco_evasao==='alto'?'badge-danger':a.risco_evasao==='medio'?'badge-warning':'badge-success'}`} style={{ fontSize:10 }}>{a.risco_evasao==='alto'?'🔴 Alto':a.risco_evasao==='medio'?'🟡 Médio':'🟢 Baixo'}</span></td>
        <td>
          <div style={{ display:'flex', gap:3 }}>
            <Link href={`/academico/alunos/ficha?id=${a.id}`}><button className="btn btn-ghost btn-icon btn-sm" title="Ver ficha"><Eye size={11}/></button></Link>
            <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => router.push(`/academico/alunos/nova-matricula?edit=${a.id}`)}><Pencil size={11}/></button>
            <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" style={{ color:'#f87171' }} onClick={() => setConfirmId(a.id)}><Trash2 size={11}/></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom:28 }}>
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="page-subtitle" suppressHydrationWarning>
            {mounted ? alunos.length : '—'} alunos cadastrados · Gestão acadêmica completa
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13}/> Exportar</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(null); setShowCadastro(true) }}>
            <UserPlus size={13}/> Cadastro Rápido
          </button>
          <button className="btn btn-primary btn-sm"
            style={{ background:'linear-gradient(135deg,#6366f1,#3b82f6)' }}
            onClick={() => router.push('/academico/alunos/nova-matricula')}>
            <ClipboardList size={13}/> Nova Matrícula
          </button>
        </div>
      </div>

      {/* ══ KPI Cards — Interativos ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom: activeKpi ? 0 : 24 }}>
        {KPIS.map(k => {
          const isActive = activeKpi === k.id
          return (
            <div key={k.id}
              onClick={() => k.clickable && toggleKpi(k.id)}
              style={{
                background: isActive ? k.bg.replace('0.08','0.16') : k.bg,
                border:`2px solid ${isActive ? k.color : k.border}`,
                borderRadius:16, padding:'18px 20px',
                display:'flex', flexDirection:'column', gap:10,
                cursor: k.clickable ? 'pointer' : 'default',
                boxShadow: isActive ? `0 6px 24px ${k.color}30` : 'none',
                transition:'all 0.18s',
                position:'relative',
              }}
              onMouseEnter={e => { if (!isActive && k.clickable) { const el = e.currentTarget as HTMLDivElement; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 8px 24px ${k.color}22` }}}
              onMouseLeave={e => { if (!isActive) { const el = e.currentTarget as HTMLDivElement; el.style.transform='translateY(0)'; el.style.boxShadow=isActive?`0 6px 24px ${k.color}30`:'none' }}}
            >
              {isActive && (
                <div style={{ position:'absolute', top:10, right:10, width:20, height:20, borderRadius:'50%', background:k.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ChevronDown size={11} color="#fff"/>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:`${k.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <k.Icon size={20} color={k.color}/>
                </div>
                {k.trend === 'danger' && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontWeight:700 }}>⚠ Atenção</span>}
                {k.trend === 'warn'   && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:700 }}>⚠ Atenção</span>}
                {k.trend === 'ok'     && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.12)', color:'#10b981', fontWeight:700 }}>✓ OK</span>}
              </div>
              <div>
                <div style={{ fontSize:32, fontWeight:900, color:k.color, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{mounted ? k.value : '—'}</div>
                <div style={{ fontWeight:700, fontSize:12, marginTop:4 }}>{k.label}</div>
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>{k.sub}</div>
              </div>
              {k.clickable && (
                <div style={{ fontSize:10, color: isActive ? k.color : 'hsl(var(--text-muted))', fontWeight:600 }}>
                  {isActive ? '▲ Fechar lista' : '▼ Ver alunos'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── KPI Panel ─────────────────────────────────────────────────────────── */}
      {activeKpi && activeKpiData && mounted && (
        <div className="kpi-panel" style={{ marginBottom:24, borderRadius:16, border:`2px solid ${activeKpiData.color}40`, overflow:'hidden', background:'hsl(var(--bg-elevated))' }}>
          <div style={{ padding:'14px 20px', background:activeKpiData.bg, borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:`${activeKpiData.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <activeKpiData.Icon size={15} color={activeKpiData.color}/>
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{activeKpiData.label}</div>
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>
                  {activeKpi === 'segmentos'
                    ? [...new Set(alunos.map(a=>a.serie).filter(Boolean))].join(', ')
                    : `${kpiAlunos.length} aluno${kpiAlunos.length!==1?'s':''} neste filtro`}
                </div>
              </div>
            </div>
            <button onClick={() => setActiveKpi(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
              <X size={15}/> Fechar
            </button>
          </div>

          {activeKpi === 'segmentos' ? (
            <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
              {[...new Set(alunos.map(a=>a.serie).filter(Boolean))].map(serie => {
                const cnt = alunos.filter(a => a.serie === serie).length
                return (
                  <div key={serie} style={{ padding:'12px 16px', borderRadius:12, background:'hsl(var(--bg-base))', border:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{serie}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{cnt} aluno{cnt!==1?'s':''}</div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#10b981', fontFamily:'Outfit,sans-serif' }}>{cnt}</div>
                  </div>
                )
              })}
            </div>
          ) : kpiAlunos.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
              <div style={{ fontWeight:600 }}>Nenhum aluno nesta categoria</div>
            </div>
          ) : (
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                    {['Aluno','Código','Turma','Série','Frequência','Financeiro','Risco IA','Ações'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpiAlunos.map(a => <MiniAlunoRow key={a.id} a={a}/>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Hero Search ── */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        padding:'32px 24px', marginBottom:24,
        background:'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(16,185,129,0.03))',
        border:'1px solid hsl(var(--border-subtle))', borderRadius:20,
      }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>🔍 Buscar Aluno</div>
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            Digite o nome, nº de matrícula ou turma para localizar o aluno
          </div>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:560 }}>
          <Search size={18} style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input
            ref={searchRef}
            className="form-input"
            style={{ paddingLeft:48, paddingRight:search?44:16, fontSize:15, height:52, borderRadius:14, boxShadow:hasSearch?'0 0 0 3px rgba(99,102,241,0.15)':'none' }}
            placeholder="Ex: João Pedro, 20260001, 7º Ano A..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))', display:'flex' }}>
              <X size={16}/>
            </button>
          )}
        </div>

        {hasSearch && (
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
            <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filterSerie} onChange={e => setFilterSerie(e.target.value)}>
              <option value="Todos">Todos os segmentos</option>
              {[...new Set(alunos.map(a=>a.serie).filter(Boolean))].map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {['Todos','matriculado','em_cadastro','transferido','inativo'].map(s => (
                <option key={s} value={s}>{s==='Todos'?'Todos':s==='matriculado'?'Matriculado':s==='em_cadastro'?'Em Cadastro':s==='transferido'?'Transferido':'Inativo'}</option>
              ))}
            </select>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{displayed.length} resultado{displayed.length!==1?'s':''}</span>
          </div>
        )}

        {!hasSearch && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {['Matriculado','Inadimplente','Risco Alto'].map(tag => (
              <span key={tag}
                style={{ fontSize:11, padding:'4px 12px', borderRadius:20, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', color:'hsl(var(--text-muted))', cursor:'pointer' }}
                onClick={() => { setFilterStatus(tag.toLowerCase()); setSearch(tag==='Inadimplente'||tag==='Risco Alto'?' ':''); searchRef.current?.focus() }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div suppressHydrationWarning>
        {!mounted ? null : isLoading ? (
          <div style={{ textAlign:'center', padding:'48px 24px', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando dados dos alunos...</div>
          </div>
        ) : alunos.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="Nenhum aluno cadastrado"
            description="Cadastre o primeiro aluno clicando em Nova Matrícula."
            action={<button className="btn btn-primary" onClick={() => router.push('/academico/alunos/nova-matricula')}><UserPlus size={14}/> Cadastrar Primeiro Aluno</button>}
          />
        ) : !hasSearch ? (
          <div style={{ textAlign:'center', padding:'48px 24px', color:'hsl(var(--text-muted))' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Digite para buscar um aluno</div>
            <div style={{ fontSize:12 }}>Use o campo acima para localizar pelo nome, nº de matrícula ou turma</div>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', color:'hsl(var(--text-muted))' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🕵️</div>
            <div style={{ fontWeight:600 }}>Nenhum aluno encontrado</div>
            <div style={{ fontSize:12, marginTop:4 }}>Tente buscar por outro nome, matrícula ou turma</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th><th>Código</th><th>Turma</th><th>Segmento</th><th>Turno</th><th>Frequência</th><th>Financeiro</th><th>Risco IA</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(aluno => {
                  const rc = riskColor(aluno.risco_evasao)
                  const { fin, ped } = getResp(aluno)
                  return (
                    <tr key={aluno.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {aluno.foto ? (
                            <div style={{ width:36,height:36,borderRadius:10,overflow:'hidden',border:`2px solid ${rc}40`,flexShrink:0 }}>
                              <img src={aluno.foto} alt={aluno.nome} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                            </div>
                          ) : (
                            <div className="avatar" style={{ width:36,height:36,fontSize:12, background:`${rc}22`,color:rc, borderRadius:10,border:`2px solid ${rc}40`,flexShrink:0 }}>
                              {getInitials(aluno.nome)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize:13, fontWeight:700 }}>{aluno.nome}</div>
                            {(fin || ped) ? (
                              <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:2 }}>
                                {fin && (
                                  <div style={{ fontSize:10, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:4 }}>
                                    <span style={{
                                      fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:4,
                                      background:'rgba(245,158,11,0.12)', color:'#f59e0b',
                                    }}>FIN</span>
                                    {fin}
                                  </div>
                                )}
                                {ped && (
                                  <div style={{ fontSize:10, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:4 }}>
                                    <span style={{
                                      fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:4,
                                      background:'rgba(99,102,241,0.12)', color:'#6366f1',
                                    }}>PED</span>
                                    {ped}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{aluno.responsavel || '—'}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><code style={{ fontSize:11, background:'hsl(var(--bg-overlay))', padding:'2px 6px', borderRadius:4 }}>{(aluno as any).codigo || aluno.matricula || aluno.id}</code></td>
                      <td><span className="badge badge-neutral">{aluno.turma || '—'}</span></td>
                      <td><span className="badge badge-primary">{aluno.serie || '—'}</span></td>
                      <td style={{ fontSize:12 }}>{aluno.turno || '—'}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div className="progress-bar" style={{ width:50 }}>
                            <div className="progress-fill" style={{ width:`${aluno.frequencia}%`, background:aluno.frequencia<65?'#ef4444':aluno.frequencia<80?'#f59e0b':'#10b981' }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:aluno.frequencia<65?'#f87171':aluno.frequencia<80?'#fbbf24':'#34d399' }}>{aluno.frequencia}%</span>
                        </div>
                      </td>
                      <td>{aluno.inadimplente ? <span className="badge badge-danger">Inadimplente</span> : <span className="badge badge-success">Regular</span>}</td>
                      <td>
                        <span className={`badge ${aluno.risco_evasao==='alto'?'badge-danger':aluno.risco_evasao==='medio'?'badge-warning':'badge-success'}`}>
                          {aluno.risco_evasao==='alto'?'🔴 Alto':aluno.risco_evasao==='medio'?'🟡 Médio':'🟢 Baixo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <Link href={`/academico/alunos/ficha?id=${aluno.id}`}><button className="btn btn-ghost btn-icon btn-sm" title="Ver ficha 360°"><Eye size={12}/></button></Link>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => router.push(`/academico/alunos/nova-matricula?edit=${aluno.id}`)}><Pencil size={12}/></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" style={{ color:'#f87171' }} onClick={() => setConfirmId(aluno.id)}><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CadastroAlunoModal
        open={showCadastro}
        onClose={() => { setShowCadastro(false); setEditingId(null) }}
        editingId={editingId}
      />
      <ConfirmModal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        message="O aluno será removido permanentemente. Esta ação não pode ser desfeita."
      />
    </div>
  )
}
