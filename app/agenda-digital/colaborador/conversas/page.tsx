'use client'

import React, { useState, useRef, useEffect, use } from 'react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { 
  Send, Search, Users, MessageSquare, Plus, X, GraduationCap, 
  DollarSign, FileText, BookOpen, ChevronRight, ChevronLeft, 
  Building, CheckCheck, Inbox, Mail, User, HelpCircle, ArrowRight,
  Shield, Phone, UserCheck, Layers
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { TurmaDropdown } from '../components/TurmaDropdown'
import { supabase } from '@/lib/supabase'


export default function ADConversasPage() {
  const { messages, setMessages, chatsList, setChatsList, chatGroups, adConfig } = useAgendaDigital()
  
  const { turmas = [] } = useData()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios')
  const [equipes] = useSupabaseArray<any>('agenda/equipes')
  const { currentUser } = useApp()
  
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')
  const [searchTermModal, setSearchTermModal] = useState<string>('')

  const turmaOptions = React.useMemo(() => {
    const minhasEquipesIds = (equipes || []).filter(e => e && e.membrosIds?.includes(currentUser?.id || '')).map(e => String(e.id))
    const userGroups = (chatGroups || []).filter(g => {
       if (!g) return false
       if (g.colaboradoresIds?.includes(currentUser?.id || '')) return true
       if ((g as any).equipesIds && (g as any).equipesIds.some((eid: string) => minhasEquipesIds.includes(String(eid)))) return true
       return false
    })
    
    // Find groups that are mapped to a Turma
    const accessibleTurmas = turmas.filter(t => {
       return t && userGroups.some(g => g && (String(g.id) === `sync-${t.id}` || g.nome === t.nome))
    })

    // Find administrative groups (not mapped to a Turma)
    const academicGroupIds = new Set()
    userGroups.forEach(g => {
       const matchedTurma = turmas.find(t => t && (String(g.id) === `sync-${t.id}` || g.nome === t.nome))
       if (matchedTurma) academicGroupIds.add(g.id)
    })
    const nonAcademicGroups = userGroups.filter(g => !academicGroupIds.has(g.id)).map(g => ({
       id: g.id,
       nome: g.nome,
       isGroup: true
    }))

    return [{ id: 'all', nome: 'Minhas Turmas e Grupos' }, ...accessibleTurmas, ...nonAcademicGroups]
  }, [turmas, chatGroups, currentUser, equipes])

  const selectedTurmaName = React.useMemo(() => {
    if (selectedTurmaId === 'all') return 'Minhas Turmas e Grupos'
    const t = turmaOptions.find(x => x && (String(x.id) === String(selectedTurmaId) || String((x as any).codigo) === String(selectedTurmaId)))
    return t ? t.nome : 'Turma Selecionada'
  }, [selectedTurmaId, turmaOptions])

  const alunosDaTurma = React.useMemo(() => {
    if (selectedTurmaId === 'all') {
      const accessibleTurmaIds = turmaOptions.filter(t => t && t.id !== 'all' && !(t as any).isGroup).map(t => String(t.id))
      return (alunos || []).filter(a => a && (accessibleTurmaIds.includes(String(a.turma)) || accessibleTurmaIds.includes(String(a.turmaId))))
    }
    
    const isNonAcademic = turmaOptions.find(t => String(t.id) === String(selectedTurmaId) && (t as any).isGroup)
    if (isNonAcademic) {
      // For administrative groups (e.g. Financeiro), show all students or allow messaging anyone
      return alunos || []
    }

    return (alunos || []).filter(a => a && (String(a.turma) === String(selectedTurmaId) || String(a.turmaId) === String(selectedTurmaId)))
  }, [alunos, selectedTurmaId, turmaOptions])

  const [chats, setChats] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [inputText, setInputText] = useState('')
  const [showNovaConversa, setShowNovaConversa] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'familias' | 'equipes'>('familias')
  
  // New Conversation Flow State
  const [modalTab, setModalTab] = useState<'familias' | 'equipes'>('familias')
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedColaborador, setSelectedColaborador] = useState<any>(null)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([])
  const [composeMode, setComposeMode] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter chats that belong to this student
  
  useEffect(() => {
    // Para o Colaborador, queremos ver todas as conversas relacionadas aos alunos das turmas que ele tem acesso.
    // O ID do chat segue o formato: `${studentId}-${grupoId}-${colaboradorId}-${timestamp}`
    const allowedStudentIds = new Set((alunosDaTurma || []).filter(Boolean).map(a => String(a.id)))
    const minhasEquipesIds = (equipes || []).filter(e => e && e.membrosIds?.includes(currentUser?.id || '')).map(e => String(e.id))
    const myGroupIds = new Set((chatGroups || []).filter(g => {
       if (!g) return false
       if (g.colaboradoresIds?.includes(currentUser?.id || '')) return true
       if ((g as any).equipesIds && (g as any).equipesIds.some((eid: string) => minhasEquipesIds.includes(String(eid)))) return true
       return false
    }).map(g => String(g.id)))

    const filteredChats = (chatsList || []).filter(c => {
      if (!c || !c.id) return false

      // ── MENSAGENS INTERNAS 1-PARA-1 (TKT) ──
      // Formato: TKT-[SenderID]-[ReceiverID]-[Timestamp]
      if (String(c.id).startsWith('TKT-')) {
         return String(c.id).includes(String(currentUser?.id))
      }

      // Excluir chats de equipe legados (agora tudo é 1-to-1)
      if (String(c.id).startsWith('equipe-')) return false
      
      const directAlunoId = (c as any).alunoId || (c as any).dados?.alunoId;
      const directGrupoId = (c as any).grupoId || (c as any).dados?.grupoId;
      const directColabId = (c as any).colaboradorId || (c as any).dados?.colaboradorId;

      if (directAlunoId && directGrupoId) {
         if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Direção') {
            return allowedStudentIds.has(String(directAlunoId))
         }
         const isMyChat = String(directColabId) === String(currentUser?.id) || myGroupIds.has(String(directGrupoId))
         return isMyChat && allowedStudentIds.has(String(directAlunoId))
      }

      // Fallback robusto que não quebra com UUIDs (que contém hífens)
      const isAllowedStudent = Array.from(allowedStudentIds).some(id => String(c.id).includes(String(id)))
      
      // Admins see all
      if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Direção') {
         return isAllowedStudent
      }
      
      const isMyChat = String(c.id).includes(String(currentUser?.id)) || Array.from(myGroupIds).some(id => String(c.id).includes(String(id)))
      return isMyChat && isAllowedStudent
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
      return parseDate(b.date, b.time) - parseDate(a.date, a.time)
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

  const toggleRecipient = (recipId: string, recipNome: string) => {
    setSelectedRecipients(prev => {
      const exists = prev.find(r => r.id === recipId)
      if (exists) return prev.filter(r => r.id !== recipId)
      return [...prev, { id: recipId, nome: recipNome }]
    })
  }

  const startNewConversa = () => {
    if (!composeSubject.trim() || !composeBody.trim()) return

    if (modalTab === 'familias') {
      if (!selectedColaborador || !selectedGroup) return
      const alunoSelecionado = selectedColaborador

      // BUG FIX: O ID SEMPRE começa com o ID do ALUNO para que o aluno possa filtrar suas conversas
      // Formato correto: alunoId-grupoId-colaboradorId-timestamp
      const existingChat = (chatsList || []).find(c => {
        if (!c?.id) return false
        return String(c.id).includes(String(alunoSelecionado.id)) && String(c.id).includes(String(selectedGroup.id))
      })

      if (existingChat) {
        setActiveChat(existingChat)
        setShowNovaConversa(false)
        setSelectedGroup(null)
        setExpandedGroup(null)
        setComposeMode(false)
        setComposeSubject('')
        setComposeBody('')
        return
      }

      const newChatId = `${alunoSelecionado.id}-${selectedGroup.id}-${currentUser?.id}-${Date.now()}`
      const novoChat = {
        id: newChatId,
        name: `${alunoSelecionado.nome} (${selectedGroup.nome})`,
        status: 'online',
        preview: composeBody.substring(0, 30) + (composeBody.length > 30 ? '...' : ''),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        startDate: new Date().toLocaleDateString('pt-BR'),
        startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        unread: 0,
        tag: composeSubject,
        alunoId: String(alunoSelecionado.id),
        colaboradorId: String(currentUser?.id),
        grupoId: String(selectedGroup.id)
      }

      setMessages(prev => ({
        ...prev,
        [newChatId]: [{
          id: Date.now(),
          text: composeBody,
          sender: 'us',
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
      setExpandedGroup(null)
      setComposeMode(false)
      setComposeSubject('')
      setComposeBody('')

    } else {
      // ABA EQUIPES: Multi-dispatch para conversas 1-to-1 internas
      if (selectedRecipients.length === 0) return

      setMessages(prev => {
        const next = { ...prev }
        selectedRecipients.forEach(recip => {
           // Formato de Ticket Interno
           const newChatId = `TKT-${currentUser?.id}-${recip.id}-${Date.now()}`
           next[newChatId] = [{
             id: Date.now(),
             text: composeBody,
             sender: 'us',
             time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
             date: new Date().toLocaleDateString('pt-BR'),
             author: currentUser?.nome || 'Colaborador',
             authorRole: currentUser?.cargo || 'Equipe'
           }]
        })
        return next
      })

      setChatsList(prev => {
        const newChats = selectedRecipients.map(recip => ({
          id: `TKT-${currentUser?.id}-${recip.id}-${Date.now()}`, 
          name: recip.nome, 
          status: 'online', 
          preview: composeBody.substring(0, 30) + '...', 
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('pt-BR'),
          unread: 0, 
          tag: composeSubject,
          startDate: new Date().toLocaleDateString('pt-BR'),
          startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
        }))
        return [...newChats, ...prev]
      })

      // Limpar formulário e fechar modal
      setShowNovaConversa(false)
      setSelectedRecipients([])
      setComposeMode(false)
      setExpandedGroup(null)
      setComposeSubject('')
      setComposeBody('')
    }
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

  // Get icon for equipe based on its stored icon name
  const getEquipeIcon = (icone: string, cor: string, size = 20) => {
    const iconMap: Record<string, React.ReactNode> = {
      Shield: <Shield size={size} color={cor} />,
      GraduationCap: <GraduationCap size={size} color={cor} />,
      FileText: <FileText size={size} color={cor} />,
      DollarSign: <DollarSign size={size} color={cor} />,
      Phone: <Phone size={size} color={cor} />,
      Building: <Building size={size} color={cor} />,
      Users: <Users size={size} color={cor} />,
      UserCheck: <UserCheck size={size} color={cor} />,
    }
    return iconMap[icone] || <Users size={size} color={cor} />
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

  // ── Get last message preview for equipe
  const getEquipeLastMessage = (equipeId: string) => {
    const msgs = messages[`equipe-${equipeId}`] || []
    if (msgs.length === 0) return null
    return msgs[msgs.length - 1]
  }

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
        <div style={{ padding: '24px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', letterSpacing: '-0.02em', margin: 0 }}>Mensagens</h2>
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
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Plus size={16} /> Nova
              </button>
            )}
          </div>

          {/* Tab switcher: Famílias | Equipes */}
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', borderRadius: 14, padding: 4, marginBottom: 14, border: '1px solid hsl(var(--border-subtle))' }}>
            {[
              { id: 'familias', label: 'Famílias', icon: <Mail size={13} /> },
              { id: 'equipes', label: 'Equipes', icon: <Shield size={13} />, count: (equipes || []).filter((e: any) => e.membrosIds?.includes(currentUser?.id || '')).length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setActiveChat(null); setShowNovaConversa(false) }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  transition: 'all 0.2s',
                  background: activeTab === tab.id ? 'white' : 'transparent',
                  color: activeTab === tab.id ? '#6366f1' : 'hsl(var(--text-muted))',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{ background: activeTab === tab.id ? '#6366f1' : 'rgba(0,0,0,0.08)', color: activeTab === tab.id ? 'white' : 'hsl(var(--text-muted))', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'familias' && (
            <div style={{ marginBottom: 8 }}>
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
          )}
        </div>
        
        {/* ── CHAT LIST ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filteredChats
            .filter(chat => activeTab === 'equipes' ? String(chat.id).startsWith('TKT-') : !String(chat.id).startsWith('TKT-'))
            .map(chat => {
              const isActive = activeChat?.id === chat.id
              const styles = getGroupStyles(chat.name)
              
              const chatMessages = messages[chat.id] || []
              const lastMessage = chatMessages[chatMessages.length - 1]
              const lastMessageIsMine = lastMessage ? lastMessage.sender === 'us' : false

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
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 4, background: styles.color, borderRadius: '0 4px 4px 0' }} />
                  )}
                  
                  <div style={{ position: 'relative' }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 16, 
                      background: isActive ? styles.color : styles.bg, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      color: isActive ? 'white' : styles.color,
                      transition: 'all 0.3s',
                      boxShadow: isActive ? `0 8px 20px ${styles.color}40` : 'none'
                    }}>
                      {activeTab === 'equipes' ? <User size={22} /> : styles.icon}
                    </div>
                    {chat.unread > 0 && (
                      <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)' }}>
                        {chat.unread > 9 ? '9+' : chat.unread}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: isActive ? styles.color : 'hsl(var(--text-main))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {chat.tag || chat.name}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: chat.unread > 0 ? 800 : 500, color: chat.unread > 0 ? '#ef4444' : 'hsl(var(--text-muted))', flexShrink: 0 }}>
                        {lastMessage ? lastMessage.time : chat.time}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>
                      Criado em {chat.startDate || chat.date} às {chat.startTime || chat.time}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {lastMessageIsMine && <CheckCheck size={14} color={chat.unread > 0 ? 'hsl(var(--text-muted))' : '#3b82f6'} style={{ opacity: 0.8 }} />}
                      <div style={{ 
                        fontSize: 12, 
                        color: chat.unread > 0 ? 'hsl(var(--text-main))' : 'hsl(var(--text-muted))', 
                        fontWeight: chat.unread > 0 ? 700 : 500,
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        opacity: chat.unread > 0 ? 1 : 0.85
                      }}>
                        {activeTab === 'equipes' ? <span style={{ fontWeight: 700, color: styles.color }}>{chatMessages[0]?.author || chat.name}: </span> : null}
                        {lastMessage ? lastMessage.text : chat.preview}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {filteredChats.filter(chat => activeTab === 'equipes' ? String(chat.id).startsWith('TKT-') : !String(chat.id).startsWith('TKT-')).length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                <MessageSquare size={36} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--text-main))', marginBottom: 4 }}>Nenhuma conversa</p>
                <p style={{ fontSize: 13 }}>Não há mensagens nesta categoria.</p>
              </div>
            )}
        </div>
      </div>

      {/* Main Area (New Chat Flow or Active Message Log) */}
      <div className={`ad-chat-main ${!(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-main))', position: 'relative', width: '100%' }}>
          
          {showNovaConversa ? (
            <>
            <div className="ad-nova-conversa-wrapper" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '40px 60px', overflowY: 'auto', boxSizing: 'border-box' }}>
              <div className="ad-nova-conversa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
                <div>
                  <div className="ad-nova-conversa-titlebox" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <button className="mobile-back-btn" onClick={() => { setShowNovaConversa(false); setSelectedGroup(null); setExpandedGroup(null); setComposeMode(false); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                      <ChevronLeft size={24} />
                    </button>
                    {(composeMode || selectedGroup) && (
                      <button 
                        onClick={() => {
                          if (composeMode) {
                            setComposeMode(false)
                          } else if (selectedColaborador) {
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
                </div>
                <button onClick={() => { setShowNovaConversa(false); setSelectedGroup(null); setSelectedColaborador(null); setComposeMode(false); }} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <button 
                  onClick={() => { setModalTab('familias'); setComposeMode(false); }} 
                  style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: modalTab === 'familias' ? '2px solid #4f46e5' : '2px solid transparent', color: modalTab === 'familias' ? '#4f46e5' : 'hsl(var(--text-muted))', fontWeight: 700, cursor: 'pointer' }}
                >
                  Famílias / Turmas
                </button>
                <button 
                  onClick={() => { setModalTab('equipes'); setComposeMode(false); }} 
                  style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: modalTab === 'equipes' ? '2px solid #4f46e5' : '2px solid transparent', color: modalTab === 'equipes' ? '#4f46e5' : 'hsl(var(--text-muted))', fontWeight: 700, cursor: 'pointer' }}
                >
                  Equipe (Interno)
                </button>
              </div>

              {!composeMode ? (
                <>
                  {modalTab === 'familias' && (
                    <>
                      {/* Search Bar */}
                      {!selectedColaborador && (
                        <div style={{ marginBottom: 20, position: 'relative' }}>
                          <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: 15 }} />
                          <input 
                            value={searchTermModal}
                            onChange={e => setSearchTermModal(e.target.value)}
                            placeholder={selectedGroup ? "Buscar aluno por nome..." : "Buscar turma ou grupo..."}
                            style={{ 
                              width: '100%', 
                              height: 48, 
                              borderRadius: 12, 
                              paddingLeft: 44, 
                              border: '1px solid hsl(var(--border-subtle))', 
                              background: 'hsl(var(--bg-main))',
                              fontSize: 14 
                            }}
                          />
                        </div>
                      )}

                      {/* Step 1: Select Turma */}
                      {!selectedGroup && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                          {turmaOptions.filter(t => t && t.id !== 'all' && t.nome.toLowerCase().includes(searchTermModal.toLowerCase())).map(grupo => {
                            const styles = { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', icon: <Users size={24} color="#6366f1" /> }
                            const isAdministrative = (grupo as any).isGroup
                            const totalAlunos = isAdministrative 
                               ? (alunos || []).length 
                               : (alunos || []).filter(a => a && (String(a.turma) === String(grupo.id) || String(a.turmaId) === String(grupo.id))).length
                            
                            return (
                              <div 
                                key={grupo.id} 
                                onClick={() => { setSelectedGroup(grupo); setSearchTermModal(''); }} 
                                style={{ 
                                  background: 'hsl(var(--bg-surface))', 
                                  border: '1px solid hsl(var(--border-subtle))', 
                                  borderRadius: 20, 
                                  padding: '20px 16px', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  gap: 12, 
                                  alignItems: 'center', 
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.01)', 
                                  transition: 'all 0.2s',
                                  minWidth: 0 // Prevent flex children from overflowing
                                }}
                              >
                                <div style={{ width: 44, height: 44, borderRadius: 14, background: styles.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {isAdministrative ? <Shield size={24} color="#6366f1" /> : styles.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{grupo.nome}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                     {isAdministrative ? 'Canal Institucional' : `${totalAlunos} Alunos`}
                                  </div>
                                </div>
                                <ChevronRight size={18} color="hsl(var(--text-muted))" style={{ opacity: 0.5, flexShrink: 0 }} />
                              </div>
                            )
                          })}
                          
                          {/* Direct Aluno Search Results */}
                          {searchTermModal.trim().length >= 2 && (alunos || []).filter(a => a && a.nome && a.nome.toLowerCase().includes(searchTermModal.toLowerCase())).map(aluno => (
                              <div 
                                key={`direct-aluno-${aluno.id}`} 
                                onClick={() => { 
                                  const turmaOfAluno = turmaOptions.find(t => String(t.id) === String(aluno.turma) || String(t.id) === String(aluno.turmaId));
                                  if (turmaOfAluno) setSelectedGroup(turmaOfAluno);
                                  setSelectedColaborador(aluno); 
                                  setComposeMode(true); 
                                  setSearchTermModal(''); 
                                }} 
                                style={{ 
                                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: '16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', minWidth: 0
                                }}
                              >
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                                  {getInitials(aluno.nome || '')}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aluno.nome || ''}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Busca por aluno</div>
                                </div>
                                <ArrowRight size={16} color="#10b981" style={{ flexShrink: 0 }} />
                              </div>
                          ))}
                        </div>
                      )}

                      {/* Step 2: Select Aluno inside Turma */}
                      {selectedGroup && !selectedColaborador && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                          {(() => {
                            const alunosDaTurmaSelecionada = (alunosDaTurma || []).filter(a => a && (String(a.turma) === String(selectedGroup.id) || String(a.turmaId) === String(selectedGroup.id)) && (a.nome || '').toLowerCase().includes(searchTermModal.toLowerCase()))
                            return alunosDaTurmaSelecionada.map(aluno => (
                              <div 
                                key={aluno.id} 
                                onClick={() => { setSelectedColaborador(aluno); setComposeMode(true); setSearchTermModal(''); }} 
                                style={{ 
                                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: '16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', minWidth: 0
                                }}
                              >
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                                  {getInitials(aluno.nome || '')}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aluno.nome || ''}</div>
                                </div>
                                <ArrowRight size={16} color="#6366f1" style={{ flexShrink: 0 }} />
                              </div>
                            ))
                          })()}
                        </div>
                      )}
                    </>
                  )}

                  {modalTab === 'equipes' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontWeight: 800, margin: 0 }}>Selecione Membros da Equipe</h4>
                        {selectedRecipients.length > 0 && (
                          <button onClick={() => setComposeMode(true)} className="btn btn-primary btn-sm" style={{ borderRadius: 20 }}>Continuar ({selectedRecipients.length}) <Plus size={14} style={{ marginLeft: 4 }} /></button>
                        )}
                      </div>
                      
                      {/* Search Bar for Equipes */}
                      <div style={{ marginBottom: 20, position: 'relative' }}>
                        <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: 15 }} />
                        <input 
                          value={searchTermModal}
                          onChange={e => setSearchTermModal(e.target.value)}
                          placeholder="Buscar equipe ou membro..."
                          style={{ 
                            width: '100%', 
                            height: 48, 
                            borderRadius: 12, 
                            paddingLeft: 44, 
                            border: '1px solid hsl(var(--border-subtle))', 
                            background: 'hsl(var(--bg-main))',
                            fontSize: 14 
                          }}
                        />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                      {equipes?.filter((equipe: any) => {
                          if (!searchTermModal.trim()) return true;
                          const term = searchTermModal.toLowerCase();
                          if (equipe.nome.toLowerCase().includes(term)) return true;
                          const membros = (sysUsers || []).filter((u: any) => (equipe.membrosIds || []).includes(u.id));
                          return membros.some(m => {
                              const membroNome = m.nome || m.dados?.nome || m.email || 'Usuário Sem Nome';
                              return membroNome.toLowerCase().includes(term);
                          });
                      }).map((equipe: any) => {
                        const membros = (sysUsers || []).filter((u: any) => (equipe.membrosIds || []).includes(u.id))
                        // Auto-expand if searching
                        const isExpanded = expandedGroup === equipe.id || searchTermModal.trim().length > 0;
                        
                        return (
                          <div key={equipe.id} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.01)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div 
                               onClick={() => setExpandedGroup(isExpanded ? null : equipe.id)}
                               style={{ padding: '20px 16px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                            >
                               <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                 <Users size={24} color="#10b981" />
                               </div>
                               <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{equipe.nome}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{membros.length} Membros</div>
                               </div>
                               <ChevronRight size={18} color="hsl(var(--text-muted))" style={{ opacity: 0.5, flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                            </div>
                            {isExpanded && (
                               <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {membros.filter((m: any) => {
                                      if (!searchTermModal.trim()) return true;
                                      const membroNome = m.nome || m.dados?.nome || m.email || 'Usuário Sem Nome';
                                      // Only filter members if team name doesn't match
                                      if (equipe.nome.toLowerCase().includes(searchTermModal.toLowerCase())) return true;
                                      return membroNome.toLowerCase().includes(searchTermModal.toLowerCase());
                                  }).map((m: any) => {
                                     const isSelected = selectedRecipients.some(r => r.id === m.id)
                                     const membroNome = m.nome || m.dados?.nome || m.email || 'Usuário Sem Nome'
                                     return (
                                       <div key={m.id} onClick={() => toggleRecipient(m.id, membroNome)} style={{ padding: '10px', borderRadius: 8, border: isSelected ? '1px solid #4f46e5' : '1px solid #e2e8f0', background: isSelected ? 'rgba(79,70,229,0.05)' : 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? 'none' : '1px solid #cbd5e1', background: isSelected ? '#4f46e5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                              {isSelected && <CheckCheck size={14} color="white" />}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: isSelected ? '#4f46e5' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{membroNome}</span>
                                          </div>
                                       </div>
                                     )
                                  })}
                               </div>
                            )}
                          </div>
                        )
                      })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* COMPOSE FORM FOR BOTH MODES */
                <div className="ad-nova-conversa-form" style={{ maxWidth: 600, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 16, marginBottom: 24 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                      <User size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Para:</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))' }}>
                        {modalTab === 'familias' ? (selectedColaborador?.nome || '') : (selectedRecipients.length === 1 ? selectedRecipients[0].nome : `${selectedRecipients.length} Membros da Equipe`)}
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block', color: 'hsl(var(--text-main))' }}>Assunto / Tópico</label>
                    <input 
                      className="form-input" 
                      placeholder="Ex: Assunto / Dúvida" 
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
                    disabled={!composeSubject.trim() || !composeBody.trim() || (modalTab === 'equipes' && selectedRecipients.length === 0)}
                    style={{ 
                      width: '100%', 
                      height: 52, 
                      borderRadius: 16, 
                      background: (!composeSubject.trim() || !composeBody.trim() || (modalTab === 'equipes' && selectedRecipients.length === 0)) ? 'hsl(var(--bg-surface-alt))' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', 
                      color: (!composeSubject.trim() || !composeBody.trim() || (modalTab === 'equipes' && selectedRecipients.length === 0)) ? 'hsl(var(--text-muted))' : 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: (!composeSubject.trim() || !composeBody.trim() || (modalTab === 'equipes' && selectedRecipients.length === 0)) ? 'not-allowed' : 'pointer',
                      boxShadow: (!composeSubject.trim() || !composeBody.trim() || (modalTab === 'equipes' && selectedRecipients.length === 0)) ? 'none' : '0 8px 24px rgba(99, 102, 241, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Send size={18} /> Iniciar Conversa
                  </button>
                </div>
              )}
            </div>
            </>
          ) : activeChat ? (
            <>
               {/* Chat Header */}
               <div className="ad-chat-header" style={{ padding: '20px 32px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                 <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                   <button className="mobile-back-btn" onClick={() => { setActiveChat(null); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                     <ChevronLeft size={24} />
                   </button>
                   {(() => {
                     const isEquipe = activeTab === 'equipes';
                     const senderName = isEquipe ? (activeMessages[0]?.author || activeChat.name) : activeChat.name;
                     const styles = getGroupStyles(senderName)
                     return (
                       <div className="avatar ad-chat-header-avatar" style={{ width: 52, height: 52, background: styles.color, color: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, boxShadow: `0 6px 16px ${styles.color}30` }}>
                         {getInitials(senderName.split(' (')[0])}
                       </div>
                     )
                   })()}
                   <div>
                     <div style={{ fontWeight: 800, fontSize: 18, color: 'hsl(var(--text-main))', marginBottom: 2 }}>{activeChat.tag || 'Conversa sem assunto'}</div>
                     <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                       <div style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(99, 102, 241, 0.1)', color: 'hsl(var(--primary))', fontSize: 11, fontWeight: 700 }}>
                         {(() => {
                           const isEquipe = activeTab === 'equipes';
                           const senderName = isEquipe ? (activeMessages[0]?.author || activeChat.name) : activeChat.name;
                           return `${senderName} • Criado em ${activeChat.startDate || activeChat.date} às ${activeChat.startTime || activeChat.time}`
                         })()}
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
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: isMe ? '1px solid rgba(255,255,255,0.1)' : '1px solid hsl(var(--border-subtle))', gap: 16 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{msg.author || (isMe ? 'Você' : 'Usuário')}</div>
                              <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' }}>{msg.date} às {msg.time}</div>
                           </div>
                           <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                           
                           <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 8, opacity: isMe ? 0.8 : 0.45 }}>
                             {isMe && <CheckCheck size={14} />}
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
                 {activeTab === 'equipes' ? <Shield size={32} style={{ color: 'hsl(var(--primary))', opacity: 0.6 }} /> : <Mail size={32} style={{ color: 'hsl(var(--primary))', opacity: 0.6 }} />}
              </div>
              {activeTab === 'equipes' ? (
                <>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Canais das Equipes</h3>
                  <p style={{ maxWidth: 460, textAlign: 'center', fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--text-muted))', margin: 0 }}>
                    Selecione uma equipe na lista para abrir o canal de comunicação interna.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
      </div>
    </div>
    </>
  )
}
