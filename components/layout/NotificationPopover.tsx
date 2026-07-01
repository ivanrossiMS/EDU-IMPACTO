'use client'

import { useState, useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Calendar as CalendarIcon, ClipboardCheck, ShieldAlert, Megaphone, CheckCircle2, Clock, X } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { format, isAfter, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const [markedRead, setMarkedRead] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'tarefas' | 'agenda' | 'ocorrencias' | 'comunicado'>('all')

  const { tarefas = [], eventosAgenda = [], ocorrencias = [] } = useData()
  const { currentUser } = require('@/lib/context').useApp()
  // Ensure we fetch recent ones by ordering desc
  const [comunicados] = useSupabaseArray<any>('comunicados?order=created_at.desc&limit=10')

  // Derive notifications
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
      // Show events happening from today until 7 days in future
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
    ocorrencias.forEach(o => {
      const dateStr = o.created_at || o.data || o.data_registro;
      const oDate = dateStr ? new Date(dateStr) : new Date();
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
        const isAdmin = currentUser?.perfil === 'Admin' || currentUser?.perfil === 'Diretor';
        const link = isAdmin 
          ? '/agenda-digital/admin/comunicados' 
          : currentUser?.id 
            ? `/agenda-digital/colaborador/comunicados` 
            : '/agenda-digital/comunicados';

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

    // Sort by date desc
    return list.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [tarefas, eventosAgenda, ocorrencias, comunicados, currentUser])

  const unreadCount = notifications.filter(n => !markedRead.includes(n.id)).length

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    return n.type === activeTab
  })

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
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                  width: 380,
                  maxHeight: '80vh',
                  background: 'rgba(2, 6, 23, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 24,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 9999,
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
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Notificações</h3>
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

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, padding: '16px 20px 8px', justifyContent: 'center' }}>
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'comunicado', label: 'Comunicados' },
                    { id: 'agenda', label: 'Agenda' },
                    { id: 'tarefa', label: 'Tarefas' },
                    { id: 'ocorrencia', label: 'Ocorrências' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                        background: activeTab === tab.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                        color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
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
                    filteredNotifications.slice(0, 6).map((item, i) => {
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
                          transition={{ delay: i * 0.05 }}
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
                            <div style={{ position: 'absolute', left: 4, top: '50%', marginTop: -3, width: 6, height: 6, borderRadius: 3, background: '#3b82f6' }} />
                          )}
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: isRead ? 'rgba(255,255,255,0.6)' : 'white', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.subtitle}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                <Clock size={10} />
                                {format(item.date, "dd MMM", { locale: ptBR })}
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
