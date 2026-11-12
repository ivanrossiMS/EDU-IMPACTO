'use client'

import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  FileSignature,
  FolderArchive,
  Library,
  Settings,
} from 'lucide-react'
import {
  EVALUATION_TYPE_META,
  NormalizedEvaluation,
  STATUS_META,
} from './simuladosDashboardUtils'

interface PedagogicalRadarPanelProps {
  items: NormalizedEvaluation[]
  statusFilter: string
  onSelectStatusFilter: (status: string) => void
}

const SHORTCUTS = [
  {
    label: 'Provas',
    sub: 'Gerenciar envios',
    href: '/simulados/provas-upload',
    icon: FileSignature,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    label: 'Simulados',
    sub: 'Cadernos e notas',
    href: '/simulados/simulados-upload',
    icon: BookOpen,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    label: 'Adaptadas',
    sub: 'Acervo inclusivo',
    href: '/simulados/arquivo-adaptadas',
    icon: FolderArchive,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    label: 'Banco',
    sub: 'Questões e itens',
    href: '/simulados/banco',
    icon: Library,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
  },
] as const

export function PedagogicalRadarPanel({
  items,
  statusFilter,
  onSelectStatusFilter,
}: PedagogicalRadarPanelProps) {
  // Urgent items: overdue/today/soon deadlines OR partial missing uploads
  const urgentItems = React.useMemo(() => {
    return items
      .filter(
        (item) =>
          item.status !== 'publicado' &&
          item.status !== 'aprovado' &&
          (item.deadline.state === 'overdue' ||
            item.deadline.state === 'today' ||
            item.deadline.state === 'soon' ||
            item.progress.missingNames.length > 0)
      )
      .sort((a, b) => {
        const aDays = a.deadline.daysLeft ?? 999
        const bDays = b.deadline.daysLeft ?? 999
        if (aDays !== bDays) return aDays - bDays
        return a.progress.percent - b.progress.percent
      })
      .slice(0, 4)
  }, [items])

  // Status distribution across loaded evaluations
  const distribution = React.useMemo(() => {
    const keys = ['em_revisao', 'aguardando', 'aprovado', 'publicado'] as const
    const total = items.length || 1
    return keys.map((key) => {
      const count = items.filter((i) => i.status === key).length
      const meta = STATUS_META[key]
      return {
        key,
        label: meta.label,
        color: meta.dot,
        count,
        pct: Math.round((count / total) * 100),
      }
    })
  }, [items])

  return (
    <aside aria-label="Radar pedagógico e atalhos" className="flex flex-col gap-5">
      {/* 1. Radar de Prazos & Pendências */}
      <section className="rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 text-sm font-extrabold text-[hsl(var(--text-primary))]">
            <Clock size={16} className="text-amber-500" />
            Radar de Prazos & Gargalos
          </h2>
          <span className="rounded-full bg-[hsl(var(--bg-elevated))] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--text-secondary))] tabular-nums">
            {urgentItems.length}
          </span>
        </div>

        {urgentItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[hsl(var(--border-subtle))] px-4 py-6 text-center">
            <p className="m-0 text-xs font-semibold text-[hsl(var(--text-secondary))]">
              Nenhum prazo crítico ou pendência urgente no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {urgentItems.map((item) => {
              const typeMeta = EVALUATION_TYPE_META[item.type]
              const isCritical =
                item.deadline.state === 'overdue' || item.deadline.state === 'today'

              return (
                <Link
                  key={item.key}
                  href={item.detailHref}
                  className="group block rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)_/_0.45)] p-3 no-underline transition-all hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--bg-elevated))]"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ color: typeMeta.color }}
                    >
                      {typeMeta.label} {item.seriesText ? `· ${item.seriesText}` : ''}
                    </span>
                    {item.dataLimiteUpload && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                          isCritical
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isCritical && <AlertTriangle size={10} />}
                        {item.deadline.label}
                      </span>
                    )}
                  </div>

                  <p className="m-0 line-clamp-1 text-xs font-bold text-[hsl(var(--text-primary))] group-hover:text-[#e11d48] dark:group-hover:text-[#fb7185]">
                    {item.titulo}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--text-muted))]">
                    <span className="truncate">
                      {item.progress.missingNames.length > 0
                        ? `Falta: ${item.progress.missingNames.slice(0, 2).join(', ')}${
                            item.progress.missingNames.length > 2
                              ? ` +${item.progress.missingNames.length - 2}`
                              : ''
                          }`
                        : `${item.progress.submitted}/${item.progress.total || 1} enviados`}
                    </span>
                    <ArrowRight
                      size={12}
                      className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 2. Distribuição de Status do Ciclo */}
      <section className="rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-sm font-extrabold text-[hsl(var(--text-primary))]">
            Panorama do Ciclo
          </h2>
          {statusFilter !== 'todos' && (
            <button
              type="button"
              onClick={() => onSelectStatusFilter('todos')}
              className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-[#f43f5e] hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* Stacked Distribution Bar */}
        <div
          className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
          role="img"
          aria-label="Distribuição de avaliações por status"
        >
          {distribution.map((seg) =>
            seg.count > 0 ? (
              <div
                key={seg.key}
                style={{ width: `${seg.pct}%`, background: seg.color }}
                title={`${seg.label}: ${seg.count}`}
              />
            ) : null
          )}
        </div>

        <div className="space-y-1.5">
          {distribution.map((seg) => {
            const isSelected = statusFilter === seg.key
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() =>
                  onSelectStatusFilter(isSelected ? 'todos' : seg.key)
                }
                aria-pressed={isSelected}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'border-[#f43f5e]/40 bg-[#f43f5e]/10 font-bold text-[hsl(var(--text-primary))]'
                    : 'border-transparent bg-transparent font-medium text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-elevated))]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: seg.color }}
                  />
                  {seg.label}
                </span>
                <span className="font-bold tabular-nums text-[hsl(var(--text-primary))]">
                  {seg.count}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 3. Acesso Rápido ao Acervo */}
      <section className="rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-sm font-extrabold text-[hsl(var(--text-primary))]">
            Acesso Rápido
          </h2>
          <Link
            href="/simulados/configuracoes"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--text-muted))] no-underline hover:text-[hsl(var(--text-primary))]"
          >
            <Settings size={12} />
            Config.
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {SHORTCUTS.map((sc) => (
            <Link
              key={sc.href}
              href={sc.href}
              className="group flex flex-col gap-2 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)_/_0.4)] p-3 no-underline transition-all hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--bg-elevated))]"
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: sc.bg, color: sc.color }}
              >
                <sc.icon size={16} />
              </span>
              <div>
                <div className="text-xs font-bold text-[hsl(var(--text-primary))]">
                  {sc.label}
                </div>
                <div className="text-[10px] font-medium text-[hsl(var(--text-muted))]">
                  {sc.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </aside>
  )
}
