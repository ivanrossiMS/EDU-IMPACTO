'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { GabaritoProvaModal } from '@/components/simulados/GabaritoProvaModal'
import { GabaritoRedacaoModal } from '@/components/simulados/GabaritoRedacaoModal'
import { GabaritoSimuladoModal } from '@/components/simulados/GabaritoSimuladoModal'
import { BentoKpiGrid, KpiFilterMode } from '@/components/simulados/dashboard/BentoKpiGrid'
import { EvaluationRowCard } from '@/components/simulados/dashboard/EvaluationRowCard'
import { PedagogicalRadarPanel } from '@/components/simulados/dashboard/PedagogicalRadarPanel'
import { ProfessorDashboardView } from '@/components/simulados/dashboard/ProfessorDashboardView'
import { SimuladosDashboardSkeleton } from '@/components/simulados/dashboard/SimuladosDashboardSkeleton'
import { SimuladosHeader } from '@/components/simulados/dashboard/SimuladosHeader'
import {
  EVALUATION_TYPE_META,
  EvaluationType,
  NormalizedEvaluation,
  ProfessorTaskItem,
  formatCreatorShortName,
  getDeadlineUrgency,
  normalizeEvaluationItem,
  extractSeriesText,
  findLastBimestreOfYear,
  BimestreInfo,
} from '@/components/simulados/dashboard/simuladosDashboardUtils'

type FeedTab = 'todas' | 'Simulado' | 'Prova' | 'Redação' | 'adaptadas'
type SortMode = 'recentes' | 'prazo' | 'progresso' | 'revisao'

interface BimestreRow extends BimestreInfo {
  id: string
  nome: string
}

