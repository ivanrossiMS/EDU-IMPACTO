'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  MessageSquare, 
  Search, 
  Users, 
  Building2, 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Clock, 
  FileText, 
  Download, 
  Plus, 
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  CreditCard,
  GraduationCap,
  ArrowUpRight,
  Phone,
  Sparkles,
  ChevronDown,
  ChevronRight,
  User,
  Heart,
  Lock,
  Trash2,
  Maximize2,
  Archive,
  ArchiveRestore
} from 'lucide-react'
import { toast } from 'sonner'
import { usePathname } from 'next/navigation'
import { useChatStore, ChatConversationMeta, formatTurmaBadge } from '@/lib/chatStore'
import { 
  getCachedMessages, 
  prefetchConversationMessages, 
  prefetchBatchConversations, 
  appendCachedMessage, 
  updateCachedMessage, 
  removeCachedMessage 
} from '@/lib/chatMessagesCache'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { checkChatBusinessHours, ChatBlockedNoticeCard } from './ChatBlockedNotice'
import { checkIsAdmin, checkIsCollaboratorOrTeacher, checkIsStaffManagement, sortTurmasByName } from '@/lib/chatPermissions'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'
import { getInitials } from '@/lib/utils'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { playWhatsAppSendSound } from '@/lib/chatAudio'
import { triggerHaptic } from '@/lib/utils/haptics'
import { HeicSafeImage } from './HeicSafeImage'
import { ChatMediaViewerModal, ChatMediaItem } from './ChatMediaViewerModal'
import { PdfBubbleCard } from './PdfBubbleCard'
import { 
  compressImage, 
  compressVideo, 
  compressPDF, 
  extractVideoThumbnail, 
  thumbnailDataUrlToFile 
} from '@/lib/mediaCompressor'

function getSectorMeta(setor?: string) {
  const s = (setor || '').toLowerCase()
  if (s.includes('finan') || s.includes('mensal')) {
    return {
      Icon: CreditCard,
      bg: '#ecfdf5',
      color: '#059669',
      border: '#a7f3d0',
      label: 'Financeiro'
    }
  }
  if (s.includes('secret')) {
    return {
      Icon: FileText,
      bg: '#f0f9ff',
      color: '#0284c7',
      border: '#bae6fd',
      label: 'Secretaria'
    }
  }
  if (s.includes('baby')) {
    return {
      Icon: Sparkles,
      bg: '#fdf2f8',
      color: '#db2777',
      border: '#fbcfe8',
      label: 'Baby'
    }
  }
  if (s.includes('recep') || s.includes('atend')) {
    return {
      Icon: MessageSquare,
      bg: '#fffbeb',
      color: '#d97706',
      border: '#fde68a',
      label: 'Recepção'
    }
  }
  if (s.includes('coord') || s.includes('pedag') || s.includes('infantil') || s.includes('fund') || s.includes('médio')) {
    return {
      Icon: GraduationCap,
      bg: '#f5f3ff',
      color: '#7c3aed',
      border: '#ddd6fe',
      label: 'Coordenação'
    }
  }
  return {
    Icon: Phone,
    bg: '#ecfdf5',
    color: '#059669',
    border: '#a7f3d0',
    label: 'WhatsApp'
  }
}

