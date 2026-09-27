'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  MessageSquare, 
  Search, 
  Users, 
  Building2, 
  UserCheck, 
  Clock, 
  CheckCheck, 
  Phone, 
  Plus, 
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  CreditCard,
  GraduationCap,
  ArrowUpRight,
  FileText,
  User,
  Heart,
  Archive,
  ArchiveRestore,
  ArrowLeft
} from 'lucide-react'
import { useParams, usePathname } from 'next/navigation'
import { useChatStore, ChatConversationMeta, formatTurmaBadge } from '@/lib/chatStore'
import { prefetchConversationMessages, prefetchBatchConversations } from '@/lib/chatMessagesCache'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import { ChatConversationModal } from './ChatConversationModal'
import { ChatBadge } from './ChatBadge'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { getWhatsAppShareUrl, getSecretariaWhatsApp } from '@/lib/whatsapp'
import { getInitials } from '@/lib/utils'
import { checkIsCollaboratorOrTeacher, checkIsEquipeEscolar, sortTurmasByName } from '@/lib/chatPermissions'
import { toast } from 'sonner'
import { ColabChatNoticeModal } from './ColabChatNoticeModal'

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

export function FloatingChat() {
  const { 
    isModalOpen,
    isDrawerOpen, 
    openDrawer, 
    closeDrawer, 
    toggleDrawer, 
    openConversationModal, 
    unreadTotal 
  } = useChatStore()
  const { currentUser } = useApp()
  const { adConfig } = useAgendaDigital()
  const params = useParams<{ slug?: string }>()
  const pathname = usePathname()
  const selectedStudentCtx = useSelectedStudent()

  // Extrair ID do aluno ativo de forma precisa na Agenda Digital
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

  const activeAlunoId = slugFromParam || slugFromPath || studentFromCtx || studentFromUser || undefined

  // Ativar ouvinte Realtime para sons, push e badges em toda a Agenda Digital
  useChatRealtime(activeAlunoId)

  const userPerfil = ((currentUser as any)?.perfil || '').trim()
  const userCargo = ((currentUser as any)?.cargo || '').trim()
  const isSchoolStaff = checkIsCollaboratorOrTeacher(userCargo, userPerfil, currentUser)

  const isColaboradorRoute = pathname?.includes('/agenda-digital/colaborador') || pathname?.includes('/agenda-digital/admin')
  const initialMode: 'familia' | 'colaborador' = (isColaboradorRoute && isSchoolStaff) ? 'colaborador' : 'familia'
  const [chatViewMode, setChatViewMode] = useState<'familia' | 'colaborador'>(initialMode)

  useEffect(() => {
    if (!isSchoolStaff) {
      setChatViewMode('familia')
    } else if (pathname?.includes('/agenda-digital/colaborador') || pathname?.includes('/agenda-digital/admin')) {
      setChatViewMode('colaborador')
    } else if (activeAlunoId) {
      setChatViewMode('familia')
    }
  }, [pathname, activeAlunoId, isSchoolStaff])

  const [colabNoticeModal, setColabNoticeModal] = useState<{
    isOpen: boolean
    colaboradorNome?: string
    alunoNome?: string
    whatsappUrl?: string
    whatsappLabel?: string
    onOpenTurmaGroup?: () => void
  }>({ isOpen: false })

  const [activeTab, setActiveTab] = useState<'conversas' | 'contatos'>('conversas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string | null>(null)
  const [showArchivedView, setShowArchivedView] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [contactsData, setContactsData] = useState<{
    role?: string
    activeMode?: 'familia' | 'colaborador'
    hasDualRole?: boolean
    dualRoleInfo?: {
      alunoNome?: string
      alunoId?: string
      colaboradorCargo?: string
      colaboradorPerfil?: string
    } | null
    equipes: any[]
    turmas: any[]
    colaboradores: any[]
    alunos?: any[]
    whatsappChannels?: any[]
  }>({ equipes: [], turmas: [], colaboradores: [] })

  // O Modo Colaborador e o Switcher Dual-Role NUNCA devem aparecer se o usuário não pertencer à equipe escolar!
  // Usuários familiares/responsáveis/alunos que não forem da equipe escolar NUNCA podem ter isDualRole = true.
  const isDualRole = Boolean(
    isSchoolStaff && (
      contactsData.hasDualRole !== undefined
        ? contactsData.hasDualRole
        : Boolean(
            (currentUser as any)?.hasDualRole && 
            ((currentUser as any)?.responsavel_id || (currentUser as any)?.aluno_id)
          )
    )
  )

  const dualRoleStudentFirstName = 
    contactsData.dualRoleInfo?.alunoNome?.split(' ')[0] || 
    (contactsData.alunos?.[0]?.nome?.split(' ')[0]) || 
    ''
  
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [startingChatId, setStartingChatId] = useState<string | null>(null)
  const [showWhatsAppFallback, setShowWhatsAppFallback] = useState(false)

  // Estados para expansão hierárquica de turmas e alunos (acesso exclusivo do colaborador/professor)
  const isColaboradorView = isSchoolStaff && (chatViewMode === 'colaborador' || isColaboradorRoute)
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null)
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null)
  const [turmaStudentsData, setTurmaStudentsData] = useState<Record<string, { loading: boolean; alunos: any[]; error?: string }>>({})

  // Pré-carregamento de alunos e responsáveis da turma em background (0ms no clique)
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

  const containerRef = useRef<HTMLDivElement>(null)

  // Função para resetar a visualização para o estado inicial
  const resetToInitialView = useCallback(() => {
    setActiveTab('conversas')
    setShowArchivedView(false)
    setSearchQuery('')
    setSearchedStudents([])
    setIsSearchingStudents(false)
    setSelectedStudentFilter(null)
    setExpandedTurmaId(null)
    setExpandedAlunoId(null)
    setStartingChatId(null)
    setShowWhatsAppFallback(false)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    resetToInitialView()
    closeDrawer()
  }, [resetToInitialView, closeDrawer])

  const handleToggleDrawer = useCallback(() => {
    if (isDrawerOpen) {
      resetToInitialView()
    }
    toggleDrawer()
  }, [isDrawerOpen, resetToInitialView, toggleDrawer])

  // Sempre que a gaveta for fechada, reseta os estados para a tela inicial
  useEffect(() => {
    if (!isDrawerOpen) {
      resetToInitialView()
    }
  }, [isDrawerOpen, resetToInitialView])

  // Fechar gaveta ao clicar fora
  useEffect(() => {
    if (!isDrawerOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCloseDrawer()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDrawerOpen, handleCloseDrawer])

  // Fechar com a tecla ESC
  useEffect(() => {
    if (!isDrawerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDrawer()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawerOpen, handleCloseDrawer])

  const handleChangeViewMode = (newMode: 'familia' | 'colaborador') => {
    if (!isSchoolStaff && newMode === 'colaborador') return
    if (newMode === chatViewMode) return
    setChatViewMode(newMode)
    setConversations([])
    setExpandedTurmaId(null)
    setExpandedAlunoId(null)
    setSelectedStudentFilter(null)
    setShowArchivedView(false)
    loadConversations(false, newMode)
    loadContacts(false, newMode)
  }

  const getTargetConvId = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('conversation_id') || urlParams.get('openChat')
    }
    return null
  }

  const openedDeepLinkRef = useRef<string | null>(null)

  // 1. Carregar conversas quando abrir a gaveta (com SWR para resposta imediata)
  const loadConversations = async (silent = false, targetMode = chatViewMode) => {
    if (!currentUser) return
    if (!silent && conversations.length === 0) {
      setLoadingConversations(true)
    }
    try {
      const qp = new URLSearchParams()
      if (targetMode === 'familia') {
        if (activeAlunoId) qp.set('aluno_id', activeAlunoId)
        qp.set('context', 'familia')
      } else {
        qp.set('context', 'colaborador')
      }
      const deepId = getTargetConvId()
      if (deepId) {
        qp.set('conversation_id', deepId)
      }
      const res = await fetch(`/api/chat/conversations?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const convList = data.conversations || []
        setConversations(convList)

        const deepLinkId = getTargetConvId()
        if (deepLinkId && openedDeepLinkRef.current !== deepLinkId) {
          let target = convList.find((c: any) => c.id === deepLinkId)
          if (!target) {
            try {
              const singleRes = await fetch(`/api/chat/conversations?conversation_id=${encodeURIComponent(deepLinkId)}`)
              if (singleRes.ok) {
                const singleData = await singleRes.json()
                target = (singleData.conversations || []).find((c: any) => c.id === deepLinkId)
              }
            } catch {}
          }
          if (target) {
            openedDeepLinkRef.current = deepLinkId
            openDrawer()
            setActiveTab('conversas')
            openConversationModal({
              id: target.id,
              type: target.type,
              title: target.title,
              subtitle: target.subtitle,
              isGroup: target.isGroup,
              turma_id: target.turma_id,
              grupo_id: target.grupo_id,
              aluno_id: target.aluno_id || (chatViewMode === 'familia' ? activeAlunoId : null),
              aluno_nome: target.aluno_nome,
              aluno_turma: target.aluno_turma,
              ano_letivo: target.ano_letivo || '2026',
              unreadCount: 0,
              hasLeft: isSchoolStaff && chatViewMode === 'colaborador' ? Boolean(target.hasLeft) : false,
              leftAt: isSchoolStaff && chatViewMode === 'colaborador' ? target.leftAt : null,
              isArchived: !!target.isArchived,
              context: chatViewMode,
              lastMessageText: target.lastMessageText,
              lastMessageAt: target.lastMessageAt,
              lastMessageBy: target.lastMessageBy
            })

            try {
              const cleanUrl = new URL(window.location.href)
              cleanUrl.searchParams.delete('conversation_id')
              cleanUrl.searchParams.delete('openChat')
              window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''))
            } catch {}
          } else {
            // Target não encontrado ou sem permissão: marca como processado e limpa params da URL para evitar loops
            openedDeepLinkRef.current = deepLinkId
            try {
              const cleanUrl = new URL(window.location.href)
              cleanUrl.searchParams.delete('conversation_id')
              cleanUrl.searchParams.delete('openChat')
              window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''))
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar conversas:', e)
    } finally {
      setLoadingConversations(false)
    }
  }

  // Ouvir deep links via URL no mount e evento personalizado ad:open-chat
  useEffect(() => {
    if (typeof window === 'undefined') return

    // NUNCA abre a gaveta de chat por deep link enquanto o usuário estiver nas telas de seleção
    const isSelectionPage = 
      pathname?.includes('/selecionar-aluno') || 
      pathname?.includes('/selecionar-perfil-admin') || 
      pathname === '/agenda-digital'

    if (isSelectionPage) return

    const urlParams = new URLSearchParams(window.location.search)
    const deepLinkId = urlParams.get('conversation_id') || urlParams.get('openChat')
    const hasChatFlag = urlParams.get('chat') === 'true' || urlParams.get('open') === 'chat'

    if (deepLinkId || hasChatFlag) {
      openDrawer()
      setActiveTab('conversas')
      loadConversations(false, chatViewMode)
      loadContacts(false, chatViewMode)
    }

    const handleCustomOpenChat = (e: any) => {
      if (
        window.location.pathname.includes('/selecionar-aluno') ||
        window.location.pathname.includes('/selecionar-perfil-admin') ||
        window.location.pathname === '/agenda-digital'
      ) {
        return
      }
      const convId = e?.detail?.conversationId
      openDrawer()
      setActiveTab('conversas')
      if (convId) {
        openedDeepLinkRef.current = null
      }
      loadConversations(false, chatViewMode)
    }

    window.addEventListener('ad:open-chat', handleCustomOpenChat)
    return () => {
      window.removeEventListener('ad:open-chat', handleCustomOpenChat)
    }
  }, [chatViewMode, activeAlunoId, openDrawer, pathname])

  useEffect(() => {
    const isSelectionPage = 
      pathname?.includes('/selecionar-aluno') || 
      pathname?.includes('/selecionar-perfil-admin') || 
      pathname === '/agenda-digital'
    if (isSelectionPage) return

    const deepLinkId = getTargetConvId()
    if (deepLinkId && conversations.length > 0 && openedDeepLinkRef.current !== deepLinkId) {
      const target = conversations.find(c => c.id === deepLinkId)
      if (target) {
        openedDeepLinkRef.current = deepLinkId
        openDrawer()
        setActiveTab('conversas')
        openConversationModal({
          id: target.id,
          type: target.type,
          title: target.title,
          subtitle: target.subtitle,
          isGroup: target.isGroup,
          turma_id: target.turma_id,
          grupo_id: target.grupo_id,
          aluno_id: target.aluno_id || (chatViewMode === 'familia' ? activeAlunoId : null),
          aluno_nome: target.aluno_nome,
          aluno_turma: target.aluno_turma,
          ano_letivo: target.ano_letivo || '2026',
          unreadCount: 0,
          hasLeft: isSchoolStaff && chatViewMode === 'colaborador' ? Boolean(target.hasLeft) : false,
          leftAt: isSchoolStaff && chatViewMode === 'colaborador' ? target.leftAt : null,
          isArchived: !!target.isArchived,
          context: chatViewMode,
          lastMessageText: target.lastMessageText,
          lastMessageAt: target.lastMessageAt,
          lastMessageBy: target.lastMessageBy
        })

        try {
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete('conversation_id')
          cleanUrl.searchParams.delete('openChat')
          window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''))
        } catch {}
      }
    }
  }, [conversations, chatViewMode, isSchoolStaff, activeAlunoId, openConversationModal])

  // 2. Carregar contatos permitidos conforme regra de visualização (com SWR)
  const loadContacts = async (silent = false, targetMode = chatViewMode) => {
    if (!currentUser) return
    const hasData = (contactsData.turmas && contactsData.turmas.length > 0) ||
                    (contactsData.alunos && contactsData.alunos.length > 0) ||
                    (contactsData.colaboradores && contactsData.colaboradores.length > 0)
    if (!silent && !hasData) {
      setLoadingContacts(true)
    }
    try {
      const qp = new URLSearchParams()
      if (targetMode === 'familia') {
        if (activeAlunoId) qp.set('aluno_id', activeAlunoId)
        qp.set('context', 'familia')
      } else {
        qp.set('context', 'colaborador')
      }
      const res = await fetch(`/api/chat/contacts?${qp.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContactsData(data)
      }
    } catch (e) {
      console.error('Erro ao buscar contatos:', e)
    } finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    if (isDrawerOpen) {
      loadConversations(conversations.length > 0, chatViewMode)
      loadContacts(false, chatViewMode)
    }
  }, [isDrawerOpen, activeAlunoId, chatViewMode])

  // Pré-carregamento em segundo plano das principais conversas para abertura instantânea (0ms)
  useEffect(() => {
    if (conversations && conversations.length > 0) {
      const topIds = conversations.slice(0, 8).map(c => c.id)
      prefetchBatchConversations(topIds)
    }
  }, [conversations])

  // Pré-carregar silenciosamente turmas do colaborador ao alternar para a aba "Novo Chat"
  useEffect(() => {
    if (activeTab === 'contatos' && contactsData.turmas && contactsData.turmas.length > 0) {
      const firstTurma = contactsData.turmas[0]
      if (firstTurma) {
        prefetchTurma(firstTurma.id, firstTurma.turma_id)
      }
    }
  }, [activeTab, contactsData.turmas, prefetchTurma])

  // Ouvir atualizações de conversas vindas do realtime
  useEffect(() => {
    const handleConvUpdated = () => {
      loadConversations()
    }
    window.addEventListener('chat:conversation-updated' as any, handleConvUpdated)
    window.addEventListener('chat:unread-changed' as any, handleConvUpdated)
    return () => {
      window.removeEventListener('chat:conversation-updated' as any, handleConvUpdated)
      window.removeEventListener('chat:unread-changed' as any, handleConvUpdated)
    }
  }, [])

  const lastArchiveUpdated = useChatStore(s => s.lastArchiveUpdated)

  useEffect(() => {
    if (lastArchiveUpdated) {
      setConversations(prev => prev.map(c => 
        c.id === lastArchiveUpdated.convId 
          ? { ...c, isArchived: lastArchiveUpdated.isArchived } 
          : c
      ))
    }
  }, [lastArchiveUpdated])

  const handleToggleArchive = async (conversationId: string, targetArchived: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isArchived: targetArchived } : c))
      useChatStore.getState().notifyArchiveChanged(conversationId, targetArchived)

      await fetch('/api/chat/conversations/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          is_archived: targetArchived
        })
      })
    } catch (err) {
      console.error('Erro ao alternar arquivamento:', err)
    }
  }

  // Iniciar conversa a partir de um contato ou grupo
  const handleStartChat = async (item: {
    type: 'direct' | 'group'
    targetUserId?: string
    targetUserName?: string
    targetUserPerfil?: string
    grupoId?: string
    turmaId?: string
    title?: string
    subtitle?: string
    alunoId?: string
    alunoNome?: string
    turmaNome?: string
    ano_letivo?: string | number | null
  }) => {
    const uniqueKey = (item.alunoId ? `${item.alunoId}_` : '') + (item.targetUserId || item.grupoId || item.turmaId || 'chat')
    setStartingChatId(uniqueKey)

    if (
      item.type === 'direct' &&
      chatViewMode === 'familia' &&
      adConfig?.chatAuto?.recursos?.permitirConversaColaborador === false
    ) {
      const secWa = getSecretariaWhatsApp(adConfig?.contatosWhatsapp)

      const studentObj = (contactsData?.alunos || []).find((a: any) => String(a.id) === String(item.alunoId || activeAlunoId))
      const turmaGrupoObj = studentObj?.turmaGrupos?.[0] || studentObj?.turmaGrupo
      const onOpenTurmaGroup = turmaGrupoObj ? () => {
        handleStartChat({
          type: 'group',
          grupoId: turmaGrupoObj.id,
          turmaId: turmaGrupoObj.turma_id,
          title: turmaGrupoObj.nome,
          subtitle: 'Grupo da Turma',
          ano_letivo: turmaGrupoObj.ano_letivo || '2026'
        })
      } : undefined

      setColabNoticeModal({
        isOpen: true,
        colaboradorNome: item.targetUserName,
        alunoNome: item.alunoNome,
        whatsappUrl: secWa?.url,
        whatsappLabel: secWa?.label,
        onOpenTurmaGroup
      })
      setStartingChatId(null)
      return
    }

    const isColabOrAdmin = checkIsEquipeEscolar(currentUser?.perfil, currentUser?.cargo, currentUser)

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          targetUserId: item.targetUserId,
          targetUserName: item.targetUserName,
          targetUserPerfil: item.targetUserPerfil,
          grupoId: item.grupoId,
          turmaId: item.turmaId,
          title: item.title,
          alunoId: item.alunoId || (chatViewMode === 'familia' ? activeAlunoId : undefined),
          colaboradorId: (chatViewMode === 'colaborador' && isColabOrAdmin) ? currentUser?.id : undefined,
          context: chatViewMode,
          ano_letivo: item.ano_letivo || '2026',
          isFamilyInitiated: chatViewMode === 'familia'
        })
      })

      if (res.ok) {
        const data = await res.json()
        const conv = data.conversation
        openConversationModal({
          id: conv.id,
          type: conv.type,
          title: item.title || conv.title || 'Chat',
          subtitle: item.subtitle || (conv.type === 'group' ? 'Canal Escolar' : 'online'),
          isGroup: conv.type === 'group',
          turma_id: conv.turma_id,
          grupo_id: conv.grupo_id,
          aluno_id: conv.aluno_id || item.alunoId || null,
          aluno_nome: item.alunoNome || null,
          aluno_turma: item.turmaNome || null,
          ano_letivo: conv.ano_letivo || item.ano_letivo || '2026',
          context: chatViewMode
        })
      } else {
        const errJson = await res.json().catch(() => ({}))
        if (errJson.error?.includes('colaborador') && errJson.error?.includes('desativad')) {
          const secWa = getSecretariaWhatsApp(adConfig?.contatosWhatsapp)

          setColabNoticeModal({
            isOpen: true,
            colaboradorNome: item.targetUserName,
            alunoNome: item.alunoNome,
            whatsappUrl: secWa?.url,
            whatsappLabel: secWa?.label
          })
        } else {
          toast.error(errJson.error || 'Erro ao abrir conversa')
        }
      }
    } catch (err: any) {
      toast.error('Erro ao abrir conversa: ' + (err?.message || 'Falha de comunicação'))
    } finally {
      setStartingChatId(null)
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

  // Filtragem por busca e por aluno vinculado
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
  const conversationsUnreadCount = activeConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)

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
  const filteredColabs = (contactsData.colaboradores || []).filter(c => 
    !q || c.nome.toLowerCase().includes(q) || (c.cargo || '').toLowerCase().includes(q)
  )

  return (
    <>
      <style>{`
        .wa-dock-container {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          right: max(24px, env(safe-area-inset-right, 24px));
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          pointer-events: none;
        }

        .wa-dock-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .wa-dock-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .wa-dock-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 999px;
        }

        @keyframes waPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 28px -4px rgba(37, 211, 102, 0.45); }
          50% { transform: scale(1.05); box-shadow: 0 14px 34px 2px rgba(37, 211, 102, 0.65); }
        }

        .wa-fab-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          overflow: visible;
        }

        .wa-fab-btn {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 28%, #34d399 0%, #10b981 40%, #059669 100%);
          border: 1.5px solid rgba(255, 255, 255, 0.55);
          box-shadow: 
            0 14px 28px -4px rgba(16, 185, 129, 0.42),
            0 0 20px rgba(16, 185, 129, 0.25),
            inset 0 3px 5px rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          outline: none;
          overflow: visible;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .wa-fab-btn:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 
            0 20px 36px -4px rgba(16, 185, 129, 0.55),
            0 0 28px rgba(16, 185, 129, 0.4);
        }

        .wa-fab-btn.has-unread {
          animation: waPulse 2.2s infinite ease-in-out;
        }

        .wa-fab-btn.is-open {
          transform: scale(0.92) !important;
          background: #0f172a;
          border-color: rgba(255,255,255,0.2);
        }

        .wa-fab-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          cursor: pointer;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .wa-fab-btn:hover ~ .wa-fab-badge,
        .wa-fab-badge:hover {
          transform: scale(1.08) translateY(-2px);
        }

        .wa-fab-btn.has-unread ~ .wa-fab-badge {
          animation: waBadgePulse 2.2s infinite ease-in-out;
        }

        @keyframes waBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @media (max-width: 768px) {
          .wa-dock-container {
            bottom: max(92px, calc(92px + env(safe-area-inset-bottom, 0px)));
            right: 16px;
          }
          .wa-fab-btn {
            width: 52px;
            height: 52px;
          }
          .wa-fab-badge {
            top: -2px;
            right: -2px;
          }
        }
      `}</style>

      <div ref={containerRef} className="wa-dock-container">
        {/* ──────────────────────────────────────────────────────────── */}
        {/* GAVETA / POPUP ESTILO WHATSAPP                                */}
        {/* ──────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {isDrawerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.94 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: 'min(380px, calc(100vw - 32px))',
                height: 'min(580px, 78vh)',
                marginBottom: 12,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 22,
                background: '#ffffff',
                boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}
            >
              {/* Top Bar Header Verde WhatsApp */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #008069 0%, #005c4b 100%)',
                  padding: isDualRole ? '12px 14px 10px 14px' : '14px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isDualRole ? 8 : 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <MessageSquare size={18} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>
                        Chat Institucional
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                        {chatViewMode === 'familia' ? 'Modo Família • Atendimento & Turma' : 'Modo Colaborador • Turmas & Alunos'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCloseDrawer}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Fechar"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Switcher de Visão para Colaborador com Acesso Familiar (Dual-Role) */}
                {isDualRole && (
                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(0, 0, 0, 0.22)',
                      borderRadius: 12,
                      padding: '3px',
                      gap: 4,
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleChangeViewMode('familia')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '6px 8px',
                        borderRadius: 9,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: chatViewMode === 'familia' ? '#ffffff' : 'transparent',
                        color: chatViewMode === 'familia' ? '#008069' : 'rgba(255, 255, 255, 0.95)',
                        boxShadow: chatViewMode === 'familia' ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <Users size={12} />
                      <span>Modo Família {dualRoleStudentFirstName ? `(${dualRoleStudentFirstName})` : ''}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangeViewMode('colaborador')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '6px 8px',
                        borderRadius: 9,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: chatViewMode === 'colaborador' ? '#ffffff' : 'transparent',
                        color: chatViewMode === 'colaborador' ? '#008069' : 'rgba(255, 255, 255, 0.95)',
                        boxShadow: chatViewMode === 'colaborador' ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <Building2 size={12} />
                      <span>Modo Colaborador</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Barra de Busca estilo WhatsApp */}
              <div style={{ padding: '10px 14px 6px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: '7px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Pesquisar conversa ou pessoa..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 12.5,
                      color: '#0f172a'
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Abas: Conversas & Novo Chat */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setActiveTab('conversas')
                      setShowArchivedView(false)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 12,
                      border: activeTab === 'conversas' ? '1.5px solid #008069' : '1.5px solid #e2e8f0',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeTab === 'conversas' ? '#008069' : '#f8fafc',
                      color: activeTab === 'conversas' ? '#ffffff' : '#64748b',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: activeTab === 'conversas' ? '0 2px 8px rgba(0, 128, 105, 0.25)' : 'none'
                    }}
                  >
                    Conversas
                    {conversationsUnreadCount > 0 && (
                      <span
                        style={{
                          background: activeTab === 'conversas' ? '#ffffff' : '#008069',
                          color: activeTab === 'conversas' ? '#008069' : '#ffffff',
                          borderRadius: 999,
                          fontSize: 10,
                          padding: '1px 6px',
                          fontWeight: 800
                        }}
                      >
                        {conversationsUnreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('contatos')
                      setShowArchivedView(false)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 12,
                      border: activeTab === 'contatos' 
                        ? '1.5px solid #059669' 
                        : '1.5px solid #34d399',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: activeTab === 'contatos'
                        ? 'linear-gradient(135deg, #059669 0%, #008069 100%)'
                        : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      color: activeTab === 'contatos' ? '#ffffff' : '#065f46',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: activeTab === 'contatos'
                        ? '0 4px 12px rgba(5, 150, 105, 0.35)'
                        : '0 2px 8px rgba(16, 185, 129, 0.2)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: activeTab === 'contatos' ? 'rgba(255, 255, 255, 0.25)' : '#059669',
                        color: '#ffffff'
                      }}
                    >
                      <Plus size={12} strokeWidth={3} />
                    </span>
                    <span>Novo Chat</span>
                  </button>
                </div>
              </div>

              {/* Lista Scrollável */}
              <div className="wa-dock-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
                {/* ──────────────────────────────────────────────────────────── */}
                {/* ABA 1: CONVERSAS ATIVAS                                      */}
                {/* ──────────────────────────────────────────────────────────── */}
                {activeTab === 'conversas' && (
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8, color: '#64748b' }}>
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
                            ? 'Nenhuma conversa para este aluno' 
                            : 'Nenhuma conversa iniciada'}
                        </div>
                        <div style={{ fontSize: 11.5, marginTop: 4, color: '#64748b' }}>
                          {showArchivedView
                            ? 'Você pode arquivar conversas clicando no ícone de arquivo nas conversas ativas.'
                            : selectedStudentFilter
                            ? 'Inicie uma conversa na aba "Novo Chat" ou veja todas as conversas.'
                            : 'Clique em "Novo Chat" para falar com a equipe ou professores.'}
                        </div>
                        {!showArchivedView && (
                          selectedStudentFilter ? (
                            <button
                              type="button"
                              onClick={() => setSelectedStudentFilter(null)}
                              style={{
                                marginTop: 14,
                                padding: '8px 16px',
                                background: '#008069',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Mostrar Todos os Filhos
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveTab('contatos')}
                              style={{
                                marginTop: 14,
                                padding: '8px 16px',
                                background: '#008069',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Iniciar Conversa
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      displayConversations.map(conv => {
                        return (
                          <div
                            key={conv.id}
                            onClick={() => {
                              // Zera imediatamente no estado local para feedback visual instantâneo
                              const convUnread = conv.unreadCount || 0
                              setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
                              if (convUnread > 0) {
                                useChatStore.getState().setUnreadTotal(Math.max(0, useChatStore.getState().unreadTotal - convUnread))
                              }
                              openConversationModal({
                                id: conv.id,
                                type: conv.type,
                                title: conv.title,
                                subtitle: conv.subtitle,
                                isGroup: conv.isGroup,
                                turma_id: conv.turma_id,
                                grupo_id: conv.grupo_id,
                                aluno_id: conv.aluno_id || (chatViewMode === 'familia' ? activeAlunoId : null),
                                aluno_nome: conv.aluno_nome,
                                aluno_turma: conv.aluno_turma,
                                ano_letivo: conv.ano_letivo || '2026',
                                unreadCount: convUnread,
                                hasLeft: isSchoolStaff && chatViewMode === 'colaborador' ? Boolean(conv.hasLeft) : false,
                                leftAt: isSchoolStaff && chatViewMode === 'colaborador' ? conv.leftAt : null,
                                isArchived: !!conv.isArchived,
                                context: chatViewMode,
                                lastMessageText: conv.lastMessageText,
                                lastMessageAt: conv.lastMessageAt,
                                lastMessageBy: conv.lastMessageBy
                              })
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 11,
                              padding: '10px 10px',
                              borderRadius: 14,
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#f8fafc'
                              prefetchConversationMessages(conv.id)
                            }}
                            onTouchStart={() => prefetchConversationMessages(conv.id)}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Avatar */}
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: conv.isGroup ? '#10b981' : '#008069',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 14,
                                flexShrink: 0
                              }}
                            >
                              {conv.isGroup ? (
                                conv.grupo_id ? <Building2 size={18} /> : <Users size={18} />
                              ) : (
                                getInitials(conv.title)
                              )}
                            </div>

                            {/* Conteúdo do Card */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                  {conv.hasLeft && isSchoolStaff && chatViewMode === 'colaborador' && (
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
                                <div style={{ fontSize: 11.5, color: conv.unreadCount > 0 ? '#0f172a' : '#64748b', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {conv.lastMessageText || 'Clique para abrir o chat'}
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
                )}

                {/* ──────────────────────────────────────────────────────────── */}
                {/* ABA 2: NOVO CHAT / CONTATOS PERMITIDOS                       */}
                {/* ──────────────────────────────────────────────────────────── */}
                {activeTab === 'contatos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
                    {loadingContacts ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8, color: '#64748b' }}>
                        <Loader2 size={18} className="animate-spin" />
                        <span style={{ fontSize: 12 }}>Carregando equipe e turmas...</span>
                      </div>
                    ) : (
                      <>
                        {(chatViewMode === 'familia' || (!isColaboradorView && contactsData.role === 'familia')) && contactsData.alunos && contactsData.alunos.length > 0 ? (
                          <>
                            {/* Alunos organizados e separados por cada filho vinculado ao responsável */}
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
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
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
                                        <img
                                          src={aluno.foto}
                                          alt={aluno.nome}
                                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0284c7' }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            background: '#0284c7',
                                            color: '#ffffff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 800,
                                            fontSize: 12
                                          }}
                                        >
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

                                    <span
                                      style={{
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                        color: '#0369a1',
                                        background: '#ffffff',
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        flexShrink: 0
                                      }}
                                    >
                                      Aluno
                                    </span>
                                  </div>

                                  {/* Itens do Aluno */}
                                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {/* Turmas do Aluno (Regular, Integral/Intermediário, etc.) */}
                                    {alunoTurmas.map((tg: any) => {
                                      const isStarting = startingChatId === `${aluno.id}_${tg.id}`
                                      return (
                                        <button
                                          key={tg.id}
                                          type="button"
                                          disabled={isStarting}
                                          onClick={() => handleStartChat({
                                            type: 'group',
                                            grupoId: tg.id,
                                            turmaId: tg.turma_id,
                                            title: tg.nome,
                                            subtitle: 'Grupo da Turma',
                                            ano_letivo: tg.ano_letivo || '2026'
                                          })}
                                          style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.15s'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                          onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                            <div style={{
                                              width: 32,
                                              height: 32,
                                              borderRadius: '50%',
                                              background: tg.cor || '#2563eb',
                                              color: '#ffffff',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0
                                            }}>
                                              <GraduationCap size={16} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {tg.nome}
                                                </span>
                                                {tg.ano_letivo && (
                                                  <span style={{
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: '#0369a1',
                                                    background: '#e0f2fe',
                                                    padding: '1px 5px',
                                                    borderRadius: 5,
                                                    border: '1px solid #bae6fd',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                  }}>
                                                    {tg.ano_letivo}
                                                  </span>
                                                )}
                                              </div>
                                              <div style={{ fontSize: 10.5, color: '#64748b' }}>
                                                Grupo da Turma • {aluno.nome.split(' ')[0]}
                                              </div>
                                            </div>
                                          </div>

                                          {isStarting ? (
                                            <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                          ) : (
                                            <ChevronRight size={16} color="#94a3b8" />
                                          )}
                                        </button>
                                      )
                                    })}

                                    {/* Professores e Educadores */}
                                    {matchingColabs.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 4px' }}>
                                          Professores & Educadores ({aluno.nome.split(' ')[0]})
                                        </div>
                                        {matchingColabs.map((colab: any) => (
                                          <button
                                            key={`${aluno.id}_${colab.id}`}
                                            disabled={startingChatId === `${aluno.id}_${colab.id}`}
                                            onClick={() => handleStartChat({
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
                                            style={{
                                              width: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '7px 10px',
                                              background: '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              borderRadius: 12,
                                              cursor: 'pointer',
                                              textAlign: 'left',
                                              transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#fdf4ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                                              {colab.foto ? (
                                                <img
                                                  src={colab.foto}
                                                  alt={colab.nome}
                                                  style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                />
                                              ) : (
                                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11.5, flexShrink: 0 }}>
                                                  {getInitials(colab.nome)}
                                                </div>
                                              )}
                                              <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {colab.nome}
                                                  </span>
                                                </div>
                                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {colab.cargo || colab.perfil || 'Educador(a)'}
                                                </div>
                                              </div>
                                            </div>

                                            {startingChatId === `${aluno.id}_${colab.id}` ? (
                                              <Loader2 size={15} className="animate-spin" color="#9333ea" />
                                            ) : (
                                              <ChevronRight size={15} color="#94a3b8" />
                                            )}
                                          </button>
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
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px 6px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>🏢 Equipe da Escola</span>
                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
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
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '8px 10px',
                                          background: '#ffffff',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: 14,
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          transition: 'all 0.15s',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
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
                                            width: 34,
                                            height: 34,
                                            borderRadius: '50%',
                                            background: meta.bg,
                                            color: meta.color,
                                            border: `1px solid ${meta.border}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <SectorIcon size={17} />
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
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#008069', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px 6px 4px' }}>
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
                                              onClick={() => handleStartChat({
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
                                                      onClick={() => handleStartChat({
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

                            {/* Seção 2: Turmas e Alunos (com expansão de chat da turma, alunos e responsáveis) */}
                            {filteredTurmas.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px 6px 4px' }}>
                                  👥 Turmas Oficiais
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {filteredTurmas.map(turma => {
                                    const isExpanded = expandedTurmaId === turma.id
                                    const studentData = turmaStudentsData[turma.id]
                                    const alunosList = studentData?.alunos || []
                                    const isLoadingStudents = !!studentData?.loading

                                    return (
                                      <div
                                        key={turma.id}
                                        style={{
                                          background: '#ffffff',
                                          border: isExpanded ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                          borderRadius: 14,
                                          overflow: 'hidden',
                                          boxShadow: isExpanded ? '0 4px 12px rgba(59,130,246,0.08)' : 'none',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        {/* Cabeçalho da Turma (clique para expandir) */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTurma(turma.id, turma.turma_id)}
                                          onMouseEnter={() => prefetchTurma(turma.id, turma.turma_id)}
                                          style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            background: isExpanded ? '#f0f7ff' : '#f8fafc',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s'
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                            <div style={{
                                              width: 36,
                                              height: 36,
                                              borderRadius: '50%',
                                              background: isExpanded ? '#dbeafe' : '#eff6ff',
                                              color: '#2563eb',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0
                                            }}>
                                              <Users size={18} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {turma.nome}
                                                </span>
                                                {turma.ano_letivo && (
                                                  <span style={{
                                                    fontSize: 9.5,
                                                    fontWeight: 700,
                                                    color: '#0369a1',
                                                    background: '#e0f2fe',
                                                    padding: '1px 5px',
                                                    borderRadius: 5,
                                                    border: '1px solid #bae6fd',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                  }}>
                                                    {turma.ano_letivo}
                                                  </span>
                                                )}
                                              </div>
                                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                                {turma.membrosCount ? `${turma.membrosCount} alunos` : 'Turma Oficial'}
                                              </div>
                                            </div>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                            {isLoadingStudents ? (
                                              <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                            ) : isExpanded ? (
                                              <ChevronDown size={18} color="#2563eb" />
                                            ) : (
                                              <ChevronRight size={18} color="#94a3b8" />
                                            )}
                                          </div>
                                        </button>

                                        {/* Conteúdo Expandido da Turma */}
                                        <AnimatePresence>
                                          {isExpanded && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ duration: 0.2 }}
                                              style={{
                                                padding: '10px 12px 12px 12px',
                                                background: '#ffffff',
                                                borderTop: '1px solid #e2e8f0',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 8
                                              }}
                                            >
                                              {/* Opção 1: Chat Oficial da Turma (Mural) */}
                                              <button
                                                type="button"
                                                disabled={startingChatId === turma.id}
                                                onClick={() => handleStartChat({
                                                  type: 'group',
                                                  grupoId: turma.id,
                                                  turmaId: turma.turma_id,
                                                  title: turma.nome,
                                                  subtitle: 'Grupo da Turma',
                                                  ano_letivo: turma.ano_letivo || '2026'
                                                })}
                                                style={{
                                                  width: '100%',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  padding: '9px 12px',
                                                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                                  border: '1.5px solid #bfdbfe',
                                                  borderRadius: 12,
                                                  cursor: 'pointer',
                                                  textAlign: 'left',
                                                  transition: 'transform 0.1s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                  <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    background: '#2563eb',
                                                    color: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                  }}>
                                                    <MessageSquare size={16} />
                                                  </div>
                                                  <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                      <span>Chat da Turma</span>
                                                      <span style={{ fontSize: 9.5, fontWeight: 800, background: '#2563eb', color: 'white', padding: '1px 6px', borderRadius: 999 }}>
                                                        Mural Oficial
                                                      </span>
                                                    </div>
                                                    <div style={{ fontSize: 10.5, color: '#3b82f6', marginTop: 1 }}>
                                                      Somente educadores enviam • Todos visualizam
                                                    </div>
                                                  </div>
                                                </div>

                                                {startingChatId === turma.id ? (
                                                  <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                                ) : (
                                                  <ChevronRight size={16} color="#2563eb" />
                                                )}
                                              </button>

                                              {/* Opção 2: Lista de Alunos e seus Responsáveis */}
                                              <div style={{ marginTop: 4 }}>
                                                <div style={{
                                                  fontSize: 10.5,
                                                  fontWeight: 800,
                                                  color: '#64748b',
                                                  textTransform: 'uppercase',
                                                  letterSpacing: '0.04em',
                                                  marginBottom: 6,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between'
                                                }}>
                                                  <span>Alunos da Turma ({alunosList.length})</span>
                                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>
                                                    Clique no aluno para conversar
                                                  </span>
                                                </div>

                                                {isLoadingStudents ? (
                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0', color: '#64748b', fontSize: 12 }}>
                                                    <Loader2 size={16} className="animate-spin" color="#2563eb" />
                                                    <span>Carregando alunos e responsáveis...</span>
                                                  </div>
                                                ) : alunosList.length === 0 ? (
                                                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, background: '#f8fafc', borderRadius: 10 }}>
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
                                                              padding: '8px 10px',
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
                                                              {isAlunoExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                            </div>
                                                        </button>

                                                        {/* Opções Expandidas: Conversar com o Aluno ou Responsáveis */}
                                                        {isAlunoExpanded && (
                                                          <div style={{ padding: '6px 10px 10px 10px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {/* Botão Conversar com o Aluno */}
                                                            <button
                                                              type="button"
                                                              disabled={startingChatId === aluno.id}
                                                              onClick={() => handleStartChat({
                                                                type: 'direct',
                                                                targetUserId: aluno.id,
                                                                targetUserName: aluno.nome,
                                                                targetUserPerfil: 'Aluno',
                                                                title: aluno.nome,
                                                                subtitle: `Aluno • ${turma.nome}`,
                                                                alunoId: aluno.id,
                                                                alunoNome: aluno.nome,
                                                                turmaNome: turma.nome
                                                              })}
                                                              style={{
                                                                width: '100%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '7px 10px',
                                                                background: '#f0fdf4',
                                                                border: '1px solid #bbf7d0',
                                                                borderRadius: 8,
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
                                                                    Chat individual com o aluno
                                                                  </div>
                                                                </div>
                                                              </div>
                                                              {startingChatId === aluno.id ? (
                                                                <Loader2 size={14} className="animate-spin" color="#16a34a" />
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
                                                                  const respChatKey = `${aluno.id}_${resp.id}`
                                                                  return (
                                                                    <button
                                                                      key={resp.id}
                                                                      type="button"
                                                                      disabled={startingChatId === respChatKey}
                                                                      onClick={() => handleStartChat({
                                                                        type: 'direct',
                                                                        targetUserId: resp.id,
                                                                        targetUserName: resp.nome,
                                                                        targetUserPerfil: resp.parentesco || 'Responsável',
                                                                        title: `${resp.nome} (${resp.parentesco})`,
                                                                        subtitle: `${resp.parentesco} de ${aluno.nome}`,
                                                                        alunoId: aluno.id,
                                                                        alunoNome: aluno.nome,
                                                                        turmaNome: turma.nome
                                                                      })}
                                                                      style={{
                                                                        width: '100%',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between',
                                                                        padding: '7px 10px',
                                                                        background: '#faf5ff',
                                                                        border: '1px solid #e9d5ff',
                                                                        borderRadius: 8,
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left'
                                                                      }}
                                                                    >
                                                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#9333ea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                          <User size={13} />
                                                                        </div>
                                                                        <div style={{ minWidth: 0 }}>
                                                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6b21a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                              {resp.nome}
                                                                            </span>
                                                                            <span style={{ fontSize: 9, fontWeight: 800, background: '#f3e8ff', color: '#7e22ce', padding: '1px 5px', borderRadius: 999, border: '1px solid #d8b4fe' }}>
                                                                              {resp.parentesco}
                                                                            </span>
                                                                          </div>
                                                                          <div style={{ fontSize: 10, color: '#7e22ce' }}>
                                                                            Chat individual com o responsável
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                      {startingChatId === respChatKey ? (
                                                                        <Loader2 size={14} className="animate-spin" color="#9333ea" />
                                                                      ) : (
                                                                        <ChevronRight size={14} color="#9333ea" />
                                                                      )}
                                                                    </button>
                                                                  )
                                                                })}
                                                              </div>
                                                            ) : (
                                                              <div style={{ fontSize: 10.5, color: '#94a3b8', fontStyle: 'italic', padding: '2px 4px' }}>
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
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Seção: Equipe da Escola (Canais de Atendimento) */}
                          {filteredWhatsappChannels.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px 6px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>🏢 Equipe da Escola</span>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
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
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 14,
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.15s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
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
                                          width: 34,
                                          height: 34,
                                          borderRadius: '50%',
                                          background: meta.bg,
                                          color: meta.color,
                                          border: `1px solid ${meta.border}`,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}>
                                          <SectorIcon size={17} />
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
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px 6px 4px' }}>
                                👤 Educadores e Colaboradores
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {filteredColabs.map(colab => (
                                  <button
                                    key={colab.id}
                                    type="button"
                                    disabled={startingChatId === colab.id}
                                    onClick={() => handleStartChat({
                                      type: 'direct',
                                      targetUserId: colab.id,
                                      targetUserName: colab.nome,
                                      targetUserPerfil: colab.cargo || colab.perfil,
                                      title: colab.nome,
                                      subtitle: colab.cargo || colab.perfil
                                    })}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 10px',
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: 14,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fdf4ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      {colab.foto ? (
                                        <img
                                          src={colab.foto}
                                          alt={colab.nome}
                                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                        />
                                      ) : (
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: colab.isTurmaColab ? '#ecfdf5' : '#faf5ff', color: colab.isTurmaColab ? '#059669' : '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>
                                          {getInitials(colab.nome)}
                                        </div>
                                      )}
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {colab.nome}
                                          </span>
                                          {colab.isTurmaColab && (
                                            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 999, border: '1px solid #a7f3d0' }}>
                                              Sua Turma
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                                          {colab.cargo || 'Colaborador'}
                                        </div>
                                      </div>
                                    </div>

                                    {startingChatId === colab.id ? (
                                      <Loader2 size={16} className="animate-spin" color="#9333ea" />
                                    ) : (
                                      <ChevronRight size={16} color="#94a3b8" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                        {filteredWhatsappChannels.length === 0 && filteredTurmas.length === 0 && filteredColabs.length === 0 && searchedStudents.length === 0 && !isSearchingStudents && (
                          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                              Nenhum contato encontrado
                            </div>
                            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                              {searchQuery ? 'Nenhum resultado para a busca.' : 'Os canais e educadores da turma aparecerão aqui.'}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* BOTÃO FLUTUANTE (FAB) DO CHAT COM BADGE E PULSO              */}
        {/* ──────────────────────────────────────────────────────────── */}
        <div className="wa-fab-wrapper">
          <button
            type="button"
            onClick={handleToggleDrawer}
            className={`wa-fab-btn ${unreadTotal > 0 && !isDrawerOpen && !isModalOpen ? 'has-unread' : ''} ${isDrawerOpen ? 'is-open' : ''}`}
            aria-label="Abrir Chat"
            title="Chat da Escola"
          >
            {isDrawerOpen ? (
              <X size={24} color="#ffffff" strokeWidth={2.5} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Ícone de Balão de Chat estilo WhatsApp */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
            )}
          </button>

          {/* Badge de Mensagens Não Lidas - Sobreposto ao botão flutuante com z-index alto sem cortes */}
          {!isDrawerOpen && !isModalOpen && unreadTotal > 0 && (
            <div className="wa-fab-badge" onClick={handleToggleDrawer}>
              <ChatBadge
                count={unreadTotal}
                style={{
                  background: '#ef4444',
                  border: '2px solid #ffffff',
                  boxShadow: '0 3px 8px rgba(239, 68, 68, 0.55), 0 1px 3px rgba(0, 0, 0, 0.2)',
                  fontSize: 11,
                  fontWeight: 800,
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal da Conversa Ativa */}
      <ChatConversationModal />

      {/* Modal Centrado de Aviso: Conversas com Colaboradores Desativadas */}
      <ColabChatNoticeModal
        isOpen={colabNoticeModal.isOpen}
        onClose={() => setColabNoticeModal(prev => ({ ...prev, isOpen: false }))}
        colaboradorNome={colabNoticeModal.colaboradorNome}
        alunoNome={colabNoticeModal.alunoNome}
        whatsappUrl={colabNoticeModal.whatsappUrl}
        whatsappLabel={colabNoticeModal.whatsappLabel}
        onOpenTurmaGroup={colabNoticeModal.onOpenTurmaGroup}
      />
    </>
  )
}
