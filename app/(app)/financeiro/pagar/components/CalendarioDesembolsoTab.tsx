'use client'

import React, { useState, useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { type ContaPagarRecord, STATUS_CONTA_PAGAR_CONFIG } from '../types'

interface CalendarioDesembolsoTabProps {
  contas: ContaPagarRecord[]
  onInspect: (conta: ContaPagarRecord) => void
  onBaixar: (conta: ContaPagarRecord) => void
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function CalendarioDesembolsoTab({
  contas,
  onInspect,
  onBaixar,
}: CalendarioDesembolsoTabProps) {
  const hoje = useMemo(() => new Date(), [])
  const hojeStr = useMemo(() => hoje.toISOString().split('T')[0], [hoje])

  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())
  const [selectedDateStr, setSelectedDateStr] = useState<string>(hojeStr)

  const horizonte = useMemo(() => {
    const d7 = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const d15 = new Date(hoje.getTime() + 15 * 86400000).toISOString().split('T')[0]
    const d30 = new Date(hoje.getTime() + 30 * 86400000).toISOString().split('T')[0]

    let somaHoje = 0
    let soma7 = 0
    let soma15 = 0
    let soma30 = 0

    for (const c of contas) {
      if (c.status === 'pago' || c.status === 'cancelado') continue
      const v = Number(c.valor || 0)
      if (c.vencimento === hojeStr) somaHoje += v
      if (c.vencimento >= hojeStr && c.vencimento <= d7) soma7 += v
      if (c.vencimento >= hojeStr && c.vencimento <= d15) soma15 += v
      if (c.vencimento >= hojeStr && c.vencimento <= d30) soma30 += v
    }

    return { somaHoje, soma7, soma15, soma30 }
  }, [contas, hoje, hojeStr])

  const mapaPorDia = useMemo(() => {
    const map = new Map<string, ContaPagarRecord[]>()
    for (const c of contas) {
      if (c.status === 'cancelado' || !c.vencimento) continue
      const list = map.get(c.vencimento) || []
      list.push(c)
      map.set(c.vencimento, list)
    }
    return map
  }, [contas])

  const calendarCells = useMemo(() => {
    const firstDayWeek = new Date(ano, mes, 1).getDay()
    const totalDays = new Date(ano, mes + 1, 0).getDate()
    const cells: Array<{ day: number | null; dateStr: string }> = []

    for (let i = 0; i < firstDayWeek; i++) {
      cells.push({ day: null, dateStr: '' })
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateStr })
    }
    return cells
  }, [ano, mes])

  const contasDiaSelecionado = useMemo(
    () => mapaPorDia.get(selectedDateStr) || [],
    [mapaPorDia, selectedDateStr]
  )

  const handlePrevMonth = () => {
    if (mes === 0) {
      setMes(11)
      setAno((y) => y - 1)
    } else {
      setMes((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (mes === 11) {
      setMes(0)
      setAno((y) => y + 1)
    } else {
      setMes((m) => m + 1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Cards de Horizonte de Liquidez (Light Mode) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {[
          { label: 'Desembolso para Hoje', val: horizonte.somaHoje, cor: '#d97706', sub: 'Títulos com vencimento hoje' },
          { label: 'Necessidade de Caixa (7 Dias)', val: horizonte.soma7, cor: '#0284c7', sub: 'Próximos 7 dias corridos' },
          { label: 'Projeção Quinzenal (15 Dias)', val: horizonte.soma15, cor: '#7c3aed', sub: 'Próximos 15 dias corridos' },
          { label: 'Horizonte Mensal (30 Dias)', val: horizonte.soma30, cor: '#059669', sub: 'Próximos 30 dias corridos' },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: `4px solid ${card.cor}`,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: card.cor, textTransform: 'uppercase' }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>
              {formatCurrency(card.val)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Grid Principal: Calendário Mensal + Painel Lateral do Dia */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CalendarIcon size={18} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                {MONTH_NAMES[mes]} de {ano}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAno(hoje.getFullYear())
                  setMes(hoje.getMonth())
                  setSelectedDateStr(hojeStr)
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Próximo mês"
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  padding: '6px 0',
                  textTransform: 'uppercase',
                }}
              >
                {w}
              </div>
            ))}

            {calendarCells.map((cell, idx) => {
              if (!cell.day) {
                return <div key={`empty-${idx}`} style={{ minHeight: 76, borderRadius: 10, background: '#f8fafc' }} />
              }
              const items = mapaPorDia.get(cell.dateStr) || []
              const totalDia = items.reduce((a, b) => a + (Number(b.valor) || 0), 0)
              const hasVencido = items.some((x) => x.status === 'vencido')
              const hasAberto = items.some((x) => x.status === 'pendente' || x.status === 'agendado')
              const isSelected = cell.dateStr === selectedDateStr
              const isToday = cell.dateStr === hojeStr

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  style={{
                    minHeight: 76,
                    padding: 8,
                    borderRadius: 12,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isSelected
                      ? '#eff6ff'
                      : items.length > 0
                        ? '#ffffff'
                        : '#f8fafc',
                    border: isSelected
                      ? '2px solid #2563eb'
                      : isToday
                        ? '1.5px solid #d97706'
                        : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: isToday ? '#b45309' : isSelected ? '#1d4ed8' : '#334155',
                      }}
                    >
                      {cell.day}
                    </span>
                    {items.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 99,
                          background: hasVencido
                            ? '#fff1f2'
                            : hasAberto
                              ? '#fffbeb'
                              : '#ecfdf5',
                          color: hasVencido ? '#be123c' : hasAberto ? '#b45309' : '#047857',
                          border: hasVencido
                            ? '1px solid #fecdd3'
                            : hasAberto
                              ? '1px solid #fde68a'
                              : '1px solid #a7f3d0',
                        }}
                      >
                        {items.length}
                      </span>
                    )}
                  </div>

                  {totalDia > 0 && (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: hasVencido ? '#be123c' : hasAberto ? '#b45309' : '#047857',
                        marginTop: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {formatCurrency(totalDia)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel Lateral de Compromissos do Dia Selecionado */}
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
              Agenda de Desembolso do Dia
            </div>
            <h4 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              {selectedDateStr.split('-').reverse().join('/')} ({contasDiaSelecionado.length} título{contasDiaSelecionado.length === 1 ? '' : 's'})
            </h4>
          </div>

          {contasDiaSelecionado.length === 0 ? (
            <div
              style={{
                padding: 28,
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                textAlign: 'center',
                color: '#64748b',
                fontSize: 12,
              }}
            >
              Nenhum compromisso agendado para esta data.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contasDiaSelecionado.map((c) => {
                const st = STATUS_CONTA_PAGAR_CONFIG[c.status] || STATUS_CONTA_PAGAR_CONFIG.pendente
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: `1px solid ${st.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{c.descricao}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{c.fornecedorNome}</div>
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 800,
                          color: st.color,
                          background: st.bg,
                          border: `1px solid ${st.border}`,
                        }}
                      >
                        {st.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 14, color: '#0f172a', fontWeight: 900 }}>{formatCurrency(c.valor)}</strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => onInspect(c)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: 8,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Ficha
                        </button>
                        {c.status !== 'pago' && (
                          <button
                            type="button"
                            onClick={() => onBaixar(c)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              background: '#059669',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Baixar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
