'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useMemo, use } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Clock, ShieldCheck, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ADFrequenciaPage({ params }: { params: Promise<{ slug: string }>}) {
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
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
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

      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
        className="ad-freq-header-bar"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}
      >
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-main))', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>
              <CalendarIcon size={22} />
            </div>
            Frequência
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Acompanhe o histórico completo de presenças no calendário escolar.
          </p>
        </div>
      </motion.div>


      {/* Calendário Dinâmico Interativo */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 15px 35px rgba(0,0,0,0.02)', overflow: 'hidden', padding: '24px 28px', marginBottom: 32 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#1e293b', textTransform: 'capitalize' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155', transition: 'all 0.2s' }}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155', transition: 'all 0.2s' }}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Calendar Header (Days of week) */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
          {weekDays.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#94a3b8', paddingBottom: 8, textTransform: 'uppercase' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {calendarDays.map((day, idx) => {
            const isCurrMonth = isSameMonth(day, monthStart)
            const isTodayDate = isToday(day)
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayRecords = historicoReal.filter(h => h.data === dateStr)
            
            // Determine primary status if there are records
            const hasPresenca = dayRecords.some(r => r.status === 'P')
            const hasJustificada = dayRecords.some(r => r.status === 'J')
            const hasFalta = dayRecords.some(r => r.status === 'F' || r.status === 'A')
            
            // Define colors
            let bgLight = '#fff'
            let bgDot = 'transparent'
            let textColor = isCurrMonth ? '#334155' : '#cbd5e1'
            let border = '1px solid #f1f5f9'
            let dotGlow = 'none'

            if (isCurrMonth && dayRecords.length > 0) {
              if (hasPresenca) {
                bgLight = '#f0fdf4'
                bgDot = '#22c55e'
                textColor = '#166534'
                border = '1px solid #bbf7d0'
                dotGlow = '0 0 10px rgba(34,197,94,0.4)'
              } else if (hasJustificada) {
                bgLight = '#eff6ff'
                bgDot = '#3b82f6'
                textColor = '#1e40af'
                border = '1px solid #bfdbfe'
                dotGlow = '0 0 10px rgba(59,130,246,0.4)'
              } else if (hasFalta) {
                bgLight = '#fef2f2'
                bgDot = '#ef4444'
                textColor = '#991b1b'
                border = '1px solid #fecaca'
                dotGlow = '0 0 10px rgba(239,68,68,0.4)'
              }
            }

            const isSelected = selectedDate && isSameDay(day, selectedDate)

            if (isSelected) {
              border = '2px solid #0ea5e9'
              bgLight = bgLight === '#fff' ? '#f8fafc' : bgLight
            }

            return (
              <motion.div 
                key={day.toString()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDateClick(day)}
                className="ad-freq-cal-cell"
                style={{
                  minHeight: 64, borderRadius: 16, border, background: bgLight, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  opacity: isCurrMonth ? 1 : 0.4, position: 'relative', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 10px 25px -5px rgba(14,165,233,0.3)' : 'none'
                }}
              >
                {isTodayDate && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }} />
                )}
                
                <span style={{ fontSize: 16, fontWeight: 800, color: textColor }}>
                  {format(day, dateFormat)}
                </span>
                
                {bgDot !== 'transparent' && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: bgDot, marginTop: 4, boxShadow: dotGlow }} />
                )}
              </motion.div>
            )
          })}
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
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 32 }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                  Lançamento: {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedRecords.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                    <Activity size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>Nenhum lançamento neste dia</div>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                      {isFuture(selectedDate) ? 'Data futura ou feriado.' : 'Não há registros de presença ou falta cadastrados.'}
                    </div>
                  </div>
                ) : (
                  selectedRecords.map((h, i) => {
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
                          padding: '24px 28px', borderBottom: i < selectedRecords.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                           <div style={{ 
                             background: isPresenca ? '#f0fdf4' : isFaltaJustificada ? '#eff6ff' : '#fef2f2', 
                             color: isPresenca ? '#16a34a' : isFaltaJustificada ? '#3b82f6' : '#ef4444', 
                             padding: 16, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
                           }}>
                             {isPresenca ? <CheckCircle2 size={32} /> : isFaltaJustificada ? <FileText size={32} /> : <AlertTriangle size={32} />}
                           </div>
                           <div>
                             <div style={{ fontWeight: 900, fontSize: 18, color: '#1e293b' }}>
                               {isPresenca ? 'Presença Confirmada' : isFaltaJustificada ? 'Ausência Justificada' : 'Falta Registrada'}
                             </div>
                             <div style={{ fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, fontWeight: 500 }}>                               
                               {isIdFace ? (
                                 <span style={{ 
                                   display: 'inline-flex', alignItems: 'center', gap: 6, 
                                   fontSize: 12, fontWeight: 800, color: '#0ea5e9', 
                                   background: '#e0f2fe', padding: '6px 12px', borderRadius: 10, border: '1px solid #bae6fd'
                                 }}>
                                   <ShieldCheck size={16} /> iDFace: {entradaTime?.slice(0,5)}h
                                 </span>
                               ) : isPresenca ? (
                                 <span style={{ 
                                   display: 'inline-flex', alignItems: 'center', gap: 6, 
                                   fontSize: 12, fontWeight: 800, color: '#64748b', 
                                   background: '#f1f5f9', padding: '6px 12px', borderRadius: 10 
                                 }}>
                                   Lançamento Manual (Professor)
                                 </span>
                               ) : (
                                 <span style={{ 
                                   display: 'inline-flex', alignItems: 'center', gap: 6, 
                                   fontSize: 12, fontWeight: 800, color: '#991b1b', 
                                   background: '#fef2f2', padding: '6px 12px', borderRadius: 10 
                                 }}>
                                   Registro Curricular
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        <div className="ad-freq-hist-badge" style={{
                          padding: '8px 16px', borderRadius: 14, fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
                          background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2',
                          color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b'
                        }}>
                          {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Injustificada'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
