'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Clock, 
  Image as ImageIcon, 
  FileText, 
  Download, 
  Search, 
  ArrowLeft,
  Loader2,
  Users,
  Building2,
  UserCheck,
  Lock,
  Trash2,
  Maximize2,
  Archive,
  ArchiveRestore
} from 'lucide-react'
import { toast } from 'sonner'
import { useParams, usePathname } from 'next/navigation'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useChatStore } from '@/lib/chatStore'
import { 
  getCachedMessages, 
  setCachedMessages, 
  prefetchConversationMessages, 
  appendCachedMessage, 
  updateCachedMessage, 
  removeCachedMessage 
} from '@/lib/chatMessagesCache'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { checkChatBusinessHours, ChatBlockedNoticeCard } from './ChatBlockedNotice'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { playWhatsAppSendSound } from '@/lib/chatAudio'
import { checkIsAdmin, checkIsCollaboratorOrTeacher } from '@/lib/chatPermissions'
import { getWhatsAppShareUrl, getSecretariaWhatsApp } from '@/lib/whatsapp'
import { ColabChatNoticeModal } from './ColabChatNoticeModal'
import { triggerHaptic } from '@/lib/utils/haptics'
import { getInitials } from '@/lib/utils'
import { HeicSafeImage } from './HeicSafeImage'
import { ChatMediaViewerModal, ChatMediaItem, downloadMediaFile } from './ChatMediaViewerModal'
import { PdfBubbleCard } from './PdfBubbleCard'
import { 
  compressImage, 
  compressVideo, 
  compressPDF, 
  extractVideoThumbnail, 
  thumbnailDataUrlToFile, 
  formatFileSize 
} from '@/lib/mediaCompressor'

interface MessageItem {
  id: string
  conversation_id: string
  sender_id: string
  sender_name?: string
  sender_perfil?: string
  content: string
  content_type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'system'
  reply_to_id?: string | null
  reply_preview?: string | null
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  metadata?: any
  created_at: string
}

function formatMessageTime(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatGroupDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'HOJE'
    if (d.toDateString() === yesterday.toDateString()) return 'ONTEM'

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
  } catch {
    return dateStr
  }
}

// Lista de emojis populares rápidos para acesso instantâneo sem peso
const QUICK_EMOJIS = ['👍', '❤️', '😊', '🙏', '👏', '😂', '✅', '📚', '🎒', '👋']

