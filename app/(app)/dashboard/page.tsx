'use client'

import { useApiQuery } from '@/hooks/useApi'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle,
  GraduationCap, UserCheck, Brain, BarChart3, ArrowRight, Activity,
  Zap, Star, CheckCircle, Clock, XCircle, BookOpen, CreditCard,
  FileText, Target, Layers, Award, Bell, RefreshCw, ExternalLink,
  ShieldAlert, TrendingUp as TUp, BarChart2, PieChart as PIcon,
  Calendar, Briefcase, School, Heart, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// ── Lazy chart imports (prevent hydration mismatch)
const RevenueChartComponent   = dynamic(() => import('./DashboardCharts').then(m => m.RevenueChartComponent),   { ssr: false })
const RisksPieChartComponent  = dynamic(() => import('./DashboardCharts').then(m => m.RisksPieChartComponent),  { ssr: false })
const CostCentersPieChartComponent = dynamic(() => import('./DashboardCharts').then(m => m.CostCentersPieChartComponent), { ssr: false })
const InadimplenciaBarChart   = dynamic(() => import('./DashboardCharts').then(m => m.InadimplenciaBarChart),   { ssr: false })
const OcupacaoRadialChart     = dynamic(() => import('./DashboardCharts').then(m => m.OcupacaoRadialChart),     { ssr: false })
const SparkLine               = dynamic(() => import('./DashboardCharts').then(m => m.SparkLine),               { ssr: false })

// ── Accent
const ACCENT = '#6366f1'

// ── Utils
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const getInitials = (nome: string) => {
  const p = nome?.trim().split(' ').filter(Boolean)
  if (!p?.length) return '?'
  return `${p[0]?.[0] ?? ''}${p[1]?.[0] ?? ''}`.toUpperCase()
}

