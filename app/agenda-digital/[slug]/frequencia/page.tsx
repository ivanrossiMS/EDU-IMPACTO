'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useMemo, use } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Clock, ShieldCheck, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Loader2, GraduationCap, Info, LogOut, Lock, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { supabase } from '@/lib/supabase'

import { useParams, useSearchParams } from 'next/navigation'

export default function ADFrequenciaPage({ params }: { params: any }) {
  const { adConfig } = useAgendaDigital()
  
  if (adConfig?.permissoes?.visualizarFrequencia === false) {
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

  const { aluno } = useSelectedStudent()
  const { currentUser } = useApp()
  const resolvedParams = useParams() as { slug: string }
  const queryClient = useQueryClient()

  useAgendaRealtime({
    table: 'frequencias',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Nova frequência registrada!`,
      updateMessage: (doc) => `Registro de frequência atualizado!`,
      icon: <CheckCircle2 size={18} color="#16a34a" />
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-aluno'] })
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-aluno'] })
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['frequencias-aluno'] })
    }
  });
  // Escuta em tempo real o Supabase para a tabela saida_calls (independente do dispositivo)
  React.useEffect(() => {
    const channel = supabase.channel('saida_calls_agenda_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saida_calls' },
        (payload: any) => {
          // Invalida a query do React Query para forçar recarregamento na página do aluno
          queryClient.invalidateQueries({ queryKey: ['saida-calls-aluno'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // State for interactive calendar
  const [currentMonth, setCurrentMonth] = useState(new Date())
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

  // Fetch real student attendance logs from database based on turma and alunoId
  const { data: frequenciasDb = [], isLoading: isLoadingFrequencias } = useApiQuery<any[]>(
    ['frequencias-aluno', resolvedParams.slug, aluno?.turma],
    '/api/academico/frequencias',
    { aluno_id: resolvedParams.slug, turma_id: aluno?.turma || '' },
    { enabled: !!resolvedParams.slug && !!aluno?.turma }
  )

  // Fallback para eventos de portaria
  const { data: eventosPortariaRaw } = useApiQuery<any>(
    ['portaria-eventos-aluno', resolvedParams.slug, aluno?.id, aluno?.matricula],
    '/api/portaria/eventos',
    { aluno_id: aluno?.id || resolvedParams.slug, matricula: aluno?.matricula || resolvedParams.slug },
    { enabled: !!resolvedParams.slug }
  )

  const eventosPortaria = useMemo(() => {
    if (!eventosPortariaRaw) return []
    if (Array.isArray(eventosPortariaRaw)) return eventosPortariaRaw
    if (Array.isArray(eventosPortariaRaw.data)) return eventosPortariaRaw.data
    return []
  }, [eventosPortariaRaw])

  // Histórico de saídas confirmadas (painel chamadas)
  const { data: saidaCalls = [] } = useApiQuery<any[]>(
    ['saida-calls-aluno', resolvedParams.slug],
    '/api/saida/calls',
    { studentId: resolvedParams.slug, from: '2020-01-01', to: '2030-12-31' },
    { enabled: !!resolvedParams.slug }
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
    const map: Record<string, { hora: string; dispositivo?: string }> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map
    
    // Filtra apenas eventos com status de sucesso/liberado (case-insensitive)
    const validEvents = eventosPortaria.filter(e => {
      if (!e || !e.data_hora) return false
      if (!e.status) return true
      const s = String(e.status).toLowerCase().trim()
      return s === 'sucesso' || s === 'liberado' || s === 'autorizado' || s === 'ok' || s === 'permitido' || s === 'entrada'
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

      if (datePart && !map[datePart]) {
        map[datePart] = {
          hora: timePart,
          dispositivo: e.dispositivo_nome || 'Portaria iDFace'
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

      list.push({
        data: f.data,
        dateObj: d,
        status,
        horaRegistro: f.horaRegistro || f.dados?.horaRegistro,
        registradoPor: f.registradoPor || f.dados?.registradoPor,
        horaCatraca: catracaInfo?.hora
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
          horaCatraca: catracaInfo.hora
        })
      }
    })
    
    return list.sort((a, b) => b.data.localeCompare(a.data))
  }, [frequenciasDb, entradaCatracaMap])

  // Aggregate stats
  const totalAulas = historicoReal.length
  const totalPresencas = historicoReal.filter(h => h.status === 'P').length
  const totalFaltasInjustificadas = historicoReal.filter(h => h.status === 'F' || h.status === 'A').length
  const totalAusenciasJustificadas = historicoReal.filter(h => h.status === 'J').length
  
  const presencaPorcentagem = totalAulas > 0 
    ? Math.round((totalPresencas / totalAulas) * 100) 
    : (aluno?.frequencia || 100)

  // Date handlers
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const onDateClick = (day: Date) => setSelectedDate(day)

  // Generate calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const dateFormat = "d"
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  // Find records for selected date
  const selectedRecords = useMemo(() => {
    if (!selectedDate) return []
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
    return historicoReal.filter(h => h.data === selectedDateStr)
  }, [selectedDate, historicoReal])

  const selectedSaidaCalls = useMemo(() => {
    if (!selectedDate) return []
    return saidaCalls.filter(c => {
      if (c.status?.toLowerCase() !== 'confirmed') return false
      // Usa confirmedAt se existir, se não usa calledAt
      const dateStr = c.confirmedAt || c.calledAt
      if (!dateStr) return false
      try {
        return isSameDay(new Date(dateStr), selectedDate)
      } catch (e) {
        return false
      }
    })
  }, [selectedDate, saidaCalls])

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
        @media (max-width: 768px) {
          .ad-freq-header-bar {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .ad-freq-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-freq-cal-grid {
            gap: 4px !important;
          }
          .ad-freq-cal-cell {
            min-height: 50px !important;
          }
          .ad-banner-global {
            flex-direction: column !important;
            padding: 32px 24px !important;
          }
          .ad-banner-global > div:first-child {
            max-width: 100% !important;
            margin-bottom: 24px !important;
          }
          .ad-banner-catraca {
            position: relative !important;
            right: auto !important;
            bottom: -32px !important;
            margin: 0 auto !important;
            display: flex !important;
            justify-content: center !important;
          }
        }
      `}} />


      {/* Calendário Dinâmico Interativo */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.05)', overflow: 'hidden', padding: '32px', marginBottom: 32 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#0f172a', textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => setCurrentMonth(new Date())} style={{ padding: '10px 20px', borderRadius: 16, background: '#f3e8ff', color: '#6d28d9', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              Hoje
            </button>
            <button onClick={prevMonth} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button onClick={nextMonth} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Calendar Header (Days of week) */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 16 }}>
          {weekDays.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {calendarDays.map((day, idx) => {
            const isCurrMonth = isSameMonth(day, monthStart)
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayRecords = historicoReal.filter(h => h.data === dateStr)
            const daySaidas = saidaCalls.filter(c => {
              if (c.status?.toLowerCase() !== 'confirmed') return false
              const d = c.confirmedAt || c.calledAt
              if (!d) return false
              try { return isSameDay(new Date(d), day) } catch (e) { return false }
            })

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
                // Vermelho para Faltas
                bgLight = '#fef2f2'
                bgDot = '#ef4444'
                textColor = '#991b1b'
                border = '1px solid #fecaca'
              } else if (hasJustificada && !hasPresenca) {
                // Amarelo/Laranja para Justificadas
                bgLight = '#fef3c7'
                bgDot = '#f59e0b'
                textColor = '#b45309'
                border = '1px solid #fde68a'
              } else if (hasPresenca) {
                // Verde para Presenças
                bgLight = '#f0fdf4'
                bgDot = '#16a34a'
                textColor = '#166534'
                border = '1px solid #dcfce7'
              } else if (hasSaida) {
                // Roxo para Saídas
                bgLight = '#fdf4ff'
                bgDot = '#c026d3'
                textColor = '#86198f'
                border = '1px solid #fce7f3'
              }
            }

            const isSelected = selectedDate && isSameDay(day, selectedDate)

            if (isSelected) {
              bgLight = '#4f46e5'
              textColor = '#fff'
              bgDot = '#fff'
              border = '1px solid #4f46e5'
            }

            return (
              <motion.div 
                key={day.toString()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDateClick(day)}
                className="ad-freq-cal-cell"
                style={{
                  height: 70, borderRadius: 20, border, background: bgLight, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  opacity: 1, position: 'relative', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 12px 24px -6px rgba(79,70,229,0.4)' : 'none'
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: textColor }}>
                  {format(day, dateFormat)}
                </span>
                
                {bgDot !== 'transparent' && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: bgDot, marginTop: 6 }} />
                )}
              </motion.div>
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
      </motion.div>

      {/* Header / Banner Premium Moved to Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="ad-banner-global"
        style={{
          background: 'linear-gradient(90deg, #4f46e5 0%, #6d28d9 100%)',
          borderRadius: 24,
          padding: '32px 40px',
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 15px 35px rgba(79, 70, 229, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', zIndex: 1 }}>
          <div style={{ border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
            <Info size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>
              Como a frequência é registrada?
            </h4>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, fontWeight: 500 }}>
              A entrada do aluno é computada automaticamente através da catraca de acesso. A saída é registrada no momento em que você chama o aluno pelo painel.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── MODAL ULTRA MODERNO CENTRALIZADO VIA PORTAL NO DOCUMENT.BODY ───────────────────────── */}
      {mounted && selectedDate && createPortal(
        <AnimatePresence>
          {selectedDate && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                width: '100vw', height: '100vh',
                background: 'rgba(15, 23, 42, 0.65)', 
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 999999, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
                boxSizing: 'border-box'
              }}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                onClick={e => e.stopPropagation()}
                style={{ 
                  background: '#fff', 
                  borderRadius: 28, 
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 30px rgba(79, 70, 229, 0.1)', 
                  width: '100%', maxWidth: 520,
                  maxHeight: '85vh',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                  border: '1px solid rgba(226, 232, 240, 0.8)'
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 52 }}>                               
                              {isIdFace && entradaTime ? (
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
                        const confirmedTime = call.confirmedAt 
                          ? new Date(call.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                          : ''

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
                                   Saída Confirmada
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
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#0f172a' }}
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}


    </div>
  )
}
