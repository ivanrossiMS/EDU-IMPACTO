'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, AlertTriangle, FileText, Clock, ChevronRight, ChevronLeft, ChevronDown,
  Calendar as CalendarIcon, Loader2, Info, LogOut, X, Users, Search,
  School, Activity, Sparkles, Filter, Check, ArrowRight
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery } from '@/hooks/useApi'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { supabase } from '@/lib/supabase'
import { UserAvatar } from '@/components/UserAvatar'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { useCollaboratorTurmas } from '../hooks/useCollaboratorTurmas'
import { TurmaDropdown } from '../components/TurmaDropdown'

export default function ColaboradorFrequenciaPage() {
  const {
    effectiveUser,
    isMirrorMode,
    isMasterAdmin,
    turmas,
    activeTurmas,
    turmaOptions,
    selectedTurmaId,
    setSelectedTurmaId,
    selectedTurmaName,
    selectedAno,
    setSelectedAno,
    anosLetivos,
    anoVigente
  } = useCollaboratorTurmas()

  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [modalTurmaId, setModalTurmaId] = useState<string>('all')
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Trava rolagem do body quando modal aberto
  useEffect(() => {
    if (selectedDate) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedDate])

  // Realtime updates
  useAgendaRealtime({
    table: 'frequencias',
    toastConfig: {
      enabled: true,
      insertMessage: () => 'Novo registro de frequência!',
      updateMessage: () => 'Registro de frequência atualizado!',
      icon: <CheckCircle2 size={18} color="#16a34a" />
    },
    onInsert: () => queryClient.invalidateQueries({ queryKey: ['frequencias-colaborador'] }),
    onUpdate: () => queryClient.invalidateQueries({ queryKey: ['frequencias-colaborador'] }),
    onDelete: () => queryClient.invalidateQueries({ queryKey: ['frequencias-colaborador'] })
  })

  // Sincronização em tempo real de saídas
  useEffect(() => {
    const channel = supabase.channel('saida_calls_colab_freq_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saida_calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['saida-calls-colaborador'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Buscar todos os alunos matriculados
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any>(
    ['alunos-colaborador-frequencia'],
    '/api/alunos?lightweight=true&all=true&limit=2000'
  )
  const allAlunos: any[] = useMemo(() => {
    if (!rawAlunos) return []
    if (Array.isArray(rawAlunos)) return rawAlunos
    if (Array.isArray(rawAlunos.data)) return rawAlunos.data
    return []
  }, [rawAlunos])

  // Filtrar alunos que pertencem às turmas ativas do colaborador
  const alunosVinculados = useMemo(() => {
    if (!activeTurmas || activeTurmas.length === 0) return []
    return allAlunos.filter(a => {
      if (a.status === 'inativo' || a.status === 'cancelado' || a.status === 'transferido') return false
      return activeTurmas.some(t => isAlunoCursandoTurma(a, t, t.ano || selectedAno, turmas))
    })
  }, [allAlunos, activeTurmas, selectedAno, turmas])

  const alunosIdsSet = useMemo(() => {
    const set = new Set<string>()
    alunosVinculados.forEach(a => {
      const idStr = String(a.id || '').trim()
      if (idStr) {
        set.add(idStr)
        set.add(idStr.toLowerCase())
        const noLeadingZero = idStr.replace(/^0+/, '')
        if (noLeadingZero) set.add(noLeadingZero)
      }
      const matStr = String(a.matricula || a.codigo || '').trim()
      if (matStr) {
        set.add(matStr)
        set.add(matStr.toLowerCase())
        const noLeadingZero = matStr.replace(/^0+/, '')
        if (noLeadingZero) set.add(noLeadingZero)
      }
    })
    return set
  }, [alunosVinculados])

  // Manipulação de datas do calendário
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const onDateClick = (day: Date) => {
    setSelectedDate(day)
    setStudentSearchTerm('')
    setModalTurmaId('all')
  }

  // Geração da grade do calendário
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate])
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const gridStartStr = useMemo(() => format(startDate, 'yyyy-MM-dd'), [startDate])
  const gridEndStr = useMemo(() => format(endDate, 'yyyy-MM-dd'), [endDate])
  const monthKey = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth])

  // Buscar frequências do banco para o grid do calendário
  const freqQueryParams = useMemo(() => {
    const params: Record<string, any> = {
      data_inicio: gridStartStr,
      data_fim: gridEndStr,
      limit: 10000
    }
    if (selectedTurmaId && selectedTurmaId !== 'all') {
      params.turma_id = selectedTurmaId
    }
    return params
  }, [gridStartStr, gridEndStr, selectedTurmaId])

  const { data: rawFrequencias = [], isLoading: isLoadingFreqs } = useApiQuery<any[]>(
    ['frequencias-colaborador', monthKey, gridStartStr, gridEndStr, selectedTurmaId, selectedAno],
    '/api/academico/frequencias',
    freqQueryParams
  )

  // Fallback para eventos de portaria iDFace
  const portariaQueryParams = useMemo(() => ({
    data_inicio: gridStartStr,
    data_fim: `${gridEndStr}T23:59:59`,
    limit: 5000
  }), [gridStartStr, gridEndStr])

  const { data: rawPortaria } = useApiQuery<any>(
    ['portaria-eventos-colaborador', monthKey, gridStartStr, gridEndStr],
    '/api/portaria/eventos',
    portariaQueryParams
  )

  const eventosPortaria = useMemo(() => {
    if (!rawPortaria) return []
    if (Array.isArray(rawPortaria)) return rawPortaria
    if (Array.isArray(rawPortaria.data)) return rawPortaria.data
    return []
  }, [rawPortaria])

  // Histórico de saídas confirmadas
  const saidaQueryParams = useMemo(() => ({
    from: gridStartStr,
    to: gridEndStr,
    limit: 5000
  }), [gridStartStr, gridEndStr])

  const { data: saidaCalls = [] } = useApiQuery<any[]>(
    ['saida-calls-colaborador', monthKey, gridStartStr, gridEndStr],
    '/api/saida/calls',
    saidaQueryParams
  )

  // Mapeamento de entradas na catraca por aluno e data
  const entradaCatracaMap = useMemo(() => {
    const map: Record<string, { hora: string; dispositivo?: string }> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map

    const validEvents = eventosPortaria.filter(e => {
      if (!e || !e.data_hora) return false
      if (!e.status) return true
      const s = String(e.status).toLowerCase().trim()
      return s === 'sucesso' || s === 'liberado' || s === 'autorizado' || s === 'ok' || s === 'entrada'
    })

    validEvents.forEach(e => {
      let datePart = ''
      let timePart = ''
      if (e.data_hora.includes('T') || e.data_hora.includes(' ')) {
        const parts = e.data_hora.split(/[T ]/)
        datePart = parts[0]
        timePart = parts[1]?.slice(0, 5) || ''
      } else {
        datePart = e.data_hora.slice(0, 10)
        timePart = e.data_hora.slice(11, 16)
      }

      const possibleIds = [
        e.aluno_id,
        e.matricula,
        e.user_id_equipamento
      ].filter(Boolean).map(v => String(v).trim())

      possibleIds.forEach(id => {
        if (!id) return
        const keys = [
          `${id}_${datePart}`,
          `${id.toLowerCase()}_${datePart}`,
          `${id.replace(/^0+/, '')}_${datePart}`
        ]
        keys.forEach(k => {
          if (!map[k]) {
            map[k] = {
              hora: timePart,
              dispositivo: e.dispositivo_nome || 'Portaria iDFace'
            }
          }
        })
      })
    })
    return map
  }, [eventosPortaria])

  // Frequências filtradas apenas para os alunos das turmas do colaborador
  const frequenciasAlunosVinculados = useMemo(() => {
    return (rawFrequencias || []).filter(f => {
      const aId = String(f.aluno_id || f.alunoId || '').trim()
      if (!aId) return false
      return alunosIdsSet.has(aId) || alunosIdsSet.has(aId.replace(/^0+/, ''))
    })
  }, [rawFrequencias, alunosIdsSet])

  // Resumo de datas com atividade no mês para o calendário
  const datasComAtividade = useMemo(() => {
    const map: Record<string, { presencas: number; faltas: number; justificadas: number; saidas: number }> = {}
    const countedStudentDay = new Set<string>()

    frequenciasAlunosVinculados.forEach(f => {
      const d = String(f.data).split('T')[0]
      const aId = String(f.aluno_id || f.alunoId || '').trim()
      if (!map[d]) map[d] = { presencas: 0, faltas: 0, justificadas: 0, saidas: 0 }

      if (aId) {
        countedStudentDay.add(`${aId}_${d}`)
        countedStudentDay.add(`${aId.replace(/^0+/, '')}_${d}`)
      }

      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        map[d].justificadas++
      } else if (!f.presente) {
        map[d].faltas++
      } else {
        map[d].presencas++
      }
    })

    // Contabilizar também entradas via catraca para alunos sem lançamento manual no dia
    if (eventosPortaria && Array.isArray(eventosPortaria)) {
      eventosPortaria.forEach((e: any) => {
        if (!e || !e.data_hora) return
        const s = String(e.status || '').toLowerCase().trim()
        if (s && s !== 'sucesso' && s !== 'liberado' && s !== 'autorizado' && s !== 'ok' && s !== 'entrada') return

        const possibleIds = [
          e.aluno_id,
          e.matricula,
          e.user_id_equipamento
        ].filter(Boolean).map((v: any) => String(v).trim())

        const matchedId = possibleIds.find(id => alunosIdsSet.has(id) || alunosIdsSet.has(id.replace(/^0+/, '')))
        if (!matchedId) return

        const d = e.data_hora.includes('T') ? e.data_hora.split('T')[0] : e.data_hora.slice(0, 10)
        const studentDayKey = `${matchedId}_${d}`
        if (!countedStudentDay.has(studentDayKey) && !countedStudentDay.has(`${matchedId.replace(/^0+/, '')}_${d}`)) {
          countedStudentDay.add(studentDayKey)
          if (!map[d]) map[d] = { presencas: 0, faltas: 0, justificadas: 0, saidas: 0 }
          map[d].presencas++
        }
      })
    }

    // Contabilizar também saídas
    saidaCalls.forEach(c => {
      if (c.status?.toLowerCase() !== 'confirmed') return
      const aId = String(c.studentId || c.alunoId || '').trim()
      if (!alunosIdsSet.has(aId) && !alunosIdsSet.has(aId.replace(/^0+/, ''))) return
      const dt = c.confirmedAt || c.calledAt
      if (!dt) return
      const d = String(dt).split('T')[0]
      if (!map[d]) map[d] = { presencas: 0, faltas: 0, justificadas: 0, saidas: 0 }
      map[d].saidas++
    })

    return map
  }, [frequenciasAlunosVinculados, eventosPortaria, saidaCalls, alunosIdsSet])

  // Contadores globais das turmas selecionadas
  const totalAlunosTurmas = alunosVinculados.length
  const totalPresencasMes = useMemo(() => {
    return Object.values(datasComAtividade).reduce((acc, curr) => acc + curr.presencas, 0)
  }, [datasComAtividade])
  const totalFaltasMes = useMemo(() => {
    return Object.values(datasComAtividade).reduce((acc, curr) => acc + curr.faltas, 0)
  }, [datasComAtividade])
  const totalSaidasMes = useMemo(() => {
    return Object.values(datasComAtividade).reduce((acc, curr) => acc + curr.saidas, 0)
  }, [datasComAtividade])

  // Alunos e seus status no dia selecionado
  const alunosNoDiaSelecionado = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    // Alunos das turmas ativas
    const targetTurmas = modalTurmaId === 'all'
      ? activeTurmas
      : activeTurmas.filter(t => String(t.id) === String(modalTurmaId))

    const list: any[] = []

    targetTurmas.forEach(turma => {
      const alunosDaTurma = allAlunos.filter(a => {
        if (a.status === 'inativo' || a.status === 'cancelado' || a.status === 'transferido') return false
        return isAlunoCursandoTurma(a, turma, turma.ano || selectedAno, turmas)
      })

      alunosDaTurma.forEach(aluno => {
        const aId = String(aluno.id)
        if (modalTurmaId === 'all' && list.some(item => String(item.aluno.id) === aId)) return

        const alunoPossibleIds = [
          String(aluno.id || '').trim(),
          String(aluno.id || '').trim().replace(/^0+/, ''),
          aluno.matricula ? String(aluno.matricula).trim() : '',
          aluno.matricula ? String(aluno.matricula).trim().replace(/^0+/, '') : '',
          aluno.codigo ? String(aluno.codigo).trim() : '',
          aluno.codigo ? String(aluno.codigo).trim().replace(/^0+/, '') : '',
        ].filter(Boolean)

        const freq = frequenciasAlunosVinculados.find(f => {
          const fDate = String(f.data).split('T')[0]
          if (fDate !== dateStr) return false
          const fAlunoId = String(f.aluno_id || f.alunoId || '').trim()
          const fClean = fAlunoId.replace(/^0+/, '')
          return alunoPossibleIds.includes(fAlunoId) || (fClean && alunoPossibleIds.includes(fClean))
        })

        // Entrada na catraca
        let catracaInfo: { hora: string; dispositivo?: string } | undefined = undefined
        for (const idCandidate of alunoPossibleIds) {
          const key = `${idCandidate}_${dateStr}`
          if (entradaCatracaMap[key]) {
            catracaInfo = entradaCatracaMap[key]
            break
          }
        }

        // Chamada de saída
        const saidaCall = saidaCalls.find(c => {
          if (c.status?.toLowerCase() !== 'confirmed') return false
          const cAlunoId = String(c.studentId || c.alunoId || '').trim()
          const cClean = cAlunoId.replace(/^0+/, '')
          if (!alunoPossibleIds.includes(cAlunoId) && (!cClean || !alunoPossibleIds.includes(cClean))) return false
          const dt = c.confirmedAt || c.calledAt
          if (!dt) return false
          return String(dt).split('T')[0] === dateStr
        })

        let status: 'P' | 'F' | 'J' | '-' = '-'
        let horaEntrada = freq?.horaRegistro || freq?.dados?.horaRegistro || catracaInfo?.hora
        let registradoPor = freq?.registradoPor || freq?.dados?.registradoPor || (catracaInfo ? 'Catraca iDFace' : undefined)

        if (freq) {
          if (freq.justificativa === 'Justificada' || freq.justificativa?.toLowerCase().includes('justifica')) {
            status = 'J'
          } else if (!freq.presente) {
            status = 'F'
          } else {
            status = 'P'
          }
        } else if (catracaInfo) {
          status = 'P'
        }

        let horaSaida: string | undefined = undefined
        let responsavelSaida: string | undefined = undefined
        if (saidaCall) {
          const dt = saidaCall.confirmedAt || saidaCall.calledAt
          if (dt) {
            try {
              horaSaida = new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            } catch {
              horaSaida = String(dt).slice(11, 16)
            }
          }
          responsavelSaida = saidaCall.guardianName || saidaCall.responsavel
        }

        list.push({
          aluno,
          turma,
          status,
          horaEntrada,
          registradoPor,
          isCatraca: !!catracaInfo || (registradoPor && (registradoPor.toLowerCase().includes('idface') || registradoPor.toLowerCase().includes('catraca'))),
          horaSaida,
          responsavelSaida
        })
      })
    })

    // Filtrar por busca de nome/matrícula se houver
    if (studentSearchTerm.trim()) {
      const q = studentSearchTerm.toLowerCase().trim()
      return list.filter(item => 
        item.aluno.nome?.toLowerCase().includes(q) ||
        String(item.aluno.matricula || item.aluno.id).toLowerCase().includes(q)
      )
    }

    return list.sort((a, b) => (a.aluno.nome || '').localeCompare(b.aluno.nome || ''))
  }, [selectedDate, modalTurmaId, activeTurmas, allAlunos, frequenciasAlunosVinculados, entradaCatracaMap, saidaCalls, studentSearchTerm, selectedAno, turmas])

  const statsNoDia = useMemo(() => {
    const total = alunosNoDiaSelecionado.length
    const p = alunosNoDiaSelecionado.filter(a => a.status === 'P').length
    const f = alunosNoDiaSelecionado.filter(a => a.status === 'F').length
    const j = alunosNoDiaSelecionado.filter(a => a.status === 'J').length
    const s = alunosNoDiaSelecionado.filter(a => !!a.horaSaida).length
    return { total, p, f, j, s }
  }, [alunosNoDiaSelecionado])

  const turmaCounts = useMemo(() => {
    const counts: Record<string, number> = { all: alunosVinculados.length }
    activeTurmas.forEach(t => {
      const c = alunosVinculados.filter(a => isAlunoCursandoTurma(a, t, t.ano || selectedAno, turmas)).length
      counts[String(t.id)] = c
    })
    return counts
  }, [activeTurmas, alunosVinculados, selectedAno, turmas])

  return (
    <div className="frequencia-page-container" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 110, fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* ─── TOPO: Título e Seletor de Turma do Colaborador ─── */}
      <div className="frequencia-header-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
              color: '#fff', 
              padding: '4px 10px', 
              borderRadius: 8, 
              fontSize: 11, 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5 
            }}>
              Portal do Colaborador
            </span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {activeTurmas.length} {activeTurmas.length === 1 ? 'turma vinculada' : 'turmas vinculadas'}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Frequência das Turmas
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Acompanhe a presença, ausências e saídas dos alunos das suas turmas dia a dia.
          </p>
        </div>

        {/* Seletor de Turma & Ano */}
        <div style={{ minWidth: 260, maxWidth: 380, width: '100%' }}>
          <TurmaDropdown
            turmaOptions={turmaOptions}
            selectedTurmaId={selectedTurmaId}
            setSelectedTurmaId={setSelectedTurmaId}
            selectedTurmaName={selectedTurmaName}
            anosLetivos={anosLetivos}
            selectedAno={selectedAno}
            setSelectedAno={setSelectedAno}
            anoVigente={anoVigente}
            allLabel="Todas as Minhas Turmas"
          />
        </div>
      </div>

      {/* Se o colaborador não tem nenhuma turma vinculada */}
      {turmas.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px solid #f1f5f9',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 20
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <School size={28} color="#2563eb" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            Nenhuma turma vinculada
          </h3>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 440, lineHeight: 1.6 }}>
            Você não possui turmas vinculadas ao seu usuário. Para visualizar a frequência de alunos, sua conta deve estar associada a uma ou mais turmas.
          </p>
        </div>
      ) : (
        <>
          {/* ─── CALENDÁRIO DINÂMICO INTERATIVO ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        style={{ 
          background: '#fff', 
          borderRadius: 24, 
          boxShadow: '0 10px 40px rgba(0,0,0,0.04)', 
          border: '1px solid #f1f5f9',
          overflow: 'hidden', 
          padding: '32px', 
          marginBottom: 32 
        }}
      >
        {/* Cabeçalho do Calendário */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#0f172a', textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              Clique em qualquer dia para ver os alunos e o registro detalhado
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button 
              onClick={() => setCurrentMonth(new Date())} 
              style={{ padding: '10px 20px', borderRadius: 14, background: '#e0f2fe', color: '#0284c7', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Hoje
            </button>
            <button 
              onClick={prevMonth} 
              aria-label="Mês anterior"
              style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', transition: 'all 0.2s' }}
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button 
              onClick={nextMonth} 
              aria-label="Próximo mês"
              style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', transition: 'all 0.2s' }}
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 14 }}>
          {weekDays.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {day}
            </div>
          ))}
        </div>

        {/* Grade de Dias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {calendarDays.map((day) => {
            const isCurrMonth = isSameMonth(day, monthStart)
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayStats = datasComAtividade[dateStr]

            const hasPresenca = dayStats && dayStats.presencas > 0
            const hasFalta = dayStats && dayStats.faltas > 0
            const hasJustificada = dayStats && dayStats.justificadas > 0
            const hasSaida = dayStats && dayStats.saidas > 0

            let bgLight = '#fff'
            let textColor = isCurrMonth ? '#0f172a' : '#cbd5e1'
            let border = '1px solid #f1f5f9'

            if (isCurrMonth && dayStats) {
              if (hasFalta && !hasPresenca) {
                bgLight = '#fef2f2'
                textColor = '#991b1b'
                border = '1px solid #fecaca'
              } else if (hasJustificada && !hasPresenca) {
                bgLight = '#fef3c7'
                textColor = '#b45309'
                border = '1px solid #fde68a'
              } else if (hasPresenca) {
                bgLight = '#f0fdf4'
                textColor = '#166534'
                border = '1px solid #dcfce7'
              } else if (hasSaida) {
                bgLight = '#fdf4ff'
                textColor = '#86198f'
                border = '1px solid #fce7f3'
              }
            }

            const isSelected = selectedDate && isSameDay(day, selectedDate)
            if (isSelected) {
              bgLight = '#0284c7'
              textColor = '#fff'
              border = '1px solid #0284c7'
            }

            return (
              <motion.div
                key={day.toString()}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onDateClick(day)}
                style={{
                  height: 74,
                  borderRadius: 18,
                  border,
                  background: bgLight,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 10px 25px -4px rgba(2, 132, 199, 0.4)' : 'none'
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 800, color: textColor }}>
                  {format(day, 'd')}
                </span>

                {/* Pontos de Status do Dia */}
                <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                  {hasPresenca && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#16a34a' }} />
                  )}
                  {hasFalta && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#ef4444' }} />
                  )}
                  {hasJustificada && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#f59e0b' }} />
                  )}
                  {hasSaida && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#c026d3' }} />
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Legenda do Calendário */}
        <div style={{ display: 'flex', gap: 24, marginTop: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, background: '#f0fdf4', border: '1px solid #dcfce7' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Presenças</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Faltas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, background: '#fef3c7', border: '1px solid #fde68a' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Justificadas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, background: '#fdf4ff', border: '1px solid #fce7f3' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Saídas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, background: '#0284c7', border: '1px solid #0284c7' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Dia selecionado</span>
          </div>
        </div>
      </motion.div>
      </>
      )}

      {/* ─── MODAL ULTRA MODERNO DO DIA SELECIONADO ─── */}
      {mounted && selectedDate && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDate(null)}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(8px, 2.5vw, 20px)',
              boxSizing: 'border-box'
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 320, damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 'clamp(18px, 3vw, 24px)',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
                width: '100%',
                maxWidth: 780,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid rgba(226, 232, 240, 0.8)'
              }}
            >
              {/* Header do Modal */}
              <div style={{
                padding: '16px clamp(14px, 3vw, 24px)',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 14px rgba(2, 132, 199, 0.25)',
                    flexShrink: 0
                  }}>
                    <CalendarIcon size={20} strokeWidth={2.5} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: 'clamp(15px, 3.5vw, 19px)', 
                      fontWeight: 900, 
                      color: '#0f172a', 
                      textTransform: 'capitalize', 
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginTop: 2 }}>
                      Frequência das Turmas Vinculadas
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    marginLeft: 10
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#cbd5e1'; e.currentTarget.style.color = '#0f172a' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Sub-header: Seletor de Turma em Listagem + Busca + Contadores */}
              <div style={{ 
                padding: '14px clamp(14px, 3vw, 24px)', 
                borderBottom: '1px solid #f1f5f9', 
                background: '#ffffff', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 12,
                flexShrink: 0
              }}>
                {/* Seletor de Turma em Listagem */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label 
                      htmlFor="modal-turma-select"
                      style={{ 
                        fontSize: 11, 
                        fontWeight: 800, 
                        color: '#475569', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <School size={14} color="#0284c7" />
                      Filtrar por Turma
                    </label>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                      {alunosNoDiaSelecionado.length} {alunosNoDiaSelecionado.length === 1 ? 'aluno listado' : 'alunos listados'}
                    </span>
                  </div>

                  <div style={{ position: 'relative', width: '100%' }}>
                    <select
                      id="modal-turma-select"
                      value={modalTurmaId}
                      onChange={e => setModalTurmaId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 36px 9px 12px',
                        borderRadius: 12,
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#0f172a',
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <option value="all">
                        Todas as Turmas Vinculadas ({turmaCounts['all'] ?? alunosVinculados.length} alunos)
                      </option>
                      {activeTurmas.map(t => (
                        <option key={t.id} value={String(t.id)}>
                          {t.nome} ({turmaCounts[String(t.id)] ?? 0} alunos)
                        </option>
                      ))}
                    </select>
                    <ChevronDown 
                      size={16} 
                      style={{ 
                        position: 'absolute', 
                        right: 12, 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: '#64748b', 
                        pointerEvents: 'none' 
                      }} 
                    />
                  </div>
                </div>

                {/* Busca e Resumo de Métricas do Dia */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar aluno por nome ou matrícula..."
                      value={studentSearchTerm}
                      onChange={e => setStudentSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 32px 8px 36px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        fontSize: 12.5,
                        outline: 'none',
                        background: '#f8fafc',
                        boxSizing: 'border-box'
                      }}
                    />
                    {studentSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#e2e8f0',
                          border: 'none',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Resumo de métricas do dia */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: statsNoDia.j > 0 && statsNoDia.s > 0 ? 'repeat(4, 1fr)' : statsNoDia.j > 0 || statsNoDia.s > 0 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
                    gap: 6 
                  }}>
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '5px 8px', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#059669', lineHeight: 1 }}>{statsNoDia.p}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', marginTop: 2 }}>Presentes</div>
                    </div>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '5px 8px', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{statsNoDia.f}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', marginTop: 2 }}>Faltas</div>
                    </div>
                    {statsNoDia.j > 0 && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '5px 8px', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#d97706', lineHeight: 1 }}>{statsNoDia.j}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginTop: 2 }}>Justificadas</div>
                      </div>
                    )}
                    {statsNoDia.s > 0 && (
                      <div style={{ background: '#fdf4ff', border: '1px solid #f5d0fe', padding: '5px 8px', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#c026d3', lineHeight: 1 }}>{statsNoDia.s}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#a21caf', marginTop: 2 }}>Saídas</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Corpo: Lista dos Alunos */}
              <div style={{ 
                padding: '14px clamp(14px, 3vw, 24px)', 
                overflowY: 'auto', 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 10 
              }}>
                {alunosNoDiaSelecionado.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Activity size={40} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>Nenhum aluno encontrado</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                      {isFuture(selectedDate) ? 'Data futura ou feriado letivo.' : 'Não há registros para esta seleção.'}
                    </div>
                  </div>
                ) : (
                  alunosNoDiaSelecionado.map((item, idx) => {
                    const isP = item.status === 'P'
                    const isJ = item.status === 'J'
                    const isF = item.status === 'F'

                    let badgeBg = '#f1f5f9'
                    let badgeColor = '#64748b'
                    let badgeLabel = 'Sem Registro'

                    if (isP) {
                      badgeBg = '#dcfce7'
                      badgeColor = '#166534'
                      badgeLabel = 'Presente'
                    } else if (isJ) {
                      badgeBg = '#fef3c7'
                      badgeColor = '#92400e'
                      badgeLabel = 'Justificada'
                    } else if (isF) {
                      badgeBg = '#fee2e2'
                      badgeColor = '#991b1b'
                      badgeLabel = 'Falta'
                    }

                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 16,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Linha Superior: Avatar + Info + Badge de Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                            <UserAvatar
                              userId={item.aluno.id}
                              name={item.aluno.nome}
                              fotoUrl={item.aluno.foto}
                              size={40}
                              style={{ borderRadius: 12, flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ 
                                fontSize: 13.5, 
                                fontWeight: 800, 
                                color: '#0f172a', 
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.aluno.nome}
                              </div>
                              <div style={{ 
                                fontSize: 11.5, 
                                color: '#64748b', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                marginTop: 2,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ fontWeight: 600, flexShrink: 0 }}>
                                  Matrícula: {item.aluno.matricula || item.aluno.id}
                                </span>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ 
                                  color: '#0284c7', 
                                  fontWeight: 700, 
                                  background: '#f0f9ff', 
                                  padding: '1px 6px', 
                                  borderRadius: 6, 
                                  fontSize: 11,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {item.turma?.nome}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span style={{
                            padding: '5px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            background: badgeBg,
                            color: badgeColor,
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                          }}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Linha Inferior: Entrada e Saída (se houver) */}
                        {(item.horaEntrada || item.horaSaida) && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            flexWrap: 'wrap',
                            paddingTop: 8,
                            borderTop: '1px dashed #f1f5f9'
                          }}>
                            {/* Entrada */}
                            {item.horaEntrada && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 800,
                                color: item.isCatraca ? '#0284c7' : '#475569',
                                background: item.isCatraca ? '#e0f2fe' : '#f1f5f9',
                                padding: '4px 9px',
                                borderRadius: 8,
                                lineHeight: 1.2
                              }}>
                                <Clock size={12} strokeWidth={2.5} />
                                {item.isCatraca ? `iDFace: ${item.horaEntrada.slice(0, 5)}h` : `Entrada: ${item.horaEntrada.slice(0, 5)}h`}
                              </span>
                            )}

                            {/* Saída */}
                            {item.horaSaida && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#c026d3',
                                background: '#fdf4ff',
                                border: '1px solid #fce7f3',
                                padding: '4px 9px',
                                borderRadius: 8,
                                lineHeight: 1.2,
                                maxWidth: '100%',
                                wordBreak: 'break-word'
                              }}>
                                <LogOut size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                                <span>
                                  <strong style={{ fontWeight: 800 }}>Saída: {item.horaSaida}</strong>
                                  {item.responsavelSaida && ` (${item.responsavelSaida})`}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer do Modal */}
              <div style={{
                padding: '12px clamp(14px, 3vw, 24px)',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0
              }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {alunosNoDiaSelecionado.length} {alunosNoDiaSelecionado.length === 1 ? 'aluno listado' : 'alunos listados'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  style={{
                    padding: '8px 22px',
                    borderRadius: 10,
                    background: '#0f172a',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Responsive Styles */}
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 640px) {
          .frequencia-page-container {
            padding: 12px 10px 80px 10px !important;
          }
          .frequencia-header-wrapper {
            margin-bottom: 12px !important;
            gap: 10px !important;
          }
        }
      `}} />
    </div>
  )
}
