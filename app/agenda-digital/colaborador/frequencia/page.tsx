'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, ShieldCheck, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Filter, Users } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { getInitials } from '@/lib/utils'
import { useApp } from '@/lib/context'
import { TurmaDropdown } from '../components/TurmaDropdown'


export default function ColaboradorFrequenciaPage() {
  const { currentUser } = useApp()
  const { adConfig, chatGroups } = useAgendaDigital()
  
  if (adConfig?.permissoes?.visualizarFrequencia === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de histórico de frequência está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  const { turmas = [] } = useData()
  const [alunos = []] = useSupabaseArray<any>('alunos', [])
  
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const turmaOptions = React.useMemo(() => {
    if (!currentUser?.id) return [{ id: 'all', nome: 'Minhas Turmas' }];
    
    const userGroups = (chatGroups || []).filter(g => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some(id => String(id) === String(currentUser.id));
    });

    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return [{ id: 'all', nome: 'Minhas Turmas' }, ...accessibleTurmas]
  }, [turmas, chatGroups, currentUser])

  const selectedTurmaName = React.useMemo(() => {
    if (selectedTurmaId === 'all') return 'Minhas Turmas'
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? t.nome : 'Turma Selecionada'
  }, [selectedTurmaId, turmas])

  const alunosFiltrados = useMemo(() => {
    if (selectedTurmaId === 'all') {
      const accessibleTurmaIds = turmaOptions.filter(t => t.id !== 'all').map(t => String(t.id));
      return alunos.filter(a => accessibleTurmaIds.includes(String(a.turma)) || accessibleTurmaIds.includes(String(a.turmaId)));
    }
    return alunos.filter(a => String(a.turma) === String(selectedTurmaId) || String(a.turmaId) === String(selectedTurmaId))
  }, [alunos, selectedTurmaId, turmaOptions, currentUser])

  // Fetch frequencias (se selecionou uma turma, passamos o turma_id)
  const { data: frequenciasDb = [], isLoading: isLoadingFrequencias } = useApiQuery<any[]>(
    ['frequencias-colaborador', selectedTurmaId],
    '/api/academico/frequencias',
    { turma_id: selectedTurmaId === 'all' ? '' : selectedTurmaId },
    { enabled: true }
  )

  const historicoReal = useMemo(() => {
    const list: Array<{ data: string; dateObj: Date; status: 'P' | 'F' | 'J' | 'A'; alunoId: string; alunoNome: string; horaRegistro?: string; registradoPor?: string }> = []
    
    ;(frequenciasDb || []).forEach(f => {
      let status: 'P' | 'F' | 'J' | 'A' = 'P'
      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        status = 'J'
      } else if (!f.presente) {
        status = 'F'
      }

      const d = new Date(f.data + 'T12:00:00Z')
      
      // Encontrar nome do aluno (pode vir no join ou buscamos do array alunos)
      let alunoNome = f.alunoNome || f.aluno_nome || f.dados?.alunoNome;
      if (!alunoNome) {
        const al = alunosFiltrados.find(a => String(a.id) === String(f.aluno_id));
        alunoNome = al ? al.nome : 'Aluno Desconhecido';
      }

      // Filtrar apenas se pertencer aos alunosFiltrados no caso de all ou match
      if (selectedTurmaId !== 'all') {
        const isInTurma = alunosFiltrados.some(a => String(a.id) === String(f.aluno_id));
        if (!isInTurma) return; // skip
      }

      list.push({
        data: f.data,
        dateObj: d,
        status,
        alunoId: f.aluno_id,
        alunoNome,
        horaRegistro: f.horaRegistro || f.dados?.horaRegistro,
        registradoPor: f.registradoPor || f.dados?.registradoPor
      })
    })
    
    return list.sort((a, b) => b.data.localeCompare(a.data))
  }, [frequenciasDb, alunosFiltrados, selectedTurmaId])

  // Aggregate stats globais
  const totalRegistros = historicoReal.length
  const totalPresencas = historicoReal.filter(h => h.status === 'P').length
  const totalFaltasInjustificadas = historicoReal.filter(h => h.status === 'F' || h.status === 'A').length
  
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const onDateClick = (day: Date) => setSelectedDate(day)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const dateFormat = "d"
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const selectedRecords = useMemo(() => {
    if (!selectedDate) return []
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
    return historicoReal.filter(h => h.data === selectedDateStr).sort((a, b) => a.alunoNome.localeCompare(b.alunoNome))
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
          .ad-freq-cal-grid {
            gap: 4px !important;
          }
          .ad-freq-cal-cell {
            min-height: 50px !important;
          }
        }
        .turma-pill {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .turma-pill.active {
          background: #1e293b;
          color: white;
          box-shadow: 0 4px 12px rgba(30, 41, 59, 0.2);
        }
        .turma-pill.inactive {
          background: #f1f5f9;
          color: #64748b;
        }
        .turma-pill.inactive:hover {
          background: #e2e8f0;
          color: #334155;
        }
      `}} />

      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
        className="ad-freq-header-bar"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
      >
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-main))', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>
              <CalendarIcon size={22} />
            </div>
            Frequência
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Acompanhe o histórico completo de presenças da turma no calendário escolar.
          </p>
        </div>
      </motion.div>

      {/* Turma Selector */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-surface))', 
          border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'hsl(var(--text-muted))', flexShrink: 0
        }}>
           <Users size={20} />
        </div>
        <TurmaDropdown 
              turmaOptions={turmaOptions} 
              selectedTurmaId={selectedTurmaId} 
              setSelectedTurmaId={setSelectedTurmaId} 
              selectedTurmaName={selectedTurmaName} 
            />
      </div>

      {/* Calendário Dinâmico Interativo */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 15px 35px rgba(0,0,0,0.02)', overflow: 'visible', padding: '24px 28px', marginBottom: 32 }}>
        
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

        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
          {weekDays.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#94a3b8', paddingBottom: 8, textTransform: 'uppercase' }}>
              {day}
            </div>
          ))}
        </div>

        <div className="ad-freq-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {calendarDays.map((day, idx) => {
            const isCurrMonth = isSameMonth(day, monthStart)
            const isTodayDate = isToday(day)
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayRecords = historicoReal.filter(h => h.data === dateStr)
            
            const hasRegistros = dayRecords.length > 0;
            const hasFalta = dayRecords.some(r => r.status === 'F' || r.status === 'A')
            
            let bgLight = '#fff'
            let bgDot = 'transparent'
            let textColor = isCurrMonth ? '#334155' : '#cbd5e1'
            let border = '1px solid #f1f5f9'
            let dotGlow = 'none'

            if (isCurrMonth && hasRegistros) {
              if (hasFalta) {
                // Se alguém faltou, mostra indicador de atenção
                bgLight = '#fef2f2'
                bgDot = '#ef4444'
                textColor = '#991b1b'
                border = '1px solid #fecaca'
                dotGlow = '0 0 10px rgba(239,68,68,0.4)'
              } else {
                // 100% presenças
                bgLight = '#f0fdf4'
                bgDot = '#22c55e'
                textColor = '#166534'
                border = '1px solid #bbf7d0'
                dotGlow = '0 0 10px rgba(34,197,94,0.4)'
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
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={20} color="#64748b" />
                  Alunos ({selectedTurmaName}): {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedRecords.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                    <Activity size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>Nenhum lançamento neste dia</div>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                      {isFuture(selectedDate) ? 'Data futura ou feriado.' : 'Não há registros de presença ou falta cadastrados para esta turma.'}
                    </div>
                  </div>
                ) : (
                  selectedRecords.map((h, i) => {
                    const isPresenca = h.status === 'P'
                    const isFaltaJustificada = h.status === 'J'
                    
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: '16px 28px', borderBottom: i < selectedRecords.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ 
                             width: 44, height: 44, borderRadius: '50%', 
                             background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2', 
                             color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b', 
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             fontWeight: 800, fontSize: 16
                           }}>
                             {getInitials(h.alunoNome)}
                           </div>
                           <div>
                             <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                               {h.alunoNome}
                             </div>
                             <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontWeight: 500 }}>                               
                               {h.horaRegistro && (
                                 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                   <ShieldCheck size={14} /> {h.horaRegistro.slice(0,5)}h
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        <div style={{
                          padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5,
                          background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2',
                          color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b'
                        }}>
                          {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Falta'}
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
