'use client'

import React, { useState, useRef, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { 
  Send, Search, Users, MessageSquare, Plus, X, GraduationCap, 
  DollarSign, FileText, BookOpen, ChevronRight, ChevronLeft, 
  Building, CheckCheck, Inbox, Mail, User, HelpCircle, ArrowRight
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function ADConversasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  const [chatGroups] = useSupabaseArray<any>('agenda/grupos')
  const [chatsList, setChatsList] = useSupabaseArray<any>('agenda/chats', [], { refreshIntervalMs: 5000 })
  const [messagesArray, setMessagesArray] = useSupabaseArray<any>('agenda/mensagens', [], { refreshIntervalMs: 5000 })

  const messages = React.useMemo(() => {
    const record: Record<string, any[]> = {}
    if (messagesArray) {
      messagesArray.forEach((item: any) => {
        record[item.id] = item.messages || []
      })
    }
    return record
  }, [messagesArray])

  const setMessages = React.useCallback((updater: any) => {
    setMessagesArray((prev: any[]) => {
      const record: Record<string, any[]> = {}
      if (prev) {
        prev.forEach((item: any) => {
          record[item.id] = item.messages || []
        })
      }
      const nextRecord = typeof updater === 'function' ? updater(record) : updater
      return Object.entries(nextRecord).map(([id, msgs]) => ({ id, messages: msgs })) as any[]
    })
  }, [setMessagesArray])

  const resolvedParams = use(params as Promise<{ slug: string }>)
  const { turmas = [] } = useData()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios')
  const { currentUser } = useApp()

  const studentId = resolvedParams.slug
  const aluno = (alunos || []).find(a => a.id === studentId)
  
  const [chats, setChats] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [inputText, setInputText] = useState('')
  const [showNovaConversa, setShowNovaConversa] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // New Conversation Flow State
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedColaborador, setSelectedColaborador] = useState<any>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter chats that belong to this student
  useEffect(() => {
    const studentChats = chatsList.filter(c => String(c.id).startsWith(studentId + '-'))
    
    // Deduplicate by ID to prevent React "same key" errors from corrupted state
    const uniqueChats = []
    const seenIds = new Set()
    for (const chat of studentChats) {
      if (!seenIds.has(chat.id)) {
        seenIds.add(chat.id)
        uniqueChats.push(chat)
      }
    }
    
    // Ordena do mais novo para o mais antigo
    uniqueChats.sort((a, b) => {
      const parseDate = (d: string | undefined, t: string | undefined) => {
        if (!d || !t) return 0;
        const parts = d.split('/');
        if (parts.length !== 3) return 0;
        const [day, month, year] = parts;
        const [hour, min] = t.split(':');
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min)).getTime();
      }
      return parseDate(b.date, b.time) - parseDate(a.date, a.time);
    })
    
    setChats(uniqueChats)
    
    // Auto-select first chat if activeChat gets deleted or is not set yet (optional, let's keep it null for clean look)
    if (activeChat && !studentChats.some(c => c.id === activeChat.id)) {
      setActiveChat(null)
    }
  }, [chatsList, studentId])

  // Scroll to bottom of active message log
  const activeMessages = activeChat ? messages[activeChat.id] || [] : []
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !activeChat) return

    setMessages((prev: any) => {
      const current = prev[activeChat.id] || []
      return {
        ...prev,
        [activeChat.id]: [...current, { 
          id: Date.now(), 
          text: inputText, 
          sender: 'them', // 'them' is the parent/student in this layout
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('pt-BR'),
          author: currentUser?.nome || (currentUser?.cargo === 'Aluno' ? 'Aluno' : 'Responsável'),
          authorRole: currentUser?.cargo || 'Responsável'
        }]
      }
    })
    
    setChatsList(prev => {
      const chatIndex = prev.findIndex(c => String(c.id) === String(activeChat.id))
      if (chatIndex === -1) return prev
      
      const updatedChat = { 
        ...prev[chatIndex], 
        preview: inputText, 
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        unread: (prev[chatIndex].unread || 0) + 1
      }
      
      const newList = [...prev]
      newList.splice(chatIndex, 1)
      return [updatedChat, ...newList]
    })
    
    setInputText('')

    // Auto-reply logic for after-hours
    try {
      const now = new Date()
      const currentHourStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const { inicio = '07:00', fim = '18:00', msgAusencia = 'Olá!\nNosso horário de atendimento encerrou.' } = adConfig?.horarios || {}
      
      if (currentHourStr < inicio || currentHourStr > fim) {
        const chatId = activeChat.id;
        setTimeout(() => {
          setMessages((prev: any) => {
            const current = prev[chatId] || []
            return {
              ...prev,
              [chatId]: [...current, { 
                id: Date.now() + 10, 
                text: `⚠️ [Ausência Automática]:\n${msgAusencia}`, 
                sender: 'us', // From school
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('pt-BR'),
                author: 'Sistema Escolar',
                authorRole: 'Ausência Automática'
              }]
            }
          })
          
          setChatsList(prev => {
            const chatIndex = prev.findIndex(c => String(c.id) === String(chatId))
            if (chatIndex === -1) return prev
            
            const updatedChat = { 
              ...prev[chatIndex], 
              preview: `⚠️ [Ausência Automática]`, 
              time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              date: new Date().toLocaleDateString('pt-BR'),
              unread: (prev[chatIndex].unread || 0) + 1
            }
            
            const newList = [...prev]
            newList.splice(chatIndex, 1)
            return [updatedChat, ...newList]
          })
        }, 1200)
      }
    } catch(err) {
      console.error('Error sending auto-reply:', err)
    }
  }

  // Find student's resolved class/turma object
  const studentTurmaObj = (turmas || []).find(t => 
    aluno && (
      String(t.id) === String(aluno.turma) || 
      String(t.codigo) === String(aluno.turma) || 
      String(t.nome) === String(aluno.turma)
    )
  )

  // Filter groups that contain this student ID, match their class/turma, or are general administrative/sector groups
  const studentGroups = chatGroups?.filter(g => {
    // 1. Classroom group: explicitly contains student ID
    const inAlunosIds = g.alunosIds?.some((id: any) => String(id) === String(studentId))
    
    // 2. Classroom group: synced with student's class/turma
    const isStudentTurmaSync = studentTurmaObj && (
      String(g.id) === `sync-${studentTurmaObj.id}` || 
      String(g.id) === String(studentTurmaObj.id) ||
      g.nome === studentTurmaObj.nome
    )
    
    // 3. Administrative/Sector group: has collaborators but no student IDs, meaning it is a public channel
    const isAdministrativeSector = (!g.alunosIds || g.alunosIds.length === 0) && (g.colaboradoresIds && g.colaboradoresIds.length > 0)
    
    return inAlunosIds || isStudentTurmaSync || isAdministrativeSector
  }) || []

  const startNewConversa = () => {
    if (!selectedColaborador || !selectedGroup || !composeSubject.trim() || !composeBody.trim()) return

    // Generate a strictly unique ID for each new conversation to ensure isolation
    const newChatId = `${studentId}-${selectedGroup.id}-${selectedColaborador.id}-${Date.now()}`

    // Create new chat
    const novoChat = {
      id: newChatId,
      name: `${selectedColaborador.nome} (${selectedGroup.nome})`,
      status: 'online',
      preview: composeBody.substring(0, 30) + (composeBody.length > 30 ? '...' : ''),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR'),
      startDate: new Date().toLocaleDateString('pt-BR'),
      startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      unread: 1,
      tag: composeSubject,
      colaboradorId: selectedColaborador.id,
      grupoId: selectedGroup.id
    }

    setMessages((prev: any) => ({
      ...prev,
      [newChatId]: [{
        id: Date.now(),
        text: composeBody,
        sender: 'them',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        author: currentUser?.nome || (currentUser?.cargo === 'Aluno' ? 'Aluno' : 'Responsável'),
        authorRole: currentUser?.cargo || 'Responsável'
      }]
    }))

    // Add to top of the list
    setChatsList(prev => [novoChat, ...prev])
    setActiveChat(novoChat)

    // Reset flow states
    setShowNovaConversa(false)
    setSelectedGroup(null)
    setSelectedColaborador(null)
    setComposeSubject('')
    setComposeBody('')
  }

  // Get matching icon/color based on group name
  const getGroupStyles = (name: string) => {
    const lowercase = name.toLowerCase()
    if (lowercase.includes('finance')) {
      return { icon: <DollarSign size={22} color="#10b981" />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
    }
    if (lowercase.includes('coord') || lowercase.includes('pedag')) {
      return { icon: <GraduationCap size={22} color="#8b5cf6" />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' }
    }
    if (lowercase.includes('secret') || lowercase.includes('adm')) {
      return { icon: <FileText size={22} color="#3b82f6" />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
    }
    if (lowercase.includes('dire')) {
      return { icon: <Building size={22} color="#ec4899" />, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' }
    }
    return { icon: <BookOpen size={22} color="#f59e0b" />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
  }

  const getTagStyles = (tag: string) => {
    const text = tag.toLowerCase()
    if (text.includes('finance') || text.includes('pagament') || text.includes('boleto')) {
      return { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.15)' }
    }
    if (text.includes('secretar') || text.includes('doc') || text.includes('matricul')) {
      return { bg: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.15)' }
    }
    if (text.includes('coordenac') || text.includes('pedagog') || text.includes('atraso') || text.includes('ocorr')) {
      return { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.15)' }
    }
    if (text.includes('diretor') || text.includes('urgente')) {
      return { bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)' }
    }
    return { bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.15)' }
  }

  const filteredChats = chats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.tag && c.tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="ad-chat-container" style={{ display: 'flex', height: 'calc(100vh - 140px)', background: 'hsl(var(--bg-main))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.03)' }}>
      
      {/* Sidebar (List of Chats) */}
      <div className={`ad-chat-sidebar ${(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ width: 360, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', letterSpacing: '-0.02em' }}>Mensagens</h2>
            {adConfig?.permissoes?.chat !== false && (
              <button 
                onClick={() => { setShowNovaConversa(true); setActiveChat(null); setSelectedGroup(null); setSelectedColaborador(null); }}
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 20, 
                  padding: '8px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontSize: 13, 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', 
                  transition: 'transform 0.2s' 
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Plus size={16} /> Nova
              </button>
            )}
          </div>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Pesquisar mensagens..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 38, width: '100%', fontSize: 14, borderRadius: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', height: 42 }} 
            />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filteredChats.map(chat => {
            const isActive = activeChat?.id === chat.id
            const styles = getGroupStyles(chat.name)
            
            const chatMessages = messages[chat.id] || []
            const lastMessage = chatMessages[chatMessages.length - 1]
            const lastMessageIsMine = lastMessage ? lastMessage.sender === 'them' : false

            return (
              <div 
                key={chat.id} 
                onClick={async () => { 
                  setActiveChat(chat); 
                  setShowNovaConversa(false); 
                  if (chat.unread > 0) { 
                    setChatsList(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c)) 
                    try {
                      const { data: dbChat } = await supabase.from('agenda_chats').select('dados').eq('id', chat.id).single();
                      if (dbChat) {
                        const newDados = { ...(dbChat.dados || {}), unread: 0 };
                        await supabase.from('agenda_chats').update({ dados: newDados }).eq('id', chat.id);
                      }
                    } catch(e) {}
                  } 
                }}
                style={{ 
                  padding: '16px 14px', 
                  marginBottom: 8,
                  display: 'flex', 
                  gap: 14, 
                  cursor: 'pointer',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)' 
                    : 'transparent',
                  borderRadius: 16,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                  boxShadow: isActive ? '0 8px 24px rgba(99, 102, 241, 0.05)' : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--bg-main))' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 4, background: 'linear-gradient(to bottom, #6366f1, #a855f7)', borderRadius: '0 4px 4px 0' }} />
                )}
                <div style={{ position: 'relative' }}>
                   <div style={{ 
                     width: 48, 
                     height: 48, 
                     background: styles.color, 
                     color: 'white', 
                     borderRadius: '16px', 
                     display: 'flex', 
                     alignItems: 'center', 
                     justifyContent: 'center', 
                     fontWeight: 800, 
                     fontSize: 16, 
                     boxShadow: isActive ? `0 0 0 3px ${styles.color}20, 0 8px 20px ${styles.color}40` : 'none', 
                     transition: 'all 0.3s' 
                   }}>
                     {getInitials(chat.name.split(' (')[0])}
                   </div>
                   <div style={{ 
                     width: 12, 
                     height: 12, 
                     background: '#10b981', 
                     border: '2px solid hsl(var(--bg-surface))', 
                     borderRadius: '50%', 
                     position: 'absolute', 
                     bottom: -2, 
                     right: -2,
                     boxShadow: '0 2px 4px rgba(16,185,129,0.3)'
                   }}></div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: isActive ? 800 : 700, fontSize: 14, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.tag || 'Conversa sem assunto'}</div>
                    <div style={{ fontSize: 11, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', fontWeight: isActive ? 600 : 500 }}>{chat.time}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {lastMessageIsMine && (
                        chat.unread === 0 
                          ? <CheckCheck size={14} color="#6366f1" style={{ flexShrink: 0 }} /> 
                          : <CheckCheck size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                      )}
                      <div style={{ fontSize: 13, color: isActive ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.preview}
                      </div>
                    </div>
                    {(() => {
                      const msgs = messages[chat.id] || []
                      if (msgs.length === 0) return chat.unread > 0 ? (
                        <div className="badge-pulse-modern" style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                          {chat.unread}
                        </div>
                      ) : null
                      const lastMsg = msgs[msgs.length - 1]
                      if (lastMsg.sender === 'us' && chat.unread > 0) {
                        return (
                          <div className="badge-pulse-modern" style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                            {chat.unread}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  {(() => {
                    const tagStyles = getTagStyles(chat.tag || 'geral')
                    return (
                      <div style={{ 
                        fontSize: 10, 
                        color: tagStyles.color, 
                        background: tagStyles.bg, 
                        border: tagStyles.border,
                        padding: '2px 8px', 
                        borderRadius: 8, 
                        alignSelf: 'flex-start', 
                        marginTop: 6, 
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {chat.name}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
          {filteredChats.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
              <Inbox size={36} style={{ opacity: 0.2, margin: '0 auto 12px auto' }} />
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Main Area (New Chat Flow or Active Message Log) */}
      <div className={`ad-chat-main ${!(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-main))', position: 'relative', width: '100%' }}>
          
          {showNovaConversa ? (
            <div className="ad-nova-conversa-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 60px', overflowY: 'auto' }}>
              <div className="ad-nova-conversa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
                <div>
                  <div className="ad-nova-conversa-titlebox" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <button className="mobile-back-btn" onClick={() => { setShowNovaConversa(false); setSelectedGroup(null); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                      <ChevronLeft size={24} />
                    </button>
                    {(selectedGroup || selectedColaborador) && (
                      <button 
                        onClick={() => {
                          if (selectedColaborador) {
                            setSelectedColaborador(null)
                          } else {
                            setSelectedGroup(null)
                          }
                        }} 
                        style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', margin: 0, letterSpacing: '-0.02em' }}>Nova Conversa Oficial</h2>
                  </div>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, maxWidth: 500, margin: 0 }}>
                    {selectedColaborador 
                      ? `Escreva um e-mail formal para ${selectedColaborador.nome} (${selectedGroup.nome})`
                      : selectedGroup 
                        ? `Selecione um profissional do setor: ${selectedGroup.nome}` 
                        : 'Selecione o setor de atendimento com o qual deseja falar.'}
                  </p>
                </div>
                <button onClick={() => { setShowNovaConversa(false); setSelectedGroup(null); setSelectedColaborador(null); }} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Step 1: Select Group */}
              {!selectedGroup && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {studentGroups.map(grupo => {
                    const styles = getGroupStyles(grupo.nome)
                    const totalColaboradores = (sysUsers || []).filter(u => grupo.colaboradoresIds?.includes(u.id)).length
                    return (
                      <div 
                        key={grupo.id} 
                        onClick={() => setSelectedGroup(grupo)} 
                        style={{ 
                          background: 'hsl(var(--bg-surface))', 
                          border: '1px solid hsl(var(--border-subtle))', 
                          borderRadius: 20, 
                          padding: 24, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          gap: 16, 
                          alignItems: 'center', 
                          boxShadow: '0 4px 16px rgba(0,0,0,0.01)', 
                          transition: 'all 0.2s' 
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = styles.color
                          e.currentTarget.style.transform = 'translateY(-4px)'
                          e.currentTarget.style.boxShadow = `0 12px 24px ${styles.color}15`
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.01)'
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: styles.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {styles.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 2 }}>{grupo.nome}</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{totalColaboradores} Atendentes vinculados</div>
                        </div>
                        <ChevronRight size={18} color="hsl(var(--text-muted))" style={{ opacity: 0.5 }} />
                      </div>
                    )
                  })}
                  {studentGroups.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                       <HelpCircle size={48} style={{ color: 'hsl(var(--text-muted))', opacity: 0.3, marginBottom: 16 }} />
                       <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sem grupos vinculados</h3>
                       <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto' }}>Este aluno não está cadastrado em nenhuma turma ou grupo no banco de dados.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Collaborator inside Group */}
              {selectedGroup && !selectedColaborador && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {(() => {
                    const colabs = (sysUsers || []).filter(u => selectedGroup.colaboradoresIds?.includes(u.id))
                    if (colabs.length === 0) {
                      return (
                        <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                           <Users size={48} style={{ color: 'hsl(var(--text-muted))', opacity: 0.3, marginBottom: 16 }} />
                           <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Setor sem atendentes</h3>
                           <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto' }}>Nenhum colaborador foi adicionado a este grupo nas configurações do sistema.</p>
                        </div>
                      )
                    }

                    return colabs.map(colab => {
                      const styles = getGroupStyles(selectedGroup.nome)
                      return (
                        <div 
                          key={colab.id} 
                          onClick={() => setSelectedColaborador(colab)} 
                          style={{ 
                            background: 'hsl(var(--bg-surface))', 
                            border: '1px solid hsl(var(--border-subtle))', 
                            borderRadius: 20, 
                            padding: 20, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            gap: 14, 
                            alignItems: 'center', 
                            transition: 'all 0.2s' 
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = styles.color
                            e.currentTarget.style.background = `${styles.color}05`
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                            e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                          }}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: styles.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                            {getInitials(colab.nome)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{colab.nome}</div>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{colab.cargo || 'Equipe Escolar'}</div>
                          </div>
                          <ArrowRight size={16} color={styles.color} />
                        </div>
                      )
                    })
                  })()}
                </div>
              )}

              {/* Step 3: Write Subject and Body (Email style) */}
              {selectedGroup && selectedColaborador && (
                <div style={{ maxWidth: 600, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 16, marginBottom: 24 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                      {getInitials(selectedColaborador.nome)}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Para:</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{selectedColaborador.nome} ({selectedGroup.nome})</div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block', color: 'hsl(var(--text-main))' }}>Assunto / Tópico</label>
                    <input 
                      className="form-input" 
                      placeholder="Ex: Assunto financeiro / Dúvida sobre boletim" 
                      value={composeSubject}
                      onChange={e => setComposeSubject(e.target.value)}
                      style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 14 }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block', color: 'hsl(var(--text-main))' }}>Mensagem Inicial</label>
                    <textarea 
                      className="form-input" 
                      placeholder="Escreva detalhadamente a sua solicitação..." 
                      value={composeBody}
                      onChange={e => setComposeBody(e.target.value)}
                      style={{ width: '100%', minHeight: 140, borderRadius: 12, padding: 16, fontSize: 14, resize: 'none', lineHeight: 1.5 }}
                    />
                  </div>

                  <button 
                    onClick={startNewConversa}
                    disabled={!composeSubject.trim() || !composeBody.trim()}
                    style={{ 
                      width: '100%', 
                      height: 52, 
                      borderRadius: 16, 
                      background: (!composeSubject.trim() || !composeBody.trim()) ? 'hsl(var(--bg-surface-alt))' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', 
                      color: (!composeSubject.trim() || !composeBody.trim()) ? 'hsl(var(--text-muted))' : 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: (!composeSubject.trim() || !composeBody.trim()) ? 'not-allowed' : 'pointer',
                      boxShadow: (!composeSubject.trim() || !composeBody.trim()) ? 'none' : '0 8px 24px rgba(99, 102, 241, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Send size={18} /> Iniciar Conversa por E-mail
                  </button>
                </div>
              )}
            </div>

          ) : activeChat ? (
            <>
               {/* Chat Header */}
               <div className="ad-chat-header" style={{ padding: '20px 32px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <button className="mobile-back-btn" onClick={() => { setActiveChat(null); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                      <ChevronLeft size={24} />
                    </button>
                    {(() => {
                      const styles = getGroupStyles(activeChat.name)
                      return (
                        <div className="avatar ad-chat-header-avatar" style={{ width: 52, height: 52, background: styles.color, color: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, boxShadow: `0 6px 16px ${styles.color}30` }}>
                          {getInitials(activeChat.name.split(' (')[0])}
                        </div>
                      )
                    })()}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'hsl(var(--text-main))', marginBottom: 2 }}>{activeChat.tag || 'Conversa sem assunto'}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <div style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(99, 102, 241, 0.1)', color: 'hsl(var(--primary))', fontSize: 11, fontWeight: 700 }}>
                          {activeChat.name}
                        </div>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Messages Area */}
               <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <div style={{ textAlign: 'center', margin: '10px 0 20px' }}>
                   <span style={{ background: 'hsl(var(--bg-surface))', padding: '6px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border-subtle))' }}>
                     Histórico de e-mails oficiais e respostas do atendimento
                   </span>
                 </div>
                 
                 {activeMessages.map((msg: any) => {
                   const isMe = msg.sender === 'them'
                   return (
                     <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                         
                         <div className="ad-chat-bubble" style={{ 
                           background: isMe ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'hsl(var(--bg-surface))',
                           color: isMe ? 'white' : 'hsl(var(--text-main))',
                           padding: '16px 20px',
                           borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                           width: '100%',
                           border: isMe ? 'none' : '1px solid hsl(var(--border-subtle))',
                           boxShadow: isMe ? '0 6px 18px rgba(99, 102, 241, 0.15)' : '0 4px 16px rgba(0,0,0,0.02)',
                           position: 'relative'
                         }}>
                           <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                           
                           <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 8, opacity: isMe ? 0.8 : 0.45 }}>
                             <div style={{ fontSize: 10, fontWeight: 600 }}>{msg.time}</div>
                             {isMe && <CheckCheck size={13} />}
                           </div>
                         </div>

                       </div>
                     </div>
                   )
                 })}
                 <div ref={messagesEndRef} />
               </div>

               {/* Text input area */}
               <div className="ad-chat-input-area" style={{ padding: '20px 40px', background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                 <form onSubmit={handleSend} style={{ display: 'flex', gap: 14 }}>
                   <input 
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                     className="form-input" 
                     placeholder="Escreva sua mensagem aqui..." 
                     style={{ flex: 1, borderRadius: 24, paddingLeft: 20, fontSize: 14, border: '1px solid hsl(var(--border-subtle))', height: 48, background: 'hsl(var(--bg-main))' }}
                   />
                   <button 
                     type="submit" 
                     className="btn btn-primary" 
                     style={{ 
                       width: 48, 
                       height: 48, 
                       padding: 0, 
                       borderRadius: 24, 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'center', 
                       background: inputText.trim() ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'hsl(var(--bg-surface-alt))', 
                       color: inputText.trim() ? 'white' : 'hsl(var(--text-muted))', 
                       border: 'none', 
                       boxShadow: inputText.trim() ? '0 4px 14px rgba(99, 102, 241, 0.3)' : 'none', 
                       transition: 'all 0.2s', 
                       cursor: inputText.trim() ? 'pointer' : 'not-allowed' 
                     }}
                     disabled={!inputText.trim()}
                   >
                     <Send size={18} style={{ marginLeft: -2 }} />
                   </button>
                 </form>
               </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--bg-main))', color: 'hsl(var(--text-muted))' }}>
              <div style={{ width: 80, height: 80, borderRadius: 40, background: 'hsl(var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.02)' }}>
                 <Mail size={32} style={{ color: 'hsl(var(--primary))', opacity: 0.6 }} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Canais de Mensagens Oficiais</h3>
              <p style={{ maxWidth: 460, textAlign: 'center', fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--text-muted))', margin: '0 0 20px 0' }}>
                Abra um canal de e-mail direto com a equipe pedagógica, financeira ou secretaria. Todas as conversas são seguras e auditadas pela escola.
              </p>
              {adConfig?.permissoes?.chat !== false ? (
                <button 
                  onClick={() => { setShowNovaConversa(true); setSelectedGroup(null); setSelectedColaborador(null); }}
                  style={{ 
                    background: 'hsl(var(--bg-surface))', 
                    color: 'hsl(var(--primary))', 
                    border: '1px solid rgba(99, 102, 241, 0.2)', 
                    borderRadius: 20, 
                    padding: '10px 24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    fontSize: 14, 
                    fontWeight: 700, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.05)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'transparent' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-surface))'; e.currentTarget.style.color = 'hsl(var(--primary))'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)' }}
                >
                  <Plus size={16} /> Abrir Nova Conversa
                </button>
              ) : (
                <div style={{ padding: '10px 20px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.15)', fontSize: 13, fontWeight: 600 }}>
                  O envio de novas mensagens foi suspenso temporariamente pela coordenação.
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}
