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
  RotateCcw,
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
      {/* 3D Vertical Pillar / Indicator Strip on Left Edge */}
      <span
        className="sim-eval-3d-pillar"
        style={{
          background: item.isAdaptada
            ? `linear-gradient(180deg, #f59e0b 0%, ${typeMeta.color} 100%)`
            : `linear-gradient(180deg, ${typeMeta.color} 0%, ${typeMeta.color}cc 100%)`,
          boxShadow: `0 0 10px ${item.isAdaptada ? 'rgba(245, 158, 11, 0.4)' : typeMeta.color + '40'}`,
        }}
        aria-hidden="true"
      />

      <div className="sim-eval-grid">
        {/* Coluna 1: Identidade + Título Completo + Metadados Tipográficos */}
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 group-hover:scale-105"
            style={{
              background: typeMeta.tintBg,
              borderColor: typeMeta.tintBorder,
              color: typeMeta.color,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
            }}
            aria-hidden="true"
          >
            <TypeIcon size={20} />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Linha do Título — permite até 2 linhas para evitar corte prematuro */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[15.5px] leading-snug font-extrabold text-[hsl(var(--text-primary))]">
                <Link
                  href={item.detailHref}
                  className="sim-eval-card-link transition-colors group-hover:text-[#e11d48] dark:group-hover:text-[#fb7185]"
                >
                  {item.titulo}
                </Link>
              </h3>

              {item.isAdaptada && (
                <span className="sim-adaptada-pill shadow-2xs">
                  <Sparkles size={10} />
                  Adaptada
                </span>
              )}

              {item.isReaberta && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-700 dark:text-amber-300 shadow-2xs"
                  title="Avaliação com elaboração reaberta"
                >
                  <RotateCcw size={10} className="shrink-0" />
                  Reaberta
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
                    className="inline-flex items-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)_/_0.7)] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] shadow-2xs"
                  >
                    {disc}
                  </span>
                ))}
                {extraDiscCount > 0 && (
                  <span className="inline-flex items-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)_/_0.4)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--text-muted))]">
                    +{extraDiscCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Coluna 2: Progresso Real de Envios + Prazo & Aplicação */}
        <div className="flex min-w-0 flex-col justify-center gap-2">
          {/* Progresso das Requisições */}
          <div className="space-y-1.5" title={progressTooltip || undefined}>
            <div className="flex items-center justify-between gap-2 text-xs">
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

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(item.progress.percent > 0 ? 8 : 0, item.progress.percent)}%`,
                  background: progressBarColor,
                  boxShadow: `0 0 8px ${progressBarColor}40`,
                }}
              />
            </div>

            {item.progress.missingNames.length > 0 && item.progress.submitted > 0 && (
              <p className="m-0 truncate text-[11px] text-[hsl(var(--text-muted))]">
                Falta: <span className="font-medium text-[hsl(var(--text-secondary))]">{item.progress.missingNames.slice(0, 2).join(', ')}</span>
                {item.progress.missingNames.length > 2
                  ? ` +${item.progress.missingNames.length - 2}`
                  : ''}
              </p>
            )}
          </div>

          {/* Datas Relevantes */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-medium">
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
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold whitespace-nowrap shadow-2xs"
            style={{
              background: statusMeta.bg,
              borderColor: `${statusMeta.color}33`,
              color: statusMeta.color,
            }}
          >
            {item.status === 'reaberto' || item.isReaberta ? (
              <RotateCcw size={11} className="shrink-0" style={{ color: statusMeta.color }} />
            ) : (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: statusMeta.dot,
                  boxShadow: `0 0 6px ${statusMeta.dot}`,
                }}
              />
            )}
            {statusMeta.label}
          </span>

          <div className="sim-quick-actions">
            <button
              type="button"
              onClick={() => onOpenGabarito(item)}
              title="Abrir Gabarito / Impressão"
              aria-label={`Abrir gabarito de ${item.titulo}`}
              className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 text-[11px] font-semibold text-[hsl(var(--text-secondary))] shadow-2xs transition-all hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--text-primary))] hover:shadow-xs active:scale-95"
            >
              <CheckSquare size={13} className="text-[#3b82f6]" />
              <span className="hidden xl:inline">Gabarito</span>
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Mais ações para ${item.titulo}`}
                  className="inline-flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-secondary))] shadow-2xs transition-all hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--text-primary))] hover:shadow-xs active:scale-95"
                >
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-[1200] w-52 rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-1.5 shadow-2xl backdrop-blur-md"
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
              className="hidden h-8.5 w-8.5 items-center justify-center rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-secondary))] shadow-2xs transition-all duration-200 group-hover:border-[#f43f5e] group-hover:bg-[#f43f5e] group-hover:text-white group-hover:shadow-md group-hover:shadow-[#f43f5e]/25 group-hover:translate-x-0.5 sm:inline-flex"
            >
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
