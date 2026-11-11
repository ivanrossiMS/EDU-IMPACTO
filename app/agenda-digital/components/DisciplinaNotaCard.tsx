'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw } from 'lucide-react'
import {
  getNotaEvalMetrics,
  isNotaPendente,
  resolveBonusExibicao,
  resolveMediaExibicao,
  type NotaEvalTone,
} from '@/lib/notasEngine'

export interface DisciplinaBimestreItem {
  nome: string
  avm?: any
  avb?: any
  simulado?: any
  pntBonu?: any
  bonus?: any
  rec?: any
  mediaF?: any
  mediaG?: any
  mediaFNum: number
}

export interface DisciplinaAnualBimesterItem {
  bimNum: number
  bimNome?: string
  valorStr: string
  valorNum: number
  lancado: boolean
  rec?: any
}

export interface DisciplinaAnualItem {
  nome: string
  bimesters: DisciplinaAnualBimesterItem[]
  lancadosCount: number
  totalBims?: number
  mediaFNum: number
  mediaAnualFormatada: string
  isPassed: boolean
}

const TONE_PALETTE: Record<
  NotaEvalTone,
  { text: string; fill: string; track: string; minFillWidth?: number }
> = {
  ok: {
    text: '#047857',
    fill: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
    track: '#d1fae5',
  },
  warn: {
    text: '#d97706',
    fill: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
    track: '#fef3c7',
  },
  low: {
    text: '#dc2626',
    fill: 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)',
    track: '#ffe4e6',
    minFillWidth: 5,
  },
  falta: {
    text: '#b45309',
    fill: '#f59e0b',
    track: '#fef3c7',
    minFillWidth: 4,
  },
  pending: {
    text: '#94a3b8',
    fill: 'transparent',
    track: '#e2e8f0',
  },
}

function getCardStateTheme(isPending: boolean, isPassed: boolean) {
  if (isPending) {
    return {
      ribbon: 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)',
      surface: '#ffffff',
      border: '1px solid #e2e8f0',
      shadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
      pillBg: '#f1f5f9',
      pillText: '#64748b',
      pillDot: '#94a3b8',
      pillLabel: 'Pendente',
      mediaBoxBg: '#f8fafc',
      mediaBoxBorder: '1px solid #e2e8f0',
      mediaText: '#64748b',
      mainBarFill: 'transparent',
    }
  }

  if (isPassed) {
    return {
      ribbon: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
      surface: '#ffffff',
      border: '1px solid #e2e8f0',
      shadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
      pillBg: '#dcfce7',
      pillText: '#15803d',
      pillDot: '#10b981',
      pillLabel: 'Na Média',
      mediaBoxBg: '#ecfdf5',
      mediaBoxBorder: '1px solid #a7f3d0',
      mediaText: '#047857',
      mainBarFill: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
    }
  }

  return {
    ribbon: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)',
    surface: 'linear-gradient(180deg, #fffaf9 0%, #ffffff 42%)',
    border: '1px solid #fecaca',
    shadow: '0 4px 16px rgba(239, 68, 68, 0.07)',
    pillBg: '#fee2e2',
    pillText: '#dc2626',
    pillDot: '#ef4444',
    pillLabel: 'Abaixo',
    mediaBoxBg: '#fef2f2',
    mediaBoxBorder: '1px solid #fecaca',
    mediaText: '#dc2626',
    mainBarFill: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)',
  }
}

/**
 * Estilos compartilhados de Container Queries (`@container disc-card`) e `@media print`
 * para manter os cards responsivos em qualquer largura de grid e compactos na impressão A4.
 */