export function ChatFullView({ alunoId }: { alunoId?: string }) {
  const { currentUser } = useApp()
  const { adConfig } = useAgendaDigital()
  useChatRealtime(alunoId)

  const [activeTab, setActiveTab] = useState<'conversas' | 'contatos'>('conversas')
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<any[]>([])
  const [contactsData, setContactsData] = useState<{
    role?: string
    equipes: any[]
    turmas: any[]
    colaboradores: any[]
    alunos?: any[]
    whatsappChannels?: any[]
  }>({ equipes: [], turmas: [], colaboradores: [] })

  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selectedConv, setSelectedConv] = useState<ChatConversationMeta | null>(null)
  const [showArchivedView, setShowArchivedView] = useState(false)

  const lastArchiveUpdated = useChatStore(s => s.lastArchiveUpdated)

  useEffect(() => {
    if (!lastArchiveUpdated) return
    setConversations(prev => prev.map(c => 
      c.id === lastArchiveUpdated.convId 
        ? { ...c, isArchived: lastArchiveUpdated.isArchived }
        : c
    ))
    setSelectedConv(prev => {
      if (prev && prev.id === lastArchiveUpdated.convId) {
        return { ...prev, isArchived: lastArchiveUpdated.isArchived }
      }
      return prev
    })
  }, [lastArchiveUpdated])

  const handleToggleArchive = async (convId: string, targetArchived: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    // Optimistic update
    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, isArchived: targetArchived } : c
    ))
    setSelectedConv(prev => {
      if (prev && prev.id === convId) {
        return { ...prev, isArchived: targetArchived }
      }
      return prev
    })
    useChatStore.getState().notifyArchiveChanged(convId, targetArchived)

    try {
      const res = await fetch('/api/chat/conversations/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId,
          is_archived: targetArchived,
          aluno_id: alunoId || undefined
        })
      })
      if (!res.ok) {
        throw new Error('Falha ao atualizar arquivo')
      }
      toast.success(targetArchived ? 'Conversa arquivada' : 'Conversa desarquivada')
    } catch (err: any) {
      // Revert optimistic update
      setConversations(prev => prev.map(c => 
        c.id === convId ? { ...c, isArchived: !targetArchived } : c
      ))
      setSelectedConv(prev => {
        if (prev && prev.id === convId) {
          return { ...prev, isArchived: !targetArchived }
        }
        return prev
      })
      useChatStore.getState().notifyArchiveChanged(convId, !targetArchived)
      toast.error('Erro ao arquivar conversa')
    }
  }

  const formatTimeSnippet = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      const now = new Date()
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch {
      return ''
    }
  }

  // Mensagens da conversa selecionada no painel direito
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; status: string; percent: number }>({
    active: false,
    status: '',
    percent: 0
  })
  const [activeMediaViewer, setActiveMediaViewer] = useState<ChatMediaItem | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesContentRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const isFirstLoadRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const userPerfil = (currentUser?.perfil || '').trim()
  const userCargo = (currentUser?.cargo || '').trim()
  const isAdmin = checkIsAdmin(userPerfil, userCargo)
  const isSchoolStaff = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)

  const isFamilyOrStudent = 
    userPerfil.toLowerCase().includes('família') || 
    userPerfil.toLowerCase().includes('familia') || 
    userPerfil.toLowerCase().includes('responsável') || 
    userPerfil.toLowerCase().includes('responsavel') || 
    userCargo.toLowerCase().includes('aluno') || 
    userCargo.toLowerCase().includes('responsável') || 
    userCargo.toLowerCase().includes('responsavel') || 
    (currentUser?.cargo === 'Aluno')

  const currentUserId = 
    (currentUser?.cargo === 'Aluno' || currentUser?.perfil === 'Aluno')
      ? (alunoId || (currentUser as any)?.aluno_id || currentUser?.id || 'me')
      : (currentUser?.id || (currentUser as any)?.responsavel_id || (currentUser as any)?.colaborador_id || 'me')

  const isCollaboratorOrAdmin = isAdmin || isSchoolStaff

  // Avaliação de expediente e recursos de chat configurados pelo Admin
  const businessHoursStatus = checkChatBusinessHours(
    adConfig?.chatAuto?.horarioAtendimento,
    currentUser?.nome || 'Família',
    'Colégio Impacto'
  )
  const isBlocked = businessHoursStatus.isClosed && isFamilyOrStudent

  const permitirImagens = adConfig?.chatAuto?.recursos?.permitirImagens !== false
  const permitirDocumentos = adConfig?.chatAuto?.recursos?.permitirDocumentos !== false
  const canAttachAny = isSchoolStaff || permitirImagens || permitirDocumentos

  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)

  const handleExecuteDeleteMessage = async () => {
    if (!messageToDelete) return
    const msgId = messageToDelete
    setIsDeletingMessage(true)

    setMessages(prev => prev.filter(m => m.id !== msgId))
    setMessageToDelete(null)

    try {
      const res = await fetch(`/api/chat/messages?message_id=${msgId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao excluir mensagem')
        if (selectedConv?.id) loadMessages(selectedConv.id)
      } else {
        toast.success('Mensagem apagada')
        loadConversations()
      }
    } catch {
      toast.error('Erro de conexão ao excluir mensagem')
      if (selectedConv?.id) loadMessages(selectedConv.id)
    } finally {
      setIsDeletingMessage(false)
    }
  }

  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeReactionMsgId) return
    const handleClickOutside = () => setActiveReactionMsgId(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [activeReactionMsgId])

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      const currentMeta = m.metadata || {}
      let reactions: any[] = Array.isArray(currentMeta.reactions) ? [...currentMeta.reactions] : []
      const existingIdx = reactions.findIndex(r => String(r.user_id) === String(currentUserId) && r.emoji === emoji)

      if (existingIdx >= 0) {
        reactions.splice(existingIdx, 1)
      } else {
        reactions = reactions.filter(r => String(r.user_id) !== String(currentUserId))
        reactions.push({
          emoji,
          user_id: String(currentUserId),
          user_name: currentUser?.nome || 'Você',
          created_at: new Date().toISOString()
        })
      }

      return {
        ...m,
        metadata: {
          ...currentMeta,
          reactions
        }
      }
    }))

    triggerHaptic('selection')

    try {
      const res = await fetch('/api/chat/messages/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          emoji,
          aluno_id: alunoId || undefined
        })
      })
      if (!res.ok) {
        if (selectedConv?.id) loadMessages(selectedConv.id)
      }
    } catch {
      if (selectedConv?.id) loadMessages(selectedConv.id)
    }
  }

  const pathname = usePathname()
  const isColaboradorView = pathname?.includes('/agenda-digital/colaborador')
  const isAdminView = pathname?.includes('/agenda-digital/admin') || isAdmin
  const isStaffView = isColaboradorView || isAdminView || isSchoolStaff
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null)
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null)
  const [turmaStudentsData, setTurmaStudentsData] = useState<Record<string, { loading: boolean; alunos: any[]; error?: string }>>({})
  const [startingChatId, setStartingChatId] = useState<string | null>(null)
  const [searchedStudents, setSearchedStudents] = useState<any[]>([])
  const [isSearchingStudents, setIsSearchingStudents] = useState(false)

  // Efeito debounced para buscar alunos por nome diretamente no banco
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setSearchedStudents([])
      setIsSearchingStudents(false)
      return
    }

    setIsSearchingStudents(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/chat/students/search?q=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const data = await res.json()
          const list = data.students || []
          setSearchedStudents(list)
          if (list.length === 1) {
            setExpandedAlunoId(list[0].id)
          }
        }
      } catch (err) {
        console.error('Erro na busca de alunos:', err)
      } finally {
        setIsSearchingStudents(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Pré-carregamento em background dos alunos e responsáveis da turma (0ms no clique)
  const prefetchTurma = useCallback(async (grupoId: string, turmaId?: string) => {
    const key = grupoId || turmaId || ''
    if (!key || (turmaStudentsData[key]?.alunos && turmaStudentsData[key].alunos.length > 0)) {
      return
    }

    try {
      const qp = new URLSearchParams()
      if (grupoId) qp.set('grupo_id', grupoId)
      if (turmaId) qp.set('turma_id', turmaId)

      const res = await fetch(`/api/chat/turma-students?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTurmaStudentsData(prev => ({
          ...prev,
          [key]: { loading: false, alunos: data.alunos || [] }
        }))
      }
    } catch (_) {}
  }, [turmaStudentsData])

  const handleToggleTurma = async (grupoId: string, turmaId?: string) => {
    const key = grupoId || turmaId || ''
    if (expandedTurmaId === key) {
      setExpandedTurmaId(null)
      return
    }

    setExpandedTurmaId(key)

    if (turmaStudentsData[key]?.alunos && turmaStudentsData[key]?.alunos.length > 0) {
      return
    }

    setTurmaStudentsData(prev => ({
      ...prev,
      [key]: { loading: true, alunos: [] }
    }))

    try {
      const qp = new URLSearchParams()
      if (grupoId) qp.set('grupo_id', grupoId)
      if (turmaId) qp.set('turma_id', turmaId)

      const res = await fetch(`/api/chat/turma-students?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTurmaStudentsData(prev => ({
          ...prev,
          [key]: { loading: false, alunos: data.alunos || [] }
        }))
      } else {
        setTurmaStudentsData(prev => ({
          ...prev,
          [key]: { loading: false, alunos: [], error: 'Erro ao carregar alunos' }
        }))
      }
    } catch (e: any) {
      setTurmaStudentsData(prev => ({
        ...prev,
        [key]: { loading: false, alunos: [], error: e.message }
      }))
    }
  }

  const handleToggleAluno = (alunoId: string) => {
    setExpandedAlunoId(prev => (prev === alunoId ? null : alunoId))
  }

  const getTargetConvId = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('conversation_id') || urlParams.get('openChat') || urlParams.get('id')
    }
    return null
  }

  // 1. Carregar conversas (com SWR para resposta imediata)
  const loadConversations = async (silent = false) => {
    if (!currentUser) return
    if (!silent && conversations.length === 0) {
      setLoadingConversations(true)
    }
    try {
      const qp = new URLSearchParams()
      if (alunoId) {
        qp.set('aluno_id', alunoId)
      } else if (isStaffView) {
        qp.set('context', 'colaborador')
      }
      const res = await fetch(`/api/chat/conversations?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const convList = data.conversations || []
        setConversations(convList)
        
        const deepLinkId = getTargetConvId()
        if (convList.length > 0) {
          if (deepLinkId) {
            const target = convList.find((c: any) => c.id === deepLinkId)
            if (target) {
              handleSelectConv(target)
            } else if (!selectedConv && typeof window !== 'undefined' && window.innerWidth > 768) {
              const firstActive = convList.find((c: any) => !c.isArchived) || convList[0]
              handleSelectConv(firstActive)
            }
          } else if (!selectedConv && typeof window !== 'undefined' && window.innerWidth > 768) {
            const firstActive = convList.find((c: any) => !c.isArchived) || convList[0]
            handleSelectConv(firstActive)
          }
        }
        prefetchBatchConversations(convList.slice(0, 8).map((c: any) => c.id))
      }
    } catch (_) {}
    finally {
      setLoadingConversations(false)
    }
  }

  useEffect(() => {
    const deepLinkId = getTargetConvId()
    if (deepLinkId && conversations.length > 0) {
      const target = conversations.find(c => c.id === deepLinkId)
      if (target && selectedConv?.id !== deepLinkId) {
        handleSelectConv(target)
      }
    }
  }, [conversations])

  // 2. Carregar contatos (com SWR)
  const loadContacts = async (silent = false) => {
    if (!currentUser) return
    const hasData = (contactsData.turmas && contactsData.turmas.length > 0) ||
                    (contactsData.alunos && contactsData.alunos.length > 0) ||
                    (contactsData.colaboradores && contactsData.colaboradores.length > 0)
    if (!silent && !hasData) {
      setLoadingContacts(true)
    }
    try {
      const qp = new URLSearchParams()
      if (alunoId) {
        qp.set('aluno_id', alunoId)
      } else if (isStaffView) {
        qp.set('context', 'colaborador')
      }
      const res = await fetch(`/api/chat/contacts?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContactsData(data)
      }
    } catch (_) {}
    finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    loadConversations(conversations.length > 0)
    loadContacts((contactsData.turmas?.length || 0) > 0 || (contactsData.alunos?.length || 0) > 0)
  }, [currentUser, alunoId])

  // Pré-carregar silenciosamente primeira turma ao mudar para aba contatos
  useEffect(() => {
    if (activeTab === 'contatos' && contactsData.turmas && contactsData.turmas.length > 0) {
      const firstTurma = contactsData.turmas[0]
      if (firstTurma) {
        prefetchTurma(firstTurma.id, firstTurma.turma_id)
      }
    }
  }, [activeTab, contactsData.turmas, prefetchTurma])

  const scrollToBottom = useCallback((smooth = false) => {
    const container = scrollContainerRef.current
    if (container) {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      } else {
        container.scrollTop = container.scrollHeight
      }
    }
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
      } catch (_) {}
    }
  }, [])

  const scrollToBottomMultiPass = useCallback((smooth = false) => {
    scrollToBottom(smooth)
    requestAnimationFrame(() => scrollToBottom(smooth))
    setTimeout(() => scrollToBottom(smooth), 50)
    setTimeout(() => scrollToBottom(smooth), 150)
    setTimeout(() => scrollToBottom(smooth), 280)
  }, [scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (isFirstLoadRef.current) return
    const threshold = 100
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    isNearBottomRef.current = isBottom
  }, [])

  useEffect(() => {
    if (selectedConv?.id) {
      isNearBottomRef.current = true
      isFirstLoadRef.current = true
      const timer = setTimeout(() => {
        isFirstLoadRef.current = false
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedConv?.id])

  useEffect(() => {
    const el = scrollContainerRef.current
    const content = messagesContentRef.current
    if (!el) return

    let prevHeight = el.scrollHeight

    const checkAndScroll = () => {
      if (isFirstLoadRef.current || isNearBottomRef.current) {
        if (el.scrollHeight !== prevHeight) {
          prevHeight = el.scrollHeight
          el.scrollTop = el.scrollHeight
          if (messagesEndRef.current) {
            try {
              messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
            } catch (_) {}
          }
        }
      }
    }

    const observer = new ResizeObserver(() => {
      checkAndScroll()
    })

    observer.observe(el)
    if (content) {
      observer.observe(content)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isFirstLoadRef.current || isNearBottomRef.current) {
      scrollToBottomMultiPass(false)
    }
  }, [messages, scrollToBottomMultiPass])

  const loadMessages = async (convId: string, silent = false) => {
    const userPerfil = (currentUser?.perfil || '').trim()
    const userCargo = (currentUser?.cargo || '').trim()
    const isColabOrTeacher = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)
    const canHaveLeft = isColabOrTeacher && isColaboradorView

    const cached = getCachedMessages(convId)
    if (cached && cached.messages && cached.messages.length > 0) {
      // 0ms instantâneo: renderiza mensagens imediatamente
      setMessages(cached.messages)
      if (cached.hasLeft !== undefined) {
        setSelectedConv(prev => prev && prev.id === convId ? { ...prev, hasLeft: Boolean(canHaveLeft && cached.hasLeft) } : prev)
      }
      setLoadingMessages(false)
      scrollToBottomMultiPass(false)

      // Revalidação em segundo plano sem bloquear a interface (SWR)
      prefetchConversationMessages(convId, { force: true }).then(data => {
        if (data) {
          setMessages(data.messages || [])
          if (data.hasLeft !== undefined) {
            setSelectedConv(prev => prev && prev.id === convId ? { ...prev, hasLeft: Boolean(canHaveLeft && data.hasLeft) } : prev)
          }
          if (isNearBottomRef.current || isFirstLoadRef.current) {
            scrollToBottomMultiPass(false)
          }
        }
      })
    } else {
      if (!silent) setLoadingMessages(true)
      try {
        const data = await prefetchConversationMessages(convId, { force: true })
        if (data) {
          setMessages(data.messages || [])
          if (data.hasLeft !== undefined) {
            setSelectedConv(prev => prev && prev.id === convId ? { ...prev, hasLeft: Boolean(canHaveLeft && data.hasLeft) } : prev)
          }
          scrollToBottomMultiPass(false)
        }
      } catch (_) {}
      finally {
        setLoadingMessages(false)
      }
    }
  }

  const handleSelectConv = (conv: any) => {
    isNearBottomRef.current = true
    isFirstLoadRef.current = true
    setSelectedConv(conv)
    loadMessages(conv.id)
    // Zera imediatamente no estado local para feedback visual instantâneo
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    if (conv.unreadCount > 0) {
      useChatStore.getState().setUnreadTotal(Math.max(0, useChatStore.getState().unreadTotal - conv.unreadCount))
    }
    fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        conversation_id: conv.id, 
        user_id: currentUserId,
        aluno_id: conv.aluno_id || alunoId || undefined,
        context: conv.context || (isColaboradorView ? 'colaborador' : 'familia')
      })
    }).then(res => {
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('chat:unread-changed'))
        window.dispatchEvent(new CustomEvent('chat:conversation-updated'))
      }
    }).catch(() => {})
  }

  // Ouvinte de mensagens realtime
  useEffect(() => {
    const handleReceived = (e: CustomEvent) => {
      const msg = e.detail
      if (msg && msg.conversation_id) {
        appendCachedMessage(msg.conversation_id, msg)
      }
      if (msg && msg.conversation_id === selectedConv?.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (isNearBottomRef.current || isFirstLoadRef.current) {
          scrollToBottomMultiPass(true)
        }
      }
      loadConversations()
    }

    const handleUpdated = (e: CustomEvent) => {
      const msg = e.detail
      if (msg && msg.conversation_id) {
        if (msg.is_deleted) {
          removeCachedMessage(msg.conversation_id, msg.id)
        } else {
          updateCachedMessage(msg.conversation_id, msg)
        }
      }
      if (msg && msg.conversation_id === selectedConv?.id) {
        if (msg.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== msg.id))
        } else {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m))
        }
      }
      loadConversations()
    }

    const handleDeleted = (e: CustomEvent) => {
      const msg = e.detail
      if (msg && msg.conversation_id) {
        removeCachedMessage(msg.conversation_id, msg.id)
      }
      if (msg && (msg.conversation_id === selectedConv?.id || !msg.conversation_id)) {
        setMessages(prev => prev.filter(m => m.id !== msg.id))
      }
      loadConversations()
    }

    const handleUnreadChanged = () => {
      loadConversations()
    }

    window.addEventListener('chat:message-received' as any, handleReceived)
    window.addEventListener('chat:message-updated' as any, handleUpdated)
    window.addEventListener('chat:message-deleted' as any, handleDeleted)
    window.addEventListener('chat:unread-changed' as any, handleUnreadChanged)

    return () => {
      window.removeEventListener('chat:message-received' as any, handleReceived)
      window.removeEventListener('chat:message-updated' as any, handleUpdated)
      window.removeEventListener('chat:message-deleted' as any, handleDeleted)
      window.removeEventListener('chat:unread-changed' as any, handleUnreadChanged)
    }
  }, [selectedConv?.id])

  const handleSendMessage = async (
    customText?: string,
    contentType: 'text' | 'image' | 'video' | 'file' = 'text',
    metadata?: any
  ) => {
    const textToSend = customText !== undefined ? customText : inputText.trim()
    if (!textToSend && !metadata?.file_url) return
    if (!selectedConv?.id || isSending) return

    const isGroupConv = !!selectedConv?.isGroup || selectedConv?.type === 'group'
    const isColabOrTeacher = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)
    const isReadOnlyConv = isGroupConv && (!isColaboradorView || !isColabOrTeacher)
    if (isReadOnlyConv) {
      toast.error(!isColaboradorView
        ? (isColabOrTeacher
            ? 'No Modo Família, o envio de mensagens em grupos da turma é desativado. Acesse pelo Modo Colaborador para enviar.'
            : 'No Modo Família, o envio de mensagens em grupos da turma é desativado.')
        : 'Você não tem permissão para enviar mensagens neste grupo.'
      )
      return
    }

    setIsSending(true)
    if (customText === undefined) {
      setInputText('')
    }
    playWhatsAppSendSound()
    triggerHaptic('selection')

    const tempId = 'temp-' + Date.now()
    const optimistic = {
      id: tempId,
      conversation_id: selectedConv.id,
      sender_id: currentUserId,
      content: textToSend,
      content_type: contentType,
      metadata: metadata || null,
      status: 'sending',
      created_at: new Date().toISOString()
    }

    appendCachedMessage(selectedConv.id, optimistic)
    setMessages(prev => [...prev, optimistic])
    isNearBottomRef.current = true
    scrollToBottomMultiPass(true)

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConv.id,
          content: textToSend,
          content_type: contentType,
          metadata: metadata || {},
          sender_id: currentUserId,
          sender_name: currentUser?.nome || 'Você',
          sender_perfil: currentUser?.perfil || currentUser?.cargo || 'Usuário',
          context: isColaboradorView ? 'colaborador' : 'familia',
          isFamilyInitiated: !isColaboradorView
        })
      })

      if (res.ok) {
        const data = await res.json()
        const saved = data.message
        if (saved) {
          updateCachedMessage(selectedConv.id, saved)
        }
        setMessages(prev => {
          const alreadyHasRealtime = prev.some(m => m.id === saved.id)
          let nextList = prev
          if (alreadyHasRealtime) {
            nextList = prev.filter(m => m.id !== tempId)
          } else {
            nextList = prev.map(m => m.id === tempId ? saved : m)
          }
          if (data.auto_reply && !nextList.some(m => m.id === data.auto_reply.id)) {
            nextList = [...nextList, data.auto_reply]
          }
          return nextList
        })
        if (data.auto_reply) {
          appendCachedMessage(selectedConv.id, data.auto_reply)
        }
        scrollToBottomMultiPass(true)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao enviar mensagem')
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
    } finally {
      setIsSending(false)
    }
  }

  // Upload com compressão de imagens, vídeos e documentos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileKind: 'media' | 'doc') => {
    const rawFile = e.target.files?.[0]
    if (!rawFile || !selectedConv?.id) return

    const isGroupConv = !!selectedConv?.isGroup || selectedConv?.type === 'group'
    const isColabOrTeacher = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)
    const isReadOnlyConv = isGroupConv && (!isColaboradorView || !isColabOrTeacher)
    if (isReadOnlyConv) {
      toast.error(!isColaboradorView
        ? 'No Modo Família, o envio em grupos da turma é desativado.'
        : 'Você não tem permissão para enviar mensagens neste grupo.'
      )
      return
    }

    setUploadingFile(true)
    setShowAttachMenu(false)
    setUploadProgress({ active: true, status: 'Preparando arquivo...', percent: 10 })

    try {
      const isVideo = rawFile.type.startsWith('video/') || /\.(mov|mp4|webm|m4v|3gp|mkv|avi)$/i.test(rawFile.name)
      const isImage = rawFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif|gif)$/i.test(rawFile.name)
      const isPdf = rawFile.type === 'application/pdf' || /\.pdf$/i.test(rawFile.name)

      if (isVideo) {
        setUploadProgress({ active: true, status: 'Extraindo miniatura do vídeo...', percent: 15 })

        let thumbUrl: string | undefined = undefined
        let duration = 0
        try {
          const thumbResult = await extractVideoThumbnail(rawFile)
          duration = thumbResult.duration
          if (thumbResult.thumbnailUrl) {
            const thumbFile = await thumbnailDataUrlToFile(thumbResult.thumbnailUrl, 'video_thumb')
            if (thumbFile) {
              const thumbUpload = await uploadFileToSupabase({
                bucket: 'comunicados-midia',
                folder: 'chat/thumbs',
                file: thumbFile,
                usageType: 'common'
              })
              if (thumbUpload.ok && thumbUpload.url) {
                thumbUrl = thumbUpload.url
              }
            }
          }
        } catch (thumbErr) {
          console.warn('[Chat] Erro ao extrair thumbnail:', thumbErr)
        }

        setUploadProgress({ active: true, status: 'Otimizando vídeo...', percent: 25 })
        let processedVideo: File | Blob = rawFile
        try {
          processedVideo = await compressVideo(rawFile, (p) => {
            setUploadProgress({
              active: true,
              status: `Comprimindo vídeo... ${p}%`,
              percent: Math.min(85, 25 + Math.round(p * 0.6))
            })
          })
        } catch (vErr) {
          console.warn('[Chat] Erro na compressão do vídeo, mantendo original:', vErr)
        }

        const finalVideoFile = processedVideo instanceof File
          ? processedVideo
          : new File([processedVideo], rawFile.name.replace(/\.[^/.]+$/, '') + '.mp4', {
              type: processedVideo.type || 'video/mp4'
            })

        setUploadProgress({ active: true, status: 'Enviando vídeo...', percent: 88 })
        const res = await uploadFileToSupabase({
          bucket: 'comunicados-midia',
          folder: 'chat/videos',
          file: finalVideoFile,
          usageType: 'common'
        })

        if (res.ok && res.url) {
          const fileMeta = {
            file_name: finalVideoFile.name,
            file_size: finalVideoFile.size,
            file_url: res.url,
            mime_type: finalVideoFile.type || 'video/mp4',
            thumbnail_url: thumbUrl,
            duration
          }
          await handleSendMessage(
            '🎥 Vídeo',
            'video',
            fileMeta
          )
          toast.success('Vídeo enviado com sucesso!')
        } else {
          toast.error('Erro ao enviar vídeo: ' + (res.error || 'Falha no envio'))
        }
      } else if (isImage) {
        setUploadProgress({ active: true, status: 'Otimizando foto...', percent: 25 })
        let processedImage: File = rawFile
        try {
          processedImage = await compressImage(rawFile, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.78,
            format: 'image/webp'
          })
        } catch (imgErr) {
          console.warn('[Chat] Erro ao comprimir foto:', imgErr)
        }

        setUploadProgress({ active: true, status: 'Enviando foto...', percent: 75 })
        const res = await uploadFileToSupabase({
          bucket: 'comunicados-midia',
          folder: 'chat/fotos',
          file: processedImage,
          usageType: 'common'
        })

        if (res.ok && res.url) {
          const fileMeta = {
            file_name: processedImage.name,
            file_size: processedImage.size,
            file_url: res.url,
            mime_type: processedImage.type || 'image/webp'
          }
          await handleSendMessage(
            '📷 Foto',
            'image',
            fileMeta
          )
          toast.success('Foto enviada com sucesso!')
        } else {
          toast.error('Erro ao enviar foto: ' + (res.error || 'Falha no envio'))
        }
      } else {
        // Documento / PDF / Arquivo
        let processedDoc: File = rawFile
        if (isPdf && rawFile.size > 300 * 1024) {
          setUploadProgress({ active: true, status: 'Otimizando PDF...', percent: 30 })
          try {
            processedDoc = await compressPDF(rawFile, (p) => {
              setUploadProgress({ active: true, status: `Comprimindo PDF... ${p}%`, percent: Math.min(80, p) })
            })
          } catch (pdfErr) {
            console.warn('[Chat] Erro ao comprimir PDF:', pdfErr)
          }
        }

        setUploadProgress({ active: true, status: 'Enviando documento...', percent: 85 })
        const res = await uploadFileToSupabase({
          bucket: 'comunicados-midia',
          folder: 'chat/documentos',
          file: processedDoc,
          usageType: 'common'
        })

        if (res.ok && res.url) {
          const fileMeta = {
            file_name: processedDoc.name,
            file_size: processedDoc.size,
            file_url: res.url,
            mime_type: processedDoc.type || 'application/octet-stream'
          }
          await handleSendMessage(
            processedDoc.name,
            'file',
            fileMeta
          )
          toast.success('Documento enviado com sucesso!')
        } else {
          toast.error('Erro ao enviar documento: ' + (res.error || 'Falha no envio'))
        }
      }
    } catch (err: any) {
      toast.error('Erro no envio: ' + (err.message || 'Falha'))
    } finally {
      setUploadingFile(false)
      setUploadProgress({ active: false, status: '', percent: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (docInputRef.current) docInputRef.current.value = ''
    }
  }

  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string | null>(null)

  const handleStartChatFromContact = async (item: any) => {
    const isColabOrAdmin = 
      currentUser?.perfil !== 'Família' && 
      currentUser?.perfil !== 'Responsável' && 
      currentUser?.cargo !== 'Aluno' && 
      currentUser?.cargo !== 'Responsável'

    const chatKey = item.alunoId && item.targetUserId !== item.alunoId ? `${item.alunoId}_${item.targetUserId}` : item.targetUserId

    setStartingChatId(chatKey)

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type || 'direct',
          targetUserId: item.targetUserId,
          targetUserName: item.targetUserName,
          targetUserPerfil: item.targetUserPerfil,
          title: item.title,
          alunoId: item.alunoId || alunoId || undefined,
          colaboradorId: isColabOrAdmin ? currentUser?.id : undefined
        })
      })

      if (res.ok) {
        const data = await res.json()
        const conv = data.conversation
        const convMeta: ChatConversationMeta = {
          id: conv.id,
          type: 'direct',
          title: item.title || conv.title || 'Chat',
          subtitle: item.subtitle || 'online',
          isGroup: false,
          turma_id: conv.turma_id,
          grupo_id: conv.grupo_id,
          aluno_id: conv.aluno_id || item.alunoId || null,
          aluno_nome: item.alunoNome || null,
          aluno_turma: item.turmaNome || null,
          ano_letivo: conv.ano_letivo || item.ano_letivo || '2026'
        }
        handleSelectConv(convMeta)
        setActiveTab('conversas')
      }
    } catch (e) {
      alert('Erro ao iniciar conversa')
    } finally {
      setStartingChatId(null)
    }
  }

  const q = searchQuery.toLowerCase().trim()
  const filteredConversations = conversations.filter(c => {
    // Não exibir em conversas se nenhuma mensagem foi enviada
    if (!c.lastMessageText || !c.lastMessageText.trim()) return false

    const matchesSearch = !q || c.title.toLowerCase().includes(q) || (c.lastMessageText || '').toLowerCase().includes(q) || (c.aluno_nome || '').toLowerCase().includes(q)
    
    let matchesStudent = true
    if (selectedStudentFilter) {
      const directMatch = String(c.aluno_id) === String(selectedStudentFilter)
      const selectedStudentObj = (contactsData.alunos || []).find((a: any) => String(a.id) === String(selectedStudentFilter))
      const studentTurmasList = (selectedStudentObj?.turmaGrupos && selectedStudentObj.turmaGrupos.length > 0)
        ? selectedStudentObj.turmaGrupos
        : (selectedStudentObj?.turmaGrupo ? [selectedStudentObj.turmaGrupo] : [])

      const turmaMatch = selectedStudentObj && (
        (c.turma_id && (
          c.turma_id === selectedStudentObj.turma ||
          c.turma_id === `sync-${selectedStudentObj.turma}` ||
          studentTurmasList.some((tg: any) => tg.turma_id === c.turma_id || tg.id === c.turma_id)
        )) ||
        (c.grupo_id && (
          (selectedStudentObj.turmaGrupo?.id && c.grupo_id === selectedStudentObj.turmaGrupo.id) ||
          studentTurmasList.some((tg: any) => tg.id === c.grupo_id)
        ))
      )
      matchesStudent = !!(directMatch || turmaMatch)
    }

    return matchesSearch && matchesStudent
  })

  const activeConversations = filteredConversations.filter(c => !c.isArchived)
  const archivedConversations = filteredConversations.filter(c => !!c.isArchived)
  const totalArchivedCount = conversations.filter(c => !!(c.lastMessageText && c.lastMessageText.trim()) && !!c.isArchived).length
  const displayConversations = showArchivedView ? archivedConversations : activeConversations

  const whatsappChannels = (contactsData.whatsappChannels && contactsData.whatsappChannels.length > 0)
    ? contactsData.whatsappChannels
    : (adConfig?.contatosWhatsapp || []).filter((c: any) => c.ativo).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))

  const filteredWhatsappChannels = (whatsappChannels || []).filter((c: any) =>
    !q ||
    (c.setor || '').toLowerCase().includes(q) ||
    (c.nome || '').toLowerCase().includes(q) ||
    (c.descricao || '').toLowerCase().includes(q)
  )

  const filteredTurmas = sortTurmasByName((contactsData.turmas || []).filter(t => !q || (t.nome || '').toLowerCase().includes(q)))
  const filteredColabs = (contactsData.colaboradores || []).filter(c => !q || (c.nome || '').toLowerCase().includes(q) || ((c.cargo || c.perfil || '')).toLowerCase().includes(q))

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 120px)',
        minHeight: 550,
        background: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)'
      }}
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* COLUNA ESQUERDA: LISTA DE CONVERSAS / CONTATOS               */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          width: 360,
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          flexShrink: 0
        }}
      >
        {/* Header Superior Esquerdo */}
        <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#008069', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>Mensagens</h3>
                <span style={{ fontSize: 11, color: '#64748b' }}>Atendimento Direto • Impacto EDU</span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab(activeTab === 'conversas' ? 'contatos' : 'conversas')
                setShowArchivedView(false)
              }}
              style={{
                background: activeTab === 'contatos'
                  ? 'linear-gradient(135deg, #059669 0%, #008069 100%)'
                  : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: activeTab === 'contatos' ? '1.5px solid #059669' : '1.5px solid #34d399',
                color: activeTab === 'contatos' ? '#ffffff' : '#065f46',
                borderRadius: 12,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeTab === 'contatos'
                  ? '0 4px 12px rgba(5, 150, 105, 0.35)'
                  : '0 2px 8px rgba(16, 185, 129, 0.2)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                letterSpacing: '0.2px'
              }}
            >
              {activeTab === 'conversas' ? (
                <>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#059669',
                      color: '#ffffff'
                    }}
                  >
                    <Plus size={12} strokeWidth={3} />
                  </span>
                  <span>Novo Chat</span>
                </>
              ) : (
                'Ver Conversas'
              )}
            </button>
          </div>

          {/* Barra de Busca */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #cbd5e1'
            }}
          >
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13 }}
            />
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {activeTab === 'conversas' ? (
            <div>
              {/* Filtro por Aluno / Filho quando o responsável tiver mais de um filho (SEMPRE VISÍVEL) */}
              {contactsData.alunos && contactsData.alunos.length > 1 && (
                <div style={{ display: 'flex', gap: 6, padding: '2px 2px 10px 2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentFilter(null)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: !selectedStudentFilter ? '#008069' : '#f1f5f9',
                      color: !selectedStudentFilter ? '#ffffff' : '#475569',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Todos os Filhos
                  </button>
                  {contactsData.alunos.map((a: any) => {
                    const isSelected = selectedStudentFilter === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedStudentFilter(isSelected ? null : a.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isSelected ? '#008069' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#475569',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {a.nome.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              )}

              {showArchivedView && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 4px 10px 4px',
                  borderBottom: '1.5px solid #e2e8f0',
                  marginBottom: 10
                }}>
                  <button
                    type="button"
                    onClick={() => setShowArchivedView(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'transparent',
                      border: 'none',
                      color: '#008069',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Voltar para conversas</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Archive size={14} color="#64748b" />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                      {archivedConversations.length} arquivada{archivedConversations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {!showArchivedView && totalArchivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchivedView(true)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 14,
                    cursor: 'pointer',
                    marginBottom: 10,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#e2e8f0',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Archive size={16} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        Arquivadas
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>
                        {totalArchivedCount} conversa{totalArchivedCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#008069',
                      background: '#dcfce7',
                      padding: '1.5px 7px',
                      borderRadius: 999
                    }}>
                      {totalArchivedCount}
                    </span>
                    <ChevronRight size={16} color="#94a3b8" />
                  </div>
                </button>
              )}

              {loadingConversations ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8, color: '#64748b' }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span style={{ fontSize: 12 }}>Carregando conversas...</span>
                </div>
              ) : displayConversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: showArchivedView ? '#f1f5f9' : '#ecfdf5', color: showArchivedView ? '#64748b' : '#059669', margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showArchivedView ? <Archive size={22} /> : <MessageSquare size={22} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    {showArchivedView 
                      ? 'Nenhuma conversa arquivada' 
                      : totalArchivedCount > 0 
                      ? 'Todas as conversas ativas estão arquivadas' 
                      : selectedStudentFilter 
                      ? 'Nenhuma conversa encontrada para este aluno' 
                      : 'Nenhuma conversa encontrada'}
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 4, color: '#64748b' }}>
                    {showArchivedView
                      ? 'Você pode arquivar conversas clicando no ícone de arquivo nas conversas ativas.'
                      : selectedStudentFilter
                      ? 'Inicie uma conversa na aba "Novo Chat" ou veja todas as conversas.'
                      : 'Clique em "Novo Chat" para iniciar uma conversa.'}
                  </div>
                  {!showArchivedView && (
                    selectedStudentFilter ? (
                      <button
                        type="button"
                        onClick={() => setSelectedStudentFilter(null)}
                        style={{ marginTop: 12, padding: '6px 14px', background: '#008069', color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Mostrar Todos os Filhos
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('contatos')}
                        style={{ marginTop: 12, padding: '6px 14px', background: '#008069', color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Iniciar Conversa
                      </button>
                    )
                  )}
                </div>
              ) : (
                displayConversations.map(conv => {
                  const isSelected = selectedConv?.id === conv.id
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConv(conv)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        border: isSelected ? '1px solid #bbf7d0' : '1px solid transparent',
                        marginBottom: 4,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                        prefetchConversationMessages(conv.id)
                      }}
                      onTouchStart={() => prefetchConversationMessages(conv.id)}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: conv.isGroup ? '#10b981' : '#008069', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {conv.isGroup ? <Users size={18} /> : getInitials(conv.title)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {conv.title}
                            </span>
                            {conv.ano_letivo && (
                              <span
                                title={`Ano Letivo ${conv.ano_letivo}`}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: '#0369a1',
                                  background: '#e0f2fe',
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  border: '1px solid #bae6fd',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                {conv.ano_letivo}
                              </span>
                            )}
                            {conv.hasLeft && isSchoolStaff && isColaboradorView && (
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#b45309',
                                background: '#fef3c7',
                                padding: '1px 6px',
                                borderRadius: 6,
                                border: '1px solid #fde68a',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                Saiu da turma
                              </span>
                            )}
                            {conv.isArchived && (
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#64748b',
                                background: '#f1f5f9',
                                padding: '1px 5px',
                                borderRadius: 5,
                                border: '1px solid #cbd5e1',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                Arquivada
                              </span>
                            )}
                            {conv.aluno_nome && (
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#0284c7',
                                background: '#f0f9ff',
                                padding: '1px 6px',
                                borderRadius: 6,
                                border: '1px solid #bae6fd',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                {conv.aluno_nome.split(' ')[0]}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8', flexShrink: 0 }}>
                            {conv.lastMessageAt ? formatTimeSnippet(conv.lastMessageAt) : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                          <div style={{ fontSize: 12, color: conv.unreadCount > 0 ? '#0f172a' : '#64748b', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.lastMessageText || 'Clique para abrir'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {conv.unreadCount > 0 && (
                              <span
                                style={{
                                  background: '#25d366',
                                  color: '#ffffff',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  flexShrink: 0
                                }}
                              >
                                {conv.unreadCount}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleToggleArchive(conv.id, !conv.isArchived, e)}
                              title={conv.isArchived ? "Desarquivar conversa" : "Arquivar conversa"}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '3px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = '#008069'
                                e.currentTarget.style.background = '#e2e8f0'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = '#94a3b8'
                                e.currentTarget.style.background = 'transparent'
                              }}
                            >
                              {conv.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            // Lista de Contatos Permitidos
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contactsData.role === 'familia' && contactsData.alunos && contactsData.alunos.length > 0 ? (
                <>
                  {/* Alunos organizados e separados por cada filho do responsável */}
                  {contactsData.alunos.map((aluno: any) => {
                    const alunoTurmas = (aluno.turmaGrupos && aluno.turmaGrupos.length > 0)
                      ? aluno.turmaGrupos
                      : (aluno.turmaGrupo ? [aluno.turmaGrupo] : [])
                    const matchesStudent = !q || aluno.nome.toLowerCase().includes(q)
                    const matchingTurma = alunoTurmas.some((tg: any) => !q || (tg.nome || '').toLowerCase().includes(q))
                    const matchingColabs = (aluno.colaboradores || []).filter((c: any) =>
                      !q ||
                      c.nome.toLowerCase().includes(q) ||
                      (c.cargo || '').toLowerCase().includes(q) ||
                      (c.turmaNome || '').toLowerCase().includes(q) ||
                      (c.turmas || []).some((t: string) => t.toLowerCase().includes(q))
                    )

                    if (!matchesStudent && !matchingTurma && matchingColabs.length === 0) return null

                    return (
                      <div
                        key={aluno.id}
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 14,
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Header do Aluno */}
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
                            padding: '9px 12px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                            {aluno.foto ? (
                              <img src={aluno.foto} alt={aluno.nome} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0284c7' }} />
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                                {getInitials(aluno.nome)}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {aluno.nome}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                {alunoTurmas.length > 0 ? (
                                  alunoTurmas.map((tg: any) => (
                                    <span
                                      key={tg.id}
                                      style={{
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        color: '#0369a1',
                                        background: '#e0f2fe',
                                        padding: '1px 6px',
                                        borderRadius: 6,
                                        border: '1px solid #bae6fd',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {tg.nome}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>
                                    {aluno.turmaNome || 'Turma Oficial'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0369a1', background: '#ffffff', padding: '2px 8px', borderRadius: 999 }}>
                            Aluno
                          </span>
                        </div>

                        {/* Itens do Aluno - Atendimento Direto com Educadores */}
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Professores e Educadores Vinculados ao Aluno */}
                          {matchingColabs.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', padding: '2px 4px' }}>
                                Professores & Educadores ({aluno.nome.split(' ')[0]})
                              </div>
                              {matchingColabs.map((colab: any) => (
                                <div
                                  key={`${aluno.id}_${colab.id}`}
                                  onClick={() => handleStartChatFromContact({
                                    type: 'direct',
                                    targetUserId: colab.id,
                                    targetUserName: colab.nome,
                                    targetUserPerfil: colab.cargo || colab.perfil,
                                    title: colab.nome,
                                    subtitle: `${colab.cargo || 'Educador(a)'} • ${aluno.nome}`,
                                    alunoId: aluno.id,
                                    alunoNome: aluno.nome,
                                    turmaNome: colab.turmaNome || aluno.turmaNome
                                  })}
                                  style={{ padding: '7px 10px', borderRadius: 10, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, border: '1px solid #e2e8f0' }}
                                >
                                  {colab.foto ? (
                                    <img src={colab.foto} alt={colab.nome} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                      {getInitials(colab.nome)}
                                    </div>
                                  )}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{colab.nome}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1.5, minWidth: 0 }}>
                                      <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        {colab.cargo || 'Educador(a)'}
                                      </span>
                                      {((colab.turmas && colab.turmas.length > 0) ? colab.turmas : (colab.turmaNome ? [colab.turmaNome] : [])).map((tNome: string, idx: number) => {
                                        const badgeText = formatTurmaBadge(tNome)
                                        if (!badgeText) return null
                                        return (
                                          <span
                                            key={idx}
                                            title={`Turma: ${tNome}`}
                                            style={{
                                              fontSize: 8.5,
                                              fontWeight: 700,
                                              color: '#0369a1',
                                              background: '#e0f2fe',
                                              border: '1px solid #bae6fd',
                                              padding: '0.5px 5px',
                                              borderRadius: 4,
                                              whiteSpace: 'nowrap',
                                              lineHeight: 1.25,
                                              flexShrink: 0
                                            }}
                                          >
                                            {badgeText}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', fontSize: 11, background: '#f8fafc', borderRadius: 8 }}>
                              Nenhum professor ou educador vinculado no momento.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Seção: Equipe da Escola (Canais de Atendimento) */}
                  {filteredWhatsappChannels.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🏢 Equipe da Escola</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
                          WhatsApp
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {filteredWhatsappChannels.map((c: any) => {
                          const meta = getSectorMeta(c.setor || c.nome)
                          const SectorIcon = meta.Icon
                          const primaryText = c.setor || c.nome
                          const secondaryText = c.setor && c.nome && c.setor !== c.nome ? c.nome : (c.descricao || 'Atendimento Oficial via WhatsApp')

                          return (
                            <a
                              key={c.id}
                              href={getWhatsAppShareUrl(c.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '8px 10px',
                                borderRadius: 12,
                                background: '#ffffff',
                                border: '1.5px solid #e2e8f0',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#f0fdf4'
                                e.currentTarget.style.borderColor = '#86efac'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#ffffff'
                                e.currentTarget.style.borderColor = '#e2e8f0'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: meta.bg,
                                  color: meta.color,
                                  border: `1px solid ${meta.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <SectorIcon size={16} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {primaryText}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {secondaryText}
                                  </div>
                                </div>
                              </div>

                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#059669',
                                background: '#ecfdf5',
                                padding: '3px 8px',
                                borderRadius: 8,
                                border: '1px solid #a7f3d0',
                                flexShrink: 0
                              }}>
                                <span>WhatsApp</span>
                                <ArrowUpRight size={12} strokeWidth={2.5} />
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Seção 1: Alunos Encontrados na Busca por Nome */}
                  {isSearchingStudents ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0', color: '#64748b' }}>
                      <Loader2 size={16} className="animate-spin" color="#008069" />
                      <span style={{ fontSize: 12 }}>Buscando alunos...</span>
                    </div>
                  ) : searchedStudents.length > 0 ? (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#008069', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                        🎓 Alunos Encontrados ({searchedStudents.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {searchedStudents.map((aluno: any) => {
                          const isAlunoExpanded = expandedAlunoId === aluno.id
                          return (
                            <div
                              key={aluno.id}
                              style={{
                                background: '#ffffff',
                                border: isAlunoExpanded ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                                borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: isAlunoExpanded ? '0 3px 10px rgba(16, 185, 129, 0.1)' : 'none',
                                transition: 'all 0.15s'
                              }}
                            >
                              {/* Linha do Aluno */}
                              <button
                                type="button"
                                onClick={() => handleToggleAluno(aluno.id)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '9px 12px',
                                  background: isAlunoExpanded ? '#f0fdf4' : '#f8fafc',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                                  <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: isAlunoExpanded ? '#10b981' : '#e2e8f0',
                                    color: isAlunoExpanded ? '#ffffff' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <GraduationCap size={16} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {aluno.nome}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                                      {aluno.turmaNome}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                                  {isAlunoExpanded ? <ChevronDown size={16} color="#059669" /> : <ChevronRight size={16} />}
                                </div>
                              </button>

                              {/* Opções Expandidas: Conversar com o Aluno ou Responsáveis */}
                              {isAlunoExpanded && (
                                <div style={{ padding: '8px 10px 10px 10px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {/* Opção 1: Conversar com o Aluno */}
                                  <button
                                    type="button"
                                    disabled={startingChatId === aluno.id}
                                    onClick={() => handleStartChatFromContact({
                                      type: 'direct',
                                      targetUserId: aluno.id,
                                      targetUserName: aluno.nome,
                                      targetUserPerfil: 'Aluno',
                                      title: aluno.nome,
                                      subtitle: `Aluno • ${aluno.turmaNome}`,
                                      alunoId: aluno.id,
                                      alunoNome: aluno.nome,
                                      turmaNome: aluno.turmaNome
                                    })}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 10px',
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      borderRadius: 9,
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <GraduationCap size={13} />
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#15803d' }}>
                                          Conversar com o Aluno ({aluno.nome.split(' ')[0]})
                                        </div>
                                        <div style={{ fontSize: 10, color: '#16a34a' }}>
                                          Chat individual com o estudante
                                        </div>
                                      </div>
                                    </div>

                                    {startingChatId === aluno.id ? (
                                      <Loader2 size={14} className="animate-spin" color="#16a34a" />
                                    ) : (
                                      <ChevronRight size={14} color="#16a34a" />
                                    )}
                                  </button>

                                  {/* Opção 2: Lista de Responsáveis */}
                                  {aluno.responsaveis && aluno.responsaveis.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                                      <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 2px' }}>
                                        Responsáveis ({aluno.responsaveis.length})
                                      </div>
                                      {aluno.responsaveis.map((resp: any) => {
                                        const chatKey = `${aluno.id}_${resp.id}`
                                        const isStarting = startingChatId === chatKey
                                        return (
                                          <button
                                            key={resp.id}
                                            type="button"
                                            disabled={isStarting}
                                            onClick={() => handleStartChatFromContact({
                                              type: 'direct',
                                              targetUserId: resp.id,
                                              targetUserName: resp.nome,
                                              targetUserPerfil: resp.parentesco,
                                              title: resp.nome,
                                              subtitle: `${resp.parentesco} de ${aluno.nome.split(' ')[0]}`,
                                              alunoId: aluno.id,
                                              alunoNome: aluno.nome,
                                              turmaNome: aluno.turmaNome
                                            })}
                                            style={{
                                              width: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '7px 10px',
                                              background: '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              borderRadius: 8,
                                              cursor: 'pointer',
                                              textAlign: 'left'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                                                {resp.parentesco.charAt(0)}
                                              </div>
                                              <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {resp.nome}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                                  {resp.parentesco}
                                                </div>
                                              </div>
                                            </div>

                                            {isStarting ? (
                                              <Loader2 size={13} className="animate-spin" color="#64748b" />
                                            ) : (
                                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#008069', background: '#ecfdf5', padding: '2px 8px', borderRadius: 999 }}>
                                                Conversar
                                              </div>
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: '#94a3b8', padding: '4px 6px' }}>
                                      Nenhum responsável vinculado a este aluno.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Seção 2: Turmas Oficiais */}
                  {filteredTurmas.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                        👥 Turmas Oficiais
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {filteredTurmas.map(t => {
                          const isExpanded = expandedTurmaId === t.id
                          const studentData = turmaStudentsData[t.id]
                          const alunosList = studentData?.alunos || []
                          const isLoadingStudents = !!studentData?.loading

                          return (
                            <div
                              key={t.id}
                              style={{
                                background: '#ffffff',
                                border: isExpanded ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: isExpanded ? '0 3px 10px rgba(59,130,246,0.08)' : 'none',
                                transition: 'all 0.15s'
                              }}
                            >
                              {/* Cabeçalho da Turma */}
                              <button
                                type="button"
                                onClick={() => handleToggleTurma(t.id, t.turma_id)}
                                onMouseEnter={() => prefetchTurma(t.id, t.turma_id)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  background: isExpanded ? '#f0f7ff' : '#f8fafc',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  <div style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    background: isExpanded ? '#dbeafe' : '#eff6ff',
                                    color: '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <Users size={17} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t.nome}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      {t.membrosCount ? `${t.membrosCount} alunos` : 'Turma Oficial'}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {isLoadingStudents ? (
                                    <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                  ) : isExpanded ? (
                                    <ChevronDown size={17} color="#2563eb" />
                                  ) : (
                                    <ChevronRight size={17} color="#94a3b8" />
                                  )}
                                </div>
                              </button>

                              {/* Conteúdo Expandido da Turma - Atendimento Direto */}
                              {isExpanded && (
                                <div style={{ padding: '8px 10px 12px 10px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {/* Lista de Alunos e seus Responsáveis */}
                                  <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span>Alunos da Turma ({alunosList.length})</span>
                                      <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>Clique no aluno para conversar</span>
                                    </div>

                                    {isLoadingStudents ? (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', color: '#64748b', fontSize: 12 }}>
                                        <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                        <span>Carregando alunos e responsáveis...</span>
                                      </div>
                                    ) : alunosList.length === 0 ? (
                                      <div style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontSize: 12, background: '#f8fafc', borderRadius: 8 }}>
                                        Nenhum aluno encontrado nesta turma.
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {alunosList.map((aluno: any) => {
                                          const isAlunoExpanded = expandedAlunoId === aluno.id
                                          return (
                                            <div
                                              key={aluno.id}
                                              style={{
                                                background: '#f8fafc',
                                                border: isAlunoExpanded ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                                                borderRadius: 10,
                                                overflow: 'hidden'
                                              }}
                                            >
                                              {/* Linha do Aluno */}
                                              <button
                                                type="button"
                                                onClick={() => handleToggleAluno(aluno.id)}
                                                style={{
                                                  width: '100%',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  padding: '7px 10px',
                                                  background: isAlunoExpanded ? '#f1f5f9' : 'transparent',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  textAlign: 'left'
                                                }}
                                              >
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                                  {aluno.nome}
                                                </div>

                                                <div style={{ color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                                                  {isAlunoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </div>
                                              </button>

                                              {/* Opções Expandidas: Conversar com Aluno ou Responsáveis */}
                                              {isAlunoExpanded && (
                                                <div style={{ padding: '6px 8px 8px 8px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                  {/* Botão Conversar com o Aluno */}
                                                  <button
                                                    type="button"
                                                    disabled={startingChatId === aluno.id}
                                                    onClick={() => handleStartChatFromContact({
                                                      type: 'direct',
                                                      targetUserId: aluno.id,
                                                      targetUserName: aluno.nome,
                                                      targetUserPerfil: 'Aluno',
                                                      title: aluno.nome,
                                                      subtitle: `Aluno • ${t.nome}`
                                                    })}
                                                    style={{
                                                      width: '100%',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'space-between',
                                                      padding: '6px 8px',
                                                      background: '#f0fdf4',
                                                      border: '1px solid #bbf7d0',
                                                      borderRadius: 8,
                                                      cursor: 'pointer',
                                                      textAlign: 'left'
                                                    }}
                                                  >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <GraduationCap size={12} />
                                                      </div>
                                                      <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#15803d' }}>
                                                          Conversar com o Aluno ({aluno.nome.split(' ')[0]})
                                                        </div>
                                                        <div style={{ fontSize: 9.5, color: '#16a34a' }}>
                                                          Chat individual com o aluno
                                                        </div>
                                                      </div>
                                                    </div>
                                                    {startingChatId === aluno.id ? (
                                                      <Loader2 size={13} className="animate-spin" color="#16a34a" />
                                                    ) : (
                                                      <ChevronRight size={14} color="#16a34a" />
                                                    )}
                                                  </button>

                                                  {/* Responsáveis do Aluno */}
                                                  {(aluno.responsaveis || []).length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                                                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        Responsáveis:
                                                      </div>
                                                      {aluno.responsaveis.map((resp: any) => {
                                                        const chatKey = `${aluno.id}_${resp.id}`
                                                        const isStarting = startingChatId === chatKey
                                                        return (
                                                          <button
                                                            key={resp.id}
                                                            type="button"
                                                            disabled={isStarting}
                                                            onClick={() => handleStartChatFromContact({
                                                              type: 'direct',
                                                              targetUserId: resp.id,
                                                              targetUserName: resp.nome,
                                                              targetUserPerfil: resp.parentesco || 'Responsável',
                                                              title: `${resp.nome} (${resp.parentesco})`,
                                                              subtitle: `${resp.parentesco} de ${aluno.nome}`
                                                            })}
                                                            style={{
                                                              width: '100%',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'space-between',
                                                              padding: '6px 8px',
                                                              background: '#faf5ff',
                                                              border: '1px solid #e9d5ff',
                                                              borderRadius: 8,
                                                              cursor: 'pointer',
                                                              textAlign: 'left'
                                                            }}
                                                          >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#9333ea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <User size={12} />
                                                              </div>
                                                              <div style={{ minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6b21a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {resp.nome}
                                                                  </span>
                                                                  <span style={{ fontSize: 9, fontWeight: 800, background: '#f3e8ff', color: '#7e22ce', padding: '1px 5px', borderRadius: 999, border: '1px solid #d8b4fe' }}>
                                                                    {resp.parentesco}
                                                                  </span>
                                                                </div>
                                                                <div style={{ fontSize: 9.5, color: '#7e22ce' }}>
                                                                  Chat individual com o responsável
                                                                </div>
                                                              </div>
                                                            </div>
                                                            {isStarting ? (
                                                              <Loader2 size={13} className="animate-spin" color="#9333ea" />
                                                            ) : (
                                                              <ChevronRight size={14} color="#9333ea" />
                                                            )}
                                                          </button>
                                                        )
                                                      })}
                                                    </div>
                                                  ) : (
                                                    <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', padding: '2px 4px' }}>
                                                      Nenhum responsável vinculado no cadastro.
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seção: Equipe da Escola (Canais de Atendimento) */}
                  {filteredWhatsappChannels.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🏢 Equipe da Escola</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
                          WhatsApp
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {filteredWhatsappChannels.map((c: any) => {
                          const meta = getSectorMeta(c.setor || c.nome)
                          const SectorIcon = meta.Icon
                          const primaryText = c.setor || c.nome
                          const secondaryText = c.setor && c.nome && c.setor !== c.nome ? c.nome : (c.descricao || 'Atendimento Oficial via WhatsApp')

                          return (
                            <a
                              key={c.id}
                              href={getWhatsAppShareUrl(c.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '8px 10px',
                                borderRadius: 12,
                                background: '#ffffff',
                                border: '1.5px solid #e2e8f0',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#f0fdf4'
                                e.currentTarget.style.borderColor = '#86efac'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#ffffff'
                                e.currentTarget.style.borderColor = '#e2e8f0'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: meta.bg,
                                  color: meta.color,
                                  border: `1px solid ${meta.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <SectorIcon size={16} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {primaryText}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {secondaryText}
                                  </div>
                                </div>
                              </div>

                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#059669',
                                background: '#ecfdf5',
                                padding: '3px 8px',
                                borderRadius: 8,
                                border: '1px solid #a7f3d0',
                                flexShrink: 0
                              }}>
                                <span>WhatsApp</span>
                                <ArrowUpRight size={12} strokeWidth={2.5} />
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seção 3: Educadores e Colaboradores (ocultada no acesso do colaborador/professor) */}
                  {!isColaboradorView && contactsData.role !== 'colaborador' && filteredColabs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                        👤 Educadores e Colaboradores
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {filteredColabs.map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleStartChatFromContact({
                              type: 'direct',
                              targetUserId: c.id,
                              targetUserName: c.nome,
                              targetUserPerfil: c.cargo,
                              title: c.nome,
                              subtitle: c.cargo
                            })}
                            style={{ padding: '8px 10px', borderRadius: 10, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                          >
                            {c.foto ? (
                              <img src={c.foto} alt={c.nome} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: c.isTurmaColab ? '#ecfdf5' : '#faf5ff', color: c.isTurmaColab ? '#059669' : '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                {getInitials(c.nome)}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{c.nome}</span>
                                {c.isTurmaColab && (
                                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
                                    Sua Turma
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#64748b' }}>{c.cargo}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado Vazio de Contatos */}
                  {filteredWhatsappChannels.length === 0 && filteredTurmas.length === 0 && (isColaboradorView || contactsData.role === 'colaborador' ? true : filteredColabs.length === 0) && searchedStudents.length === 0 && !isSearchingStudents && (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                      <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                        Nenhum contato encontrado
                      </div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                        {searchQuery ? 'Nenhum resultado para a busca.' : 'Os canais e turmas aparecerão aqui.'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* COLUNA DIREITA: CONVERSA ATIVA ESTILO WHATSAPP WEB          */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#efeae2' }}>
        {selectedConv ? (
          <>
            {/* Top Bar da Conversa */}
            <div
              style={{
                height: 60,
                background: '#008069',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                color: '#ffffff',
                gap: 12
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#128c7e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                {selectedConv.isGroup ? <Users size={18} /> : getInitials(selectedConv.title)}
              </div>
              <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, lineHeight: 1.25 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedConv.title}</span>
                  {selectedConv.hasLeft && isSchoolStaff && isColaboradorView && (
                    <span style={{ fontSize: 9.5, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 6.5px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>
                      Saiu da turma
                    </span>
                  )}
                  {selectedConv.isArchived && (
                    <span
                      style={{
                        fontSize: 9.5,
                        background: 'rgba(255, 255, 255, 0.22)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        padding: '1px 6.5px',
                        borderRadius: 6,
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      Arquivada
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'rgba(255, 255, 255, 0.86)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {selectedConv.ano_letivo && (
                    <span
                      title={`Ano Letivo ${selectedConv.ano_letivo}`}
                      style={{
                        fontSize: 9.5,
                        background: 'rgba(255, 255, 255, 0.22)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        padding: '1px 6.5px',
                        borderRadius: 5,
                        fontWeight: 700,
                        flexShrink: 0,
                        lineHeight: 1.2
                      }}
                    >
                      Ano {selectedConv.ano_letivo}
                    </span>
                  )}
                  {(() => {
                    if (selectedConv.isGroup) {
                      if (selectedConv.aluno_nome) {
                        return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Aluno(a): {selectedConv.aluno_nome}</span>
                      }
                      if (selectedConv.subtitle && selectedConv.subtitle !== 'Grupo') {
                        return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedConv.subtitle}</span>
                      }
                      if (!selectedConv.ano_letivo) {
                        return <span>Mural Oficial da Turma</span>
                      }
                      return null
                    }
                    if (selectedConv.aluno_nome) {
                      const rawRole = selectedConv.subtitle ? selectedConv.subtitle.split('•')[0].trim() : ''
                      const role = rawRole && rawRole !== 'online' && rawRole !== 'Contato' ? rawRole : 'Educador(a)'
                      return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{role} • Aluno(a): {selectedConv.aluno_nome}</span>
                    }
                    return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedConv.subtitle || 'online'}</span>
                  })()}
                </div>
              </div>

              {/* Botão de Arquivar / Desarquivar no Header da Conversa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {adConfig?.chatAuto?.recursos?.tempoEstimadoResposta && (
                  <div
                    title={`Previsão de retorno da equipe escolar: ${adConfig.chatAuto.recursos.tempoEstimadoResposta}`}
                    style={{
                      display: 'none',
                      alignItems: 'center',
                      gap: 4.5,
                      background: 'rgba(255, 255, 255, 0.18)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      color: '#ffffff',
                      fontWeight: 600
                    }}
                    className="sm:inline-flex"
                  >
                    <Clock size={12} />
                    <span>{adConfig.chatAuto.recursos.tempoEstimadoResposta}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleArchive(selectedConv.id, !selectedConv.isArchived)}
                  title={selectedConv.isArchived ? "Desarquivar esta conversa" : "Arquivar esta conversa"}
                  style={{
                    background: selectedConv.isArchived ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    color: '#ffffff',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = selectedConv.isArchived ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}
                >
                  {selectedConv.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowAnchor: 'auto',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div ref={messagesContentRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
              {loadingMessages ? (
                <div style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: '#64748b' }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (() => {
                const seenIds = new Set<string>()
                const uniqueMessages = messages.filter((m: any) => {
                  if (!m?.id || seenIds.has(m.id)) return false
                  seenIds.add(m.id)
                  return true
                })
                return uniqueMessages.map((m: any) => {
                  const isMe = 
                    m.sender_id === currentUserId || 
                    m.sender_id === currentUser?.id || 
                    (Boolean((currentUser as any)?.responsavel_id) && m.sender_id === (currentUser as any)?.responsavel_id) ||
                    (Boolean((currentUser as any)?.colaborador_id) && m.sender_id === (currentUser as any)?.colaborador_id)
                  const senderPerfilMsg = ((m as any).sender_perfil || '').toLowerCase()
                  const isMsgSentByColab = 
                    senderPerfilMsg.includes('professor') ||
                    senderPerfilMsg.includes('educador') ||
                    senderPerfilMsg.includes('colaborador') ||
                    senderPerfilMsg.includes('admin') ||
                    senderPerfilMsg.includes('master') ||
                    senderPerfilMsg.includes('diretor') ||
                    senderPerfilMsg.includes('direção') ||
                    senderPerfilMsg.includes('gestor') ||
                    (!senderPerfilMsg.includes('aluno') && !senderPerfilMsg.includes('família') && !senderPerfilMsg.includes('familia') && !senderPerfilMsg.includes('responsável') && !senderPerfilMsg.includes('responsavel'))

                  const canDeleteMsg = 
                    isCollaboratorOrAdmin && 
                    isMsgSentByColab && 
                    (isMe || isAdmin)

                  const reactionsList: any[] = Array.isArray(m.metadata?.reactions) ? m.metadata.reactions : []
                  const groupedReactions = reactionsList.reduce((acc: Record<string, { count: number; users: string[]; hasReacted: boolean }>, r: any) => {
                    if (!r?.emoji) return acc
                    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasReacted: false }
                    acc[r.emoji].count += 1
                    acc[r.emoji].users.push(r.user_name || 'Usuário')
                    if (String(r.user_id) === String(currentUserId)) acc[r.emoji].hasReacted = true
                    return acc
                  }, {})
                  const reactionEntries = Object.entries(groupedReactions)

                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div
                        style={{
                          maxWidth: '75%',
                          minWidth: 80,
                          padding: '7px 12px 6px 12px',
                          borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                          background: isMe ? '#d9fdd3' : '#ffffff',
                          boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                          position: 'relative',
                          fontSize: 13.5
                        }}
                      >
                        {/* Barra Flutuante de Reações com Emojis */}
                        {activeReactionMsgId === m.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 6px)',
                              right: isMe ? 0 : 'auto',
                              left: isMe ? 'auto' : 0,
                              background: '#ffffff',
                              borderRadius: 9999,
                              boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)',
                              border: '1px solid #e2e8f0',
                              padding: '4px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              zIndex: 60
                            }}
                          >
                            {['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉'].map((emoji) => {
                              const isSelected = reactionsList.some(r => String(r.user_id) === String(currentUserId) && r.emoji === emoji)
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    handleToggleReaction(m.id, emoji)
                                    setActiveReactionMsgId(null)
                                  }}
                                  style={{
                                    background: isSelected ? '#dcfce7' : 'transparent',
                                    border: isSelected ? '1px solid #86efac' : '1px solid transparent',
                                    borderRadius: '50%',
                                    width: 28,
                                    height: 28,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 16,
                                    cursor: 'pointer',
                                    padding: 0,
                                    transition: 'transform 0.12s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.28)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                  }}
                                >
                                  {emoji}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {!isMe && (selectedConv.isGroup || m.sender_id === 'system_auto_responder' || m.metadata?.is_auto_reply) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            {m.sender_id === 'system_auto_responder' || m.metadata?.is_auto_reply ? (
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#008069', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
                                🤖 Atendimento Automático • Colégio Impacto
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#128c7e' }}>
                                {m.sender_name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Se for Vídeo Anexado */}
                        {(m.content_type === 'video' || (m.metadata?.mime_type && m.metadata.mime_type.startsWith('video/')) || /\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(m.metadata?.file_url || '')) && m.metadata?.file_url && (
                          <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 4, background: '#0b141a', maxWidth: 360, position: 'relative' }}>
                            <video
                              src={m.metadata.file_url}
                              poster={m.metadata?.thumbnail_url}
                              controls
                              playsInline
                              preload="metadata"
                              style={{ width: '100%', maxHeight: 300, display: 'block', borderRadius: 8, background: '#000000' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMediaViewer({
                                  type: 'video',
                                  url: m.metadata?.file_url || '',
                                  fileName: m.metadata?.file_name || 'Vídeo.mp4',
                                  fileSize: m.metadata?.file_size
                                })
                              }}
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                background: 'rgba(0,0,0,0.65)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                backdropFilter: 'blur(4px)',
                                zIndex: 2
                              }}
                              title="Expandir Vídeo"
                            >
                              <Maximize2 size={12} />
                              <span>Expandir</span>
                            </button>
                          </div>
                        )}

                        {/* Se for Imagem Anexada */}
                        {m.content_type !== 'video' && !(m.metadata?.mime_type && m.metadata.mime_type.startsWith('video/')) && !/\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(m.metadata?.file_url || '') && (m.content_type === 'image' || (!m.content_type && m.metadata?.file_url && /\.(jpg|jpeg|png|webp|heic|heif|gif)(\?|$)/i.test(m.metadata.file_url))) && m.metadata?.file_url && (
                          <div 
                            style={{ borderRadius: 8, overflow: 'hidden', cursor: 'pointer', marginBottom: 4 }}
                            onClick={() => {
                              setActiveMediaViewer({
                                type: 'image',
                                url: m.metadata?.file_url || '',
                                fileName: m.metadata?.file_name || 'Foto.webp',
                                fileSize: m.metadata?.file_size
                              })
                            }}
                          >
                            <HeicSafeImage
                              src={m.metadata.file_url}
                              alt="Foto"
                              style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', borderRadius: 8 }}
                            />
                          </div>
                        )}

                        {/* Se for Documento PDF Anexado (renderiza com preview visual de página do PDF) */}
                        {m.metadata?.file_url && (
                          /\.pdf(\?|$)/i.test(m.metadata.file_url) || 
                          m.metadata?.mime_type?.includes('pdf') || 
                          (m.metadata?.file_name && m.metadata.file_name.toLowerCase().endsWith('.pdf'))
                        ) && (
                          <PdfBubbleCard
                            url={m.metadata.file_url}
                            fileName={m.metadata.file_name || 'Documento.pdf'}
                            fileSize={m.metadata.file_size}
                            onClick={() => {
                              setActiveMediaViewer({
                                type: 'pdf',
                                url: m.metadata?.file_url || '',
                                fileName: m.metadata?.file_name || 'Documento.pdf',
                                fileSize: m.metadata.file_size
                              })
                            }}
                          />
                        )}

                        {/* Se for Outro Arquivo / Documento (não PDF, não vídeo, não imagem) */}
                        {m.content_type === 'file' && m.metadata?.file_url && 
                         !/\.pdf(\?|$)/i.test(m.metadata.file_url) && 
                         !m.metadata?.mime_type?.includes('pdf') && 
                         !(m.metadata?.file_name && m.metadata.file_name.toLowerCase().endsWith('.pdf')) && 
                         !/\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(m.metadata.file_url) && (
                          <div
                            onClick={() => {
                              setActiveMediaViewer({
                                type: 'file',
                                url: m.metadata?.file_url || '',
                                fileName: m.metadata?.file_name || 'Documento',
                                fileSize: m.metadata?.file_size
                              })
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              background: 'rgba(0,0,0,0.04)',
                              borderRadius: 8,
                              cursor: 'pointer',
                              color: '#111b21',
                              marginBottom: 4
                            }}
                          >
                            <FileText size={24} color="#008069" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.metadata.file_name || 'Documento'}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#667781' }}>
                                {m.metadata.file_size ? `${Math.round(m.metadata.file_size / 1024)} KB` : 'Arquivo'}
                              </div>
                            </div>
                            <Download size={16} color="#54656f" />
                          </div>
                        )}

                        {/* Texto da Mensagem (ignora placeholders e evita duplicar nome de arquivo já exibido no anexo) */}
                        {m.content && 
                         m.content !== '📷 Foto' && 
                         m.content !== '🎥 Vídeo' && 
                         m.content !== m.metadata?.file_name && (
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.content}
                          </div>
                        )}

                        {/* Pílulas de Reações com Emojis */}
                        {reactionEntries.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 3,
                              marginTop: 4,
                              marginBottom: 2
                            }}
                          >
                            {reactionEntries.map(([emoji, data]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleReaction(m.id, emoji)
                                }}
                                title={`${emoji} • ${data.users.join(', ')}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  background: data.hasReacted ? '#dbeafe' : 'rgba(0,0,0,0.05)',
                                  border: data.hasReacted ? '1px solid #93c5fd' : '1px solid rgba(0,0,0,0.08)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.08)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)'
                                }}
                              >
                                <span>{emoji}</span>
                                {data.count > 1 && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: data.hasReacted ? '#1d4ed8' : '#64748b' }}>
                                    {data.count}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2, fontSize: 10.5, color: '#667781' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                            }}
                            title="Reagir"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '0 2px',
                              marginRight: 2,
                              cursor: 'pointer',
                              color: activeReactionMsgId === m.id ? '#0284c7' : '#94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              opacity: 0.75,
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1'
                              e.currentTarget.style.color = '#0284c7'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.75'
                              e.currentTarget.style.color = activeReactionMsgId === m.id ? '#0284c7' : '#94a3b8'
                            }}
                          >
                            <Smile size={12} />
                          </button>

                          {canDeleteMsg && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMessageToDelete(m.id)
                              }}
                              title="Excluir mensagem"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0 2px',
                                marginRight: 2,
                                cursor: 'pointer',
                                color: '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                opacity: 0.75,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1'
                                e.currentTarget.style.color = '#ef4444'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '0.75'
                                e.currentTarget.style.color = '#94a3b8'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <span>
                            {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
              <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Inferior ou Banner Somente Leitura */}
            {(() => {
              const userPerfil = (currentUser?.perfil || '').toLowerCase()
              const userCargo = (currentUser?.cargo || '').toLowerCase()
              const perfisMasterAdmin = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master', 'gestor', 'direção']
              const isAdmin = perfisMasterAdmin.some(p => userPerfil.includes(p) || userCargo.includes(p))

              const isFamilyOrStudent = 
                userPerfil.includes('família') || 
                userPerfil.includes('familia') || 
                userPerfil.includes('responsável') || 
                userPerfil.includes('responsavel') || 
                userCargo.includes('aluno') || 
                userCargo.includes('responsável') || 
                userCargo.includes('responsavel') || 
                !!alunoId

              const isGroup = !!selectedConv.isGroup || selectedConv.type === 'group'
              const isColabOrTeacher = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)
              const hasLeftConv = Boolean(isColabOrTeacher && isColaboradorView && selectedConv.hasLeft)
              const isReadOnlyForMe = hasLeftConv || (isGroup && (
                !isColaboradorView ||
                !isColabOrTeacher
              ))

              if (isReadOnlyForMe) {
                return (
                  <div style={{
                    background: hasLeftConv ? '#fffbeb' : '#f8fafc',
                    padding: '14px 20px',
                    borderTop: hasLeftConv ? '1px solid #fde68a' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    color: hasLeftConv ? '#92400e' : '#64748b',
                    fontSize: 13,
                    fontWeight: 600
                  }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: hasLeftConv ? '#fef3c7' : '#fee2e2',
                      color: hasLeftConv ? '#b45309' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Lock size={15} />
                    </div>
                    <span>
                      {hasLeftConv
                        ? 'Você não participa mais deste grupo. O histórico anterior permanece disponível apenas para consulta.'
                        : !isColaboradorView
                        ? (isColabOrTeacher
                            ? 'Mural da turma: no Modo Família o envio de mensagens é desativado. Acesse pelo Modo Colaborador para enviar.'
                            : 'Mural da turma: no Modo Família o envio de mensagens é desativado.')
                        : 'Apenas membros da equipe escolar podem enviar mensagens neste chat. Alunos e familiares apenas visualizam.'}
                    </span>
                  </div>
                )
              }

              return (
                <div style={{ background: '#f0f2f5', padding: '10px 16px', position: 'relative' }}>
                  {/* Inputs de arquivo ocultos */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/*,.mov,.mp4,.webm,.m4v,.3gp,.mkv,.heic,.heif"
                    style={{ display: 'none' }}
                    onChange={e => handleFileUpload(e, 'media')}
                  />
                  <input
                    type="file"
                    ref={docInputRef}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleFileUpload(e, 'doc')}
                  />

                  {/* Popover de Opções de Anexo */}
                  {showAttachMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 16,
                        background: '#ffffff',
                        borderRadius: 14,
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        border: '1px solid #e2e8f0',
                        zIndex: 30,
                        minWidth: 160
                      }}
                    >
                      {(isSchoolStaff || permitirImagens) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false)
                            fileInputRef.current?.click()
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#1e293b'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ImageIcon size={15} />
                          </div>
                          Foto ou Vídeo
                        </button>
                      )}

                      {(isSchoolStaff || permitirDocumentos) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false)
                            docInputRef.current?.click()
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#1e293b'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={15} />
                          </div>
                          Documento / PDF
                        </button>
                      )}
                    </div>
                  )}

                  {isBlocked ? (
                    <ChatBlockedNoticeCard status={businessHoursStatus} />
                  ) : (
                    <>
                      {/* Barra de Progresso de Upload / Compressão */}
                      {uploadProgress.active && (
                        <div
                          style={{
                            padding: '8px 14px',
                            marginBottom: 8,
                            background: '#f0fdf4',
                            borderRadius: 12,
                            border: '1px solid #bbf7d0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 12,
                            color: '#166534',
                            fontWeight: 600,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                          }}
                        >
                          <Loader2 size={16} className="animate-spin" color="#16a34a" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span>{uploadProgress.status}</span>
                              <span>{uploadProgress.percent}%</span>
                            </div>
                            <div style={{ height: 4, background: '#dcfce7', borderRadius: 99, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${uploadProgress.percent}%`,
                                  background: '#16a34a',
                                  transition: 'width 0.2s ease'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {canAttachAny && (
                          <button
                            type="button"
                            onClick={() => setShowAttachMenu(prev => !prev)}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              border: 'none',
                              background: showAttachMenu ? '#dcfce7' : 'transparent',
                              color: showAttachMenu ? '#059669' : '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title="Anexar foto, vídeo ou documento"
                          >
                            <Paperclip size={20} />
                          </button>
                        )}

                        <input
                          type="text"
                          placeholder="Digite uma mensagem..."
                          value={inputText}
                          onChange={e => setInputText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSendMessage()
                          }}
                          style={{
                            flex: 1,
                            background: '#ffffff',
                            borderRadius: 20,
                            padding: '9px 16px',
                            border: '1px solid #cbd5e1',
                            outline: 'none',
                            fontSize: 14,
                            color: '#0f172a'
                          }}
                        />
                        <button
                          onClick={() => handleSendMessage()}
                          disabled={isSending || (!inputText.trim())}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: '#25d366',
                            color: 'white',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isSending || !inputText.trim() ? 'not-allowed' : 'pointer',
                            opacity: isSending || !inputText.trim() ? 0.7 : 1
                          }}
                        >
                          {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#059669', margin: '0 auto 16px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={32} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Chat Impacto EDU</h3>
            <p style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
              Selecione uma conversa ou inicie um novo chat com os canais da escola ou professores.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmação para Apagar Mensagem (Apenas Colaborador) */}
      {messageToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110005,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setMessageToDelete(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 18,
              padding: '22px 24px',
              maxWidth: 330,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <Trash2 size={24} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Apagar mensagem?
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45, marginBottom: 20 }}>
              Esta mensagem será apagada para todos os participantes desta conversa.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMessageToDelete(null)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingMessage}
                onClick={handleExecuteDeleteMessage}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                {isDeletingMessage ? <Loader2 size={15} className="animate-spin" /> : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Mídia (Imagem, Vídeo, PDF, Arquivo com botão Fechar e Baixar) */}
      <ChatMediaViewerModal
        media={activeMediaViewer}
        onClose={() => setActiveMediaViewer(null)}
      />
    </div>
  )
}
