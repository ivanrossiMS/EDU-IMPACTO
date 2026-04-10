'use client'

import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from 'react'
import { useData } from '@/lib/dataContext'
import { getInitials, formatDate } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import {
  User, DollarSign, AlertTriangle, Search,
  FileText, Brain, Star, CheckCircle, X, Activity,
  BookOpen, GraduationCap, Phone, Mail, Heart, Users,
  Clock, MapPin, Layers, Camera, Shield, Baby,
  Home, AlertCircle, Pill, Droplets, LogOut,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function calcIdade(nasc: string | undefined): string {
  if (!nasc) return '—'
  try {
    // suporta dd/mm/yyyy e yyyy-mm-dd
    const iso = nasc.includes('/') ? nasc.split('/').reverse().join('-') : nasc
    const d = new Date(iso + 'T12:00')
    if (isNaN(d.getTime())) return '—'
    const hoje = new Date()
    let anos = hoje.getFullYear() - d.getFullYear()
    const m = hoje.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--
    return anos >= 0 ? `${anos} anos` : '—'
  } catch { return '—' }
}

const R = ({ k, v, color }: { k: string; v: React.ReactNode; color?: string }) => (
  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'5px 0', borderBottom:'1px solid hsl(var(--border-subtle))', gap:8 }}>
    <span style={{ color:'hsl(var(--text-muted))', flexShrink:0 }}>{k}</span>
    <span style={{ fontWeight:700, color: color || 'hsl(var(--text-base))', textAlign:'right' }}>{v || '—'}</span>
  </div>
)

const MiniCard = ({ icon, label, value, bg, border, valueColor }: {
  icon: React.ReactNode; label: string; value: React.ReactNode
  bg: string; border: string; valueColor?: string
}) => (
  <div style={{ padding:'12px 14px', borderRadius:10, background:bg, border:`1px solid ${border}`, display:'flex', alignItems:'center', gap:10 }}>
    {icon}
    <div style={{ minWidth:0 }}>
      <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:700, letterSpacing:.5 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:13, color: valueColor || 'hsl(var(--text-base))', wordBreak:'break-word', lineHeight:1.3 }}>{value}</div>
    </div>
  </div>
)