// ── Month helper
const getMonthLabel = (key: string) => {
  if (!key) return ''
  const [y, m] = key.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`
}

// ── Alert level colors
const NIVEL_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  critico: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  icon: '#ef4444' },
  alto:    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: '#f59e0b' },
  medio:   { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)',icon: '#3b82f6' },
  info:    { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)',icon: '#10b981' },
}

const NIVEL_ICON: Record<string, React.ReactNode> = {
  critico: <XCircle     size={15} color="#ef4444" />,
  alto:    <AlertTriangle size={15} color="#f59e0b" />,
  medio:   <Clock        size={15} color="#3b82f6" />,
  info:    <CheckCircle  size={15} color="#10b981" />,
}

// ─────────────────────────────────────────────────────────────────
// QUICK-ACCESS navigation tiles
// ─────────────────────────────────────────────────────────────────
const NAV_TILES = [
  { href: '/academico/alunos',       icon: <Users size={18}        />, label: 'Alunos',         color: '#3b82f6' },
  { href: '/academico/turmas',       icon: <School size={18}       />, label: 'Turmas',         color: '#8b5cf6' },
  { href: '/academico/responsaveis', icon: <Heart size={18}        />, label: 'Responsáveis',   color: '#ec4899' },
  { href: '/financeiro/titulos',     icon: <FileText size={18}     />, label: 'Títulos',        color: '#10b981' },
  { href: '/financeiro/pagar',       icon: <CreditCard size={18}  />, label: 'Contas a Pagar', color: '#f59e0b' },
  { href: '/financeiro/inadimplencia',icon: <ShieldAlert size={18}/>, label: 'Inadimplentes',  color: '#ef4444' },
  { href: '/rh/funcionarios',        icon: <Briefcase size={18}   />, label: 'Funcionários',   color: '#06b6d4' },
  { href: '/relatorios/personalizado',icon: <BarChart3 size={18}  />, label: 'Relatórios',     color: '#a855f7' },
  { href: '/crm',                    icon: <Target size={18}      />, label: 'CRM / Leads',    color: '#0ea5e9' },
  { href: '/academico/ocorrencias',  icon: <AlertTriangle size={18}/>, label: 'Ocorrências',  color: '#f43f5e' },
  { href: '/calendario',             icon: <Calendar size={18}    />, label: 'Calendário',     color: '#14b8a6' },
  { href: '/tarefas',                icon: <CheckCircle size={18} />, label: 'Tarefas',        color: '#84cc16' },
]

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const hoje = new Date()
  const mesStr  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesPrevStr = `${mesPrev.getFullYear()}-${String(mesPrev.getMonth() + 1).padStart(2, '0')}`
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setLastRefresh(new Date())
    setRefreshKey(k => k + 1)
  }

  // ── KPI principal (server-side aggregated)
  const { data: kpiData, isLoading: loadKpis } = useApiQuery<any>(
    ['dashboard-kpis', mesStr, mesPrevStr, String(refreshKey)],
    `/api/financeiro/dashboard?mes=${mesStr}&mesPrev=${mesPrevStr}`,
    {}
  )
  const kpis = kpiData || {}
  const {
    totalAlunos = 0, receitaMes = 0, receitaPrev = 0, varReceita = 0,
    inadimplentes = 0, inadimplenciaRate = 0, taxaOcupacao = 0,
    novasMatriculas = 0, nFuncionarios = 0,
    riscoAlto = 0, riscoMedio = 0, riscoBaixo = 0, totalRisco = 0,
    RISCO_EVASAO_DIST = [], alunos = [],
    chartData: CHART_DATA = [],
    despesasPorCategoria = [],
    nTurmas = 0,
  } = kpis

  // ── Alertas
  const { data: alertasData } = useApiQuery<any>(
    ['dashboard-alertas', String(refreshKey)],
    `/api/financeiro/dashboard/alertas`,
    {},
    { staleTime: 60_000 }
  )
  const alertas: any[] = alertasData?.alertas ?? []

  // ── Turmas para ocupação por segmento
  const { data: turmasData } = useApiQuery<any>(
    ['dashboard-turmas'],
    `/api/turmas`,
    {},
    { staleTime: 120_000 }
  )
  const turmas: any[] = Array.isArray(turmasData) ? turmasData : (turmasData?.data ?? [])

  // ── Atividade recente (ocorrências + títulos recentes)
  const { data: ocorrData } = useApiQuery<any>(
    ['dash-ocorr'],
    `/api/ocorrencias`,
    {},
    { staleTime: 120_000 }
  )
  const ocorrencias: any[] = (Array.isArray(ocorrData) ? ocorrData : []).slice(0, 5)

  // ── Ocupação por segmento
  const SEGMENTO_CORES: Record<string, string> = {
    EI: '#3b82f6', EF1: '#8b5cf6', EF2: '#10b981',
    EM: '#f59e0b', EJA: '#06b6d4', EFI: '#8b5cf6',
    EFC: '#10b981', EME: '#f59e0b',
  }
  const SEGMENTO_LABELS: Record<string, string> = {
    EI: 'Ed. Infantil', EF1: 'Fund. I', EF2: 'Fund. II',
    EM: 'Ensino Médio', EJA: 'EJA', EFI: 'Fund. I',
    EFC: 'Fund. II', EME: 'Ensino Médio',
  }

  const segmentos = useMemo(() => {
    if (!turmas.length) return []
    const segs: Record<string, { total: number; mat: number }> = {}
    turmas.forEach((t: any) => {
      const k = t.serie || 'Outros'
      if (!segs[k]) segs[k] = { total: 0, mat: 0 }
      segs[k].total += Number(t.capacidade) || 0
      segs[k].mat   += Number(t.matriculados) || 0
    })
    return Object.entries(segs)
      .map(([serie, d]) => ({
        segmento: SEGMENTO_LABELS[serie] ?? serie,
        pct: d.total > 0 ? Math.round((d.mat / d.total) * 100) : 0,
        mat: d.mat, total: d.total,
        cor: SEGMENTO_CORES[serie] ?? '#6b7280',
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [turmas])

  // ── Derived resultado liquido
  const resultadoMes = useMemo(() => {
    if (!CHART_DATA?.length) return 0
    const last = CHART_DATA[CHART_DATA.length - 1]
    return last ? last.receita - last.despesa : 0
  }, [CHART_DATA])

  // ── KPI cards config
  type KpiVariant = 'up' | 'down' | 'neutral'
  interface KpiItem {
    label: string
    value: string
    sub: string
    icon: React.ReactNode
    color: string
    link: string
    trend?: number
    trendDir?: KpiVariant
  }

  const KPI_ITEMS: KpiItem[] = useMemo(() => [
    {
      label: 'Total de Alunos', value: formatNumber(totalAlunos),
      sub: `${formatNumber(novasMatriculas)} novos este mês`,
      icon: <Users size={20} />, color: '#3b82f6', link: '/academico/alunos',
    },
    {
      label: 'Receita do Mês', value: formatCurrency(receitaMes),
      sub: `vs. ${formatCurrency(receitaPrev)} mês anterior`,
      icon: <DollarSign size={20} />, color: '#10b981', link: '/financeiro/titulos',
      trend: Math.round(varReceita * 10) / 10,
      trendDir: (varReceita >= 0 ? 'up' : 'down') as KpiVariant,
    },
    {
      label: 'Inadimplência', value: fmtPct(inadimplenciaRate),
      sub: `${formatNumber(inadimplentes)} alunos inadimplentes`,
      icon: <TrendingDown size={20} />, color: '#ef4444', link: '/financeiro/inadimplencia',
    },
    {
      label: 'Taxa de Ocupação', value: fmtPct(taxaOcupacao),
      sub: `${nTurmas || turmas.length} turmas ativas`,
      icon: <GraduationCap size={20} />, color: '#8b5cf6', link: '/academico/turmas',
    },
    {
      label: 'Novas Matrículas', value: formatNumber(novasMatriculas),
      sub: `em ${getMonthLabel(mesStr)}`,
      icon: <UserCheck size={20} />, color: '#f59e0b', link: '/academico/alunos',
    },
    {
      label: 'Funcionários', value: formatNumber(nFuncionarios),
      sub: 'colaboradores ativos',
      icon: <Briefcase size={20} />, color: '#06b6d4', link: '/rh/funcionarios',
    },
    {
      label: 'Risco de Evasão', value: formatNumber(riscoAlto + riscoMedio),
      sub: `${riscoAlto} alto · ${riscoMedio} médio · ${riscoBaixo} baixo`,
      icon: <AlertTriangle size={20} />, color: '#f59e0b', link: '/academico/alunos',
    },
    {
      label: 'Resultado Líquido', value: formatCurrency(resultadoMes),
      sub: 'receita − despesas do último mês',
      icon: <BarChart2 size={20} />, color: resultadoMes >= 0 ? '#10b981' : '#ef4444',
      link: '/financeiro/titulos',
    },
  ], [totalAlunos, receitaMes, receitaPrev, varReceita, inadimplentes, inadimplenciaRate,
      taxaOcupacao, novasMatriculas, nFuncionarios, riscoAlto, riscoMedio, riscoBaixo,
      resultadoMes, nTurmas, turmas.length, mesStr])

  // ── Skeleton / Empty state
  if (loadKpis) return <DashboardSkeleton />
  if (!loadKpis && totalAlunos === 0 && nFuncionarios === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="ia-card" style={{ padding: 28, textAlign: 'center' }}>
        <Brain size={40} color="#a78bfa" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>ERP pronto para usar</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
          Cadastre alunos, turmas e funcionários para ativar os KPIs em tempo real.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/academico/alunos"   className="btn btn-primary btn-sm">Cadastrar Alunos</Link>
          <Link href="/academico/turmas"   className="btn btn-secondary btn-sm">Cadastrar Turmas</Link>
          <Link href="/rh/funcionarios"    className="btn btn-secondary btn-sm">Cadastrar Funcionários</Link>
        </div>
      </div>
    </div>
  )

  // ──────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 900,
            color: 'hsl(var(--text-primary))',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: -0.5,
          }}>
            Hub Executivo
          </h1>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
            {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            <span style={{ color: 'hsl(var(--text-secondary))' }}>
              Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleRefresh} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} />Atualizar
          </button>
          <Link href="/bi" className="btn btn-secondary btn-sm">
            <BarChart3 size={13} />BI Avançado
          </Link>
          <Link href="/relatorios/personalizado" className="btn btn-secondary btn-sm">
            <FileText size={13} />Relatórios
          </Link>
          <Link href="/ia/copilotos" style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)', color: '#fff',
            borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
          }}>
            <Brain size={14} />Copiloto IA
          </Link>
        </div>
      </div>

      {/* ═══ AI INSIGHT BANNER ═══════════════════════════════════ */}
      <div className="ia-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 42, height: 42, background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
        }}>
          <Zap size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>
            ✨ Análise Inteligente — Tempo Real
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
            {totalAlunos > 0 && <>{formatNumber(totalAlunos)} alunos ativos • </>}
            {inadimplentes > 0 && <><strong style={{ color: '#f87171' }}>{inadimplentes} inadimplentes</strong> ({fmtPct(inadimplenciaRate)}) • </>}
            {riscoAlto > 0 && <><strong style={{ color: '#fbbf24' }}>{riscoAlto} em risco alto de evasão</strong> • </>}
            Ocupação: <strong style={{ color: '#34d399' }}>{fmtPct(taxaOcupacao)}</strong>{' '}
            {alertas.length === 0
              ? '• ✅ Sem alertas críticos'
              : <> • <strong style={{ color: '#f87171' }}>{alertas.filter((a: any) => a.nivel === 'critico').length} alerta(s) crítico(s) ativo(s)</strong></>
            }
          </div>
        </div>
        <Link href="/ia/copilotos" className="btn btn-secondary btn-sm" style={{ flexShrink: 0, fontSize: 11 }}>
          Analisar <ArrowRight size={11} />
        </Link>
      </div>

      {/* ═══ KPI GRID (2×4) ══════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {KPI_ITEMS.map((kpi) => {
          const isNeg = kpi.label === 'Inadimplência' || kpi.label === 'Risco de Evasão'
          const hasTrend = kpi.trend !== undefined && kpi.trend !== 0
          const trendUp = kpi.trend !== undefined && kpi.trend > 0
          const isGood = hasTrend ? (isNeg ? !trendUp : trendUp) : null
          return (
            <Link key={kpi.label} href={kpi.link} style={{ textDecoration: 'none' }}>
              <div className="kpi-card" style={{
                '--kpi-color': kpi.color,
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                position: 'relative',
                overflow: 'hidden',
              } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${kpi.color}20`
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = ''
                  ;(e.currentTarget as HTMLElement).style.boxShadow = ''
                }}
              >
                {/* Accent strip top */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: kpi.color, borderRadius: '8px 8px 0 0', opacity: 0.8 }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, paddingTop: 4 }}>
                  <div style={{ width: 38, height: 38, background: `${kpi.color}18`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                    {kpi.icon}
                  </div>
                  {hasTrend && isGood !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, color: isGood ? '#34d399' : '#f87171', background: isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '2px 6px' }}>
                      {isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {Math.abs(kpi.trend!)}%
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{kpi.label}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 4, opacity: 0.75 }}>{kpi.sub}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ═══ CHARTS ROW 1: Revenue + Risco + Custos ═════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

        {/* Revenue Area Chart */}
        <div className="chart-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-primary))' }}>Receita vs Despesa</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Últimos 6 meses — títulos pagos e contas</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 2.5, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} />
                Receita
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 2.5, background: '#ef4444', borderRadius: 2, display: 'inline-block', borderBottom: '2px dashed #ef4444' }} />
                Despesa
              </span>
            </div>
          </div>
          <RevenueChartComponent chartData={CHART_DATA} />
          {/* Quick totals bar */}
          {CHART_DATA?.length > 0 && (() => {
            const totalRec = CHART_DATA.reduce((s: number, d: any) => s + d.receita, 0)
            const totalDes = CHART_DATA.reduce((s: number, d: any) => s + d.despesa, 0)
            return (
              <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>TOTAL RECEITA (6M)</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>{formatCurrency(totalRec)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>TOTAL DESPESA (6M)</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>{formatCurrency(totalDes)}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <div style={{ fontSize: 10, color: totalRec - totalDes >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>RESULTADO ACUM.</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: totalRec - totalDes >= 0 ? '#10b981' : '#ef4444', fontFamily: 'Outfit,sans-serif' }}>{formatCurrency(totalRec - totalDes)}</div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Risco de Evasão Donut */}
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Risco de Evasão</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 14 }}>Distribuição IA por nível — {formatNumber(totalAlunos)} alunos</div>
          {alunos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 12 }}>Sem alunos cadastrados</div>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <RisksPieChartComponent data={RISCO_EVASAO_DIST} />
                <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: riscoAlto > 0 ? '#ef4444' : '#10b981' }}>{totalRisco}</div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>em risco</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {RISCO_EVASAO_DIST.map((r: any) => (
                  <div key={r.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.fill, display: 'inline-block' }} />
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>{r.nome}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>{r.valor}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Despesas por Categoria */}
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Despesas / Categoria</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 14 }}>Mês atual — contas a pagar</div>
          {despesasPorCategoria.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 12 }}>Sem despesas no mês</div>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CostCentersPieChartComponent data={despesasPorCategoria} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {despesasPorCategoria.slice(0, 5).map((r: any) => (
                  <div key={r.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.fill, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{r.nome}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{formatCurrency(r.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ ROW 2: Ocupação + Alertas ═══════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Ocupação por Segmento */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Ocupação por Segmento</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Capacidade × matrículas por nível de ensino</div>
            </div>
            <Link href="/academico/turmas" style={{ fontSize: 11, color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
              Ver turmas <ChevronRight size={12} />
            </Link>
          </div>
          {segmentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <School size={32} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
              <div>Sem turmas cadastradas</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {segmentos.map(seg => (
                <div key={seg.segmento}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{seg.segmento}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: seg.cor }}>
                      {seg.pct}%
                      <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 400 }}> ({seg.mat}/{seg.total})</span>
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 9, background: 'hsl(var(--bg-elevated))', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 9, background: seg.cor,
                      width: `${seg.pct}%`,
                      transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                      boxShadow: `0 0 8px ${seg.cor}60`,
                    }} />
                  </div>
                  {/* Vagas restantes badge */}
                  {seg.total - seg.mat > 0 && (
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                      {seg.total - seg.mat} vaga{seg.total - seg.mat !== 1 ? 's' : ''} disponível{seg.total - seg.mat !== 1 ? 'is' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas Críticos */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color={alertas.some((a: any) => a.nivel === 'critico') ? '#ef4444' : 'hsl(var(--text-muted))'} />
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                Alertas Críticos
                {alertas.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 8, background: alertas.some((a: any) => a.nivel === 'critico') ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)', color: alertas.some((a: any) => a.nivel === 'critico') ? '#ef4444' : '#f59e0b', fontWeight: 800 }}>
                    {alertas.length}
                  </span>
                )}
              </div>
            </div>
            <Link href="/alertas" style={{ fontSize: 11, color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          {alertas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <CheckCircle size={36} style={{ margin: '0 auto 10px', color: '#10b981', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, color: '#34d399' }}>Tudo em ordem!</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Nenhum alerta crítico no momento</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertas.map((a: any) => {
                const c = NIVEL_COLORS[a.nivel] || NIVEL_COLORS.info
                return (
                  <Link key={a.id} href={a.link || '#'} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
                      background: c.bg, border: `1px solid ${c.border}`,
                      cursor: 'pointer', transition: 'transform 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>{NIVEL_ICON[a.nivel]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descricao}</div>
                      </div>
                      <ChevronRight size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0, alignSelf: 'center' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ ROW 3: Ranking Risco de Evasão ═══════════════════════ */}
      {alunos.filter((a: any) => a.risco_evasao !== 'baixo').length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={15} color="#ef4444" />
                Ranking de Risco — Requer Atenção Imediata
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Classificados por frequência, inadimplência e risco IA</div>
            </div>
            <Link href="/academico/alunos" className="btn btn-secondary btn-sm">Ver todos</Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Aluno</th>
                  <th>Turma</th>
                  <th>Frequência</th>
                  <th>Financeiro</th>
                  <th>Risco IA</th>
                  <th style={{ width: 90 }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {alunos.filter((a: any) => a.risco_evasao !== 'baixo').slice(0, 10).map((a: any, i: number) => {
                  const rc = a.risco_evasao === 'alto' ? '#ef4444' : '#f59e0b'
                  return (
                    <tr key={a.id}>
                      <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${rc}20`, color: rc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            {getInitials(a.nome)}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{a.nome}</div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.matricula}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{a.turma}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 56, height: 5, borderRadius: 9, background: 'hsl(var(--bg-elevated))', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 9,
                              width: `${Math.min(a.frequencia, 100)}%`,
                              background: a.frequencia < 65 ? '#ef4444' : a.frequencia < 80 ? '#f59e0b' : '#10b981',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: a.frequencia < 65 ? '#f87171' : a.frequencia < 80 ? '#fbbf24' : '#34d399' }}>
                            {a.frequencia ?? '—'}%
                          </span>
                        </div>
                      </td>
                      <td>
                        {a.inadimplente
                          ? <span className="badge badge-danger" style={{ fontSize: 10 }}>Inadimplente</span>
                          : <span className="badge badge-success" style={{ fontSize: 10 }}>Regular</span>
                        }
                      </td>
                      <td>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: `${rc}18`, color: rc, border: `1px solid ${rc}30`, display: 'inline-block' }}>
                          {a.risco_evasao === 'alto' ? '⚠ Alto' : '⚡ Médio'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/academico/alunos/ficha?id=${a.id}`} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', gap: 4, background: `${ACCENT}15`, color: ACCENT, fontWeight: 700, textDecoration: 'none', border: `1px solid ${ACCENT}25` }}>
                          Ver Ficha <ExternalLink size={9} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ROW 4: Ocorrências Recentes + Quick Access ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Ocorrências recentes */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Activity size={15} color="#f59e0b" />
              Ocorrências Recentes
            </div>
            <Link href="/academico/ocorrencias" style={{ fontSize: 11, color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>
          {ocorrencias.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <CheckCircle size={30} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
              <div>Nenhuma ocorrência registrada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ocorrencias.map((oc: any) => {
                const gc = oc.gravidade === 'grave' ? '#ef4444' : oc.gravidade === 'media' ? '#f59e0b' : '#6b7280'
                return (
                  <div key={oc.id} style={{ padding: '9px 12px', borderRadius: 9, background: `${gc}07`, borderLeft: `3px solid ${gc}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{oc.tipo || oc.titulo || 'Ocorrência'}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {oc.alunoNome || oc.aluno_nome || '—'} • {oc.data || oc.created_at?.slice(0, 10) || '—'}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: `${gc}18`, color: gc, fontWeight: 800, flexShrink: 0, border: `1px solid ${gc}25` }}>
                      {oc.gravidade || 'info'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Access Grid */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Zap size={15} color={ACCENT} />
            Acesso Rápido
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {NAV_TILES.map(tile => (
              <Link key={tile.href} href={tile.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '12px 6px', borderRadius: 10,
                  background: `${tile.color}0d`, border: `1px solid ${tile.color}22`,
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                  color: tile.color,
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = `${tile.color}20`
                    el.style.transform = 'translateY(-2px)'
                    el.style.boxShadow = `0 4px 12px ${tile.color}25`
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = `${tile.color}0d`
                    el.style.transform = ''
                    el.style.boxShadow = ''
                  }}
                >
                  <div style={{ color: tile.color }}>{tile.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-secondary))', lineHeight: 1.3 }}>{tile.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ FOOTER SUMMARY BAR ══════════════════════════════════ */}
      <div style={{
        padding: '14px 20px', borderRadius: 12,
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
        fontSize: 12,
      }}>
        <div style={{ color: 'hsl(var(--text-muted))' }}>
          📊 <strong style={{ color: 'hsl(var(--text-secondary))' }}>{formatNumber(totalAlunos)}</strong> alunos
          &nbsp;·&nbsp;
          <strong style={{ color: 'hsl(var(--text-secondary))' }}>{nTurmas || turmas.length}</strong> turmas
          &nbsp;·&nbsp;
          <strong style={{ color: 'hsl(var(--text-secondary))' }}>{formatNumber(nFuncionarios)}</strong> funcionários
          &nbsp;·&nbsp;
          Ocupação <strong style={{ color: taxaOcupacao > 85 ? '#10b981' : '#f59e0b' }}>{fmtPct(taxaOcupacao)}</strong>
          &nbsp;·&nbsp;
          Inadimplência <strong style={{ color: inadimplenciaRate > 10 ? '#ef4444' : '#10b981' }}>{fmtPct(inadimplenciaRate)}</strong>
        </div>
        <div style={{ marginLeft: 'auto', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          Sistema online
        </div>
      </div>

    </div>
  )
}