export function DisciplinaNotaCardStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .disciplina-card {
            container-type: inline-size;
            container-name: disc-card;
            position: relative;
            overflow: clip;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }

          @media (hover: hover) {
            .disciplina-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08) !important;
            }
          }

          .disciplina-pilares-grid {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .disciplina-pilares-grid[data-cols="1"] {
            grid-template-columns: minmax(0, 1fr);
          }

          .disciplina-pilares-grid[data-cols="3"] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .disciplina-pilares-grid[data-cols="4"] {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .disciplina-extras-row {
            display: grid;
            gap: 8px;
            grid-template-columns: minmax(0, 1fr);
          }

          .disciplina-extras-row[data-cols="2"] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          @container disc-card (max-width: 315px) {
            .disciplina-pilares-grid[data-cols="4"] {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @container disc-card (max-width: 285px) {
            .disciplina-card-body {
              padding: 12px 12px 13px !important;
              gap: 10px !important;
            }

            .disciplina-pilares-grid[data-cols="3"] {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .disciplina-pilares-grid[data-cols="3"] > .disciplina-pilar:last-child {
              grid-column: 1 / -1;
            }

            .disciplina-extras-row[data-cols="2"] {
              grid-template-columns: minmax(0, 1fr);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .disciplina-card {
              transition: none !important;
            }
          }

          @media print {
            .disciplina-card {
              transform: none !important;
              box-shadow: none !important;
              border-radius: 8px !important;
              border: 1px solid #cbd5e1 !important;
              background: #ffffff !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            .disciplina-card-ribbon {
              height: 2px !important;
            }

            .disciplina-card-body {
              padding: 6px 9px !important;
              gap: 4px !important;
            }

            .disciplina-card-header {
              gap: 6px !important;
            }

            .disciplina-card-nome {
              font-size: 10.5px !important;
              line-height: 1.2 !important;
            }

            .disciplina-card-status-row {
              margin-top: 2px !important;
              gap: 4px !important;
            }

            .disciplina-card-status-pill {
              font-size: 8px !important;
              padding: 1px 5px !important;
            }

            .disciplina-card-media-box {
              padding: 2px 6px !important;
              border-radius: 6px !important;
              background: #f8fafc !important;
            }

            .disciplina-card-media-caption {
              font-size: 7px !important;
            }

            .disciplina-card-media-val {
              font-size: 14px !important;
              line-height: 1 !important;
            }

            .disciplina-card-prog-main,
            .disciplina-pilar-bar,
            .disciplina-rec-bar {
              display: none !important;
            }

            .disciplina-pilares-grid {
              gap: 4px !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .disciplina-pilares-grid[data-cols="3"] {
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            }

            .disciplina-pilares-grid[data-cols="4"] {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }

            .disciplina-pilar {
              padding: 3px 5px !important;
              border-radius: 5px !important;
              gap: 1px !important;
              background: #f8fafc !important;
            }

            .disciplina-pilar-dot {
              width: 4px !important;
              height: 4px !important;
            }

            .disciplina-pilar-label {
              font-size: 7.5px !important;
            }

            .disciplina-pilar-val {
              font-size: 9.5px !important;
              color: #0f172a !important;
            }

            .disciplina-extras-row {
              gap: 4px !important;
            }

            .disciplina-extra-chip {
              padding: 2px 6px !important;
              border-radius: 5px !important;
              font-size: 8px !important;
            }
          }
        `,
      }}
    />
  )
}

interface PillarProps {
  label: string
  dotColor: string
  val: any
  delay: number
}

function EvaluationPillar({ label, dotColor, val, delay }: PillarProps) {
  const m = getNotaEvalMetrics(val)
  const palette = TONE_PALETTE[m.tone]

  return (
    <div
      className="disciplina-pilar"
      style={{
        background: '#f8fafc',
        border: '1px solid #eef2f7',
        borderRadius: 11,
        padding: '8px 9px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minInlineSize: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minInlineSize: 0 }}>
        <span
          className="disciplina-pilar-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: m.isPending ? '#cbd5e1' : dotColor,
            flexShrink: 0,
          }}
        />
        <span
          className="disciplina-pilar-label"
          title={label}
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#64748b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>

      <div
        className="disciplina-pilar-val"
        style={{
          fontSize: m.isPending || m.isFalta ? 11.5 : 14.5,
          fontWeight: m.isPending ? 600 : 800,
          fontVariantNumeric: 'tabular-nums',
          color: palette.text,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {m.display}
      </div>

      <div
        className="disciplina-pilar-bar"
        aria-hidden="true"
        style={{
          width: '100%',
          height: 4,
          borderRadius: 999,
          background: palette.track,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!m.isPending && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${m.pct}%` }}
            transition={{ duration: 0.65, ease: 'easeOut', delay }}
            style={{
              height: '100%',
              background: palette.fill,
              borderRadius: 999,
              minWidth: m.pct === 0 && palette.minFillWidth ? palette.minFillWidth : undefined,
            }}
          />
        )}
      </div>
    </div>
  )
}

interface MainProgressBarProps {
  pct: number
  isPending: boolean
  isZeroScore: boolean
  fill: string
  delay: number
}

function MainProgressBar({ pct, isPending, isZeroScore, fill, delay }: MainProgressBarProps) {
  return (
    <div
      className="disciplina-card-prog-main"
      title={isPending ? 'Aguardando lançamento da média' : 'Escala de 0 a 10 (marcador vertical em 7,0)'}
      style={{
        width: '100%',
        height: 7,
        borderRadius: 999,
        background: '#f1f5f9',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {!isPending && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay }}
          style={{
            height: '100%',
            background: fill,
            borderRadius: 999,
            minWidth: isZeroScore ? 6 : undefined,
          }}
        />
      )}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '70%',
          top: 0,
          bottom: 0,
          width: 2,
          background: 'rgba(15, 23, 42, 0.22)',
          zIndex: 2,
        }}
      />
    </div>
  )
}

