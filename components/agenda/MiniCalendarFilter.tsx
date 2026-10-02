'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown, Check } from 'lucide-react'
import Portal from '@/components/Portal'

interface MiniCalendarFilterProps {
  selectedDate: string | null // Format 'YYYY-MM-DD'
  onSelectDate: (date: string | null) => void
  activeDatesWithComunicados?: Set<string> // Set of 'YYYY-MM-DD' that have comunicados
  activeDates?: Set<string>
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function MiniCalendarFilter({
  selectedDate,
  onSelectDate,
  activeDatesWithComunicados,
  activeDates
}: MiniCalendarFilterProps) {
  const datesSet = activeDatesWithComunicados || activeDates || new Set<string>()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine current viewing month/year
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => {
    return toDateString(today.getFullYear(), today.getMonth(), today.getDate())
  }, [today])

  const yesterdayStr = useMemo(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return toDateString(y.getFullYear(), y.getMonth(), y.getDate())
  }, [])

  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  // Synchronize viewDate if selectedDate changes from external source
  useEffect(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number)
      setViewDate(new Date(y, m - 1, 1))
    }
  }, [selectedDate])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(viewYear, viewMonth - 1, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(viewYear, viewMonth + 1, 1))
  }

  // Days matrix generation
  const daysGrid = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells: {
      day: number
      dateStr: string
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      hasComunicados: boolean
    }[] = []

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
      const dateStr = toDateString(prevYear, prevMonth, day)
      cells.push({
        day,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        hasComunicados: datesSet.has(dateStr)
      })
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = toDateString(viewYear, viewMonth, day)
      cells.push({
        day,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        hasComunicados: datesSet.has(dateStr)
      })
    }

    // Next month padding to fill grid
    const remaining = (7 - (cells.length % 7)) % 7
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
      const dateStr = toDateString(nextYear, nextMonth, day)
      cells.push({
        day,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        hasComunicados: datesSet.has(dateStr)
      })
    }

    return cells
  }, [viewYear, viewMonth, todayStr, selectedDate, datesSet])

  // Formatted label for button
  const buttonLabel = useMemo(() => {
    if (!selectedDate) return 'Filtrar por data'
    if (selectedDate === todayStr) return 'Hoje'
    if (selectedDate === yesterdayStr) return 'Ontem'
    const [y, m, d] = selectedDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }, [selectedDate, todayStr, yesterdayStr])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          height: 38,
          padding: '0 14px',
          borderRadius: 12,
          border: selectedDate ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #e2e8f0',
          background: selectedDate
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)'
            : '#ffffff',
          color: selectedDate ? '#4f46e5' : '#475569',
          fontSize: 13,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          boxShadow: selectedDate ? '0 2px 8px rgba(99, 102, 241, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={e => {
          if (!selectedDate) {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.background = '#f8fafc'
          }
        }}
        onMouseLeave={e => {
          if (!selectedDate) {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.background = '#ffffff'
          }
        }}
      >
        <Calendar size={15} color={selectedDate ? '#4f46e5' : '#64748b'} />
        <span>{buttonLabel}</span>

        {selectedDate ? (
          <span
            role="button"
            title="Limpar data"
            onClick={e => {
              e.stopPropagation()
              onSelectDate(null)
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4f46e5',
              cursor: 'pointer',
              marginLeft: 2,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'
            }}
          >
            <X size={11} strokeWidth={2.6} />
          </span>
        ) : (
          <ChevronDown size={14} color="#94a3b8" />
        )}
      </button>

      {/* Modal Mini Calendário Centralizado na Tela */}
      <AnimatePresence>
        {isOpen && (
          <Portal>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100050,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                padding: 16
              }}
              onClick={() => setIsOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 350,
                  background: '#ffffff',
                  borderRadius: 24,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 30px 80px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  userSelect: 'none'
                }}
              >
                {/* Header: Month / Year + Navigation + Close */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        {MONTH_NAMES[viewMonth]} {viewYear}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                        Filtrar comunicados por data
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#475569',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}
                      title="Mês anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#475569',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}
                      title="Próximo mês"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: 'none',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#64748b',
                        marginLeft: 4,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                      title="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Quick Filter Chips */}
                <div style={{ display: 'flex', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 12, border: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(todayStr)
                      setIsOpen(false)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: selectedDate === todayStr ? '#4f46e5' : 'transparent',
                      color: selectedDate === todayStr ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(yesterdayStr)
                      setIsOpen(false)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: selectedDate === yesterdayStr ? '#4f46e5' : 'transparent',
                      color: selectedDate === yesterdayStr ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Ontem
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(null)
                      setIsOpen(false)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: !selectedDate ? '#0f172a' : 'transparent',
                      color: !selectedDate ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Todos os dias
                  </button>
                </div>

                {/* Weekday Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', paddingTop: 4 }}>
                  {WEEKDAY_NAMES.map(w => (
                    <span key={w} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {w}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {daysGrid.map((cell, idx) => {
                    const isSelected = cell.isSelected
                    const isCurrent = cell.isCurrentMonth
                    const isToday = cell.isToday
                    const hasComs = cell.hasComunicados

                    return (
                      <button
                        key={`${cell.dateStr}-${idx}`}
                        type="button"
                        onClick={() => {
                          onSelectDate(cell.dateStr)
                          setIsOpen(false)
                        }}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          border: isToday && !isSelected ? '1.5px solid #6366f1' : 'none',
                          background: isSelected
                            ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                            : 'transparent',
                          color: isSelected
                            ? '#ffffff'
                            : isCurrent
                            ? '#1e293b'
                            : '#cbd5e1',
                          fontSize: 13,
                          fontWeight: isSelected || isToday ? 800 : isCurrent ? 600 : 400,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f1f5f9'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <span>{cell.day}</span>
                        {hasComs && (
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: isSelected ? '#ffffff' : '#6366f1',
                              marginTop: 1,
                              boxShadow: isSelected ? 'none' : '0 0 4px rgba(99, 102, 241, 0.6)'
                            }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                    <span>Dias com comunicados</span>
                  </div>
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDate(null)
                        setIsOpen(false)
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: 8,
                        transition: 'all 0.15s'
                      }}
                    >
                      Limpar data
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  )
}
