'use client'

import React, { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookMarked,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  PenTool,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  EVALUATION_TYPE_META,
  EvaluationType,
  ProfessorTaskItem,
  formatRelativeDateTime,
  BimestreInfo,
  findLastBimestreOfYear,
} from './simuladosDashboardUtils'

export interface ProfessorDashboardViewProps {
  userName?: string
  loading: boolean
  pendingTasks: ProfessorTaskItem[]
  submittedTasks: ProfessorTaskItem[]
  stats: {
    provasPendentes: number
    simuladosPendentes: number
    redacoesPendentes: number
    provasTotal?: number
    simuladosTotal?: number
    redacoesTotal?: number
    totalEnviados?: number
    totalGeral?: number
  }
  bimestres?: BimestreInfo[]
  selectedBimestre?: string
  onBimestreChange?: (id: string) => void
}

type ProfTab = 'pendentes' | 'ajustes' | 'enviados' | 'todas'
type SortOption = 'prazo' | 'recentes' | 'titulo'

export function ProfessorDashboardView({
  userName,
  loading,
  pendingTasks,
  submittedTasks,
  stats,
  bimestres = [],
  selectedBimestre: selectedBimestreProp,
  onBimestreChange,
}: ProfessorDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<ProfTab>('pendentes')
  const [typeFilter, setTypeFilter] = useState<'all' | EvaluationType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisciplina, setSelectedDisciplina] = useState<'all' | string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('prazo')
  const [helpModalOpen, setHelpModalOpen] = useState(false)

  // Compute greeting based on local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const formattedCurrentDate = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  // Determina automaticamente o último bimestre do ano
  const lastBimestreId = useMemo(() => findLastBimestreOfYear(bimestres || []), [bimestres])

  // Estado do bimestre selecionado: prop, último do ano, ou 'todos'
  const [selectedBimestre, setSelectedBimestre] = useState<string>(() => {
    return selectedBimestreProp || lastBimestreId || 'todos'
  })

  useEffect(() => {
    if (selectedBimestreProp) {
      setSelectedBimestre(selectedBimestreProp)
    } else if (lastBimestreId && selectedBimestre === 'todos') {
      setSelectedBimestre(lastBimestreId)
    }
  }, [selectedBimestreProp, lastBimestreId])

  const handleBimestreChange = (newBimId: string) => {
    setSelectedBimestre(newBimId)
    onBimestreChange?.(newBimId)
  }

  const isTaskInBimestre = (t: ProfessorTaskItem, bimId: string) => {
    if (!bimId || bimId === 'todos') return true
    if (t.bimestreId && t.bimestreId === bimId) return true
    const bimObj = bimestres.find((b) => b.id === bimId)
    if (bimObj && t.bimestre) {
      const tBim = t.bimestre.toLowerCase().trim()
      const bNome = bimObj.nome.toLowerCase().trim()
      if (tBim === bNome || tBim.includes(bNome) || bNome.includes(tBim)) return true
      const tOrd = tBim.match(/(\d+)\s*[º°ªa]/)?.[1]
      const bOrd = bNome.match(/(\d+)\s*[º°ªa]/)?.[1]
      if (tOrd && bOrd && tOrd === bOrd) return true
    }
    return false
  }

  // Tarefas filtradas pelo bimestre selecionado
  const scopedPendingTasks = useMemo(() => {
    return pendingTasks.filter((t) => isTaskInBimestre(t, selectedBimestre))
  }, [pendingTasks, selectedBimestre, bimestres])

  const scopedSubmittedTasks = useMemo(() => {
    return submittedTasks.filter((t) => isTaskInBimestre(t, selectedBimestre))
  }, [submittedTasks, selectedBimestre, bimestres])

  const scopedAllTasks = useMemo(() => {
    return [...scopedPendingTasks, ...scopedSubmittedTasks]
  }, [scopedPendingTasks, scopedSubmittedTasks])

  const scopedRejectedTasks = useMemo(
    () => scopedPendingTasks.filter((t) => t.statusReq === 'rejeitado' || t.statusReq === 'reprovado'),
    [scopedPendingTasks]
  )

  // Estatísticas e contagens calculadas sobre o escopo do bimestre selecionado
  const scopedStats = useMemo(() => {
    const pPend = scopedPendingTasks.filter((t) => t.type === 'Prova').length
    const sPend = scopedPendingTasks.filter((t) => t.type === 'Simulado').length
    const rPend = scopedPendingTasks.filter((t) => t.type === 'Redação').length

    const pDone = scopedSubmittedTasks.filter((t) => t.type === 'Prova').length
    const sDone = scopedSubmittedTasks.filter((t) => t.type === 'Simulado').length
    const rDone = scopedSubmittedTasks.filter((t) => t.type === 'Redação').length

    return {
      provasPendentes: pPend,
      simuladosPendentes: sPend,
      redacoesPendentes: rPend,
      provasTotal: pPend + pDone,
      simuladosTotal: sPend + sDone,
      redacoesTotal: rPend + rDone,
      totalEnviados: scopedSubmittedTasks.length,
      totalGeral: scopedAllTasks.length,
    }
  }, [scopedPendingTasks, scopedSubmittedTasks, scopedAllTasks])

  // Contagem geral para badges e sugestões
  const allTasksUnfiltered = useMemo(
    () => [...pendingTasks, ...submittedTasks],
    [pendingTasks, submittedTasks]
  )

  const bimestresWithCounts = useMemo(() => {
    return bimestres.map((b) => {
      const bTasks = allTasksUnfiltered.filter((t) => isTaskInBimestre(t, b.id))
      const bPending = bTasks.filter(
        (t) => t.statusReq === 'pendente' || t.statusReq === 'rejeitado' || t.statusReq === 'reprovado'
      ).length
      return {
        id: b.id,
        nome: b.nome,
        total: bTasks.length,
        pending: bPending,
        isLast: b.id === lastBimestreId,
      }
    })
  }, [bimestres, allTasksUnfiltered, lastBimestreId])

  const currentBimestreName = useMemo(() => {
    if (selectedBimestre === 'todos') return 'Todos os Bimestres'
    const found = bimestres.find((b) => b.id === selectedBimestre)
    return found?.nome || 'Bimestre Selecionado'
  }, [selectedBimestre, bimestres])

  // All unique disciplinas for filter dropdown
  const uniqueDisciplinas = useMemo(() => {
    const set = new Set<string>()
    scopedAllTasks.forEach((t) => {
      if (t.disciplina && t.disciplina.trim()) set.add(t.disciplina.trim())
    })
    return Array.from(set).sort()
  }, [scopedAllTasks])

  // Overall completion metrics
  const totalItems = scopedAllTasks.length
  const totalDone = scopedSubmittedTasks.length
  const completionPercentage = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 100

  // Filtered and sorted tasks
  const filteredList = useMemo(() => {
    let list: ProfessorTaskItem[] = []
    if (activeTab === 'pendentes') {
      list = scopedPendingTasks
    } else if (activeTab === 'ajustes') {
      list = scopedRejectedTasks
    } else if (activeTab === 'enviados') {
      list = scopedSubmittedTasks
    } else {
      list = scopedAllTasks
    }

    // Filter by type
    if (typeFilter !== 'all') {
      list = list.filter((t) => t.type === typeFilter)
    }

    // Filter by disciplina
    if (selectedDisciplina !== 'all') {
      list = list.filter((t) => (t.disciplina || '').trim().toLowerCase() === selectedDisciplina.toLowerCase())
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((t) => {
        const haystack = [
          t.title,
          t.type,
          t.disciplina,
          t.bimestre,
          t.seriesText || '',
          t.statusReq,
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }

    // Sort
    const sorted = [...list]
    if (sortOption === 'prazo') {
      sorted.sort((a, b) => {
        const aRej = a.statusReq === 'rejeitado' || a.statusReq === 'reprovado' ? 0 : 1
        const bRej = b.statusReq === 'rejeitado' || b.statusReq === 'reprovado' ? 0 : 1
        if (aRej !== bRej) return aRej - bRej
        return (a.deadline.daysLeft ?? 9999) - (b.deadline.daysLeft ?? 9999)
      })
    } else if (sortOption === 'recentes') {
      sorted.sort((a, b) => {
        const ta = a.enviadoEm ? new Date(a.enviadoEm).getTime() : 0
        const tb = b.enviadoEm ? new Date(b.enviadoEm).getTime() : 0
        return tb - ta
      })
    } else if (sortOption === 'titulo') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    }

    return sorted
  }, [activeTab, typeFilter, selectedDisciplina, searchQuery, sortOption, scopedPendingTasks, scopedRejectedTasks, scopedSubmittedTasks, scopedAllTasks])

  // Upcoming deadlines for the quick timeline / companion card
  const upcomingDeadlines = useMemo(() => {
    return scopedPendingTasks
      .filter((t) => t.prazo)
      .slice(0, 4)
  }, [scopedPendingTasks])

  const firstName = userName?.trim().split(' ')[0] || 'Professor(a)'
  const userInitials = (userName || 'Docente')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('')

  const hasActiveFilters = typeFilter !== 'all' || selectedDisciplina !== 'all' || searchQuery.trim().length > 0

  const resetFilters = () => {
    setTypeFilter('all')
    setSelectedDisciplina('all')
    setSearchQuery('')
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO HEADER INTELIGENTE E ACOLHEDOR
      ───────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative mb-7 overflow-hidden rounded-[24px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-6 shadow-sm transition-all sm:p-8"
        style={{
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* Glow de fundo sutil */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Identidade e Mensagem */}
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md select-none"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                boxShadow: '0 8px 16px -4px rgba(139, 92, 246, 0.35)',
              }}
            >
              {userInitials || 'P'}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-violet-700 uppercase dark:text-violet-300">
                  <Sparkles size={11} /> Área do Docente
                </span>
                <span className="text-xs text-[hsl(var(--text-muted))] capitalize">
                  {formattedCurrentDate}
                </span>
              </div>

              <h1 className="m-0 text-2xl font-black tracking-tight text-[hsl(var(--text-primary))] sm:text-[30px]">
                {greeting}, {firstName}! 👋
              </h1>

              <p className="m-0 text-sm text-[hsl(var(--text-secondary))]">
                {scopedPendingTasks.length > 0 ? (
                  <>
                    Você possui{' '}
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {scopedPendingTasks.length}{' '}
                      {scopedPendingTasks.length === 1 ? 'avaliação pendente de envio' : 'avaliações pendentes de envio'}
                    </span>
                    {scopedRejectedTasks.length > 0 && (
                      <>
                        {' '}
                        — sendo{' '}
                        <strong className="underline text-rose-700 dark:text-rose-300">
                          {scopedRejectedTasks.length} com ajuste solicitado
                        </strong>
                      </>
                    )}
                    {selectedBimestre !== 'todos' ? ` no ${currentBimestreName}.` : '.'}
                  </>
                ) : (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Parabéns! Todas as suas avaliações {selectedBimestre !== 'todos' ? `do ${currentBimestreName}` : 'do período'} foram entregues com sucesso.
                  </span>
                )}
              </p>

              {/* Seletor de Bimestre de Acesso Rápido no Hero */}
              {bimestres && bimestres.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 shadow-2xs backdrop-blur-sm transition-all hover:border-violet-500/50">
                    <Calendar size={14} className="text-violet-600 dark:text-violet-400 shrink-0" />
                    <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">
                      Bimestre:
                    </span>
                    <select
                      value={selectedBimestre}
                      onChange={(e) => handleBimestreChange(e.target.value)}
                      aria-label="Filtrar por bimestre"
                      className="cursor-pointer bg-transparent text-xs font-black text-violet-700 dark:text-violet-300 outline-none pr-1 focus:ring-0"
                    >
                      <option value="todos" className="bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-primary))]">
                        Todos os Bimestres ({allTasksUnfiltered.length})
                      </option>
                      {bimestresWithCounts.map((b) => (
                        <option
                          key={b.id}
                          value={b.id}
                          className="bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-primary))]"
                        >
                          {b.nome} {b.isLast ? '★ (Último do ano)' : ''} {b.total > 0 ? `(${b.total}${b.pending > 0 ? `, ${b.pending} pend.` : ''})` : '(0)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedBimestre !== 'todos' && (
                    <button
                      type="button"
                      onClick={() => handleBimestreChange('todos')}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]"
                      title="Exibir todas as avaliações sem filtro de bimestre"
                    >
                      <span>Ver todas</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Barra de Progresso e Ações Rápidas do Cabeçalho */}
          <div className="flex flex-col gap-3 lg:items-end">
            {/* Medidor de Conclusão */}
            <div className="w-full min-w-[240px] rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3.5 sm:w-72">
              <div className="flex items-center justify-between text-xs font-bold text-[hsl(var(--text-secondary))]">
                <span className="inline-flex items-center gap-1.5">
                  <Award size={14} className="text-violet-500" />
                  Progresso de Entregas
                </span>
                <span className="text-sm font-black text-violet-600 dark:text-violet-400 tabular-nums">
                  {completionPercentage}%
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border-subtle))]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      completionPercentage === 100
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                  }}
                />
              </div>
              <p className="m-0 mt-1.5 text-[11px] text-[hsl(var(--text-muted))]">
                {totalDone} de {totalItems} {totalItems === 1 ? 'avaliação enviada' : 'avaliações enviadas'}
              </p>
            </div>

            {/* Botão de Ajuda Rápida / Guia */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHelpModalOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--text-primary))] shadow-2xs transition-all hover:bg-[hsl(var(--bg-hover))] hover:border-violet-500/40"
              >
                <Lightbulb size={13} className="text-amber-500" />
                Guia de Formatação DOCX
              </button>

              {scopedRejectedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ajustes')
                    setTypeFilter('all')
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-600 transition-all hover:bg-rose-500/15 dark:text-rose-400"
                >
                  <RefreshCw size={13} className="animate-spin-slow" />
                  Ver {scopedRejectedTasks.length} para Ajuste
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* ─────────────────────────────────────────────────────────────
          2. BENTO KPIS INTERATIVOS E ELEGANTES
      ───────────────────────────────────────────────────────────── */}
      <section aria-label="Resumo por categoria" className="mb-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Provas */}
          <motion.div
            whileHover={{ translateY: -2 }}
            onClick={() => {
              setTypeFilter(typeFilter === 'Prova' ? 'all' : 'Prova')
            }}
            className={`cursor-pointer rounded-[20px] border p-5 transition-all ${
              typeFilter === 'Prova'
                ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/30'
                : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:border-emerald-500/40 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                <FileSignature size={22} />
              </div>
              <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">
                {typeFilter === 'Prova' ? 'Filtro Ativo' : 'Filtrar'}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-[hsl(var(--text-primary))] tabular-nums">
                  {scopedStats.provasPendentes}
                </span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {scopedStats.provasPendentes === 1 ? 'Prova Pendente' : 'Provas Pendentes'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--text-secondary))]">
                <span>Total atribuído: {scopedStats.provasTotal}</span>
                <Link
                  href="/simulados/provas-upload"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Abrir Provas →
                </Link>
              </div>
            </div>
          </motion.div>

          {/* KPI 2: Simulados */}
          <motion.div
            whileHover={{ translateY: -2 }}
            onClick={() => {
              setTypeFilter(typeFilter === 'Simulado' ? 'all' : 'Simulado')
            }}
            className={`cursor-pointer rounded-[20px] border p-5 transition-all ${
              typeFilter === 'Simulado'
                ? 'border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/30'
                : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:border-violet-500/40 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                <BookOpen size={22} />
              </div>
              <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">
                {typeFilter === 'Simulado' ? 'Filtro Ativo' : 'Filtrar'}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-[hsl(var(--text-primary))] tabular-nums">
                  {scopedStats.simuladosPendentes}
                </span>
                <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400">
                  {scopedStats.simuladosPendentes === 1 ? 'Simulado Pendente' : 'Simulados Pendentes'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--text-secondary))]">
                <span>Total atribuído: {scopedStats.simuladosTotal}</span>
                <Link
                  href="/simulados/simulados-upload"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-violet-600 hover:underline dark:text-violet-400"
                >
                  Abrir Simulados →
                </Link>
              </div>
            </div>
          </motion.div>

          {/* KPI 3: Redações */}
          <motion.div
            whileHover={{ translateY: -2 }}
            onClick={() => {
              setTypeFilter(typeFilter === 'Redação' ? 'all' : 'Redação')
            }}
            className={`cursor-pointer rounded-[20px] border p-5 transition-all ${
              typeFilter === 'Redação'
                ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/30'
                : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:border-rose-500/40 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
                <PenTool size={22} />
              </div>
              <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">
                {typeFilter === 'Redação' ? 'Filtro Ativo' : 'Filtrar'}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-[hsl(var(--text-primary))] tabular-nums">
                  {scopedStats.redacoesPendentes}
                </span>
                <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                  {scopedStats.redacoesPendentes === 1 ? 'Redação Pendente' : 'Redações Pendentes'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--text-secondary))]">
                <span>Total atribuído: {scopedStats.redacoesTotal}</span>
                <Link
                  href="/simulados/redacao-upload"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-rose-600 hover:underline dark:text-rose-400"
                >
                  Abrir Redações →
                </Link>
              </div>
            </div>
          </motion.div>

          {/* KPI 4: Entregas Concluídas */}
          <motion.div
            whileHover={{ translateY: -2 }}
            onClick={() => {
              setActiveTab('enviados')
              setTypeFilter('all')
            }}
            className={`cursor-pointer rounded-[20px] border p-5 transition-all ${
              activeTab === 'enviados' && typeFilter === 'all'
                ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/30'
                : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:border-blue-500/40 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400">
                <CheckCircle2 size={22} />
              </div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                Ver Concluídas
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-[hsl(var(--text-primary))] tabular-nums">
                  {scopedSubmittedTasks.length}
                </span>
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                  Envios Entregues
                </span>
              </div>
              <p className="m-0 mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                {completionPercentage}% do período concluído
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. WORKSPACE PRINCIPAL (GRID 2 COLUNAS)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_330px]">
        {/* COLUNA ESQUERDA: LISTA DE AVALIAÇÕES */}
        <main className="space-y-4">
          <section className="overflow-hidden rounded-[24px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] shadow-sm">
            {/* Header com Tabs Estilizadas */}
            <div className="border-b border-[hsl(var(--border-subtle))] px-5 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Abas */}
                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'pendentes'}
                    onClick={() => setActiveTab('pendentes')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'pendentes'
                        ? 'bg-[hsl(var(--text-primary))] text-[hsl(var(--bg-surface))] shadow-xs'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]'
                    }`}
                  >
                    <Clock size={14} />
                    Pendentes
                    <span
                      className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        activeTab === 'pendentes'
                          ? 'bg-rose-500 text-white'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {scopedPendingTasks.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'ajustes'}
                    onClick={() => setActiveTab('ajustes')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'ajustes'
                        ? 'bg-[hsl(var(--text-primary))] text-[hsl(var(--bg-surface))] shadow-xs'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]'
                    }`}
                  >
                    <AlertTriangle size={14} />
                    Ajustes
                    {scopedRejectedTasks.length > 0 && (
                      <span
                        className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          activeTab === 'ajustes'
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-500 text-white animate-pulse'
                        }`}
                      >
                        {scopedRejectedTasks.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'enviados'}
                    onClick={() => setActiveTab('enviados')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'enviados'
                        ? 'bg-[hsl(var(--text-primary))] text-[hsl(var(--bg-surface))] shadow-xs'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    Enviados
                    <span
                      className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        activeTab === 'enviados'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {scopedSubmittedTasks.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'todas'}
                    onClick={() => setActiveTab('todas')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'todas'
                        ? 'bg-[hsl(var(--text-primary))] text-[hsl(var(--bg-surface))] shadow-xs'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]'
                    }`}
                  >
                    <Layers size={14} />
                    Todas ({scopedAllTasks.length})
                  </button>
                </div>

                {/* Filtro de Bimestre e Ordenação */}
                <div className="flex flex-wrap items-center gap-3 py-1">
                  {bimestres && bimestres.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-violet-600 dark:text-violet-400 shrink-0" />
                      <span className="text-[11px] font-semibold text-[hsl(var(--text-muted))]">Bimestre:</span>
                      <select
                        value={selectedBimestre}
                        onChange={(e) => handleBimestreChange(e.target.value)}
                        aria-label="Selecionar bimestre"
                        className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--text-primary))] outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="todos">Todos os Bimestres</option>
                        {bimestresWithCounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nome} {b.isLast ? '★ (Último)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[hsl(var(--text-muted))]">Ordenar:</span>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--text-primary))] outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="prazo">Prazos mais urgentes</option>
                      <option value="recentes">Mais recentes</option>
                      <option value="titulo">Título (A-Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Barra de Filtros e Busca */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 pb-3.5">
                {/* Input de Busca */}
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[hsl(var(--text-muted))]"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome, matéria, turma..."
                    className="w-full rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] py-2 pr-8 pl-9 text-xs font-semibold text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))] outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filtro por Tipo */}
                <div className="flex items-center gap-1">
                  {(['all', 'Prova', 'Simulado', 'Redação'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                        typeFilter === t
                          ? 'bg-violet-500 text-white shadow-2xs'
                          : 'border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                      }`}
                    >
                      {t === 'all' ? 'Todos os tipos' : t}
                    </button>
                  ))}
                </div>

                {/* Filtro por Matéria (se houver mais de uma) */}
                {uniqueDisciplinas.length > 1 && (
                  <select
                    value={selectedDisciplina}
                    onChange={(e) => setSelectedDisciplina(e.target.value)}
                    className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] px-2.5 py-1.5 text-[11px] font-bold text-[hsl(var(--text-primary))] outline-none focus:border-violet-500"
                  >
                    <option value="all">Todas as matérias</option>
                    {uniqueDisciplinas.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-[hsl(var(--border-subtle))] px-2.5 py-1.5 text-[11px] font-bold text-[hsl(var(--text-secondary))] hover:border-rose-500 hover:text-rose-500"
                  >
                    <X size={11} /> Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Avaliações */}
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/60"
                  />
                ))}
              </div>
            ) : filteredList.length === 0 ? (
              <div className="px-6 py-16 text-center">
                {scopedAllTasks.length === 0 && bimestresWithCounts.some((b) => b.total > 0 && b.id !== selectedBimestre) ? (
                  <>
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <Calendar size={28} />
                    </div>
                    <h3 className="m-0 text-base font-extrabold text-[hsl(var(--text-primary))]">
                      Nenhuma avaliação encontrada no {currentBimestreName}
                    </h3>
                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))] max-w-md mx-auto">
                      Você não possui avaliações pendentes ou enviadas para este período letivo.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      {bimestresWithCounts
                        .filter((b) => b.total > 0 && b.id !== selectedBimestre)
                        .map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleBimestreChange(b.id)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-all shadow-2xs"
                          >
                            <Calendar size={13} />
                            <span>Ver {b.nome} ({b.total} {b.total === 1 ? 'avaliação' : 'avaliações'}{b.pending > 0 ? ` • ${b.pending} pendente` : ''})</span>
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => handleBimestreChange('todos')}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] px-4 py-2 text-xs font-bold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))] transition-all"
                      >
                        <Layers size={13} />
                        <span>Ver Todos os Bimestres ({allTasksUnfiltered.length})</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="m-0 text-base font-extrabold text-[hsl(var(--text-primary))]">
                      {hasActiveFilters
                        ? 'Nenhuma avaliação encontrada com os filtros atuais'
                        : activeTab === 'pendentes'
                          ? `Nenhuma avaliação pendente no ${selectedBimestre !== 'todos' ? currentBimestreName : 'momento'}!`
                          : activeTab === 'ajustes'
                            ? 'Nenhum ajuste pendente!'
                            : 'Nenhum registro encontrado'}
                    </h3>
                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                      {hasActiveFilters
                        ? 'Tente remover os filtros ou pesquisar por outro termo.'
                        : activeTab === 'pendentes'
                          ? `Você está em dia com todas as solicitações de envio ${selectedBimestre !== 'todos' ? `do ${currentBimestreName}` : 'deste período'}.`
                          : 'Suas atividades concluídas aparecerão organizadas aqui.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-violet-700 shadow-sm"
                      >
                        <RefreshCw size={13} /> Resetar Filtros
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border-subtle))]">
                <AnimatePresence>
                  {filteredList.map((task, idx) => {
                    const meta = EVALUATION_TYPE_META[task.type]
                    const Icon = meta.icon
                    const isRejected = task.statusReq === 'rejeitado' || task.statusReq === 'reprovado'
                    const isSubmitted = task.statusReq === 'enviado' || task.statusReq === 'aprovado' || task.statusReq === 'concluido'
                    const isUrgent =
                      !isSubmitted &&
                      (task.deadline.state === 'overdue' ||
                        task.deadline.state === 'today' ||
                        task.deadline.state === 'soon')

                    return (
                      <motion.article
                        key={task.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        className={`group relative p-5 transition-all hover:bg-[hsl(var(--bg-elevated))]/40 ${
                          isRejected ? 'bg-rose-500/[0.03]' : ''
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          {/* Identificação Principal da Avaliação */}
                          <div className="flex min-w-0 items-start gap-4">
                            {/* Ícone Container */}
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform group-hover:scale-105"
                              style={{
                                background: meta.tintBg,
                                borderColor: meta.tintBorder,
                                color: meta.color,
                              }}
                            >
                              <Icon size={22} />
                            </div>

                            {/* Textos & Badges */}
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={task.link}
                                  className="text-[16px] font-extrabold tracking-tight text-[hsl(var(--text-primary))] transition-colors hover:text-violet-600 dark:hover:text-violet-400"
                                >
                                  {task.title}
                                </Link>

                                {isRejected && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/12 px-2.5 py-0.5 text-[10px] font-black text-rose-600 uppercase dark:text-rose-400">
                                    <AlertTriangle size={10} /> Ajuste Necessário
                                  </span>
                                )}
                              </div>

                              {/* Metadados Ricos */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[hsl(var(--text-secondary))]">
                                {/* Tipo Pill */}
                                <span
                                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider"
                                  style={{ background: meta.tintBg, color: meta.color }}
                                >
                                  {meta.label}
                                </span>

                                {/* Disciplina */}
                                {task.disciplina && (
                                  <span className="inline-flex items-center gap-1 font-bold text-[hsl(var(--text-primary))]">
                                    <BookMarked size={12} className="text-violet-500" />
                                    {task.disciplina}
                                  </span>
                                )}

                                {/* Série / Turma */}
                                {task.seriesText && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--text-secondary))]">
                                    <GraduationCap size={12} />
                                    {task.seriesText}
                                  </span>
                                )}

                                {/* Bimestre */}
                                {task.bimestre && (
                                  <span className="text-[hsl(var(--text-muted))]">
                                    · {task.bimestre}
                                  </span>
                                )}

                                {/* Qtd de Questões */}
                                {task.qtdQuestoes && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--text-secondary))]">
                                    <HelpCircle size={12} />
                                    {task.qtdQuestoes} questões
                                  </span>
                                )}

                                {/* Data de Aplicação */}
                                {task.dataAplicacao && (
                                  <span className="text-[hsl(var(--text-muted))]">
                                    · Aplicação: {task.dataAplicacao.split('-').reverse().join('/')}
                                  </span>
                                )}
                              </div>

                              {/* Feedback de rejeição, se houver */}
                              {isRejected && task.observacoes && (
                                <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                                  <strong>Observação da coordenação:</strong> {task.observacoes}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Prazos & Ações */}
                          <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                            {/* Status de Prazo */}
                            {isSubmitted ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} />
                                {task.enviadoEm
                                  ? `Enviado ${formatRelativeDateTime(task.enviadoEm)}`
                                  : 'Enviado para Revisão'}
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
                                  task.deadline.state === 'overdue'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30'
                                    : isUrgent
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
                                      : 'bg-[hsl(var(--bg-app))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border-subtle))]'
                                }`}
                              >
                                <Calendar size={12} />
                                {task.prazo ? `Prazo: ${task.deadline.label}` : 'Sem prazo'}
                              </span>
                            )}

                            {/* Botão de Ação Primária */}
                            <Link href={task.link} className="no-underline">
                              {isSubmitted ? (
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-4 py-2 text-xs font-bold text-[hsl(var(--text-primary))] shadow-2xs transition-all hover:bg-[hsl(var(--bg-hover))] hover:border-violet-500/40"
                                >
                                  <Eye size={13} className="text-violet-500" />
                                  Visualizar Envio
                                </button>
                              ) : isRejected ? (
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-rose-500 hover:to-rose-600"
                                >
                                  <RefreshCw size={13} />
                                  Corrigir e Reenviar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/30"
                                >
                                  <Upload size={13} />
                                  Enviar Questões
                                  <ArrowRight size={13} />
                                </button>
                              )}
                            </Link>
                          </div>
                        </div>
                      </motion.article>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </main>

        {/* ─────────────────────────────────────────────────────────────
            COLUNA DIREITA: SIDEBAR COMPANION DO DOCENTE
        ───────────────────────────────────────────────────────────── */}
        <aside className="space-y-5">
          {/* 1. Card de Linha do Tempo / Próximos Prazos */}
          <section className="rounded-[22px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
            <h3 className="m-0 flex items-center gap-2 text-sm font-extrabold text-[hsl(var(--text-primary))]">
              <Calendar size={16} className="text-violet-500" />
              Próximos Prazos
            </h3>

            {upcomingDeadlines.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border-subtle))] p-4 text-center text-xs text-[hsl(var(--text-muted))]">
                Nenhum prazo urgente pendente no momento.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingDeadlines.map((task) => {
                  const meta = EVALUATION_TYPE_META[task.type]
                  return (
                    <Link
                      key={task.id}
                      href={task.link}
                      className="group block rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3 transition-all hover:border-violet-500/40 hover:bg-[hsl(var(--bg-hover))]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className="font-bold uppercase tracking-wider"
                          style={{ color: meta.color, fontSize: 10 }}
                        >
                          {task.disciplina || meta.label}
                        </span>
                        <span className="font-extrabold text-rose-600 dark:text-rose-400">
                          {task.deadline.label}
                        </span>
                      </div>
                      <h4 className="m-0 mt-1 line-clamp-1 text-xs font-bold text-[hsl(var(--text-primary))] group-hover:text-violet-600 dark:group-hover:text-violet-400">
                        {task.title}
                      </h4>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2. Card de Guia Rápido de Formatação */}
          <section className="rounded-[22px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="m-0 flex items-center gap-2 text-sm font-extrabold text-[hsl(var(--text-primary))]">
                <Lightbulb size={16} className="text-amber-500" />
                Dicas de Formatação
              </h3>
              <button
                type="button"
                onClick={() => setHelpModalOpen(true)}
                className="cursor-pointer text-[11px] font-bold text-violet-600 hover:underline dark:text-violet-400"
              >
                Ver tudo
              </button>
            </div>

            <ul className="mt-3.5 space-y-2.5 p-0 list-none text-xs text-[hsl(var(--text-secondary))]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-600 dark:text-violet-400">
                  1
                </span>
                <span>
                  Indique a resposta correta com <strong>[GABARITO: B]</strong> ou em negrito.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-600 dark:text-violet-400">
                  2
                </span>
                <span>
                  Imagens e ilustrações são importadas diretamente do seu arquivo Word (.docx).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-600 dark:text-violet-400">
                  3
                </span>
                <span>
                  Fórmulas e equações matemáticas (MTEF / Equation) são vetorizadas sem distorção.
                </span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 py-2.5 text-xs font-bold text-violet-600 transition-all hover:bg-violet-500/10 dark:text-violet-400"
            >
              <FileText size={13} />
              Instruções Detalhadas
            </button>
          </section>

          {/* 3. Atalhos Rápidos para Outros Módulos */}
          <section className="rounded-[22px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
            <h3 className="m-0 text-sm font-extrabold text-[hsl(var(--text-primary))]">
              Atalhos de Acesso Rápido
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Link
                href="/simulados/provas-upload"
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3 text-xs font-bold text-[hsl(var(--text-primary))] transition-all hover:border-emerald-500/40 hover:bg-[hsl(var(--bg-hover))]"
              >
                <span className="flex items-center gap-2">
                  <FileSignature size={15} className="text-emerald-500" />
                  Minhas Provas
                </span>
                <ArrowUpRight size={14} className="text-[hsl(var(--text-muted))]" />
              </Link>

              <Link
                href="/simulados/simulados-upload"
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3 text-xs font-bold text-[hsl(var(--text-primary))] transition-all hover:border-violet-500/40 hover:bg-[hsl(var(--bg-hover))]"
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={15} className="text-violet-500" />
                  Meus Simulados
                </span>
                <ArrowUpRight size={14} className="text-[hsl(var(--text-muted))]" />
              </Link>

              <Link
                href="/simulados/redacao-upload"
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3 text-xs font-bold text-[hsl(var(--text-primary))] transition-all hover:border-rose-500/40 hover:bg-[hsl(var(--bg-hover))]"
              >
                <span className="flex items-center gap-2">
                  <PenTool size={15} className="text-rose-500" />
                  Minhas Redações
                </span>
                <ArrowUpRight size={14} className="text-[hsl(var(--text-muted))]" />
              </Link>

              <Link
                href="/simulados/banco"
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-app))] p-3 text-xs font-bold text-[hsl(var(--text-primary))] transition-all hover:border-blue-500/40 hover:bg-[hsl(var(--bg-hover))]"
              >
                <span className="flex items-center gap-2">
                  <Layers size={15} className="text-blue-500" />
                  Banco de Questões
                </span>
                <ArrowUpRight size={14} className="text-[hsl(var(--text-muted))]" />
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DE GUIA E BOAS PRÁTICAS DE FORMATAÇÃO (DOCX)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {helpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHelpModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[24px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="m-0 text-lg font-black text-[hsl(var(--text-primary))]">
                      Guia de Formatação de Avaliações
                    </h2>
                    <p className="m-0 text-xs text-[hsl(var(--text-secondary))]">
                      Como preparar seu arquivo Word (.docx) para importação perfeita
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHelpModalOpen(false)}
                  className="cursor-pointer rounded-xl p-2 text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-sm text-[hsl(var(--text-secondary))]">
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <h4 className="m-0 font-bold text-violet-700 dark:text-violet-300">
                    1. Enunciado e Numeração
                  </h4>
                  <p className="m-0 mt-1 text-xs">
                    Inicie cada questão com o número seguido de ponto ou parênteses, por exemplo:
                    <br />
                    <code className="mt-1 block rounded bg-[hsl(var(--bg-app))] p-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      1. O relevo brasileiro é caracterizado por...
                    </code>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <h4 className="m-0 font-bold text-emerald-700 dark:text-emerald-300">
                    2. Alternativas e Gabarito
                  </h4>
                  <p className="m-0 mt-1 text-xs">
                    Identifique as alternativas com letras de <strong>A)</strong> a <strong>E)</strong>.
                    Para marcar a correta automaticamente, coloque a tag de gabarito ou deixe a letra/texto em negrito:
                    <br />
                    <code className="mt-1 block rounded bg-[hsl(var(--bg-app))] p-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      A) Planalto Central.<br />
                      B) Depressão Sertaneja. [GABARITO: B]<br />
                      C) Planície Litorânea.
                    </code>
                  </p>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <h4 className="m-0 font-bold text-blue-700 dark:text-blue-300">
                    3. Imagens e Fórmulas
                  </h4>
                  <p className="m-0 mt-1 text-xs">
                    Cole as imagens diretamente dentro do documento do Word. O parser inteligente extrai gráficos, mapas e fotos com resolução otimizada. Fórmulas matemáticas (Equation 3.0 / MathType) são mantidas com precisão.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="m-0 font-bold text-amber-700 dark:text-amber-300">
                    4. Envio para Revisão
                  </h4>
                  <p className="m-0 mt-1 text-xs">
                    Após fazer o upload e revisar as questões na tela de conferência, clique no botão verde <strong>&quot;Enviar para Revisão&quot;</strong>. A coordenação será notificada na hora para aprovação.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-[hsl(var(--border-subtle))] pt-4">
                <button
                  type="button"
                  onClick={() => setHelpModalOpen(false)}
                  className="cursor-pointer rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-violet-700 shadow-sm"
                >
                  Entendi, fechar guia
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
