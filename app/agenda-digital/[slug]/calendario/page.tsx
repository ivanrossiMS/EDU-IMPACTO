'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData, EventoAgenda } from '@/lib/dataContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import React, { useState, useMemo, useEffect, useRef, use } from 'react'
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

import { useParams, useSearchParams } from 'next/navigation'

// Caches removidos: utilizando API otimizada de aniversariantes

export default function ADCalendarioPage({ params }: { params: any }) {
  const [eventosAgenda, , { loading, setLocal: setLocalEventos, refresh }] = useSupabaseArray<EventoAgenda>('agenda/eventos')
  const [turmas] = useSupabaseArray<any>('turmas')

  useEffect(() => {
    if (!refresh) return;
    const handleUpdate = () => refresh();
    window.addEventListener('ad:eventos_agenda-insert', handleUpdate)
    window.addEventListener('ad:eventos_agenda-update', handleUpdate)
    window.addEventListener('ad:eventos_agenda-delete', handleUpdate)
    return () => {
      window.removeEventListener('ad:eventos_agenda-insert', handleUpdate)
      window.removeEventListener('ad:eventos_agenda-update', handleUpdate)
      window.removeEventListener('ad:eventos_agenda-delete', handleUpdate)
    }
  }, [refresh])

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
  const resolvedParams = useParams() as { slug: string }
  const { currentUser } = useApp()
  const { aluno } = useSelectedStudent()
  const { adConfig } = useAgendaDigital()
  const searchParams = useSearchParams()
  const espelharRespId = searchParams?.get('espelhar_responsavel');
  const espelharAluno = searchParams?.get('espelhar_aluno') === 'true';
  const isMirroring = !!(espelharRespId || espelharAluno);
  const showBirthdays = adConfig?.permissoes?.visualizarAniversariantes !== false;

  const rawTurma = aluno?.turma || 'Sem Turma'
  
  const turmaDoAluno = (() => {
    if (!aluno) return 'Sem Turma'
    if (aluno.turma_nome && aluno.turma_nome !== aluno.turma) {
      return String(aluno.turma_nome).split('-')[0].trim()
    }
    const turmaObj = turmas.find(t => t && (String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma) || String(t.nome) === String(aluno.turma)))
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
        String((g as any).syncId || g.id) === `sync-${studentTurmaObj.id}` || 
        String(g.id) === String(studentTurmaObj.id) ||
        g.nome === studentTurmaObj.nome
      )) return true
      return false
    }).map(g => String(g.nome || '').toLowerCase())
  }, [chatGroups, aluno, turmas])

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr())
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Filter events targeted to this student's class
  const [searchQuery, setSearchQuery] = useState('')

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
      
      // Toda a instituição ou Ano Letivo
      if (targets.length === 0 || targets.includes('TODOS') || targets.includes('Todos')) {
        return true
      }
      
      // Turma do aluno or Groups
      if (targets.some((t: any) => {
        if (!t) return false
        const tLower = String(t).toLowerCase()
        
        if (tLower === 'todos' || tLower === 'toda a escola' || tLower === 'todas') return true
        if (tLower.startsWith('todos:')) {
          const targetAno = tLower.split(':')[1]?.trim()
          const currentTurmaObj: any = turmas.find(tObj => tObj && (String(tObj.id) === String(aluno?.turma) || String(tObj.codigo) === String(aluno?.turma) || String(tObj.nome) === String(aluno?.turma)))
          const studentAno = currentTurmaObj ? (currentTurmaObj.ano !== undefined ? String(currentTurmaObj.ano) : (currentTurmaObj.anoLetivo || currentTurmaObj.ano_letivo || currentTurmaObj.dados?.anoLetivo || '')) : ''
          if (studentAno === targetAno) return true
        }

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

  // Events of the selected month filtered by search
  const meventosNoMes = useMemo(() => {
    return eventosFiltrados
      .filter(e => {
        if (!e.data) return false
        const [y, m] = e.data.split('-')
        return parseInt(y) === year && parseInt(m) === month + 1
      })
      .filter(e => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          e.titulo?.toLowerCase().includes(q) ||
          e.local?.toLowerCase().includes(q) ||
          e.descricao?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')))
  }, [eventosFiltrados, year, month, searchQuery])

  // Grouped by date for list presentation
  const meventosAgrupados = useMemo(() => {
    const groups: Record<string, typeof meventosNoMes> = {}
    meventosNoMes.forEach(ev => {
      if (!groups[ev.data]) groups[ev.data] = []
      groups[ev.data].push(ev)
    })
    return groups
  }, [meventosNoMes])

  const proximosEventos = eventosFiltrados
    .filter(e => e.data >= today)
    .sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')))
    .slice(0, 5)

  const [aniversariantes, setAniversariantes] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)
  const niversCacheRef = useRef<Record<number, any[]>>({})

  // Conjunto de chaves de identificação da turma do aluno para matching de altíssima precisão
  const targetTurmaKeys = useMemo(() => {
    const keys = new Set<string>()
    if (aluno?.turma) keys.add(String(aluno.turma).trim().toLowerCase())
    if (aluno?.turma_nome) {
      const lower = String(aluno.turma_nome).trim().toLowerCase()
      keys.add(lower)
      const base = lower.split('-')[0].trim()
      if (base) keys.add(base)
    }
    if (turmaDoAluno && turmaDoAluno !== 'Sem Turma') {
      keys.add(turmaDoAluno.toLowerCase().trim())
    }
    if (Array.isArray(turmas) && turmas.length > 0) {
      for (const t of turmas) {
        if (!t) continue
        const isMatch = (aluno?.turma && (String(t.id) === String(aluno.turma) || String(t.codigo) === String(aluno.turma))) ||
          (aluno?.turma_nome && String(t.nome).toLowerCase().includes(String(aluno.turma_nome).toLowerCase()))
        if (isMatch) {
          if (t.id) keys.add(String(t.id).toLowerCase().trim())
          if (t.codigo) keys.add(String(t.codigo).toLowerCase().trim())
          if (t.nome) {
            const tLower = String(t.nome).toLowerCase().trim()
            keys.add(tLower)
            const base = tLower.split('-')[0].trim()
            if (base) keys.add(base)
          }
        }
      }
    }
    return keys
  }, [aluno?.turma, aluno?.turma_nome, turmaDoAluno, turmas])

  useEffect(() => {
    const mesView = month + 1
    
    // Se já temos os aniversariantes deste mês em cache, exibimos instantaneamente (0ms)
    if (niversCacheRef.current[mesView]) {
      setAniversariantes(niversCacheRef.current[mesView])
      setLoadingNivers(false)
      return
    }

    let isCancelled = false
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const req = await fetch(`/api/agenda/aniversariantes?mes=${mesView}`)
        if (!req.ok) throw new Error('Falha ao buscar aniversariantes')
        const todos = await req.json()
        if (isCancelled) return
        
        // Filtrar aniversariantes apenas para a mesma turma do aluno ou colaboradores
        const niversMes = (todos || []).filter((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          if (!data) return false
          
          let m = -1
          if (data.includes('-')) m = parseInt(data.split('-')[1])
          else if (data.includes('/')) m = parseInt(data.split('/')[1])
          if (m !== mesView) return false
          
          if (p.tipo === 'Aluno') {
            const pId = String(p.turma || '').trim().toLowerCase()
            const pNome = String(p.turma_nome || '').trim().toLowerCase()
            const pNomeBase = pNome.split('-')[0].trim()

            // 1. Match direto por ID da turma
            if (pId && targetTurmaKeys.has(pId)) return true
            // 2. Match direto por nome da turma
            if (pNome && targetTurmaKeys.has(pNome)) return true
            // 3. Match por nome base (ex: '4º ano a')
            if (pNomeBase && targetTurmaKeys.has(pNomeBase)) return true

            // 4. Match via tabela de turmas se disponível
            if (Array.isArray(turmas) && turmas.length > 0) {
              const pTurmaObj = turmas.find((t: any) => t && (String(t.id) === String(p.turma) || String(t.codigo) === String(p.turma) || String(t.nome) === String(p.turma)))
              if (pTurmaObj) {
                if (targetTurmaKeys.has(String(pTurmaObj.id).toLowerCase().trim())) return true
                if (pTurmaObj.codigo && targetTurmaKeys.has(String(pTurmaObj.codigo).toLowerCase().trim())) return true
                if (targetTurmaKeys.has(String(pTurmaObj.nome).toLowerCase().trim())) return true
                const pObjBase = String(pTurmaObj.nome).toLowerCase().split('-')[0].trim()
                if (targetTurmaKeys.has(pObjBase)) return true
              }
            }

            return false
          }
          return true // Manter colaboradores/professores visíveis
        }).map((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          let dia = -1
          if (data.includes('-')) dia = parseInt(data.split('-')[2])
          else if (data.includes('/')) dia = parseInt(data.split('/')[0])
          
          let isProximo = false
          if (mesView === (hoje.getMonth() + 1)) {
            const diaHoje = hoje.getDate()
            isProximo = dia === diaHoje
          }
          return { ...p, dia, isProximo }
        }).sort((a: any, b: any) => a.dia - b.dia)

        if (!isCancelled) {
          niversCacheRef.current[mesView] = niversMes
          setAniversariantes(niversMes)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!isCancelled) setLoadingNivers(false)
      }
    }

    fetchNivers()
    return () => { isCancelled = true }
  }, [month, targetTurmaKeys, turmas])

  useEffect(() => {
    if (!aluno?.id || eventosFiltrados.length === 0) return;
    
    const evts = eventosFiltrados;
    const currentReaderId = isMirroring ? (espelharRespId || resolvedParams.slug) : (currentUser?.id || '');
    if (!currentReaderId) return;

    const legacyResponsavelId = isMirroring ? espelharRespId : ((currentUser as any)?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || '');
    const legacyAlunoId = isMirroring ? (espelharAluno ? resolvedParams.slug : '') : ((currentUser as any)?.aluno_id || (currentUser as any)?.user_metadata?.aluno_id || '');
    const readerIdWithSlug = legacyResponsavelId ? `${legacyResponsavelId}_${aluno.id}` : '';
    const currentReaderWithSlug = `${currentReaderId}_${aluno.id}`;
    const isFamily = currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável';

    const unreadIds = evts
      .filter(e => {
        const leituras = (e as any).dados?.leituras || (e as any).leituras || {};
        const isRead = !!(
          leituras[currentReaderId] || 
          (legacyResponsavelId && leituras[legacyResponsavelId]) || 
          (legacyAlunoId && leituras[legacyAlunoId]) ||
          (readerIdWithSlug && leituras[readerIdWithSlug]) ||
          leituras[currentReaderWithSlug]
        );
        return !isRead;
      })
      .map(e => e.id);

    // If we are mirroring, we should not mark events as read on behalf of the user.
    if (isMirroring) return;

    if (unreadIds.length > 0 && setLocalEventos) {
      setLocalEventos((old: any) => {
        if (!old || !Array.isArray(old)) return old;
        const nowIso = new Date().toISOString();
        return old.map((e: any) => {
          if (unreadIds.includes(e.id)) {
            const currentDados = e.dados || {};
            return {
              ...e,
              dados: {
                ...currentDados,
                leituras: {
                  ...(currentDados.leituras || {}),
                  ...(isFamily ? {} : { [currentReaderId]: nowIso, [aluno.id]: nowIso }),
                  ...(isFamily && readerIdWithSlug ? { [readerIdWithSlug]: nowIso } : {}),
                  ...(isFamily ? { [currentReaderWithSlug]: nowIso } : {})
                }
              }
            }
          }
          return e;
        });
      });

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

  if (loading && (!eventosAgenda || eventosAgenda.length === 0)) {
    return (
      <div className="ad-admin-page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Loader2 size={40} color="#6366f1" className="animate-spin" style={{ filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.5))' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 100, fontFamily: 'Outfit, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 992px) {
          .ad-calendar-main-grid { grid-template-columns: 1fr !important; }
        }
      `}} />

      {/* Standard Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 28, color: '#1e293b', margin: 0 }}>Calendário Escolar</h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>{meventosNoMes.length} evento(s) no mês • {year}</p>
        </div>
        <div className="ad-calendar-badge" style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 20, fontSize: 13, fontWeight: 800, border: '1px solid rgba(99,102,241,0.15)' }}>
          Turma: {turmaDoAluno}
        </div>
      </div>

      {/* 📅 FILTRO DO MÊS ALINHADO À ESQUERDA */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '12px 20px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}>
        {/* Month Switcher Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 10px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{ border: 'none', background: '#fff', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: '#475569' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ padding: '0 16px', fontSize: 15, fontWeight: 900, color: '#1e293b', minWidth: 140, textAlign: 'center' }}>
            {MESES[month]} {year}
          </div>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{ border: 'none', background: '#fff', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: '#475569' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 🚀 LAYOUT PRINCIPAL EM LISTA (2 COLUNAS: LISTA DE EVENTOS + CARD DE ANIVERSARIANTES) */}
      <div className="ad-calendar-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        
        {/* 📋 COLUNA ESQUERDA: AGENDA DE EVENTOS EM LISTA TIMELINE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {Object.keys(meventosAgrupados).length === 0 ? (
            /* Modern Empty State */
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: '60px 24px',
                textAlign: 'center',
                border: '1px solid #f1f5f9',
                boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px auto', color: '#4338ca'
              }}>
                <Calendar size={36} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>
                Nenhum evento encontrado
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 360, margin: '0 auto 20px auto' }}>
                {selectedDay
                  ? 'Não há compromissos agendados para a data selecionada.'
                  : 'Nenhum evento agendado para este mês.'}
              </p>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 14,
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(99,102,241,0.25)'
                  }}
                >
                  Ver Todos os Eventos do Mês
                </button>
              )}
            </motion.div>
          ) : (
            /* Timeline List Groups (Matching Reference Image) */
            Object.entries(meventosAgrupados).map(([dateStr, eventsList]) => {
              const [y, m, d] = dateStr.split('-')
              const isToday = dateStr === today
              const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
              const weekDayFull = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })
              const monthAbbr = MESES[parseInt(m) - 1].slice(0, 3).toUpperCase()

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={dateStr}
                  style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}
                >
                  {/* 🗓️ LEFT DATE CARD */}
                  <div style={{
                    width: 100,
                    minWidth: 100,
                    background: '#fff',
                    borderRadius: 22,
                    padding: '18px 10px',
                    border: isToday ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    boxShadow: isToday ? '0 8px 24px rgba(99,102,241,0.12)' : '0 4px 16px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative'
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: isToday ? '#6366f1' : '#1e293b', lineHeight: 1 }}>
                      {String(parseInt(d)).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: isToday ? '#6366f1' : '#1e293b', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {monthAbbr}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginTop: 2, textTransform: 'uppercase' }}>
                      {weekDayFull}
                    </span>
                    {isToday && (
                      <span style={{ position: 'absolute', top: -10, padding: '2px 8px', background: '#6366f1', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        HOJE
                      </span>
                    )}
                  </div>

                  {/* 📋 RIGHT CONTENT CONTAINER WITH VERTICAL TIMELINE */}
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    background: '#fff',
                    borderRadius: 22,
                    padding: '20px 24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {/* Vertical Timeline Line for multiple events */}
                    {eventsList.length > 1 && (
                      <div style={{
                        position: 'absolute',
                        left: 28,
                        top: 32,
                        bottom: 32,
                        width: 3,
                        background: 'linear-gradient(180deg, #f97316 0%, #6366f1 100%)',
                        borderRadius: 2,
                        zIndex: 1
                      }} />
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {eventsList.map((ev, idx) => {
                        const color = ev.cor ?? TIPO_CORES[ev.tipo] ?? '#f97316'
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                              paddingBottom: idx < eventsList.length - 1 ? 14 : 0,
                              borderBottom: idx < eventsList.length - 1 ? '1px solid #f8fafc' : 'none',
                              position: 'relative',
                              zIndex: 2,
                              flexWrap: 'wrap'
                            }}
                          >
                            {/* Vertical Line Node Circle */}
                            {eventsList.length > 1 && (
                              <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#fff',
                                border: `3px solid ${color}`,
                                flexShrink: 0,
                                margin: '0 4px 0 -2px'
                              }} />
                            )}

                            {/* Time Pill */}
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              borderRadius: 14,
                              background: color + '15',
                              color: color,
                              fontSize: 12,
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              <Clock size={13} />
                              <span>{(ev as any).diaTodo ? 'Dia Todo' : ev.horaInicio || '08:00'}</span>
                              {!((ev as any).diaTodo) && ev.horaFim && (
                                <span style={{ opacity: 0.8 }}> - {ev.horaFim}</span>
                              )}
                            </div>

                            {/* Title & Description */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.3 }}>
                                {ev.titulo}
                              </h4>
                              {ev.descricao && (
                                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                                  {ev.descricao}
                                </p>
                              )}
                              {ev.local && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                                  <MapPin size={11} color={color} />
                                  <span>{ev.local}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}

        </div>

        {/* 🎈 COLUNA DIREITA: APENAS O CARD DE ANIVERSARIANTES DO MÊS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {showBirthdays && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: '22px',
                boxShadow: '0 15px 35px rgba(236, 72, 153, 0.08)',
                border: '1px solid rgba(236, 72, 153, 0.15)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Header Decorative Background */}
              <div style={{
                margin: '-22px -22px 18px -22px',
                padding: '18px 22px',
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>Aniversários do Mês</h3>
                    <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 600 }}>{MESES[month]}</span>
                  </div>
                </div>
                <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.25)', borderRadius: 12, fontSize: 12, fontWeight: 900 }}>
                  {aniversariantes.length}
                </div>
              </div>

              {/* List of Birthdays */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto', paddingRight: 2 }} className="ad-date-strip-scroll">
                {loadingNivers ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8' }}>Carregando aniversariantes...</div>
                ) : aniversariantes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>🎈</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Nenhum aniversariante neste mês</div>
                  </div>
                ) : (
                  aniversariantes.map((p, idx) => (
                    <motion.div
                      whileHover={{ x: 4 }}
                      key={p.id || idx}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 16,
                        background: p.isProximo ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.04) 100%)' : '#f8fafc',
                        border: p.isProximo ? '1.5px solid rgba(236, 72, 153, 0.3)' : '1px solid #f1f5f9'
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: p.foto ? `url(${p.foto}) center/cover` : 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 900,
                        boxShadow: '0 4px 10px rgba(236, 72, 153, 0.2)',
                        border: p.isProximo ? '2px solid #ec4899' : '2px solid #fff'
                      }}>
                        {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.nome}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.tipo === 'Aluno' ? (p.turmaNome || (p.turma && !/^\d+$/.test(p.turma) && !/^[0-9a-fA-F-]{10,}$/.test(p.turma) ? p.turma : 'Aluno')) : (p.cargo || p.funcao || p.tipo)}
                        </div>
                      </div>

                      {/* Day Badge */}
                      <div style={{
                        padding: '6px 10px',
                        borderRadius: 12,
                        background: p.isProximo ? '#ec4899' : '#fff',
                        color: p.isProximo ? '#fff' : '#1e293b',
                        border: p.isProximo ? 'none' : '1px solid #e2e8f0',
                        textAlign: 'center',
                        flexShrink: 0,
                        boxShadow: p.isProximo ? '0 6px 12px rgba(236,72,153,0.3)' : 'none'
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>
                          {p.isProximo ? 'É HOJE' : 'DIA'}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>
                          {p.dia}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