export function ChatConversationModal() {
  const { isModalOpen, activeConversation, closeConversationModal } = useChatStore()
  const { currentUser } = useApp()
  const params = useParams<{ slug?: string }>()
  const pathname = usePathname()
  const selectedStudentCtx = useSelectedStudent()

  const slugFromParam = params?.slug ? String(params.slug) : ''
  const segments = (pathname || '').split('/')
  const slugFromPath = 
    segments[1] === 'agenda-digital' && 
    segments[2] && 
    !['admin', 'colaborador', 'selecionar-aluno', 'selecionar-perfil-admin'].includes(segments[2])
      ? String(segments[2])
      : ''
  const studentFromCtx = selectedStudentCtx?.aluno?.id ? String(selectedStudentCtx.aluno.id) : ''
  const studentFromUser = (currentUser as any)?.aluno_id ? String((currentUser as any).aluno_id) : ''

  const activeAlunoId = activeConversation?.aluno_id || slugFromParam || slugFromPath || studentFromCtx || studentFromUser || undefined

  // Carregamento instantâneo do cache em memória (0ms de latência percebida)
  const [messages, setMessages] = useState<MessageItem[]>(() => {
    if (activeConversation?.id) {
      const cached = getCachedMessages(activeConversation.id)
      if (cached?.messages && cached.messages.length > 0) return cached.messages
    }
    return []
  })
  const [loadingMessages, setLoadingMessages] = useState<boolean>(() => {
    if (activeConversation?.id) {
      const cached = getCachedMessages(activeConversation.id)
      if (cached?.messages && cached.messages.length > 0) return false
      if (activeConversation.lastMessageText) return false
    }
    return false
  })
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; status: string; percent: number }>({
    active: false,
    status: '',
    percent: 0
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeMediaViewer, setActiveMediaViewer] = useState<ChatMediaItem | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesContentRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const isFirstLoadRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userPerfil = (currentUser?.perfil || '').trim()
  const userCargo = (currentUser?.cargo || '').trim()
  const isAdmin = checkIsAdmin(userPerfil, userCargo)

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
      ? ((currentUser as any)?.aluno_id || currentUser?.id || 'me')
      : (currentUser?.id || (currentUser as any)?.responsavel_id || (currentUser as any)?.colaborador_id || 'me')

  const isColabOrTeacher = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)

  const { adConfig } = useAgendaDigital()
  const businessHoursStatus = checkChatBusinessHours(
    adConfig?.chatAuto?.horarioAtendimento,
    currentUser?.nome || 'Família',
    'Colégio Impacto'
  )
  const isBlocked = businessHoursStatus.isClosed && isFamilyOrStudent

  const isGroup = !!activeConversation?.isGroup || activeConversation?.type === 'group'
  const isFamilyContext = activeConversation?.context === 'familia' || isFamilyOrStudent || !isColabOrTeacher
  const canHaveLeft = isColabOrTeacher || isFamilyContext || Boolean(activeConversation?.hasLeft)

  // Regras de Governança Escolar configuradas pelo Admin:
  // 1. Bloqueio de colaboradores enviarem em grupos de turma (apenas Admins enviam quando desativado)
  const isColabGroupDisabled = isGroup && isColabOrTeacher && !isAdmin && (adConfig?.chatAuto?.recursos?.permitirColaboradorEnviarGrupoTurma === false)

  // 2. Bloqueio de conversas diretas com colaborador para famílias
  const isDirectColabDisabled = !isGroup && isFamilyContext && (adConfig?.chatAuto?.recursos?.permitirConversaColaborador === false)

  const [showColabNoticeModal, setShowColabNoticeModal] = useState(false)
  const secWa = getSecretariaWhatsApp(adConfig?.contatosWhatsapp)
  const [hasLeft, setHasLeft] = useState(false)
  const [isArchived, setIsArchived] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  useEffect(() => {
    if (activeConversation) {
      setHasLeft(Boolean(activeConversation.hasLeft))
      setIsArchived(Boolean(activeConversation.isArchived))
    }
  }, [activeConversation])

  const handleToggleArchive = async () => {
    if (!activeConversation?.id || isArchiving) return
    const nextArchived = !isArchived
    setIsArchiving(true)
    setIsArchived(nextArchived)
    useChatStore.getState().notifyArchiveChanged(activeConversation.id, nextArchived)
    toast.success(nextArchived ? 'Conversa arquivada' : 'Conversa desarquivada')
    try {
      await fetch('/api/chat/conversations/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          is_archived: nextArchived
        })
      })
      window.dispatchEvent(new CustomEvent('chat:conversation-updated'))
    } catch (err) {
      console.error('Erro ao arquivar:', err)
      setIsArchived(!nextArchived)
      useChatStore.getState().notifyArchiveChanged(activeConversation.id, !nextArchived)
    } finally {
      setIsArchiving(false)
    }
  }

  // Regra de Permissão de Envio em Grupos/Turmas:
  // - Se saiu do grupo: apenas leitura do histórico anterior
  // - Se envio de colaboradores em grupos estiver desativado pela escola: apenas leitura
  // - No Modo Família: NENHUM colaborador ou familiar pode enviar mensagens em grupos de turma (somente visualização).
  // - No Modo Colaborador: Professores vinculados e equipe escolar podem enviar mensagens.
  // - Alunos ou familiares puros nunca podem enviar em grupos.
  const isReadOnlyForMe = hasLeft || (isGroup && (
    isFamilyContext ||
    !isColabOrTeacher ||
    isColabGroupDisabled
  ))

  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)

  const handleExecuteDeleteMessage = async () => {
    if (!messageToDelete) return
    const msgId = messageToDelete
    setIsDeletingMessage(true)

    // Otimista: remove da lista imediatamente
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setMessageToDelete(null)

    try {
      const res = await fetch(`/api/chat/messages?message_id=${msgId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao excluir mensagem')
        if (activeConversation?.id) fetchMessages(activeConversation.id)
      } else {
        toast.success('Mensagem apagada')
        window.dispatchEvent(new CustomEvent('chat:conversation-updated'))
      }
    } catch {
      toast.error('Erro de conexão ao excluir mensagem')
      if (activeConversation?.id) fetchMessages(activeConversation.id)
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
          aluno_id: (currentUser as any)?.aluno_id || undefined
        })
      })
      if (!res.ok) {
        if (activeConversation?.id) fetchMessages(activeConversation.id)
      }
    } catch {
      if (activeConversation?.id) fetchMessages(activeConversation.id)
    }
  }

  // Rolagem à prova de falhas: scrollTop síncrono no container + scrollIntoView com block: 'end'
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

  // Disparo em múltiplas fases para compensar transição do Framer Motion (220ms), fontes e miniaturas
  const scrollToBottomMultiPass = useCallback((smooth = false) => {
    scrollToBottom(smooth)
    requestAnimationFrame(() => scrollToBottom(smooth))
    setTimeout(() => scrollToBottom(smooth), 50)
    setTimeout(() => scrollToBottom(smooth), 150)
    setTimeout(() => scrollToBottom(smooth), 280)
  }, [scrollToBottom])

  // Rastreia se o usuário está perto do final para respeitar rolagem manual para cima
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (isFirstLoadRef.current) return
    const threshold = 100
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    isNearBottomRef.current = isBottom
  }, [])

  // Reseta para o final sempre que uma nova conversa for aberta
  useEffect(() => {
    if (isModalOpen && activeConversation?.id) {
      isNearBottomRef.current = true
      isFirstLoadRef.current = true
      const timer = setTimeout(() => {
        isFirstLoadRef.current = false
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen, activeConversation?.id])

  // Observador de Redimensionamento: garante que qualquer mudança de altura do conteúdo (PDFs, fotos, etc.)
  // mantenha a tela presa na última mensagem se o usuário estiver no fim
  useEffect(() => {
    const el = scrollContainerRef.current
    const content = messagesContentRef.current
    if (!el || !isModalOpen) return

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
  }, [isModalOpen])

  // 1. Carregar mensagens da conversa (com suporte a SWR e cache instantâneo)
  const fetchMessages = useCallback(async (convId: string, silent = false) => {
    if (!silent) {
      setLoadingMessages(true)
    }
    try {
      const data = await prefetchConversationMessages(convId, { force: true })
      if (data && useChatStore.getState().activeConversation?.id === convId) {
        setMessages(data.messages || [])
        if (data.hasLeft !== undefined) {
          setHasLeft(Boolean(canHaveLeft && data.hasLeft))
        }
        if (!silent || isNearBottomRef.current || isFirstLoadRef.current) {
          scrollToBottomMultiPass(false)
        }
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    } finally {
      setLoadingMessages(false)
    }
  }, [scrollToBottomMultiPass, canHaveLeft])

  // 2. Marcar conversa como lida
  const markAsRead = useCallback(async (convId: string) => {
    try {
      const res = await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conversation_id: convId, 
          user_id: currentUserId,
          aluno_id: activeAlunoId,
          context: activeConversation?.context || (pathname?.includes('/colaborador') || pathname?.includes('/admin') ? 'colaborador' : 'familia')
        })
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('chat:unread-changed'))
        window.dispatchEvent(new CustomEvent('chat:conversation-updated'))
      }
    } catch (_) {}
  }, [currentUserId, activeAlunoId, activeConversation?.context, pathname])

  useEffect(() => {
    if (isModalOpen && activeConversation?.id) {
      const convId = activeConversation.id
      const cached = getCachedMessages(convId)

      if (cached && cached.messages && cached.messages.length > 0) {
        // INSTANTÂNEO (0ms): renderiza mensagens imediatamente sem tela de loading!
        setMessages(cached.messages)
        if (cached.hasLeft !== undefined) {
          setHasLeft(Boolean(canHaveLeft && cached.hasLeft))
        }
        setLoadingMessages(false)
        scrollToBottomMultiPass(false)

        // Revalidação em segundo plano sem bloquear a interface (SWR)
        fetchMessages(convId, true)
      } else if (activeConversation.lastMessageText) {
        // Exibição instantânea da última mensagem se histórico ainda não foi carregado
        const seedMsg: MessageItem = {
          id: 'seed-' + convId,
          conversation_id: convId,
          sender_id: activeConversation.lastMessageBy || '',
          content: activeConversation.lastMessageText,
          content_type: 'text',
          status: 'read',
          created_at: activeConversation.lastMessageAt || new Date().toISOString()
        }
        setMessages([seedMsg])
        setLoadingMessages(false)
        scrollToBottomMultiPass(false)
        fetchMessages(convId, true)
      } else {
        setLoadingMessages(true)
        fetchMessages(convId, false)
      }

      markAsRead(convId)
      if (activeConversation.unreadCount && activeConversation.unreadCount > 0) {
        useChatStore.getState().setUnreadTotal(Math.max(0, useChatStore.getState().unreadTotal - activeConversation.unreadCount))
      }
    } else {
      setShowEmojiPicker(false)
      setShowAttachMenu(false)
    }
  }, [isModalOpen, activeConversation?.id, activeConversation?.unreadCount, activeConversation?.lastMessageText, fetchMessages, markAsRead, scrollToBottomMultiPass])

  // Monitora alterações na lista de mensagens para garantir que fique no final
  useEffect(() => {
    if (!isModalOpen) return
    if (isFirstLoadRef.current || isNearBottomRef.current) {
      scrollToBottomMultiPass(false)
    }
  }, [messages, isModalOpen, scrollToBottomMultiPass])

  // 3. Ouvintes de Eventos Realtime com sincronização automática do cache
  useEffect(() => {
    const handleReceived = (e: CustomEvent) => {
      if (hasLeft) return
      const msg = e.detail as MessageItem
      if (msg && msg.conversation_id === activeConversation?.id) {
        appendCachedMessage(activeConversation.id, msg)
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (isNearBottomRef.current || isFirstLoadRef.current) {
          scrollToBottomMultiPass(true)
        }
      }
    }

    const handleUpdated = (e: CustomEvent) => {
      const msg = e.detail as MessageItem
      if (msg && msg.conversation_id === activeConversation?.id) {
        if ((msg as any).is_deleted) {
          removeCachedMessage(activeConversation.id, msg.id)
          setMessages(prev => prev.filter(m => m.id !== msg.id))
        } else {
          updateCachedMessage(activeConversation.id, msg)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m))
        }
      }
    }

    const handleDeleted = (e: CustomEvent) => {
      const msg = e.detail as MessageItem
      if (msg && activeConversation?.id && (msg.conversation_id === activeConversation.id || !msg.conversation_id)) {
        removeCachedMessage(activeConversation.id, msg.id)
        setMessages(prev => prev.filter(m => m.id !== msg.id))
      }
    }

    window.addEventListener('chat:message-received' as any, handleReceived)
    window.addEventListener('chat:message-updated' as any, handleUpdated)
    window.addEventListener('chat:message-deleted' as any, handleDeleted)

    return () => {
      window.removeEventListener('chat:message-received' as any, handleReceived)
      window.removeEventListener('chat:message-updated' as any, handleUpdated)
      window.removeEventListener('chat:message-deleted' as any, handleDeleted)
    }
  }, [activeConversation?.id, scrollToBottom])

  // 4. Enviar mensagem
  const handleSendMessage = async (customContent?: string, type: 'text' | 'image' | 'video' | 'file' = 'text', metadata: any = {}) => {
    const textToSend = customContent !== undefined ? customContent : inputText.trim()
    if (!textToSend && type === 'text') return
    if (!activeConversation?.id) return
    if (isReadOnlyForMe) {
      toast.error(
        isColabGroupDisabled
          ? 'O envio de mensagens nos grupos da turma por colaboradores foi temporariamente pausado pela administração escolar.'
          : isColabOrTeacher
          ? 'No Modo Família, o envio de mensagens em grupos da turma é desativado. Alterne para o Modo Colaborador para enviar.'
          : 'No Modo Família, o envio de mensagens em grupos da turma é desativado.'
      )
      return
    }

    if (isDirectColabDisabled) {
      setShowColabNoticeModal(true)
      return
    }

    setIsSending(true)
    playWhatsAppSendSound()
    triggerHaptic('selection')

    const tempId = 'temp-' + Date.now()
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: currentUserId,
      sender_name: currentUser?.nome || 'Você',
      sender_perfil: currentUser?.perfil || currentUser?.cargo || 'Usuário',
      content: textToSend,
      content_type: type,
      status: 'sending',
      metadata,
      created_at: new Date().toISOString()
    }

    // Atualização otimista instantânea (0ms de latência percebida)
    appendCachedMessage(activeConversation.id, optimisticMsg)
    setMessages(prev => [...prev, optimisticMsg])
    if (customContent === undefined) setInputText('')
    setShowEmojiPicker(false)
    setShowAttachMenu(false)
    isNearBottomRef.current = true
    scrollToBottomMultiPass(true)

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          content: textToSend,
          content_type: type,
          metadata,
          sender_id: currentUserId,
          sender_name: currentUser?.nome || 'Você',
          sender_perfil: currentUser?.perfil || currentUser?.cargo || 'Usuário',
          context: activeConversation.context || (isFamilyOrStudent ? 'familia' : 'colaborador'),
          isFamilyInitiated: activeConversation.context === 'familia'
        })
      })

      if (res.ok) {
        const data = await res.json()
        const saved = data.message
        if (saved) {
          updateCachedMessage(activeConversation.id, saved)
        }
        setMessages(prev => {
          const alreadyHasRealtime = prev.some(m => m.id === saved.id)
          if (alreadyHasRealtime) {
            return prev.filter(m => m.id !== tempId)
          }
          return prev.map(m => m.id === tempId ? saved : m)
        })
      } else {
        const errJson = await res.json().catch(() => ({}))
        if (errJson.error) {
          toast.error(errJson.error)
        }
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
    } finally {
      setIsSending(false)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  // 5. Upload de Imagem, Vídeo ou Documento com compressão client-side
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileKind: 'media' | 'doc') => {
    const rawFile = e.target.files?.[0]
    if (!rawFile || !activeConversation?.id) return
    if (isReadOnlyForMe) {
      toast.error(
        isColabGroupDisabled
          ? 'O envio de mensagens nos grupos da turma por colaboradores foi temporariamente pausado pela administração escolar.'
          : 'No Modo Família, o envio em grupos da turma é desativado.'
      )
      return
    }

    if (isDirectColabDisabled) {
      setShowColabNoticeModal(true)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isModalOpen || !activeConversation) return null

  // Agrupamento de mensagens por data com desduplicação rigorosa de chaves
  const seenMsgIds = new Set<string>()
  const uniqueMessages = messages.filter(msg => {
    if (!msg.id) return false
    if (seenMsgIds.has(msg.id)) return false
    seenMsgIds.add(msg.id)
    return true
  })

  const groupedMessages: { date: string; items: MessageItem[] }[] = []
  uniqueMessages.forEach(msg => {
    const dateLabel = formatGroupDate(msg.created_at)
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && lastGroup.date === dateLabel) {
      lastGroup.items.push(msg)
    } else {
      groupedMessages.push({ date: dateLabel, items: [msg] })
    }
  })

  const filteredGroups = isSearching && searchQuery.trim()
    ? groupedMessages.map(g => ({
        ...g,
        items: g.items.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      })).filter(g => g.items.length > 0)
    : groupedMessages

  return (
    <AnimatePresence>
      <div 
        className="wa-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          background: 'rgba(11, 20, 26, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeConversationModal()
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="wa-chat-window"
          style={{
            width: '100%',
            maxWidth: 720,
            height: '92vh',
            maxHeight: 840,
            borderRadius: 20,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#efeae2', // Fundo clássico WhatsApp
            boxShadow: '0 24px 60px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            position: 'relative'
          }}
        >
          {/* ──────────────────────────────────────────────────────────── */}
          {/* CABEÇALHO DO WHATSAPP                                       */}
          {/* ──────────────────────────────────────────────────────────── */}
          <div
            style={{
              height: 64,
              background: '#008069', // Verde cabeçalho oficial WhatsApp
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              flexShrink: 0,
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <button
                onClick={closeConversationModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                title="Voltar"
              >
                <ArrowLeft size={20} strokeWidth={2.4} />
              </button>

              {/* Avatar do Contato / Grupo */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: activeConversation.isGroup ? '#00a884' : '#128c7e',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 15,
                  flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}
              >
                {activeConversation.isGroup ? (
                  activeConversation.grupo_id ? <Building2 size={20} /> : <Users size={20} />
                ) : (
                  getInitials(activeConversation.title)
                )}
              </div>

              {/* Nome e Status */}
              <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeConversation.title}</span>
                  {isArchived && (
                    <span style={{ fontSize: 9.5, background: 'rgba(255, 255, 255, 0.22)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '1px 6.5px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>
                      Arquivada
                    </span>
                  )}
                  {hasLeft && (
                    <span style={{ fontSize: 9.5, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 6.5px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>
                      Saiu da turma
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
                  {activeConversation.ano_letivo && (
                    <span
                      title={`Ano Letivo ${activeConversation.ano_letivo}`}
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
                      Ano {activeConversation.ano_letivo}
                    </span>
                  )}
                  {(() => {
                    if (activeConversation.isGroup) {
                      if (activeConversation.aluno_nome) {
                        return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Aluno(a): {activeConversation.aluno_nome}</span>
                      }
                      if (activeConversation.subtitle && activeConversation.subtitle !== 'Grupo') {
                        return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeConversation.subtitle}</span>
                      }
                      if (!activeConversation.ano_letivo) {
                        return <span>Mural Oficial da Turma</span>
                      }
                      return null
                    }
                    if (activeConversation.aluno_nome) {
                      const rawRole = activeConversation.subtitle ? activeConversation.subtitle.split('•')[0].trim() : ''
                      const role = rawRole && rawRole !== 'online' && rawRole !== 'Contato' ? rawRole : 'Educador(a)'
                      return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{role} • Aluno(a): {activeConversation.aluno_nome}</span>
                    }
                    return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeConversation.subtitle || 'online'}</span>
                  })()}
                </div>
              </div>
            </div>

            {/* Ações do Topo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isArchiving}
                style={{
                  background: isArchived ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = isArchived ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}
                title={isArchived ? "Desarquivar esta conversa" : "Arquivar esta conversa"}
              >
                {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              </button>

              <button
                type="button"
                onClick={() => setIsSearching(!isSearching)}
                style={{
                  background: isSearching ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#ffffff',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = isSearching ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}
                title="Pesquisar mensagens"
              >
                <Search size={15} />
              </button>

              <button
                type="button"
                onClick={closeConversationModal}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#ffffff',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.45)'
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                }}
                title="Fechar conversa"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Barra de Pesquisa retrátil dentro da conversa */}
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 48, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{
                  background: '#f0f2f5',
                  padding: '6px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid #e9edef',
                  overflow: 'hidden',
                  zIndex: 9
                }}
              >
                <Search size={16} color="#54656f" />
                <input
                  type="text"
                  placeholder="Pesquisar na conversa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    color: '#111b21'
                  }}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* CORPO DE MENSAGENS COM WALLPAPER DO WHATSAPP                 */}
          {/* ──────────────────────────────────────────────────────────── */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowAnchor: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M9 20L19 10M19 20L9 10M85 85a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM40 70h10v10H40zM75 25l8 12-16 0z' fill='%23b4b8b6' fill-opacity='0.16' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              backgroundColor: '#efeae2'
            }}
          >
            <div ref={messagesContentRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%' }}>
            {loadingMessages && filteredGroups.length > 0 && (
              <div 
                style={{ 
                  position: 'sticky', 
                  top: 0, 
                  alignSelf: 'center',
                  background: 'rgba(255, 255, 255, 0.9)', 
                  backdropFilter: 'blur(4px)',
                  padding: '3px 10px', 
                  borderRadius: 20, 
                  fontSize: 11, 
                  fontWeight: 600,
                  color: '#008069',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  zIndex: 10
                }}
              >
                <Loader2 size={11} className="animate-spin" />
                <span>Atualizando...</span>
              </div>
            )}

            {loadingMessages && filteredGroups.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: '#54656f' }}>
                <Loader2 size={24} className="animate-spin" />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Carregando conversa...</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', maxWidth: 280, color: '#54656f' }}>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '12px 18px',
                    borderRadius: 14,
                    fontSize: 12.5,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    lineHeight: 1.4
                  }}
                >
                  🔒 As mensagens desta conversa são criptografadas e seguras. Inicie uma nova conversa institucional abaixo.
                </div>
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.date} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Pílula de Data estilo WhatsApp */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px 0' }}>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.92)',
                        boxShadow: '0 1px 2px rgba(11,20,26,0.12)',
                        color: '#54656f',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 8,
                        letterSpacing: '0.04em'
                      }}
                    >
                      {group.date}
                    </span>
                  </div>

                  {/* Mensagens do Grupo de Data */}
                  {group.items.map((msg) => {
                    const isMe = 
                      msg.sender_id === currentUserId || 
                      msg.sender_id === currentUser?.id || 
                      (Boolean((currentUser as any)?.responsavel_id) && msg.sender_id === (currentUser as any)?.responsavel_id) ||
                      (Boolean((currentUser as any)?.colaborador_id) && msg.sender_id === (currentUser as any)?.colaborador_id)
                    const isPending = msg.status === 'sending'
                    const isRead = msg.status === 'read'
                    const isDelivered = msg.status === 'delivered'

                    const senderPerfilMsg = ((msg as any).sender_perfil || '').toLowerCase()
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
                      isColabOrTeacher && 
                      isMsgSentByColab && 
                      (isMe || isAdmin) &&
                      !isPending

                    const reactionsList: any[] = Array.isArray(msg.metadata?.reactions) ? msg.metadata.reactions : []
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
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isMe ? 'flex-end' : 'flex-start',
                          width: '100%'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '78%',
                            minWidth: 90,
                            padding: '6px 9px 5px 10px',
                            borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                            background: isMe ? '#d9fdd3' : '#ffffff', // Verde claro WhatsApp para mim, branco para o outro
                            boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
                            position: 'relative',
                            wordBreak: 'break-word',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3
                          }}
                        >
                          {/* Barra Flutuante de Reações com Emojis */}
                          {activeReactionMsgId === msg.id && (
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
                                      handleToggleReaction(msg.id, emoji)
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

                          {/* Nome do remetente (apenas se for grupo e não for eu) */}
                          {!isMe && activeConversation.isGroup && (
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: '#128c7e',
                                marginBottom: 2
                              }}
                            >
                              {msg.sender_name || 'Participante'}
                            </div>
                          )}

                          {/* Se for Vídeo Anexado */}
                          {(msg.content_type === 'video' || (msg.metadata?.mime_type && msg.metadata.mime_type.startsWith('video/')) || /\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(msg.metadata?.file_url || '')) && msg.metadata?.file_url && (
                            <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 4, background: '#0b141a', maxWidth: 360, position: 'relative' }}>
                              <video
                                src={msg.metadata.file_url}
                                poster={msg.metadata?.thumbnail_url}
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
                                    url: msg.metadata?.file_url || '',
                                    fileName: msg.metadata?.file_name || 'Vídeo.mp4',
                                    fileSize: msg.metadata?.file_size
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
                          {msg.content_type !== 'video' && !(msg.metadata?.mime_type && msg.metadata.mime_type.startsWith('video/')) && !/\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(msg.metadata?.file_url || '') && (msg.content_type === 'image' || (!msg.content_type && msg.metadata?.file_url && /\.(jpg|jpeg|png|webp|heic|heif|gif)(\?|$)/i.test(msg.metadata.file_url))) && msg.metadata?.file_url && (
                            <div 
                              style={{ borderRadius: 8, overflow: 'hidden', cursor: 'pointer', marginBottom: 4 }}
                              onClick={() => {
                                setActiveMediaViewer({
                                  type: 'image',
                                  url: msg.metadata?.file_url || '',
                                  fileName: msg.metadata?.file_name || 'Foto.webp',
                                  fileSize: msg.metadata?.file_size
                                })
                              }}
                            >
                              <HeicSafeImage
                                src={msg.metadata.file_url}
                                alt="Foto"
                                style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', borderRadius: 8 }}
                              />
                            </div>
                          )}

                          {/* Se for Documento PDF Anexado (renderiza com preview visual de página do PDF) */}
                          {msg.metadata?.file_url && (
                            /\.pdf(\?|$)/i.test(msg.metadata.file_url) || 
                            msg.metadata?.mime_type?.includes('pdf') || 
                            (msg.metadata?.file_name && msg.metadata.file_name.toLowerCase().endsWith('.pdf'))
                          ) && (
                            <PdfBubbleCard
                              url={msg.metadata.file_url}
                              fileName={msg.metadata.file_name || 'Documento.pdf'}
                              fileSize={msg.metadata.file_size}
                              onClick={() => {
                                setActiveMediaViewer({
                                  type: 'pdf',
                                  url: msg.metadata?.file_url || '',
                                  fileName: msg.metadata?.file_name || 'Documento.pdf',
                                  fileSize: msg.metadata?.file_size
                                })
                              }}
                            />
                          )}

                          {/* Se for Outro Arquivo / Documento (não PDF, não vídeo, não imagem) */}
                          {msg.content_type === 'file' && msg.metadata?.file_url && 
                           !/\.pdf(\?|$)/i.test(msg.metadata.file_url) && 
                           !msg.metadata?.mime_type?.includes('pdf') && 
                           !(msg.metadata?.file_name && msg.metadata.file_name.toLowerCase().endsWith('.pdf')) && 
                           !/\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(msg.metadata.file_url) && (
                            <div
                              onClick={() => {
                                setActiveMediaViewer({
                                  type: 'file',
                                  url: msg.metadata?.file_url || '',
                                  fileName: msg.metadata?.file_name || 'Documento',
                                  fileSize: msg.metadata?.file_size
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
                                  {msg.metadata.file_name || 'Documento'}
                                </div>
                                <div style={{ fontSize: 10.5, color: '#667781' }}>
                                  {msg.metadata.file_size ? `${Math.round(msg.metadata.file_size / 1024)} KB` : 'Arquivo'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadMediaFile(msg.metadata.file_url, msg.metadata.file_name || 'Documento')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 4,
                                  color: '#54656f'
                                }}
                                title="Baixar"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          )}

                          {/* Texto da Mensagem (oculta se for apenas rótulo de anexo duplicado) */}
                          {msg.content && 
                           msg.content !== '📷 Foto' && 
                           msg.content !== '🎥 Vídeo' && 
                           msg.content !== msg.metadata?.file_name && (
                            <div
                              style={{
                                fontSize: 13.5,
                                lineHeight: 1.38,
                                color: '#111b21',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {msg.content}
                            </div>
                          )}

                          {/* Pílulas de Reações com Emojis */}
                          {reactionEntries.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 3,
                                marginTop: 3,
                                marginBottom: 2
                              }}
                            >
                              {reactionEntries.map(([emoji, data]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleReaction(msg.id, emoji)
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

                          {/* Rodapé da Mensagem: Reação + Excluir + Horário + Ticks do WhatsApp */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 3,
                              fontSize: 10.5,
                              color: '#667781',
                              marginTop: -2,
                              marginLeft: 'auto',
                              paddingLeft: 14
                            }}
                          >
                            {!isPending && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)
                                }}
                                title="Reagir"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '0 2px',
                                  marginRight: 2,
                                  cursor: 'pointer',
                                  color: activeReactionMsgId === msg.id ? '#0284c7' : '#94a3b8',
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
                                  e.currentTarget.style.color = activeReactionMsgId === msg.id ? '#0284c7' : '#94a3b8'
                                }}
                              >
                                <Smile size={12} />
                              </button>
                            )}

                            {canDeleteMsg && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMessageToDelete(msg.id)
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

                            <span>{formatMessageTime(msg.created_at)}</span>

                            {isMe && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 1 }}>
                                {isPending ? (
                                  <span title="Enviando..."><Clock size={11} color="#667781" /></span>
                                ) : isRead ? (
                                  <span title="Lida"><CheckCheck size={14} color="#53bdeb" strokeWidth={2.4} /></span>
                                ) : isDelivered ? (
                                  <span title="Entregue"><CheckCheck size={14} color="#8696a0" strokeWidth={2.4} /></span>
                                ) : (
                                  <span title="Enviada"><Check size={14} color="#8696a0" strokeWidth={2.2} /></span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* BARRA INFERIOR DE ENVIO DE MENSAGENS ESTILO WHATSAPP         */}
          {/* ──────────────────────────────────────────────────────────── */}
          {isReadOnlyForMe ? (
            <div
              style={{
                background: hasLeft ? '#fffbeb' : '#f8fafc',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                borderTop: hasLeft ? '1px solid #fde68a' : '1px solid #e2e8f0',
                textAlign: 'center'
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: hasLeft ? '#fef3c7' : '#fee2e2',
                color: hasLeft ? '#b45309' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Lock size={15} />
              </div>
              <div style={{ fontSize: 13, color: hasLeft ? '#92400e' : '#475569', fontWeight: 600 }}>
                {hasLeft
                  ? (isFamilyContext
                      ? 'Histórico da turma anterior: você pode consultar todas as mensagens enviadas enquanto o aluno esteve nesta turma.'
                      : 'Você não participa mais deste grupo. O histórico anterior permanece disponível apenas para consulta.')
                  : isColabGroupDisabled
                  ? 'O envio de mensagens nos grupos da turma por colaboradores foi temporariamente pausado pela administração escolar.'
                  : isFamilyContext
                  ? (isColabOrTeacher
                      ? 'Mural da turma: no Modo Família o envio de mensagens é desativado. Alterne para o Modo Colaborador para enviar.'
                      : 'Mural da turma: no Modo Família o envio de mensagens é desativado.')
                  : 'Apenas membros da equipe escolar podem enviar mensagens neste chat. Alunos e familiares apenas visualizam.'}
              </div>
            </div>
          ) : isDirectColabDisabled ? (
            <div
              onClick={() => setShowColabNoticeModal(true)}
              style={{
                padding: '12px 18px',
                background: '#fef2f2',
                borderTop: '1px solid #fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
              onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Lock size={16} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 1 }}>
                    Conversas com Colaboradores Desativadas
                  </div>
                  <div style={{ fontSize: 11.5, color: '#b91c1c', lineHeight: 1.35 }}>
                    O envio de mensagens foi temporariamente pausado. Toque para ver detalhes.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                Ver Detalhes
              </span>
            </div>
          ) : isBlocked ? (
            <div
              style={{
                padding: '6px 10px',
                background: '#f0f2f5',
                borderTop: '1px solid #d1d7db',
                position: 'relative',
                flexShrink: 0
              }}
            >
              <ChatBlockedNoticeCard status={businessHoursStatus} compact />
            </div>
          ) : (
            <div
              style={{
                background: '#f0f2f5',
                padding: '8px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderTop: '1px solid #d1d7db',
                position: 'relative',
                flexShrink: 0
              }}
            >
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

              {/* Popover de Emojis Rápidos */}
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    style={{
                      background: '#ffffff',
                      borderRadius: 14,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 4px 18px rgba(0,0,0,0.12)',
                      border: '1px solid #e2e8f0',
                      overflowX: 'auto'
                    }}
                  >
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setInputText(prev => prev + emoji)
                          if (textareaRef.current) textareaRef.current.focus()
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 22,
                          cursor: 'pointer',
                          padding: '2px 4px',
                          transition: 'transform 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Menu Pop-up de Anexo */}
              {showAttachMenu && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 60,
                    left: 12,
                    background: '#ffffff',
                    borderRadius: 16,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    zIndex: 100,
                    minWidth: 180
                  }}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
                      <ImageIcon size={15} />
                    </div>
                    Foto ou Vídeo
                  </button>

                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
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
                </div>
              )}

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

              {/* Linha principal com Emoji, Clip, Input e Envio */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {/* Botão Emoji */}
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker)
                    setShowAttachMenu(false)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: showEmojiPicker ? '#008069' : '#54656f',
                    cursor: 'pointer',
                    padding: 8,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s'
                  }}
                  title="Emojis"
                >
                  <Smile size={22} />
                </button>

                {/* Botão de Anexo Clip */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(!showAttachMenu)
                    setShowEmojiPicker(false)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: showAttachMenu ? '#008069' : '#54656f',
                    cursor: 'pointer',
                    padding: 8,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s'
                  }}
                  title="Anexar arquivo"
                >
                  <Paperclip size={22} />
                </button>

                {/* Textarea de Mensagem com Auto-expand */}
                <div
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    borderRadius: 22,
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #d1d7db',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={e => {
                      setInputText(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem"
                    rows={1}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: 14.5,
                      lineHeight: 1.35,
                      color: '#111b21',
                      maxHeight: 120,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Botão Redondo Verde do WhatsApp de Envio */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isSending || uploadingFile || (!inputText.trim())}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#25d366', // Verde WhatsApp
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (!inputText.trim()) ? 'default' : 'pointer',
                    opacity: (!inputText.trim()) ? 0.7 : 1,
                    boxShadow: '0 3px 8px rgba(37, 211, 102, 0.4)',
                    transition: 'transform 0.15s, opacity 0.15s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    if (inputText.trim()) e.currentTarget.style.transform = 'scale(1.06)'
                  }}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Enviar mensagem"
                >
                  {isSending || uploadingFile ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={18} style={{ transform: 'translateX(1px)' }} />
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Modal Lightbox de Mídia (Imagem, Vídeo, PDF, Arquivo com botão Fechar e Baixar) */}
        <ChatMediaViewerModal
          media={activeMediaViewer}
          onClose={() => setActiveMediaViewer(null)}
        />

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

        {/* Modal Centrado de Aviso: Conversas com Colaboradores Desativadas */}
        <ColabChatNoticeModal
          isOpen={showColabNoticeModal}
          onClose={() => setShowColabNoticeModal(false)}
          colaboradorNome={activeConversation?.title}
          alunoNome={activeConversation?.aluno_nome || undefined}
          whatsappUrl={secWa?.url}
          whatsappLabel={secWa?.label}
        />
      </div>
    </AnimatePresence>
  )
}