export default function SimuladosDashboard() {
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'

  const [loading, setLoading] = useState(true)

  // Coordinator State
  const [evaluations, setEvaluations] = useState<NormalizedEvaluation[]>([])
  const [bimestres, setBimestres] = useState<BimestreRow[]>([])

  // Filters & Toolbar
  const [searchQuery, setSearchQuery] = useState('')
  const [bimestreFilter, setBimestreFilter] = useState('todos')
  const [activeTab, setActiveTab] = useState<FeedTab>('todas')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [sortMode, setSortMode] = useState<SortMode>('recentes')
  const [showAllRows, setShowAllRows] = useState(false)

  // Quick Gabarito Modal State
  const [gabaritoModal, setGabaritoModal] = useState<{
    id: string
    type: EvaluationType
  } | null>(null)

  // Professor State
  const [profPendingTasks, setProfPendingTasks] = useState<ProfessorTaskItem[]>([])
  const [profSubmittedTasks, setProfSubmittedTasks] = useState<ProfessorTaskItem[]>([])
  const [profStats, setProfStats] = useState({
    provasPendentes: 0,
    simuladosPendentes: 0,
    redacoesPendentes: 0,
    provasTotal: 0,
    simuladosTotal: 0,
    redacoesTotal: 0,
    totalEnviados: 0,
    totalGeral: 0,
  })

  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Global "/" or Cmd/Ctrl+K shortcut to focus dashboard search
  useEffect(() => {
    if (isProfessor) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (!isTyping && e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProfessor])

  useEffect(() => {
    if (!hydrated || !currentUser) return
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      try {
        if (isProfessor) {
          const [resProvas, resSimulados, resRedacao, resBimestres] = await Promise.all([
            (supabase as any)
              .from('provas_upload_requisicoes')
              .select('*, provas_upload(*)')
              .eq('id_professor', currentUser?.id),
            (supabase as any)
              .from('simulados_upload_requisicoes')
              .select('*, simulados_upload(*)')
              .eq('id_professor', currentUser?.id),
            (supabase as any)
              .from('redacao_upload_requisicoes')
              .select('*, redacao_upload(*)')
              .eq('id_professor', currentUser?.id),
            (supabase as any).from('simulados_bimestres').select('*').order('nome'),
          ])

          if (cancelled) return

          const bimsList: BimestreRow[] = (resBimestres?.data || []).filter(
            (b: any) => b?.id && b?.nome
          )
          setBimestres(bimsList)

          const lastBimId = findLastBimestreOfYear(bimsList)
          if (lastBimId) {
            setBimestreFilter(lastBimId)
          }

          const bimsMap: Record<string, string> = {}
          bimsList.forEach((b: any) => {
            bimsMap[b.id] = b.nome
          })

          const extractBim = (parent: any) => {
            if (!parent) return ''
            if (parent.id_bimestre && bimsMap[parent.id_bimestre]) return bimsMap[parent.id_bimestre]
            if (typeof parent.bimestre === 'string' && parent.bimestre.trim()) return parent.bimestre.trim()
            return parent.bimestre_nome || ''
          }

          const sources: {
            rows: any[]
            parentKey: string
            type: EvaluationType
            routeBase: string
          }[] = [
            {
              rows: resProvas.data || [],
              parentKey: 'provas_upload',
              type: 'Prova',
              routeBase: '/simulados/provas-upload',
            },
            {
              rows: resSimulados.data || [],
              parentKey: 'simulados_upload',
              type: 'Simulado',
              routeBase: '/simulados/simulados-upload',
            },
            {
              rows: resRedacao.data || [],
              parentKey: 'redacao_upload',
              type: 'Redação',
              routeBase: '/simulados/redacao-upload',
            },
          ]

          const pending: ProfessorTaskItem[] = []
          const submitted: ProfessorTaskItem[] = []
          const counts = { Prova: 0, Simulado: 0, 'Redação': 0 }

          for (const src of sources) {
            for (const r of src.rows) {
              const parent = r?.[src.parentKey]
              if (!parent) continue
              const st = String(r.status || 'pendente').toLowerCase()
              const prazo = parent.data_limite_upload || null
              const task: ProfessorTaskItem = {
                id: String(r.id),
                parentId: String(parent.id),
                type: src.type,
                title: parent.titulo || 'Sem título',
                disciplina: r.disciplina_nome || '',
                bimestre: extractBim(parent),
                bimestreId: parent.id_bimestre ? String(parent.id_bimestre) : undefined,
                prazo,
                deadline: getDeadlineUrgency(prazo),
                statusReq: st,
                enviadoEm: r.enviado_em || r.updated_at || null,
                link: `${src.routeBase}/${parent.id}/upload?req=${r.id}&prof=${r.id_professor || ''}&disc=${r.id_disciplina || ''}`,
                qtdQuestoes: r.qtd_questoes || parent.questoes_count || undefined,
                seriesText: extractSeriesText(parent),
                dataAplicacao: parent.data_aplicacao || null,
                observacoes: r.observacoes || r.motivo_rejeicao || null,
              }

              if (st === 'pendente' || st === 'rejeitado' || st === 'reprovado') {
                pending.push(task)
                counts[src.type] += 1
              } else {
                submitted.push(task)
              }
            }
          }

          pending.sort((a, b) => {
            const aRej = a.statusReq === 'rejeitado' || a.statusReq === 'reprovado' ? 0 : 1
            const bRej = b.statusReq === 'rejeitado' || b.statusReq === 'reprovado' ? 0 : 1
            if (aRej !== bRej) return aRej - bRej
            return (a.deadline.daysLeft ?? 9999) - (b.deadline.daysLeft ?? 9999)
          })

          submitted.sort((a, b) => {
            const ta = a.enviadoEm ? new Date(a.enviadoEm).getTime() : 0
            const tb = b.enviadoEm ? new Date(b.enviadoEm).getTime() : 0
            return tb - ta
          })

          const totalProvas = sources.find((s) => s.type === 'Prova')?.rows.length || 0
          const totalSimulados = sources.find((s) => s.type === 'Simulado')?.rows.length || 0
          const totalRedacoes = sources.find((s) => s.type === 'Redação')?.rows.length || 0

          setProfStats({
            provasPendentes: counts.Prova,
            simuladosPendentes: counts.Simulado,
            redacoesPendentes: counts['Redação'],
            provasTotal: totalProvas,
            simuladosTotal: totalSimulados,
            redacoesTotal: totalRedacoes,
            totalEnviados: submitted.length,
            totalGeral: pending.length + submitted.length,
          })
          setProfPendingTasks(pending)
          setProfSubmittedTasks(submitted)
          return
        }

        // ==============================
        // VISÃO DO COORDENADOR
        // ==============================
        const [resProvas, resSimulados, resRedacao, resBimestres] = await Promise.all([
          (supabase as any)
            .from('provas_upload')
            .select('*, provas_upload_requisicoes(*)')
            .order('created_at', { ascending: false })
            .limit(45),
          (supabase as any)
            .from('simulados_upload')
            .select('*, simulados_upload_requisicoes(*)')
            .order('created_at', { ascending: false })
            .limit(45),
          (supabase as any)
            .from('redacao_upload')
            .select('*, redacao_upload_requisicoes(*)')
            .order('created_at', { ascending: false })
            .limit(45),
          (supabase as any)
            .from('simulados_bimestres')
            .select('*')
            .order('nome'),
        ])

        if (cancelled) return

        const bimsList: BimestreRow[] = (resBimestres?.data || []).filter(
          (b: any) => b?.id && b?.nome
        )
        const bimsMap: Record<string, string> = {}
        bimsList.forEach((b) => {
          bimsMap[b.id] = b.nome
        })
        setBimestres(bimsList)

        const lastBimId = findLastBimestreOfYear(bimsList)
        if (lastBimId && bimestreFilter === 'todos') {
          setBimestreFilter(lastBimId)
        }

        const pRaw = resProvas.data || []
        const sRaw = resSimulados.data || []
        const rRaw = resRedacao.data || []

        const allUserIds = Array.from(
          new Set(
            [
              ...pRaw.map((p: any) => p.criado_por),
              ...sRaw.map((s: any) => s.criado_por),
              ...rRaw.map((r: any) => r.criado_por),
            ].filter(Boolean)
          )
        )

        const usersMap: Record<string, string> = {}
        if (allUserIds.length > 0) {
          try {
            const req = await fetch('/api/usuarios/nomes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: allUserIds }),
            })
            const resData = await req.json()
            const rawMap = resData?.data || {}
            if (currentUser?.id && !rawMap[currentUser.id]) {
              rawMap[currentUser.id] = currentUser.nome
            }
            Object.keys(rawMap).forEach((k) => {
              usersMap[k] = formatCreatorShortName(rawMap[k])
            })
          } catch (err) {
            console.error('Error fetching creators:', err)
          }
        }

        if (cancelled) return

        const normalized: NormalizedEvaluation[] = [
          ...pRaw.map((item: any) => normalizeEvaluationItem(item, 'Prova', bimsMap, usersMap)),
          ...sRaw.map((item: any) => normalizeEvaluationItem(item, 'Simulado', bimsMap, usersMap)),
          ...rRaw.map((item: any) => normalizeEvaluationItem(item, 'Redação', bimsMap, usersMap)),
        ]

        normalized.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        setEvaluations(normalized)
      } catch (err) {
        console.error('Dashboard error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      cancelled = true
    }
  }, [hydrated, currentUser, isProfessor])

  // Items filtered only by Bimestre (drives KPI stats + tab badges + radar)
  const bimestreScoped = useMemo(() => {
    if (bimestreFilter === 'todos') return evaluations
    return evaluations.filter((item) => item.bimestreId === bimestreFilter)
  }, [evaluations, bimestreFilter])

  // KPI Metrics computed over scoped dataset
  const kpiStats = useMemo(() => {
    const isActive = (s: string) => s === 'aguardando' || s === 'em_revisao'
    const reviewItems = bimestreScoped.filter((i) => i.status === 'em_revisao')
    const urgentReview = reviewItems.filter(
      (i) =>
        i.deadline.state === 'overdue' ||
        i.deadline.state === 'today' ||
        i.deadline.state === 'soon'
    ).length

    const provas = bimestreScoped.filter((i) => i.type === 'Prova' && isActive(i.status))
    const provasAguardando = provas.filter((i) => i.status === 'aguardando').length

    const simulados = bimestreScoped.filter(
      (i) => i.type === 'Simulado' && isActive(i.status)
    )
    const simTotalReqs = simulados.reduce((acc, s) => acc + s.progress.total, 0)
    const simSentReqs = simulados.reduce((acc, s) => acc + s.progress.submitted, 0)
    const simuladosCompletionPct =
      simTotalReqs > 0 ? Math.round((simSentReqs / simTotalReqs) * 100) : 0

    const redacoes = bimestreScoped.filter(
      (i) => i.type === 'Redação' && isActive(i.status)
    )
    const adaptadasCount = bimestreScoped.filter((i) => i.isAdaptada).length

    return {
      reviewReady: reviewItems.length,
      urgentReview,
      provasAtivas: provas.length,
      provasAguardando,
      simuladosAtivos: simulados.length,
      simuladosCompletionPct,
      redacoesAtivas: redacoes.length,
      adaptadasCount,
    }
  }, [bimestreScoped])

  // Current KPI highlight mode
  const activeKpiMode: KpiFilterMode = useMemo(() => {
    if (statusFilter === 'em_revisao' && activeTab === 'todas') return 'review'
    if (activeTab === 'Prova' || activeTab === 'Simulado' || activeTab === 'Redação') {
      return activeTab
    }
    return 'all'
  }, [statusFilter, activeTab])

  const handleKpiSelect = (mode: KpiFilterMode) => {
    setShowAllRows(false)
    if (mode === 'all') {
      setActiveTab('todas')
      setStatusFilter('todos')
      return
    }
    if (mode === 'review') {
      setActiveTab('todas')
      setStatusFilter('em_revisao')
      return
    }
    setActiveTab(mode)
    setStatusFilter('todos')
  }

  // Tab counts
  const tabCounts = useMemo(
    () => ({
      todas: bimestreScoped.length,
      Simulado: bimestreScoped.filter((i) => i.type === 'Simulado').length,
      Prova: bimestreScoped.filter((i) => i.type === 'Prova').length,
      'Redação': bimestreScoped.filter((i) => i.type === 'Redação').length,
      adaptadas: bimestreScoped.filter((i) => i.isAdaptada).length,
    }),
    [bimestreScoped]
  )

  // Filtered + Sorted list for main workspace
  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const list = bimestreScoped.filter((item) => {
      if (activeTab === 'adaptadas' && !item.isAdaptada) return false
      if (
        activeTab !== 'todas' &&
        activeTab !== 'adaptadas' &&
        item.type !== activeTab
      ) {
        return false
      }
      if (statusFilter !== 'todos' && item.status !== statusFilter) return false

      if (q) {
        const haystack = [
          item.titulo,
          item.type,
          item.seriesText,
          item.bimestreName,
          item.criadoPorNome,
          ...item.disciplinas,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortMode === 'prazo') {
        return (a.deadline.daysLeft ?? 9999) - (b.deadline.daysLeft ?? 9999)
      }
      if (sortMode === 'progresso') {
        return b.progress.percent - a.progress.percent
      }
      if (sortMode === 'revisao') {
        const score = (s: string) =>
          s === 'em_revisao' ? 0 : s === 'aguardando' ? 1 : s === 'aprovado' ? 2 : 3
        const diff = score(a.status) - score(b.status)
        if (diff !== 0) return diff
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })

    return sorted
  }, [bimestreScoped, activeTab, statusFilter, searchQuery, sortMode])

  const hasActiveFilters =
    activeTab !== 'todas' ||
    statusFilter !== 'todos' ||
    bimestreFilter !== 'todos' ||
    searchQuery.trim().length > 0

  const resetAllFilters = () => {
    setActiveTab('todas')
    setStatusFilter('todos')
    setBimestreFilter('todos')
    setSearchQuery('')
    setSortMode('recentes')
    setShowAllRows(false)
  }

  if (!hydrated) return null

  if (isProfessor) {
    return (
      <ProfessorDashboardView
        userName={currentUser?.nome}
        loading={loading}
        pendingTasks={profPendingTasks}
        submittedTasks={profSubmittedTasks}
        stats={profStats}
        bimestres={bimestres}
        selectedBimestre={bimestreFilter}
        onBimestreChange={setBimestreFilter}
      />
    )
  }

  if (loading) {
    return <SimuladosDashboardSkeleton />
  }

  const displayedEvaluations = showAllRows
    ? filteredEvaluations
    : filteredEvaluations.slice(0, 10)

  const listFooterLink =
    activeTab === 'Prova' || activeTab === 'Simulado' || activeTab === 'Redação'
      ? EVALUATION_TYPE_META[activeTab].listHref
      : activeTab === 'adaptadas'
        ? '/simulados/arquivo-adaptadas'
        : '/simulados/simulados-upload'

  const listFooterLabel =
    activeTab === 'Prova'
      ? 'Ver todas as provas'
      : activeTab === 'Simulado'
        ? 'Ver todos os simulados'
        : activeTab === 'Redação'
          ? 'Ver todas as redações'
          : activeTab === 'adaptadas'
            ? 'Ir para Arquivo Adaptadas'
            : 'Explorar lista completa'

  const tabs: { id: FeedTab; label: string; count: number; isSpecial?: boolean }[] = [
    { id: 'todas', label: 'Todas', count: tabCounts.todas },
    { id: 'Simulado', label: 'Simulados', count: tabCounts.Simulado },
    { id: 'Prova', label: 'Provas', count: tabCounts.Prova },
    { id: 'Redação', label: 'Redações', count: tabCounts['Redação'] },
    { id: 'adaptadas', label: 'Adaptadas', count: tabCounts.adaptadas, isSpecial: true },
  ]

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
      <SimuladosHeader
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val)
          setShowAllRows(false)
        }}
        searchInputRef={searchInputRef}
        bimestreFilter={bimestreFilter}
        onBimestreChange={(val) => {
          setBimestreFilter(val)
          setShowAllRows(false)
        }}
        bimestres={bimestres}
        totalCount={bimestreScoped.length}
        reviewCount={kpiStats.reviewReady}
      />

      <BentoKpiGrid
        activeFilter={activeKpiMode}
        onSelectFilter={handleKpiSelect}
        stats={kpiStats}
      />

      {/* Main Split Grid: Evaluations Workspace (left) + Pedagogical Radar (right) */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        {/* Left: Workspace de Avaliações */}
        <section
          aria-label="Avaliações"
          className="overflow-hidden rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] shadow-sm"
        >
          {/* Toolbar: Tabs + Status & Sort Controls */}
          <div className="border-b border-[hsl(var(--border-subtle))] px-4 pt-3 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="sim-tablist flex-1 border-b-0"
                role="tablist"
                aria-label="Filtrar avaliações por categoria"
              >
                {tabs.map((tab) => {
                  const selected = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setShowAllRows(false)
                      }}
                      className="sim-tab"
                    >
                      {tab.isSpecial && (
                        <Sparkles size={13} className="text-amber-500" />
                      )}
                      <span>{tab.label}</span>
                      <span className="rounded-full bg-[hsl(var(--bg-elevated))] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[hsl(var(--text-secondary))]">
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-2.5 lg:pb-1">
                <div className="sim-input-wrap h-8 px-2">
                  <Filter size={12} className="text-[hsl(var(--text-muted))]" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setShowAllRows(false)
                    }}
                    aria-label="Filtrar por status"
                    className="sim-clean-select cursor-pointer text-[11px] font-semibold"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="em_revisao">Em Revisão</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="publicado">Publicado</option>
                  </select>
                </div>

                <div className="sim-input-wrap h-8 px-2">
                  <SlidersHorizontal size={12} className="text-[hsl(var(--text-muted))]" />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    aria-label="Ordenar avaliações"
                    className="sim-clean-select cursor-pointer text-[11px] font-semibold"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="revisao">Prioridade de revisão</option>
                    <option value="prazo">Prazo mais próximo</option>
                    <option value="progresso">Maior % de envio</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[hsl(var(--border-subtle))] bg-transparent px-2.5 text-[11px] font-semibold text-[#f43f5e] transition-colors hover:bg-[#f43f5e]/10"
                  >
                    <RotateCcw size={12} />
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Evaluations Feed */}
          {filteredEvaluations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <AlertCircle
                size={40}
                className="mx-auto mb-3 text-[hsl(var(--text-muted))] opacity-60"
              />
              <h3 className="m-0 text-base font-bold text-[hsl(var(--text-primary))]">
                Nenhuma avaliação encontrada
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-[hsl(var(--text-secondary))]">
                {hasActiveFilters
                  ? 'Nenhum registro corresponde aos filtros atuais. Tente limpar os filtros para ver tudo.'
                  : 'Crie uma nova prova, simulado ou redação para iniciar o ciclo.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] px-4 py-2 text-xs font-bold text-[hsl(var(--text-primary))] transition-colors hover:border-[hsl(var(--border-strong))]"
                >
                  <RotateCcw size={13} />
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div>
              {displayedEvaluations.map((item) => (
                <EvaluationRowCard
                  key={item.key}
                  item={item}
                  onOpenGabarito={(target) =>
                    setGabaritoModal({ id: target.id, type: target.type })
                  }
                />
              ))}

              {/* Footer: Expand / Go to Full List */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)_/_0.35)] px-5 py-3">
                <span className="text-xs font-medium text-[hsl(var(--text-muted))]">
                  Exibindo {displayedEvaluations.length} de {filteredEvaluations.length}{' '}
                  {filteredEvaluations.length === 1 ? 'avaliação' : 'avaliações'}
                </span>

                <div className="flex items-center gap-3">
                  {filteredEvaluations.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllRows((prev) => !prev)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--text-primary))] transition-colors hover:border-[hsl(var(--border-strong))]"
                    >
                      <span>
                        {showAllRows
                          ? 'Mostrar menos'
                          : `Ver todas (${filteredEvaluations.length})`}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${showAllRows ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}

                  <Link
                    href={listFooterLink}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#f43f5e] no-underline hover:underline"
                  >
                    <span>{listFooterLabel}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: Radar Pedagógico & Atalhos */}
        <PedagogicalRadarPanel
          items={bimestreScoped}
          statusFilter={statusFilter}
          onSelectStatusFilter={(status) => {
            setStatusFilter(status)
            setShowAllRows(false)
          }}
        />
      </div>

      {/* Gabarito Modals triggered directly from Quick Actions */}
      {gabaritoModal?.type === 'Simulado' && (
        <GabaritoSimuladoModal
          simuladoUploadId={gabaritoModal.id}
          onClose={() => setGabaritoModal(null)}
        />
      )}
      {gabaritoModal?.type === 'Prova' && (
        <GabaritoProvaModal
          provaUploadId={gabaritoModal.id}
          onClose={() => setGabaritoModal(null)}
        />
      )}
      {gabaritoModal?.type === 'Redação' && (
        <GabaritoRedacaoModal
          provaUploadId={gabaritoModal.id}
          onClose={() => setGabaritoModal(null)}
        />
      )}
    </div>
  )
}
