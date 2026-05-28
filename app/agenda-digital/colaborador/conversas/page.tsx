'use client'

import React, { useState, useRef, useEffect, use } from 'react'
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
import { TurmaDropdown } from '../components/TurmaDropdown'


export default function ADConversasPage() {
  const { messages, setMessages, chatsList, setChatsList, chatGroups, adConfig } = useAgendaDigital()
  
  const { turmas = [] } = useData()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios')
  const { currentUser } = useApp()

  
  
  
  
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')

  const turmaOptions = React.useMemo(() => {
    const userGroups = (chatGroups || []).filter(g => g && g.colaboradoresIds?.includes(currentUser?.id || ''))
    const accessibleTurmas = turmas.filter(t => {
       return t && userGroups.some(g => g && (String(g.id) === `sync-${t.id}` || g.nome === t.nome))
    })
    return [{ id: 'all', nome: 'Minhas Turmas' }, ...accessibleTurmas]
  }, [turmas, chatGroups, currentUser])

  const selectedTurmaName = React.useMemo(() => {
    if (selectedTurmaId === 'all') return 'Minhas Turmas'
    const t = turmas.find(x => x && (String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId)))
    return t ? t.nome : 'Turma Selecionada'
  }, [selectedTurmaId, turmas])

  const alunosDaTurma = React.useMemo(() => {
    if (selectedTurmaId === 'all') {
      const accessibleTurmaIds = turmaOptions.filter(t => t && t.id !== 'all').map(t => String(t.id))
      return (alunos || []).filter(a => a && (accessibleTurmaIds.includes(String(a.turma)) || accessibleTurmaIds.includes(String(a.turmaId))))
    }
    return (alunos || []).filter(a => a && (String(a.turma) === String(selectedTurmaId) || String(a.turmaId) === String(selectedTurmaId)))
  }, [alunos, selectedTurmaId, turmaOptions])

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
    // Para o Colaborador, queremos ver todas as conversas relacionadas aos alunos das turmas que ele tem acesso.
    // O ID do chat segue o formato: `${studentId}-${grupoId}-${colaboradorId}-${timestamp}`
    const allowedStudentIds = new Set((alunosDaTurma || []).filter(Boolean).map(a => String(a.id)))
    const myGroupIds = new Set((chatGroups || []).filter(g => g && g.colaboradoresIds?.includes(currentUser?.id || '')).map(g => String(g.id)))

    const filteredChats = (chatsList || []).filter(c => {
      if (!c || !c.id) return false
      const parts = String(c.id).split('-')
      const chatStudentId = parts[0]
      const chatGroupId = parts[1]
      const chatColabId = parts[2]
      
      // Admins see all. Collaborators see if they are the direct colab, or if the chat belongs to their group and allowed student
      if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Direção') {
         return allowedStudentIds.has(chatStudentId)
      }
      
      const isMyChat = String(chatColabId) === String(currentUser?.id) || myGroupIds.has(String(chatGroupId))
      return isMyChat && allowedStudentIds.has(chatStudentId)
    })
    
    const uniqueChats = []
    const seenIds = new Set()
    for (const chat of filteredChats) {
      if (chat && chat.id && !seenIds.has(chat.id)) {
        seenIds.add(chat.id)
        uniqueChats.push(chat)
      }
    }
    
    uniqueChats.sort((a, b) => {
      const parseDate = (d: string | undefined, t: string | undefined) => {
        if (!d || !t) return 0;
        const parts = String(d).split('/');
        if (parts.length !== 3) return 0;
        const [day, month, year] = parts;
        const [hour, min] = String(t).split(':');
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min)).getTime();
      }
      return parseDate(b.date, b.time) - parseDate(a.date, a.time);
    })
    
    setChats(uniqueChats)
    if (activeChat && !filteredChats.some(c => c && c.id === activeChat.id)) {
      setActiveChat(null)
    }
  }, [chatsList, alunosDaTurma, currentUser])


  // Scroll to bottom of active message log
  const activeMessages = activeChat ? messages[activeChat.id] || [] : []
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

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
          sender: 'us', // 'them' is the parent/student in this layout
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

    
  }

  // Find student's resolved class/turma object
  const studentTurmaObj = null;

  // Filter groups that contain this student ID, match their class/turma, or are general administrative/sector groups
  const studentGroups: any[] = [];

  const startNewConversa = () => {
    // selectedColaborador aqui é o ALUNO selecionado na tela do colaborador
    if (!selectedColaborador || !selectedGroup || !composeSubject.trim() || !composeBody.trim()) return

    const alunoSelecionado = selectedColaborador

    // BUG FIX: O ID SEMPRE começa com o ID do ALUNO para que o aluno possa filtrar suas conversas
    // Formato correto: alunoId-grupoId-colaboradorId-timestamp
    // Proteção extra: verificar se já existe conversa para esse aluno/grupo para evitar duplicatas
    const existingChat = (chatsList || []).find(c => {
      if (!c?.id) return false
      const parts = String(c.id).split('-')
      // O chat já existe se o alunoId (pos 0) e grupoId (pos 1) forem iguais
      return parts[0] === String(alunoSelecionado.id) && parts[1] === String(selectedGroup.id)
    })

    if (existingChat) {
      // Conversa já existe → apenas abrir ela em vez de duplicar
      setActiveChat(existingChat)
      setShowNovaConversa(false)
      setSelectedGroup(null)
      setSelectedColaborador(null)
      setComposeSubject('')
      setComposeBody('')
      return
    }

    // Cria novo ID com aluno SEMPRE na posição 0
    const newChatId = `${alunoSelecionado.id}-${selectedGroup.id}-${currentUser?.id}-${Date.now()}`

    const novoChat = {
      id: newChatId,
      // Nomear com nome do aluno + setor para o colaborador identificar facilmente
      name: `${alunoSelecionado.nome} (${selectedGroup.nome})`,
      status: 'online',
      preview: composeBody.substring(0, 30) + (composeBody.length > 30 ? '...' : ''),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR'),
      startDate: new Date().toLocaleDateString('pt-BR'),
      startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      unread: 0, // A escola criou, então não é não-lida para a escola
      tag: composeSubject,
      // Metadados explícitos para evitar dependência do split do ID
      alunoId: String(alunoSelecionado.id),
      colaboradorId: String(currentUser?.id),
      grupoId: String(selectedGroup.id)
    }

    setMessages(prev => ({
      ...prev,
      [newChatId]: [{
        id: Date.now(),
        text: composeBody,
        sender: 'us', // 'us' = escola, 'them' = família/aluno — consistente em todo sistema
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        author: currentUser?.nome || 'Escola',
        authorRole: currentUser?.cargo || 'Colaborador'
      }]
    }))

    setChatsList(prev => [novoChat, ...prev])
    setActiveChat(novoChat)

    setShowNovaConversa(false)
    setSelectedGroup(null)
    setSelectedColaborador(null)
    setComposeSubject('')
    setComposeBody('')
  }

  // Get matching icon/color based on group name
  const getGroupStyles = (name: string | undefined) => {
    const lowercase = String(name || '').toLowerCase()
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

  const getTagStyles = (tag: string | undefined) => {
    const text = String(tag || '').toLowerCase()
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
    c && (
      String(c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.tag && String(c.tag).toLowerCase().includes(searchQuery.toLowerCase()))
    )
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-chat-container {
            height: calc(100vh - 280px) !important;
            min-height: 520px !important;
            flex-direction: column !important;
            position: relative !important;
            border-radius: 16px !important;
          }
          .ad-chat-sidebar {
            width: 100% !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
          }
          .ad-chat-main {
            width: 100% !important;
            border-right: none !important;
            display: flex !important;
          }
          .ad-chat-sidebar.mobile-hidden, 
          .ad-chat-main.mobile-hidden {
            display: none !important;
          }
          .mobile-back-btn {
            display: flex !important;
          }
          .ad-chat-sidebar > div:first-child {
            padding: 16px !important;
          }
          .ad-chat-sidebar h2 {
            font-size: 20px !important;
          }
          .ad-chat-sidebar .form-input {
            height: 36px !important;
          }
          .ad-nova-conversa-wrapper {
            padding: 20px !important;
          }
          .ad-nova-conversa-header {
            padding: 0px !important;
            margin-bottom: 20px !important;
          }
          .ad-nova-conversa-titlebox h2 {
            font-size: 20px !important;
          }
          .ad-nova-conversa-form {
            padding: 20px !important;
            border-radius: 16px !important;
          }
          .ad-chat-header {
            padding: 12px 16px !important;
          }
          .ad-chat-header .ad-chat-header-avatar {
            width: 40px !important;
            height: 40px !important;
            font-size: 16px !important;
          }
          .ad-chat-header h2, 
          .ad-chat-header div[style*="fontWeight: 800"] {
            font-size: 16px !important;
          }
          .ad-chat-messages-area {
            padding: 16px 12px !important;
            gap: 12px !important;
          }
          .ad-chat-bubble-wrapper {
            max-width: 85% !important;
          }
          .ad-chat-bubble {
            padding: 12px 16px !important;
            border-radius: 16px !important;
          }
          .ad-chat-bubble p {
            font-size: 13.5px !important;
          }
          .ad-chat-input-area {
            padding: 12px 16px !important;
          }
          .ad-chat-input-area input {
            height: 44px !important;
            font-size: 13px !important;
          }
          .ad-chat-input-area button {
            width: 44px !important;
            height: 44px !important;
          }
        }
      `}} />
      <div className="ad-chat-container" style={{ display: 'flex', height: 'calc(100vh - 140px)', background: 'hsl(var(--bg-main))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.03)' }}>
      
      {/* Sidebar (List of Chats) */}
      <div className={`ad-chat-sidebar ${(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ width: 360, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', letterSpacing: '-0.02em', margin: 0 }}>Mensagens</h2>
              
              <div style={{ position: 'relative', zIndex: 50 }}>
                <TurmaDropdown 
                  turmaOptions={turmaOptions} 
                  selectedTurmaId={selectedTurmaId} 
                  setSelectedTurmaId={setSelectedTurmaId} 
                  selectedTurmaName={selectedTurmaName} 
                />
              </div>
            </div>

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
                  transition: 'all 0.2s',
                  alignSelf: 'flex-start'
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
            // BUG FIX: Na tela do colaborador, 'us' = escola = nossa mensagem
            // O ícone de duplo-check deve aparecer quando a última mensagem foi NOSSA (escola)
            const lastMessageIsMine = lastMessage ? lastMessage.sender === 'us' : false

            return (
              <div 
                key={chat.id} 
                onClick={() => { setActiveChat(chat); setShowNovaConversa(false); if (chat.unread > 0) { setChatsList(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c)) } }}
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
                     {getInitials(String(chat?.name || 'Sem Nome').split(' (')[0])}
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
                      // BUG FIX: Badge de não-lidas no colaborador = quando a FAMÍLIA enviou ('them') e há mensagens não lidas
                      // O colaborador precisa ver quando TEM mensagem nova da família para responder
                      if (lastMsg.sender === 'them' && chat.unread > 0) {
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
                        {chat.name || 'Sem nome'}
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
                      ? `Escreva um e-mail formal para a família de ${selectedColaborador.nome} (${selectedGroup.nome})`
                      : selectedGroup 
                        ? `Selecione um aluno da turma: ${selectedGroup.nome}` 
                        : 'Selecione a turma para visualizar os alunos.'}
                  </p>
                </div>
                <button onClick={() => { setShowNovaConversa(false); setSelectedGroup(null); setSelectedColaborador(null); }} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Step 1: Select Turma */}
              {!selectedGroup && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {turmaOptions.filter(t => t && t.id !== 'all').map(grupo => {
                    const styles = { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', icon: <Users size={24} color="#6366f1" /> }
                    const totalAlunos = (alunos || []).filter(a => a && (String(a.turma) === String(grupo.id) || String(a.turmaId) === String(grupo.id))).length
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
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{totalAlunos} Alunos matriculados</div>
                        </div>
                        <ChevronRight size={18} color="hsl(var(--text-muted))" style={{ opacity: 0.5 }} />
                      </div>
                    )
                  })}
                  {turmaOptions.filter(t => t.id !== 'all').length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                       <HelpCircle size={48} style={{ color: 'hsl(var(--text-muted))', opacity: 0.3, marginBottom: 16 }} />
                       <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sem turmas vinculadas</h3>
                       <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto' }}>Você não tem turmas associadas ao seu perfil de colaborador.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Aluno inside Turma */}
              {selectedGroup && !selectedColaborador && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {(() => {
                    const alunosDaTurmaSelecionada = (alunosDaTurma || []).filter(a => a && (String(a.turma) === String(selectedGroup.id) || String(a.turmaId) === String(selectedGroup.id)))
                    if (alunosDaTurmaSelecionada.length === 0) {
                      return (
                        <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                           <Users size={48} style={{ color: 'hsl(var(--text-muted))', opacity: 0.3, marginBottom: 16 }} />
                           <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Turma sem alunos</h3>
                           <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto' }}>Nenhum aluno encontrado nesta turma.</p>
                        </div>
                      )
                    }

                    return alunosDaTurmaSelecionada.map(aluno => {
                      const styles = { color: '#6366f1' }
                      return (
                        <div 
                          key={aluno.id} 
                          onClick={() => setSelectedColaborador(aluno)} 
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
                            {getInitials(aluno.nome || '')}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{aluno.nome || ''}</div>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Aluno / Família</div>
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
                <div className="ad-nova-conversa-form" style={{ maxWidth: 600, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 16, marginBottom: 24 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                      {getInitials(selectedColaborador.nome || '')}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Para:</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{selectedColaborador.nome || ''} ({selectedGroup.nome || ''})</div>
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
               <div className="ad-chat-messages-area" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <div style={{ textAlign: 'center', margin: '10px 0 20px' }}>
                   <span style={{ background: 'hsl(var(--bg-surface))', padding: '6px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border-subtle))' }}>
                     Histórico de e-mails oficiais e respostas do atendimento
                   </span>
                 </div>
                 
                 {activeMessages.map((msg: any) => {
                    // BUG FIX: Na tela do COLABORADOR (escola), 'us' = nós (escola) = bolão direito/roxo
                    // 'them' = família/aluno = balão esquerdo/cinza
                    const isMe = msg.sender === 'us'
                   return (
                     <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                       <div className="ad-chat-bubble-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                         
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
    </>
  )
}
