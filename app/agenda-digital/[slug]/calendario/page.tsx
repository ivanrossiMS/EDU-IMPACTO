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
import { 
  getAlunoTodasTurmasEGrupos, 
  getAlunoNomesTurmasEGrupos, 
  isTurmaOrGroupMatch 
} from '@/lib/studentTurmaUtils'

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

  const { chatGroups = [] } = useAgendaDigital()

  // Todas as turmas e grupos aos quais o aluno pertence (IDs, códigos e nomes)
  const studentTurmasEGrupos = useMemo(() => {
    if (!aluno) return []
    return getAlunoTodasTurmasEGrupos(aluno, turmas, chatGroups)
  }, [aluno, turmas, chatGroups])

  // Nomes legíveis das turmas/grupos ativos do aluno para exibição (ex: NÍVEL 5 - MATUTINO • Nível 5 Integra/Intermediario)
  const studentNomesTurmas = useMemo(() => {
    if (!aluno) return ['Sem Turma']
    const names = getAlunoNomesTurmasEGrupos(aluno, turmas, chatGroups)
    return names.length > 0 ? names : [aluno.turma_nome || aluno.turma || 'Sem Turma']
  }, [aluno, turmas, chatGroups])

  const turmaBadgeDisplay = useMemo(() => {
    return studentNomesTurmas.join(' • ')
  }, [studentNomesTurmas])

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

      // 2. Direcionado ao usuário atual
      if ((e as any).visibilidadeUsuario && currentUser && (e as any).visibilidadeUsuario === currentUser.nome) {
        return true
      }

      // 3. Visibilidade check
      let targets: any = e.turmas || []
      if (typeof targets === 'string') {
        try { targets = JSON.parse(targets) } catch(err) { targets = [targets] }
      }
      if (!Array.isArray(targets)) targets = []
      
      // Toda a instituição
      if (targets.length === 0 || targets.includes('TODOS') || targets.includes('Todos') || targets.includes('todas')) {
        return true
      }
      
      // Checar se algum alvo do evento corresponde às turmas ou grupos da aluna (com bloqueio estrito de turno)
      return targets.some((t: any) => isTurmaOrGroupMatch(t, aluno, turmas, chatGroups))
    })
  }, [eventosAgenda, filtroTipo, aluno, turmas, chatGroups, currentUser])

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

  // Helper para obter o NOME legível da turma do aniversariante (nunca exibindo código numérico como 3904)
  const getAniversarianteTurmaNome = (p: any): string => {
    if (p.tipo !== 'Aluno') {
      return p.cargo || p.funcao || p.tipo || 'Colaborador'
    }

    // 1. Verificar se turmaNome ou turma_nome já é um nome legível (não numérico nem UUID nem 'sync' nem 'Aluno')
    const candidate = String(p.turmaNome || p.turma_nome || '').trim()
    if (candidate && !/^\d+$/.test(candidate) && !/^[0-9a-fA-F-]{10,}$/.test(candidate) && candidate.toLowerCase() !== 'sync' && candidate.toLowerCase() !== 'aluno') {
      return candidate
    }

    const rawTurma = String(p.turma || '').trim()

    // 2. Tentar encontrar na lista de turmas carregadas no ERP
    if (Array.isArray(turmas) && turmas.length > 0) {
      const tObj = turmas.find((t: any) => t && (
        String(t.id).trim() === rawTurma ||
        String(t.codigo || '').trim() === rawTurma ||
        String(t.dados?.codigo || '').trim() === rawTurma ||
        String(t.id).trim() === candidate ||
        String(t.codigo || '').trim() === candidate
      ))
      if (tObj?.nome && !/^\d+$/.test(String(tObj.nome).trim())) return String(tObj.nome).trim()
      if (tObj?.dados?.nome && !/^\d+$/.test(String(tObj.dados.nome).trim())) return String(tObj.dados.nome).trim()
    }

    // 3. Tentar encontrar nos grupos da agenda
    if (Array.isArray(chatGroups) && chatGroups.length > 0) {
      const gObj = chatGroups.find((g: any) => g && (
        String(g.id).trim() === rawTurma ||
        String(g.syncId || g.dados?.syncId || '').trim() === rawTurma
      ))
      if (gObj?.nome && !/^\d+$/.test(String(gObj.nome).trim())) return String(gObj.nome).trim()
    }

    // 4. Se o aniversariante for colega da mesma turma do aluno logado
    if (aluno && rawTurma && String(aluno.turma || '').trim() === rawTurma) {
      if (studentNomesTurmas.length > 0 && studentNomesTurmas[0] !== 'Sem Turma') {
        return studentNomesTurmas[0]
      }
    }

    // 5. Fallback para a primeira turma legível da visualização
    if (studentNomesTurmas.length > 0 && studentNomesTurmas[0] !== 'Sem Turma') {
      return studentNomesTurmas[0]
    }

    return 'Aluno'
  }

  // Limpar cache de aniversariantes se o aluno ou suas turmas mudarem
  useEffect(() => {
    niversCacheRef.current = {}
  }, [aluno?.id, studentTurmasEGrupos])

  useEffect(() => {
    const mesView = month + 1
    
    // Se já temos os aniversariantes deste mês em cache para este aluno, exibimos instantaneamente (0ms)
    if (niversCacheRef.current[mesView]) {
      setAniversariantes(niversCacheRef.current[mesView])
      setLoadingNivers(false)
      return
    }

    let isCancelled = false
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const studentTurmaParam = studentTurmasEGrupos.slice(0, 10).map(encodeURIComponent).join(',')
        const alunoIdParam = aluno?.id ? `&aluno_id=${encodeURIComponent(String(aluno.id))}` : ''
        const req = await fetch(`/api/agenda/aniversariantes?mes=${mesView}${alunoIdParam}&turmas=${studentTurmaParam}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (!req.ok) throw new Error('Falha ao buscar aniversariantes')
        const todos = await req.json()
        if (isCancelled) return
        
        // Filtrar aniversariantes apenas para as turmas/grupos vinculadas à aluna ou colaboradores
        const niversMes = (todos || []).filter((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          if (!data) return false
          
          let m = -1
          if (data.includes('-')) m = parseInt(data.split('-')[1])
          else if (data.includes('/')) m = parseInt(data.split('/')[1])
          if (m !== mesView) return false
          
          if (p.tipo === 'Aluno') {
            const rawTurma = String(p.turma || '').trim()
            const turmaNome = String(p.turma_nome || p.turmaNome || '').trim()

            // 1. Checar se corresponde à turma / turno da aluna
            if (rawTurma && isTurmaOrGroupMatch(rawTurma, aluno, turmas, chatGroups)) return true
            if (turmaNome && isTurmaOrGroupMatch(turmaNome, aluno, turmas, chatGroups)) return true

            // 2. Se tiver tabela de turmas, checar via objeto turma do colega
            if (Array.isArray(turmas) && turmas.length > 0) {
              const pTurmaObj = turmas.find((t: any) => t && (String(t.id) === rawTurma || String(t.codigo) === rawTurma || String(t.nome) === turmaNome))
              if (pTurmaObj) {
                if (isTurmaOrGroupMatch(pTurmaObj.id, aluno, turmas, chatGroups)) return true
                if (pTurmaObj.nome && isTurmaOrGroupMatch(pTurmaObj.nome, aluno, turmas, chatGroups)) return true
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
          const resolvedTurmaNome = getAniversarianteTurmaNome(p)
          return { 
            ...p, 
            dia, 
            isProximo,
            turmaNome: resolvedTurmaNome,
            turma_nome: resolvedTurmaNome
          }
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
  }, [month, studentTurmasEGrupos, turmas, chatGroups, aluno])

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
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 992px) {
          .ad-calendar-main-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .ad-calendar-header-main {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .ad-calendar-date-card {
            width: 72px !important;
            min-width: 72px !important;
            padding: 12px 4px !important;
          }
          .ad-calendar-event-card {
            padding: 14px 16px !important;
          }
          .ad-calendar-day-num {
            font-size: 24px !important;
          }
        }
      `}} />

      {/* Standard Header */}
      <div className="ad-calendar-header" style={{ marginBottom: 20 }}>
        <div className="ad-calendar-header-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3.5vw, 28px)', color: '#0f172a', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Calendário Escolar
            </h1>
            <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, fontWeight: 500, margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              <span>{meventosNoMes.length} evento(s) no mês • {year}</span>
            </p>
          </div>
          <div className="ad-calendar-badge" style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.08)', color: '#4f46e5', borderRadius: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(99,102,241,0.15)' }}>
            Turma: {turmaBadgeDisplay}
          </div>
        </div>
      </div>

      {/* 📅 BARRA DO MÊS CENTRALIZADA */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '10px 16px',
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {/* Month Switcher Controls */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#f8fafc',
          padding: '5px 8px',
          borderRadius: 16,
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{
              border: 'none',
              background: '#fff',
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div style={{
            padding: '0 14px',
            fontSize: 15,
            fontWeight: 700,
            color: '#0f172a',
            minWidth: 140,
            textAlign: 'center',
            letterSpacing: '-0.01em',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {MESES[month]} {year}
          </div>

          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{
              border: 'none',
              background: '#fff',
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>

          {(hoje.getFullYear() !== year || hoje.getMonth() !== month) && (
            <button
              onClick={() => setViewDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
              style={{
                marginLeft: 4,
                padding: '4px 10px',
                borderRadius: 10,
                background: '#e0e7ff',
                color: '#4338ca',
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid #c7d2fe',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Voltar para o mês atual"
            >
              Hoje
            </button>
          )}
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
              const weekDayShort = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
              const monthAbbr = MESES[parseInt(m) - 1].slice(0, 3).toUpperCase()

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={dateStr}
                  style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}
                >
                  {/* 🗓️ LEFT DATE CARD */}
                  <div 
                    className="ad-calendar-date-card"
                    style={{
                      width: 82,
                      minWidth: 82,
                      background: '#fff',
                      borderRadius: 20,
                      padding: '16px 8px',
                      border: isToday ? '1.5px solid #6366f1' : '1px solid #eef2f6',
                      boxShadow: isToday ? '0 6px 20px rgba(99,102,241,0.12)' : '0 2px 10px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    {isToday && (
                      <span style={{
                        position: 'absolute',
                        top: -9,
                        padding: '2px 8px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#fff',
                        borderRadius: 10,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        boxShadow: '0 2px 6px rgba(99,102,241,0.3)'
                      }}>
                        HOJE
                      </span>
                    )}
                    <span 
                      className="ad-calendar-day-num"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: isToday ? '#4f46e5' : '#0f172a',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        fontFamily: 'Outfit, sans-serif'
                      }}
                    >
                      {String(parseInt(d)).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: isToday ? '#6366f1' : '#64748b',
                      marginTop: 4,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      {monthAbbr}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      marginTop: 2,
                      textTransform: 'uppercase'
                    }}>
                      {weekDayShort}
                    </span>
                  </div>

                  {/* 📋 RIGHT CONTENT CONTAINER */}
                  <div 
                    className="ad-calendar-event-card"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: '#fff',
                      borderRadius: 20,
                      padding: '16px 20px',
                      border: '1px solid #eef2f6',
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {eventsList.map((ev, idx) => {
                        const color = ev.cor ?? TIPO_CORES[ev.tipo] ?? '#6366f1'
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              paddingBottom: idx < eventsList.length - 1 ? 14 : 0,
                              borderBottom: idx < eventsList.length - 1 ? '1px solid #f1f5f9' : 'none',
                              position: 'relative',
                              zIndex: 2
                            }}
                          >
                            {/* Top Row: Time Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {eventsList.length > 1 && (
                                  <div style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: color,
                                    flexShrink: 0
                                  }} />
                                )}

                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '4px 10px',
                                  borderRadius: 10,
                                  background: color + '15',
                                  color: color,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  letterSpacing: '0.01em'
                                }}>
                                  <Clock size={12} strokeWidth={2.2} />
                                  <span>{(ev as any).diaTodo ? 'Dia Todo' : ev.horaInicio || '08:00'}</span>
                                  {!((ev as any).diaTodo) && ev.horaFim && (
                                    <span style={{ opacity: 0.8 }}> - {ev.horaFim}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Title & Description: Full width for fluid readability */}
                            <div>
                              <h4 style={{
                                fontSize: 14.5,
                                fontWeight: 700,
                                color: '#0f172a',
                                margin: 0,
                                lineHeight: 1.4,
                                letterSpacing: '-0.01em',
                                wordBreak: 'break-word'
                              }}>
                                {ev.titulo}
                              </h4>
                              {ev.descricao && (
                                <p style={{
                                  fontSize: 12.5,
                                  color: '#64748b',
                                  margin: '3px 0 0 0',
                                  lineHeight: 1.45,
                                  fontWeight: 400
                                }}>
                                  {ev.descricao}
                                </p>
                              )}
                              {ev.local && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  marginTop: 4
                                }}>
                                  <MapPin size={12} color={color} />
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
                          {getAniversarianteTurmaNome(p)}
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
