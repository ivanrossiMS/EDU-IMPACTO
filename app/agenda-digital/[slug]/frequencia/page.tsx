'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import React, { useState, useMemo, use } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Clock, ShieldCheck, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Loader2, GraduationCap, Info, LogOut, Lock, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

import { useParams, useSearchParams } from 'next/navigation'

const SAIDA_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Campo_Grande',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const SAIDA_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Campo_Grande',
  hour: '2-digit',
  minute: '2-digit'
})

const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseCallDateSafe(rawDate: string): Date | null {
  if (!rawDate) return null
  const normalized =
    rawDate.includes('T') && !rawDate.endsWith('Z') && !rawDate.includes('-') && !rawDate.includes('+')
      ? `${rawDate}-04:00`
      : rawDate
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function ADFrequenciaPage({ params }: { params: any }) {
  const { adConfig } = useAgendaDigital()
  const isRestricted = adConfig?.permissoes?.visualizarFrequencia === false

  const { aluno } = useSelectedStudent()
  const { currentUser } = useApp()
  const resolvedParams = useParams() as { slug: string }
  const queryClient = useQueryClient()

  const invalidateAllFrequenciaQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['frequencias-aluno', resolvedParams.slug] })
    queryClient.invalidateQueries({ queryKey: ['portaria-eventos-aluno', resolvedParams.slug] })
    queryClient.invalidateQueries({ queryKey: ['saida-calls-aluno', resolvedParams.slug] })
  }, [queryClient, resolvedParams.slug])

  useAgendaRealtime({
    table: 'frequencias',
    toastConfig: {
      enabled: true,
      insertMessage: () => `Nova frequência registrada!`,
      updateMessage: () => `Registro de frequência atualizado!`,
      icon: <CheckCircle2 size={18} color="#16a34a" />
    },
    onInsert: invalidateAllFrequenciaQueries,
    onUpdate: invalidateAllFrequenciaQueries,
    onDelete: invalidateAllFrequenciaQueries
  })

  // Escuta eventos de saída consolidados via AgendaRealtimeProvider (sem abrir canal WebSocket duplicado)
  useAgendaRealtime({
    table: 'saida_calls',
    onInsert: invalidateAllFrequenciaQueries,
    onUpdate: invalidateAllFrequenciaQueries,
    onDelete: invalidateAllFrequenciaQueries
  })

  // State for interactive calendar
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Trava a rolagem do body quando o modal estiver aberto
  React.useEffect(() => {
    if (selectedDate) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedDate])

  // Reset states on student change
  React.useEffect(() => {
    setCurrentMonth(new Date())
    setSelectedDate(null)
  }, [resolvedParams.slug])

  const { monthStart, calendarDays, calendarRange, currentMonthLabel, currentYearLabel } = useMemo(() => {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(mStart)
    const gridStart = startOfWeek(mStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(mEnd, { weekStartsOn: 0 })
    return {
      monthStart: mStart,
      calendarDays: eachDayOfInterval({ start: gridStart, end: gridEnd }),
      calendarRange: {
        from: format(gridStart, 'yyyy-MM-dd'),
        to: format(gridEnd, 'yyyy-MM-dd')
      },
      currentMonthLabel: format(mStart, 'MMMM', { locale: ptBR }),
      currentYearLabel: format(mStart, 'yyyy')
    }
  }, [currentMonth])

  // Fetch real student attendance logs from database based on turma and alunoId
  const { data: frequenciasDb = [], isLoading: isLoadingFrequencias } = useApiQuery<any[]>(
    ['frequencias-aluno', resolvedParams.slug, aluno?.turma || ''],
    '/api/academico/frequencias',
    { aluno_id: resolvedParams.slug, turma_id: aluno?.turma || '' },
    { enabled: !!resolvedParams.slug && !isRestricted }
  )

  // Fallback para eventos de portaria
  const { data: eventosPortariaRaw } = useApiQuery<any>(
    ['portaria-eventos-aluno', resolvedParams.slug, aluno?.id, aluno?.matricula],
    '/api/portaria/eventos',
    { aluno_id: aluno?.id || resolvedParams.slug, matricula: aluno?.matricula || resolvedParams.slug },
    { enabled: !!resolvedParams.slug && !isRestricted }
  )

  const eventosPortaria = useMemo(() => {
    if (!eventosPortariaRaw) return []
    if (Array.isArray(eventosPortariaRaw)) return eventosPortariaRaw
    if (Array.isArray(eventosPortariaRaw.data)) return eventosPortariaRaw.data
    return []
  }, [eventosPortariaRaw])

  // Histórico de saídas confirmadas (escopado à janela do calendário visível)
  const { data: saidaCalls = [] } = useApiQuery<any[]>(
    ['saida-calls-aluno', resolvedParams.slug, calendarRange.from, calendarRange.to],
    '/api/saida/calls',
    { studentId: resolvedParams.slug, from: calendarRange.from, to: calendarRange.to },
    { enabled: !!resolvedParams.slug && !isRestricted }
  )

  // Find unread items and mark as read
  React.useEffect(() => {
    if (!frequenciasDb || frequenciasDb.length === 0 || !resolvedParams.slug) return;
    
    const isFamily = currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável';
    const currentReaderId = currentUser?.id;
    if (!currentReaderId) return;

    const searchParams = new URLSearchParams(window.location.search);
    const espelharRespId = searchParams.get('espelhar_responsavel');
    const espelharAluno = searchParams.get('espelhar_aluno') === 'true';
    if (espelharRespId || espelharAluno) return; // Do not mark as read in mirror mode

    const unreadIds = frequenciasDb
      .filter((item: any) => {
        const leituras = item.leituras || item.dados?.leituras || {};
        return !leituras[currentReaderId];
      })
      .map((item: any) => item.id);
      
    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'frequencia', ids: unreadIds, alunoId: resolvedParams.slug })
      }).then(res => {
        if (res.ok) window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
      }).catch(console.error);
    }
  }, [frequenciasDb, resolvedParams.slug]);

  const entradaCatracaMap = useMemo(() => {
    const map: Record<string, { hora: string; dispositivo?: string; todasEntradas: Array<{ hora: string; dispositivo?: string }> }> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map
    
    // Filtra apenas eventos com status de sucesso/liberado (case-insensitive)
    const validEvents = eventosPortaria.filter(e => {
      if (!e || !e.data_hora) return false
      if (!e.status) return true
      const s = String(e.status).toLowerCase().trim()
      const isOk = s === 'sucesso' || s === 'liberado' || s === 'autorizado' || s === 'ok' || s === 'permitido' || s === 'entrada'
      const sentido = String(e.sentido || e.tipo || '').toLowerCase()
      return isOk && sentido !== 'saida'
    })
    const sorted = [...validEvents].sort((a, b) => (a.data_hora || '').localeCompare(b.data_hora || ''))

    sorted.forEach(e => {
      if (!e.data_hora) return
      let datePart = ''
      let timePart = ''

      // Extração direta de string para evitar alterações de fuso horário local
      if (e.data_hora.includes('T') || e.data_hora.includes(' ')) {
        const parts = e.data_hora.split(/[T ]/)
        datePart = parts[0]
        timePart = parts[1]?.slice(0, 5) || ''
      } else {
        datePart = e.data_hora.slice(0, 10)
        timePart = e.data_hora.slice(11, 16)
      }

      if (datePart) {
        const item = { hora: timePart, dispositivo: e.dispositivo_nome || 'Portaria iDFace' }
        if (!map[datePart]) {
          map[datePart] = {
            hora: timePart,
            dispositivo: e.dispositivo_nome || 'Portaria iDFace',
            todasEntradas: [item]
          }
        } else {
          const lastEnt = map[datePart].todasEntradas[map[datePart].todasEntradas.length - 1]
          if (lastEnt?.hora !== timePart) {
            map[datePart].todasEntradas.push(item)
          }
        }
      }
    })
    return map
  }, [eventosPortaria])

  const historicoReal = useMemo(() => {
    const list: Array<{ 
      data: string; 
      dateObj: Date; 
      status: 'P' | 'F' | 'J' | 'A'; 
      horaRegistro?: string; 
      registradoPor?: string;
      horaCatraca?: string;
      todasEntradas?: Array<{ hora: string; dispositivo?: string }>;
      ultimaEntrada?: string;
    }> = []
    
    const datesProcessed = new Set<string>()

    ;(frequenciasDb || []).forEach(f => {
      let status: 'P' | 'F' | 'J' | 'A' = 'P'
      
      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        status = 'J'
      } else if (!f.presente) {
        status = 'F'
      }

      const d = new Date(f.data + 'T12:00:00Z')
      datesProcessed.add(f.data)

      const catracaInfo = entradaCatracaMap[f.data]
      const dbEntradas = Array.isArray(f.dados?.entradas) ? f.dados.entradas : []
      const todasEntradas = dbEntradas.length > 0 ? dbEntradas : (catracaInfo?.todasEntradas || [])

      list.push({
        data: f.data,
        dateObj: d,
        status,
        horaRegistro: f.horaRegistro || f.dados?.horaRegistro,
        registradoPor: f.registradoPor || f.dados?.registradoPor,
        horaCatraca: catracaInfo?.hora,
        todasEntradas: todasEntradas.length > 0 ? todasEntradas : undefined,
        ultimaEntrada: f.dados?.ultimaEntrada
      })
    })

    // Caso o aluno tenha passado na catraca mas não haja registro no banco de frequências diárias,
    // inclui a presença confirmada automaticamente a partir da catraca iDFace
    Object.keys(entradaCatracaMap).forEach(dateStr => {
      if (!datesProcessed.has(dateStr)) {
        const catracaInfo = entradaCatracaMap[dateStr]
        const d = new Date(dateStr + 'T12:00:00Z')
        list.push({
          data: dateStr,
          dateObj: d,
          status: 'P',
          horaRegistro: catracaInfo.hora,
          registradoPor: 'Catraca iDFace',
          horaCatraca: catracaInfo.hora,
          todasEntradas: catracaInfo.todasEntradas
        })
      }
    })
    
    return list.sort((a, b) => b.data.localeCompare(a.data))
  }, [frequenciasDb, entradaCatracaMap])

  // Indexa registros e saídas confirmadas por YYYY-MM-DD para lookup O(1) nas células do calendário
  const historicoByDate = useMemo(() => {
    const map = new Map<string, typeof historicoReal>()
    for (const h of historicoReal) {
      const arr = map.get(h.data)
      if (arr) arr.push(h)
      else map.set(h.data, [h])
    }
    return map
  }, [historicoReal])

  const saidaCallsByDate = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const c of saidaCalls) {
      if (c?.status?.toLowerCase() !== 'confirmed') continue
      const rawDate = c.confirmedAt || c.calledAt
      if (!rawDate) continue
      const parsed = parseCallDateSafe(rawDate)
      if (!parsed) continue
      const dayKey = SAIDA_DAY_FORMATTER.format(parsed)
      const confirmedParsed = c.confirmedAt ? parseCallDateSafe(c.confirmedAt) : null
      const formattedTime = confirmedParsed ? SAIDA_TIME_FORMATTER.format(confirmedParsed) : ''
      const enriched = { ...c, _confirmedTimeFormatted: formattedTime }
      const arr = map.get(dayKey)
      if (arr) arr.push(enriched)
      else map.set(dayKey, [enriched])
    }
    map.forEach((list) => {
      list.sort((a, b) => (a.confirmedAt || a.calledAt || '').localeCompare(b.confirmedAt || b.calledAt || ''))
    })
    return map
  }, [saidaCalls])

  // Aggregate stats em passagem única O(N)
  const { totalAulas, totalPresencas, totalFaltasInjustificadas, totalAusenciasJustificadas } = useMemo(() => {
    let presencas = 0
    let faltas = 0
    let justificadas = 0
    for (const h of historicoReal) {
      if (h.status === 'P') presencas++
      else if (h.status === 'J') justificadas++
      else if (h.status === 'F' || h.status === 'A') faltas++
    }
    return {
      totalAulas: historicoReal.length,
      totalPresencas: presencas,
      totalFaltasInjustificadas: faltas,
      totalAusenciasJustificadas: justificadas
    }
  }, [historicoReal])

  const presencaPorcentagem = totalAulas > 0
    ? Math.round((totalPresencas / totalAulas) * 100)
    : (aluno?.frequencia || 100)

  // Date handlers
  const prevMonth = React.useCallback(() => setCurrentMonth(m => subMonths(m, 1)), [])
  const nextMonth = React.useCallback(() => setCurrentMonth(m => addMonths(m, 1)), [])
  const onDateClick = React.useCallback((day: Date) => setSelectedDate(day), [])

  // Pre-build grid metadata once per calendarDays/data change
  const calendarCells = useMemo(() => {
    return calendarDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      return {
        day,
        dateStr,
        dayNumber: format(day, 'd'),
        isCurrMonth: isSameMonth(day, monthStart),
        dayRecords: historicoByDate.get(dateStr) || [],
        daySaidas: saidaCallsByDate.get(dateStr) || []
      }
    })
  }, [calendarDays, monthStart, historicoByDate, saidaCallsByDate])

  // Find records for selected date in O(1)
  const selectedDateStr = useMemo(
    () => (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''),
    [selectedDate]
  )

  const selectedRecords = useMemo(() => {
    if (!selectedDateStr) return []
    return historicoByDate.get(selectedDateStr) || []
  }, [selectedDateStr, historicoByDate])

  const selectedSaidaCalls = useMemo(() => {
    if (!selectedDateStr) return []
    return saidaCallsByDate.get(selectedDateStr) || []
  }, [selectedDateStr, saidaCallsByDate])

  if (isRestricted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard
          title="Acesso Restrito"
          description="A visualização de histórico de frequência está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica. Para mais informações, entre em contato com a secretaria."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  if (isLoadingFrequencias) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#2563eb' }} />
        <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>Buscando frequências do aluno...</span>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 100, fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        .ad-freq-calendar-card {
          padding: 26px 28px;
        }
        @media (max-width: 768px) {
          .ad-freq-header-bar {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .ad-freq-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-freq-calendar-card {
            padding: 16px 14px !important;
            border-radius: 20px !important;
            margin-bottom: 20px !important;
          }
          .ad-freq-cal-header-row {
            margin-bottom: 18px !important;
          }
          .ad-freq-month-title {
            font-size: 17px !important;
          }
          .ad-freq-btn-hoje {
            height: 32px !important;
            padding: 0 10px !important;
            font-size: 11.5px !important;
          }
          .ad-freq-nav-btn {
            width: 32px !important;
            height: 32px !important;
          }
          .ad-freq-cal-grid {
            gap: 4px !important;
          }
          .ad-freq-cal-cell {
            height: 52px !important;
            min-height: 50px !important;
            border-radius: 14px !important;
          }
          .ad-freq-info-card {
            padding: 16px 16px !important;
            border-radius: 18px !important;
            gap: 14px !important;
            align-items: flex-start !important;
            margin-bottom: 16px !important;
          }
          .ad-freq-notice-icon {
            width: 42px !important;
            height: 42px !important;
            border-radius: 13px !important;
            margin-top: 2px !important;
          }
          .ad-freq-notice-text {
            font-size: 12.5px !important;
            line-height: 1.55 !important;
          }
        }
      `}} />

      {/* ─── CARD AVISO ULTRA MODERNO ANTES DO CALENDÁRIO ─── */}
      <div
        className="ad-freq-info-card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 22,
          padding: '22px 26px',
          marginBottom: 24,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 80%, #1d4ed8 100%)',
          boxShadow: '0 14px 28px -10px rgba(30, 27, 75, 0.28), 0 4px 12px rgba(15, 23, 42, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          boxSizing: 'border-box',
          width: '100%',
          animation: 'adFadeIn 0.25s ease'
        }}
      >
        {/* Barra superior luminosa neon */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #f59e0b 0%, #ec4899 35%, #6366f1 70%, #38bdf8 100%)',
            boxShadow: '0 0 16px rgba(245, 158, 11, 0.55)'
          }}
        />

        {/* Brilhos ambientais decorativos */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -50,
            left: -30,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -60,
            right: -20,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Ícone em destaque com halo luminoso */}
        <div
          className="ad-freq-notice-icon"
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            boxShadow: '0 10px 24px -4px rgba(245, 158, 11, 0.55), 0 0 0 4px rgba(245, 158, 11, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1
          }}
        >
          <AlertTriangle size={25} color="#ffffff" strokeWidth={2.4} />
        </div>

        {/* Conteúdo textual */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 11px',
                borderRadius: 999,
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                color: '#fde68a',
                fontSize: 10.5,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#fbbf24',
                  boxShadow: '0 0 8px #fbbf24'
                }} />
                Aviso Importante
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(56, 189, 248, 0.14)',
                border: '1px solid rgba(56, 189, 248, 0.32)',
                color: '#7dd3fc',
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.03em'
              }}>
                <ShieldCheck size={12} strokeWidth={2.5} />
                Controle Oficial em Sala
              </span>
            </div>
          </div>

          <p
            className="ad-freq-notice-text"
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.94)',
              fontWeight: 500,
              letterSpacing: '0.005em'
            }}
          >
            A frequência exibida neste aplicativo <strong style={{ color: '#fde68a', fontWeight: 800 }}>é informativa e pode apresentar divergências</strong>, pois, eventualmente, os equipamentos podem não identificar a entrada do aluno. A chamada é realizada <strong style={{ color: '#ffffff', fontWeight: 800 }}>manualmente em sala de aula</strong> e registrada diretamente em nosso <strong style={{ color: '#7dd3fc', fontWeight: 800 }}>sistema pedagógico</strong>, onde é feito o controle oficial de frequência.
          </p>
        </div>
      </div>

      {/* Calendário Dinâmico Interativo */}
      <div
        className="ad-freq-calendar-card"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%)',
          borderRadius: 22,
          border: '1.5px solid rgba(226, 232, 240, 0.85)',
          boxShadow: '0 10px 24px -6px rgba(15, 23, 42, 0.06), 0 4px 10px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden',
          marginBottom: 24,
          position: 'relative',
          animation: 'adFadeIn 0.25s ease'
        }}
      >
        
        <div className="ad-freq-cal-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 8 }}>
          {/* Mês e Ano - Nunca quebra linha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <h3 
              className="ad-freq-month-title"
              style={{ 
                fontSize: 20, 
                fontWeight: 900, 
                margin: 0, 
                color: '#0f172a', 
                textTransform: 'capitalize', 
                letterSpacing: '-0.02em',
                fontFamily: 'Outfit, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentMonthLabel} <span style={{ color: '#4f46e5', fontWeight: 800 }}>{currentYearLabel}</span>
            </h3>
          </div>

          {/* Controles de Navegação (Hoje + Prev + Next) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button 
              onClick={() => setCurrentMonth(new Date())} 
              className="ad-freq-btn-hoje"
              style={{ 
                height: 34,
                padding: '0 12px', 
                borderRadius: 10, 
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', 
                color: '#6d28d9', 
                border: '1px solid #ddd6fe',
                fontWeight: 800, 
                fontSize: 12.5, 
                cursor: 'pointer', 
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(109, 40, 217, 0.08)'
              }}
              title="Ir para o mês atual"
            >
              Hoje
            </button>
            <button 
              onClick={prevMonth} 
              className="ad-freq-nav-btn"
              style={{ 
                width: 34, 
                height: 34, 
                borderRadius: 10, 
                border: '1.5px solid #e2e8f0', 
                background: '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                color: '#1e293b', 
                transition: 'all 0.2s', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                boxSizing: 'border-box'
              }}
              title="Mês anterior"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <button 
              onClick={nextMonth} 
              className="ad-freq-nav-btn"
              style={{ 
                width: 34, 
                height: 34, 
                borderRadius: 10, 
                border: '1.5px solid #e2e8f0', 
                background: '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                color: '#1e293b', 
                transition: 'all 0.2s', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                boxSizing: 'border-box'
              }}
              title="Próximo mês"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Calendar Header (Days of week) */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 16 }}>
          {WEEK_DAYS_SHORT.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {calendarCells.map(({ day, dateStr, dayNumber, isCurrMonth, dayRecords, daySaidas }) => {
            const hasPresenca = dayRecords.some(r => r.status === 'P')
            const hasJustificada = dayRecords.some(r => r.status === 'J')
            const hasFalta = dayRecords.some(r => r.status === 'F' || r.status === 'A')
            const hasSaida = daySaidas.length > 0

            let bgLight = '#fff'
            let bgDot = 'transparent'
            let textColor = isCurrMonth ? '#0f172a' : '#cbd5e1'
            let border = '1px solid #f8fafc'

            if (isCurrMonth && (dayRecords.length > 0 || hasSaida)) {
              if (hasFalta && !hasPresenca) {
                bgLight = '#fef2f2'
                bgDot = '#ef4444'
                textColor = '#991b1b'
                border = '1px solid #fecaca'
              } else if (hasJustificada && !hasPresenca) {
                bgLight = '#fef3c7'
                bgDot = '#f59e0b'
                textColor = '#b45309'
                border = '1px solid #fde68a'
              } else if (hasPresenca) {
                bgLight = '#f0fdf4'
                bgDot = '#16a34a'
                textColor = '#166534'
                border = '1px solid #dcfce7'
              } else if (hasSaida) {
                bgLight = '#fdf4ff'
                bgDot = '#c026d3'
                textColor = '#86198f'
                border = '1px solid #fce7f3'
              }
            }

            const isSelected = selectedDateStr === dateStr

            if (isSelected) {
              bgLight = '#4f46e5'
              textColor = '#fff'
              bgDot = '#fff'
              border = '1px solid #4f46e5'
            }

            return (
              <div
                key={dateStr}
                onClick={() => onDateClick(day)}
                className="ad-freq-cal-cell"
                style={{
                  height: 70, borderRadius: 20, border, background: bgLight, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  opacity: 1, position: 'relative',
                  transition: 'transform 0.15s ease, background-color 0.15s ease',
                  boxShadow: isSelected ? '0 8px 18px -6px rgba(79,70,229,0.35)' : 'none'
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: textColor }}>
                  {dayNumber}
                </span>

                {bgDot !== 'transparent' && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: bgDot, marginTop: 6 }} />
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: '#f0fdf4', border: '1px solid #dcfce7' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Presenças</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Faltas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: '#fdf4ff', border: '1px solid #fce7f3' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Saídas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, border: '2px solid #4f46e5', background: '#fff' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Dia selecionado</span>
          </div>
        </div>
      </div>

      {/* ── MODAL ULTRA MODERNO CENTRALIZADO VIA PORTAL NO DOCUMENT.BODY ───────────────────────── */}
      {mounted && selectedDate && createPortal(
        <div
          onClick={() => setSelectedDate(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.78)',
            zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            boxSizing: 'border-box',
            animation: 'adFadeIn 0.15s ease'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 28,
              boxShadow: '0 20px 44px -15px rgba(0, 0, 0, 0.3)',
              width: '100%', maxWidth: 520,
              maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              animation: 'adModalSlideUp 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
                {/* Header */}
                <div style={{
                  padding: '24px 28px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 14,
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 8px 16px rgba(79, 70, 229, 0.25)'
                    }}>
                      <CalendarIcon size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                        {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </h3>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        Registro de Frequência do Aluno
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#e2e8f0', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#64748b', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#cbd5e1'; e.currentTarget.style.color = '#0f172a' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '20px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {selectedRecords.length === 0 && selectedSaidaCalls.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <Activity size={44} color="#cbd5e1" style={{ margin: '0 auto 14px' }} />
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#475569' }}>Nenhum lançamento neste dia</div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                        {isFuture(selectedDate) ? 'Data futura ou feriado.' : 'Não há registros de presença, falta ou saída cadastrados.'}
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedRecords.map((h, i) => {
                        const isPresenca = h.status === 'P'
                        const isFaltaJustificada = h.status === 'J'
                        
                        const catracaInfo = entradaCatracaMap[h.data]
                        const entradaTime = h.horaRegistro || h.horaCatraca || catracaInfo?.hora
                        const isIdFace = !!entradaTime || (h.registradoPor && (h.registradoPor.toLowerCase().includes('idface') || h.registradoPor.toLowerCase().includes('catraca')))
                        
                        return (
                          <div 
                            key={i} 
                            style={{ 
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 20,
                              padding: '16px 18px',
                              display: 'flex', flexDirection: 'column',
                              gap: 12,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                 <div style={{ 
                                   background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#eff6ff' : '#fef2f2', 
                                   color: isPresenca ? '#16a34a' : isFaltaJustificada ? '#3b82f6' : '#ef4444', 
                                   width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   flexShrink: 0
                                 }}>
                                   {isPresenca ? <CheckCircle2 size={22} strokeWidth={3} /> : isFaltaJustificada ? <FileText size={22} strokeWidth={3} /> : <AlertTriangle size={22} strokeWidth={3} />}
                                 </div>
                                 <div style={{ fontWeight: 900, fontSize: 15, color: '#0f172a' }}>
                                   {isPresenca ? 'Presença Confirmada' : isFaltaJustificada ? 'Ausência Justificada' : 'Falta Registrada'}
                                 </div>
                              </div>

                              <div style={{
                                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5,
                                background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2',
                                color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b',
                                flexShrink: 0
                              }}>
                                {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Injustificada'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 52, flexWrap: 'wrap' }}>                               
                              {h.todasEntradas && h.todasEntradas.length > 1 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {h.todasEntradas.map((ent: any, idx: number) => (
                                    <span key={idx} style={{ 
                                      display: 'inline-flex', alignItems: 'center', gap: 5, 
                                      fontSize: 12, fontWeight: 800, color: '#0284c7', 
                                      background: '#e0f2fe', padding: '4px 12px', borderRadius: 20
                                    }}>
                                      <Clock size={14} strokeWidth={2.5} />
                                      {idx === 0 ? '1ª Entrada' : `${idx + 1}ª Entrada`}: {ent.hora?.slice(0, 5)}h
                                    </span>
                                  ))}
                                </div>
                              ) : isIdFace && entradaTime ? (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 5, 
                                  fontSize: 12, fontWeight: 800, color: '#0284c7', 
                                  background: '#e0f2fe', padding: '4px 12px', borderRadius: 20
                                }}>
                                  <Clock size={14} strokeWidth={2.5} /> ID Face: {entradaTime.slice(0,5)}h
                                </span>
                              ) : (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 5, 
                                  fontSize: 12, fontWeight: 800, color: '#64748b', 
                                  background: '#e2e8f0', padding: '4px 12px', borderRadius: 20
                                }}>
                                  <Clock size={14} strokeWidth={2.5} /> Lançamento Manual
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {/* Saída Confirmada Cards */}
                      {selectedSaidaCalls.map((call, i) => {
                        const confirmedTime = call._confirmedTimeFormatted || ''

                        return (
                          <div 
                            key={`saida-${i}`} 
                            style={{ 
                              background: '#fdf4ff',
                              border: '1px solid #fce7f3',
                              borderRadius: 20,
                              padding: '16px 18px',
                              display: 'flex', flexDirection: 'column',
                              gap: 12,
                              boxShadow: '0 4px 12px rgba(192, 38, 211, 0.05)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                 <div style={{ 
                                   background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)', 
                                   color: '#fff', 
                                   width: 40, height: 40, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   boxShadow: '0 6px 16px rgba(217, 70, 239, 0.3)',
                                   flexShrink: 0
                                 }}>
                                   <LogOut size={20} strokeWidth={2.5} />
                                 </div>
                                 <div style={{ fontWeight: 900, fontSize: 15, color: '#0f172a' }}>
                                   {selectedSaidaCalls.length > 1 ? `${i + 1}ª Saída Confirmada` : 'Saída Confirmada'}
                                 </div>
                              </div>

                              <div style={{
                                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5,
                                background: '#fbcfe8',
                                color: '#9d174d',
                                flexShrink: 0
                              }}>
                                Liberado
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 52 }}>                               
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: 5, 
                                fontSize: 12, fontWeight: 800, color: '#c026d3', 
                                background: '#fff', padding: '4px 12px', borderRadius: 20
                              }}>
                                <Clock size={14} strokeWidth={2.5} /> {confirmedTime}
                              </span>
                              {call.guardianName && (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 5, 
                                  fontSize: 12, fontWeight: 800, color: '#64748b', 
                                  background: '#fff', padding: '4px 12px', borderRadius: 20 
                                }}>
                                  Por: {call.guardianName}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding: '16px 28px',
                  borderTop: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex', justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    style={{
                      padding: '10px 24px', borderRadius: 12,
                      background: '#0f172a', border: 'none',
                      color: '#fff', fontWeight: 800, fontSize: 13,
                      cursor: 'pointer', transition: 'background-color 0.2s',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#0f172a' }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>,
        document.body
      )}


    </div>
  )
}
