'use client'

import { useApiQuery } from '@/hooks/useApi'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { useData, Tarefa } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { resolveUserPerfil, isDashboardCardHidden } from '@/lib/auth/moduleRouting'
import { 
  Users, AlertTriangle, GraduationCap, UserPlus,
  Calendar as CalendarIcon, ClipboardCheck, BookMarked,
  CheckCircle, CalendarDays, Cake, ShieldCheck, X, Loader2,
  Layers, PackageCheck, Clock, ArrowUpRight, CheckCircle2, BookOpen,
  Activity, Sparkles, EyeOff, Lock
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Helpers
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const getInitials = (nome: string) => {
  const p = nome?.trim().split(' ').filter(Boolean)
  if (!p?.length) return '?'
  return `${p[0]?.[0] ?? ''}${p[1]?.[0] ?? ''}`.toUpperCase()
}

// ── Sparkline Component (Ultra-Modern Animated Telemetry Curve)
function Sparkline({ color, path, index = 0 }: { color: string, path: string, index?: number }) {
  const cleanId = color.replace('#', '')
  const fillPath = `${path} L 96 42 L 0 42 Z`

  // Extrai as coordenadas finais do path (ex: "M ... S 80 25, 96 10")
  const pathParts = path.trim().split(/[\s,]+/)
  const endX = pathParts[pathParts.length - 2]
  const endY = pathParts[pathParts.length - 1]

  return (
    <div className="dashboard-sparkline-container" aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 100 42" preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${cleanId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="65%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`shadow-${cleanId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor={color} floodOpacity="0.38" />
          </filter>
        </defs>
        <motion.path
          d={fillPath}
          fill={`url(#grad-${cleanId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.2 + index * 0.08 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#shadow-${cleanId})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.25, delay: 0.12 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
        />
        <circle
          cx={endX}
          cy={endY}
          r="6"
          fill={color}
          className="dashboard-kpi-spark-pulse"
        />
        <circle
          cx={endX}
          cy={endY}
          r="3.2"
          fill={color}
          stroke="hsl(var(--bg-surface))"
          strokeWidth="1.6"
          filter={`url(#shadow-${cleanId})`}
        />
      </svg>
    </div>
  )
}

const PATHS = {
  blue:   "M 0 28 C 12 22, 22 31, 34 20 S 54 25, 66 14 S 82 22, 96 9",
  purple: "M 0 31 C 15 26, 22 16, 36 25 S 56 11, 70 19 S 84 10, 96 13",
  green:  "M 0 24 C 12 28, 22 17, 34 25 S 52 12, 64 19 S 80 14, 96 6",
  orange: "M 0 19 C 15 24, 26 12, 42 21 S 60 26, 74 14 S 86 19, 96 10"
}

export default function DashboardPage() {
  const { currentUser, currentUserPerfil, hydrated } = useApp()
  const hoje = new Date()
  const mesStr  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesPrevStr = `${mesPrev.getFullYear()}-${String(mesPrev.getMonth() + 1).padStart(2, '0')}`
  const [refreshKey] = useState(0)

  // ── Context Data (Calendar, Tasks, Perfis & Ocorrências)
  const { tarefas = [], eventosAgenda = [], turmas = [], cfgCalendarioLetivo = [], ocorrencias: contextOcorrencias = [], perfis = [], perfisLoading = false, loading: loadContext = false } = useData() as any

  // ── Resolução de Permissões de Visualização dos Cards (Zero-Flash)
  const userPerfilObj = useMemo(
    () => resolveUserPerfil(perfis, currentUserPerfil, currentUser),
    [perfis, currentUserPerfil, currentUser]
  )
  const isResolvingPerms = !hydrated || (perfisLoading && (!perfis || perfis.length === 0))
  const hideTotalAlunosKpi = isDashboardCardHidden(userPerfilObj, 'total_alunos')
  const hideTaxaOcupacaoKpi = isDashboardCardHidden(userPerfilObj, 'taxa_ocupacao')
  const hideNovasMatriculasKpi = isDashboardCardHidden(userPerfilObj, 'novas_matriculas')
  const hideOcorrenciasKpi = isDashboardCardHidden(userPerfilObj, 'ocorrencias')
  const allServerKpisHidden = hideTotalAlunosKpi && hideTaxaOcupacaoKpi && hideNovasMatriculasKpi

  // ── Modais
  const [modalAnivOpen, setModalAnivOpen] = useState(false)
  const [anivFiltroAno, setAnivFiltroAno] = useState('Todos')
  const [anivFiltroTurma, setAnivFiltroTurma] = useState('Todas')
  
  // ── Filtros Dashboard
  const [filtroTarefas, setFiltroTarefas] = useState<'todas' | 'pendentes' | 'concluidas'>('todas')
  const [filtroPedidos, setFiltroPedidos] = useState<'todos' | 'pendentes' | 'feitos' | 'entregues'>('todos')
  const [diaSelecionadoOffset, setDiaSelecionadoOffset] = useState<number>(0)
  const [apenasMinhasTarefas, setApenasMinhasTarefas] = useState(true)
  const [engRoleFocus, setEngRoleFocus] = useState<'colab' | 'alunos' | 'resps' | null>(null)

  // ── Data for Stats
  const { data: aniversariantesList, isLoading: loadAniv } = useApiQuery<any[]>(['dash-aniversariantes'], '/api/alunos/aniversariantes', {}, { staleTime: 120_000 })
  const { data: ordersData, isLoading: loadOrders } = useApiQuery<any>(['dash-pedidos-summary'], '/api/administrativo/pedidos-summary', {}, { staleTime: 60000 })
  const ordersSummary = ordersData || { totalOrders: 0, totalValue: 0, entregueCount: 0, preparadoCount: 0, pendenteCount: 0, recentOrders: [] }

  // ── Ocorrências (reutiliza dados já carregados pelo DataProvider para evitar request duplicado)
  const ocorrencias: any[] = Array.isArray(contextOcorrencias) ? contextOcorrencias : []
  const loadOcorr = loadContext && ocorrencias.length === 0

  // ── KPI principal (server-side aggregated)
  const { data: kpiData, isLoading: loadKpis } = useApiQuery<any>(
    ['dashboard-kpis', mesStr, mesPrevStr, String(refreshKey)],
    `/api/financeiro/dashboard?mes=${mesStr}&mesPrev=${mesPrevStr}`,
    {},
    { staleTime: 60_000, enabled: !isResolvingPerms && !allServerKpisHidden }
  )
  const kpis = kpiData || {}
  const {
    totalAlunos = 0, taxaOcupacao = 0,
    novasMatriculas = 0,
  } = kpis

  // ── Usuários Cadastrados / Acessos (modo summary=true para evitar tráfego pesado no dashboard)
  const { data: usuariosData, isLoading: loadUsuarios } = useApiQuery<any>(
    ['dash-usuarios-summary'],
    `/api/configuracoes/usuarios?summary=true`,
    {},
    { staleTime: 300_000 }
  )

  const statsUsuarios = useMemo(() => {
    if (usuariosData && typeof usuariosData === 'object' && usuariosData.stats) {
      return usuariosData.stats
    }
    const list: any[] = Array.isArray(usuariosData)
      ? usuariosData
      : (usuariosData && Array.isArray((usuariosData as any).data) ? (usuariosData as any).data : [])
    if (!list.length) return { colab: 0, colabTotal: 0, alunos: 0, alunosTotal: 0, resps: 0, respsTotal: 0, total: 0, totalGeral: 0 }
    let colab = 0, colabTotal = 0
    let alunos = 0, alunosTotal = 0
    let resps = 0, respsTotal = 0
    let ativos = 0

    list.forEach((u: any) => {
      const isAtivo = u.ultimoAcesso && u.ultimoAcesso !== 'Nunca acessou'
      if (isAtivo) ativos++
      if (u.cargo === 'Alunos') {
        alunosTotal++
        if (isAtivo) alunos++
      }
      else if (u.cargo === 'Responsáveis') {
        respsTotal++
        if (isAtivo) resps++
      }
      else {
        colabTotal++
        if (isAtivo) colab++
      }
    })
    return { colab, colabTotal, alunos, alunosTotal, resps, respsTotal, total: ativos, totalGeral: list.length }
  }, [usuariosData])

  // ── Derived Data
  const todayStr = hoje.toISOString().slice(0, 10)
  
  const tarefasFiltradas = useMemo(() => {
    if (!apenasMinhasTarefas) return tarefas
    if (!currentUser?.nome) return tarefas
    return tarefas.filter((t: any) => t.responsavel === currentUser.nome)
  }, [tarefas, currentUser, apenasMinhasTarefas])

  const tarefasPendentesList = tarefasFiltradas.filter((t: any) => t.status !== 'concluida')
  const tarefasConcluidasList = tarefasFiltradas.filter((t: any) => t.status === 'concluida')
  const tarefasExibidas = filtroTarefas === 'todas' 
    ? tarefasFiltradas 
    : filtroTarefas === 'pendentes' 
      ? tarefasPendentesList 
      : tarefasConcluidasList

  const selectedDate = new Date(hoje);
  selectedDate.setDate(hoje.getDate() + diaSelecionadoOffset);
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);
  const eventosExibidos = eventosAgenda.filter((e: any) => e.data === selectedDateStr);

  const totalTurmasAtivas = turmas.length || kpis.nTurmas || 0
  const ocorrenciasConfirmadasCount = ocorrencias.filter((o: any) => !!o.ciencia_responsavel).length
  const pctOcorrenciasCiencia = ocorrencias.length > 0 ? Math.round((ocorrenciasConfirmadasCount / ocorrencias.length) * 100) : 100

  const kpiCards = [
    { 
      key: 'total_alunos' as const,
      hidden: hideTotalAlunosKpi,
      label: 'Total de Alunos', 
      category: 'CORPO DISCENTE',
      value: formatNumber(totalAlunos), 
      badge: totalTurmasAtivas > 0 ? `${totalTurmasAtivas} turmas` : 'Ativos',
      icon: <Users size={20} strokeWidth={2.3} />, 
      color: '#2563eb', 
      accent: '#3b82f6',
      lightBg: 'rgba(37, 99, 235, 0.1)',
      borderTint: 'rgba(59, 130, 246, 0.24)',
      glow: 'rgba(37, 99, 235, 0.22)',
      iconGradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #0ea5e9 100%)',
      sub: 'Matriculados ativos', 
      href: '/academico/alunos',
      path: PATHS.blue,
      gradient: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #06b6d4 100%)'
    },
    { 
      key: 'taxa_ocupacao' as const,
      hidden: hideTaxaOcupacaoKpi,
      label: 'Taxa de Ocupação', 
      category: 'INFRAESTRUTURA',
      value: fmtPct(taxaOcupacao), 
      badge: taxaOcupacao >= 75 ? 'Alta demanda' : 'Capacidade ativa',
      icon: <GraduationCap size={20} strokeWidth={2.3} />, 
      color: '#7c3aed', 
      accent: '#8b5cf6',
      lightBg: 'rgba(124, 58, 237, 0.1)',
      borderTint: 'rgba(139, 92, 246, 0.24)',
      glow: 'rgba(124, 58, 237, 0.22)',
      iconGradient: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 55%, #c084fc 100%)',
      sub: 'Capacidade física', 
      href: '/academico/turmas',
      path: PATHS.purple,
      gradient: 'linear-gradient(90deg, #6d28d9 0%, #8b5cf6 50%, #c084fc 100%)'
    },
    { 
      key: 'novas_matriculas' as const,
      hidden: hideNovasMatriculasKpi,
      label: 'Novas Matrículas', 
      category: 'EXPANSÃO MENSAL',
      value: formatNumber(novasMatriculas), 
      badge: novasMatriculas > 0 ? `+${novasMatriculas} ingresso${novasMatriculas === 1 ? '' : 's'}` : 'Ciclo atual',
      icon: <UserPlus size={20} strokeWidth={2.3} />, 
      color: '#059669', 
      accent: '#10b981',
      lightBg: 'rgba(5, 150, 105, 0.1)',
      borderTint: 'rgba(16, 185, 129, 0.24)',
      glow: 'rgba(5, 150, 105, 0.22)',
      iconGradient: 'linear-gradient(135deg, #047857 0%, #10b981 55%, #34d399 100%)',
      sub: 'Este mês', 
      href: '/academico/alunos',
      path: PATHS.green,
      gradient: 'linear-gradient(90deg, #047857 0%, #10b981 50%, #34d399 100%)'
    },
    { 
      key: 'ocorrencias' as const,
      hidden: hideOcorrenciasKpi,
      label: 'Ocorrências', 
      category: 'ACOMPANHAMENTO',
      value: formatNumber(ocorrencias.length), 
      badge: `${pctOcorrenciasCiencia}% c/ ciência`,
      icon: <AlertTriangle size={20} strokeWidth={2.3} />, 
      color: '#ea580c', 
      accent: '#f97316',
      lightBg: 'rgba(234, 88, 12, 0.1)',
      borderTint: 'rgba(249, 115, 22, 0.24)',
      glow: 'rgba(234, 88, 12, 0.22)',
      iconGradient: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f59e0b 100%)',
      sub: 'Registradas', 
      href: '/academico/ocorrencias',
      path: PATHS.orange,
      gradient: 'linear-gradient(90deg, #c2410c 0%, #f97316 50%, #fbbf24 100%)'
    },
  ]

  const aniversariantes = useMemo(() => {
    // Garante extração do array (a API retorna { data: [], meta: {} })
    const list = Array.isArray(aniversariantesList) 
      ? aniversariantesList 
      : (aniversariantesList as any)?.data || []
      
    if (!list || list.length === 0) return []
    return list.map((a: any) => {
      let turmaNome = a.turma || 'S/T'
      const tObj = turmas.find((t: any) => t.id === a.turma || t.codigo === a.turma)
      if (tObj) turmaNome = tObj.nome

      return {
        id: a.id,
        nome: a.nome,
        dia: parseInt(a.dataNascimento?.split('-')[2] || '0'),
        turma: turmaNome,
        anoLetivoId: (tObj as any)?.ano ? String((tObj as any).ano) : (tObj as any)?.ano_letivo ? String((tObj as any).ano_letivo) : 'Todos',
        foto: a.foto || null,
        timestamp: new Date().getTime()
      }
    }).sort((a: any, b: any) => a.dia - b.dia)
  }, [aniversariantesList, turmas])

  // Orders summary logic moved to backend API (/api/administrativo/pedidos-summary)

  return (
    <div className="dashboard-container">

      {/* ═══ Header da Visão Geral (Referência) ════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl 2xl:text-3xl font-extrabold text-[hsl(var(--text-primary))] tracking-tight">
            Visão geral
          </h1>
          <p className="text-sm text-[hsl(var(--text-secondary))] mt-0.5 font-normal">
            Acompanhe os indicadores e a rotina do colégio.
          </p>
        </div>

        {/* Atalhos Rápidos Compactos: Minhas Tarefas e Calendário */}
        <div className="flex items-center gap-3">
          <Link
            href="/tarefas"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--bg-hover))] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Acessar Minhas Tarefas"
          >
            <ClipboardCheck size={15} className="text-emerald-500" />
            <span>Minhas tarefas</span>
          </Link>
          <Link
            href="/calendario"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--bg-hover))] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Acessar Calendário Escolar"
          >
            <CalendarIcon size={15} className="text-indigo-500" />
            <span>Calendário</span>
          </Link>
        </div>
      </div>

      {/* ═══ Top Row (4 KPIs — Ultra-Modern Telemetry Bento Cards) ════════ */}
      <div className="dashboard-kpi-grid">
        {kpiCards.map((kpi, idx) => (
          <motion.article
            key={kpi.label}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="dashboard-kpi-card"
            style={{
              '--kpi-color': kpi.color,
              '--kpi-accent': kpi.accent,
              '--kpi-glow': kpi.glow,
              '--kpi-border': kpi.borderTint
            } as React.CSSProperties}
          >
            {/* Top Animated Gradient Beam */}
            <div className="dashboard-kpi-top-beam" style={{ background: kpi.gradient }} />

            {/* Ambient Corner Glow & Subtle Dot Grid */}
            <div
              className="dashboard-kpi-ambient-orb"
              style={{ background: `radial-gradient(circle, ${kpi.glow} 0%, transparent 70%)` }}
            />
            <div className="dashboard-kpi-dot-mesh" />

            <div className="dashboard-kpi-content">
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category Micro-Tag */}
                <div className="dashboard-kpi-category-row">
                  <span
                    className="dashboard-kpi-category-pill"
                    style={{
                      color: kpi.color,
                      background: kpi.lightBg,
                      borderColor: kpi.borderTint
                    }}
                  >
                    <span className="dashboard-kpi-category-dot" style={{ background: kpi.accent }} />
                    <span>{kpi.category}</span>
                  </span>
                </div>

                {/* Title with Stretched Link */}
                <h2 className="dashboard-kpi-title-heading">
                  <Link href={kpi.href} className="dashboard-kpi-label dashboard-kpi-card-link" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {kpi.label}
                  </Link>
                </h2>

                {/* Big Hero Value + Live Metric Pill */}
                <div className="dashboard-kpi-value-row">
                  <div className="dashboard-kpi-value">
                    {isResolvingPerms || (!kpi.hidden && (kpi.key === 'ocorrencias' ? loadOcorr : loadKpis)) ? (
                      <Loader2 className="animate-spin" size={24} color={kpi.color} style={{ margin: '3px 0' }} />
                    ) : kpi.hidden ? (
                      <span
                        aria-label="Dado restrito para este perfil"
                        title="Visualização restrita para o seu perfil"
                        style={{ letterSpacing: '0.14em', opacity: 0.55, userSelect: 'none' }}
                      >
                        ••••
                      </span>
                    ) : (
                      kpi.value
                    )}
                  </div>
                  {!isResolvingPerms && (kpi.hidden || !(kpi.key === 'ocorrencias' ? loadOcorr : loadKpis)) && (
                    <span
                      className="dashboard-kpi-metric-badge"
                      style={{
                        color: kpi.color,
                        background: kpi.lightBg,
                        borderColor: kpi.borderTint,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {kpi.hidden ? (
                        <>
                          <EyeOff size={11} strokeWidth={2.4} />
                          <span>Oculto</span>
                        </>
                      ) : (
                        kpi.badge
                      )}
                    </span>
                  )}
                </div>

                {/* Subtitle + Hover Action Arrow */}
                <div className="dashboard-kpi-footer-row">
                  <span className="dashboard-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {!isResolvingPerms && kpi.hidden ? (
                      <>
                        <Lock size={11} style={{ opacity: 0.75 }} />
                        <span>Visualização restrita</span>
                      </>
                    ) : (
                      kpi.sub
                    )}
                  </span>
                  <span className="dashboard-kpi-action-hint" style={{ color: kpi.color }}>
                    <ArrowUpRight size={13} strokeWidth={2.5} />
                  </span>
                </div>
              </div>

              {/* 3D Glowing Squircle Icon Box */}
              <div className="dashboard-kpi-icon-wrap">
                <div
                  className="dashboard-kpi-icon-ring"
                  style={{ borderColor: kpi.borderTint }}
                />
                <div
                  className="dashboard-kpi-icon"
                  style={{
                    background: kpi.iconGradient,
                    boxShadow: `0 10px 20px -4px ${kpi.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.42)`
                  }}
                >
                  {kpi.icon}
                </div>
              </div>
            </div>

            <Sparkline color={kpi.color} path={kpi.path} index={idx} />
          </motion.article>
        ))}
      </div>

      {/* ═══ Main Area Grid (3 Columns) ═══════════════════════════════════ */}
      <div className="dashboard-main-grid">

        {/* ── Coluna 1: Pedido de Livros ──────────────────────────── */}
        <div className="dashboard-card" style={{ height: '100%', minWidth: 0 }}>
          {/* Header Ultra Moderno com Gradiente */}
          <div className="dashboard-card-header" style={{ 
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #0ea5e9 100%)', 
          }}>
            {/* Efeito sutil de luz glass reflexiva */}
            <div style={{ 
              position: 'absolute', 
              top: '-45px', 
              right: '-15px', 
              width: 140, 
              height: 140, 
              borderRadius: '50%', 
              background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, transparent 70%)', 
              pointerEvents: 'none' 
            }} />
            <div style={{ 
              position: 'absolute', 
              bottom: '-30px', 
              left: '25%', 
              width: 100, 
              height: 80, 
              borderRadius: '50%', 
              background: 'radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)', 
              pointerEvents: 'none' 
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: 38, 
                height: 38, 
                background: 'rgba(255,255,255,0.18)', 
                backdropFilter: 'blur(10px)', 
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '11px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#ffffff'
              }}>
                <BookMarked size={18} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: '#ffffff', letterSpacing: '-0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                    Pedido de Livros/Apostilas
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Controle e logística de materiais</div>
              </div>
            </div>

            <Link 
              href="/administrativo/pedidos-livros" 
              style={{ 
                fontSize: '12px', 
                color: '#ffffff', 
                textDecoration: 'none', 
                fontWeight: 800,
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '6px 13px',
                borderRadius: '14px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                position: 'relative',
                zIndex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>Ver todos</span>
              <ArrowUpRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          <div className="dashboard-card-body" style={{ padding: '18px 20px', gap: 14 }}>
            {loadOrders ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 className="animate-spin" size={32} color="#3b82f6" />
              </div>
            ) : (() => {
              const total = ordersSummary.totalOrders || 0
              const pendentes = ordersSummary.pendenteCount || 0
              const feitos = ordersSummary.preparadoCount || 0
              const entregues = ordersSummary.entregueCount || 0

              const pctEntregue = total > 0 ? Math.round((entregues / total) * 100) : 0
              const pctFeito = total > 0 ? Math.round((feitos / total) * 100) : 0
              const pctPendente = total > 0 ? Math.max(0, 100 - pctEntregue - pctFeito) : 0

              const allRecent: any[] = Array.isArray(ordersSummary.recentOrders) ? ordersSummary.recentOrders : []
              const filteredOrders = allRecent.filter((o: any) => {
                if (filtroPedidos === 'pendentes') return !o.feito && !o.entregue
                if (filtroPedidos === 'feitos') return o.feito && !o.entregue
                if (filtroPedidos === 'entregues') return !!o.entregue
                return true
              })

              return (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14, minWidth: 0 }}>
                  {/* ── Bento Grid 2x2 Proporcional ──────────────────────── */}
                  <div className="dashboard-books-grid" style={{ marginBottom: 0 }}>
                    {/* Card 1: TOTAL */}
                    <div
                      onClick={() => setFiltroPedidos('todos')}
                      className="dashboard-book-stat"
                      style={{
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderColor: filtroPedidos === 'todos' ? '#3b82f6' : '#e2e8f0',
                        boxShadow: filtroPedidos === 'todos' ? '0 0 0 3px rgba(59, 130, 246, 0.14), 0 4px 12px rgba(15, 23, 42, 0.04)' : '0 2px 6px rgba(15, 23, 42, 0.02)'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span className="dashboard-book-stat-label" style={{ color: '#475569' }}>Total</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#2563eb', background: 'rgba(37, 99, 235, 0.1)', padding: '1px 6px', borderRadius: 999 }}>100%</span>
                        </div>
                        <div className="dashboard-book-stat-value" style={{ color: '#0f172a' }}>{total}</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Materiais no ano
                        </div>
                      </div>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(14, 165, 233, 0.12) 100%)',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Layers size={18} strokeWidth={2.2} />
                      </div>
                    </div>

                    {/* Card 2: PENDENTES (Destaque Animado Pulsante) */}
                    <div
                      onClick={() => setFiltroPedidos(filtroPedidos === 'pendentes' ? 'todos' : 'pendentes')}
                      className="dashboard-book-stat dashboard-book-stat-pending"
                      style={{
                        outline: filtroPedidos === 'pendentes' ? '2px solid #be123c' : 'none',
                        outlineOffset: '1px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <span className="dashboard-pending-radar">
                            <span className="dashboard-pending-radar-ring" />
                            <span className="dashboard-pending-radar-dot" />
                          </span>
                          <span className="dashboard-book-stat-label" style={{ color: '#be123c', fontWeight: 900 }}>Pendentes</span>
                          <span style={{
                            fontSize: '8.5px',
                            fontWeight: 900,
                            color: '#ffffff',
                            background: pendentes > 0 ? '#e11d48' : '#f43f5e',
                            padding: '1.5px 5.5px',
                            borderRadius: 999,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            animation: 'pendingBadgePulse 1.6s infinite ease-in-out',
                            boxShadow: '0 2px 6px rgba(225, 29, 72, 0.35)'
                          }}>
                            {pendentes > 0 ? 'Urgente' : 'Atenção'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <div className="dashboard-book-stat-value" style={{ color: '#be123c' }}>{pendentes}</div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#e11d48' }}>
                            {pendentes > 0 ? `${pctPendente}% do total` : 'Em alerta'}
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#9f1239', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pendentes > 0 ? 'Requer ação imediata' : 'Aguardando solicitação'}
                        </div>
                      </div>
                      <div
                        className="dashboard-pending-icon-box"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #ef4444 0%, #be123c 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          position: 'relative',
                          zIndex: 1
                        }}
                      >
                        <AlertTriangle size={18} strokeWidth={2.4} />
                      </div>
                    </div>

                    {/* Card 3: PEDIDO FEITO */}
                    <div
                      onClick={() => setFiltroPedidos(filtroPedidos === 'feitos' ? 'todos' : 'feitos')}
                      className="dashboard-book-stat"
                      style={{
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        borderColor: filtroPedidos === 'feitos' ? '#d97706' : 'rgba(245, 158, 11, 0.32)',
                        boxShadow: filtroPedidos === 'feitos' ? '0 0 0 3px rgba(245, 158, 11, 0.18), 0 4px 12px rgba(217, 119, 6, 0.08)' : '0 2px 6px rgba(217, 119, 6, 0.04)'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span className="dashboard-book-stat-label" style={{ color: '#b45309' }}>Pedido Feito</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#b45309', background: 'rgba(245, 158, 11, 0.18)', padding: '1px 6px', borderRadius: 999 }}>{pctFeito}%</span>
                        </div>
                        <div className="dashboard-book-stat-value" style={{ color: '#d97706' }}>{feitos}</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#92400e', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Em processamento
                        </div>
                      </div>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'rgba(245, 158, 11, 0.18)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Clock size={18} strokeWidth={2.2} />
                      </div>
                    </div>

                    {/* Card 4: ENTREGUES */}
                    <div
                      onClick={() => setFiltroPedidos(filtroPedidos === 'entregues' ? 'todos' : 'entregues')}
                      className="dashboard-book-stat"
                      style={{
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                        borderColor: filtroPedidos === 'entregues' ? '#059669' : 'rgba(16, 185, 129, 0.32)',
                        boxShadow: filtroPedidos === 'entregues' ? '0 0 0 3px rgba(16, 185, 129, 0.18), 0 4px 12px rgba(5, 150, 105, 0.08)' : '0 2px 6px rgba(5, 150, 105, 0.04)'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span className="dashboard-book-stat-label" style={{ color: '#047857' }}>Entregues</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#047857', background: 'rgba(16, 185, 129, 0.18)', padding: '1px 6px', borderRadius: 999 }}>{pctEntregue}%</span>
                        </div>
                        <div className="dashboard-book-stat-value" style={{ color: '#059669' }}>{entregues}</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#065f46', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Ciclo finalizado
                        </div>
                      </div>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'rgba(16, 185, 129, 0.18)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <PackageCheck size={18} strokeWidth={2.2} />
                      </div>
                    </div>
                  </div>

                  {/* ── Barra de Progresso Multissegmentada ──────────────── */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Taxa de Entrega</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                          ({entregues} de {total})
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 900,
                        color: '#059669',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '2px 8px',
                        borderRadius: 999
                      }}>
                        {pctEntregue}% concluído
                      </span>
                    </div>

                    <div style={{
                      width: '100%',
                      height: 8,
                      background: '#e2e8f0',
                      borderRadius: 999,
                      overflow: 'hidden',
                      display: 'flex',
                      gap: total > 0 ? 2 : 0
                    }}>
                      {entregues > 0 && (
                        <div
                          title={`Entregues: ${entregues} (${pctEntregue}%)`}
                          style={{
                            width: `${(entregues / total) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            borderRadius: 999,
                            transition: 'width 0.4s ease'
                          }}
                        />
                      )}
                      {feitos > 0 && (
                        <div
                          title={`Pedido Feito: ${feitos} (${pctFeito}%)`}
                          style={{
                            width: `${(feitos / total) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)',
                            borderRadius: 999,
                            transition: 'width 0.4s ease'
                          }}
                        />
                      )}
                      {pendentes > 0 && (
                        <div
                          title={`Pendentes: ${pendentes} (${pctPendente}%)`}
                          style={{
                            width: `${(pendentes / total) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)',
                            borderRadius: 999,
                            transition: 'width 0.4s ease'
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                          Entregues ({entregues})
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                          Feitos ({feitos})
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: pendentes > 0 ? '#e11d48' : '#64748b', fontWeight: pendentes > 0 ? 800 : 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e11d48' }} />
                          Pendentes ({pendentes})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Seção de Pedidos Recentes com Filtro Rápido ──────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                          {filtroPedidos === 'todos' ? 'Movimentações Recentes' : filtroPedidos === 'pendentes' ? 'Pedidos Pendentes' : filtroPedidos === 'feitos' ? 'Pedidos Realizados' : 'Materiais Entregues'}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '1px 7px',
                          borderRadius: 999
                        }}>
                          {filteredOrders.length}
                        </span>
                      </div>

                      {filtroPedidos !== 'todos' && (
                        <button
                          onClick={() => setFiltroPedidos('todos')}
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            color: '#2563eb',
                            background: 'rgba(37, 99, 235, 0.08)',
                            border: 'none',
                            borderRadius: 999,
                            padding: '2px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          Limpar filtro ×
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {filteredOrders.length === 0 ? (
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          padding: '20px 14px',
                          borderRadius: 14,
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          gap: 6
                        }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: filtroPedidos === 'pendentes' ? '#ecfdf5' : '#f1f5f9',
                            color: filtroPedidos === 'pendentes' ? '#10b981' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CheckCircle2 size={18} strokeWidth={2.3} />
                          </div>
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                            {filtroPedidos === 'pendentes' ? 'Nenhum pedido pendente!' : 'Nenhum registro neste filtro'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                            {filtroPedidos === 'pendentes' ? 'Todos os materiais já foram solicitados ou entregues.' : 'Experimente selecionar outra categoria acima.'}
                          </div>
                        </div>
                      ) : (
                        filteredOrders.slice(0, 4).map((o: any) => {
                          const isEntregue = !!o.entregue
                          const isFeito = !!o.feito && !o.entregue
                          const statusColor = isEntregue ? '#10b981' : isFeito ? '#f59e0b' : '#e11d48'
                          const statusBg = isEntregue ? 'rgba(16, 185, 129, 0.1)' : isFeito ? 'rgba(245, 158, 11, 0.12)' : 'rgba(225, 29, 72, 0.12)'
                          const statusBorder = isEntregue ? 'rgba(16, 185, 129, 0.25)' : isFeito ? 'rgba(245, 158, 11, 0.28)' : 'rgba(225, 29, 72, 0.3)'

                          return (
                            <Link
                              href="/administrativo/pedidos-livros"
                              key={o.id}
                              className="dashboard-order-row"
                              style={{ borderLeft: `3.5px solid ${statusColor}` }}
                            >
                              <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: statusBg,
                                border: `1px solid ${statusBorder}`,
                                color: statusColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '12px',
                                flexShrink: 0
                              }}>
                                {getInitials(o.aluno)}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  color: 'hsl(var(--text-primary))',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {o.aluno}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  marginTop: 2,
                                  fontSize: '11px',
                                  color: 'hsl(var(--text-secondary))',
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.turma}</span>
                                  <span style={{ opacity: 0.4 }}>•</span>
                                  <span style={{
                                    color: '#2563eb',
                                    background: 'rgba(37, 99, 235, 0.08)',
                                    padding: '0.5px 6px',
                                    borderRadius: 6,
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    {o.material}
                                  </span>
                                </div>
                              </div>

                              <div style={{ flexShrink: 0 }}>
                                {!o.feito && !o.entregue && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '9.5px',
                                    fontWeight: 900,
                                    color: '#be123c',
                                    background: '#ffe4e6',
                                    border: '1px solid #fda4af',
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e11d48' }} />
                                    Pendente
                                  </span>
                                )}
                                {o.feito && !o.entregue && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '9.5px',
                                    fontWeight: 900,
                                    color: '#b45309',
                                    background: '#fef3c7',
                                    border: '1px solid #fcd34d',
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    <Clock size={10} strokeWidth={2.5} />
                                    Pedido Feito
                                  </span>
                                )}
                                {o.entregue && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '9.5px',
                                    fontWeight: 900,
                                    color: '#047857',
                                    background: '#d1fae5',
                                    border: '1px solid #6ee7b7',
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    <CheckCircle2 size={10} strokeWidth={2.5} />
                                    Entregue
                                  </span>
                                )}
                              </div>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* ── Footer CTA Ultra Moderno ─────────────────────────── */}
                  <Link
                    href="/administrativo/pedidos-livros"
                    style={{
                      marginTop: 'auto',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: '12.5px',
                      fontWeight: 800,
                      color: '#1d4ed8',
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.1) 100%)',
                      border: '1px solid rgba(37, 99, 235, 0.18)',
                      padding: '10px 16px',
                      borderRadius: 14,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <BookOpen size={14} strokeWidth={2.3} />
                    <span>Gerenciar controle de materiais</span>
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ── Coluna Central: Tarefas e Agenda ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* ═══ CARD: TAREFAS (Ultra-Modern) ═══ */}
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="dashboard-card dashboard-modern-widget"
          >
            {/* Header Ultra Moderno com Gradiente & Shimmer */}
            <div className="dashboard-card-header" style={{ 
              background: 'linear-gradient(135deg, #064e3b 0%, #059669 48%, #14b8a6 100%)', 
            }}>
              <div className="dashboard-header-orb dashboard-header-orb-top" />
              <div className="dashboard-header-orb dashboard-header-orb-bottom" style={{ background: 'radial-gradient(circle, rgba(45, 212, 191, 0.28) 0%, transparent 70%)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                <div className="dashboard-header-icon-box">
                  <ClipboardCheck size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="dashboard-header-title">Tarefas</span>
                    {tarefasPendentesList.length > 0 && (
                      <span className="dashboard-header-count-pill">
                        {tarefasPendentesList.length} ativa{tarefasPendentesList.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div className="dashboard-header-subtitle">Atividades e lembretes</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                {/* Glass Minhas Switch Pill */}
                <label className="dashboard-glass-toggle" title="Filtrar apenas minhas tarefas">
                  <span className="dashboard-glass-toggle-label">Minhas</span>
                  <span className="dashboard-glass-switch">
                    <input
                      type="checkbox"
                      checked={apenasMinhasTarefas}
                      onChange={e => setApenasMinhasTarefas(e.target.checked)}
                    />
                    <span
                      className="dashboard-glass-slider"
                      style={{ background: apenasMinhasTarefas ? '#10b981' : 'rgba(255,255,255,0.26)' }}
                    >
                      <span
                        className="dashboard-glass-thumb"
                        style={{ translate: apenasMinhasTarefas ? '13px 0' : '0 0' }}
                      />
                    </span>
                  </span>
                </label>

                {/* Glass Ver todas Link */}
                <Link href="/tarefas" className="dashboard-header-cta">
                  <span>Ver todas</span>
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            <div className="dashboard-card-body" style={{ padding: '18px 20px', gap: 14 }}>
              {loadContext ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 className="animate-spin" size={32} color="#10b981" />
                </div>
              ) : (() => {
                const totalTar = tarefasFiltradas.length
                const conclTar = tarefasConcluidasList.length
                const pctTar = totalTar > 0 ? Math.round((conclTar / totalTar) * 100) : 100

                const tabs = [
                  { id: 'todas' as const, label: 'Todas', count: tarefasFiltradas.length, color: '#059669' },
                  { id: 'pendentes' as const, label: 'Pendentes', count: tarefasPendentesList.length, color: '#d97706' },
                  { id: 'concluidas' as const, label: 'Concluídas', count: tarefasConcluidasList.length, color: '#10b981' },
                ]

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14, minWidth: 0 }}>
                    {/* Segmented Pill Bar + Completion Chip */}
                    <div className="dashboard-segmented-bar-wrap">
                      <div className="dashboard-segmented-track">
                        {tabs.map(tab => {
                          const isActive = filtroTarefas === tab.id
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setFiltroTarefas(tab.id)}
                              className={`dashboard-segmented-btn ${isActive ? 'is-active' : ''}`}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="tarefas-segmented-pill"
                                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                  className="dashboard-segmented-pill-bg"
                                />
                              )}
                              <span className="dashboard-segmented-text" style={{ color: isActive ? '#065f46' : 'hsl(var(--text-secondary))' }}>
                                {tab.label}
                              </span>
                              <span
                                className="dashboard-segmented-badge"
                                style={{
                                  background: isActive ? '#059669' : 'rgba(148, 163, 184, 0.18)',
                                  color: isActive ? '#ffffff' : 'hsl(var(--text-secondary))'
                                }}
                              >
                                {tab.count}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="dashboard-mini-completion-pill" title="Taxa de conclusão das tarefas">
                        <span className="dashboard-mini-completion-dot" />
                        <span>{pctTar}% em dia</span>
                      </div>
                    </div>

                    {/* Content Area with Animated Empty State or Task Cards */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 175 }}>
                      <AnimatePresence mode="wait">
                        {tarefasExibidas.length === 0 ? (
                          <motion.div
                            key={`empty-${filtroTarefas}`}
                            initial={{ opacity: 0, scale: 0.96, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -6 }}
                            transition={{ duration: 0.25 }}
                            className="dashboard-modern-empty-state"
                            style={{
                              background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.04) 0%, rgba(20, 184, 166, 0.08) 100%)',
                              borderColor: 'rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            <div className="dashboard-empty-orb-wrap">
                              <div className="dashboard-empty-pulse-ring" style={{ borderColor: 'rgba(16, 185, 129, 0.28)' }} />
                              <div
                                className="dashboard-empty-icon-squircle"
                                style={{
                                  background: 'linear-gradient(135deg, #059669 0%, #14b8a6 100%)',
                                  boxShadow: '0 10px 24px -4px rgba(16, 185, 129, 0.4)'
                                }}
                              >
                                <CheckCircle2 size={26} strokeWidth={2.3} color="#ffffff" />
                              </div>
                              <span className="dashboard-empty-sparkle-badge">
                                <Sparkles size={11} />
                              </span>
                            </div>

                            <div className="dashboard-empty-title">
                              Nenhuma tarefa {filtroTarefas === 'pendentes' ? 'pendente' : filtroTarefas === 'concluidas' ? 'concluída' : 'encontrada'}
                            </div>
                            <div className="dashboard-empty-sub">
                              Tudo em dia por aqui! Sua rotina está organizada. 🎉
                            </div>

                            <Link href="/tarefas" className="dashboard-empty-action-pill" style={{ color: '#047857', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                              <span>Gerenciar tarefas</span>
                              <ArrowUpRight size={12} strokeWidth={2.5} />
                            </Link>
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`list-${filtroTarefas}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.22 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', overflowY: 'auto', maxHeight: '230px', paddingRight: '2px' }}
                          >
                            {tarefasExibidas.slice(0, 4).map((t: any, idx: number) => {
                              const isConcluida = t.status === 'concluida'
                              const accentColor = isConcluida ? '#10b981' : '#f59e0b'
                              const fmtPrazo = t.prazo ? t.prazo.split('-').reverse().join('/') : ''
                              return (
                                <motion.div
                                  key={t.id}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.28, delay: idx * 0.05 }}
                                >
                                  <Link
                                    href="/tarefas"
                                    className="dashboard-modern-item-row"
                                    style={{ borderLeft: `3.5px solid ${accentColor}` }}
                                  >
                                    <div
                                      className="dashboard-modern-item-icon"
                                      style={{
                                        background: isConcluida ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                        color: accentColor,
                                        borderColor: isConcluida ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.28)'
                                      }}
                                    >
                                      {isConcluida ? <CheckCircle2 size={15} strokeWidth={2.4} /> : <Clock size={15} strokeWidth={2.4} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: 800,
                                          color: 'hsl(var(--text-primary))',
                                          textDecoration: isConcluida ? 'line-through' : 'none',
                                          opacity: isConcluida ? 0.68 : 1,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {t.titulo}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: '11px', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                                        {fmtPrazo ? (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <CalendarDays size={11} />
                                            Prazo: {fmtPrazo}
                                          </span>
                                        ) : (
                                          <span>Sem prazo definido</span>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className="dashboard-modern-status-tag"
                                      style={{
                                        color: isConcluida ? '#047857' : '#b45309',
                                        background: isConcluida ? '#d1fae5' : '#fef3c7',
                                        borderColor: isConcluida ? '#6ee7b7' : '#fcd34d'
                                      }}
                                    >
                                      {isConcluida ? 'Concluída' : 'Pendente'}
                                    </span>
                                  </Link>
                                </motion.div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.article>

          {/* ═══ CARD: AGENDA (Ultra-Modern) ═══ */}
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="dashboard-card dashboard-modern-widget"
            style={{ height: '100%', position: 'relative' }}
          >
            {/* Header Ultra Moderno com Gradiente */}
            <div className="dashboard-card-header" style={{ 
              background: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 48%, #a855f7 100%)', 
            }}>
              <div className="dashboard-header-orb dashboard-header-orb-top" />
              <div className="dashboard-header-orb dashboard-header-orb-bottom" style={{ background: 'radial-gradient(circle, rgba(192, 132, 252, 0.28) 0%, transparent 70%)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                <div className="dashboard-header-icon-box">
                  <CalendarIcon size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="dashboard-header-title">Agenda</span>
                    <span className="dashboard-header-count-pill">
                      {eventosExibidos.length} {eventosExibidos.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </div>
                  <div className="dashboard-header-subtitle">Eventos e calendário escolar</div>
                </div>
              </div>

              <Link href="/calendario" className="dashboard-header-cta">
                <span>Ver todos</span>
                <ArrowUpRight size={13} strokeWidth={2.5} />
              </Link>
            </div>

            <div className="dashboard-card-body" style={{ padding: '18px 20px', gap: 14 }}>
              {loadContext ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 className="animate-spin" size={32} color="#8b5cf6" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14, minWidth: 0 }}>
                  {/* 7-Day Interactive Bento Strip */}
                  <div className="dashboard-agenda-bento-strip">
                    {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                      const d = new Date(hoje)
                      d.setDate(hoje.getDate() + offset)
                      const isSelected = diaSelecionadoOffset === offset
                      const isToday = offset === 0
                      const dayName = isToday ? 'HOJE' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '').toUpperCase()
                      const dStr = d.toISOString().slice(0, 10)
                      const qtdEventos = eventosAgenda.filter((e: any) => e.data === dStr).length

                      return (
                        <button
                          key={offset}
                          type="button"
                          onClick={() => setDiaSelecionadoOffset(offset)}
                          className={`dashboard-agenda-day-pill ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="agenda-selected-day-bg"
                              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                              className="dashboard-agenda-day-active-bg"
                            />
                          )}
                          {qtdEventos > 0 && (
                            <span className={`dashboard-agenda-day-badge ${isSelected ? 'is-selected' : ''}`}>
                              {qtdEventos}
                            </span>
                          )}
                          <span className="dashboard-agenda-day-name">{dayName}</span>
                          <span className="dashboard-agenda-day-num">
                            {d.getDate().toString().padStart(2, '0')}
                          </span>
                          <span
                            className="dashboard-agenda-day-dot"
                            style={{
                              opacity: qtdEventos > 0 ? 1 : 0,
                              background: isSelected ? '#ffffff' : '#8b5cf6'
                            }}
                          />
                        </button>
                      )
                    })}
                  </div>

                  {/* Events Timeline List */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 140 }}>
                    <AnimatePresence mode="wait">
                      {eventosExibidos.length === 0 ? (
                        <motion.div
                          key={`empty-day-${diaSelecionadoOffset}`}
                          initial={{ opacity: 0, scale: 0.96, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -6 }}
                          transition={{ duration: 0.22 }}
                          className="dashboard-modern-empty-state"
                          style={{
                            background: 'linear-gradient(145deg, rgba(124, 58, 237, 0.04) 0%, rgba(168, 85, 247, 0.08) 100%)',
                            borderColor: 'rgba(139, 92, 246, 0.2)',
                            padding: '18px 14px'
                          }}
                        >
                          <div
                            className="dashboard-empty-icon-squircle"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 14,
                              background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
                              boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.35)',
                              marginBottom: 8
                            }}
                          >
                            <CalendarDays size={20} strokeWidth={2.3} color="#ffffff" />
                          </div>
                          <div className="dashboard-empty-title" style={{ fontSize: '14px' }}>
                            Nenhum evento {diaSelecionadoOffset === 0 ? 'para hoje' : 'neste dia'}
                          </div>
                          <div className="dashboard-empty-sub" style={{ fontSize: '11.5px' }}>
                            Dia livre no calendário escolar — aproveite para planejar! 📅
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`events-day-${diaSelecionadoOffset}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.22 }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', overflowY: 'auto', maxHeight: '220px', paddingRight: '2px' }}
                        >
                          {eventosExibidos.slice(0, 4).map((e: any, idx: number) => {
                            const evColor = e.cor || '#7c3aed'
                            return (
                              <motion.div
                                key={e.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.26, delay: idx * 0.05 }}
                              >
                                <Link
                                  href="/calendario"
                                  className="dashboard-agenda-event-card"
                                  style={{ borderLeft: `4px solid ${evColor}` }}
                                >
                                  <div
                                    className="dashboard-agenda-event-icon"
                                    style={{
                                      background: `${evColor}15`,
                                      color: evColor,
                                      border: `1px solid ${evColor}30`
                                    }}
                                  >
                                    <CalendarDays size={15} strokeWidth={2.3} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="dashboard-agenda-event-title">
                                      {e.titulo}
                                    </div>
                                    <div className="dashboard-agenda-event-meta">
                                      <Clock size={11} style={{ color: evColor, flexShrink: 0 }} />
                                      <span>
                                        {e.horaInicio
                                          ? `${e.horaInicio}${e.horaFim ? ` às ${e.horaFim}` : ''}`
                                          : (diaSelecionadoOffset === 0 ? 'Hoje • Dia inteiro' : 'Evento escolar • Dia inteiro')}
                                      </span>
                                    </div>
                                  </div>
                                  <span
                                    className="dashboard-agenda-event-chip"
                                    style={{
                                      color: evColor,
                                      background: `${evColor}12`,
                                      border: `1px solid ${evColor}28`
                                    }}
                                  >
                                    {diaSelecionadoOffset === 0 ? 'Hoje' : 'Agendado'}
                                  </span>
                                </Link>
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </motion.article>
        </div>

        {/* ── Coluna 3: Aniversários & Ocorrências ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          
          {/* ═══ CARD: ANIVERSARIANTES (Ultra-Modern) ═══ */}
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="dashboard-card dashboard-modern-widget"
          >
            {/* Header Ultra Moderno com Gradiente */}
            <div className="dashboard-card-header" style={{ 
              background: 'linear-gradient(135deg, #831843 0%, #db2777 48%, #f43f5e 100%)', 
            }}>
              <div className="dashboard-header-orb dashboard-header-orb-top" />
              <div className="dashboard-header-orb dashboard-header-orb-bottom" style={{ background: 'radial-gradient(circle, rgba(251, 113, 133, 0.3) 0%, transparent 70%)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                <div className="dashboard-header-icon-box">
                  <Cake size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="dashboard-header-title">
                      Aniversariantes de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
                    </span>
                    {aniversariantes.length > 0 && (
                      <span className="dashboard-header-count-pill">
                        {aniversariantes.length}
                      </span>
                    )}
                  </div>
                  <div className="dashboard-header-subtitle">Comemorações do mês</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalAnivOpen(true)}
                className="dashboard-header-cta"
                style={{ cursor: 'pointer' }}
              >
                <span>Ver todos</span>
                <ArrowUpRight size={13} strokeWidth={2.5} />
              </button>
            </div>

            <div className="dashboard-card-body" style={{ padding: '18px 20px', gap: 12 }}>
              {loadAniv ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 className="animate-spin" size={32} color="#ec4899" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {aniversariantes.length === 0 ? (
                      <div
                        className="dashboard-modern-empty-state"
                        style={{
                          background: 'linear-gradient(145deg, rgba(236, 72, 153, 0.04) 0%, rgba(244, 63, 94, 0.08) 100%)',
                          borderColor: 'rgba(236, 72, 153, 0.2)'
                        }}
                      >
                        <Cake size={26} color="#ec4899" style={{ marginBottom: 6 }} />
                        <div className="dashboard-empty-title" style={{ fontSize: '14px' }}>Nenhum aniversariante neste mês</div>
                        <div className="dashboard-empty-sub" style={{ fontSize: '11.5px' }}>Novas comemorações aparecerão aqui automaticamente.</div>
                      </div>
                    ) : (
                      aniversariantes.slice(0, 3).map((aniv: any, idx: number) => {
                        const isHoje = Number(aniv.dia) === hoje.getDate()
                        return (
                          <motion.div
                            key={aniv.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, delay: 0.06 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            onClick={() => setModalAnivOpen(true)}
                            className={`dashboard-birthday-row ${isHoje ? 'is-today' : ''}`}
                          >
                            {/* Avatar with Gradient Ring */}
                            <div className={`dashboard-birthday-avatar-ring ${isHoje ? 'is-today' : ''}`}>
                              <div className="dashboard-birthday-avatar-inner">
                                {aniv.foto ? (
                                  <img src={aniv.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  getInitials(aniv.nome)
                                )}
                              </div>
                              {isHoje && (
                                <span className="dashboard-birthday-today-sparkle" title="Aniversário hoje!">
                                  🎂
                                </span>
                              )}
                            </div>

                            {/* Student Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="dashboard-birthday-name">{aniv.nome}</div>
                                {isHoje && (
                                  <span className="dashboard-birthday-today-pill">Parabéns hoje!</span>
                                )}
                              </div>
                              <div className="dashboard-birthday-meta">
                                <span className="dashboard-birthday-role-badge">ALUNO</span>
                                <span style={{ opacity: 0.4 }}>•</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aniv.turma}</span>
                              </div>
                            </div>

                            {/* Calendar Day Tile */}
                            <div className={`dashboard-birthday-date-tile ${isHoje ? 'is-today' : ''}`}>
                              <span className="dashboard-birthday-date-label">DIA</span>
                              <span className="dashboard-birthday-date-num">
                                {String(aniv.dia).padStart(2, '0')}
                              </span>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>

                  {/* Ultra Modern Footer CTA Button */}
                  <button
                    type="button"
                    onClick={() => setModalAnivOpen(true)}
                    className="dashboard-modern-footer-btn"
                    style={{
                      color: '#be185d',
                      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.12) 100%)',
                      borderColor: 'rgba(236, 72, 153, 0.22)'
                    }}
                  >
                    <Cake size={14} strokeWidth={2.3} />
                    <span>Ver todos os aniversariantes ({aniversariantes.length})</span>
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </motion.article>

          {/* ═══ CARD: OCORRÊNCIAS RECENTES (Ultra-Modern) ═══ */}
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="dashboard-card dashboard-modern-widget"
            style={{ minWidth: 0, maxWidth: '100%', height: '100%' }}
          >
            {/* Header Ultra Moderno com Gradiente */}
            <div className="dashboard-card-header" style={{ 
              background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 48%, #f59e0b 100%)', 
            }}>
              <div className="dashboard-header-orb dashboard-header-orb-top" />
              <div className="dashboard-header-orb dashboard-header-orb-bottom" style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.28) 0%, transparent 70%)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                <div className="dashboard-header-icon-box">
                  <AlertTriangle size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="dashboard-header-title">Ocorrências Recentes</span>
                    {!isResolvingPerms && !hideOcorrenciasKpi && ocorrencias.length > 0 && (
                      <span className="dashboard-header-count-pill">
                        {ocorrencias.length}
                      </span>
                    )}
                  </div>
                  <div className="dashboard-header-subtitle">Registros e ciência disciplinar</div>
                </div>
              </div>

              <Link href="/academico/ocorrencias" className="dashboard-header-cta">
                <span>Ver todas</span>
                <ArrowUpRight size={13} strokeWidth={2.5} />
              </Link>
            </div>

            <div className="dashboard-card-body" style={{ padding: '18px 20px', gap: 12 }}>
              {loadOcorr ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 className="animate-spin" size={32} color="#f59e0b" />
                </div>
              ) : (() => {
                const totalOc = ocorrencias.length
                const confirmadasOc = ocorrencias.filter((o: any) => !!o.ciencia_responsavel).length
                const aguardandoOc = Math.max(0, totalOc - confirmadasOc)
                const pctConfirmada = totalOc > 0 ? Math.round((confirmadasOc / totalOc) * 100) : 100

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12, minWidth: 0, width: '100%' }}>
                    {/* Mini Telemetry Strip for Ocorrências */}
                    {!isResolvingPerms && !hideOcorrenciasKpi && totalOc > 0 && (
                      <div className="dashboard-ocorr-telemetry-strip">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="dashboard-ocorr-stat-chip is-emerald">
                              <CheckCircle2 size={11} strokeWidth={2.5} />
                              <span>{confirmadasOc} confirmada{confirmadasOc === 1 ? '' : 's'}</span>
                            </span>
                            <span className="dashboard-ocorr-stat-chip is-amber">
                              <Clock size={11} strokeWidth={2.5} />
                              <span>{aguardandoOc} aguardando ciência</span>
                            </span>
                          </div>
                          <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                            {pctConfirmada}% ciência
                          </span>
                        </div>
                        <div className="dashboard-ocorr-mini-bar">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pctConfirmada}%` }}
                            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                            style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 999 }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 0, width: '100%' }}>
                      {ocorrencias.length === 0 ? (
                        <div
                          className="dashboard-modern-empty-state"
                          style={{
                            background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.04) 0%, rgba(16, 185, 129, 0.06) 100%)',
                            borderColor: 'rgba(245, 158, 11, 0.2)'
                          }}
                        >
                          <CheckCircle2 size={26} color="#10b981" style={{ marginBottom: 6 }} />
                          <div className="dashboard-empty-title" style={{ fontSize: '14px' }}>Nenhuma ocorrência registrada</div>
                          <div className="dashboard-empty-sub" style={{ fontSize: '11.5px' }}>Ambiente escolar tranquilo e sem registros pendentes.</div>
                        </div>
                      ) : (
                        ocorrencias.slice(0, 3).map((oc: any, idx: number) => {
                          const isConfirmada = !!oc.ciencia_responsavel
                          const color = isConfirmada ? '#059669' : '#d97706'
                          const accentBorder = isConfirmada ? '#10b981' : '#f59e0b'

                          let dataStr = oc.dataRegistro || oc.data_registro || oc.created_at || ''
                          let fmtDate = ''
                          if (dataStr) {
                            const d = new Date(dataStr)
                            if (!isNaN(d.getTime())) {
                              fmtDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} • ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                            }
                          }

                          const rawDesc = oc.descricao || ''
                          const lancadoMatch = rawDesc.match(/\[Lançado por:\s*([^\]]+)\]/i)
                          const lancadoAutor = lancadoMatch
                            ? lancadoMatch[1].replace(/\s+em\s+\d{2}\/\d{2}\/\d{4}.*$/i, '').trim()
                            : (oc.responsavel || '').trim()
                          const primeiroNomeAutor = lancadoAutor.split(/\s+/)[0] || ''

                          const cleanDescricao = rawDesc
                            .replace(/\[(?:Lançado|Editado|Confirmado) por:[^\]]*\]/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim()

                          const tituloLimpo = cleanDescricao || 'Ocorrência Disciplinar'

                          return (
                            <motion.div
                              key={oc.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.32, delay: 0.08 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <Link
                                href="/academico/ocorrencias"
                                className={`dashboard-ocorr-card ${isConfirmada ? 'is-confirmed' : 'is-pending'}`}
                                style={{ borderLeft: `4px solid ${accentBorder}` }}
                              >
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                  <div
                                    title={tituloLimpo}
                                    className="dashboard-ocorr-title"
                                  >
                                    {tituloLimpo}
                                  </div>
                                  <div className="dashboard-ocorr-meta-row">
                                    <span className="dashboard-ocorr-student">
                                      <Users size={11} style={{ flexShrink: 0, color }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {oc.alunoNome || 'Aluno'}
                                      </span>
                                    </span>
                                    {primeiroNomeAutor && (
                                      <span className="dashboard-ocorr-author-chip">
                                        por {primeiroNomeAutor}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="dashboard-ocorr-right-col">
                                  <span className={`dashboard-ocorr-status-pill ${isConfirmada ? 'is-confirmed' : 'is-pending'}`}>
                                    {isConfirmada ? (
                                      <>
                                        <CheckCircle2 size={10} strokeWidth={2.5} />
                                        <span>Confirmada</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="dashboard-ocorr-pulse-dot" />
                                        <span>Aguardando</span>
                                      </>
                                    )}
                                  </span>
                                  {fmtDate && (
                                    <span className="dashboard-ocorr-date">{fmtDate}</span>
                                  )}
                                </div>
                              </Link>
                            </motion.div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.article>

        </div>

      </div>

      {/* ═══ Active Users Banner (Ultra-Modern Telemetry Bento Card) ═══════ */}
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="dashboard-engagement-banner"
      >
        {/* Top Luminous Animated Accent Beam */}
        <div className="dashboard-engagement-top-beam" />

        {/* Ambient Mesh Glow Orbs */}
        <div className="dashboard-engagement-orb dashboard-engagement-orb-1" />
        <div className="dashboard-engagement-orb dashboard-engagement-orb-2" />
        <div className="dashboard-engagement-orb dashboard-engagement-orb-3" />
        <div className="dashboard-engagement-grid-bg" />

        {loadUsuarios ? (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 0', position: 'relative', zIndex: 2 }}>
            <Loader2 className="animate-spin" size={32} color="#7c3aed" />
          </div>
        ) : (() => {
          const totalAtivos = statsUsuarios.total || 0
          const totalGeral = statsUsuarios.totalGeral || 0
          const totalPendentes = Math.max(0, totalGeral - totalAtivos)
          const pctGeralRaw = totalGeral > 0 ? (totalAtivos / totalGeral) * 100 : 0
          const pctGeral = Math.round(pctGeralRaw)

          const pctColabRaw = statsUsuarios.colabTotal > 0 ? (statsUsuarios.colab / statsUsuarios.colabTotal) * 100 : 0
          const pctAlunosRaw = statsUsuarios.alunosTotal > 0 ? (statsUsuarios.alunos / statsUsuarios.alunosTotal) * 100 : 0
          const pctRespsRaw = statsUsuarios.respsTotal > 0 ? (statsUsuarios.resps / statsUsuarios.respsTotal) * 100 : 0

          const pctColab = Math.round(pctColabRaw)
          const pctAlunos = Math.round(pctAlunosRaw)
          const pctResps = Math.round(pctRespsRaw)

          // Share of active users for stacked distribution bar
          const shareColab = totalAtivos > 0 ? (statsUsuarios.colab / totalAtivos) * 100 : 0
          const shareAlunos = totalAtivos > 0 ? (statsUsuarios.alunos / totalAtivos) * 100 : 0
          const shareResps = totalAtivos > 0 ? Math.max(0, 100 - shareColab - shareAlunos) : 0

          const rolesConfig = [
            {
              key: 'colab' as const,
              label: 'Colaboradores',
              shortTag: 'EQUIPE',
              subtitle: 'Equipe & Docentes',
              active: statsUsuarios.colab,
              total: statsUsuarios.colabTotal,
              pending: Math.max(0, statsUsuarios.colabTotal - statsUsuarios.colab),
              pct: pctColab,
              pctExact: pctColabRaw,
              color: '#7c3aed',
              accent: '#8b5cf6',
              lightColor: '#f3e8ff',
              borderColor: 'rgba(139, 92, 246, 0.28)',
              gradient: 'linear-gradient(90deg, #6d28d9 0%, #8b5cf6 50%, #c084fc 100%)',
              cardBg: 'linear-gradient(145deg, rgba(139, 92, 246, 0.06) 0%, rgba(255, 255, 255, 0.85) 100%)',
              iconBg: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
              glow: 'rgba(139, 92, 246, 0.22)',
              strokeId: 'url(#eng-ring-colab)',
              icon: <ShieldCheck size={17} strokeWidth={2.3} />,
              wavePath: 'M 0 18 C 18 6, 36 26, 54 14 S 82 4, 100 10'
            },
            {
              key: 'alunos' as const,
              label: 'Alunos',
              shortTag: 'ALUNOS',
              subtitle: 'Corpo Discente',
              active: statsUsuarios.alunos,
              total: statsUsuarios.alunosTotal,
              pending: Math.max(0, statsUsuarios.alunosTotal - statsUsuarios.alunos),
              pct: pctAlunos,
              pctExact: pctAlunosRaw,
              color: '#2563eb',
              accent: '#3b82f6',
              lightColor: '#dbeafe',
              borderColor: 'rgba(59, 130, 246, 0.28)',
              gradient: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #38bdf8 100%)',
              cardBg: 'linear-gradient(145deg, rgba(59, 130, 246, 0.06) 0%, rgba(255, 255, 255, 0.85) 100%)',
              iconBg: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
              glow: 'rgba(59, 130, 246, 0.22)',
              strokeId: 'url(#eng-ring-alunos)',
              icon: <GraduationCap size={17} strokeWidth={2.3} />,
              wavePath: 'M 0 22 C 20 18, 40 26, 60 16 S 84 12, 100 8'
            },
            {
              key: 'resps' as const,
              label: 'Responsáveis',
              shortTag: 'FAMÍLIAS',
              subtitle: 'Famílias Conectadas',
              active: statsUsuarios.resps,
              total: statsUsuarios.respsTotal,
              pending: Math.max(0, statsUsuarios.respsTotal - statsUsuarios.resps),
              pct: pctResps,
              pctExact: pctRespsRaw,
              color: '#059669',
              accent: '#10b981',
              lightColor: '#d1fae5',
              borderColor: 'rgba(16, 185, 129, 0.28)',
              gradient: 'linear-gradient(90deg, #047857 0%, #10b981 50%, #34d399 100%)',
              cardBg: 'linear-gradient(145deg, rgba(16, 185, 129, 0.06) 0%, rgba(255, 255, 255, 0.85) 100%)',
              iconBg: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              glow: 'rgba(16, 185, 129, 0.22)',
              strokeId: 'url(#eng-ring-resps)',
              icon: <Users size={17} strokeWidth={2.3} />,
              wavePath: 'M 0 20 C 16 10, 34 24, 52 12 S 78 16, 100 6'
            }
          ]

          const focusedRole = rolesConfig.find(r => r.key === engRoleFocus) || null
          const displayPct = focusedRole ? focusedRole.pct : pctGeral
          const displayPctExact = focusedRole ? focusedRole.pctExact : pctGeralRaw
          const displayStroke = focusedRole ? focusedRole.strokeId : 'url(#eng-ring-main)'
          const displayColor = focusedRole ? focusedRole.color : '#6d28d9'
          const displayTag = focusedRole ? focusedRole.shortTag : 'ADESÃO'

          const outerCircumference = 2 * Math.PI * 44 // r=44 -> ~276.46
          const outerOffset = outerCircumference - (outerCircumference * Math.min(100, Math.max(0, displayPctExact))) / 100

          const innerCircumference = 2 * Math.PI * 34 // r=34 -> ~213.63
          const innerOffset = innerCircumference - (innerCircumference * Math.min(100, Math.max(0, pctColabRaw))) / 100

          return (
            <div className="dashboard-engagement-inner">
              {/* ── LEFT HERO: Orbital Telemetry Gauge + Main Metrics ── */}
              <div className="dashboard-engagement-left">
                {/* Multi-Layer Orbital Radial Gauge */}
                <div className="dashboard-engagement-circle">
                  <div
                    className="dashboard-engagement-circle-glow"
                    style={{ background: `radial-gradient(circle, ${focusedRole ? focusedRole.glow : 'rgba(139, 92, 246, 0.24)'} 0%, transparent 70%)` }}
                  />
                  <svg viewBox="0 0 108 108" className="dashboard-engagement-svg">
                    <defs>
                      <linearGradient id="eng-ring-main" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6d28d9" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <linearGradient id="eng-ring-colab" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6d28d9" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                      <linearGradient id="eng-ring-alunos" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1d4ed8" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                      <linearGradient id="eng-ring-resps" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#047857" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                      <filter id="eng-ring-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor={displayColor} floodOpacity="0.35" />
                      </filter>
                    </defs>

                    {/* Rotating Outer Orbital Dashed Track */}
                    <circle
                      cx="54"
                      cy="54"
                      r="50"
                      fill="none"
                      stroke="rgba(139, 92, 246, 0.18)"
                      strokeWidth="1.2"
                      strokeDasharray="3 5"
                      className="dashboard-engagement-orbit-ring"
                    />

                    {/* Main Track */}
                    <circle
                      cx="54"
                      cy="54"
                      r="44"
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.16)"
                      strokeWidth="8.5"
                    />

                    {/* Subtle Inner Telemetry Track & Arc */}
                    <circle
                      cx="54"
                      cy="54"
                      r="34"
                      fill="none"
                      stroke="rgba(139, 92, 246, 0.08)"
                      strokeWidth="3.5"
                    />
                    <motion.circle
                      cx="54"
                      cy="54"
                      r="34"
                      fill="none"
                      stroke="url(#eng-ring-colab)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={innerCircumference}
                      initial={{ strokeDashoffset: innerCircumference }}
                      animate={{ strokeDashoffset: innerOffset }}
                      transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                      style={{ opacity: 0.45 }}
                    />

                    {/* Primary Animated Progress Ring */}
                    <motion.circle
                      cx="54"
                      cy="54"
                      r="44"
                      fill="none"
                      stroke={displayStroke}
                      strokeWidth="8.5"
                      strokeLinecap="round"
                      strokeDasharray={outerCircumference}
                      initial={{ strokeDashoffset: outerCircumference }}
                      animate={{ strokeDashoffset: outerOffset }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      filter="url(#eng-ring-glow)"
                    />
                  </svg>

                  {/* Center Readout */}
                  <div className="dashboard-engagement-circle-center">
                    <motion.span
                      key={displayPct}
                      initial={{ opacity: 0, scale: 0.85, y: 3 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="dashboard-engagement-pct"
                      style={{ color: displayColor }}
                    >
                      {displayPct}<span className="dashboard-engagement-pct-sign">%</span>
                    </motion.span>
                    <span
                      className="dashboard-engagement-circle-tag"
                      style={{
                        color: displayColor,
                        background: `${displayColor}14`
                      }}
                    >
                      {displayTag}
                    </span>
                  </div>
                </div>

                {/* Main Telemetry Copy & Distribution Bar */}
                <div className="dashboard-engagement-hero-copy">
                  <div className="dashboard-engagement-badge-row">
                    <span className="dashboard-engagement-live-pill">
                      <span className="dashboard-engagement-live-dot" />
                      <span>TELEMETRIA DE ACESSOS</span>
                    </span>
                    <span className="dashboard-engagement-pending-pill">
                      <Sparkles size={11} />
                      <span>
                        {isResolvingPerms || hideTotalAlunosKpi
                          ? '•••• aguardando 1º acesso'
                          : `${formatNumber(totalPendentes)} aguardando 1º acesso`}
                      </span>
                    </span>
                  </div>

                  <div className="dashboard-engagement-title-row">
                    <h3 className="dashboard-engagement-title">Engajamento do Sistema</h3>
                  </div>

                  <div className="dashboard-engagement-counter-row">
                    <motion.div
                      key={focusedRole ? focusedRole.key : 'all'}
                      initial={{ opacity: 0.6, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span
                        className="dashboard-engagement-count"
                        style={{
                          background: focusedRole
                            ? focusedRole.gradient
                            : 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #2563eb 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        {isResolvingPerms || hideTotalAlunosKpi
                          ? '••••'
                          : formatNumber(focusedRole ? focusedRole.active : totalAtivos)}
                      </span>
                      <span className="dashboard-engagement-total-label">
                        / {isResolvingPerms || hideTotalAlunosKpi
                          ? '••••'
                          : formatNumber(focusedRole ? focusedRole.total : totalGeral)} ativos
                      </span>
                      <span className="dashboard-engagement-context-chip">
                        {focusedRole ? focusedRole.label : 'Primeiro acesso realizado'}
                      </span>
                    </motion.div>
                  </div>

                  {/* Multi-Segment Active Distribution Bar */}
                  <div className="dashboard-engagement-distribution">
                    <div className="dashboard-engagement-dist-bar">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${shareColab}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                        className="dashboard-engagement-dist-seg"
                        style={{
                          background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)',
                          opacity: engRoleFocus && engRoleFocus !== 'colab' ? 0.35 : 1
                        }}
                        title={`Colaboradores: ${statsUsuarios.colab} (${Math.round(shareColab)}% dos ativos)`}
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${shareAlunos}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                        className="dashboard-engagement-dist-seg"
                        style={{
                          background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                          opacity: engRoleFocus && engRoleFocus !== 'alunos' ? 0.35 : 1
                        }}
                        title={`Alunos: ${statsUsuarios.alunos} (${Math.round(shareAlunos)}% dos ativos)`}
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${shareResps}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                        className="dashboard-engagement-dist-seg"
                        style={{
                          background: 'linear-gradient(90deg, #059669, #34d399)',
                          opacity: engRoleFocus && engRoleFocus !== 'resps' ? 0.35 : 1
                        }}
                        title={`Responsáveis: ${statsUsuarios.resps} (${Math.round(shareResps)}% dos ativos)`}
                      />
                    </div>

                    <div className="dashboard-engagement-dist-legend">
                      {rolesConfig.map(r => {
                        const share = totalAtivos > 0 ? Math.round((r.active / totalAtivos) * 100) : 0
                        return (
                          <button
                            key={r.key}
                            type="button"
                            onMouseEnter={() => setEngRoleFocus(r.key)}
                            onMouseLeave={() => setEngRoleFocus(null)}
                            onClick={() => setEngRoleFocus(prev => prev === r.key ? null : r.key)}
                            className={`dashboard-engagement-legend-item ${engRoleFocus === r.key ? 'is-active' : ''}`}
                          >
                            <span className="dashboard-engagement-legend-dot" style={{ background: r.accent }} />
                            <span className="dashboard-engagement-legend-name">{r.label}</span>
                            <span className="dashboard-engagement-legend-val" style={{ color: r.color }}>{share}%</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT ZONE: 3 Interactive Role Bento Cards ── */}
              <div className="dashboard-engagement-cards">
                {rolesConfig.map((role, idx) => {
                  const isFocused = engRoleFocus === role.key
                  return (
                    <motion.div
                      key={role.key}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.1 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      onMouseEnter={() => setEngRoleFocus(role.key)}
                      onMouseLeave={() => setEngRoleFocus(null)}
                      onClick={() => setEngRoleFocus(prev => prev === role.key ? null : role.key)}
                      className={`dashboard-role-card ${isFocused ? 'is-focused' : ''}`}
                      style={{
                        background: role.cardBg,
                        borderColor: isFocused ? role.accent : role.borderColor,
                        boxShadow: isFocused
                          ? `0 14px 28px -8px ${role.glow}, 0 0 0 2px ${role.accent}35`
                          : '0 4px 16px rgba(15, 23, 42, 0.03)'
                      }}
                    >
                      {/* Top Accent Gradient Strip */}
                      <div className="dashboard-role-card-bar" style={{ background: role.gradient }} />

                      {/* Corner Ambient Glow */}
                      <div
                        className="dashboard-role-card-glow"
                        style={{ background: `radial-gradient(circle, ${role.glow} 0%, transparent 70%)` }}
                      />

                      {/* Header Row: Squircle Icon + Role Title + Pct Pill */}
                      <div className="dashboard-role-card-head">
                        <div className="dashboard-role-icon-box" style={{ background: role.iconBg, boxShadow: `0 6px 14px ${role.glow}` }}>
                          {role.icon}
                        </div>
                        <div className="dashboard-role-head-text">
                          <div className="dashboard-role-label">{role.label}</div>
                          <div className="dashboard-role-subtitle">{role.subtitle}</div>
                        </div>
                        <div
                          className="dashboard-role-pct-badge"
                          style={{
                            color: role.color,
                            background: role.lightColor,
                            border: `1px solid ${role.borderColor}`
                          }}
                        >
                          {role.pct}%
                        </div>
                      </div>

                      {/* Middle Row: Numbers + Mini Sparkline */}
                      <div className="dashboard-role-metrics-row">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span className="dashboard-role-value" style={{ color: role.color }}>
                            {isResolvingPerms || (hideTotalAlunosKpi && role.key !== 'colab')
                              ? '••••'
                              : formatNumber(role.active)}
                          </span>
                          <span className="dashboard-role-total">
                            / {isResolvingPerms || (hideTotalAlunosKpi && role.key !== 'colab')
                              ? '••••'
                              : formatNumber(role.total)}
                          </span>
                        </div>

                        <svg viewBox="0 0 100 28" className="dashboard-role-mini-wave" preserveAspectRatio="none">
                          <path
                            d={role.wavePath}
                            fill="none"
                            stroke={role.accent}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            style={{ opacity: 0.75 }}
                          />
                        </svg>
                      </div>

                      {/* Animated Progress Bar with Shimmer */}
                      <div className="dashboard-role-progress">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(role.active > 0 ? 4 : 0, Math.min(100, role.pctExact))}%` }}
                          transition={{ duration: 1.15, delay: 0.2 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                          className="dashboard-role-progress-fill"
                          style={{
                            background: role.gradient,
                            boxShadow: `0 0 10px ${role.glow}`
                          }}
                        >
                          <div className="dashboard-role-progress-shimmer" />
                        </motion.div>
                      </div>

                      {/* Footer Micro-Status */}
                      <div className="dashboard-role-footer">
                        <span className="dashboard-role-footer-status">
                          <Activity size={11} style={{ color: role.accent, flexShrink: 0 }} />
                          <span>
                            {role.pending === 0
                              ? '100% ativado'
                              : isResolvingPerms || (hideTotalAlunosKpi && role.key !== 'colab')
                                ? '•••• pendentes'
                                : `${formatNumber(role.pending)} pendente${role.pending === 1 ? '' : 's'}`}
                          </span>
                        </span>
                        <span className="dashboard-role-footer-pct" style={{ color: role.color }}>
                          {role.pct >= 80 ? 'Ótimo' : role.pct >= 35 ? 'Em avanço' : 'Atenção'}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </motion.article>

      
      {/* ── Modal de Aniversariantes ──────────────────────────── */}
      <AnimatePresence>
        {modalAnivOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setModalAnivOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ 
                position: 'relative', width: '100%', maxWidth: 800, maxHeight: '85vh', 
                background: 'hsl(var(--bg-surface))', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #9d174d 0%, #db2777 45%, #f43f5e 100%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-20px', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.35)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
                    <Cake size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>Aniversariantes do Mês</h2>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: '4px 0 0 0', fontWeight: 600 }}>
                      Mês de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalAnivOpen(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', zIndex: 1 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Filters */}
              <div style={{ padding: '20px 32px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8, textTransform: 'uppercase' }}>Ano Letivo</label>
                  <select 
                    value={anivFiltroAno} 
                    onChange={e => { setAnivFiltroAno(e.target.value); setAnivFiltroTurma('Todas') }}
                    style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))', outline: 'none' }}
                  >
                    <option value="Todos">Todos os Anos Letivos</option>
                    {cfgCalendarioLetivo.map((c: any) => (
                      <option key={c.id} value={String(c.ano)}>{c.ano}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8, textTransform: 'uppercase' }}>Turma</label>
                  <select 
                    value={anivFiltroTurma} 
                    onChange={e => setAnivFiltroTurma(e.target.value)}
                    style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))', outline: 'none' }}
                  >
                    <option value="Todas">Todas as Turmas</option>
                    {turmas.filter((t: any) => anivFiltroAno === 'Todos' || String(t.ano || t.ano_letivo) === anivFiltroAno).map((t: any) => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* List */}
              <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-surface))' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {aniversariantes
                    .filter((a: any) => anivFiltroAno === 'Todos' || a.anoLetivoId === anivFiltroAno)
                    .filter((a: any) => anivFiltroTurma === 'Todas' || a.turma === anivFiltroTurma)
                    .map((aniv: any) => {
                      const isHoje = Number(aniv.dia) === hoje.getDate();
                      return (
                        <div key={aniv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: '16px', border: isHoje ? '1px solid #fce7f3' : '1px solid hsl(var(--border-subtle))', background: isHoje ? 'rgba(236, 72, 153, 0.04)' : 'hsl(var(--bg-surface))' }}>
                          <div style={{ width: 56, height: 56, borderRadius: '50%', background: isHoje ? 'rgba(236, 72, 153, 0.1)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isHoje ? '#ec4899' : '#64748b', fontWeight: 800, fontSize: '18px', flexShrink: 0, border: isHoje ? '2px solid #fbcfe8' : '2px solid #e2e8f0' }}>
                            {aniv.foto ? <img src={aniv.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(aniv.nome)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aniv.nome}</div>
                            <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>Turma • {aniv.turma}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isHoje ? '#ec4899' : '#fff', border: isHoje ? 'none' : '1.5px solid #e2e8f0', padding: '8px 12px', borderRadius: 12, color: isHoje ? '#fff' : '#1e293b' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, color: isHoje ? 'rgba(255,255,255,0.8)' : '#94a3b8' }}>Dia</span>
                            <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{aniv.dia}</span>
                          </div>
                        </div>
                      );
                    })}
                  {aniversariantes
                    .filter((a: any) => anivFiltroAno === 'Todos' || a.anoLetivoId === anivFiltroAno)
                    .filter((a: any) => anivFiltroTurma === 'Todas' || a.turma === anivFiltroTurma).length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 15, fontWeight: 600 }}>
                      Nenhum aniversariante encontrado para os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
