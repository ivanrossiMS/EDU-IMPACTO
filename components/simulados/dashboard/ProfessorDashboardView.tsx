'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  BookMarked,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react'
import {
  EVALUATION_TYPE_META,
  EvaluationType,
  ProfessorTaskItem,
  formatRelativeDateTime,
} from './simuladosDashboardUtils'

interface ProfessorDashboardViewProps {
  userName?: string
  loading: boolean
  pendingTasks: ProfessorTaskItem[]
  submittedTasks: ProfessorTaskItem[]
  stats: {
    provasPendentes: number
    simuladosPendentes: number
    redacoesPendentes: number
  }
}

type ProfTab = 'pendentes' | 'ajustes' | 'enviados'

export function ProfessorDashboardView({
  userName,
  loading,
  pendingTasks,
  submittedTasks,
  stats,
}: ProfessorDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<ProfTab>('pendentes')
  const [typeFilter, setTypeFilter] = useState<'all' | EvaluationType>('all')

  const rejectedCount = useMemo(
    () => pendingTasks.filter((t) => t.statusReq === 'rejeitado' || t.statusReq === 'reprovado').length,
    [pendingTasks]
  )

  const filteredList = useMemo(() => {
    let base =
      activeTab === 'enviados'
        ? submittedTasks
        : activeTab === 'ajustes'
          ? pendingTasks.filter((t) => t.statusReq === 'rejeitado' || t.statusReq === 'reprovado')
          : pendingTasks

    if (typeFilter !== 'all') {
      base = base.filter((t) => t.type === typeFilter)
    }
    return base
  }, [activeTab, typeFilter, pendingTasks, submittedTasks])

  const kpiCards: {
    type: EvaluationType
    title: string
    value: number
  }[] = [
    { type: 'Prova', title: 'Provas Pendentes', value: stats.provasPendentes },
    { type: 'Simulado', title: 'Simulados Pendentes', value: stats.simuladosPendentes },
    { type: 'Redação', title: 'Redações Pendentes', value: stats.redacoesPendentes },
  ]

  const firstName = userName?.trim().split(' ')[0] || 'Professor'

  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 py-6 sm:px-8 sm:py-8">
      {/* Header Contextual */}
      <header className="mb-6 flex flex-col justify-between gap-4 rounded-[22px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-6 shadow-sm sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="m-0 text-xs font-bold tracking-wider text-[#8b5cf6] uppercase">
            Área do Docente · Provas & Simulados
          </p>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-[hsl(var(--text-primary))] sm:text-[28px]">
            Olá, {firstName}
          </h1>
          <p className="m-0 text-sm text-[hsl(var(--text-secondary))]">
            {pendingTasks.length > 0 ? (
              <>
                Você possui{' '}
                <strong className="text-[#f43f5e]">
                  {pendingTasks.length}{' '}
                  {pendingTasks.length === 1 ? 'envio pendente' : 'envios pendentes'}
                </strong>
                {rejectedCount > 0 && (
                  <>
                    {' '}
                    — sendo{' '}
                    <strong className="text-rose-600 dark:text-rose-400">
                      {rejectedCount} para ajuste
                    </strong>
                  </>
                )}
                .
              </>
            ) : (
              'Todos os seus envios solicitados estão em dia!'
            )}
          </p>
        </div>

        {rejectedCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('ajustes')}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-500/15 sm:self-auto dark:text-rose-400"
          >
            <RefreshCw size={14} />
            Ver {rejectedCount} {rejectedCount === 1 ? 'ajuste solicitado' : 'ajustes solicitados'}
          </button>
        )}
      </header>

      {/* KPIs Interativos */}
      <section
        aria-label="Resumo de pendências por tipo"
        className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3"
      >
        {kpiCards.map((card) => {
          const meta = EVALUATION_TYPE_META[card.type]
          const Icon = meta.icon
          const isActive = typeFilter === card.type

          return (
            <button
              key={card.type}
              type="button"
              data-active={isActive ? 'true' : 'false'}
              aria-pressed={isActive}
              onClick={() => setTypeFilter(isActive ? 'all' : card.type)}
              style={
                {
                  '--sim-accent': meta.color,
                  '--sim-accent-border': meta.tintBorder,
                  '--sim-accent-glow': `${meta.color}33`,
                } as React.CSSProperties
              }
              className="sim-kpi-card"
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: meta.tintBg, color: meta.color }}
                >
                  <Icon size={20} />
                </span>
                <span className="text-[11px] font-semibold text-[hsl(var(--text-muted))]">
                  {isActive ? 'Filtro ativo' : 'Filtrar'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[hsl(var(--text-primary))] tabular-nums">
                  {card.value}
                </span>
                <span className="text-xs font-bold text-[hsl(var(--text-secondary))]">
                  {card.title}
                </span>
              </div>
            </button>
          )
        })}
      </section>

      {/* Lista Principal com Tabs */}
      <section className="overflow-hidden rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <div className="sim-tablist flex-1" role="tablist" aria-label="Status das solicitações">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pendentes'}
              onClick={() => setActiveTab('pendentes')}
              className="sim-tab"
            >
              <Clock size={14} />
              Pendentes ({pendingTasks.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ajustes'}
              onClick={() => setActiveTab('ajustes')}
              className="sim-tab"
            >
              <AlertTriangle size={14} />
              Ajustes ({rejectedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'enviados'}
              onClick={() => setActiveTab('enviados')}
              className="sim-tab"
            >
              <CheckCircle2 size={14} />
              Enviados ({submittedTasks.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/70"
              />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
            <h3 className="m-0 text-base font-bold text-[hsl(var(--text-primary))]">
              {activeTab === 'enviados'
                ? 'Nenhum envio recente registrado'
                : 'Tudo em dia por aqui!'}
            </h3>
            <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
              {activeTab === 'pendentes'
                ? 'Você não possui solicitações pendentes no momento.'
                : 'Nenhuma solicitação encontrada para este filtro.'}
            </p>
          </div>
        ) : (
          <div>
            {filteredList.map((task) => {
              const meta = EVALUATION_TYPE_META[task.type]
              const Icon = meta.icon
              const isRejected =
                task.statusReq === 'rejeitado' || task.statusReq === 'reprovado'
              const isUrgent =
                task.deadline.state === 'overdue' ||
                task.deadline.state === 'today' ||
                task.deadline.state === 'soon'

              return (
                <article key={task.id} className="sim-eval-card group">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                        style={{
                          background: meta.tintBg,
                          borderColor: meta.tintBorder,
                          color: meta.color,
                        }}
                      >
                        <Icon size={19} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="m-0 text-[15px] font-bold text-[hsl(var(--text-primary))]">
                            <Link
                              href={task.link}
                              className="sim-eval-card-link group-hover:text-[#e11d48] dark:group-hover:text-[#fb7185]"
                            >
                              {task.title}
                            </Link>
                          </h3>
                          {isRejected && (
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[10px] font-bold text-rose-600 uppercase dark:text-rose-400">
                              Refazer
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[hsl(var(--text-secondary))]">
                          <span className="font-bold" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          {task.disciplina && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--text-primary))]">
                              <BookMarked size={12} />
                              {task.disciplina}
                            </span>
                          )}
                          {task.bimestre && (
                            <span className="text-[hsl(var(--text-muted))]">
                              · {task.bimestre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {activeTab === 'enviados' && task.enviadoEm ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} />
                          Enviado {formatRelativeDateTime(task.enviadoEm)}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                            isUrgent
                              ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                              : 'bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-secondary))]'
                          }`}
                        >
                          <Calendar size={12} />
                          {task.prazo ? `Prazo: ${task.deadline.label}` : 'Sem prazo'}
                        </span>
                      )}

                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-secondary))] transition-colors group-hover:bg-[#f43f5e] group-hover:text-white">
                        <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
