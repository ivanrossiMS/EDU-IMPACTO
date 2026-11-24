'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

const MESES_COMPLETOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

interface CalendarMonthToolbarProps {
  year: number
  month: number
  isCurrentMonth: boolean
  mostrarTodos: boolean
  eventosPassadosCount: number
  totalEventosNoMes: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onToggleMostrarTodos: () => void
}

/**
 * Shared month navigation and past-events toggle toolbar for Agenda Digital calendars.
 * Uses container queries so the month switcher and toggle button remain side-by-side,
 * legible, and touch-friendly across mobile and desktop viewports.
 */
export function CalendarMonthToolbar({
  year,
  month,
  isCurrentMonth,
  mostrarTodos,
  eventosPassadosCount,
  totalEventosNoMes,
  onPrevMonth,
  onNextMonth,
  onToday,
  onToggleMostrarTodos,
}: CalendarMonthToolbarProps) {
  const mesCompleto = MESES_COMPLETOS[month] || ''
  const mesCurto = MESES_CURTOS[month] || mesCompleto.slice(0, 3)
  const hasTodayBtn = !isCurrentMonth

  return (
    <div className="ad-cal-toolbar-wrap">
      <style dangerouslySetInnerHTML={{
        __html: `
          .ad-cal-toolbar-wrap {
            container: cal-toolbar / inline-size;
            width: 100%;
            max-width: 100%;
            margin-bottom: 20px;
            box-sizing: border-box;
          }

          .ad-cal-toolbar-card {
            background: #ffffff;
            border-radius: 20px;
            padding: 10px 14px;
            box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
            border: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: nowrap;
            gap: 12px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }

          .ad-cal-month-switcher {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f8fafc;
            padding: 4px 6px;
            min-block-size: 44px;
            border-radius: 15px;
            border: 1px solid #e2e8f0;
            box-sizing: border-box;
            flex: 0 0 auto;
            max-width: 100%;
          }

          .ad-cal-nav-btn {
            position: relative;
            border: none;
            background: #ffffff;
            width: 34px;
            height: 34px;
            min-width: 34px;
            min-height: 34px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
            color: #475569;
            transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease;
            flex-shrink: 0;
            padding: 0;
          }
          .ad-cal-nav-btn:hover {
            background: #eef2ff;
            color: #4f46e5;
          }
          .ad-cal-nav-btn:active {
            transform: scale(0.95);
          }
          .ad-cal-nav-btn:focus-visible,
          .ad-cal-today-btn:focus-visible,
          .ad-cal-toggle-btn:focus-visible {
            outline: 2px solid #6366f1;
            outline-offset: 2px;
          }

          .ad-cal-month-label {
            padding: 0 12px;
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            min-inline-size: 132px;
            text-align: center;
            letter-spacing: -0.01em;
            font-family: 'Outfit', sans-serif;
            white-space: nowrap;
            line-height: 1.2;
          }

          .ad-cal-month-short {
            display: none;
          }

          .ad-cal-today-btn {
            margin-inline-start: 2px;
            padding: 0 10px;
            height: 32px;
            min-height: 32px;
            border-radius: 10px;
            background: #e0e7ff;
            color: #4338ca;
            font-size: 11.5px;
            font-weight: 700;
            font-family: 'Outfit', sans-serif;
            border: 1px solid #c7d2fe;
            cursor: pointer;
            transition: background-color 0.15s ease, transform 0.12s ease;
            white-space: nowrap;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .ad-cal-today-btn:hover {
            background: #c7d2fe;
          }
          .ad-cal-today-btn:active {
            transform: scale(0.96);
          }

          .ad-cal-toggle-btn {
            min-block-size: 44px;
            min-inline-size: 44px;
            padding: 6px 14px;
            border-radius: 15px;
            font-size: 13px;
            font-weight: 700;
            font-family: 'Outfit', sans-serif;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
            white-space: nowrap;
            box-sizing: border-box;
            flex: 0 0 auto;
          }
          .ad-cal-toggle-btn:active {
            transform: scale(0.97);
          }
          .ad-cal-toggle-btn[data-active="false"] {
            background: #f8fafc;
            color: #4f46e5;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
          }
          .ad-cal-toggle-btn[data-active="false"]:hover {
            background: #eef2ff;
            border-color: #c7d2fe;
          }
          .ad-cal-toggle-btn[data-active="true"] {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: #ffffff;
            border: 1px solid #4f46e5;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
          }

          .ad-cal-toggle-label-short {
            display: none;
          }

          .ad-cal-toggle-badge {
            padding: 2px 7px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            line-height: 1.2;
          }

          @media (pointer: coarse) {
            .ad-cal-nav-btn::after {
              content: "";
              position: absolute;
              inset: -5px -3px;
            }
            .ad-cal-today-btn {
              position: relative;
            }
            .ad-cal-today-btn::after {
              content: "";
              position: absolute;
              inset: -6px -2px;
            }
          }

          @container cal-toolbar (inline-size < 540px) {
            .ad-cal-toolbar-card {
              padding: 8px 10px;
              justify-content: space-between;
              gap: 8px;
              border-radius: 18px;
            }
            .ad-cal-month-switcher {
              flex: 1 1 auto;
              min-inline-size: 0;
              justify-content: space-between;
              padding: 3px 4px;
              gap: 2px;
              border-radius: 14px;
            }
            .ad-cal-nav-btn {
              width: 32px;
              height: 36px;
              min-width: 32px;
              min-height: 36px;
              border-radius: 10px;
            }
            .ad-cal-month-label {
              flex: 1 1 auto;
              min-inline-size: 0;
              padding: 0 4px;
              font-size: 13.5px;
            }
            .ad-cal-toggle-btn {
              padding: 6px 10px;
              gap: 5px;
              font-size: 12.5px;
              border-radius: 14px;
            }
            .ad-cal-toggle-badge {
              padding: 2px 6px;
              font-size: 10.5px;
            }
          }

          @container cal-toolbar (inline-size < 430px) {
            .ad-cal-toggle-btn[data-active="true"] .ad-cal-toggle-label-full {
              display: none;
            }
            .ad-cal-toggle-btn[data-active="true"] .ad-cal-toggle-label-short {
              display: inline;
            }
            .ad-cal-toolbar-card[data-has-today="true"] .ad-cal-month-full {
              display: none;
            }
            .ad-cal-toolbar-card[data-has-today="true"] .ad-cal-month-short {
              display: inline;
            }
            .ad-cal-toolbar-card[data-has-today="true"] .ad-cal-today-btn {
              padding: 0 7px;
              font-size: 11px;
              height: 30px;
              min-height: 30px;
            }
          }

          @container cal-toolbar (inline-size < 360px) {
            .ad-cal-toolbar-card {
              padding: 7px 8px;
              gap: 6px;
            }
            .ad-cal-month-full {
              display: none;
            }
            .ad-cal-month-short {
              display: inline;
            }
            .ad-cal-month-label {
              font-size: 13px;
              padding: 0 2px;
            }
            .ad-cal-toggle-btn {
              padding: 6px 9px;
              font-size: 12px;
            }
          }

          @container cal-toolbar (inline-size < 305px) {
            .ad-cal-toolbar-card {
              flex-wrap: wrap;
              justify-content: center;
            }
          }
        `
      }} />

      <div
        className="ad-cal-toolbar-card"
        data-has-today={hasTodayBtn ? 'true' : 'false'}
      >
        {/* Seletor de Mês */}
        <div className="ad-cal-month-switcher" role="group" aria-label="Navegação de mês">
          <button
            type="button"
            className="ad-cal-nav-btn"
            onClick={onPrevMonth}
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <div className="ad-cal-month-label" aria-live="polite">
            <span className="ad-cal-month-full">{mesCompleto} {year}</span>
            <span className="ad-cal-month-short">{mesCurto} {year}</span>
          </div>

          <button
            type="button"
            className="ad-cal-nav-btn"
            onClick={onNextMonth}
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          {hasTodayBtn && (
            <button
              type="button"
              className="ad-cal-today-btn"
              onClick={onToday}
              title="Voltar para o mês atual"
            >
              Hoje
            </button>
          )}
        </div>

        {/* Botão Mostrar Todos / Ocultar Passados */}
        <button
          type="button"
          className="ad-cal-toggle-btn"
          data-active={mostrarTodos ? 'true' : 'false'}
          aria-pressed={mostrarTodos}
          onClick={onToggleMostrarTodos}
          title={
            mostrarTodos
              ? 'Ocultar eventos que já passaram'
              : 'Mostrar todos os eventos do mês (incluindo realizados)'
          }
        >
          {mostrarTodos ? (
            <EyeOff size={15} aria-hidden="true" />
          ) : (
            <Eye size={15} aria-hidden="true" />
          )}
          <span className="ad-cal-toggle-label-full">
            {mostrarTodos ? 'Ocultar passados' : 'Mostrar todos'}
          </span>
          <span className="ad-cal-toggle-label-short">
            {mostrarTodos ? 'Ocultar' : 'Mostrar todos'}
          </span>
          {eventosPassadosCount > 0 && (
            <span
              className="ad-cal-toggle-badge"
              style={{
                background: mostrarTodos
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'rgba(99, 102, 241, 0.12)',
                color: mostrarTodos ? '#ffffff' : '#4f46e5',
              }}
            >
              {totalEventosNoMes}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
