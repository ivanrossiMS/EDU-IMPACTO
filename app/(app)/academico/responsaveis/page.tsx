'use client'
import { useApiQuery } from '@/hooks/useApi';
import { useData } from '@/lib/dataContext'
import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, Search, Phone, Mail, MessageSquare,
  ChevronRight, AlertTriangle, CheckCircle, Edit,
  Wallet, UserCheck, Download, Plus, Settings, MapPin,
  BookOpen, X, TrendingDown, Shield, Heart, User, ChevronDown,
  Cpu, Briefcase, GraduationCap, ExternalLink, Zap,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { CadastroResponsavelModal } from '@/components/alunos/CadastroResponsavelModal'

interface Responsavel {
  id?: string
  codigo?: string
  rfid?: string
  rg?: string
  profissao?: string
  enderecoStr?: string
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
  // Data fetching via useApiQuery (modernizado para evitar staleness do localStorage)
  const [responsaveisRaw, setResponsaveisRaw] = useState<any[]>([])
  
  const { data: resResp } = useApiQuery<any>(
    ['responsaveis'],
    '/api/responsaveis?incluir_vinculos=1&limit=2000'
  )
  
  useEffect(() => {
    if (resResp) {
      setResponsaveisRaw(Array.isArray(resResp.data) ? resResp.data : (Array.isArray(resResp) ? resResp : []))
    }
  }, [resResp])

