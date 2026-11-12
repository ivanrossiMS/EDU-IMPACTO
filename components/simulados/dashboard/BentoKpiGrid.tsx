'use client'

import React from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileSignature,
  PenTool,
} from 'lucide-react'

export type KpiFilterMode = 'all' | 'review' | 'Prova' | 'Simulado' | 'Redação'

interface BentoKpiGridProps {
  activeFilter: KpiFilterMode
  onSelectFilter: (mode: KpiFilterMode) => void
  stats: {
    reviewReady: number
    urgentReview: number
    provasAtivas: number
    provasAguardando: number
    simuladosAtivos: number
    simuladosCompletionPct: number
    redacoesAtivas: number
    adaptadasCount: number
  }
}

export function BentoKpiGrid({
  activeFilter,
  onSelectFilter,
  stats,
}: BentoKpiGridProps) {
  const cards = [
    {
      id: 'review' as KpiFilterMode,
      title: 'Prontas p/ Revisão',
      value: stats.reviewReady,
      subtitle:
        stats.urgentReview > 0
          ? `${stats.urgentReview} com prazo próximo`
          : stats.reviewReady > 0
            ? 'Envios aguardando aprovação'
            : 'Nenhuma fila acumulada',
      icon: CheckCircle2,
      accent: '#8b5cf6',
      accentBg: 'rgba(139, 92, 246, 0.12)',
      accentBorder: 'rgba(139, 92, 246, 0.35)',
      accentGlow: 'rgba(139, 92, 246, 0.24)',
      progressPct: null as number | null,
    },
    {
      id: 'Prova' as KpiFilterMode,
      title: 'Provas Ativas',
      value: stats.provasAtivas,
      subtitle:
        stats.provasAguardando > 0
          ? `${stats.provasAguardando} aguardando prof.`
          : 'Fluxo em dia',
      icon: FileSignature,
      accent: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.12)',
      accentBorder: 'rgba(16, 185, 129, 0.35)',
      accentGlow: 'rgba(16, 185, 129, 0.24)',
      progressPct: null as number | null,
    },
    {
      id: 'Simulado' as KpiFilterMode,
      title: 'Simulados Ativos',
      value: stats.simuladosAtivos,
      subtitle: `${stats.simuladosCompletionPct}% das disciplinas enviadas`,
      icon: BookOpen,
      accent: '#3b82f6',
      accentBg: 'rgba(59, 130, 246, 0.12)',
      accentBorder: 'rgba(59, 130, 246, 0.35)',
      accentGlow: 'rgba(59, 130, 246, 0.24)',
      progressPct: stats.simuladosCompletionPct,
    },
    {
      id: 'Redação' as KpiFilterMode,
      title: 'Redações & Adaptadas',
      value: stats.redacoesAtivas,
      subtitle: `${stats.adaptadasCount} ${stats.adaptadasCount === 1 ? 'versão adaptada' : 'versões adaptadas'} no feed`,
      icon: PenTool,
      accent: '#f43f5e',
      accentBg: 'rgba(244, 63, 94, 0.12)',
      accentBorder: 'rgba(244, 63, 94, 0.35)',
      accentGlow: 'rgba(244, 63, 94, 0.24)',
      progressPct: null as number | null,
    },
  ]

  return (
    <section
      aria-label="Indicadores de avaliações"
      className="mb-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4"
    >
      {cards.map((card) => {
        const isActive = activeFilter === card.id
        const Icon = card.icon

        return (
          <button
            key={card.id}
            type="button"
            data-active={isActive ? 'true' : 'false'}
            aria-pressed={isActive}
            onClick={() => onSelectFilter(isActive ? 'all' : card.id)}
            style={
              {
                '--sim-accent': card.accent,
                '--sim-accent-border': card.accentBorder,
                '--sim-accent-glow': card.accentGlow,
              } as React.CSSProperties
            }
            className="sim-kpi-card group"
          >
            {/* Subtle Ambient Corner Glow */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-75"
              style={{ background: card.accent }}
            />

            {/* Top Row: Icon + Filter Hint */}
            <div className="relative flex w-full items-center justify-between gap-2">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: card.accentBg, color: card.accent }}
              >
                <Icon size={20} strokeWidth={2.2} />
              </span>

              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-muted))] transition-colors group-hover:text-[hsl(var(--text-primary))]">
                {isActive ? 'Filtro ativo' : 'Filtrar'}
                <ArrowUpRight size={13} />
              </span>
            </div>

            {/* Middle: Number + Label */}
            <div className="relative space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-[hsl(var(--text-primary))] tabular-nums">
                  {card.value}
                </span>
                <span className="text-xs font-bold text-[hsl(var(--text-secondary))]">
                  {card.title}
                </span>
              </div>

              {card.progressPct !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(4, card.progressPct))}%`,
                      background: card.accent,
                    }}
                  />
                </div>
              )}

              <p className="m-0 truncate text-xs font-medium text-[hsl(var(--text-muted))]">
                {card.subtitle}
              </p>
            </div>
          </button>
        )
      })}
    </section>
  )
}
