'use client'

import React from 'react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ArrowUpRight,
  Calendar,
  CheckSquare,
  Clock,
  CopyPlus,
  Edit3,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react'
import {
  EVALUATION_TYPE_META,
  NormalizedEvaluation,
  STATUS_META,
  formatCalendarDateBR,
  formatRelativeDateTime,
} from './simuladosDashboardUtils'

interface EvaluationRowCardProps {
  item: NormalizedEvaluation
  onOpenGabarito: (item: NormalizedEvaluation) => void
}

export function EvaluationRowCard({
  item,
  onOpenGabarito,
}: EvaluationRowCardProps) {
  const typeMeta = EVALUATION_TYPE_META[item.type]
  const TypeIcon = typeMeta.icon
  const statusMeta = STATUS_META[item.status] || {
    label: item.status,
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    dot: '#64748b',
  }

  const visibleDiscs = item.disciplinas.slice(0, 3)
  const extraDiscCount = Math.max(0, item.disciplinas.length - 3)
  const allDiscsTooltip = item.disciplinas.join(', ')

  const deadlineBadgeColor =
    item.deadline.state === 'overdue'
      ? 'text-rose-600 dark:text-rose-400'
      : item.deadline.state === 'today' || item.deadline.state === 'soon'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-[hsl(var(--text-secondary))]'

  const progressBarColor =
    item.progress.rejected > 0
      ? '#ef4444'
      : item.progress.percent === 100
        ? '#10b981'
        : item.progress.percent > 0
          ? '#3b82f6'
          : '#f59e0b'

  const progressTooltipParts: string[] = []
  if (item.progress.submittedNames.length > 0) {
    progressTooltipParts.push(`Enviadas: ${item.progress.submittedNames.join(', ')}`)
  }
  if (item.progress.missingNames.length > 0) {
    progressTooltipParts.push(`Aguardando: ${item.progress.missingNames.join(', ')}`)
  }
  if (item.progress.rejectedNames.length > 0) {
    progressTooltipParts.push(`Ajuste: ${item.progress.rejectedNames.join(', ')}`)
  }
  const progressTooltip = progressTooltipParts.join(' · ')

  return (
    <article className="sim-eval-card group">
      <div className="sim-eval-grid">
        {/* Coluna 1: Identidade + Título Completo + Metadados Tipográficos */}
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
            style={{
              background: typeMeta.tintBg,
              borderColor: typeMeta.tintBorder,
              color: typeMeta.color,
            }}
            aria-hidden="true"
          >
            <TypeIcon size={19} />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Linha do Título — permite até 2 linhas para evitar corte prematuro */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[15px] leading-snug font-bold text-[hsl(var(--text-primary))]">
                <Link
                  href={item.detailHref}
                  className="sim-eval-card-link transition-colors group-hover:text-[#e11d48] dark:group-hover:text-[#fb7185]"
                >
                  {item.titulo}
                </Link>
              </h3>

              {item.isAdaptada && (
                <span className="sim-adaptada-pill">
                  <Sparkles size={10} />
                  Adaptada
                </span>
              )}
            </div>

            {/* Metadados Tipográficos Limpos (sem sopa de badges) */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[hsl(var(--text-secondary))]">
              <span className="font-bold" style={{ color: typeMeta.color }}>
                {typeMeta.label}
              </span>
              {item.seriesText && (
                <>
                  <span aria-hidden="true" className="text-[hsl(var(--text-muted))]">
                    ·
                  </span>
                  <span className="font-semibold text-[hsl(var(--text-primary))]">
                    {item.seriesText}
                  </span>
                </>
              )}
              {item.bimestreName && (
                <>
                  <span aria-hidden="true" className="text-[hsl(var(--text-muted))]">
                    ·
                  </span>
                  <span>{item.bimestreName}</span>
                </>
              )}
              {item.criadoPorNome && (
                <>
                  <span aria-hidden="true" className="text-[hsl(var(--text-muted))]">
                    ·
                  </span>
                  <span className="text-[hsl(var(--text-muted))]">
                    Por {item.criadoPorNome}
                  </span>
                </>
              )}
              {item.createdAt && (
                <>
                  <span aria-hidden="true" className="text-[hsl(var(--text-muted))]">
                    ·
                  </span>
                  <span className="text-[hsl(var(--text-muted))]">
                    {formatRelativeDateTime(item.createdAt)}
                  </span>
                </>
              )}
            </div>

            {/* Disciplinas Colapsadas */}
            {visibleDiscs.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-1.5 pt-0.5"
                title={allDiscsTooltip}
              >
                {visibleDiscs.map((disc) => (
                  <span
                    key={disc}
                    className="inline-flex items-center rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)_/_0.65)] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--text-secondary))]"
                  >
                    {disc}
                  </span>
                ))}
                {extraDiscCount > 0 && (
                  <span className="inline-flex items-center rounded-md border border-[hsl(var(--border-subtle))] px-1.5 py-0.5 text-[11px] font-bold text-[hsl(var(--text-muted))]">
                    +{extraDiscCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Coluna 2: Progresso Real de Envios + Prazo & Aplicação */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Progresso das Requisições */}
          <div className="space-y-1" title={progressTooltip || undefined}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[hsl(var(--text-secondary))]">
                {item.progress.total > 0
                  ? `${item.progress.submitted}/${item.progress.total} envios`
                  : item.progress.percent === 100
                    ? 'Conteúdo enviado'
                    : 'Sem envios'}
              </span>
              {item.progress.total > 0 && (
                <span className="font-bold tabular-nums text-[hsl(var(--text-primary))]">
                  {item.progress.percent}%
                </span>
              )}
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(item.progress.percent > 0 ? 8 : 0, item.progress.percent)}%`,
                  background: progressBarColor,
                }}
              />
            </div>

            {item.progress.missingNames.length > 0 && item.progress.submitted > 0 && (
              <p className="m-0 truncate text-[11px] text-[hsl(var(--text-muted))]">
                Falta: {item.progress.missingNames.slice(0, 2).join(', ')}
                {item.progress.missingNames.length > 2
                  ? ` +${item.progress.missingNames.length - 2}`
                  : ''}
              </p>
            )}
          </div>

          {/* Datas Relevantes */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
            {item.dataLimiteUpload && (
              <span className={`inline-flex items-center gap-1 font-semibold ${deadlineBadgeColor}`}>
                <Clock size={12} />
                Prazo: {item.deadline.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[hsl(var(--text-muted))]">
              <Calendar size={12} />
              Aplic.: {formatCalendarDateBR(item.dataAplicacao)}
            </span>
          </div>
        </div>

        {/* Coluna 3: Status Pill + Ações Rápidas */}
        <div className="flex items-center justify-between gap-2.5 sm:justify-end">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
            style={{ background: statusMeta.bg, color: statusMeta.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: statusMeta.dot }}
            />
            {statusMeta.label}
          </span>

          <div className="sim-quick-actions">
            <button
              type="button"
              onClick={() => onOpenGabarito(item)}
              title="Abrir Gabarito / Impressão"
              aria-label={`Abrir gabarito de ${item.titulo}`}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-2.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--text-primary))]"
            >
              <CheckSquare size={13} />
              <span className="hidden xl:inline">Gabarito</span>
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Mais ações para ${item.titulo}`}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--text-primary))]"
                >
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-[1200] w-48 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-1.5 shadow-xl"
                >
                  <DropdownMenu.Item asChild>
                    <Link
                      href={item.detailHref}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[hsl(var(--text-primary))] no-underline outline-none hover:bg-[hsl(var(--bg-elevated))]"
                    >
                      <ArrowUpRight size={14} />
                      <span>Abrir Revisão</span>
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onSelect={() => onOpenGabarito(item)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[hsl(var(--text-primary))] outline-none hover:bg-[hsl(var(--bg-elevated))]"
                  >
                    <CheckSquare size={14} />
                    <span>Gabarito</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <Link
                      href={item.editHref}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[hsl(var(--text-primary))] no-underline outline-none hover:bg-[hsl(var(--bg-elevated))]"
                    >
                      <Edit3 size={14} />
                      <span>Editar Configurações</span>
                    </Link>
                  </DropdownMenu.Item>

                  {item.adaptHref && (
                    <DropdownMenu.Item asChild>
                      <Link
                        href={item.adaptHref}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-600 no-underline outline-none hover:bg-amber-500/10 dark:text-amber-400"
                      >
                        <CopyPlus size={14} />
                        <span>Estúdio de Adaptação</span>
                      </Link>
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <Link
              href={item.detailHref}
              tabIndex={-1}
              aria-hidden="true"
              className="hidden h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-secondary))] transition-colors group-hover:bg-[#f43f5e] group-hover:text-white sm:inline-flex"
            >
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