  const { data: resAlunos } = useApiQuery<any>(
    ['alunos-raw'],
    '/api/alunos?limit=2000'
  )
  const alunos = Array.isArray(resAlunos?.data) ? resAlunos.data : (Array.isArray(resAlunos) ? resAlunos : [])

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Responsavel[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [selecionado, setSelecionado] = useState<Responsavel & { _raw?: any } | null>(null)
  const [showContato, setShowContato] = useState(false)
  const [showCadastroModal, setShowCadastroModal] = useState(false)
  const [responsavelEdicao, setResponsavelEdicao] = useState<any>(null)
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
      @keyframes spin { to { transform: rotate(360deg) } }
      @keyframes resp-card-in { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes rfid-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)} 50%{box-shadow:0 0 0 6px rgba(99,102,241,0)} }
      .resp-kpi-panel { animation: resp-slide-in 0.22s ease; }
      .resp-card-premium { animation: resp-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
      .resp-card-premium:hover .resp-card-glow { opacity:1 !important; }
      .resp-card-premium:hover .resp-card-inner { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(0,0,0,0.22), 0 8px 20px rgba(0,0,0,0.12) !important; }
      .resp-card-inner { transition: transform 0.22s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.22s ease; }
      .resp-action-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
      .resp-action-btn { transition: all 0.15s; }
      .rfid-chip { animation: rfid-pulse 2.5s infinite; }
    `

    document.head.appendChild(st)
  }, [])

  // ── Transformando dados da tabela de responsáveis ───────────────────────
  const responsaveis = useMemo<Responsavel[]>(() => {
    return (responsaveisRaw || []).map(r => {
        const filhos = (r._vinculos || []).map((v:any) => ({
           id: v.aluno?.id || v.aluno_id,
           nome: v.aluno?.nome || 'Aluno Desconhecido',
           turma: v.aluno?.turma || '',
           serie: v.aluno?.serie || '',
           frequencia: v.aluno?.frequencia || 0,
           inadimplente: v.aluno?.inadimplente || false,
           risco_evasao: v.aluno?.risco_evasao || 'baixo',
           foto: v.aluno?.foto || v.aluno?.dados?.foto || ''
        }))

        return {
          id: r.id, codigo: r.codigo, rfid: r.rfid, rg: r.rg, profissao: r.profissao, 
          enderecoStr: r.endereco?.logradouro ? `${r.endereco.logradouro}, ${r.endereco.numero || 'SN'}` : '',
          nome: r.nome, telefone: r.celular || r.telefone || 'Não informado', email: r.email || '',
          cpf: r.cpf, parentesco: r.parentesco, tipo: r.tipo,
          respPedagogico: r.dados?.respPedagogico || false,
          respFinanceiro: r.dados?.respFinanceiro || false,
          inadimplente: filhos.some((f:any) => f.inadimplente),
          filhos,
          totalFilhos: filhos.length,
          _raw: r 
        }
    }).sort((a:any, b:any) => a.nome.localeCompare(b.nome))
  }, [responsaveisRaw])

  // ── Search-as-you-type: servidor, mínimo 3 chars, debounce 300ms ──────────
  const transformResp = (r: any): Responsavel => {
    const filhos = (r._vinculos || []).map((v: any) => ({
      id: v.aluno?.id || v.aluno_id,
      nome: v.aluno?.nome || 'Aluno Desconhecido',
      turma: v.aluno?.turma || '',
      serie: v.aluno?.serie || '',
      frequencia: v.aluno?.frequencia || 0,
      inadimplente: v.aluno?.inadimplente || false,
      risco_evasao: v.aluno?.risco_evasao || 'baixo',
      foto: v.aluno?.foto || v.aluno?.dados?.foto || ''
    }))
    return {
      id: r.id, codigo: r.codigo, rfid: r.rfid, rg: r.rg, profissao: r.profissao,
      enderecoStr: r.endereco?.logradouro ? `${r.endereco.logradouro}, ${r.endereco.numero || 'SN'}` : '',
      nome: r.nome, telefone: r.celular || r.telefone || 'Não informado', email: r.email || '',
      cpf: r.cpf, parentesco: r.parentesco, tipo: r.tipo,
      respPedagogico: r.dados?.respPedagogico || false,
      respFinanceiro: r.dados?.respFinanceiro || false,
      inadimplente: filhos.some((f: any) => f.inadimplente),
      filhos, totalFilhos: filhos.length,
      _raw: r
    } as any
  }

  useEffect(() => {
    const q = search.trim()
    if (q.length < 3) {
      setSearchResults([])
      setSearchDone(false)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    setSearchDone(false)
    const timer = setTimeout(() => {
      let cancelled = false
      fetch(`/api/responsaveis?q=${encodeURIComponent(q)}&incluir_vinculos=1&limit=50`)
        .then(r => r.json())
        .then(json => {
          if (cancelled) return
          const lista = Array.isArray(json) ? json : (json.data ?? [])
          setSearchResults(lista.map(transformResp))
          setSearchDone(true)
        })
        .catch(() => { if (!cancelled) { setSearchResults([]); setSearchDone(true) } })
        .finally(() => { if (!cancelled) setSearchLoading(false) })
    }, 300)
    return () => { clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])



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
    { id:'total',    label:'Total Responsáveis',  value:totalResp,     sub:`${(alunos || []).length} aluno(s) vinculado(s)`, color:'#6366f1', bg:'rgba(99,102,241,0.08)', border:'rgba(99,102,241,0.2)',  Icon:Users,          trend:null,                       clickable:false,        row:1 },
    { id:'inadimpl', label:'Com Inadimplência',   value:inadimplentes, sub:totalResp?`${((inadimplentes/totalResp)*100).toFixed(1)}% do total`:'—',                color:'#ef4444', bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.2)',   Icon:Wallet,         trend:inadimplentes>0?'danger':'ok', clickable:inadimplentes>0, row:1 },
    { id:'risco',    label:'Filhos em Risco',     value:comRisco,      sub:'família(s) com alertas',                 color:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', Icon:AlertTriangle,  trend:comRisco>0?'warn':'ok',     clickable:comRisco>0,   row:1 },
    { id:'freq',     label:'Freq. Crítica (<75%)',value:freqCrit,      sub:'responsável(is) afetados',               color:'#8b5cf6', bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.2)',  Icon:TrendingDown,   trend:freqCrit>0?'warn':'ok',     clickable:freqCrit>0,   row:1 },
    { id:'semProbl', label:'Sem Pendências',      value:semProblemas,  sub:'situação regular',                       color:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)',  Icon:Shield,         trend:null,                       clickable:false,        row:1 },
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
      <div className="page-header" style={{ marginBottom:28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Responsáveis</h1>
          <p className="page-subtitle" suppressHydrationWarning>
            {mounted ? responsaveis.length : '—'} responsável(is) cadastrado(s) · {mounted ? (alunos || []).length : '—'} aluno(s) no sistema
          </p>
        </div>
        <div>
          <button 
             className="btn btn-primary" 
             onClick={() => { setResponsavelEdicao(null); setShowCadastroModal(true); }}>
             <Plus size={16}/> Novo Responsável
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
        display:'flex', flexDirection:'column', alignItems:'center', gap:16,
        padding:'28px 24px', marginBottom:24,
        background:'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(16,185,129,0.03))',
        border:'1px solid hsl(var(--border-subtle))', borderRadius:20,
      }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>🔍 Buscar Responsável</div>
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            Digite ao menos <strong>3 letras</strong> para buscar por nome, sobrenome, CPF ou iniciais
          </div>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:560 }}>
          <Search size={18} style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          {searchLoading && (
            <div style={{ position:'absolute', right:search?44:16, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', border:'2px solid rgba(99,102,241,0.3)', borderTopColor:'#6366f1', animation:'spin 0.7s linear infinite' }}/>
          )}
          <input
            ref={searchRef}
            className="form-input"
            style={{ paddingLeft:48, paddingRight:search?44:16, fontSize:15, height:52, borderRadius:14,
              boxShadow: search.length>=3 ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
              transition:'box-shadow 0.2s'
            }}
            placeholder="Ex: Ivan Rossi, Fra, 123.456... (mín. 3 letras)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]); setSearchDone(false); }}
              style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))', display:'flex' }}>
              <X size={16}/>
            </button>
          )}
        </div>

        {/* Status da busca */}
        {search.length === 0 && (
          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', display:'inline-block', opacity:.5 }}/>
            Nenhum responsável exibido antes da busca
          </div>
        )}
        {search.length > 0 && search.length < 3 && (
          <div style={{ fontSize:12, color:'#f59e0b', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <span>⏳</span> Mais {3 - search.length} letra{3 - search.length > 1 ? 's' : ''} para iniciar a busca…
          </div>
        )}
        {searchDone && !searchLoading && search.length >= 3 && (
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
            {searchResults.length === 0
              ? '🕵️ Nenhum resultado encontrado'
              : <><strong style={{ color:'#6366f1' }}>{searchResults.length}</strong> resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}</>
            }
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div suppressHydrationWarning>
        {!mounted ? null : search.length < 3 ? (
          /* Estado inicial: aguardando busca */
          <div style={{ textAlign:'center', padding:'52px 24px', color:'hsl(var(--text-muted))', borderRadius:20, border:'1.5px dashed hsl(var(--border-subtle))', background:'hsl(var(--bg-elevated))' }}>
            <Search size={40} style={{ margin:'0 auto 16px', opacity:0.15 }}/>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:8, color:'hsl(var(--text-secondary))' }}>Busque para ver os responsáveis</div>
            <div style={{ fontSize:13, maxWidth:360, margin:'0 auto' }}>
              Digite ao menos <strong style={{ color:'#6366f1' }}>3 letras</strong> no campo acima para buscar por nome, sobrenome ou CPF.
            </div>
            {mounted && responsaveis.length > 0 && (
              <div style={{ marginTop:20, fontSize:12, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', display:'inline-block' }}/>
                {responsaveis.length} responsável(is) no sistema — use os cards acima para filtrar por categoria
              </div>
            )}
          </div>
        ) : searchLoading ? (
          /* Carregando */
          <div style={{ textAlign:'center', padding:'52px 24px', color:'hsl(var(--text-muted))' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(99,102,241,0.2)', borderTopColor:'#6366f1', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }}/>
            <div style={{ fontSize:13, fontWeight:600 }}>Buscando &quot;{search}&quot;…</div>
          </div>
        ) : searchResults.length === 0 ? (
          /* Sem resultados */
          <div style={{ textAlign:'center', padding:'48px', color:'hsl(var(--text-muted))' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🕵️</div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Nenhum responsável encontrado</div>
            <div style={{ fontSize:13 }}>Tente outro nome, sobrenome ou CPF</div>
          </div>
        ) : (
          /* Resultados */
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(400px, 1fr))', gap:20 }}>
            {searchResults.map((resp, cardIdx) => {
              const riscoMax = resp.filhos.some(f => f.risco_evasao === 'alto') ? 'alto' : resp.filhos.some(f => f.risco_evasao === 'medio') ? 'medio' : 'baixo'
              const rc = RISCO_COLOR[riscoMax as keyof typeof RISCO_COLOR]
              const accentColor = resp.inadimplente ? '#ef4444' : riscoMax === 'alto' ? '#ef4444' : riscoMax === 'medio' ? '#f59e0b' : '#6366f1'
              const gradientBg = resp.inadimplente
                ? 'linear-gradient(135deg,rgba(239,68,68,0.06) 0%,rgba(239,68,68,0.02) 100%)'
                : riscoMax === 'medio'
                  ? 'linear-gradient(135deg,rgba(245,158,11,0.05) 0%,rgba(99,102,241,0.04) 100%)'
                  : 'linear-gradient(135deg,rgba(99,102,241,0.06) 0%,rgba(16,185,129,0.03) 100%)'
              return (
                <div
                  key={resp.id || resp.nome}
                  className="resp-card-premium"
                  style={{ position:'relative', animationDelay:`${cardIdx * 0.04}s` }}
                >
                  {/* Glow layer */}
                  <div className="resp-card-glow" style={{
                    position:'absolute', inset:-1, borderRadius:22,
                    background:`radial-gradient(ellipse at 30% 0%, ${accentColor}25 0%, transparent 65%)`,
                    opacity:0, transition:'opacity 0.3s', pointerEvents:'none', zIndex:0
                  }}/>

                  <div className="resp-card-inner" style={{
                    position:'relative', zIndex:1,
                    background:`hsl(var(--bg-base))`,
                    backgroundImage: gradientBg,
                    borderRadius:20,
                    border:`1.5px solid ${accentColor}30`,
                    boxShadow:`0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)`,
                    overflow:'hidden',
                  }}>

                    {/* ── Top accent bar ── */}
                    <div style={{ height:3, background:`linear-gradient(90deg, ${accentColor}, ${accentColor}60, transparent)` }}/>

                    {/* ── Main content ── */}
                    <div style={{ padding:'20px 22px 0' }}>

                      {/* Header Row */}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:16 }}>

                        {/* Avatar */}
                        <div style={{
                          width:56, height:56, borderRadius:16, flexShrink:0,
                          background:`linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`,
                          border:`2px solid ${accentColor}35`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:18, fontWeight:900, color:accentColor,
                          fontFamily:'Outfit,sans-serif', letterSpacing:-0.5,
                          boxShadow:`0 4px 16px ${accentColor}20`,
                        }}>
                          {getInitials(resp.nome)}
                        </div>

                        {/* Identity */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                            <span style={{ fontSize:15, fontWeight:800, color:'hsl(var(--text-base))', fontFamily:'Outfit,sans-serif', letterSpacing:-0.3 }}>
                              {resp.nome}
                            </span>
                            {resp.codigo && (
                              <span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:'var(--bg-overlay)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)', fontWeight:700, fontFamily:'monospace' }}>
                                #{resp.codigo}
                              </span>
                            )}
                            {resp.inadimplente && (
                              <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', fontWeight:800, letterSpacing:0.5 }}>INADIMPLENTE</span>
                            )}
                          </div>

                          {/* Badges row */}
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                            {resp.parentesco && (
                              <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:`${accentColor}15`, border:`1px solid ${accentColor}30`, color:accentColor, fontWeight:700 }}>
                                {resp.parentesco}
                              </span>
                            )}
                            {resp.respPedagogico && (
                              <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#818cf8', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                                <GraduationCap size={9}/> Pedagógico
                              </span>
                            )}
                            {resp.respFinanceiro && (
                              <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                                <Wallet size={9}/> Financeiro
                              </span>
                            )}
                            {riscoMax !== 'baixo' && (
                              <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:`${rc}15`, border:`1px solid ${rc}30`, color:rc, fontWeight:700 }}>
                                {RISCO_LABEL[riscoMax as keyof typeof RISCO_LABEL]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit btn */}
                        <button
                          onClick={e => { e.stopPropagation(); setResponsavelEdicao((resp as any)._raw); setShowCadastroModal(true) }}
                          style={{ width:34, height:34, borderRadius:10, border:`1px solid hsl(var(--border-subtle))`, background:'hsl(var(--bg-elevated))', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'hsl(var(--text-muted))', flexShrink:0, transition:'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as any).style.borderColor=accentColor; (e.currentTarget as any).style.color=accentColor }}
                          onMouseLeave={e => { (e.currentTarget as any).style.borderColor=''; (e.currentTarget as any).style.color='' }}
                          title="Editar responsável"
                        >
                          <Edit size={14}/>
                        </button>
                      </div>

                      {/* ── Info Grid ── */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                        {/* Telefone */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))' }}>
                          <Phone size={12} color="#60a5fa" style={{ flexShrink:0 }}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:9, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:1 }}>Celular</div>
                            <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: resp.telefone === 'Não informado' ? 'hsl(var(--text-muted))' : 'hsl(var(--text-base))' }}>
                              {resp.telefone !== 'Não informado' ? resp.telefone : <span style={{ fontStyle:'italic' }}>Não informado</span>}
                            </div>
                          </div>
                        </div>

                        {/* Email */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))' }}>
                          <Mail size={12} color="#a78bfa" style={{ flexShrink:0 }}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:9, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:1 }}>E-mail</div>
                            <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: resp.email ? 'hsl(var(--text-base))' : 'hsl(var(--text-muted))' }}>
                              {resp.email || <span style={{ fontStyle:'italic' }}>Não informado</span>}
                            </div>
                          </div>
                        </div>

                        {/* Profissão */}
                        {resp.profissao && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))' }}>
                            <Briefcase size={12} color="#34d399" style={{ flexShrink:0 }}/>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:9, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:1 }}>Profissão</div>
                              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{resp.profissao}</div>
                            </div>
                          </div>
                        )}

                        {/* RFID */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background: resp.rfid ? 'rgba(99,102,241,0.06)' : 'hsl(var(--bg-elevated))', border:`1px solid ${resp.rfid ? 'rgba(99,102,241,0.25)' : 'hsl(var(--border-subtle))'}` }}>
                          {resp.rfid
                            ? <Cpu size={12} color="#818cf8" className="rfid-chip" style={{ flexShrink:0 }}/>
                            : <Cpu size={12} color="hsl(var(--text-muted))" style={{ flexShrink:0 }}/>
                          }
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:9, color:'hsl(var(--text-muted))', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:1 }}>RFID</div>
                            <div style={{ fontSize:12, fontWeight:600, fontFamily: resp.rfid ? 'monospace' : 'inherit', color: resp.rfid ? '#818cf8' : 'hsl(var(--text-muted))', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {resp.rfid || <span style={{ fontStyle:'italic', fontFamily:'inherit', fontWeight:400 }}>Não cadastrado</span>}
                            </div>
                          </div>
                          {resp.rfid && (
                            <div style={{ marginLeft:'auto', flexShrink:0 }}>
                              <Zap size={10} color="#818cf8"/>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Alunos Vinculados ── */}
                      {resp.filhos.length > 0 && (
                        <div style={{ marginBottom:16 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:1, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                            <GraduationCap size={11}/>
                            {resp.filhos.length} Aluno{resp.filhos.length > 1 ? 's' : ''} Vinculado{resp.filhos.length > 1 ? 's' : ''}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {resp.filhos.map(filho => {
                              const rc2 = RISCO_COLOR[filho.risco_evasao as keyof typeof RISCO_COLOR] ?? '#10b981'
                              const freqColor = filho.frequencia < 60 ? '#ef4444' : filho.frequencia < 75 ? '#f59e0b' : '#10b981'
                              const freqPct = Math.min(100, Math.max(0, filho.frequencia))
                              return (
                                <div
                                  key={filho.id}
                                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:'hsl(var(--bg-elevated))', border:`1px solid ${rc2}20`, borderLeft:`3px solid ${rc2}`, transition:'background 0.15s' }}
                                  onClick={e => e.stopPropagation()}
                                  onMouseEnter={e => (e.currentTarget as any).style.background='hsl(var(--bg-overlay))'}
                                  onMouseLeave={e => (e.currentTarget as any).style.background='hsl(var(--bg-elevated))'}
                                >
                                  {/* Avatar Expanded / Ultra Premium */}
                                  <div style={{
                                    width:48, height:48, borderRadius:12, flexShrink:0,
                                    background:`linear-gradient(135deg, ${rc2}20, ${rc2}05)`,
                                    border:`2px solid ${rc2}30`,
                                    boxShadow:`0 4px 10px rgba(0,0,0,0.05), inset 0 2px 4px rgba(255,255,255,0.2)`,
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:13, fontWeight:900, color:rc2, fontFamily:'Outfit,sans-serif',
                                    overflow:'hidden'
                                  }}>
                                    {(filho as any).foto ? (
                                      <img src={(filho as any).foto} alt={filho.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    ) : (
                                      getInitials(filho.nome)
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{filho.nome}</div>
                                    {(filho.turma || filho.serie) && (
                                      <div style={{ fontSize:9, color:'hsl(var(--text-muted))', display:'flex', alignItems:'center', gap:6 }}>
                                        {filho.turma && <span>{filho.turma}</span>}
                                        {filho.turma && filho.serie && <span style={{ opacity:.4 }}>·</span>}
                                        {filho.serie && <span>{filho.serie}</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Freq bar + badge */}
                                  <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                      <span style={{ fontSize:11, fontWeight:800, color:freqColor }}>{filho.frequencia}%</span>
                                      {filho.inadimplente && (
                                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#f87171', fontWeight:800, border:'1px solid rgba(239,68,68,0.2)' }}>$</span>
                                      )}
                                    </div>
                                    {/* Mini freq bar */}
                                    <div style={{ width:52, height:3, borderRadius:3, background:'rgba(0,0,0,0.08)' }}>
                                      <div style={{ width:`${freqPct}%`, height:'100%', borderRadius:3, background:freqColor, transition:'width 0.5s ease' }}/>
                                    </div>
                                  </div>

                                  {/* Ficha link */}
                                  <Link
                                    href={`/academico/alunos/ficha?id=${filho.id}`}
                                    onClick={e => e.stopPropagation()}
                                    style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'hsl(var(--text-muted))', textDecoration:'none', padding:'4px 8px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))', transition:'all 0.15s', flexShrink:0 }}
                                    onMouseEnter={e => { (e.currentTarget as any).style.borderColor=rc2; (e.currentTarget as any).style.color=rc2 }}
                                    onMouseLeave={e => { (e.currentTarget as any).style.borderColor=''; (e.currentTarget as any).style.color='' }}
                                  >
                                    <ExternalLink size={9}/> Ficha
                                  </Link>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Action Bar ── */}
                    <div style={{ display:'flex', gap:0, borderTop:`1px solid ${accentColor}15`, background:`${accentColor}05` }}>
                      <button
                        className="resp-action-btn"
                        onClick={e => { e.stopPropagation(); window.open(`tel:${resp.telefone}`) }}
                        disabled={resp.telefone === 'Não informado'}
                        style={{ flex:1, padding:'11px 0', border:'none', background:'none', cursor: resp.telefone === 'Não informado' ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:11, fontWeight:700, color: resp.telefone === 'Não informado' ? 'hsl(var(--text-muted))' : '#60a5fa', borderRight:'1px solid hsl(var(--border-subtle))' }}
                      >
                        <Phone size={12}/> Ligar
                      </button>
                      <button
                        className="resp-action-btn"
                        onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${resp.telefone.replace(/\D/g, '')}`) }}
                        disabled={resp.telefone === 'Não informado'}
                        style={{ flex:1, padding:'11px 0', border:'none', background:'none', cursor: resp.telefone === 'Não informado' ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:11, fontWeight:700, color: resp.telefone === 'Não informado' ? 'hsl(var(--text-muted))' : '#34d399', borderRight:'1px solid hsl(var(--border-subtle))' }}
                      >
                        <MessageSquare size={12}/> WhatsApp
                      </button>
                      <button
                        className="resp-action-btn"
                        onClick={e => { e.stopPropagation(); resp.email && window.open(`mailto:${resp.email}`) }}
                        disabled={!resp.email}
                        style={{ flex:1, padding:'11px 0', border:'none', background:'none', cursor: !resp.email ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:11, fontWeight:700, color: resp.email ? '#a78bfa' : 'hsl(var(--text-muted))', borderRight: resp.inadimplente ? '1px solid hsl(var(--border-subtle))' : 'none' }}
                      >
                        <Mail size={12}/> E-mail
                      </button>
                      {resp.inadimplente && (
                        <Link
                          href="/financeiro/inadimplencia"
                          onClick={e => e.stopPropagation()}
                          style={{ flex:1, padding:'11px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:11, fontWeight:800, color:'#f87171', textDecoration:'none', background:'rgba(239,68,68,0.05)', transition:'all 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as any).style.background='rgba(239,68,68,0.12)'}
                          onMouseLeave={e => (e.currentTarget as any).style.background='rgba(239,68,68,0.05)'}
                        >
                          <Wallet size={12}/> Cobrar
                        </Link>
                      )}
                    </div>
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
              <div style={{ display: 'flex', gap: 10 }}>
                 <button className="btn btn-ghost" onClick={() => { setShowCadastroModal(true); setResponsavelEdicao(selecionado._raw); setSelecionado(null); }}>
                    <Edit size={16}/> Editar
                 </button>
                 <button className="btn btn-ghost btn-icon" onClick={() => setSelecionado(null)}><X size={16}/></button>
              </div>
            </div>

            <div className="card" style={{ padding:'16px', marginBottom:16, background:'hsl(var(--bg-elevated))' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Dados do Responsável</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:<User size={14}/>, label:'ID do Responsável / Código', value: selecionado.codigo || selecionado.id || 'Não informado' },
                  { icon:<Shield size={14}/>, label:'RFID / Acesso', value: selecionado.rfid || 'Não cadastrado' },
                  { icon:<BookOpen size={14}/>, label:'CPF / RG', value: `${selecionado.cpf||'Não informado'} ${selecionado.rg ? `| RG: ${selecionado.rg}` : ''}` },
                  { icon:<Phone size={14}/>, label:'Telefone / WhatsApp', value:selecionado.telefone },
                  { icon:<Mail size={14}/>, label:'E-mail', value:selecionado.email||'Não informado' },
                  { icon:<User size={14}/>, label:'Profissão', value: selecionado.profissao, hide: !selecionado.profissao },
                  { icon:<MapPin size={14}/>, label:'Endereço', value: selecionado.enderecoStr, hide: !selecionado.enderecoStr },
                ].filter(i=>!i.hide).map(item => (
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

      <CadastroResponsavelModal 
         isOpen={showCadastroModal}
         onClose={() => { setShowCadastroModal(false); setResponsavelEdicao(null); }}
         responsavelInicial={responsavelEdicao}
         onSaved={(saved) => {
            setShowCadastroModal(false)
            setResponsavelEdicao(null)

            // 1. Atualiza a lista base (KPIs e filtros)
            setResponsaveisRaw(prev => {
              const exists = (prev || []).some((r: any) => r.id === saved.id)
              if (exists) return (prev || []).map((r: any) => r.id === saved.id ? { ...r, ...saved } : r)
              return [saved, ...(prev || [])]
            })

            // 2. Atualiza em tempo real os resultados da busca ativa
            if (search.length >= 3) {
              setSearchResults(prev => {
                const exists = prev.some(r => r.id === saved.id)
                const updated = exists
                  ? prev.map(r => r.id === saved.id ? transformResp({ ...r._raw, ...saved } as any) : r)
                  : [transformResp(saved), ...prev]
                return updated
              })
            }
         }}
         onDeleted={(id) => {
            setShowCadastroModal(false)
            setResponsavelEdicao(null)

            // 1. Remove da lista base
            setResponsaveisRaw(prev => (prev || []).filter((r: any) => r.id !== id))

            // 2. Remove em tempo real dos resultados da busca ativa
            setSearchResults(prev => prev.filter(r => r.id !== id))
         }}
      />
    </div>
  )
}


