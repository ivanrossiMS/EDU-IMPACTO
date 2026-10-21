'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import * as Popover from '@radix-ui/react-popover'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Calendar as CalendarIcon,
  ClipboardCheck,
  ShieldAlert,
  Megaphone,
  CheckCircle2,
  Clock,
  UserCheck
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useBroadcastRealtime } from '@/lib/hooks/useBroadcastRealtime'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api/apiClient'
import { checkIsCollaboratorOrTeacher, checkIsAdmin, checkIsStaffManagement } from '@/lib/chatPermissions'
import { format, isAfter, subDays, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Estado e conexões compartilhadas entre múltiplas instâncias montadas (DesktopTopNav + Sidebar) ──
let sharedSaidaCallsState: any[] = []
const saidaCallsListeners = new Set<(calls: any[]) => void>()
let inflightSpecialAuthFetch: Promise<any[]> | null = null
let lastSpecialAuthFetchAt = 0

function updateSharedSaidaCalls(updater: any[] | ((prev: any[]) => any[])) {
  const next = typeof updater === 'function' ? updater(sharedSaidaCallsState) : updater
  const seen = new Set<string>()
  sharedSaidaCallsState = (Array.isArray(next) ? next : []).filter(item => {
    const id = item?.id ? String(item.id) : ''
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  saidaCallsListeners.forEach(listener => listener(sharedSaidaCallsState))
}

let sharedRealtimeChannel: any = null
let sharedRealtimeSubscribers = 0

const sharedReadsInflight = new Map<string, Promise<string[]>>()
const sharedReadsCache = new Map<string, { reads: string[], timestamp: number }>()

export function NotificationPopover({
  side = 'top',
  align = 'start',
  sideOffset = 12,
  alignOffset = -10
}: {
  side?: 'top' | 'bottom'
  align?: 'start' | 'end' | 'center'
  sideOffset?: number
  alignOffset?: number
} = {}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'tarefas' | 'agenda' | 'ocorrencias' | 'comunicado' | 'autorizacao'>('all')

  const dataContext = useData()
  const tarefas = dataContext?.tarefas || []
  const eventosAgenda = dataContext?.eventosAgenda || []
  const ocorrencias = dataContext?.ocorrencias || []
  const turmas = dataContext?.turmas || []
  const { currentUser, hydrated } = useApp()
  const pathname = usePathname()
  const { on: onRealtime } = useBroadcastRealtime()

  // ── Identificação e Permissões do Colaborador Individual ───────────────────
  const isColab = useMemo(() => {
    return checkIsCollaboratorOrTeacher(currentUser?.cargo, currentUser?.perfil, currentUser)
  }, [currentUser])

  const isAdmin = useMemo(() => {
    return checkIsAdmin(currentUser?.cargo, currentUser?.perfil)
  }, [currentUser])

  const isManagement = useMemo(() => {
    return isAdmin || checkIsStaffManagement(currentUser?.cargo, currentUser?.perfil)
  }, [currentUser, isAdmin])

  // Comunicados recentes
  const [comunicados] = useSupabaseArray<any>('comunicados?order=created_at.desc&limit=15')

  // ── Sincronização em tempo real das Autorizações Especiais do Dia ────────────
  const [saidaCalls, setSaidaCalls] = useState<any[]>(() => sharedSaidaCallsState)

  useEffect(() => {
    saidaCallsListeners.add(setSaidaCalls)
    if (sharedSaidaCallsState.length > 0) {
      setSaidaCalls(sharedSaidaCallsState)
    }
    return () => {
      saidaCallsListeners.delete(setSaidaCalls)
    }
  }, [])

  const fetchSpecialAuths = useCallback(async (force = false) => {
    if (!hydrated || !currentUser || !isColab) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !force) return

    const now = Date.now()
    if (!force && now - lastSpecialAuthFetchAt < 15000) {
      return
    }
    if (inflightSpecialAuthFetch) {
      await inflightSpecialAuthFetch
      return
    }

    lastSpecialAuthFetchAt = now
    inflightSpecialAuthFetch = (async () => {
      try {
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date())
        const res = await apiFetch(`/api/saida/calls?date=${todayStr}&onlySpecialAuth=true`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
          cache: 'no-store'
        })
        if (!res.ok) return sharedSaidaCallsState
        const data = await res.json()
        const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        updateSharedSaidaCalls(arr)
        return arr
      } catch (err) {
        console.warn('[NotificationPopover] Falha ao sincronizar autorizações da portaria:', err)
        return sharedSaidaCallsState
      } finally {
        inflightSpecialAuthFetch = null
      }
    })()

    await inflightSpecialAuthFetch
  }, [hydrated, currentUser, isColab])

  // 1. Carga inicial e a cada mudança de rota (respeitando cooldown de 15s entre instâncias)
  useEffect(() => {
    fetchSpecialAuths(false)
  }, [fetchSpecialAuths, pathname])

  // 2. Revalidação imediata sempre que o usuário abre o popover
  useEffect(() => {
    if (open) {
      fetchSpecialAuths(true)
    }
  }, [open, fetchSpecialAuths])

  // 3. Polling em segundo plano a cada 60 segundos (compartilhado entre instâncias)
  useEffect(() => {
    if (!hydrated || !currentUser || !isColab) return
    const timer = setInterval(() => {
      fetchSpecialAuths(false)
    }, 60000)
    return () => clearInterval(timer)
  }, [fetchSpecialAuths, hydrated, currentUser, isColab])

  // 4. Escuta de eventos em tempo real locais/BroadcastChannel (chamadas e autorizações instantâneas)
  useEffect(() => {
    if (!hydrated || !currentUser || !isColab) return
    const unsub = onRealtime('*', payload => {
      const d = payload.data as any
      if ((payload.event === 'CALL_STUDENT' && d?.status === 'special_auth') || payload.event === 'SPECIAL_AUTH_NOTIFY') {
        const incomingId = d?.id || d?.callId
        if (incomingId) {
          updateSharedSaidaCalls(prev => {
            const idx = prev.findIndex(c => c.id === incomingId)
            const targetTime = d.targetTime || d.target_time || d.dados?.targetTime || d.horarioPrevisto || undefined
            const newEntry = {
              ...d,
              id: incomingId,
              status: 'special_auth',
              targetTime
            }
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = { ...updated[idx], ...newEntry }
              return updated
            }
            return [newEntry, ...prev]
          })
        }
      } else if (payload.event === 'CONFIRM_PICKUP') {
        const targetId = d?.callId
        const sId = d?.studentId ? String(d.studentId).trim() : ''
        updateSharedSaidaCalls(prev => {
          return prev.map(c => {
            const matchId = targetId && c.id === targetId
            const matchStudent = sId && c.studentId && String(c.studentId).trim() === sId
            if (matchId || matchStudent) {
              return { ...c, confirmedOut: true, confirmedAt: d?.confirmedAt || new Date().toISOString() }
            }
            return c
          })
        })
      } else if (payload.event === 'DELETE_CALL' || payload.event === 'CANCEL_CALL') {
        if (d?.callId) {
          updateSharedSaidaCalls(prev => prev.filter(c => c.id !== d.callId))
        }
      }
    })
    return () => { unsub() }
  }, [onRealtime, hydrated, currentUser, isColab])

  // 5. Escuta de eventos Realtime via Supabase (canal único compartilhado entre instâncias)
  // Se SaidaProvider já estiver ativo na rota (/saida-alunos ou /agenda-digital),
  // reaproveita o evento local 'saida_calls:postgres_change' sem abrir segundo canal postgres_changes.
  useEffect(() => {
    if (!hydrated || !currentUser || !isColab) return

    const handleSaidaPostgresPayload = (payload: any) => {
      if (!payload) return
      const { eventType, new: newRow, old: oldRow } = payload
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        let rawDados = newRow?.dados || {}
        if (typeof rawDados === 'string') {
          try { rawDados = JSON.parse(rawDados) } catch (e) {}
        }
        if (rawDados.status === 'special_auth') {
          const call = { id: newRow.id, ...rawDados }
          updateSharedSaidaCalls(prev => {
            const idx = prev.findIndex(c => c.id === call.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...next[idx], ...call }
              return next
            }
            return [call, ...prev]
          })
        } else if (rawDados.status === 'confirmed') {
          const sId = rawDados.studentId ? String(rawDados.studentId).trim() : ''
          if (sId) {
            updateSharedSaidaCalls(prev => prev.map(c => {
              if (c.studentId && String(c.studentId).trim() === sId) {
                return { ...c, confirmedOut: true, confirmedAt: rawDados.confirmedAt || rawDados.calledAt || new Date().toISOString() }
              }
              return c
            }))
          }
        }
      } else if (eventType === 'DELETE' && oldRow?.id) {
        updateSharedSaidaCalls(prev => prev.filter(c => c.id !== oldRow.id))
      }
    }

    const onWindowSaidaChange = (e: Event) => {
      handleSaidaPostgresPayload((e as CustomEvent).detail)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('saida_calls:postgres_change', onWindowSaidaChange)
    }

    const isSaidaProviderRoute = Boolean(
      pathname?.startsWith('/saida-alunos') || pathname?.startsWith('/agenda-digital')
    )
    if (isSaidaProviderRoute) {
      if (sharedRealtimeChannel) {
        supabase.removeChannel(sharedRealtimeChannel).catch(() => {})
        sharedRealtimeChannel = null
        sharedRealtimeSubscribers = 0
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('saida_calls:postgres_change', onWindowSaidaChange)
        }
      }
    }

    sharedRealtimeSubscribers += 1
    if (!sharedRealtimeChannel) {
      try {
        sharedRealtimeChannel = supabase.channel('saida_calls_popover_room')
        sharedRealtimeChannel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'saida_calls' },
            handleSaidaPostgresPayload
          )
          .on(
            'broadcast',
            { event: 'SPECIAL_AUTH_NOTIFY' },
            (payload: any) => {
              const d = payload?.payload?.data || payload?.data
              const incomingId = d?.id || d?.callId
              if (incomingId) {
                updateSharedSaidaCalls(prev => {
                  const idx = prev.findIndex(c => c.id === incomingId)
                  const newEntry = { ...d, id: incomingId, status: 'special_auth' }
                  if (idx >= 0) {
                    const next = [...prev]
                    next[idx] = { ...next[idx], ...newEntry }
                    return next
                  }
                  return [newEntry, ...prev]
                })
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.warn('[NotificationPopover] Erro ao subscrever canal Realtime:', err)
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('saida_calls:postgres_change', onWindowSaidaChange)
      }
      sharedRealtimeSubscribers = Math.max(0, sharedRealtimeSubscribers - 1)
      if (sharedRealtimeSubscribers === 0 && sharedRealtimeChannel) {
        supabase.removeChannel(sharedRealtimeChannel).catch(() => {})
        sharedRealtimeChannel = null
      }
    }
  }, [hydrated, currentUser, isColab, pathname])

  const myName = (currentUser?.nome || '').trim().toLowerCase()
  const myId = String(currentUser?.id || '').trim()
  const mySystemUserId = String(currentUser?.system_user_id || '').trim()
  const myColabId = String(currentUser?.colaborador_id || '').trim()
  const myEmail = (currentUser?.email || '').trim().toLowerCase()

  // Turmas vinculadas ao colaborador logado
  const myTurmaSet = useMemo(() => {
    const set = new Set<string>()
    if (!currentUser) return set

    ;(turmas || []).forEach((t: any) => {
      const profName = (t.professor || '').toLowerCase().trim()
      const tNome = (t.nome || '').toLowerCase().trim()
      const tCodigo = String(t.codigo || '').toLowerCase().trim()
      const tId = String(t.id || '').toLowerCase().trim()

      const isProfOfTurma = profName && (
        profName === myName ||
        profName.includes(myName) ||
        myName.includes(profName)
      )

      let isDisciplinaProf = false
      if (Array.isArray(t.disciplinas)) {
        isDisciplinaProf = t.disciplinas.some((d: any) => {
          const dProf = (d.professor || '').toLowerCase().trim()
          return dProf && (dProf === myName || dProf.includes(myName) || myName.includes(dProf))
        })
      }

      let isDadosColab = false
      const dadosColabs: string[] = [
        ...(Array.isArray(t.dados?.colaboradoresIds) ? t.dados.colaboradoresIds : []),
        ...(Array.isArray(t.dados?.professores) ? t.dados.professores : []),
      ].map(String)
      if (dadosColabs.length > 0) {
        isDadosColab = dadosColabs.includes(myId) ||
          (Boolean(myColabId) && dadosColabs.includes(myColabId)) ||
          (Boolean(mySystemUserId) && dadosColabs.includes(mySystemUserId))
      }

      if (isProfOfTurma || isDisciplinaProf || isDadosColab) {
        if (tNome) set.add(tNome)
        if (tCodigo) set.add(tCodigo)
        if (tId) set.add(tId)
      }
    })
    return set
  }, [turmas, currentUser, myName, myId, myColabId, mySystemUserId])

  // ── Controle Persistente de Notificações Lidas (Isolado por Usuário) ────────
  const [markedRead, setMarkedRead] = useState<string[]>([])

  const isItemRead = useCallback((id: string, rawId?: string) => {
    return markedRead.includes(id) || (Boolean(rawId) && markedRead.includes(rawId!))
  }, [markedRead])

  useEffect(() => {
    if (!currentUser?.id || !isColab) {
      setMarkedRead([])
      return
    }

    const userId = currentUser.id
    // 1. Carregamento imediato do cache local (sem delay ou flicker ao navegar)
    try {
      const cached = localStorage.getItem(`edu_notif_read_${userId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) {
          setMarkedRead(parsed)
        }
      }
    } catch {}

    // 2. Sincronização resiliente com o banco de dados Supabase (deduplicada entre instâncias)
    let isMounted = true
    const sysId = currentUser.system_user_id || ''
    const colabId = currentUser.colaborador_id || ''
    const cacheKey = `${userId}_${sysId}_${colabId}`
    const now = Date.now()
    const cachedReads = sharedReadsCache.get(cacheKey)

    let readsPromise: Promise<string[]>
    if (cachedReads && now - cachedReads.timestamp < 30000) {
      readsPromise = Promise.resolve(cachedReads.reads)
    } else if (sharedReadsInflight.has(cacheKey)) {
      readsPromise = sharedReadsInflight.get(cacheKey)!
    } else {
      const params = new URLSearchParams({
        userId,
        systemUserId: sysId,
        colaboradorId: colabId,
      })
      const p = apiFetch(`/api/agenda/notificacoes/reads?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      })
        .then(res => res.json())
        .then(data => {
          const arr = Array.isArray(data?.reads) ? data.reads : []
          sharedReadsCache.set(cacheKey, { reads: arr, timestamp: Date.now() })
          return arr
        })
        .catch(err => {
          console.warn('[NotificationPopover] Erro ao sincronizar leituras com servidor:', err)
          return [] as string[]
        })
        .finally(() => {
          sharedReadsInflight.delete(cacheKey)
        })
      sharedReadsInflight.set(cacheKey, p)
      readsPromise = p
    }

    readsPromise.then(serverReads => {
      if (!isMounted || !Array.isArray(serverReads) || serverReads.length === 0) return
      setMarkedRead(prev => {
        const merged = Array.from(new Set([...prev, ...serverReads]))
        try {
          localStorage.setItem(`edu_notif_read_${userId}`, JSON.stringify(merged))
        } catch {}
        return merged
      })
    })

    // 3. Listener para sincronização instantânea entre abas e componentes da interface
    const handleSync = (e: any) => {
      if (e?.detail?.userId === userId && Array.isArray(e?.detail?.readIds)) {
        setMarkedRead(e.detail.readIds)
      }
    }
    window.addEventListener('edu:notif-read-sync', handleSync)

    return () => {
      isMounted = false
      window.removeEventListener('edu:notif-read-sync', handleSync)
    }
  }, [currentUser?.id, currentUser?.system_user_id, currentUser?.colaborador_id, isColab])

  // ── Derive notifications filtradas estritamente para o Colaborador Individual ─
  const notifications = useMemo(() => {
    // Apenas colaboradores individuais têm acesso às notificações de gestão escolar
    if (!currentUser || !isColab) return []

    const list: any[] = []
    const now = new Date()
    const fiveDaysAgo = subDays(now, 5)

    // 1. Pendentes Tarefas — Apenas tarefas atribuídas ao colaborador ou criadas por ele
    tarefas
      .filter(t => t.status === 'pendente')
      .filter(t => {
        const resp = (t.responsavel || '').trim().toLowerCase()
        const criadoPor = (t.criado_por || '').trim().toLowerCase()
        const usuarioId = String((t as any).usuario_id || (t as any).responsavel_id || '').trim()

        const isAssignedToMe =
          (resp && (resp === myName || resp === myId || (myEmail && resp === myEmail))) ||
          (usuarioId && (usuarioId === myId || usuarioId === myColabId || usuarioId === mySystemUserId))
        const isCreatedByMe =
          criadoPor && (criadoPor === myName || criadoPor === myId)

        return isAssignedToMe || isCreatedByMe
      })
      .forEach(t => {
        list.push({
          id: `tarefa-${t.id}`,
          rawId: String(t.id),
          type: 'tarefa',
          title: t.titulo,
          subtitle: t.responsavel || 'Para você',
          date: t.prazo ? new Date(t.prazo) : new Date(),
          icon: <ClipboardCheck size={16} color="#3b82f6" />,
          bg: '#eff6ff',
          link: '/tarefas'
        })
      })

    // 2. Novos Eventos do Calendário — Relevantes para a atuação do colaborador
    eventosAgenda.forEach(e => {
      const eDate = new Date(e.data)
      if (!isAfter(eDate, subDays(now, 1)) || isAfter(eDate, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))) {
        return
      }

      const eTurmas: string[] = Array.isArray(e.turmas) ? e.turmas.map(String) : []
      const eTurmasLower = eTurmas.map(t => t.trim().toLowerCase())

      // Evento geral (sem restrição de turma ou institucional/feriado)
      const isGeneralEvent =
        eTurmas.length === 0 ||
        eTurmasLower.some(t => t === 'todos' || t === 'toda a escola' || t === 'geral' || t === 'institucional' || t.includes('feriado'))

      const isCreator = e.criadoPor && (e.criadoPor.trim().toLowerCase() === myName || e.criadoPor === myId)

      const isConfirmedParticipant = Array.isArray(e.confirmados) && (
        e.confirmados.includes(myId) || e.confirmados.includes(myName)
      )

      // Gestão vê eventos de Direção, Coordenação ou gerais
      const matchesManagement = isManagement && (
        isGeneralEvent ||
        eTurmasLower.some(t => t.includes('direção') || t.includes('direcao') || t.includes('coordena') || t.includes('admin'))
      )

      // Professor vê eventos das suas turmas ou de docentes
      const matchesTeacherTurma = eTurmasLower.some(t => 
        myTurmaSet.has(t) || t.includes('professores') || t.includes('docentes') || t.includes('pedagóg') || t.includes('pedagog')
      )

      if (isGeneralEvent || isCreator || isConfirmedParticipant || matchesManagement || matchesTeacherTurma) {
        list.push({
          id: `evento-${e.id}`,
          rawId: String(e.id),
          type: 'agenda',
          title: e.titulo,
          subtitle: format(eDate, "dd 'de' MMM", { locale: ptBR }),
          date: eDate,
          icon: <CalendarIcon size={16} color="#f59e0b" />,
          bg: '#fffbeb',
          link: '/calendario'
        })
      }
    })

    // 3. Ocorrências recentes — Do colaborador, de suas turmas ou institucionais (Gestão)
    ocorrencias.forEach((o: any) => {
      const dateStr = o.created_at || o.data || o.data_registro
      const oDate = dateStr ? new Date(dateStr) : new Date()
      if (!isAfter(oDate, fiveDaysAgo)) return

      const oResp = (o.responsavel || o.professor || o.criado_por || '').trim().toLowerCase()
      const oTurma = (o.turma || o.turmaNome || '').trim().toLowerCase()

      const isMine = oResp === myName || oResp === myId
      const isMyClass = Boolean(oTurma && myTurmaSet.has(oTurma))
      const isRelevant = isMine || isMyClass || isManagement

      if (isRelevant) {
        list.push({
          id: `ocorr-${o.id}`,
          rawId: String(o.id),
          type: 'ocorrencia',
          title: o.tipo || o.tipo_id || 'Nova Ocorrência',
          subtitle: o.alunoNome || o.aluno_nome || 'Aluno',
          date: oDate,
          icon: <ShieldAlert size={16} color="#ef4444" />,
          bg: '#fef2f2',
          link: '/academico/ocorrencias'
        })
      }
    })

    // 4. Comunicados recentes — Apenas de equipe, turmas do colaborador ou gerais (NUNCA relatório individual de aluno)
    comunicados.forEach(c => {
      const cId = String(c.id || '')
      // Ignora terminantemente relatórios individuais de alunos (AD-COM-REL-STU-)
      if (cId.startsWith('AD-COM-REL-STU-') || c.tipoRelatorio === 'individual' || c.dados?.tipoRelatorio === 'individual') {
        return
      }

      const cDate = c.created_at ? new Date(c.created_at) : new Date()
      if (!isAfter(cDate, fiveDaysAgo)) return

      const destino = String(c.dados?.destino || c.destino || '').trim().toLowerCase()
      const isGeral = destino === 'todos' || destino === 'toda a escola' || destino === 'interno' || destino === 'todas'

      const colabIds: string[] = [
        ...(c.dados?.colaboradoresIds || []),
        ...(c.colaboradoresIds || []),
        ...(c.dados?.destinatarios || []),
        ...(c.destinatarios || []),
        ...(c.dados?.funcionariosIds || []),
        ...(c.funcionariosIds || [])
      ].map(String)

      const isDirectTarget =
        colabIds.includes(myId) ||
        (Boolean(myColabId) && colabIds.includes(myColabId)) ||
        (Boolean(mySystemUserId) && colabIds.includes(mySystemUserId)) ||
        (Boolean(myEmail) && colabIds.includes(myEmail))

      const isAuthor =
        (c.autor && c.autor.trim().toLowerCase() === myName) ||
        (c.dados?.autorId && (c.dados.autorId === myId || c.dados.autorId === mySystemUserId))

      const cTurmas: string[] = [
        ...(Array.isArray(c.dados?.turmas) ? c.dados.turmas : []),
        ...(Array.isArray(c.turmas) ? c.turmas : []),
        ...(c.turma ? [c.turma] : [])
      ].map(t => String(t).trim().toLowerCase())

      const matchesTurma = cTurmas.some(tName => myTurmaSet.has(tName))
      const isRelevant = isGeral || isDirectTarget || isAuthor || matchesTurma || isManagement

      if (isRelevant) {
        const link = isManagement
          ? '/agenda-digital/admin/comunicados'
          : '/agenda-digital/colaborador/comunicados'

        list.push({
          id: `comun-${c.id}`,
          rawId: String(c.id),
          type: 'comunicado',
          title: c.titulo || 'Novo Comunicado',
          subtitle: c.turma || (isGeral ? 'Geral' : 'Agenda Digital'),
          date: cDate,
          icon: <Megaphone size={16} color="#8b5cf6" />,
          bg: '#f5f3ff',
          link
        })
      }
    })

    // 5. Autorizações Especiais do Dia (Portaria)
    const confirmedMap = new Map<string, any>()
    ;(saidaCalls || []).forEach((ac: any) => {
      if (ac.status === 'confirmed') {
        if (ac.studentId) confirmedMap.set(String(ac.studentId).trim(), ac)
        if (ac.studentName) confirmedMap.set(ac.studentName.trim().toLowerCase(), ac)
      }
    })

    const specialAuthEntries = (saidaCalls || []).filter((c: any) => {
      if (c.status === 'special_auth') return true
      if (c.guardianId === 'special' || c.guardianId === 'special-auth') return true
      return false
    })

    specialAuthEntries.forEach((c: any) => {
      const targetUserIds = Array.isArray(c.targetUserIds)
        ? c.targetUserIds.map(String)
        : (Array.isArray(c.dados?.targetUserIds) ? c.dados.targetUserIds.map(String) : [])

      const isTargeted =
        targetUserIds.length === 0 ||
        targetUserIds.includes(myId) ||
        (Boolean(mySystemUserId) && targetUserIds.includes(mySystemUserId)) ||
        (Boolean(myColabId) && targetUserIds.includes(myColabId)) ||
        isAdmin

      if (!isTargeted) return

      const sId = c.studentId ? String(c.studentId).trim() : ''
      const sName = c.studentName ? c.studentName.trim().toLowerCase() : ''
      const confirmedCall = (sId ? confirmedMap.get(sId) : null) || (sName ? confirmedMap.get(sName) : null)
      const isConfirmed = !!c.confirmedOut || !!confirmedCall
      const confirmedAtRaw = c.confirmedAt || confirmedCall?.confirmedAt || confirmedCall?.calledAt

      let confirmedTimeStr = ''
      if (confirmedAtRaw) {
        try {
          const dConf = new Date(confirmedAtRaw)
          confirmedTimeStr = !isNaN(dConf.getTime())
            ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' }).format(dConf)
            : String(confirmedAtRaw).slice(11, 16)
        } catch {
          confirmedTimeStr = String(confirmedAtRaw).slice(11, 16)
        }
      }

      let targetTimeStr = ''
      const rawTargetTime = c.targetTime || c.target_time || c.dados?.targetTime || c.horarioPrevisto || null
      if (rawTargetTime && rawTargetTime !== 'Indefinido') {
        targetTimeStr = ` às ${rawTargetTime}`
      }

      let subtitle = ''
      if (isConfirmed && confirmedTimeStr) {
        subtitle = `Saída confirmada às ${confirmedTimeStr} · Liberado para ${c.guardianName || 'Responsável'}`
      } else {
        subtitle = `Liberado para ${c.guardianName || 'Responsável'}${targetTimeStr}${c.studentClass ? ` · ${c.studentClass}` : ''}`
      }

      const cDate = c.calledAt ? new Date(c.calledAt) : new Date()

      list.push({
        id: `spec-auth-${c.id}`,
        rawId: String(c.id),
        type: 'autorizacao',
        title: `Autorização Especial: ${c.studentName || 'Aluno'}`,
        subtitle,
        date: cDate,
        photo: c.studentPhoto || null,
        isConfirmed,
        targetTime: rawTargetTime,
        operatorName: c.operatorId || null,
        icon: <UserCheck size={16} color={isConfirmed ? "#10b981" : "#d97706"} />,
        bg: isConfirmed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.14)',
        link: '/saida-alunos/chamadas'
      })
    })

      // Ordenação decrescente por data e deduplicação por id para evitar keys duplicadas no React
      const uniqueIds = new Set<string>()
      return list
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter(item => {
          if (uniqueIds.has(item.id)) return false
          uniqueIds.add(item.id)
          return true
        })
  }, [
    tarefas,
    eventosAgenda,
    ocorrencias,
    comunicados,
    saidaCalls,
    currentUser,
    isColab,
    isAdmin,
    isManagement,
    myName,
    myId,
    mySystemUserId,
    myColabId,
    myEmail,
    myTurmaSet
  ])

  // Contagem de pendentes não lidas
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !isItemRead(n.id, n.rawId)).length
  }, [notifications, isItemRead])

  // Marcar item individual como lido
  const markItemAsRead = useCallback((item: { id: string; rawId?: string; type: string }) => {
    if (!currentUser?.id) return
    if (isItemRead(item.id, item.rawId)) return

    const userId = currentUser.id
    const toAdd = [item.id, item.rawId].filter(Boolean) as string[]
    const updated = Array.from(new Set([...markedRead, ...toAdd]))
    setMarkedRead(updated)

    try {
      localStorage.setItem(`edu_notif_read_${userId}`, JSON.stringify(updated))
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent('edu:notif-read-sync', {
        detail: { userId, readIds: updated }
      }))
    } catch {}

    fetch('/api/agenda/notificacoes/reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        systemUserId: currentUser.system_user_id,
        colaboradorId: currentUser.colaborador_id,
        perfil: currentUser.perfil || 'colaborador',
        items: [{ id: item.id, rawId: item.rawId, type: item.type }]
      })
    }).catch(err => console.warn('[NotificationPopover] Falha ao persistir leitura:', err))
  }, [currentUser, markedRead, isItemRead])

  // Marcar todas como lidas (do usuário atual)
  const markAllAsRead = useCallback(() => {
    if (!currentUser?.id) return
    const unreadItems = notifications.filter(n => !isItemRead(n.id, n.rawId))
    if (unreadItems.length === 0) return

    const userId = currentUser.id
    const toAdd = unreadItems.flatMap(n => [n.id, n.rawId]).filter(Boolean) as string[]
    const updated = Array.from(new Set([...markedRead, ...toAdd]))
    setMarkedRead(updated)

    try {
      localStorage.setItem(`edu_notif_read_${userId}`, JSON.stringify(updated))
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent('edu:notif-read-sync', {
        detail: { userId, readIds: updated }
      }))
    } catch {}

    fetch('/api/agenda/notificacoes/reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        systemUserId: currentUser.system_user_id,
        colaboradorId: currentUser.colaborador_id,
        perfil: currentUser.perfil || 'colaborador',
        items: unreadItems.map(n => ({ id: n.id, rawId: n.rawId, type: n.type }))
      })
    }).catch(err => console.warn('[NotificationPopover] Falha ao persistir marcar todas:', err))
  }, [currentUser, notifications, markedRead, isItemRead])

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    return n.type === activeTab
  })

  const now = new Date()

  // Se não estiver hidratado ou o usuário logado não for colaborador, não exibe as notificações de gestão
  if (!hydrated) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={17} color="rgba(255,255,255,0.4)" />
      </div>
    )
  }

  if (!currentUser || !isColab) {
    return null
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <motion.button
          whileHover={{ background: 'rgba(255,255,255,0.15)', scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{ width: 32, height: 32, borderRadius: 10, background: open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
        >
          <Bell size={17} color="white" />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 9,
                height: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <motion.span
                animate={{
                  scale: [1, 2.5],
                  opacity: [0.85, 0]
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeOut'
                }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#ef4444'
                }}
              />
              <motion.span
                initial={{ scale: 0 }}
                animate={{
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    '0 0 6px rgba(239, 68, 68, 0.85)',
                    '0 0 14px rgba(239, 68, 68, 1)',
                    '0 0 6px rgba(239, 68, 68, 0.85)'
                  ]
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                style={{
                  position: 'relative',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '1.5px solid #0f172a'
                }}
              />
            </span>
          )}
        </motion.button>
      </Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset}>
              <motion.div
                className="notification-popover-content"
                initial={{ opacity: 0, y: side === 'top' ? 100 : -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: side === 'top' ? 100 : -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                  width: 'min(410px, calc(100vw - 20px))',
                  maxHeight: '80vh',
                  background: 'rgba(2, 6, 23, 0.88)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 24,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 9999,
                  color: '#ffffff',
                  transformOrigin: side === 'top' ? 'bottom center' : 'top right'
                }}
              >
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                      <Bell size={18} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }}>Notificações</div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{unreadCount} pendente{unreadCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 20 }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(96,165,250,0.1)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      Marcar Lidas
                    </button>
                  )}
                </div>

                {/* Tabs — Botões em grid 3x2 lado a lado e embaixo, sem scroll lateral */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  padding: '12px 18px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  background: 'rgba(255, 255, 255, 0.015)'
                }}>
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'autorizacao', label: 'Autorizações' },
                    { id: 'comunicado', label: 'Comunicados' },
                    { id: 'agenda', label: 'Agenda' },
                    { id: 'tarefa', label: 'Tarefas' },
                    { id: 'ocorrencia', label: 'Ocorrências' }
                  ].map(tab => {
                    const count = tab.id === 'all'
                      ? unreadCount
                      : notifications.filter(n => n.type === tab.id && !isItemRead(n.id, n.rawId)).length
                    const isActive = activeTab === tab.id

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                          padding: '7px 4px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 500,
                          border: isActive
                            ? '1px solid rgba(96, 165, 250, 0.45)'
                            : '1px solid rgba(255, 255, 255, 0.07)',
                          cursor: 'pointer',
                          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.18) 100%)'
                            : 'rgba(255, 255, 255, 0.035)',
                          color: isActive ? '#93c5fd' : 'rgba(255, 255, 255, 0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          boxShadow: isActive ? '0 2px 10px rgba(59, 130, 246, 0.25)' : 'none',
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                        onMouseOver={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                            e.currentTarget.style.color = '#ffffff'
                          }
                        }}
                        onMouseOut={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)'
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
                          }
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.label}</span>
                        {count > 0 && (
                          <span style={{
                            fontSize: 10,
                            minWidth: 16,
                            height: 16,
                            padding: '0 4px',
                            borderRadius: 8,
                            background: isActive ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)',
                            color: '#fff',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                            flexShrink: 0
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* List */}
                <div style={{ padding: '8px 16px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredNotifications.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={24} color="rgba(255,255,255,0.2)" />
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 700 }}>Tudo em dia!</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Nenhuma notificação nova por aqui.</div>
                      </div>
                    </div>
                  ) : (
                    filteredNotifications.slice(0, activeTab === 'all' ? 15 : 30).map((item, i) => {
                      const isRead = isItemRead(item.id, item.rawId)
                      return (
                        <motion.a
                          href={item.link}
                          key={item.id}
                          onClick={() => {
                            if (!isRead) {
                              markItemAsRead(item)
                            }
                          }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '12px 16px',
                            borderRadius: 16,
                            background: isRead ? 'transparent' : 'rgba(255,255,255,0.02)',
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                            position: 'relative'
                          }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseOut={e => e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(255,255,255,0.02)'}
                        >
                          {!isRead && (
                            <div style={{ position: 'absolute', left: 4, top: '50%', marginTop: -3, width: 6, height: 6, borderRadius: 3, background: item.type === 'autorizacao' ? '#f59e0b' : '#3b82f6' }} />
                          )}
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {item.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.photo} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              item.icon
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: isRead ? 'rgba(255,255,255,0.6)' : 'white', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.subtitle}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                <Clock size={10} />
                                {isSameDay(item.date, now) ? format(item.date, 'HH:mm') : format(item.date, 'dd MMM', { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </motion.a>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  )
}