function Ficha360Inner() {
  const { ocorrencias, lancamentosNota, titulos, alunos = [], turmas = [], setAlunos } = useData()
  
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Lê o ?id= da URL e seleciona o aluno automaticamente
  useEffect(() => {
    const idParam = searchParams?.get('id')
    if (idParam) setSelectedId(idParam)
  }, [searchParams])

  const handleFotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    const reader = new FileReader()
    reader.onload = ev => {
      setAlunos((prev: any[]) => prev.map(a => a.id === selectedId ? { ...a, foto: ev.target?.result } : a))
    }
    reader.readAsDataURL(file)
  }, [selectedId, setAlunos])

  useEffect(() => setMounted(true), [])

  const hasSearch = search.trim().length >= 3
  const filteredSearch = hasSearch
    ? alunos.filter(a =>
        a.nome?.toLowerCase().includes(search.toLowerCase()) ||
        (a.matricula || '').includes(search) ||
        (a.turma || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 10)
    : []

  const aluno = selectedId ? (alunos.find(a => String(a.id) === String(selectedId) || String((a as any).codigo) === String(selectedId) || String((a as any).matricula) === String(selectedId)) ?? null) : null

  // ── Responsáveis ──────────────────────────────────────────────────────────
  const responsaveis: any[] = useMemo(() => (aluno as any)?.responsaveis || [], [aluno])
  const respFin = responsaveis.find((r: any) => r.respFinanceiro)
  const respPed = responsaveis.find((r: any) => r.respPedagogico)

  // ── Saúde ─────────────────────────────────────────────────────────────────
  const saude: any = useMemo(() => (aluno as any)?.saude || {}, [aluno])

  // ── Turma ─────────────────────────────────────────────────────────────────
  const turmaObj = useMemo(() => {
    if (!aluno) return null
    const tid = (aluno as any).turmaId || (aluno as any).dadosMatricula?.turmaId
    return turmas.find(t => t.id === tid) ||
           turmas.find(t => t.nome === aluno.turma || (t as any).codigo === aluno.turma) || null
  }, [aluno, turmas])

  // ── Notas ─────────────────────────────────────────────────────────────────
  const notasAluno = useMemo(() => {
    if (!aluno) return []
    const mapa: Record<string, { soma: number; count: number }> = {}
    lancamentosNota.forEach(l => {
      l.notas.forEach(n => {
        if (n.alunoId !== aluno.id) return
        if (!mapa[l.disciplina]) mapa[l.disciplina] = { soma: 0, count: 0 }
        mapa[l.disciplina].soma += n.media
        mapa[l.disciplina].count += 1
      })
    })
    return Object.entries(mapa)
      .map(([disciplina, v]) => ({ disciplina, nota: v.count > 0 ? v.soma / v.count : 0 }))
      .sort((a, b) => b.nota - a.nota)
  }, [aluno, lancamentosNota])
  const mediaGeral = notasAluno.length > 0 ? notasAluno.reduce((s, n) => s + n.nota, 0) / notasAluno.length : null

  // ── Ocorrências ───────────────────────────────────────────────────────────
  const ocorrenciasAluno = useMemo(() =>
    aluno ? ocorrencias
      .filter(o => o.alunoId === aluno.id || o.alunoNome === aluno.nome)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    : [], [aluno, ocorrencias])

  // ── Financeiro ────────────────────────────────────────────────────────────
  const parcelasAluno: any[] = useMemo(() => (aluno as any)?.parcelas || [], [aluno])
  const titulos2 = useMemo(() =>
    aluno ? titulos.filter(t => t.aluno === aluno.nome || (t as any).alunoId === aluno.id) : [],
  [aluno, titulos])
  const parcelasVencidas = useMemo(() => {
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
    const vencParcelas = parcelasAluno.filter(p => {
      if (p.status === 'pago' || p.status === 'cancelado') return false
      try {
        const parts = p.vencimento.split('/')
        return new Date(+parts[2], +parts[1]-1, +parts[0], 12) < hoje
      } catch { return false }
    })
    const vencTitulos = titulos2.filter(t => {
      if (t.status === 'pago') return false
      try { return new Date((t.vencimento || '') + 'T12:00') < hoje } catch { return false }
    })
    return { parcelas: vencParcelas, titulos: vencTitulos }
  }, [parcelasAluno, titulos2])

  const riskColor = aluno ? (aluno.risco_evasao === 'alto' ? '#ef4444' : aluno.risco_evasao === 'medio' ? '#f59e0b' : '#10b981') : '#6366f1'
  const riskLabel = aluno ? (aluno.risco_evasao === 'alto' ? '⚠ Alto' : aluno.risco_evasao === 'medio' ? '⚡ Médio' : '✓ Baixo') : '—'

  return (
    <div suppressHydrationWarning>

      <div className="page-header">
        <div>
          <h1 className="page-title">Ficha 360°</h1>
          <p className="page-subtitle">Perfil completo e dados reais do sistema</p>
        </div>
        {aluno && <button className="btn btn-secondary btn-sm"><FileText size={13}/> Gerar Relatório</button>}
      </div>

      {/* ── Hero Search ── */}
      {!aluno && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'48px 24px', marginBottom:24, background:'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(16,185,129,0.03))', border:'1px solid hsl(var(--border-subtle))', borderRadius:20 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🎓</div>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:6, fontFamily:'Outfit,sans-serif' }}>Ficha 360° do Aluno</div>
            <div style={{ fontSize:13, color:'hsl(var(--text-muted))' }}>Digite o nome, nº de matrícula ou turma para localizar a ficha completa</div>
          </div>
          <div style={{ position:'relative', width:'100%', maxWidth:560 }}>
            <Search size={18} style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
            <input ref={searchRef} className="form-input" style={{ paddingLeft:48, fontSize:15, height:52, borderRadius:14 }} placeholder="Ex: João Pedro, 20260001, 7º Ano A..." value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
            {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={16}/></button>}
          </div>
          {hasSearch && (
            <div style={{ width:'100%', maxWidth:560, display:'flex', flexDirection:'column', gap:6 }}>
              {filteredSearch.length === 0
                ? <div style={{ textAlign:'center', padding:16, color:'hsl(var(--text-muted))', fontSize:13 }}><div style={{ fontSize:24, marginBottom:6 }}>🕵️</div>Nenhum aluno encontrado</div>
                : filteredSearch.map(a => {
                    const rc = a.risco_evasao === 'alto' ? '#ef4444' : a.risco_evasao === 'medio' ? '#f59e0b' : '#10b981'
                    
                    const tid = a.turmaId || a.dadosMatricula?.turmaId
                    const tObj = turmas.find((t: any) => t.id === tid) || turmas.find((t: any) => t.nome === a.turma || t.codigo === a.turma)
                    const turmaStr = tObj?.nome || a.turma || 'Turma não atribuída'
                    
                    const resps = a.responsaveis || []
                    const fin = resps.find((r: any) => r.respFinanceiro)?.nome?.split(' ')[0]
                    const ped = resps.find((r: any) => r.respPedagogico)?.nome?.split(' ')[0]
                    let respStr = 'Sem Responsável'
                    if(fin && ped && fin === ped) respStr = `Resp: ${fin} (Fin / Ped)`
                    else if(fin && ped) respStr = `Fin: ${fin} • Ped: ${ped}`
                    const hist = a.historicoMatriculas || a.historico_matriculas || (a.dadosMatricula ? [a.dadosMatricula] : [])
                    const histAtivo = hist.find((h:any) => h.situacao === 'Cursando') || hist[hist.length - 1]
                    const stUltimaMatricula = histAtivo ? (histAtivo.situacao || histAtivo.status || 'Sem status') : (a.statusMatricula || a.status || 'Não Matriculado')

                    return (
                      <button key={a.id} onClick={()=>{ setSelectedId(a.id); setSearch('') }}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, cursor:'pointer', textAlign:'left', width:'100%', background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))' }}>
                        {a.foto ? (
                          <div style={{ width:38, height:38, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:`2px solid ${rc}40` }}>
                            <img src={a.foto} alt={a.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          </div>
                        ) : (
                          <div className="avatar" style={{ width:38, height:38, fontSize:12, background:`${rc}20`, color:rc }}>{getInitials(a.nome)}</div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>{a.nome}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop: 2 }}>
                            {turmaStr} {a.ano||a.anoLetivo?`/ ${a.ano||a.anoLetivo}`:''} • {respStr}
                          </div>
                        </div>
                        <span className="badge badge-info" style={{ fontSize:10, background: '#e0f2fe', color: '#0284c7' }}>{stUltimaMatricula}</span>
                      </button>
                    )
                  })
              }
            </div>
          )}
          {mounted && !hasSearch && <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{alunos.length} aluno{alunos.length!==1?'s':''} disponível{alunos.length!==1?'is':''}</div>}
        </div>
      )}

      {/* ── Ficha completa ── */}
      {aluno && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Barra troca */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
            <Search size={14} style={{ color:'hsl(var(--text-muted))', flexShrink:0 }}/>
            <div style={{ position:'relative', flex:1, maxWidth:400 }}>
              <input ref={searchRef} className="form-input" style={{ fontSize:13, paddingRight:search?36:12 }} placeholder="Trocar aluno..." value={search} onChange={e=>setSearch(e.target.value)}/>
              {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={14}/></button>}
            </div>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Exibindo:</span>
            <div className="avatar" style={{ width:26, height:26, fontSize:9, background:`${riskColor}20`, color:riskColor, flexShrink:0 }}>{getInitials(aluno.nome)}</div>
            <span style={{ fontSize:13, fontWeight:700 }}>{aluno.nome}</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', fontSize:11 }} onClick={()=>{ setSelectedId(null); setSearch('') }}><X size={12}/> Fechar ficha</button>
          </div>

          {hasSearch && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, padding:8, background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))' }}>
              {filteredSearch.length === 0
                ? <div style={{ padding:12, textAlign:'center', fontSize:12, color:'hsl(var(--text-muted))' }}>Nenhum aluno encontrado</div>
                : filteredSearch.map(a => {
                    const rc = a.risco_evasao === 'alto' ? '#ef4444' : a.risco_evasao === 'medio' ? '#f59e0b' : '#10b981'

                    const tid = a.turmaId || a.dadosMatricula?.turmaId
                    const tObj = turmas.find((t: any) => t.id === tid) || turmas.find((t: any) => t.nome === a.turma || t.codigo === a.turma)
                    const turmaStr = tObj?.nome || a.turma || 'Turma não atribuída'
                    
                    const resps = a.responsaveis || []
                    const fin = resps.find((r: any) => r.respFinanceiro)?.nome?.split(' ')[0]
                    const ped = resps.find((r: any) => r.respPedagogico)?.nome?.split(' ')[0]
                    let respStr = 'Sem Responsável'
                    if(fin && ped && fin === ped) respStr = `Resp: ${fin} (Fin/Ped)`
                    else if(fin && ped) respStr = `Fin: ${fin} • Ped: ${ped}`
                    const hist = a.historicoMatriculas || a.historico_matriculas || (a.dadosMatricula ? [a.dadosMatricula] : [])
                    const histAtivo = hist.find((h:any) => h.situacao === 'Cursando') || hist[hist.length - 1]
                    const stUltimaMatricula = histAtivo ? (histAtivo.situacao || histAtivo.status || 'Sem status') : (a.statusMatricula || a.status || 'Não Matriculado')

                    return (
                      <button key={a.id} onClick={()=>{ setSelectedId(a.id); setSearch('') }}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'left', width:'100%', background:selectedId===a.id?'rgba(99,102,241,0.08)':'transparent', border:'none' }}>
                        {a.foto ? (
                          <div style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:`1px solid ${rc}40` }}>
                            <img src={a.foto} alt={a.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          </div>
                        ) : (
                          <div className="avatar" style={{ width:28, height:28, fontSize:9, background:`${rc}20`, color:rc }}>{getInitials(a.nome)}</div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{a.nome}</div>
                          <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>
                            {turmaStr} {a.ano||a.anoLetivo?`/ ${a.ano||a.anoLetivo}`:''} • {respStr}
                          </div>
                        </div>
                        <span className="badge badge-info" style={{ fontSize:9, background: '#e0f2fe', color: '#0284c7' }}>{stUltimaMatricula}</span>
                      </button>
                    )
                  })
              }
            </div>
          )}

          {/* ── Hero card ── */}
          <div className="card" style={{ padding:24, background:'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(139,92,246,0.04))' }}>
            <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                {(aluno as any).foto
                  ? <div style={{ width:80, height:80, borderRadius:16, overflow:'hidden', border:`3px solid ${riskColor}40` }}><img src={(aluno as any).foto} alt={aluno.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }}/></div>
                  : <div className="avatar" style={{ width:80, height:80, fontSize:24, background:`${riskColor}20`, color:riskColor, borderRadius:16, border:`3px solid ${riskColor}30` }}>{getInitials(aluno.nome)}</div>
                }
                <button type="button" onClick={()=>fotoInputRef.current?.click()} style={{ position:'absolute', bottom:-6, right:-6, width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#3b82f6)', border:'2px solid hsl(var(--bg-base))', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 12px rgba(99,102,241,0.4)' }}><Camera size={13} color="#fff"/></button>
                <input ref={fotoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoUpload}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'Outfit,sans-serif' }}>{aluno.nome}</div>
                <div style={{ fontSize:13, color:'hsl(var(--text-muted))', marginTop:2 }}>
                  Cód.: <strong style={{ color:'hsl(var(--text-secondary))' }}>{aluno.codigo||aluno.matricula||'—'}</strong> •{' '}
                  RGA: <strong style={{ color:'#818cf8' }}>{(aluno as any).rga||(aluno as any).codigo||'—'}</strong> •{' '}
                  <strong style={{ color:'#60a5fa' }}>{aluno.turma||'—'}</strong> • {aluno.serie||'—'} • {aluno.turno||'—'}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                  <span className={`badge ${aluno.status==='matriculado'?'badge-success':'badge-warning'}`} style={{ textTransform:'capitalize' }}>{aluno.status}</span>
                  <span className={`badge ${aluno.inadimplente?'badge-danger':'badge-success'}`}>{aluno.inadimplente?'Inadimplente':'Financeiro OK'}</span>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:`${riskColor}20`, color:riskColor, fontWeight:700 }}>Risco IA: {riskLabel}</span>
                  {saude.podeSairSozinho===false && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:'rgba(239,68,68,0.12)', color:'#f87171', fontWeight:700 }}>🚫 Não sai sozinho</span>}
                  {saude.podeSairSozinho===true  && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:'rgba(16,185,129,0.12)', color:'#34d399', fontWeight:700 }}>✅ Pode sair sozinho</span>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                {[
                  { label:'Frequência', value:`${aluno.frequencia??'—'}%`, color:(aluno.frequencia??100)<75?'#ef4444':'#10b981' },
                  { label:'Média Geral', value:mediaGeral!==null?mediaGeral.toFixed(1):'—', color:mediaGeral===null?'hsl(var(--text-muted))':mediaGeral<5?'#ef4444':mediaGeral<7?'#f59e0b':'#10b981' },
                  { label:'Ocorrências', value:ocorrenciasAluno.length, color:ocorrenciasAluno.length>0?'#f59e0b':'#10b981' },
                ].map(k => (
                  <div key={k.label} style={{ textAlign:'center', padding:10, background:`${k.color}10`, borderRadius:10 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:k.color, fontFamily:'Outfit,sans-serif' }}>{k.value}</div>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IA Copiloto */}
          <div className="ia-card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <Brain size={16} color="#a78bfa" style={{ flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:13, color:'hsl(var(--text-secondary))' }}>
              {aluno.risco_evasao==='alto' && <><strong style={{ color:'#f87171' }}>Atenção urgente:</strong> {aluno.nome} — frequência {aluno.frequencia}%{aluno.inadimplente?', inadimplente':''} • {ocorrenciasAluno.length} ocorrência(s). Intervenção necessária.</>}
              {aluno.risco_evasao==='medio' && <><strong style={{ color:'#fbbf24' }}>Monitoramento:</strong> {aluno.nome} — frequência {aluno.frequencia}%{mediaGeral!==null?`, média ${mediaGeral.toFixed(1)}`:''}{parcelasVencidas.parcelas.length>0?`, ${parcelasVencidas.parcelas.length} parcela(s) vencida(s)`:''} · Acompanhe de perto.</>}
              {aluno.risco_evasao==='baixo' && <><strong style={{ color:'#34d399' }}>Perfil positivo:</strong> {aluno.nome} — frequência {aluno.frequencia}%{mediaGeral!==null?`, média ${mediaGeral.toFixed(1)}`:''}{!aluno.inadimplente?' · Financeiro regular.':''}</>}
            </div>
          </div>

          {/* ── Dados Pessoais + Desempenho ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <User size={14} color="#60a5fa"/> Dados Pessoais
              </div>
              <R k="Data de Nasc." v={(aluno.dataNascimento||(aluno as any).dataNasc) ? formatDate(aluno.dataNascimento||(aluno as any).dataNasc) : '—'}/>
              <R k="Idade" v={calcIdade(aluno.dataNascimento||(aluno as any).dataNasc)} color="#818cf8"/>
              <R k="Sexo" v={(aluno as any).sexo}/>
              <R k="CPF" v={aluno.cpf}/>
              <R k="RG" v={(aluno as any).rg}/>
              <R k="Naturalidade" v={(aluno as any).naturalidade}/>
              <R k="UF" v={(aluno as any).uf}/>
              <R k="Raça/Cor" v={(aluno as any).racaCor}/>
              <R k="E-mail" v={aluno.email}/>
              <R k="Telefone" v={aluno.telefone||(aluno as any).celular}/>
              {(aluno as any).filiacaoMae && <R k="Filiação Mãe" v={(aluno as any).filiacaoMae}/>}
              {(aluno as any).filiacaoPai && <R k="Filiação Pai" v={(aluno as any).filiacaoPai}/>}
              <R k="Código" v={(aluno as any).codigo}/>
              <R k="RGA" v={(aluno as any).rga||(aluno as any).matricula} color="#818cf8"/>
              {(aluno as any).idCenso && <R k="ID Censo" v={(aluno as any).idCenso}/>}
            </div>

            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <Star size={14} color="#eab308"/> Desempenho por Disciplina
              </div>
              {notasAluno.length === 0
                ? <div style={{ textAlign:'center', padding:'32px 0', color:'hsl(var(--text-muted))', fontSize:13 }}>
                    <BookOpen size={28} style={{ margin:'0 auto 8px', opacity:0.25 }}/>
                    Nenhuma nota lançada ainda
                  </div>
                : <>
                    {notasAluno.map(n => (
                      <div key={n.disciplina} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                          <span style={{ fontSize:12 }}>{n.disciplina}</span>
                          <span style={{ fontSize:13, fontWeight:800, color:n.nota>=7?'#34d399':n.nota>=5?'#fbbf24':'#f87171' }}>{n.nota.toFixed(1)}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width:`${n.nota*10}%`, background:n.nota>=7?'#10b981':n.nota>=5?'#f59e0b':'#ef4444' }}/>
                        </div>
                      </div>
                    ))}
                    {mediaGeral !== null && (
                      <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(99,102,241,0.06)', borderRadius:8, display:'flex', justifyContent:'space-between', border:'1px solid rgba(99,102,241,0.12)' }}>
                        <span style={{ fontSize:12 }}>Média Geral</span>
                        <span style={{ fontSize:16, fontWeight:900, fontFamily:'Outfit,sans-serif', color:mediaGeral>=7?'#34d399':mediaGeral>=5?'#fbbf24':'#f87171' }}>{mediaGeral.toFixed(1)}</span>
                      </div>
                    )}
                  </>
              }
            </div>
          </div>

          {/* ── Responsável Financeiro + Pedagógico ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Financeiro */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <DollarSign size={14} color="#10b981"/> Responsável Financeiro
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:12, background:'rgba(16,185,129,0.12)', color:'#34d399', fontWeight:700, marginLeft:4 }}>FINANCEIRO</span>
              </div>
              {!respFin
                ? <div style={{ textAlign:'center', padding:'28px 0', color:'hsl(var(--text-muted))', fontSize:13 }}><Users size={26} style={{ margin:'0 auto 8px', opacity:0.2 }}/> Não informado na matrícula</div>
                : <>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(16,185,129,0.06)', borderRadius:10, border:'1px solid rgba(16,185,129,0.2)', marginBottom:12 }}>
                      <div className="avatar" style={{ width:40, height:40, fontSize:13, background:'rgba(16,185,129,0.15)', color:'#34d399', flexShrink:0 }}>{getInitials(respFin.nome||'RF')}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:800 }}>{respFin.nome||'—'}</div>
                        <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{respFin.parentesco||'Responsável'}</div>
                      </div>
                      <span className={`badge ${aluno.inadimplente?'badge-danger':'badge-success'}`} style={{ fontSize:9 }}>{aluno.inadimplente?'Inadimplente':'Regular'}</span>
                    </div>
                    <R k="CPF" v={respFin.cpf}/><R k="RG" v={respFin.rg}/><R k="E-mail" v={respFin.email}/>
                    <R k="Celular" v={respFin.celular}/><R k="Tel. Comercial" v={respFin.telComercial}/>
                    <R k="Prof. / Emprego" v={respFin.profissao}/>
                  </>
              }
            </div>

            {/* Pedagógico */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <GraduationCap size={14} color="#818cf8"/> Responsável Pedagógico
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:12, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:700, marginLeft:4 }}>PEDAGÓGICO</span>
              </div>
              {!respPed
                ? <div style={{ textAlign:'center', padding:'28px 0', color:'hsl(var(--text-muted))', fontSize:13 }}><Users size={26} style={{ margin:'0 auto 8px', opacity:0.2 }}/> Não informado na matrícula</div>
                : <>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(99,102,241,0.06)', borderRadius:10, border:'1px solid rgba(99,102,241,0.2)', marginBottom:12 }}>
                      <div className="avatar" style={{ width:40, height:40, fontSize:13, background:'rgba(99,102,241,0.15)', color:'#818cf8', flexShrink:0 }}>{getInitials(respPed.nome||'RP')}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:800 }}>{respPed.nome||'—'}</div>
                        <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{respPed.parentesco||'Responsável'}</div>
                      </div>
                    </div>
                    <R k="CPF" v={respPed.cpf}/><R k="RG" v={respPed.rg}/><R k="E-mail" v={respPed.email}/>
                    <R k="Celular" v={respPed.celular}/><R k="Tel. Comercial" v={respPed.telComercial}/>
                    <R k="Prof. / Emprego" v={respPed.profissao}/>
                  </>
              }
            </div>
          </div>

          {/* ── Saúde & Observações ── */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <Heart size={14} color="#f43f5e"/> Saúde &amp; Observações Especiais
            </div>

            {/* Mini-cards sempre visíveis */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
              <MiniCard
                icon={<LogOut size={18} color={saude.autorizaSaida===false?'#f87171':saude.autorizaSaida===true?'#34d399':'hsl(var(--text-muted))'}/>}
                label="SAÍDA INDEPENDENTE"
                value={saude.autorizaSaida===false?'🚫 NÃO pode sair sozinho':saude.autorizaSaida===true?'✅ Pode sair sozinho':'Não informado'}
                bg={saude.autorizaSaida===false?'rgba(239,68,68,0.08)':saude.autorizaSaida===true?'rgba(16,185,129,0.08)':'hsl(var(--bg-elevated))'}
                border={saude.autorizaSaida===false?'rgba(239,68,68,0.25)':saude.autorizaSaida===true?'rgba(16,185,129,0.25)':'hsl(var(--border-subtle))'}
                valueColor={saude.autorizaSaida===false?'#f87171':saude.autorizaSaida===true?'#34d399':'hsl(var(--text-muted))'}
              />
              <MiniCard
                icon={<Droplets size={18} color="#f43f5e"/>}
                label="TIPO SANGUÍNEO"
                value={<span style={{ fontSize:20, fontFamily:'Outfit,sans-serif' }}>{saude.tipoSanguineo||'—'}</span>}
                bg="rgba(244,63,94,0.06)" border="rgba(244,63,94,0.2)" valueColor="#f43f5e"
              />
              <MiniCard
                icon={<Shield size={18} color="#f59e0b"/>}
                label="NECESSIDADES ESPECIAIS / NEE"
                value={saude.necessidades||'— Não informado'}
                bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.25)" valueColor={saude.necessidades?'#fbbf24':undefined}
              />
              <MiniCard
                icon={<AlertCircle size={18} color="#8b5cf6"/>}
                label="DEFICIÊNCIAS (CID)"
                value={saude.deficiencias||'— Não informado'}
                bg="rgba(139,92,246,0.07)" border="rgba(139,92,246,0.2)" valueColor={saude.deficiencias?'#a78bfa':undefined}
              />
              <MiniCard
                icon={<Pill size={18} color="#10b981"/>}
                label="MEDICAMENTOS EM USO"
                value={saude.medicamentos||'— Nenhum informado'}
                bg="rgba(16,185,129,0.06)" border="rgba(16,185,129,0.2)" valueColor={saude.medicamentos?'#34d399':undefined}
              />
              <MiniCard
                icon={<Activity size={18} color="#38bdf8"/>}
                label="PLANO DE SAÚDE"
                value={<>{saude.planoSaude||'— Não informado'}{saude.numeroPlano&&<div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:400, marginTop:2 }}>Nº: {saude.numeroPlano}</div>}{saude.hospital&&<div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontWeight:400 }}>Hospital: {saude.hospital}</div>}</>}
                bg="rgba(56,189,248,0.06)" border="rgba(56,189,248,0.2)"
              />
            </div>

            {/* Blocos de texto extras */}
            {saude.alergias && (
              <div style={{ marginBottom:10, padding:'10px 14px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10 }}>
                <div style={{ fontSize:11, color:'#f87171', fontWeight:800, display:'flex', alignItems:'center', gap:5, marginBottom:5 }}><AlertCircle size={11}/>⚠ ALERGIAS / RESTRIÇÕES</div>
                <div style={{ fontSize:13, color:'hsl(var(--text-secondary))', lineHeight:1.6 }}>{saude.alergias}</div>
              </div>
            )}
            {saude.obsMedica && (
              <div style={{ marginBottom:10, padding:'10px 14px', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10 }}>
                <div style={{ fontSize:11, color:'#818cf8', fontWeight:800, marginBottom:5 }}>🩺 OBSERVAÇÕES MÉDICAS</div>
                <div style={{ fontSize:13, color:'hsl(var(--text-secondary))', lineHeight:1.6 }}>{saude.obsMedica}</div>
              </div>
            )}
            {saude.obs && (
              <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:10 }}>
                <div style={{ fontSize:11, color:'#f59e0b', fontWeight:800, marginBottom:5 }}>📝 OBSERVAÇÕES GERAIS</div>
                <div style={{ fontSize:13, color:'hsl(var(--text-secondary))', lineHeight:1.6 }}>{saude.obs}</div>
              </div>
            )}
          </div>

          {/* ── Turma ── */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <GraduationCap size={14} color="#6366f1"/> Turma do Aluno
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))', gap:12 }}>
              {[
                { icon:<Layers size={14}/>, label:'Turma', value:turmaObj?.nome||aluno.turma||'—', color:'#6366f1' },
                { icon:<BookOpen size={14}/>, label:'Série / Segmento', value:(turmaObj as any)?.serie||aluno.serie||'—', color:'#3b82f6' },
                { icon:<Clock size={14}/>, label:'Turno', value:(turmaObj as any)?.turno||(aluno as any).dadosMatricula?.turno||aluno.turno||'—', color:'#8b5cf6' },
                { icon:<MapPin size={14}/>, label:'Unidade', value:(turmaObj as any)?.unidade||aluno.unidade||'—', color:'#10b981' },
                { icon:<User size={14}/>, label:'Professor(a)', value:(turmaObj as any)?.professor||'—', color:'#f59e0b' },
                { icon:<Home size={14}/>, label:'Sala', value:(turmaObj as any)?.sala||'—', color:'#64748b' },
                { icon:<Users size={14}/>, label:'Vagas', value:turmaObj?`${(turmaObj as any).matriculados||'?'}/${(turmaObj as any).capacidade||'?'}`:'—', color:'#14b8a6' },
                { icon:<Baby size={14}/>, label:'Ano Letivo', value:(turmaObj as any)?.ano||(aluno as any).anoLetivo||new Date().getFullYear(), color:'#ec4899' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:`${item.color}08`, border:`1px solid ${item.color}20`, borderRadius:10 }}>
                  <div style={{ color:item.color, flexShrink:0 }}>{item.icon}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginBottom:2 }}>{item.label}</div>
                    <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(item.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Ocorrências + Financeiro ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <AlertTriangle size={14} color="#f59e0b"/> Ocorrências ({ocorrenciasAluno.length})
              </div>
              {ocorrenciasAluno.length === 0
                ? <div style={{ textAlign:'center', padding:'28px 0', color:'hsl(var(--text-muted))', fontSize:13 }}>
                    <CheckCircle size={28} style={{ margin:'0 auto 8px', opacity:0.25 }}/>
                    <div style={{ fontWeight:700 }}>🏆 Sem ocorrências</div>
                    <div style={{ fontSize:12, marginTop:4 }}>Aluno sem registros disciplinares</div>
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {ocorrenciasAluno.slice(0, 6).map(oc => {
                      const gc = oc.gravidade==='grave'?'#ef4444':oc.gravidade==='media'?'#f59e0b':'#6b7280'
                      return (
                        <div key={oc.id} style={{ padding:'10px 12px', borderRadius:8, background:`${gc}08`, borderLeft:`3px solid ${gc}` }}>
                          <div style={{ fontSize:12, fontWeight:700 }}>{oc.tipo}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>
                            {oc.data} • <span style={{ color:gc, fontWeight:600, textTransform:'capitalize' }}>{oc.gravidade}</span>
                            {oc.descricao && <> • {oc.descricao.slice(0, 40)}{oc.descricao.length > 40 ? '…' : ''}</>}
                            {!oc.ciencia_responsavel && <span style={{ color:'#fbbf24' }}> • Pendente ciência</span>}
                          </div>
                        </div>
                      )
                    })}
                    {ocorrenciasAluno.length > 6 && <div style={{ fontSize:11, color:'hsl(var(--text-muted))', textAlign:'center', paddingTop:4 }}>+{ocorrenciasAluno.length-6} ocorrência(s) adicionais</div>}
                  </div>
              }
            </div>

            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <DollarSign size={14} color="#10b981"/> Histórico Financeiro
              </div>
              {(()=>{
                const vp = parcelasVencidas.parcelas
                const vt = parcelasVencidas.titulos
                const totalVencido = vp.reduce((s:number,p:any)=>s+(p.valorFinal||p.valor||0),0) + vt.reduce((s,t)=>s+t.valor,0)
                const tudo = vp.length === 0 && vt.length === 0
                if (tudo) return (
                  <div style={{ textAlign:'center', padding:'28px 16px', background:'rgba(16,185,129,0.05)', borderRadius:12, border:'1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                    <div style={{ fontWeight:800, fontSize:14, color:'#10b981' }}>Tudo em dia!</div>
                    <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:6, lineHeight:1.5 }}>
                      {parcelasAluno.length > 0
                        ? `${parcelasAluno.filter(p=>p.status==='pago').length} de ${parcelasAluno.length} parcelas quitadas`
                        : 'Nenhuma parcela em aberto registrada'
                      }
                    </div>
                  </div>
                )
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <div>
                        <div style={{ fontSize:10, color:'#f87171', fontWeight:700, letterSpacing:.5, marginBottom:2 }}>TOTAL VENCIDO</div>
                        <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{vp.length+vt.length} parcela(s) em atraso</div>
                      </div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:900, fontSize:18, color:'#ef4444' }}>R$ {fmtMoeda(totalVencido)}</div>
                    </div>
                    {vp.map((p:any,i:number)=>{
                      let dias=0
                      try{ const parts=p.vencimento.split('/'); const d=new Date(+parts[2],+parts[1]-1,+parts[0],12); dias=Math.floor((Date.now()-d.getTime())/86400000) }catch{}
                      return (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)' }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700 }}>{p.evento||'Mensalidade'}</div>
                            <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Vcto: {p.vencimento ? (p.vencimento.includes('/') ? p.vencimento : formatDate(p.vencimento)) : '—'} • <span style={{ color:'#f87171', fontWeight:700 }}>{dias}d atraso</span></div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:13, color:'#ef4444' }}>R$ {fmtMoeda(p.valorFinal||p.valor||0)}</div>
                            <span style={{ fontSize:9, color:'#f87171', fontWeight:700 }}>VENCIDA</span>
                          </div>
                        </div>
                      )
                    })}
                    {vt.map(t=>(
                      <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700 }}>{t.descricao}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Vcto: {t.vencimento ? (t.vencimento.includes('/') ? t.vencimento : formatDate(t.vencimento)) : '—'}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:13, color:'#ef4444' }}>R$ {fmtMoeda(t.valor)}</div>
                          <span className="badge badge-danger" style={{ fontSize:9 }}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Ficha360Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Carregando ficha...</div>}>
      <Ficha360Inner />
    </Suspense>
  )
}
