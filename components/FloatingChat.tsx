'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Search, Send, Plus, Users, User, ArrowLeft, CheckCheck, ChevronDown, ChevronRight, Mail, Reply, Paperclip, Smile } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useAgendaDigital, ADChat, ADChatGroup } from '@/lib/agendaDigitalContext'
import { getInitials } from '@/lib/utils'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData } from '@/lib/dataContext'

export function FloatingChat() {
  const pathname = usePathname()
  const { currentUser, currentUserPerfil } = useApp()
  const { chatsList, setChatsList, messages, setMessages, chatGroups, adConfig } = useAgendaDigital()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios')
  const { turmas = [] } = useData()

  const [isOpen, setIsOpen] = useState(false)
  const [activeChat, setActiveChat] = useState<ADChat | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [selectedContact, setSelectedContact] = useState<{id: string, nome: string, tag: string, groupId: string} | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null) // 'compose' | 'reply' | null
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const EMOJIS = ['😊', '😂', '👍', '🙏', '😍', '👏', '😉', '✅', '❌', '❤️', '🙌', '🎉', '💡', '🚀']

  const insertText = (target: 'compose' | 'reply', text: string) => {
    if (target === 'compose') setComposeBody(prev => prev + text)
    else setInputText(prev => prev + text)
    setShowEmojiPicker(null)
  }

  // Parse student slug from URL context
  const segments = pathname ? pathname.split('/') : []
  const adIndex = segments.indexOf('agenda-digital')
  const slug = adIndex !== -1 && segments[adIndex + 1] && segments[adIndex + 1] !== 'admin' && segments[adIndex + 1] !== 'selecionar-aluno'
    ? segments[adIndex + 1]
    : null

  // Identificação do papel do usuário atual
  const isAlunoOrResponsavel = 
    currentUser?.cargo === 'Aluno' || 
    currentUser?.cargo === 'Responsável' ||
    currentUserPerfil === 'Família' ||
    currentUserPerfil === 'Aluno' ||
    currentUserPerfil?.includes('Responsável') ||
    !currentUserPerfil
  const myId = currentUser?.id || 'unknown'

  // Find active student object
  const activeStudentId = slug || (currentUser?.cargo === 'Aluno' ? currentUser.id : null)
  const activeStudent = activeStudentId ? (alunos || []).find((a: any) => String(a.id) === String(activeStudentId)) : null
  const activeStudentTurma = activeStudent ? (turmas || []).find((t: any) => 
    String(t.id) === String(activeStudent.turma) || 
    String(t.codigo) === String(activeStudent.turma) || 
    String(t.nome) === String(activeStudent.turma)
  ) : null

  // Filtragem dos grupos baseada na pertinência
  const myGroups = chatGroups?.filter(g => {
    if (isAlunoOrResponsavel) {
      if (!activeStudentId) return false
      
      // 1. Classroom group: explicitly contains student ID
      const inAlunosIds = g.alunosIds?.some((id: any) => String(id) === String(activeStudentId))
      
      // 2. Classroom group: synced with student's class/turma
      const isStudentTurmaSync = activeStudentTurma && (
        String(g.id) === `sync-${activeStudentTurma.id}` || 
        String(g.id) === String(activeStudentTurma.id) ||
        g.nome === activeStudentTurma.nome
      )
      
      // 3. Administrative/Sector group: has collaborators but no student IDs, meaning it is a public channel
      const isAdministrativeSector = (!g.alunosIds || g.alunosIds.length === 0) && (g.colaboradoresIds && g.colaboradoresIds.length > 0)
      
      return inAlunosIds || isStudentTurmaSync || isAdministrativeSector
    } else {
      // Equipe escolar vê todos os grupos ou os que pertence
      const isStaffLevel = ['Admin', 'Diretor Geral', 'Diretor', 'Coordenador', 'Secretaria', 'Administrativo', 'TI'].some(role => currentUserPerfil?.includes(role))
      return isStaffLevel ? true : g.colaboradoresIds?.includes(myId)
    }
  }) || []

  // Filtragem dos chats
  const myChats = chatsList?.filter(c => {
    if (isAlunoOrResponsavel) {
      return slug ? String(c.id).startsWith(slug) : String(c.id).includes(myId)
    }
    // Equipe escolar vê todos os chats ou os que estão atribuídos a eles
    const isStaffLevel = ['Admin', 'Diretor Geral', 'Diretor', 'Coordenador', 'Secretaria', 'Administrativo', 'TI'].some(role => currentUserPerfil?.includes(role))
    return isStaffLevel ? true : String(c.id).includes(myId)
  }) || []

  const unreadCount = myChats.reduce((acc, c) => acc + (c.unread || 0), 0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChat])

  if (!currentUser) return null;
  if (adConfig?.permissoes?.chat === false) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !activeChat) return

    setMessages(prev => {
      const current = prev[activeChat.id] || []
      return {
        ...prev,
        [activeChat.id]: [...current, { 
          id: Date.now(), 
          text: inputText, 
          sender: (isAlunoOrResponsavel ? 'them' : 'us') as 'us' | 'them', 
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('pt-BR'),
          author: currentUser?.nome || 'Usuário',
          authorRole: isAlunoOrResponsavel ? (currentUserPerfil || 'Responsável') : 'Equipe Escolar'
        }]
      }
    })
    
    setChatsList(prev => prev.map(c => String(c.id) === String(activeChat.id) ? { 
      ...c, 
      preview: inputText, 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR')
    } : c))
    setInputText('')

    // Auto-reply logic for after-hours
    try {
      const now = new Date()
      const currentHourStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const { inicio = '07:00', fim = '18:00', msgAusencia = 'Olá!\nNosso horário de atendimento encerrou.' } = adConfig?.horarios || {}
      
      if (currentHourStr < inicio || currentHourStr > fim) {
        const chatId = activeChat.id;
        setTimeout(() => {
          setMessages(prev => {
            const current = prev[chatId] || []
            return {
              ...prev,
              [chatId]: [...current, { 
                id: Date.now() + 10, 
                text: `⚠️ [Ausência Automática]:\n${msgAusencia}`, 
                sender: 'us' as 'us' | 'them', // From school
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('pt-BR'),
                author: 'Sistema Escolar',
                authorRole: 'Ausência Automática'
              }]
            }
          })
          
          setChatsList(prev => prev.map(c => String(c.id) === String(chatId) ? { 
            ...c, 
            preview: `⚠️ [Ausência Automática]`, 
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString('pt-BR')
          } : c))
        }, 1200)
      }
    } catch(err) {
      console.error('Error sending auto-reply:', err)
    }
  }

  const startNewChat = (destId: string, destName: string, groupId: string, groupName: string) => {
    setSelectedContact({ id: destId, nome: destName, tag: groupName, groupId })
    setComposeSubject('')
    setComposeBody('')
  }

  const finalSendTicket = () => {
    if (!composeSubject.trim() || !composeBody.trim() || !selectedContact) return

    const activeSlug = slug || myId
    const newChatId = `${activeSlug}-${selectedContact.groupId}-${selectedContact.id}`
    const novo: ADChat = { 
      id: newChatId, 
      name: isAlunoOrResponsavel ? `${selectedContact.nome} (${selectedContact.tag})` : `${selectedContact.nome} (Aluno)`, 
      status: 'active', 
      preview: composeBody.substring(0, 30) + '...', 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR'),
      startDate: new Date().toLocaleDateString('pt-BR'),
      startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      unread: 0, 
      tag: composeSubject // Subject is the topic tag
    }
    
    setMessages(prev => ({
      ...prev,
      [newChatId]: [{
        id: Date.now(),
        text: composeBody,
        sender: (isAlunoOrResponsavel ? 'them' : 'us') as 'us' | 'them',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        author: currentUser?.nome || 'Usuário',
        authorRole: isAlunoOrResponsavel ? (currentUserPerfil || 'Responsável') : 'Equipe Escolar'
      }]
    }))

    setChatsList(prev => [novo, ...prev])
    setActiveChat(novo)
    setShowNewChat(false)
    setSelectedContact(null)
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ 
              width: 380, height: 600, maxHeight: '80vh', 
              background: 'rgba(255, 255, 255, 0.85)', 
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 24, 
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 20px rgba(121, 40, 202, 0.1)',
              border: '1px solid rgba(255,255,255,0.5)',
              marginBottom: 16,
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {activeChat || showNewChat ? (
                  <button onClick={() => { setActiveChat(null); setShowNewChat(false); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ArrowLeft size={18} />
                  </button>
                ) : (
                  <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={20} />
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {activeChat ? (activeChat.tag || 'Conversa sem assunto') : showNewChat ? 'Nova Mensagem Oficial' : 'Caixa de Entrada'}
                  </h3>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {activeChat ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{activeChat.name}</span>
                    ) : 'Atendimento e Comunicados'}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}>
                <X size={24} />
              </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {!activeChat && !showNewChat && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                      <input 
                        placeholder="Buscar mensagens..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, fontSize: 14 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                    {myChats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                      <div key={chat.id} onClick={() => setActiveChat(chat)} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 16, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--gradient-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                          {getInitials(chat.name)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: chat.unread ? 700 : 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.tag || 'Conversa sem assunto'}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{chat.time}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.preview}</span>
                            {chat.unread > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 10 }}>{chat.unread}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {myChats.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                        <MessageCircle size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                        <p style={{ fontSize: 14 }}>Nenhuma conversa ativa.</p>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 16, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <button onClick={() => setShowNewChat(true)} style={{ width: '100%', padding: '12px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 8px 16px rgba(99,102,241,0.2)' }}>
                      <Plus size={18} /> Nova Mensagem Oficial
                    </button>
                  </div>
                </div>
              )}
              {showNewChat && !selectedContact && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                      <input 
                        placeholder="Para quem é a mensagem?" 
                        value={contactSearchQuery}
                        onChange={e => setContactSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, fontSize: 14, outline: 'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    {contactSearchQuery === '' ? (
                      <>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 12, letterSpacing: 1 }}>Selecione por Grupo</h4>
                        {myGroups.map(grupo => {
                          const isExpanded = expandedGroup === grupo.id
                          let equipeIdsNoGrupo = grupo.colaboradoresIds || []
                          let equipeList = (sysUsers || []).filter((user: any) => equipeIdsNoGrupo.includes(user.id))
                          let alunosList = (alunos || []).filter((aluno: any) => (grupo.alunosIds || []).includes(aluno.id))
                          
                          return (
                            <div key={grupo.id} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
                              <div 
                                onClick={() => setExpandedGroup(isExpanded ? null : grupo.id)}
                                style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 18, background: grupo.cor || '#4338ca', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={16} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{grupo.nome}</div>
                                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Users size={12} /> {isAlunoOrResponsavel ? equipeList.length + ' Usuários' : alunosList.length + ' Alunos'}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ color: '#94a3b8', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                  <ChevronDown size={20} />
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                                    <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {isAlunoOrResponsavel && equipeList.map((eq: any) => (
                                        <div key={eq.id} onClick={() => startNewChat(eq.id, eq.nome, grupo.id, grupo.nome)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, cursor: 'pointer', background: 'white', border: '1px solid #f1f5f9' }}>
                                          <div style={{ width: 32, height: 32, borderRadius: 16, background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{getInitials(eq.nome)}</div>
                                          <div style={{ fontSize: 13, fontWeight: 600 }}>{eq.nome}</div>
                                        </div>
                                      ))}
                                      {!isAlunoOrResponsavel && alunosList.map((aluno: any) => (
                                        <div key={aluno.id} onClick={() => startNewChat(aluno.id, aluno.nome, grupo.id, grupo.nome)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, cursor: 'pointer', background: 'white', border: '1px solid #f1f5f9' }}>
                                          <div style={{ width: 32, height: 32, borderRadius: 16, background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{getInitials(aluno.nome)}</div>
                                          <div style={{ fontSize: 13, fontWeight: 600 }}>{aluno.nome}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </>
                    ) : contactSearchQuery.length >= 3 ? (
                      <>
                        <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 12, letterSpacing: 1 }}>Resultados da Busca</h4>
                        {myGroups.map(grupo => {
                          const equipeIdsNoGrupo = grupo.colaboradoresIds || []
                          let equipeMatches = isAlunoOrResponsavel ? (sysUsers || []).filter((u: any) => equipeIdsNoGrupo.includes(u.id) && u.nome.toLowerCase().includes(contactSearchQuery.toLowerCase())) : []
                          let alunosMatches = !isAlunoOrResponsavel ? (alunos || []).filter((a: any) => (grupo.alunosIds || []).includes(a.id) && a.nome.toLowerCase().includes(contactSearchQuery.toLowerCase())) : []
                          
                          if (equipeMatches.length === 0 && alunosMatches.length === 0) return null

                          return (
                            <div key={grupo.id} style={{ marginBottom: 16 }}>
                               <div style={{ fontSize: 12, fontWeight: 700, color: grupo.cor || '#4338ca', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Users size={12} /> {grupo.nome}
                               </div>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
                                  {equipeMatches.map((eq: any) => (
                                    <div key={eq.id} onClick={() => startNewChat(eq.id, eq.nome, grupo.id, grupo.nome)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'white', borderRadius: 12, border: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                       <div style={{ width: 28, height: 28, borderRadius: 14, background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{getInitials(eq.nome)}</div>
                                       <div style={{ fontSize: 13, fontWeight: 600 }}>{eq.nome}</div>
                                    </div>
                                  ))}
                                  {alunosMatches.map((al: any) => (
                                    <div key={al.id} onClick={() => startNewChat(al.id, al.nome, grupo.id, grupo.nome)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'white', borderRadius: 12, border: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                       <div style={{ width: 28, height: 28, borderRadius: 14, background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{getInitials(al.nome)}</div>
                                       <div style={{ fontSize: 13, fontWeight: 600 }}>{al.nome}</div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                         <Search size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                         <p style={{ fontSize: 14 }}>Digite pelo menos 3 letras para buscar um aluno específico...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showNewChat && selectedContact && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: 20 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <button onClick={() => setSelectedContact(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Escrever Mensagem</h4>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Para</label>
                        <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 12, fontSize: 14, fontWeight: 600, border: '1px solid #e2e8f0' }}>{selectedContact.nome}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Assunto</label>
                        <input 
                           placeholder="Qual o assunto desta mensagem?"
                           value={composeSubject}
                           onChange={e => setComposeSubject(e.target.value)}
                           style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Mensagem</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setShowEmojiPicker(showEmojiPicker === 'compose' ? null : 'compose')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Smile size={14} /></button>
                          </div>
                        </div>
                        {showEmojiPicker === 'compose' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 8, background: '#f8fafc', borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                            {EMOJIS.map(e => <button key={e} onClick={() => insertText('compose', e)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>{e}</button>)}
                          </div>
                        )}
                        <textarea 
                           placeholder="Escreva detalhadamente aqui..."
                           value={composeBody}
                           onChange={e => setComposeBody(e.target.value)}
                           style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, minHeight: 120, resize: 'none', outline: 'none' }}
                        />
                      </div>
                      <button 
                        onClick={finalSendTicket}
                        disabled={!composeSubject.trim() || !composeBody.trim()}
                        style={{ width: '100%', padding: '14px', background: (!composeSubject.trim() || !composeBody.trim()) ? '#e2e8f0' : '#4f46e5', color: 'white', border: 'none', borderRadius: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', marginTop: 8, cursor: 'pointer' }}
                      >
                         <Send size={18} /> Enviar Mensagem Oficial
                      </button>
                   </div>
                </div>
              )}

              {activeChat && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(0,0,0,0.02)' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(messages[activeChat.id] || []).map((msg: any) => {
                       const isMe = isAlunoOrResponsavel ? msg.sender === 'them' : msg.sender === 'us'
                       
                       return (
                         <div key={msg.id} style={{ 
                             background: 'white', 
                             border: '1px solid rgba(0,0,0,0.05)',
                             borderRadius: 12, 
                             padding: 16,
                             boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                             marginLeft: isMe ? 24 : 0,
                             marginRight: isMe ? 0 : 24,
                         }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                 <div style={{ width: 24, height: 24, borderRadius: 12, background: isMe ? '#4f46e5' : '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10 }}>
                                    {getInitials(msg.author || (isMe ? 'Você' : activeChat.name))}
                                 </div>
                                 <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{msg.author || (isMe ? 'Você' : activeChat.name)}</div>
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{msg.date} às {msg.time}</div>
                           </div>
                           <div style={{ fontSize: 14, lineHeight: 1.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
                             {msg.text}
                           </div>
                         </div>
                       )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div style={{ padding: '16px 16px 24px 16px', background: 'white', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <button onClick={() => setShowEmojiPicker(showEmojiPicker === 'reply' ? null : 'reply')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Smile size={14} /></button>
                      </div>
                      {showEmojiPicker === 'reply' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 8, background: 'white' }}>
                          {EMOJIS.map(e => <button key={e} onClick={() => insertText('reply', e)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>{e}</button>)}
                        </div>
                      )}
                      <textarea 
                        placeholder="Escreva sua resposta..." 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', resize: 'none', minHeight: 80, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                         <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}><Paperclip size={16} /></button>
                         <button onClick={handleSend} style={{ background: inputText.trim() ? '#4f46e5' : '#e2e8f0', color: inputText.trim() ? 'white' : '#94a3b8', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: inputText.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                           <Reply size={14} /> Enviar
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: 64, height: 64, borderRadius: 32, 
          background: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
          color: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 24px rgba(67, 56, 202, 0.4), 0 0 0 4px rgba(255,255,255,0.2)',
          position: 'relative'
        }}
      >
        <Mail size={28} />
        {!isOpen && unreadCount > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 800, width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
            {unreadCount}
          </div>
        )}
      </motion.button>
    </div>
  )
}
