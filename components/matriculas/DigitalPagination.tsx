'use client'

import React, { useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  FileSpreadsheet
} from 'lucide-react'

export type LimitePorPagina = 30 | 50 | 100 | 'tudo'

interface DigitalPaginationProps {
  totalItens: number
  limitePorPagina: LimitePorPagina
  paginaAtual: number
  onLimiteChange: (limite: LimitePorPagina) => void
  onPaginaChange: (pagina: number) => void
  className?: string
  style?: React.CSSProperties
}

const LIMITES: LimitePorPagina[] = [30, 50, 100, 'tudo']

export function DigitalPagination({
  totalItens,
  limitePorPagina,
  paginaAtual,
  onLimiteChange,
  onPaginaChange,
  className = '',
  style = {},
}: DigitalPaginationProps) {
  const isTudo = limitePorPagina === 'tudo'
  const pageSize = isTudo ? (totalItens || 1) : Number(limitePorPagina)
  const totalPaginas = isTudo || totalItens === 0 ? 1 : Math.ceil(totalItens / pageSize)

  // Cálculo do intervalo visível
  const { inicio, fim } = useMemo(() => {
    if (totalItens === 0) return { inicio: 0, fim: 0 }
    if (isTudo) return { inicio: 1, fim: totalItens }
    const start = (paginaAtual - 1) * pageSize + 1
    const end = Math.min(paginaAtual * pageSize, totalItens)
    return { inicio: start, fim: end }
  }, [totalItens, isTudo, paginaAtual, pageSize])

  // Algoritmo de numeração inteligente com reticências
  const paginasVisiveis = useMemo(() => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    }

    const pages: (number | string)[] = []
    pages.push(1)

    if (paginaAtual > 3) {
      pages.push('ellipsis-start')
    }

    const start = Math.max(2, paginaAtual - 1)
    const end = Math.min(totalPaginas - 1, paginaAtual + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (paginaAtual < totalPaginas - 2) {
      pages.push('ellipsis-end')
    }

    pages.push(totalPaginas)
    return pages
  }, [totalPaginas, paginaAtual])

  const irParaPagina = (novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > totalPaginas || novaPagina === paginaAtual) return
    onPaginaChange(novaPagina)
  }

  return (
    <div
      className={`digital-pagination-container ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '14px 20px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%), hsl(var(--bg-surface))',
        borderTop: '1px solid hsl(var(--border-subtle))',
        ...style,
      }}
    >
      {/* ── LADO ESQUERDO: SELETOR DE LIMITE + RESUMO ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Seletor Segmentado Ultra Moderno */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'hsl(var(--text-secondary))',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <Layers size={13} style={{ color: '#38bdf8' }} />
            <span>Por página:</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'hsl(var(--bg-elevated))',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            {LIMITES.map(limite => {
              const ativo = limitePorPagina === limite
              const rotulo = limite === 'tudo' ? 'Tudo' : String(limite)

              return (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => {
                    if (limitePorPagina !== limite) {
                      onLimiteChange(limite)
                    }
                  }}
                  title={`Exibir ${limite === 'tudo' ? 'todos os registros' : `${limite} registros por página`}`}
                  style={{
                    position: 'relative',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    padding: '4px 11px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: ativo ? 700 : 500,
                    color: ativo ? '#ffffff' : 'hsl(var(--text-secondary))',
                    background: ativo
                      ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                      : 'transparent',
                    boxShadow: ativo
                      ? '0 2px 8px rgba(56, 189, 248, 0.35), inset 0 1px 1px rgba(255,255,255,0.3)'
                      : 'none',
                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={e => {
                    if (!ativo) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                      e.currentTarget.style.color = 'hsl(var(--text-primary))'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!ativo) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                    }
                  }}
                >
                  {rotulo}
                </button>
              )
            })}
          </div>
        </div>

        {/* Resumo Contadores */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            color: 'hsl(var(--text-secondary))',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: totalItens > 0 ? '#10b981' : 'hsl(var(--text-muted))',
              boxShadow: totalItens > 0 ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
            }}
          />
          {totalItens === 0 ? (
            <span>Nenhum documento encontrado</span>
          ) : isTudo ? (
            <span>
              Exibindo todos os <strong style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>{totalItens}</strong> documentos
            </span>
          ) : (
            <span>
              Mostrando{' '}
              <strong style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>
                {inicio} – {fim}
              </strong>{' '}
              de{' '}
              <strong style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>
                {totalItens}
              </strong>{' '}
              documentos
            </span>
          )}
        </div>
      </div>

      {/* ── LADO DIREITO: CONTROLES DE NAVEGAÇÃO DE PÁGINA ── */}
      {!isTudo && totalPaginas > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {/* Primeira Página */}
          <button
            type="button"
            onClick={() => irParaPagina(1)}
            disabled={paginaAtual === 1}
            title="Primeira página"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              color: paginaAtual === 1 ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))',
              opacity: paginaAtual === 1 ? 0.35 : 1,
              cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (paginaAtual !== 1) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }
            }}
            onMouseLeave={e => {
              if (paginaAtual !== 1) {
                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                e.currentTarget.style.color = 'hsl(var(--text-primary))'
              }
            }}
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Página Anterior */}
          <button
            type="button"
            onClick={() => irParaPagina(paginaAtual - 1)}
            disabled={paginaAtual === 1}
            title="Página anterior"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              color: paginaAtual === 1 ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))',
              opacity: paginaAtual === 1 ? 0.35 : 1,
              cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (paginaAtual !== 1) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }
            }}
            onMouseLeave={e => {
              if (paginaAtual !== 1) {
                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                e.currentTarget.style.color = 'hsl(var(--text-primary))'
              }
            }}
          >
            <ChevronLeft size={15} />
          </button>

          {/* Números de Página */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {paginasVisiveis.map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <span
                    key={`ellipsis_${idx}`}
                    style={{
                      width: '24px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: 'hsl(var(--text-muted))',
                      userSelect: 'none',
                    }}
                  >
                    •••
                  </span>
                )
              }

              const isCurrent = item === paginaAtual

              return (
                <button
                  key={`page_${item}`}
                  type="button"
                  onClick={() => irParaPagina(item)}
                  title={`Página ${item}`}
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: isCurrent ? 700 : 500,
                    border: isCurrent
                      ? '1px solid rgba(56, 189, 248, 0.6)'
                      : '1px solid hsl(var(--border-subtle))',
                    background: isCurrent
                      ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.35) 100%)'
                      : 'hsl(var(--bg-elevated))',
                    color: isCurrent ? '#38bdf8' : 'hsl(var(--text-primary))',
                    boxShadow: isCurrent ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isCurrent) {
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)'
                      e.currentTarget.style.color = '#38bdf8'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isCurrent) {
                      e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                      e.currentTarget.style.color = 'hsl(var(--text-primary))'
                    }
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>

          {/* Próxima Página */}
          <button
            type="button"
            onClick={() => irParaPagina(paginaAtual + 1)}
            disabled={paginaAtual === totalPaginas}
            title="Próxima página"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              color: paginaAtual === totalPaginas ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))',
              opacity: paginaAtual === totalPaginas ? 0.35 : 1,
              cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (paginaAtual !== totalPaginas) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }
            }}
            onMouseLeave={e => {
              if (paginaAtual !== totalPaginas) {
                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                e.currentTarget.style.color = 'hsl(var(--text-primary))'
              }
            }}
          >
            <ChevronRight size={15} />
          </button>

          {/* Última Página */}
          <button
            type="button"
            onClick={() => irParaPagina(totalPaginas)}
            disabled={paginaAtual === totalPaginas}
            title="Última página"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              color: paginaAtual === totalPaginas ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))',
              opacity: paginaAtual === totalPaginas ? 0.35 : 1,
              cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (paginaAtual !== totalPaginas) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'
                e.currentTarget.style.color = '#38bdf8'
              }
            }}
            onMouseLeave={e => {
              if (paginaAtual !== totalPaginas) {
                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                e.currentTarget.style.color = 'hsl(var(--text-primary))'
              }
            }}
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