export function DisciplinaBimestreCard({
  disciplina: d,
  index,
  printClass = 'print-disciplina-item',
}: {
  disciplina: DisciplinaBimestreItem
  index: number
  printClass?: 'print-disciplina-item' | 'notas-modal-disciplina-item'
}) {
  const mediaExibicao = resolveMediaExibicao(d.mediaF, d.mediaG)
  const isMediaPendente = mediaExibicao === 'Pendente'
  const isPassed = d.mediaFNum >= 7.0
  const theme = getCardStateTheme(isMediaPendente, isPassed)
  const bonusExibicao = resolveBonusExibicao(d.pntBonu, d.bonus)
  const hasSimulado = !isNotaPendente(d.simulado)
  const hasRec = !isNotaPendente(d.rec)
  const recMetrics = hasRec ? getNotaEvalMetrics(d.rec) : null
  const mainPct = isMediaPendente ? 0 : Math.max(0, Math.min(d.mediaFNum * 10, 100))
  const delayBase = Math.min(index * 0.03, 0.35)
  const extrasCount = (bonusExibicao ? 1 : 0) + (hasRec ? 1 : 0)

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: delayBase }}
      className={`disciplina-card ${printClass}`}
      style={{
        background: theme.surface,
        borderRadius: 18,
        border: theme.border,
        boxShadow: theme.shadow,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Status Gradient Ribbon */}
      <div
        className="disciplina-card-ribbon"
        style={{
          height: 4,
          width: '100%',
          background: theme.ribbon,
          flexShrink: 0,
        }}
      />

      <div
        className="disciplina-card-body"
        style={{
          padding: '14px 16px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
          flex: 1,
        }}
      >
        {/* Header: Title + Status Pill + Final Média */}
        <div
          className="disciplina-card-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minInlineSize: 0, flex: '1 1 auto' }}>
            <h4
              className="disciplina-card-nome"
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.28,
                letterSpacing: '-0.01em',
                wordBreak: 'break-word',
              }}
            >
              {d.nome}
            </h4>

            <div
              className="disciplina-card-status-row"
              style={{
                marginTop: 5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="disciplina-card-status-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  color: theme.pillText,
                  background: theme.pillBg,
                  padding: '2px 8px',
                  borderRadius: 999,
                  lineHeight: 1.3,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: theme.pillDot,
                  }}
                />
                {theme.pillLabel}
              </span>
            </div>
          </div>

          <div
            className="disciplina-card-media-box notas-disciplina-grade-box"
            style={{
              flexShrink: 0,
              background: theme.mediaBoxBg,
              border: theme.mediaBoxBorder,
              borderRadius: 11,
              padding: '5px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              minWidth: 58,
            }}
          >
            <span
              className="disciplina-card-media-caption"
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#64748b',
                lineHeight: 1.1,
                marginBottom: 1,
              }}
            >
              Média
            </span>
            <span
              className="disciplina-card-media-val notas-disciplina-grade-val"
              style={{
                fontSize: isMediaPendente ? 11.5 : 20,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                fontVariantNumeric: 'tabular-nums',
                color: theme.mediaText,
                lineHeight: 1.05,
              }}
            >
              {mediaExibicao}
            </span>
          </div>
        </div>

        {/* Main Responsive Progress Bar (0–10 with 7.0 marker) */}
        <MainProgressBar
          pct={mainPct}
          isPending={isMediaPendente}
          isZeroScore={!isMediaPendente && d.mediaFNum === 0}
          fill={theme.mainBarFill}
          delay={delayBase + 0.08}
        />

        {/* Responsive Pillars: Av. Mensal | Av. Bimestral | conditional Simulado */}
        <div
          className="disciplina-pilares-grid"
          data-cols={hasSimulado ? '3' : '2'}
        >
          <EvaluationPillar
            label="Av. Mensal"
            dotColor="#0ea5e9"
            val={d.avm}
            delay={delayBase + 0.12}
          />
          <EvaluationPillar
            label="Av. Bimestral"
            dotColor="#6366f1"
            val={d.avb}
            delay={delayBase + 0.16}
          />
          {hasSimulado && (
            <EvaluationPillar
              label="Simulado"
              dotColor="#8b5cf6"
              val={d.simulado}
              delay={delayBase + 0.2}
            />
          )}
        </div>

        {/* Separated Bônus & Recuperação Row (shown only when present) */}
        {extrasCount > 0 && (
          <div
            className="disciplina-extras-row"
            data-cols={extrasCount === 2 ? '2' : '1'}
            style={{ marginTop: 'auto' }}
          >
            {bonusExibicao && (
              <div
                className="disciplina-extra-chip"
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  borderRadius: 10,
                  padding: '6px 9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  minInlineSize: 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#0f766e',
                  }}
                >
                  <Sparkles size={11} style={{ flexShrink: 0 }} />
                  Bônus
                </span>
                <strong
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: '#0d9488',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bonusExibicao.startsWith('+') ? bonusExibicao : `+ ${bonusExibicao}`}
                </strong>
              </div>
            )}

            {hasRec && recMetrics && (
              <div
                className="disciplina-extra-chip"
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  padding: '6px 9px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minInlineSize: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#b45309',
                    }}
                  >
                    <RotateCcw size={11} style={{ flexShrink: 0 }} />
                    Recuperação
                  </span>
                  <strong
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: recMetrics.score !== null && recMetrics.score >= 7.0 ? '#047857' : '#d97706',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {recMetrics.display}
                  </strong>
                </div>

                {!recMetrics.isFalta && (
                  <div
                    className="disciplina-rec-bar"
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      height: 3,
                      borderRadius: 999,
                      background: '#fef3c7',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${recMetrics.pct}%` }}
                      transition={{ duration: 0.65, ease: 'easeOut', delay: delayBase + 0.22 }}
                      style={{
                        height: '100%',
                        borderRadius: 999,
                        background:
                          recMetrics.score !== null && recMetrics.score >= 7.0
                            ? '#10b981'
                            : '#f59e0b',
                        minWidth: recMetrics.pct === 0 ? 4 : undefined,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.article>
  )
}

export function DisciplinaAnualCard({
  disciplina: d,
  index,
  printClass = 'print-disciplina-item',
}: {
  disciplina: DisciplinaAnualItem
  index: number
  printClass?: 'print-disciplina-item' | 'notas-modal-disciplina-item'
}) {
  const isMediaPendente = d.lancadosCount === 0 || isNotaPendente(d.mediaAnualFormatada)
  const theme = getCardStateTheme(isMediaPendente, d.isPassed)
  const mainPct = isMediaPendente ? 0 : Math.max(0, Math.min(d.mediaFNum * 10, 100))
  const delayBase = Math.min(index * 0.025, 0.35)

  const bimsWithRec = d.bimesters.filter((b) => !isNotaPendente(b.rec))
  const pilarDots = ['#0ea5e9', '#6366f1', '#8b5cf6', '#06b6d4']

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: delayBase }}
      className={`disciplina-card ${printClass}`}
      style={{
        background: theme.surface,
        borderRadius: 18,
        border: theme.border,
        boxShadow: theme.shadow,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="disciplina-card-ribbon"
        style={{
          height: 4,
          width: '100%',
          background: theme.ribbon,
          flexShrink: 0,
        }}
      />

      <div
        className="disciplina-card-body"
        style={{
          padding: '14px 16px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
          flex: 1,
        }}
      >
        <div
          className="disciplina-card-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minInlineSize: 0, flex: '1 1 auto' }}>
            <h4
              className="disciplina-card-nome"
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.28,
                letterSpacing: '-0.01em',
                wordBreak: 'break-word',
              }}
            >
              {d.nome}
            </h4>

            <div
              className="disciplina-card-status-row"
              style={{
                marginTop: 5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="disciplina-card-status-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  color: theme.pillText,
                  background: theme.pillBg,
                  padding: '2px 8px',
                  borderRadius: 999,
                  lineHeight: 1.3,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: theme.pillDot,
                  }}
                />
                {theme.pillLabel}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>
                {d.lancadosCount} {d.lancadosCount === 1 ? 'bimestre' : 'bimestres'}
              </span>
            </div>
          </div>

          <div
            className="disciplina-card-media-box notas-disciplina-grade-box"
            style={{
              flexShrink: 0,
              background: theme.mediaBoxBg,
              border: theme.mediaBoxBorder,
              borderRadius: 11,
              padding: '5px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              minWidth: 64,
            }}
          >
            <span
              className="disciplina-card-media-caption"
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#64748b',
                lineHeight: 1.1,
                marginBottom: 1,
              }}
            >
              Média Anual
            </span>
            <span
              className="disciplina-card-media-val notas-disciplina-grade-val"
              style={{
                fontSize: isMediaPendente ? 11.5 : 20,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                fontVariantNumeric: 'tabular-nums',
                color: theme.mediaText,
                lineHeight: 1.05,
              }}
            >
              {isMediaPendente ? 'Pendente' : d.mediaAnualFormatada}
            </span>
          </div>
        </div>

        <MainProgressBar
          pct={mainPct}
          isPending={isMediaPendente}
          isZeroScore={!isMediaPendente && d.mediaFNum === 0}
          fill={theme.mainBarFill}
          delay={delayBase + 0.08}
        />

        {/* Responsive Pillars per Bimestre */}
        <div
          className="disciplina-pilares-grid"
          data-cols={d.bimesters.length >= 4 ? '4' : String(Math.max(1, d.bimesters.length))}
        >
          {d.bimesters.map((b, bIdx) => (
            <EvaluationPillar
              key={b.bimNum}
              label={`${b.bimNum}º Bim`}
              dotColor={pilarDots[bIdx % pilarDots.length]}
              val={b.lancado ? b.valorStr : null}
              delay={delayBase + 0.1 + bIdx * 0.04}
            />
          ))}
        </div>

        {/* Separated Semestral Recuperação Chips when present */}
        {bimsWithRec.length > 0 && (
          <div
            className="disciplina-extras-row"
            data-cols={bimsWithRec.length > 1 ? '2' : '1'}
            style={{ marginTop: 'auto' }}
          >
            {bimsWithRec.map((b) => {
              const recMetrics = getNotaEvalMetrics(b.rec)
              const semTitle =
                b.bimNum === 2
                  ? `Recuperação do 1º Semestre: ${recMetrics.display}`
                  : b.bimNum === 4
                    ? `Recuperação do 2º Semestre: ${recMetrics.display}`
                    : `Recuperação (${b.bimNum}º Bim): ${recMetrics.display}`

              return (
                <div
                  key={`rec-${b.bimNum}`}
                  title={semTitle}
                  className="disciplina-extra-chip"
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 10,
                    padding: '6px 9px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minInlineSize: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#b45309',
                      }}
                    >
                      <RotateCcw size={10} style={{ flexShrink: 0 }} />
                      Recuperação ({b.bimNum}º)
                    </span>
                    <strong
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: recMetrics.score !== null && recMetrics.score >= 7.0 ? '#047857' : '#d97706',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {recMetrics.display}
                    </strong>
                  </div>

                  {!recMetrics.isFalta && (
                    <div
                      className="disciplina-rec-bar"
                      aria-hidden="true"
                      style={{
                        width: '100%',
                        height: 3,
                        borderRadius: 999,
                        background: '#fef3c7',
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${recMetrics.pct}%` }}
                        transition={{ duration: 0.65, ease: 'easeOut', delay: delayBase + 0.22 }}
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          background:
                            recMetrics.score !== null && recMetrics.score >= 7.0
                              ? '#10b981'
                              : '#f59e0b',
                          minWidth: recMetrics.pct === 0 ? 4 : undefined,
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.article>
  )
}
