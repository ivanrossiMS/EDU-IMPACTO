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
import { format, isAfter, subDays, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const [markedRead, setMarkedRead] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'tarefas' | 'agenda' | 'ocorrencias' | 'comunicado' | 'autorizacao'>('all')

  const dataContext = useData()
  const tarefas = dataContext?.tarefas || []
  const eventosAgenda = dataContext?.eventosAgenda || []
  const ocorrencias = dataContext?.ocorrencias || []
  const { currentUser } = useApp()
  const pathname = usePathname()
  const { on: onRealtime } = useBroadcastRealtime()

  // Comunicados recentes
  const [comunicados] = useSupabaseArray<any>('comunicados?order=created_at.desc&limit=10')

  // ── Sincronização em tempo real das Autorizações Especiais do Dia ────────────
  const [saidaCalls, setSaidaCalls] = useState<any[]>([])

  const fetchSpecialAuths = useCallback(async () => {
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date())
      const res = await fetch(`/api/saida/calls?date=${todayStr}&_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        cache: 'no-store'
      })
      if (!res.ok) return
      const data = await res.json()
      const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
      setSaidaCalls(arr)
    } catch (err) {
      console.warn('[NotificationPopover] Falha ao sincronizar autorizações da portaria:', err)
    }
  }, [])

  // 1. Carga inicial e a cada mudança de rota
  useEffect(() => {
    fetchSpecialAuths()
  }, [fetchSpecialAuths, pathname])

  // 2. Revalidação imediata sempre que o usuário abre o popover
  useEffect(() => {
    if (open) {
      fetchSpecialAuths()
    }
  }, [open, fetchSpecialAuths])

  // 3. Polling em segundo plano a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSpecialAuths()
    }, 30000)
    return () => clearInterval(timer)
  }, [fetchSpecialAuths])

  // 4. Escuta de eventos em tempo real locais/BroadcastChannel (chamadas e autorizações instantâneas)
  useEffect(() => {
    const unsub = onRealtime('*', payload => {
      const d = payload.data as any
      if ((payload.event === 'CALL_STUDENT' && d?.status === 'special_auth') || payload.event === 'SPECIAL_AUTH_NOTIFY') {
        const incomingId = d?.id || d?.callId
        if (incomingId) {
          setSaidaCalls(prev => {
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
        setSaidaCalls(prev => {
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
          setSaidaCalls(prev => prev.filter(c => c.id !== d.callId))
        }
      }
    })
    return () => { unsub() }
  }, [onRealtime])

  // 5. Escuta de eventos Realtime via Supabase (entre dispositivos diferentes conectados)
  useEffect(() => {
    let channel: any = null
    try {
      const channelName = `saida_popover_${Math.random().toString(36).substring(2, 8)}`
      channel = supabase.channel(channelName)

      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'saida_calls' },
          (payload: any) => {
            const { eventType, new: newRow, old: oldRow } = payload
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
              let rawDados = newRow?.dados || {}
              if (typeof rawDados === 'string') {
                try { rawDados = JSON.parse(rawDados) } catch (e) {}
              }
              if (rawDados.status === 'special_auth') {
                const call = { id: newRow.id, ...rawDados }
                setSaidaCalls(prev => {
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
                  setSaidaCalls(prev => prev.map(c => {
                    if (c.studentId && String(c.studentId).trim() === sId) {
                      return { ...c, confirmedOut: true, confirmedAt: rawDados.confirmedAt || rawDados.calledAt || new Date().toISOString() }
                    }
                    return c
                  }))
                }
              }
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setSaidaCalls(prev => prev.filter(c => c.id !== oldRow.id))
            }
          }
        )
        .on(
          'broadcast',
          { event: 'SPECIAL_AUTH_NOTIFY' },
          (payload: any) => {
            const d = payload?.payload?.data || payload?.data
            const incomingId = d?.id || d?.callId
            if (incomingId) {
              setSaidaCalls(prev => {
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

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  // ── Derive notifications ──────────────────────────────────────────────────
  const notifications = useMemo(() => {
    const list: any[] = []
    const now = new Date()
    const fiveDaysAgo = subDays(now, 5)

    // 1. Pendentes Tarefas
    tarefas.filter(t => t.status === 'pendente').forEach(t => {
      list.push({
        id: `tarefa-${t.id}`,
        type: 'tarefa',
        title: t.titulo,
        subtitle: t.responsavel || 'Para você',
        date: t.prazo ? new Date(t.prazo) : new Date(),
        icon: <ClipboardCheck size={16} color="#3b82f6" />,
        bg: '#eff6ff',
        link: '/tarefas'
      })
    })

    // 2. Novos Eventos do Calendário (criados ou que vão acontecer em breve)
    eventosAgenda.forEach(e => {
      const eDate = new Date(e.data)
      if (isAfter(eDate, subDays(now, 1)) && !isAfter(eDate, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))) {
        list.push({
          id: `evento-${e.id}`,
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

    // 3. Ocorrências recentes (últimos 5 dias)
    ocorrencias.forEach((o: any) => {
      const dateStr = o.created_at || o.data || o.data_registro
      const oDate = dateStr ? new Date(dateStr) : new Date()
      if (isAfter(oDate, fiveDaysAgo)) {
        list.push({
          id: `ocorr-${o.id}`,
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

    // 4. Comunicados recentes
    comunicados.forEach(c => {
      const cDate = c.created_at ? new Date(c.created_at) : new Date()
      if (isAfter(cDate, fiveDaysAgo)) {
        const isAdmin = currentUser?.perfil === 'Admin' || currentUser?.perfil === 'Diretor'
        const link = isAdmin
          ? '/agenda-digital/admin/comunicados'
          : currentUser?.id
            ? `/agenda-digital/colaborador/comunicados`
            : '/agenda-digital/comunicados'

        list.push({
          id: `comun-${c.id}`,
          type: 'comunicado',
          title: c.titulo || 'Novo Comunicado',
          subtitle: c.turma || 'Agenda Digital',
          date: cDate,
          icon: <Megaphone size={16} color="#8b5cf6" />,
          bg: '#f5f3ff',
          link: link
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

      // Horário previsto da autorização
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

    // Sort by date desc
    return list.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [tarefas, eventosAgenda, ocorrencias, comunicados, saidaCalls, currentUser])

  const unreadCount = notifications.filter(n => !markedRead.includes(n.id)).length

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    return n.type === activeTab
  })

  const now = new Date()

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
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', border: '2px solid #0f172a' }}
            />
          )}
        </motion.button>
      </Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild side="top" align="start" sideOffset={12} alignOffset={-10}>
              <motion.div
                className="notification-popover-content"
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
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
                  transformOrigin: 'bottom center'
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
                      onClick={() => setMarkedRead(notifications.map(n => n.id))}
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
                      ? notifications.length
                      : notifications.filter(n => n.type === tab.id).length
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
                      const isRead = markedRead.includes(item.id)
                      return (
                        <motion.a
                          href={item.link}
                          key={item.id}
                          onClick={() => {
                            if (!isRead) {
                              setMarkedRead(prev => [...prev, item.id])
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
