'use client'

import { useData } from '@/lib/dataContext'
import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, Search, Phone, Mail, MessageSquare,
  ChevronRight, AlertTriangle, CheckCircle,
  Wallet, UserCheck, Download, Plus,
  BookOpen, X, TrendingDown, Shield, Heart, User, ChevronDown,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface Responsavel {
  nome: string
  telefone: string
  email: string
  cpf?: string
  parentesco?: string
  tipo?: string
  respPedagogico?: boolean
  respFinanceiro?: boolean
  filhos: {
    id: string; nome: string; turma: string; serie: string
    frequencia: number; inadimplente: boolean; risco_evasao: string
  }[]
  inadimplente: boolean
  totalFilhos: number
}

const RISCO_COLOR = { alto: '#ef4444', medio: '#f59e0b', baixo: '#10b981' }
const RISCO_LABEL = { alto: '⚠ Alto', medio: '⚡ Médio', baixo: '✓ Baixo' }

export default function ResponsaveisPage() {
  const { alunos } = useData()
  const [search, setSearch]         = useState('')
  const [selecionado, setSelecionado] = useState<Responsavel | null>(null)
  const [showContato, setShowContato] = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [activeKpi, setActiveKpi]   = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const id = 'kpi-resp-style'
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = `
      @keyframes resp-slide-in { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      .resp-kpi-panel { animation: resp-slide-in 0.22s ease; }
    `
    document.head.appendChild(st)
  }, [])

  // ── Agrupar alunos por responsável ────────────────────────────────────────
  const responsaveis = useMemo<Responsavel[]>(() => {
    const mapa: Record<string, Responsavel> = {}

    alunos.forEach(aluno => {
      const respsArray: any[] = Array.isArray((aluno as any).responsaveis)
        ? (aluno as any).responsaveis : []

      const respsComNome = respsArray.filter(r => r.nome?.trim())

      const respsToProcess = respsComNome.length > 0
        ? respsComNome
        : aluno.responsavel?.trim()
          ? [{ nome: aluno.responsavel.trim(), tipo: 'legado', celular: aluno.telefone, email: aluno.email, parentesco: 'Responsável', respPedagogico: true, respFinanceiro: false }]
          : []

      respsToProcess.forEach((resp: any, idx: number) => {
        const nome = resp.nome?.trim()
        if (!nome) return

        const cpfLimpo = (resp.cpf || '').replace(/\D/g, '')
        const chave = cpfLimpo.length === 11
          ? cpfLimpo
          : `${aluno.id}_${resp.tipo || idx}`

        const parentesco = resp.parentesco
          || (resp.tipo === 'mae' ? 'Mãe' : resp.tipo === 'pai' ? 'Pai' : resp.tipo === 'legado' ? 'Responsável' : 'Outro')

        if (!mapa[chave]) {
          mapa[chave] = {
            nome, telefone: resp.celular || resp.telefone || '',
            email: resp.email || '',
            cpf: cpfLimpo.length === 11 ? cpfLimpo : undefined,
            parentesco, tipo: resp.tipo || 'outro',
            respPedagogico: !!resp.respPedagogico,
            respFinanceiro: !!resp.respFinanceiro,
            filhos: [], inadimplente: false, totalFilhos: 0,
          }
        } else {
          if (!mapa[chave].nome) mapa[chave].nome = nome
          if (resp.respPedagogico) mapa[chave].respPedagogico = true
          if (resp.respFinanceiro) mapa[chave].respFinanceiro = true
        }

        const jaAdicionado = mapa[chave].filhos.some(f => f.id === aluno.id)
        if (!jaAdicionado) {
          mapa[chave].filhos.push({
            id: aluno.id, nome: aluno.nome, turma: aluno.turma, serie: aluno.serie,
            frequencia: aluno.frequencia, inadimplente: aluno.inadimplente, risco_evasao: aluno.risco_evasao,
          })
        }
        if (aluno.inadimplente) mapa[chave].inadimplente = true
      })
    })

    return Object.values(mapa)
      .map(r => ({ ...r, totalFilhos: r.filhos.length, telefone: r.telefone || 'Não informado' }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [alunos])

  // ── Busca ─────────────────────────────────────────────────────────────────
  const hasSearch = search.trim().length >= 3

  function matchNome(nome: string, q: string): boolean {
    const n = nome.toLowerCase()
    if (n.includes(q)) return true
    const tokens = n.split(/\s+/).filter(Boolean)
    const initials = tokens.map(t => t[0]).join('')
    if (initials.startsWith(q)) return true
    const qTokens = q.split(/\s+/).filter(Boolean)
    if (qTokens.length > 1 && qTokens.every(qt => tokens.some(t => t.startsWith(qt)))) return true
    return false
  }

  const filtered = useMemo(() => {
    if (!hasSearch) return []
    const q = search.toLowerCase().trim()
    return responsaveis.filter(r =>
      matchNome(r.nome, q) || r.filhos.some(f => matchNome(f.nome || '', q))
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, responsaveis, hasSearch])

  // ── KPI data ──────────────────────────────────────────────────────────────
  const totalResp     = mounted ? responsaveis.length : 0
  const inadimplentes = mounted ? responsaveis.filter(r => r.inadimplente).length : 0
  const comRisco      = mounted ? responsaveis.filter(r => r.filhos.some(f => f.risco_evasao !== 'baixo')).length : 0
  const freqCrit      = mounted ? responsaveis.filter(r => r.filhos.some(f => f.frequencia < 75)).length : 0
  const semProblemas  = mounted ? responsaveis.filter(r => !r.inadimplente && r.filhos.every(f => f.risco_evasao === 'baixo')).length : 0

  // Tipos de responsável
  const totalMae = mounted ? responsaveis.filter(r => r.tipo === 'mae').length : 0
  const totalPai = mounted ? responsaveis.filter(r => r.tipo === 'pai').length : 0
  const totalPed = mounted ? responsaveis.filter(r => r.respPedagogico).length : 0
  const totalFin = mounted ? responsaveis.filter(r => r.respFinanceiro).length : 0

  // Filtros por KPI
  const KPI_FILTERS: Record<string, (r: Responsavel) => boolean> = {
    total:       () => true,
    inadimpl:    r => r.inadimplente,
    risco:       r => r.filhos.some(f => f.risco_evasao !== 'baixo'),
    freq:        r => r.filhos.some(f => f.frequencia < 75),
    semProbl:    r => !r.inadimplente && r.filhos.every(f => f.risco_evasao === 'baixo'),
    mae:         r => r.tipo === 'mae',
    pai:         r => r.tipo === 'pai',
    pedagogico:  r => !!r.respPedagogico,
    financeiro:  r => !!r.respFinanceiro,
  }

  type KpiItem = {
    id: string; label: string; value: number; sub: string
    color: string; bg: string; border: string; Icon: any
    trend?: string | null; clickable: boolean; row: number
  }

  const KPIS: KpiItem[] = [
    // Linha 1 – status
    { id:'total',    label:'Total Responsáveis',  value:totalResp,     sub:`${alunos.length} aluno(s) vinculado(s)`, color:'#6366f1', bg:'rgba(99,102,241,0.08)', border:'rgba(99,102,241,0.2)',  Icon:Users,          trend:null,                       clickable:true,         row:1 },
    { id:'inadimpl', label:'Com Inadimplência',   value:inadimplentes, sub:totalResp?`${((inadimplentes/totalResp)*100).toFixed(1)}% do total`:'—',                color:'#ef4444', bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.2)',   Icon:Wallet,         trend:inadimplentes>0?'danger':'ok', clickable:inadimplentes>0, row:1 },
    { id:'risco',    label:'Filhos em Risco',     value:comRisco,      sub:'família(s) com alertas',                 color:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', Icon:AlertTriangle,  trend:comRisco>0?'warn':'ok',     clickable:comRisco>0,   row:1 },
    { id:'freq',     label:'Freq. Crítica (<75%)',value:freqCrit,      sub:'responsável(is) afetados',               color:'#8b5cf6', bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.2)',  Icon:TrendingDown,   trend:freqCrit>0?'warn':'ok',     clickable:freqCrit>0,   row:1 },
    { id:'semProbl', label:'Sem Pendências',      value:semProblemas,  sub:'situação regular',                       color:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)',  Icon:Shield,         trend:null,                       clickable:semProblemas>0, row:1 },
    // Linha 2 – tipos
    { id:'mae',         label:'Mães',              value:totalMae, sub:'responsáveis do tipo Mãe',   color:'#ec4899', bg:'rgba(236,72,153,0.08)',  border:'rgba(236,72,153,0.2)',  Icon:Heart,  trend:null, clickable:totalMae>0,  row:2 },
    { id:'pai',         label:'Pais',              value:totalPai, sub:'responsáveis do tipo Pai',   color:'#3b82f6', bg:'rgba(59,130,246,0.08)',  border:'rgba(59,130,246,0.2)',  Icon:User,   trend:null, clickable:totalPai>0,  row:2 },
    { id:'pedagogico',  label:'Resp. Pedagógico',  value:totalPed, sub:'autorização pedagógica',     color:'#8b5cf6', bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.2)',  Icon:BookOpen, trend:null, clickable:totalPed>0, row:2 },
    { id:'financeiro',  label:'Resp. Financeiro',  value:totalFin, sub:'responsável de pagamento',   color:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)',  Icon:Wallet, trend:null, clickable:totalFin>0,  row:2 },
  ]

  const kpiFiltered = useMemo(() => {
    if (!activeKpi || !mounted) return []
    return responsaveis.filter(KPI_FILTERS[activeKpi] ?? (() => true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKpi, responsaveis, mounted])

  const activeKpiData = KPIS.find(k => k.id === activeKpi)
  const toggleKpi = (id: string) => setActiveKpi(p => p === id ? null : id)

  const renderKpiCard = (k: KpiItem) => {
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
          transition:'all 0.18s', position:'relative',
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
          <div suppressHydrationWarning style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:2 }}>{k.sub}</div>
        </div>
        {k.clickable && (
          <div style={{ fontSize:10, color:isActive ? k.color : 'hsl(var(--text-muted))', fontWeight:600 }}>
            {isActive ? '▲ Fechar lista' : '▼ Ver responsáveis'}
          </div>
        )}
      </div>
    )
  }

  // Subcomponente: painel de responsáveis filtrados ─────────────────────────
  const KpiPanel = () => {
    if (!activeKpi || !activeKpiData || !mounted) return null
    return (
      <div className="resp-kpi-panel" style={{ marginBottom:24, borderRadius:16, border:`2px solid ${activeKpiData.color}40`, overflow:'hidden', background:'hsl(var(--bg-elevated))' }}>
        <div style={{ padding:'14px 20px', background:activeKpiData.bg, borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:`${activeKpiData.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <activeKpiData.Icon size={15} color={activeKpiData.color}/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:13 }}>{activeKpiData.label}</div>
              <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{kpiFiltered.length} responsável{kpiFiltered.length!==1?'is':''}</div>
            </div>
          </div>
          <button onClick={() => setActiveKpi(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
            <X size={15}/> Fechar
          </button>
        </div>

        {kpiFiltered.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
            <div style={{ fontWeight:600 }}>Nenhum responsável nesta categoria</div>
          </div>
        ) : (
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                  {['Responsável','Parentesco','Resp.Ped.','Resp.Fin.','Celular','Financeiro','Filhos','Ação'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpiFiltered.map((r, i) => {
                  const riscoMax = r.filhos.some(f => f.risco_evasao === 'alto') ? 'alto' : r.filhos.some(f => f.risco_evasao === 'medio') ? 'medio' : 'baixo'
                  const rc = RISCO_COLOR[riscoMax as keyof typeof RISCO_COLOR]
                  return (
                    <tr key={i} style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="avatar" style={{ width:34, height:34, fontSize:12, background:`${rc}20`, color:rc, borderRadius:10, border:`2px solid ${rc}30`, flexShrink:0 }}>
                            {getInitials(r.nome)}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700 }}>{r.nome}</div>
                            {r.cpf && <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontFamily:'monospace' }}>{r.cpf}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'rgba(99,102,241,0.1)', color:'#818cf8', fontWeight:700 }}>
                          {r.parentesco || r.tipo || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign:'center' }}>
                        {r.respPedagogico ? <span className="badge badge-success" style={{ fontSize:10 }}>✓ Sim</span> : <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>—</span>}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        {r.respFinanceiro ? <span className="badge badge-success" style={{ fontSize:10 }}>✓ Sim</span> : <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>—</span>}
                      </td>
                      <td>
                        {r.telefone && r.telefone !== 'Não informado'
                          ? <a href={`tel:${r.telefone}`} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#3b82f6', textDecoration:'none' }}><Phone size={11}/>{r.telefone}</a>
                          : <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>—</span>}
                      </td>
                      <td>
                        {r.inadimplente
                          ? <span className="badge badge-danger" style={{ fontSize:10 }}>💳 Inadimplente</span>
                          : <span className="badge badge-success" style={{ fontSize:10 }}>Regular</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {r.filhos.map(f => (
                            <Link key={f.id} href={`/academico/alunos/ficha?id=${f.id}`}>
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(99,102,241,0.1)', color:'#818cf8', fontWeight:700, cursor:'pointer' }}>
                                {f.nome.split(' ')[0]}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => setSelecionado(r)}>
                          <UserCheck size={11}/> Detalhar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom:28 }}>
        <div>
          <h1 className="page-title">Responsáveis</h1>
          <p className="page-subtitle" suppressHydrationWarning>
            {mounted ? responsaveis.length : '—'} responsável(is) cadastrado(s) · {mounted ? alunos.length : '—'} aluno(s) vinculado(s)
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13}/> Exportar Lista</button>
          <button className="btn btn-primary btn-sm" style={{ background:'linear-gradient(135deg,#6366f1,#3b82f6)' }} onClick={() => setShowContato(true)}>
            <Plus size={13}/> Registrar Contato
          </button>
        </div>
      </div>

      {/* Orientação */}
      {mounted && responsaveis.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, fontSize:12, color:'hsl(var(--text-muted))' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', display:'inline-block' }}/>
          Clique em qualquer card para filtrar e ver a lista de responsáveis
        </div>
      )}

      {/* ══ KPI Cards — Linha 1: Status ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom: ['total','inadimpl','risco','freq','semProbl'].includes(activeKpi||'') ? 0 : 16 }}>
        {KPIS.filter(k => k.row === 1).map(renderKpiCard)}
      </div>

      {/* Panel linha 1 */}
      {['total','inadimpl','risco','freq','semProbl'].includes(activeKpi||'') && <KpiPanel/>}



      {/* ── Hero Search ── */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        padding:'36px 24px', marginBottom:24,
        background:'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(16,185,129,0.03))',
        border:'1px solid hsl(var(--border-subtle))', borderRadius:20,
      }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>🔍 Buscar Responsável</div>
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            Digite ao menos 3 letras — por nome, sobrenome ou iniciais (ex: &quot;IR&quot; para Ivan Rossi)
          </div>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:560 }}>
          <Search size={18} style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input
            ref={searchRef}
            className="form-input"
            style={{ paddingLeft:48, paddingRight:search?44:16, fontSize:15, height:52, borderRadius:14, boxShadow:hasSearch?'0 0 0 3px rgba(99,102,241,0.15)':'none' }}
            placeholder="Ex: Ivan Rossi, Fra, IR (iniciais)..."
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

        {!hasSearch && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {['Inadimplente', 'Risco Alto', 'Freq. Crítica'].map(tag => (
              <span key={tag}
                style={{ fontSize:11, padding:'4px 12px', borderRadius:20, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', color:'hsl(var(--text-muted))', cursor:'pointer' }}
                onClick={() => { setSearch(tag); searchRef.current?.focus() }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {search.trim().length > 0 && search.trim().length < 3 && (
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            Digite mais {3 - search.trim().length} letra{3 - search.trim().length > 1 ? 's' : ''} para buscar...
          </div>
        )}
        {hasSearch && (
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div suppressHydrationWarning>
        {!mounted ? null : !hasSearch ? (
          alunos.length === 0 ? (
            <div className="card" style={{ padding:'48px', textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <Users size={44} style={{ margin:'0 auto 14px', opacity:0.2 }}/>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>Nenhum aluno cadastrado</div>
              <div style={{ fontSize:13, marginBottom:18 }}>Os responsáveis são derivados dos dados dos alunos.</div>
              <Link href="/academico/alunos" className="btn btn-primary"><Users size={14}/> Cadastrar Alunos</Link>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'hsl(var(--text-muted))', fontSize:13 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🔎</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>Use a busca acima para localizar responsáveis</div>
              <div style={{ fontSize:12 }}>
                Você tem {responsaveis.length} responsável{responsaveis.length !== 1 ? 'is' : ''} e {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} cadastrado{alunos.length !== 1 ? 's' : ''}
              </div>
            </div>
          )
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', color:'hsl(var(--text-muted))' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🕵️</div>
            <div style={{ fontWeight:600 }}>Nenhum responsável encontrado</div>
            <div style={{ fontSize:12, marginTop:4 }}>Tente outro nome, filho(a) ou turma</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap:14 }}>
            {filtered.map(resp => {
              const riscoMax = resp.filhos.some(f => f.risco_evasao === 'alto') ? 'alto' : resp.filhos.some(f => f.risco_evasao === 'medio') ? 'medio' : 'baixo'
              const rc = RISCO_COLOR[riscoMax as keyof typeof RISCO_COLOR]
              return (
                <div key={resp.nome} className="card"
                  style={{ padding:'18px 20px', borderLeft:`4px solid ${resp.inadimplente ? '#ef4444' : rc}`, cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='' }}
                  onClick={() => setSelecionado(resp)}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
                    <div className="avatar" style={{ width:46, height:46, fontSize:16, flexShrink:0, background:resp.inadimplente?'rgba(239,68,68,0.15)':`${rc}20`, color:resp.inadimplente?'#f87171':rc }}>
                      {getInitials(resp.nome)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{resp.nome}</div>
                      <div style={{ display:'flex', gap:5, marginTop:4, flexWrap:'wrap' }}>
                        {resp.parentesco && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(99,102,241,0.1)', color:'#818cf8', fontWeight:700 }}>{resp.parentesco}</span>}
                        {resp.respPedagogico && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#10b981', fontWeight:700 }}>📚 Pedagógico</span>}
                        {resp.respFinanceiro && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:700 }}>💰 Financeiro</span>}
                        <span style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{resp.totalFilhos} filho{resp.totalFilhos > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {resp.inadimplente && <span className="badge badge-danger" style={{ fontSize:10 }}>💳 Inadimplente</span>}
                      {riscoMax !== 'baixo' && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:`${rc}20`, color:rc, fontWeight:700 }}>{RISCO_LABEL[riscoMax as keyof typeof RISCO_LABEL]}</span>}
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'hsl(var(--text-secondary))' }}>
                      <Phone size={11} style={{ flexShrink:0, color:'hsl(var(--text-muted))' }}/>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {resp.telefone !== 'Não informado' ? resp.telefone : <span style={{ color:'hsl(var(--text-muted))', fontStyle:'italic' }}>Não informado</span>}
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'hsl(var(--text-secondary))' }}>
                      <Mail size={11} style={{ flexShrink:0, color:'hsl(var(--text-muted))' }}/>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {resp.email || <span style={{ color:'hsl(var(--text-muted))', fontStyle:'italic' }}>Não informado</span>}
                      </span>
                    </div>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {resp.filhos.map(filho => {
                      const rc2 = RISCO_COLOR[filho.risco_evasao as keyof typeof RISCO_COLOR] ?? '#10b981'
                      return (
                        <div key={filho.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'hsl(var(--bg-elevated))', borderRadius:8, border:'1px solid hsl(var(--border-subtle))' }} onClick={e => e.stopPropagation()}>
                          <BookOpen size={12} color="#60a5fa" style={{ flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{filho.nome}</div>
                            <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{filho.turma} · {filho.serie}</div>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:filho.frequencia < 75 ? '#f87171' : '#34d399' }}>{filho.frequencia}%</span>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:rc2 }}/>
                            {filho.inadimplente && <span style={{ fontSize:9, padding:'1px 4px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#f87171', fontWeight:700 }}>$</span>}
                          </div>
                          <Link href={`/academico/alunos/ficha?id=${filho.id}`} onClick={e => e.stopPropagation()} className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:'3px 8px' }}>
                            Ficha <ChevronRight size={10}/>
                          </Link>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display:'flex', gap:8, marginTop:14, paddingTop:12, borderTop:'1px solid hsl(var(--border-subtle))' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex:1, fontSize:11 }} onClick={e => { e.stopPropagation(); window.open(`tel:${resp.telefone}`) }}><Phone size={11}/> Ligar</button>
                    <button className="btn btn-secondary btn-sm" style={{ flex:1, fontSize:11 }} onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${resp.telefone.replace(/\D/g, '')}`) }}><MessageSquare size={11}/> WhatsApp</button>
                    <button className="btn btn-secondary btn-sm" style={{ flex:1, fontSize:11 }} onClick={e => { e.stopPropagation(); window.open(`mailto:${resp.email}`) }}><Mail size={11}/> E-mail</button>
                    {resp.inadimplente && (
                      <Link href="/financeiro/inadimplencia" className="btn btn-danger btn-sm" style={{ flex:1, fontSize:11 }} onClick={e => e.stopPropagation()}>
                        <Wallet size={11}/> Cobrar
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Detalhe ── */}
      {selecionado && (
        <div className="modal-overlay" onClick={() => setSelecionado(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:560, padding:24, width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div className="avatar" style={{ width:52, height:52, fontSize:18, background:selecionado.inadimplente?'rgba(239,68,68,0.15)':'rgba(59,130,246,0.15)', color:selecionado.inadimplente?'#f87171':'#60a5fa' }}>
                  {getInitials(selecionado.nome)}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:17, fontFamily:'Outfit,sans-serif' }}>{selecionado.nome}</div>
                  <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:2 }}>
                    {selecionado.totalFilhos} filho(s) matriculado(s)
                    {selecionado.inadimplente && <span style={{ color:'#f87171', marginLeft:8 }}>• Inadimplente</span>}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelecionado(null)}><X size={16}/></button>
            </div>

            <div className="card" style={{ padding:'16px', marginBottom:16, background:'hsl(var(--bg-elevated))' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Dados de Contato</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:<Phone size={14}/>, label:'Telefone / WhatsApp', value:selecionado.telefone },
                  { icon:<Mail size={14}/>, label:'E-mail', value:selecionado.email||'Não informado' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ color:'#60a5fa', flexShrink:0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button className="btn btn-primary btn-sm" style={{ flex:1, fontSize:12 }} onClick={() => window.open(`https://wa.me/${selecionado.telefone.replace(/\D/g, '')}`)}><MessageSquare size={12}/> WhatsApp</button>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, fontSize:12 }} onClick={() => window.open(`mailto:${selecionado.email}`)}><Mail size={12}/> E-mail</button>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, fontSize:12 }} onClick={() => window.open(`tel:${selecionado.telefone}`)}><Phone size={12}/> Ligar</button>
              </div>
            </div>

            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Filhos Matriculados</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {selecionado.filhos.map(filho => {
                const rc = RISCO_COLOR[filho.risco_evasao as keyof typeof RISCO_COLOR] ?? '#10b981'
                const sit = filho.frequencia < 75 ? 'Freq. crítica' : filho.inadimplente ? 'Inadimplente' : filho.risco_evasao !== 'baixo' ? 'Risco de evasão' : 'Regular'
                return (
                  <div key={filho.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:`1px solid hsl(var(--border-subtle))`, borderLeft:`3px solid ${rc}` }}>
                    <div className="avatar" style={{ width:36, height:36, fontSize:12, background:`${rc}20`, color:rc, flexShrink:0 }}>{getInitials(filho.nome)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{filho.nome}</div>
                      <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{filho.turma} · {filho.serie}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:filho.frequencia < 75 ? '#f87171' : '#34d399' }}>{filho.frequencia}% freq.</div>
                      <div style={{ fontSize:11, color:rc }}>{sit}</div>
                    </div>
                    <Link href={`/academico/alunos/ficha?id=${filho.id}`} onClick={() => setSelecionado(null)} className="btn btn-secondary btn-sm" style={{ fontSize:11, flexShrink:0 }}>
                      <UserCheck size={11}/> Ficha 360°
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Registrar Contato ── */}
      {showContato && (
        <div className="modal-overlay" onClick={() => setShowContato(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:460, padding:24, width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Registrar Contato com Responsável</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowContato(false)}><X size={16}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="form-label">Responsável *</label>
                <select className="form-input">
                  <option>Selecionar...</option>
                  {responsaveis.map(r => <option key={r.nome}>{r.nome}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="form-label">Canal</label>
                  <select className="form-input"><option>WhatsApp</option><option>Ligação</option><option>E-mail</option><option>Presencial</option></select>
                </div>
                <div>
                  <label className="form-label">Data</label>
                  <input className="form-input" type="date" defaultValue={new Date().toISOString().slice(0, 10)}/>
                </div>
              </div>
              <div>
                <label className="form-label">Assunto</label>
                <select className="form-input">
                  <option>Frequência</option><option>Financeiro / Inadimplência</option>
                  <option>Desempenho acadêmico</option><option>Ocorrência disciplinar</option>
                  <option>Risco de evasão</option><option>Outro</option>
                </select>
              </div>
              <div>
                <label className="form-label">Resumo do contato</label>
                <textarea className="form-input" rows={3} placeholder="Descreva o resultado da conversa, próximos passos..."/>
              </div>
              <div>
                <label className="form-label">Próximo contato agendado</label>
                <input className="form-input" type="date"/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowContato(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowContato(false)}><CheckCircle size={13}/> Salvar Contato</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
