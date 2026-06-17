'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useMemo, use } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Clock, ShieldCheck, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Loader2, GraduationCap, Info, LogOut, Lock } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { supabase } from '@/lib/supabase'

import { useParams } from 'next/navigation'

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
  const { data: eventosPortaria = [] } = useApiQuery<any[]>(
    ['portaria-eventos-aluno', resolvedParams.slug],
    '/api/portaria/eventos',
    { aluno_id: resolvedParams.slug },
    { enabled: !!resolvedParams.slug }
  )

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
    const currentReaderId = isFamily ? resolvedParams.slug : currentUser?.id;
    if (!currentReaderId) return;

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
    const map: Record<string, string> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map
    const sorted = [...eventosPortaria].sort((a, b) => (a.data_hora || '').localeCompare(b.data_hora || ''))
    sorted.forEach(e => {
      if (!e.data_hora) return
      const datePart = e.data_hora.slice(0, 10)
      if (!map[datePart]) {
        try {
          const dateObj = new Date(e.data_hora)
          map[datePart] = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } catch {
          map[datePart] = e.data_hora.slice(11, 16)
        }
      }
    })
    return map
  }, [eventosPortaria])

  const historicoReal = useMemo(() => {
    const list: Array<{ data: string; dateObj: Date; status: 'P' | 'F' | 'J' | 'A'; horaRegistro?: string; registradoPor?: string }> = []
    
    ;(frequenciasDb || []).forEach(f => {
      let status: 'P' | 'F' | 'J' | 'A' = 'P'
      
      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        status = 'J'
      } else if (!f.presente) {
        status = 'F'
      }

      // Add UTC time hack so dates don't shift timezone locally
      const d = new Date(f.data + 'T12:00:00Z')

      list.push({
        data: f.data,
        dateObj: d,
        status,
        horaRegistro: f.horaRegistro || f.dados?.horaRegistro,
        registradoPor: f.registradoPor || f.dados?.registradoPor
      })
    })
    
    return list.sort((a, b) => b.data.localeCompare(a.data))
  }, [frequenciasDb])

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
      if (c.status !== 'confirmed') return false
      // Usa confirmedAt se existir, se não usa calledAt
      const dateStr = c.confirmedAt || c.calledAt
      if (!dateStr) return false
      try {
        return isSameDay(parseISO(dateStr), selectedDate)
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
        }
      `}} />

      {/* Header / Banner Premium */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', zIndex: 1, maxWidth: '70%' }}>
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

        {/* Catraca Illustration Overlay */}
        <div style={{ position: 'absolute', right: -10, bottom: -20, opacity: 0.95, zIndex: 0 }}>
          <div style={{ width: 140, height: 200, background: '#f8fafc', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'relative', boxShadow: '-10px 10px 40px rgba(0,0,0,0.3)', border: '4px solid #fff' }}>
            <div style={{ width: 64, height: 90, background: '#0f172a', position: 'absolute', top: 24, left: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.5)' }}>
               <div style={{ width: 36, height: 36, border: '2.5px solid #22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Lock size={16} color="#22c55e" strokeWidth={3} />
               </div>
            </div>
            <div style={{ width: 80, height: 16, background: '#e2e8f0', position: 'absolute', top: 140, left: 26, borderRadius: 8 }} />
            <div style={{ width: 60, height: 60, background: '#f1f5f9', position: 'absolute', top: 60, right: -40, borderRadius: '0 30px 30px 0', border: '4px solid #fff', borderLeft: 'none' }} />
          </div>
        </div>
      </motion.div>

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
            
            const hasPresenca = dayRecords.some(r => r.status === 'P')
            const hasJustificada = dayRecords.some(r => r.status === 'J')
            const hasFalta = dayRecords.some(r => r.status === 'F' || r.status === 'A')
            
            let bgLight = '#fff'
            let bgDot = 'transparent'
            let textColor = isCurrMonth ? '#0f172a' : '#cbd5e1'
            let border = '1px solid #f8fafc'

            if (isCurrMonth && dayRecords.length > 0) {
              if (hasPresenca || hasJustificada || hasFalta) {
                bgLight = '#f0fdf4'
                bgDot = '#16a34a'
                textColor = '#166534'
                border = '1px solid #dcfce7'
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

        <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: '#f0fdf4', border: '1px solid #dcfce7' }} />
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Dias com registros</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #e0e7ff', background: '#fff' }} />
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Dia selecionado</span>
          </div>
        </div>
      </motion.div>

      {/* Painel de Detalhes do Dia */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div 
            key={selectedDate.toString()}
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 32, padding: '32px 40px' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#0f172a', marginBottom: 40, letterSpacing: '-0.02em' }}>
                Lançamento: {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {selectedRecords.length === 0 && selectedSaidaCalls.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                    <Activity size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#64748b' }}>Nenhum lançamento neste dia</div>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                      {isFuture(selectedDate) ? 'Data futura ou feriado.' : 'Não há registros de presença, falta ou saída cadastrados.'}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Vertical Timeline Line */}
                    <div style={{ position: 'absolute', left: 24, top: 24, bottom: 24, width: 2, background: '#f1f5f9', zIndex: 0 }} />

                    {selectedRecords.map((h, i) => {
                    const isPresenca = h.status === 'P'
                    const isFaltaJustificada = h.status === 'J'
                    
                    const entradaTime = h.horaRegistro || entradaCatracaMap[h.data]
                    const isIdFace = (h.registradoPor && h.registradoPor.toLowerCase().includes('idface')) || entradaTime
                    
                    return (
                      <div 
                        key={i} 
                        className="ad-freq-hist-item" 
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          marginBottom: (i === selectedRecords.length - 1 && selectedSaidaCalls.length === 0) ? 0 : 40, 
                          position: 'relative', zIndex: 1 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                           <div style={{ 
                             background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#eff6ff' : '#fef2f2', 
                             color: isPresenca ? '#16a34a' : isFaltaJustificada ? '#3b82f6' : '#ef4444', 
                             width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                           }}>
                             {isPresenca ? <CheckCircle2 size={26} strokeWidth={3} /> : isFaltaJustificada ? <FileText size={26} strokeWidth={3} /> : <AlertTriangle size={26} strokeWidth={3} />}
                           </div>
                           <div>
                             <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a', marginBottom: 10 }}>
                               {isPresenca ? 'Presença Confirmada' : isFaltaJustificada ? 'Ausência Justificada' : 'Falta Registrada'}
                             </div>
                             <div style={{ display: 'flex', gap: 12 }}>                               
                               {isIdFace ? (
                                 <span style={{ 
                                   display: 'flex', alignItems: 'center', gap: 6, 
                                   fontSize: 13, fontWeight: 800, color: '#0284c7', 
                                   background: '#e0f2fe', padding: '6px 14px', borderRadius: 20
                                 }}>
                                   <Clock size={16} strokeWidth={2.5} /> ID Face: {entradaTime?.slice(0,5)}h
                                 </span>
                               ) : (
                                 <span style={{ 
                                   display: 'flex', alignItems: 'center', gap: 6, 
                                   fontSize: 13, fontWeight: 800, color: '#64748b', 
                                   background: '#f1f5f9', padding: '6px 14px', borderRadius: 20
                                 }}>
                                   <Clock size={16} strokeWidth={2.5} /> Lançamento Manual
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        <div className="ad-freq-hist-badge" style={{
                          padding: '10px 20px', borderRadius: 12, fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5,
                          background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2',
                          color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b'
                        }}>
                          {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Injustificada'}
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
                        className="ad-freq-hist-item" 
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          marginBottom: i === selectedSaidaCalls.length - 1 ? 0 : 40,
                          position: 'relative', zIndex: 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                           <div style={{ 
                             background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)', 
                             color: '#fff', 
                             width: 50, height: 50, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                             boxShadow: '0 8px 20px rgba(217, 70, 239, 0.3)'
                           }}>
                             <LogOut size={26} strokeWidth={2.5} />
                           </div>
                           <div>
                             <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a', marginBottom: 10 }}>
                               Saída Confirmada
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>                               
                               <span style={{ 
                                 display: 'flex', alignItems: 'center', gap: 6, 
                                 fontSize: 13, fontWeight: 800, color: '#c026d3', 
                                 background: '#fdf4ff', padding: '6px 14px', borderRadius: 20
                               }}>
                                 <Clock size={16} strokeWidth={2.5} /> {confirmedTime}
                               </span>
                               {call.guardianName && (
                                 <span style={{ 
                                   display: 'flex', alignItems: 'center', gap: 6, 
                                   fontSize: 13, fontWeight: 800, color: '#64748b', 
                                   background: '#f1f5f9', padding: '6px 14px', borderRadius: 20 
                                 }}>
                                   Por: {call.guardianName}
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        <div className="ad-freq-hist-badge" style={{
                          padding: '10px 20px', borderRadius: 12, fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5,
                          background: '#fdf4ff',
                          color: '#c026d3'
                        }}>
                          Liberado
                        </div>
                      </div>
                    )
                  })}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
