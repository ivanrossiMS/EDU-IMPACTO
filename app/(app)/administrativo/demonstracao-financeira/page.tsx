'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  BarChart3, RefreshCw, Download, Printer, Filter, Search, Database,
  TrendingDown, TrendingUp, DollarSign, PieChart as PieIcon, Activity,
  ChevronRight, ChevronDown, List, Building2, Wallet, Trash2, AlertTriangle,
  ChevronsUpDown, ArrowUp, ArrowDown, Target, Zap, Eye, RotateCcw,
  Calendar, Layers, FileSpreadsheet, Shield, BookOpen, X, Info, Clock
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useData } from '@/lib/dataContext'
import { DemonstracaoRawRow, buildDemonstracaoTree, VisionMode, DateBase, DemNode } from '@/lib/financialReports'
import { DemonstracaoDrillDownModal } from '@/components/financeiro/DemonstracaoDrillDownModal'
import { hoje } from '@/lib/dateUtils'

// ─── Formatadores ────────────────────────────────────────────────────────────
const fmt   = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const fmtK  = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : fmt(v)
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
const parseDateBR = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CORES_REC  = '#10b981'
const CORES_DESP = '#f43f5e'
const CORES_SALDO= '#6366f1'
const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, icon: Icon, color, onClick }:
  { label:string; value:string; sub?:string; trend?:number; icon:any; color:string; onClick?:()=>void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'hsl(var(--bg-elevated))', borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px',
        cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s',
        position: 'relative', overflow: 'hidden'
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: color, borderRadius:'16px 16px 0 0'}} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
          <div style={{ fontSize:24, fontWeight:900, fontFamily:'Outfit,sans-serif', color:'hsl(var(--text-primary))' }}>{value}</div>
          {sub && <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ width:44, height:44, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={22} color={color} />
        </div>
      </div>
      {trend !== undefined && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:12, fontSize:12, fontWeight:700,
          color: trend >= 0 ? '#10b981' : '#f43f5e' }}>
          {trend >= 0 ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}
          {Math.abs(trend).toFixed(1)}% vs período anterior
        </div>
      )}
    </div>
  )
}

// ─── Tooltip customizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))',
      borderRadius:10, padding:'10px 14px', fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'hsl(var(--text-primary))' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:p.color, display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block'}}/>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Nó da árvore analítica ──────────────────────────────────────────────────
