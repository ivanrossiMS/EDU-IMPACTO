'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData, EventoAgenda } from '@/lib/dataContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import React, { useState, useMemo, useEffect, use } from 'react'
import { ChevronLeft, ChevronRight, Filter, Calendar, Sparkles, Smile, Star, Heart, Camera, Clock, MapPin, Loader2 } from 'lucide-react'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type TipoEvento = EventoAgenda['tipo']

const TIPO_CORES: Record<TipoEvento, string> = {
  aula: '#3b82f6', evento: '#f59e0b', prova: '#ef4444', reuniao: '#8b5cf6',
  feriado: '#6b7280', excursao: '#10b981', entrega: '#06b6d4', atividade: '#ec4899',
}
const TIPO_LABELS: Record<TipoEvento, string> = {
  aula: 'Aula', evento: 'Evento', prova: 'Prova/Avaliação', reuniao: 'Reunião',
  feriado: 'Feriado', excursao: 'Excursão', entrega: 'Entrega', atividade: 'Atividade'
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }
function todayStr() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

// Caches removidos: utilizando API otimizada de aniversariantes

export default function ADCalendarioPage({ params }: { params: Promise<{ slug: string }>}) {
  const [eventosAgenda, , { loading, setLocal: setLocalEventos }] = useSupabaseArray<EventoAgenda>('agenda/eventos')
  const [turmas] = useSupabaseArray<any>('turmas')

  useAgendaRealtime({
    table: 'eventos_agenda',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Novo evento: ${doc.titulo || 'Sem título'}`,
      updateMessage: (doc) => `Evento atualizado: ${doc.titulo || 'Sem título'}`,
      icon: <Calendar size={18} color="#6366f1" />
    },
    onInsert: ({ new: newEvento }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => {
          if (prev.some((p: any) => p.id === newEvento.id)) return prev;
          return [...prev, newEvento];
        });
      }
    },
    onUpdate: ({ new: updatedEvento }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => prev.map((p: any) => p.id === updatedEvento.id ? { ...p, ...updatedEvento } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => prev.filter((p: any) => p.id !== old?.id));
      }
    }
  });
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const { currentUser } = useApp()
  const { aluno } = useSelectedStudent()
  const rawTurma = aluno?.turma || 'Sem Turma'
  
  const turmaDoAluno = (() => {
    if (!aluno) return 'Sem Turma'
    if (aluno.turma_nome && aluno.turma_nome !== aluno.turma) {
      return String(aluno.turma_nome).split('-')[0].trim()
    }
    const turmaObj = turmas.find(t => String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma))
    const nomeTurma = turmaObj?.nome || aluno.turma_nome || aluno.turma || 'Sem Turma'
    return String(nomeTurma).split('-')[0].trim()
  })()

  const { chatGroups = [] } = useAgendaDigital()
  
  const studentGroupNames = useMemo(() => {
    if (!aluno) return []
    const studentId = String(aluno.id)
    const studentTurmaObj = turmas.find(t => 
      String(t.id) === String(aluno.turma) || 
      String(t.codigo) === String(aluno.turma) || 
      String(t.nome) === String(aluno.turma)
    )

    return chatGroups.filter(g => {
      // 1. Explicitly contains student ID
      if (g.alunosIds?.some(id => String(id) === studentId)) return true
      // 2. Synced with student's class/turma
      if (studentTurmaObj && (
        String(g.id) === `sync-${studentTurmaObj.id}` || 
        String(g.id) === String(studentTurmaObj.id) ||
        g.nome === studentTurmaObj.nome
      )) return true
      return false
    }).map(g => String(g.nome || '').toLowerCase())
  }, [chatGroups, aluno, turmas])

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Filter events targeted to this student's class
  const eventosFiltrados = useMemo(() => {
    return (eventosAgenda || []).filter(e => {
      // 1. Filter by type selector
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false

      // 2. Visibilidade check
      let targets: any = e.turmas || []
      if (typeof targets === 'string') {
        try { targets = JSON.parse(targets) } catch(err) { targets = [targets] }
      }
      if (!Array.isArray(targets)) targets = []
      
      // Toda a instituição
      if (targets.length === 0 || targets.includes('TODOS') || targets.includes('Todos')) {
        return true
      }
      // Turma do aluno or Groups
      if (targets.some((t: any) => {
        if (!t) return false
        const tLower = String(t).toLowerCase()
        return (
          (turmaDoAluno && (tLower === turmaDoAluno.toLowerCase() || turmaDoAluno.toLowerCase().includes(tLower) || tLower.includes(turmaDoAluno.toLowerCase()))) ||
          studentGroupNames.includes(tLower)
        )
      })) {
        return true
      }
      // Direcionado ao usuário atual
      if ((e as any).visibilidadeUsuario && currentUser && (e as any).visibilidadeUsuario === currentUser.nome) {
        return true
      }
      return false
    })
  }, [eventosAgenda, filtroTipo, turmaDoAluno, currentUser, studentGroupNames])

  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const proximosEventos = eventosFiltrados
    .filter(e => e.data >= today)
    .sort((a, b) => (a.data + a.horaInicio) < (b.data + b.horaInicio) ? -1 : 1)
    .slice(0, 5)

  const [aniversariantes, setAniversariantes] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)

  useEffect(() => {
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const mesView = month + 1
        const req = await fetch(`/api/agenda/aniversariantes?mes=${mesView}`)
        if (!req.ok) throw new Error('Falha ao buscar aniversariantes')
        const todos = await req.json()
        
        // Filter birthdays only for peers in the SAME CLASS or teachers
        const niversMes = todos.filter((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          if (!data) return false
          const m = parseInt(data.split('-')[1])
          if (m !== mesView) return false
          
          if (p.tipo === 'Aluno') {
            const pTurmaRaw = p.turma || ''
            const pTurmaObj = turmas.find((t: any) => String(t.id) === String(pTurmaRaw) || String(t.codigo) === String(pTurmaRaw) || String(t.nome) === String(pTurmaRaw))
            const pNomeTurma = pTurmaObj?.nome || p.turma_nome || pTurmaRaw
            const pNomeTurmaLimpo = String(pNomeTurma).split('-')[0].trim()
            return pNomeTurmaLimpo.toLowerCase() === turmaDoAluno.toLowerCase()
          }
          return true // Keep teachers visible
        }).map((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          const dia = parseInt(data.split('-')[2])
          let isProximo = false
          if (mesView === (hoje.getMonth() + 1)) {
            const diaHoje = hoje.getDate()
            isProximo = dia >= diaHoje && dia <= (diaHoje + 7)
          }
          return { ...p, dia, isProximo }
        }).sort((a: any, b: any) => a.dia - b.dia)
        setAniversariantes(niversMes)
      } catch (e) { console.error(e) } finally { setLoadingNivers(false) }
    }
    fetchNivers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, turmaDoAluno])

  useEffect(() => {
    if (!aluno?.id || eventosFiltrados.length === 0) return;
    
    // Check which ones are unread
    const unreadIds = eventosFiltrados
      .filter(e => {
        const leituras = (e as any).dados?.leituras || (e as any).leituras || {};
        return !leituras[aluno.id];
      })
      .map(e => e.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'evento',
          ids: unreadIds,
          alunoId: aluno.id
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark eventos as read:', err));
    }
  }, [eventosFiltrados, aluno?.id]);

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 100 }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
           .ad-calendar-mobile-container .page-header { align-items: center !important; text-align: center !important; flex-direction: column !important; gap: 12px !important; }
           .ad-calendar-filter-bar { flex-direction: column !important; align-items: stretch !important; padding: 16px !important; }
           .ad-calendar-grid-columns { grid-template-columns: 1fr !important; }
           .ad-calendar-bottom-panels { grid-template-columns: 1fr !important; }
           .ad-calendar-right-col { height: auto !important; overflow-y: visible !important; }
           .ad-calendar-inner-scroll { max-height: none !important; overflow-y: visible !important; }
        }
      `}} />

      {/* Header aligned perfectly with the admin design */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, color: '#1e293b', margin: 0 }}>Calendário Escolar</h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>{eventosFiltrados.length} evento(s) da turma • {year}</p>
        </div>
        <div className="ad-calendar-badge" style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 20, fontSize: 13, fontWeight: 700, border: '1px solid rgba(99,102,241,0.15)' }}>
          Turma: {turmaDoAluno}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ad-calendar-filter-bar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <Filter size={13} style={{ color: 'hsl(var(--text-muted))' }} />
        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Main Two-Column Calendar Grid */}
      <div className="ad-calendar-grid-columns" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: Month Selector Calendar Card */}
        <div className="card" style={{ padding: '16px', borderRadius: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)', background: '#fff', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{MESES[month]} {year}</div>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 10 }}>
            {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const dateStr = getDateStr(d)
              const events = eventosPorDia(dateStr)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              return (
                <button key={d} onClick={() => setSelectedDay(isSelected ? null : dateStr)} style={{ height: 42, borderRadius: 12, background: isSelected ? '#6366f1' : 'transparent', border: `1px solid ${isSelected ? '#6366f1' : isToday ? '#e2e8f0' : 'transparent'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected || isToday ? 800 : 500, color: isSelected ? '#fff' : isToday ? '#6366f1' : '#334155' }}>{d}</div>
                  <div style={{ display: 'flex', gap: 2 }}>{isSelected ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} /> : events.slice(0, 3).map(ev => <div key={ev.id} style={{ width: 4, height: 4, borderRadius: '50%', background: ev.cor ?? TIPO_CORES[ev.tipo] }} />)}</div>
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Right Column: Events and Birthday sub-panels */}
        <div className="ad-calendar-right-col" style={{ display: 'flex', flexDirection: 'column', gap: 20, height: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'none' }}>
          
          {/* 📍 Events of the selected day Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="card" 
            style={{ 
              padding: '24px', borderRadius: 28, border: '1px solid rgba(255,255,255,0.8)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(99, 102, 241, 0.03)', borderRadius: '50%' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                   <Calendar size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>
                    {selectedDay ? `${parseInt(selectedDay.split('-')[2])} de ${MESES[parseInt(selectedDay.split('-')[1]) - 1]}` : 'Agenda do Dia'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{selectedEvents.length} compromisso(s)</div>
                </div>
              </div>
            </div>

            {selectedEvents.length === 0 ? (
              loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#6366f1' }} />
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Carregando eventos...</div>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>☁️</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{selectedDay ? 'Nenhum evento para este dia' : 'Selecione um dia no calendário'}</div>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedEvents.map((ev, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                    key={ev.id} 
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '08',
                      borderRadius: 12,
                      border: `1px solid ${(ev.cor ?? TIPO_CORES[ev.tipo]) + '15'}`,
                      marginBottom: idx === selectedEvents.length - 1 ? 0 : 8,
                      gap: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                      {/* Event Color Dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.cor ?? TIPO_CORES[ev.tipo], flexShrink: 0 }} />
                      
                      {/* Time */}
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', background: '#f8fafc', padding: '4px 8px', borderRadius: 6, minWidth: 100, textAlign: 'center', flexShrink: 0 }}>
                        {(ev as any).diaTodo ? '☀️ Dia Todo' : `${ev.horaInicio || '00:00'}${ev.horaFim ? ` - ${ev.horaFim}` : ''}`}
                      </span>

                      {/* Title & Local */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</span>
                          <span style={{ fontSize: 10, fontWeight: 900, color: ev.cor ?? TIPO_CORES[ev.tipo], textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
                            {TIPO_LABELS[ev.tipo]}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                          {ev.local && (
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={11} /> <span>{ev.local}</span>
                            </div>
                          )}
                          {ev.descricao && (
                            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', paddingLeft: 15 }}>
                              {ev.descricao}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Birthdays and Upcoming Side-by-Side Panels */}
          <div className="ad-calendar-bottom-panels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            
            {/* 🎉 Birthdays Panel */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="card" style={{ padding: '20px', borderRadius: 28, background: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={16} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>Aniversários do Mês</span>
              </div>

              <div className="ad-calendar-inner-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {loadingNivers ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
                ) : aniversariantes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 11, color: '#94a3b8' }}>Ninguém este mês 🎈</div>
                ) : (
                  aniversariantes.map((p, idx) => (
                    <motion.div 
                      whileHover={{ x: 5 }}
                      key={p.id || idx}
                      style={{ 
                        display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', 
                        borderRadius: 22, background: p.isProximo ? 'rgba(236, 72, 153, 0.04)' : '#f8fafc',
                        border: p.isProximo ? '1.5px solid rgba(236, 72, 153, 0.15)' : '1.5px solid transparent',
                        boxShadow: p.isProximo ? '0 8px 20px rgba(236, 72, 153, 0.05)' : 'none'
                      }}
                    >
                      <div style={{ 
                        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                        background: p.foto ? `url(${p.foto}) center/cover` : '#fff',
                        border: p.isProximo ? '2.5px solid #ec4899' : '2.5px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#64748b',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                      }}>
                        {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Outfit, sans-serif' }}>{p.nome}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{p.tipo}</div>
                      </div>

                      <div style={{ 
                        width: 54, height: 54, borderRadius: 18, flexShrink: 0,
                        background: p.isProximo ? '#ec4899' : '#fff',
                        border: p.isProximo ? 'none' : '1.5px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        boxShadow: p.isProximo ? '0 10px 20px rgba(236, 72, 153, 0.25)' : '0 4px 10px rgba(0,0,0,0.03)'
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: p.isProximo ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Dia</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: p.isProximo ? '#fff' : '#1e293b', lineHeight: 1 }}>{p.dia}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* 📅 Upcoming Events Panel */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="card" style={{ padding: '20px', borderRadius: 28, background: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Calendar size={16} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>Próximos Compromissos</span>
              </div>

              <div className="ad-calendar-inner-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {proximosEventos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 11, color: '#94a3b8' }}>Sem eventos futuros</div>
                ) : (
                  proximosEventos.map((ev, idx) => {
                    const [y, m, d] = ev.data.split('-')
                    return (
                      <motion.div 
                        whileHover={{ x: 5 }}
                        key={ev.id} 
                        style={{ 
                          display: 'flex', gap: 10, alignItems: 'center', padding: '10px', 
                          borderRadius: 16, background: '#f8fafc', border: '1px solid transparent'
                        }}
                      >
                        <div style={{ 
                          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                          background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '15',
                          color: ev.cor ?? TIPO_CORES[ev.tipo],
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900
                        }}>
                          <span>{d}</span>
                          <span style={{ fontSize: 8 }}>{MESES[parseInt(m)-1].slice(0,3)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{TIPO_LABELS[ev.tipo]}</div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}