function TreeNode({ node, depth, colKeys, mode, onDrill, totalRef }:
  { node: DemNode; depth: number; colKeys: string[]; mode: VisionMode; onDrill:(rows:DemonstracaoRawRow[],label:string)=>void; totalRef:number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSintetico = node.tipo === 'sintetico'
  const isReceita   = node.grupoConta === 'receitas'
  const pct         = totalRef > 0 ? (Math.abs(node.total) / totalRef) * 100 : 0

  return (
    <>
      <tr
        onClick={() => hasChildren ? setOpen(!open) : onDrill(node.rows, node.descricao)}
        style={{
          cursor: 'pointer',
          background: depth === 0 ? 'hsl(var(--bg-overlay))' : undefined,
          borderBottom: '1px solid hsl(var(--border-subtle))',
          transition: 'background 0.1s'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
        onMouseLeave={e => (e.currentTarget.style.background = depth===0 ? 'hsl(var(--bg-overlay))' : 'transparent')}
      >
        {/* Descrição */}
        <td style={{ padding:`${depth === 0 ? 8 : 4}px 6px`, paddingLeft: 6 + depth * 12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {hasChildren
              ? (open ? <ChevronDown size={14} color="#6366f1"/> : <ChevronRight size={14} color="#6366f1"/>)
              : <div style={{ width:14 }}/>}
            <span style={{
              fontSize: depth === 0 ? 12 : 11,
              fontWeight: isSintetico ? 700 : 400,
              color: depth === 0 ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))'
            }}>{node.codPlano} — {node.descricao}</span>
          </div>
        </td>
        {/* Colunas temporais */}
        {colKeys.map(k => {
          const v = node.totaisPeriodos[k]?.total || 0
          return (
            <td key={k} style={{ textAlign:'right', padding:'4px 4px', fontSize:11,
              fontWeight: isSintetico ? 700 : 400, color: v < 0 ? '#f43f5e' : 'hsl(var(--text-secondary))' }}>
              {v !== 0 ? fmtNum(v) : <span style={{ color:'hsl(var(--text-muted))', opacity:0.4 }}>—</span>}
            </td>
          )
        })}
        {/* Total */}
        <td style={{ textAlign:'right', padding:'4px 8px', fontWeight:800, fontSize:12,
          color: node.total < 0 ? '#f43f5e' : isReceita ? '#10b981' : '#f43f5e' }}>
          {fmt(node.total)}
        </td>
        {/* % do total */}
        <td style={{ textAlign:'right', padding:'4px 8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
            <span style={{ fontSize:10, color:'hsl(var(--text-muted))', width:28, textAlign:'right' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </td>
      </tr>
      {open && hasChildren && node.children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth+1} colKeys={colKeys} mode={mode} onDrill={onDrill} totalRef={totalRef} />
      ))}
    </>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function DemonstracaoFinanceiraPage() {
  const { cfgPlanoContas = [], movimentacoesManuais = [] } = useData()
  const printRef = useRef<HTMLDivElement>(null)

  // ── Estado base ───────────────────────────────────────────────────────────
  const anoAtual = new Date().getFullYear()
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
  const triAtual = Math.ceil((new Date().getMonth() + 1) / 3)

  const [anoServer, setAnoServer]       = useState(anoAtual)
  const [baseServer, setBaseServer]     = useState<DateBase>('vencimento')
  const [loading, setLoading]           = useState(false)
  const [rawRows, setRawRows]           = useState<DemonstracaoRawRow[]>([])

  // ── Visão e Filtros ───────────────────────────────────────────────────────
  const [modoVisao, setModoVisao]       = useState<VisionMode>('anual')
  const [mesAnoLocal, setMesAnoLocal]   = useState(`${anoAtual}-${mesAtual}`)
  const [triLocal, setTriLocal]         = useState(triAtual)
  const [filterTipo, setFilterTipo]     = useState<'todos'|'receitas'|'despesas'>('todos')
  const [filterStatus, setFilterStatus] = useState<'todos'|'pago'|'pendente'>('todos')
  const [search, setSearch]             = useState('')

  // ── Tabs e UI ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<'dre'|'grafico'|'fluxo'|'raw'>('dre')
  const [chartType, setChartType]       = useState<'bar'|'area'|'pie'>('bar')
  const [reconciling, setReconciling]   = useState(false)
  const [reconcileMsg, setReconcileMsg] = useState<{type:'ok'|'err', msg:string}|null>(null)
  const [showFilters, setShowFilters]   = useState(false)
  const [expandAll, setExpandAll]       = useState(false)
  
  // Pagination Raw Tab
  const [rawPage, setRawPage]           = useState(1)
  const [rawLimit, setRawLimit]         = useState(20)

  // ── Drill down ────────────────────────────────────────────────────────────
  const [drillInfo, setDrillInfo] = useState<{
    isOpen:boolean; title:string; subtitle:string; rows:DemonstracaoRawRow[]
  }>({ isOpen:false, title:'', subtitle:'', rows:[] })

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAno = useCallback(async (ano: number, base: DateBase) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/relatorios/demonstracao?inicio=${ano}-01-01&fim=${ano}-12-31&por=${base}`)
      const data = await res.json()
      if (data.success) setRawRows(data.rows)
      else console.error('DRE fetch error:', data.error)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAno(anoServer, baseServer) }, [anoServer, baseServer, fetchAno])

  // ── Filtragem client-side ─────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = rawRows
    if (filterTipo === 'receitas') list = list.filter(r => r.tipo === 'receita')
    if (filterTipo === 'despesas') list = list.filter(r => r.tipo === 'despesa')
    if (filterStatus === 'pago')    list = list.filter(r => r.status === 'pago')
    if (filterStatus === 'pendente') list = list.filter(r => r.status !== 'pago' && r.status !== 'cancelado')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.descricao.toLowerCase().includes(q) || (r.alunoResponsavel||'').toLowerCase().includes(q))
    }
    return list
  }, [rawRows, filterTipo, filterStatus, search])

  // Reset page when filters change
  useEffect(() => {
    setRawPage(1)
  }, [filterTipo, filterStatus, search])

  // ── Árvore DRE ────────────────────────────────────────────────────────────
  const tree = useMemo(() => buildDemonstracaoTree(
    filteredRows, cfgPlanoContas, baseServer, modoVisao, mesAnoLocal, anoServer, triLocal
  ), [filteredRows, cfgPlanoContas, baseServer, modoVisao, mesAnoLocal, anoServer, triLocal])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let rec = 0, desp = 0, pendRec = 0, pendDesp = 0, qtd = 0
    filteredRows.forEach(r => {
      if (r.status === 'cancelado') return
      
      const refDate = baseServer === 'pagamento' 
        ? (r.dataPagamento || r.dataVencimento || '') 
        : baseServer === 'competencia' 
          ? (r.dataCompetencia || r.dataVencimento || '') 
          : (r.dataVencimento || '')

      if (!refDate) return
      
      const yr = parseInt(refDate.substring(0,4))
      const mo = parseInt(refDate.substring(5,7))
      
      let inside = true
      if (modoVisao === 'anual' && yr !== anoServer) inside = false
      if (modoVisao === 'trimestral' && (yr !== anoServer || Math.ceil(mo/3) !== triLocal)) inside = false
      if (modoVisao === 'mensal' && refDate.substring(0,7) !== mesAnoLocal) inside = false
      if (!inside) return
      
      qtd++
      
      const isPago = r.status === 'pago'
      const val = (baseServer === 'pagamento' && isPago) ? r.valorPago : r.valorEsperado
      
      if (r.tipo === 'receita') {
        if (isPago) rec += val
        else pendRec += val
      } else {
        if (isPago) desp += val
        else pendDesp += val
      }
    })
    const saldo   = rec - desp
    const margem  = rec > 0 ? (saldo / rec) * 100 : 0
    const inadimp = (rec + pendRec) > 0 ? (pendRec / (rec + pendRec)) * 100 : 0
    return { rec, desp, saldo, margem, pendRec, pendDesp, qtd, inadimp }
  }, [filteredRows, baseServer, modoVisao, anoServer, triLocal, mesAnoLocal])

  // ── Dados para gráfico mensal ─────────────────────────────────────────────
  const chartData = useMemo(() => {
    const map: Record<string, { mes:string; receitas:number; despesas:number; saldo:number }> = {}
    for (let i=1; i<=12; i++) {
      const k = String(i).padStart(2,'0')
      map[k] = { mes: MESES[i-1], receitas:0, despesas:0, saldo:0 }
    }
    filteredRows.forEach(r => {
      if (r.status === 'cancelado') return
      
      const d = baseServer === 'pagamento' 
        ? (r.dataPagamento || r.dataVencimento || '') 
        : baseServer === 'competencia'
          ? (r.dataCompetencia || r.dataVencimento || '')
          : (r.dataVencimento || '')
          
      if (!d || parseInt(d.substring(0,4)) !== anoServer) return
      const mo = d.substring(5,7)
      
      const val = (baseServer === 'pagamento' && r.status === 'pago') ? r.valorPago : r.valorEsperado
      
      if (r.tipo === 'receita') map[mo].receitas += val
      else map[mo].despesas += val
      map[mo].saldo = map[mo].receitas - map[mo].despesas
    })
    return Object.values(map)
  }, [filteredRows, baseServer, anoServer])

  // ── Dados para gráfico pizza por plano de contas ──────────────────────────
  const pieData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRows.forEach(r => {
      if (r.status === 'cancelado') return
      const k = r.planoContasId || 'Sem Classificação'
      const v = (baseServer === 'pagamento' && r.status === 'pago') ? r.valorPago : r.valorEsperado
      map[k] = (map[k]||0) + v
    })
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .slice(0,8)
      .map(([name, value]) => ({ name, value }))
  }, [filteredRows, baseServer])

  // ── Colunas dinâmicas para a tabela ──────────────────────────────────────
  const colKeys = useMemo(() => {
    if (modoVisao === 'anual') return ['01','02','03','04','05','06','07','08','09','10','11','12']
    if (modoVisao === 'trimestral') {
      const base = (triLocal-1)*3
      return [String(base+1), String(base+2), String(base+3)]
    }
    return ['current']
  }, [modoVisao, triLocal])

  const colHeaders = useMemo(() => {
    if (modoVisao === 'anual') return MESES
    if (modoVisao === 'trimestral') {
      const base = (triLocal-1)*3
      return [MESES[base], MESES[base+1], MESES[base+2]]
    }
    return [mesAnoLocal]
  }, [modoVisao, triLocal, mesAnoLocal])

  // ── Nós de receitas e despesas da árvore ─────────────────────────────────
  const recNodes  = tree.filter(n => n.grupoConta === 'receitas')
  const despNodes = tree.filter(n => n.grupoConta === 'despesas' || n.grupoConta === 'investimentos')
  const maxVal    = Math.max(kpis.rec, kpis.desp, 1)

  // ── Drill handler ─────────────────────────────────────────────────────────
  const handleDrill = (rows: DemonstracaoRawRow[], subtitle: string) => {
    if (!rows.length) return
    setDrillInfo({ isOpen:true, title:'Auditoria de Lançamentos', subtitle, rows })
  }

  // ── Reconciliação ─────────────────────────────────────────────────────────
  const handleReconciliar = async (modo: 'inteligente'|'nuclear') => {
    if (modo === 'nuclear' && !confirm('⚠️ PURGE TOTAL: Apagar TODAS as movimentações automáticas de baixa?\n\nEsta ação não pode ser desfeita. Use apenas como último recurso.')) return
    setReconciling(true); setReconcileMsg(null)
    try {
      const res  = await fetch('/api/financeiro/reconciliar', { method: modo === 'nuclear' ? 'DELETE' : 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const msg = modo === 'nuclear'
        ? `Purge concluído — ${data.deleted} movimentações removidas.`
        : data.deleted === 0
          ? `Nenhum lançamento órfão — dados limpos! (${data.totalBaixas} baixas verificadas)`
          : `${data.deleted} lançamento(s) órfão(s) removidos. ${data.kept} mantidos.`
      setReconcileMsg({ type:'ok', msg })
      await fetchAno(anoServer, baseServer)
    } catch(e:any) {
      setReconcileMsg({ type:'err', msg: e.message })
    } finally { setReconciling(false) }
  }

  // ── Exportação Excel (lazy-loaded ~300KB only when needed) ──────────────
  const handleExcel = async () => {
    if (!filteredRows.length) return
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(filteredRows.map(r => ({
      ORIGEM: r.origem.toUpperCase(),
      TIPO: r.tipo.toUpperCase(),
      DESCRIÇÃO: r.descricao,
      PARTE_RELACIONADA: r.alunoResponsavel,
      VALOR_ESPERADO: r.valorEsperado,
      VALOR_EFETIVADO: r.valorPago,
      VENCIMENTO: r.dataVencimento,
      PAGAMENTO: r.dataPagamento || '-',
      STATUS: r.status.toUpperCase(),
      FORMA_PAGTO: r.formaPagamento || '-',
      DOCUMENTO: r.documento || '-',
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    const resumo = XLSX.utils.json_to_sheet([
      { INDICADOR: 'Total Receitas',     VALOR: kpis.rec },
      { INDICADOR: 'Total Despesas',     VALOR: kpis.desp },
      { INDICADOR: 'Resultado Líquido',  VALOR: kpis.saldo },
      { INDICADOR: 'Margem Líquida',     VALOR: `${kpis.margem.toFixed(2)}%` },
      { INDICADOR: 'A Receber',          VALOR: kpis.pendRec },
      { INDICADOR: 'A Pagar',            VALOR: kpis.pendDesp },
      { INDICADOR: 'Inadimplência',      VALOR: `${kpis.inadimp.toFixed(2)}%` },
    ])
    XLSX.utils.book_append_sheet(wb, resumo, 'Resumo Executivo')
    XLSX.writeFile(wb, `DRE_${anoServer}_${hoje()}.xlsx`)
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print()

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={printRef} style={{ minHeight:'100vh', background:'hsl(var(--bg-base))', padding:'24px', maxWidth:1600, margin:'0 auto' }}>

      {/* ══ CABEÇALHO ═════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <BarChart3 size={18} color="#fff"/>
              </div>
              <h1 style={{ fontSize:22, fontWeight:900, fontFamily:'Outfit,sans-serif', color:'hsl(var(--text-primary))', margin:0 }}>
                Demonstração Financeira
              </h1>
              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(99,102,241,0.12)',
                color:'#6366f1', fontWeight:700, border:'1px solid rgba(99,102,241,0.2)' }}>DRE</span>
            </div>
            <p style={{ margin:0, fontSize:13, color:'hsl(var(--text-muted))' }}>
              Relatório gerencial de resultado — visão unificada de receitas, despesas e fluxo
            </p>
          </div>

          {/* Ações top */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }} className="print-hide">
            <button onClick={() => fetchAno(anoServer, baseServer)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8,
                border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-elevated))',
                color:'hsl(var(--text-secondary))', cursor:'pointer', fontSize:13 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Atualizar
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8,
                border:`1px solid ${showFilters ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
                background: showFilters ? 'rgba(99,102,241,0.1)' : 'hsl(var(--bg-elevated))',
                color: showFilters ? '#6366f1' : 'hsl(var(--text-secondary))', cursor:'pointer', fontSize:13 }}>
              <Filter size={14}/> Filtros
            </button>
            <button onClick={handleExcel}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8,
                border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-elevated))',
                color:'hsl(var(--text-secondary))', cursor:'pointer', fontSize:13 }}>
              <FileSpreadsheet size={14}/> Excel
            </button>
            <button onClick={handlePrint}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8,
                background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none',
                cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 4px 12px rgba(99,102,241,0.3)' }}>
              <Printer size={14}/> Imprimir DRE
            </button>
          </div>
        </div>
      </div>

      {/* ══ PAINEL DE CONTROLES ═══════════════════════════════════════════════ */}
      <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
        border:'1px solid hsl(var(--border-subtle))', padding:'16px 20px', marginBottom:20 }}
        className="print-hide">
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>

          {/* Ano */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Ano</label>
            <div style={{ display:'flex', gap:4 }}>
              {[anoAtual-2, anoAtual-1, anoAtual].map(a => (
                <button key={a} onClick={() => setAnoServer(a)}
                  style={{ padding:'6px 12px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))',
                    background: anoServer === a ? '#6366f1' : 'hsl(var(--bg-base))',
                    color: anoServer === a ? '#fff' : 'hsl(var(--text-secondary))',
                    fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Regime */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Regime</label>
            <div style={{ display:'flex', gap:4 }}>
              {[['vencimento','Competência'],['pagamento','Caixa']] .map(([val, lbl]) => (
                <button key={val} onClick={() => setBaseServer(val as DateBase)}
                  style={{ padding:'6px 12px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))',
                    background: baseServer === val ? '#6366f1' : 'hsl(var(--bg-base))',
                    color: baseServer === val ? '#fff' : 'hsl(var(--text-secondary))',
                    fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Período</label>
            <div style={{ display:'flex', gap:4 }}>
              {(['anual','trimestral','mensal'] as VisionMode[]).map(v => (
                <button key={v} onClick={() => setModoVisao(v)}
                  style={{ padding:'6px 12px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))',
                    background: modoVisao === v ? '#8b5cf6' : 'hsl(var(--bg-base))',
                    color: modoVisao === v ? '#fff' : 'hsl(var(--text-secondary))',
                    fontWeight:700, fontSize:12, cursor:'pointer', textTransform:'capitalize' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor trimestre/mês */}
          {modoVisao === 'trimestral' && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Trimestre</label>
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4].map(t => (
                  <button key={t} onClick={() => setTriLocal(t)}
                    style={{ padding:'6px 10px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))',
                      background: triLocal === t ? '#8b5cf6' : 'hsl(var(--bg-base))',
                      color: triLocal === t ? '#fff' : 'hsl(var(--text-secondary))',
                      fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    Q{t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {modoVisao === 'mensal' && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Mês</label>
              <input type="month" value={mesAnoLocal} onChange={e => setMesAnoLocal(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:7, border:'1px solid hsl(var(--border-subtle))',
                  background:'hsl(var(--bg-base))', color:'hsl(var(--text-secondary))', fontSize:13 }}/>
            </div>
          )}

          {/* Busca */}
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:4 }}>Busca</label>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar por descrição ou parte relacionada..."
                style={{ width:'100%', padding:'7px 10px 7px 32px', borderRadius:8,
                  border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))',
                  color:'hsl(var(--text-secondary))', fontSize:13, boxSizing:'border-box' }}/>
            </div>
          </div>
        </div>

        {/* Filtros extras */}
        {showFilters && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid hsl(var(--border-subtle))',
            display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:4 }}>
              {[['todos','Todos'],['receitas','Receitas'],['despesas','Despesas']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterTipo(v as any)}
                  style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer',
                    border:'1px solid hsl(var(--border-subtle))',
                    background: filterTipo === v ? (v==='receitas'?'#10b981':v==='despesas'?'#f43f5e':'#6366f1') : 'hsl(var(--bg-base))',
                    color: filterTipo === v ? '#fff' : 'hsl(var(--text-secondary))' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[['todos','Todas Situações'],['pago','Pagas'],['pendente','Pendentes']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterStatus(v as any)}
                  style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer',
                    border:'1px solid hsl(var(--border-subtle))',
                    background: filterStatus === v ? '#6366f1' : 'hsl(var(--bg-base))',
                    color: filterStatus === v ? '#fff' : 'hsl(var(--text-secondary))' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              <button onClick={() => handleReconciliar('inteligente')} disabled={reconciling}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7, fontSize:11,
                  border:'1px solid #f59e0b', background:'rgba(245,158,11,0.08)', color:'#f59e0b',
                  cursor:'pointer', fontWeight:700 }}>
                {reconciling ? <RefreshCw size={12} className="animate-spin"/> : <Shield size={12}/>}
                Reconciliar
              </button>
              <button onClick={() => handleReconciliar('nuclear')} disabled={reconciling}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7, fontSize:11,
                  border:'1px solid #f43f5e', background:'rgba(244,63,94,0.08)', color:'#f43f5e',
                  cursor:'pointer', fontWeight:700 }}>
                <AlertTriangle size={12}/> Purge Total
              </button>
            </div>
          </div>
        )}

        {reconcileMsg && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:600,
            background: reconcileMsg.type==='ok' ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${reconcileMsg.type==='ok' ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
            color: reconcileMsg.type==='ok' ? '#10b981' : '#f43f5e',
            display:'flex', alignItems:'center', gap:6 }}>
            {reconcileMsg.type==='ok' ? '✅' : '❌'} {reconcileMsg.msg}
            <X size={12} style={{ marginLeft:'auto', cursor:'pointer' }} onClick={() => setReconcileMsg(null)}/>
          </div>
        )}
      </div>

      {/* ══ KPI CARDS ═════════════════════════════════════════════════════════ */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:140,
          background:'hsl(var(--bg-elevated))', borderRadius:16, border:'1px solid hsl(var(--border-subtle))', marginBottom:20 }}>
          <RefreshCw size={24} className="animate-spin" style={{ color:'#6366f1' }}/>
          <span style={{ marginLeft:12, color:'hsl(var(--text-muted))', fontSize:14 }}>Carregando demonstração...</span>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:20 }}>
          <KpiCard label="Receitas Efetivadas" value={fmtK(kpis.rec)} sub={`${filteredRows.filter(r=>r.tipo==='receita'&&r.status==='pago').length} lançamentos`} icon={TrendingUp} color={CORES_REC}/>
          <KpiCard label="Despesas Efetivadas" value={fmtK(kpis.desp)} sub={`${filteredRows.filter(r=>r.tipo==='despesa'&&r.status==='pago').length} lançamentos`} icon={TrendingDown} color={CORES_DESP}/>
          <KpiCard label="Resultado Líquido" value={fmtK(kpis.saldo)} sub={`Margem: ${kpis.margem.toFixed(1)}%`} icon={DollarSign} color={kpis.saldo >= 0 ? CORES_SALDO : CORES_DESP}/>
          <KpiCard label="A Receber" value={fmtK(kpis.pendRec)} sub="Receitas pendentes" icon={Clock} color="#f59e0b"/>
          <KpiCard label="A Pagar" value={fmtK(kpis.pendDesp)} sub="Despesas pendentes" icon={Wallet} color="#ec4899"/>
          <KpiCard label="Inadimplência" value={`${kpis.inadimp.toFixed(1)}%`} sub={`${fmt(kpis.pendRec)} em aberto`} icon={AlertTriangle} color={kpis.inadimp > 10 ? '#f43f5e' : '#f59e0b'}/>
        </div>
      )}

      {/* ══ BARRA DE RESULTADO VISUAL ══════════════════════════════════════════ */}
      {!loading && (
        <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
          border:'1px solid hsl(var(--border-subtle))', padding:'16px 24px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'hsl(var(--text-muted))' }}>Receitas</span>
            <span style={{ fontSize:12, fontWeight:700, color:'hsl(var(--text-muted))' }}>Despesas</span>
          </div>
          <div style={{ display:'flex', height:10, borderRadius:8, overflow:'hidden', gap:2 }}>
            <div style={{ flex: kpis.rec / maxVal, background:'linear-gradient(90deg,#10b981,#34d399)', minWidth:2 }}/>
            <div style={{ flex: (maxVal - kpis.rec - kpis.desp < 0 ? 0 : maxVal - kpis.rec - kpis.desp) / maxVal, background:'hsl(var(--bg-overlay))' }}/>
            <div style={{ flex: kpis.desp / maxVal, background:'linear-gradient(90deg,#fb7185,#f43f5e)', minWidth:2 }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12 }}>
            <span style={{ color:'#10b981', fontWeight:700 }}>{fmt(kpis.rec)}</span>
            <span style={{ fontWeight:900, color: kpis.saldo >= 0 ? '#6366f1' : '#f43f5e', fontSize:14 }}>
              {kpis.saldo >= 0 ? '▲' : '▼'} {fmt(Math.abs(kpis.saldo))} ({kpis.margem >= 0 ? '+' : ''}{kpis.margem.toFixed(1)}%)
            </span>
            <span style={{ color:'#f43f5e', fontWeight:700 }}>{fmt(kpis.desp)}</span>
          </div>
        </div>
      )}

      {/* ══ TABS ══════════════════════════════════════════════════════════════ */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }} className="print-hide">
        {([
          ['dre','DRE Analítica', BookOpen],
          ['grafico','Gráficos', BarChart3],
          ['fluxo','Fluxo Mensal', Activity],
          ['raw','Lançamentos (Raw)', List],
        ] as [string,string,any][]).map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10,
              border: activeTab === tab ? '1.5px solid #6366f1' : '1px solid hsl(var(--border-subtle))',
              background: activeTab === tab ? 'rgba(99,102,241,0.1)' : 'hsl(var(--bg-elevated))',
              color: activeTab === tab ? '#6366f1' : 'hsl(var(--text-muted))',
              cursor:'pointer', fontSize:13, fontWeight: activeTab === tab ? 700 : 500 }}>
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {/* ══ TAB: DRE ANALÍTICA ════════════════════════════════════════════════ */}
      {activeTab === 'dre' && (
        <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
          border:'1px solid hsl(var(--border-subtle))', overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <RefreshCw size={20} className="animate-spin" style={{ color:'#6366f1', marginBottom:8 }}/>
              <div>Construindo árvore analítica...</div>
            </div>
          ) : tree.length === 0 ? (
            <div style={{ padding:60, textAlign:'center', color:'hsl(var(--text-muted))' }}>
              <Database size={40} style={{ margin:'0 auto 12px', opacity:0.3 }}/>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Nenhum dado no período</div>
              <div style={{ fontSize:13 }}>Ajuste os filtros ou aguarde a sincronização dos dados.</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                    <th style={{ padding:'8px 8px', textAlign:'left', fontSize:10, fontWeight:700,
                      color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em',
                      borderBottom:'2px solid hsl(var(--border-subtle))' }}>
                      Plano de Contas / Descrição
                    </th>
                    {colHeaders.map((h, i) => (
                      <th key={i} style={{ padding:'8px 4px', textAlign:'right', fontSize:10, fontWeight:700,
                        color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em',
                        borderBottom:'2px solid hsl(var(--border-subtle))' }}>{h}</th>
                    ))}
                    <th style={{ padding:'8px 8px', textAlign:'right', fontSize:10, fontWeight:700,
                      color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em',
                      borderBottom:'2px solid hsl(var(--border-subtle))' }}>TOTAL</th>
                    <th style={{ padding:'8px 8px', textAlign:'right', fontSize:10, fontWeight:700,
                      color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.08em',
                      borderBottom:'2px solid hsl(var(--border-subtle))' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {/* RECEITAS */}
                  <tr style={{ background:'rgba(16,185,129,0.06)' }}>
                    <td colSpan={colKeys.length + 3} style={{ padding:'10px 16px', fontSize:11, fontWeight:800,
                      color:'#10b981', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                      ▲  RECEITAS
                    </td>
                  </tr>
                  {recNodes.map(n => <TreeNode key={n.id} node={n} depth={0} colKeys={colKeys} mode={modoVisao} onDrill={handleDrill} totalRef={kpis.rec || 1}/>)}

                  {/* Subtotal Receitas */}
                  <tr style={{ background:'rgba(16,185,129,0.1)', borderTop:'2px solid rgba(16,185,129,0.3)' }}>
                    <td style={{ padding:'8px 8px', fontWeight:900, color:'#10b981', fontSize:12 }}>TOTAL RECEITAS</td>
                    {colKeys.map(k => {
                      const v = recNodes.reduce((s,n) => s + (n.totaisPeriodos[k]?.total||0), 0)
                      return <td key={k} style={{ textAlign:'right', padding:'8px 4px', fontWeight:700, color:'#10b981', fontSize:11 }}>{v?fmtNum(v):'—'}</td>
                    })}
                    <td style={{ textAlign:'right', padding:'11px 12px', fontWeight:900, color:'#10b981', fontSize:14 }}>{fmt(kpis.rec)}</td>
                    <td/>
                  </tr>

                  {/* DESPESAS */}
                  <tr style={{ background:'rgba(244,63,94,0.06)' }}>
                    <td colSpan={colKeys.length + 3} style={{ padding:'10px 16px', fontSize:11, fontWeight:800,
                      color:'#f43f5e', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                      ▼  DESPESAS E INVESTIMENTOS
                    </td>
                  </tr>
                  {despNodes.map(n => <TreeNode key={n.id} node={n} depth={0} colKeys={colKeys} mode={modoVisao} onDrill={handleDrill} totalRef={kpis.desp || 1}/>)}

                  {/* Subtotal Despesas */}
                  <tr style={{ background:'rgba(244,63,94,0.1)', borderTop:'2px solid rgba(244,63,94,0.3)' }}>
                    <td style={{ padding:'8px 8px', fontWeight:900, color:'#f43f5e', fontSize:12 }}>TOTAL DESPESAS</td>
                    {colKeys.map(k => {
                      const v = despNodes.reduce((s,n) => s + (n.totaisPeriodos[k]?.total||0), 0)
                      return <td key={k} style={{ textAlign:'right', padding:'8px 4px', fontWeight:700, color:'#f43f5e', fontSize:11 }}>{v?fmtNum(v):'—'}</td>
                    })}
                    <td style={{ textAlign:'right', padding:'11px 12px', fontWeight:900, color:'#f43f5e', fontSize:14 }}>{fmt(kpis.desp)}</td>
                    <td/>
                  </tr>

                  {/* RESULTADO LÍQUIDO */}
                  <tr style={{ background: kpis.saldo >= 0 ? 'rgba(99,102,241,0.1)' : 'rgba(244,63,94,0.15)',
                    borderTop:'2px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding:'10px 8px', fontWeight:900, fontSize:13, fontFamily:'Outfit,sans-serif',
                      color: kpis.saldo >= 0 ? '#6366f1' : '#f43f5e' }}>
                      {kpis.saldo >= 0 ? '📈 RESULTADO LÍQUIDO POSITIVO' : '📉 RESULTADO LÍQUIDO NEGATIVO'}
                    </td>
                    {colKeys.map(k => {
                      const r = recNodes.reduce((s,n) => s + (n.totaisPeriodos[k]?.total||0), 0)
                      const d = despNodes.reduce((s,n) => s + (n.totaisPeriodos[k]?.total||0), 0)
                      const s = r - d
                      return <td key={k} style={{ textAlign:'right', padding:'10px 4px', fontWeight:900, fontSize:12,
                        color: s >= 0 ? '#6366f1' : '#f43f5e' }}>{s !== 0 ? fmtNum(s) : '—'}</td>
                    })}
                    <td style={{ textAlign:'right', padding:'14px 12px', fontWeight:900, fontSize:16,
                      color: kpis.saldo >= 0 ? '#6366f1' : '#f43f5e' }}>
                      {fmt(kpis.saldo)}
                    </td>
                    <td style={{ textAlign:'right', padding:'14px 12px', fontWeight:800, fontSize:13,
                      color: kpis.margem >= 0 ? '#6366f1' : '#f43f5e' }}>
                      {kpis.margem.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: GRÁFICOS ═════════════════════════════════════════════════════ */}
      {activeTab === 'grafico' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Comparativo Receita x Despesa mensal */}
          <div style={{ gridColumn:'1/-1', background:'hsl(var(--bg-elevated))', borderRadius:16,
            border:'1px solid hsl(var(--border-subtle))', padding:'20px 24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:'hsl(var(--text-primary))' }}>Receitas × Despesas × Resultado</div>
                <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Evolução mensal em {anoServer}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[['bar','Barras',BarChart3],['area','Área',Activity]].map(([t,l,Ic]:any) => (
                  <button key={t} onClick={() => setChartType(t)}
                    style={{ padding:'5px 10px', borderRadius:6, border:'1px solid hsl(var(--border-subtle))',
                      background: chartType===t ? '#6366f1' : 'hsl(var(--bg-base))',
                      color: chartType===t ? '#fff' : 'hsl(var(--text-muted))',
                      cursor:'pointer', fontSize:12 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top:5, right:20, bottom:5, left:20 }}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false}/>
                  <XAxis dataKey="mes" tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend/>
                  <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" fill="url(#gRec)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#f43f5e" fill="url(#gDesp)" strokeWidth={2}/>
                  <Line type="monotone" dataKey="saldo" name="Resultado" stroke="#6366f1" strokeWidth={2.5} dot={false}/>
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top:5, right:20, bottom:5, left:20 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false}/>
                  <XAxis dataKey="mes" tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend/>
                  <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]}/>
                  <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4,4,0,0]}/>
                  <Bar dataKey="saldo" name="Resultado" fill="#6366f1" radius={[4,4,0,0]}/>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Pizza por classificação */}
          <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
            border:'1px solid hsl(var(--border-subtle))', padding:'20px 24px' }}>
            <div style={{ fontWeight:800, fontSize:14, color:'hsl(var(--text-primary))', marginBottom:4 }}>Distribuição por Plano de Contas</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginBottom:16 }}>Top 8 centros de custo / receita</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v:any) => fmt(v)}/>
                <Legend formatter={(v) => v.length > 20 ? v.substring(0,20)+'…' : v}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Margem mensal */}
          <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
            border:'1px solid hsl(var(--border-subtle))', padding:'20px 24px' }}>
            <div style={{ fontWeight:800, fontSize:14, color:'hsl(var(--text-primary))', marginBottom:4 }}>Margem Líquida Mensal</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginBottom:16 }}>% Resultado sobre Receita</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData.map(d => ({
                ...d, margem: d.receitas > 0 ? ((d.receitas-d.despesas)/d.receitas*100) : 0
              }))} margin={{ top:5, right:20, bottom:5, left:10 }}>
                <defs>
                  <linearGradient id="gMargem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false}/>
                <XAxis dataKey="mes" tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v:any) => `${Number(v).toFixed(1)}%`}/>
                <Area type="monotone" dataKey="margem" name="Margem %" stroke="#6366f1" fill="url(#gMargem)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ TAB: FLUXO MENSAL ═════════════════════════════════════════════════ */}
      {activeTab === 'fluxo' && (
        <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
          border:'1px solid hsl(var(--border-subtle))', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid hsl(var(--border-subtle))' }}>
            <div style={{ fontWeight:800, fontSize:15, color:'hsl(var(--text-primary))' }}>Fluxo de Caixa Mensal — {anoServer}</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Saldo acumulado mês a mês baseado em {baseServer === 'pagamento' ? 'caixa' : 'competência'}</div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                  <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Mês</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#10b981', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Entradas</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#f43f5e', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Saídas</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#6366f1', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Resultado</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Acumulado</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'hsl(var(--text-muted))', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em' }}>Margem</th>
                  <th style={{ padding:'10px 12px', borderBottom:'1px solid hsl(var(--border-subtle))' }}/>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let acum = 0
                  return chartData.map((row, i) => {
                    const res = row.receitas - row.despesas
                    acum += res
                    const margem = row.receitas > 0 ? (res / row.receitas * 100) : 0
                    const barPct = Math.min(100, Math.abs(res) / Math.max(...chartData.map(r => Math.abs(r.receitas-r.despesas)), 1) * 100)
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid hsl(var(--border-subtle))' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding:'12px 16px', fontWeight:700, fontSize:13 }}>{MESES[i]}</td>
                        <td style={{ textAlign:'right', padding:'12px', color:'#10b981', fontWeight:600, fontSize:13 }}>{row.receitas > 0 ? fmt(row.receitas) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'12px', color:'#f43f5e', fontWeight:600, fontSize:13 }}>{row.despesas > 0 ? fmt(row.despesas) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'12px', fontWeight:800, fontSize:13, color: res >= 0 ? '#6366f1' : '#f43f5e' }}>
                          {res !== 0 ? (res > 0 ? '+' : '') + fmt(res) : '—'}
                        </td>
                        <td style={{ textAlign:'right', padding:'12px', fontWeight:700, fontSize:13, color: acum >= 0 ? '#10b981' : '#f43f5e' }}>{fmt(acum)}</td>
                        <td style={{ textAlign:'right', padding:'12px', fontSize:12, color: margem >= 0 ? '#6366f1' : '#f43f5e', fontWeight:600 }}>
                          {row.receitas > 0 ? `${margem.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding:'12px', width:100 }}>
                          <div style={{ height:6, borderRadius:3, background:'hsl(var(--bg-overlay))', overflow:'hidden' }}>
                            <div style={{ width:`${barPct}%`, height:'100%', borderRadius:3, background: res >= 0 ? '#6366f1' : '#f43f5e' }}/>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              <tfoot>
                <tr style={{ background:'hsl(var(--bg-overlay))', borderTop:'2px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding:'12px 16px', fontWeight:900, fontSize:13 }}>TOTAL ANUAL</td>
                  <td style={{ textAlign:'right', padding:'12px', color:'#10b981', fontWeight:900, fontSize:14 }}>{fmt(kpis.rec)}</td>
                  <td style={{ textAlign:'right', padding:'12px', color:'#f43f5e', fontWeight:900, fontSize:14 }}>{fmt(kpis.desp)}</td>
                  <td style={{ textAlign:'right', padding:'12px', fontWeight:900, fontSize:14, color: kpis.saldo >= 0 ? '#6366f1' : '#f43f5e' }}>{fmt(kpis.saldo)}</td>
                  <td style={{ textAlign:'right', padding:'12px', fontWeight:900, fontSize:14, color: kpis.saldo >= 0 ? '#10b981' : '#f43f5e' }}>{fmt(kpis.saldo)}</td>
                  <td style={{ textAlign:'right', padding:'12px', fontWeight:900, fontSize:13, color: kpis.margem >= 0 ? '#6366f1' : '#f43f5e' }}>{kpis.margem.toFixed(1)}%</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB: LANÇAMENTOS RAW ══════════════════════════════════════════════ */}
      {activeTab === 'raw' && (
        <div style={{ background:'hsl(var(--bg-elevated))', borderRadius:16,
          border:'1px solid hsl(var(--border-subtle))', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid hsl(var(--border-subtle))',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'hsl(var(--text-secondary))' }}>
              Lançamentos compondo a visão atual: <strong>{filteredRows.length} itens</strong>
            </span>
            <button onClick={handleExcel}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:6,
                border:'1px solid hsl(var(--border-subtle))', background:'transparent',
                color:'hsl(var(--text-muted))', cursor:'pointer', fontSize:12 }}>
              <Download size={12}/> Exportar CSV
            </button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                  {['ORIGEM','ID (DEBUG)','DESCRIÇÃO / REFERÊNCIA','PARTE RELACIONADA','VALOR EFET.','DATA','STATUS'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign: h.includes('VALOR') ? 'right' : 'left',
                      fontSize:10, fontWeight:700, color:'hsl(var(--text-muted))',
                      textTransform:'uppercase', letterSpacing:'0.08em',
                      borderBottom:'1px solid hsl(var(--border-subtle))', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                   const totalPages = Math.ceil(filteredRows.length / rawLimit) || 1
                   // Prevent going out of bounds if filters are applied
                   const currentPage = rawPage > totalPages ? totalPages : rawPage
                   const startIdx = (currentPage - 1) * rawLimit
                   const endIdx = startIdx + rawLimit
                   return filteredRows.slice(startIdx, endIdx).map((r, i) => (
                    <tr key={r.id || i}
                      style={{ borderBottom:'1px solid hsl(var(--border-subtle))', cursor:'pointer' }}
                      onClick={() => handleDrill([r], r.descricao)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding:'9px 12px' }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:700,
                          background: r.origem==='titulo' ? 'rgba(99,102,241,0.1)' : r.origem==='movimentacao' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                          color: r.origem==='titulo' ? '#6366f1' : r.origem==='movimentacao' ? '#10b981' : '#f43f5e' }}>
                          {r.origem.toUpperCase().replace('_',' ')}
                        </span>
                      </td>
                      <td style={{ padding:'9px 12px', fontSize:10, fontFamily:'monospace', color:'hsl(var(--text-muted))', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.idOrigem || r.id}>
                        {(()=>{
                          const str = r.idOrigem || r.id || '';
                          if (str.includes('-') && str.length > 15) {
                            const parts = str.split('-');
                            const last = parts.pop();
                            return `${str.substring(0,6)}..-${last}`;
                          }
                          return str.length > 10 ? `${str.substring(0,10)}..` : str;
                        })()}
                      </td>
                      <td style={{ padding:'9px 12px', maxWidth:320, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'hsl(var(--text-secondary))' }}>
                        {r.descricao}
                      </td>
                      <td style={{ padding:'9px 12px', color:'hsl(var(--text-muted))', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.alunoResponsavel || <span style={{ opacity:0.4 }}>—</span>}
                      </td>
                      <td style={{ textAlign:'right', padding:'9px 12px', fontWeight:700,
                        color: r.tipo==='receita' ? '#10b981' : '#f43f5e' }}>
                        {r.tipo==='receita' ? '+' : '-'}{fmt(r.valorPago || r.valorEsperado)}
                      </td>
                      <td style={{ padding:'9px 12px', color:'hsl(var(--text-muted))', whiteSpace:'nowrap' }}>
                        {parseDateBR(r.dataPagamento || r.dataVencimento)}
                      </td>
                      <td style={{ padding:'9px 12px' }}>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700,
                          background: r.status==='pago' ? 'rgba(16,185,129,0.1)' : r.status==='cancelado' ? 'rgba(107,114,128,0.1)' : 'rgba(245,158,11,0.1)',
                          color: r.status==='pago' ? '#10b981' : r.status==='cancelado' ? '#6b7280' : '#f59e0b' }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          
          <div style={{ padding:'12px 16px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Itens por página:</span>
              <select value={rawLimit} onChange={e => { setRawLimit(Number(e.target.value)); setRawPage(1); }}
                style={{ padding:'6px 10px', borderRadius:6, border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))', color:'hsl(var(--text-secondary))', fontSize:12, cursor:'pointer' }}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            {(()=>{
               const totalPages = Math.ceil(filteredRows.length / rawLimit) || 1
               const currentPage = rawPage > totalPages ? totalPages : rawPage
               return (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => setRawPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ padding:'6px 12px', borderRadius:6, border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontSize:12, fontWeight:600, color:'hsl(var(--text-secondary))' }}>
                    Anterior
                  </button>
                  <span style={{ fontSize:12, fontWeight:600, color:'hsl(var(--text-muted))', padding:'0 8px' }}>
                    Pág {currentPage} de {totalPages}
                  </span>
                  <button onClick={() => setRawPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ padding:'6px 12px', borderRadius:6, border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, fontSize:12, fontWeight:600, color:'hsl(var(--text-secondary))' }}>
                    Próxima
                  </button>
                </div>
               )
            })()}
          </div>
        </div>
      )}

      {/* ══ RODAPÉ ════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop:20, display:'flex', justifyContent:'space-between', alignItems:'center',
        fontSize:11, color:'hsl(var(--text-muted))' }} className="print-hide">
        <span>EDU-IMPACTO ERP · Demonstração Financeira · Gerado em {new Date().toLocaleString('pt-BR')}</span>
        <span>{filteredRows.length} lançamentos · Base: {baseServer} · Regime: {modoVisao}</span>
      </div>

      {/* ══ DRILL-DOWN MODAL ══════════════════════════════════════════════════ */}
      <DemonstracaoDrillDownModal
        isOpen={drillInfo.isOpen}
        title={drillInfo.title}
        subtitle={drillInfo.subtitle}
        rows={drillInfo.rows}
        onClose={() => setDrillInfo(p => ({ ...p, isOpen: false }))}
      />
    </div>
  )
}

