'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare,
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Printer,
  Eye,
  RefreshCw,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCheck,
  Paperclip,
  Download,
  ShieldAlert,
  Sparkles,
  MessageCircle,
  AlertTriangle,
  History,
  FileSpreadsheet,
  GraduationCap,
  Building2,
  UserCheck,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatFullView } from './ChatFullView'
import { ChatMediaViewerModal, ChatMediaItem } from './ChatMediaViewerModal'
import { useApp } from '@/lib/context'

interface ParticipantMeta {
  user_id: string
  user_name: string
  user_perfil: string
  user_role?: string
  last_read_at?: string | null
  unread_count?: number
  is_archived?: boolean
}

interface AuditedConversation {
  id: string
  type: string
  title?: string
  created_at: string
  last_message_at: string
  last_message_text: string
  last_message_by?: string
  message_count: number
  turma_id?: string
  turma_nome?: string
  aluno_id?: string
  aluno_nome?: string
  participants: ParticipantMeta[]
  educator?: {
    user_id: string
    user_name: string
    user_perfil: string
  } | null
  target?: {
    user_id: string
    user_name: string
    user_perfil: string
  } | null
}

interface AuditRecord {
  previous_content: string
  edited_content: string
  edited_at: string
  edited_by: string
  reason?: string
}

interface AuditedMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  sender_perfil: string
  content: string
  content_type: 'text' | 'image' | 'video' | 'file' | 'audio'
  attachment_url?: string
  attachment_name?: string
  attachment_size?: number
  attachment_type?: string
  is_edited: boolean
  edited_at?: string
  edited_by?: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
  created_at: string
  status?: string
  metadata?: {
    is_admin_intervention?: boolean
    is_edited_by_admin?: boolean
    audit_history?: AuditRecord[]
    [key: string]: any
  }
}

interface StatsSummary {
  totalConversations: number
  totalMessages: number
  messagesToday: number
  totalMedia: number
  totalEdited: number
}

interface TurmaOption {
  id: string | number
  nome: string
  ano?: string
}

export function AdminChatAuditView() {
  const { currentUser } = useApp()
  const [activeTab, setActiveTab] = useState<'moderation' | 'direct'>('moderation')

  // Stats & Main State
  const [stats, setStats] = useState<StatsSummary>({
    totalConversations: 0,
    totalMessages: 0,
    messagesToday: 0,
    totalMedia: 0,
    totalEdited: 0
  })
  const [conversations, setConversations] = useState<AuditedConversation[]>([])
  const [turmas, setTurmas] = useState<TurmaOption[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')

  // Conversation Detail & Transcript
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState<AuditedConversation | null>(null)
  const [messages, setMessages] = useState<AuditedMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Admin Intervention
  const [interventionText, setInterventionText] = useState('')
  const [isSendingIntervention, setIsSendingIntervention] = useState(false)

  // Edit Message Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [messageToEdit, setMessageToEdit] = useState<AuditedMessage | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editReason, setEditReason] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Audit History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyMessage, setHistoryMessage] = useState<AuditedMessage | null>(null)

  // Delete Message Modal
  const [deleteMsgModalOpen, setDeleteMsgModalOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<AuditedMessage | null>(null)
  const [deleteMsgHard, setDeleteMsgHard] = useState(false)
  const [isDeletingMsg, setIsDeletingMsg] = useState(false)

  // Delete Conversation Modal
  const [deleteConvModalOpen, setDeleteConvModalOpen] = useState(false)
  const [convToDelete, setConvToDelete] = useState<AuditedConversation | null>(null)
  const [isDeletingConv, setIsDeletingConv] = useState(false)

  // Ata de Atendimento (Printable Official Transcript Modal)
  const [ataModalOpen, setAtaModalOpen] = useState(false)

  // Media Viewer Lightbox
  const [viewerItem, setViewerItem] = useState<ChatMediaItem | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Fetch Conversations List
  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true)
    else setIsLoadingList(true)

    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (selectedTurma) params.set('turmaId', selectedTurma)

      // Calculate dates from preset
      const today = new Date()
      let startStr = ''
      let endStr = ''

      if (datePreset === 'today') {
        startStr = today.toISOString().split('T')[0]
        endStr = today.toISOString().split('T')[0]
      } else if (datePreset === '7d') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        startStr = d.toISOString().split('T')[0]
        endStr = today.toISOString().split('T')[0]
      } else if (datePreset === '30d') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        startStr = d.toISOString().split('T')[0]
        endStr = today.toISOString().split('T')[0]
      } else if (datePreset === 'custom') {
        if (startDate) startStr = startDate
        if (endDate) endStr = endDate
      }

      if (startStr) params.set('startDate', startStr)
      if (endStr) params.set('endDate', endStr)

      const res = await fetch(`/api/chat/admin/conversations?${params.toString()}`, {
        cache: 'no-store'
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Falha ao buscar conversas')
      }

      const data = await res.json()
      setConversations(data.conversations || [])
      setStats(data.stats || {
        totalConversations: 0,
        totalMessages: 0,
        messagesToday: 0,
        totalMedia: 0,
        totalEdited: 0
      })
      if (data.turmas && data.turmas.length > 0) {
        setTurmas(data.turmas)
      }

      // If currently selected conversation is no longer in list, deselect
      if (selectedConvId && !data.conversations.some((c: any) => c.id === selectedConvId)) {
        // keep selected unless list empty
        if (data.conversations.length === 0) {
          setSelectedConvId(null)
          setSelectedConv(null)
          setMessages([])
        }
      }
    } catch (err: any) {
      console.error('[AdminChatAuditView] Erro ao carregar:', err)
      toast.error(err.message || 'Erro ao carregar dados de moderação.')
    } finally {
      setIsLoadingList(false)
      setIsRefreshing(false)
    }
  }, [searchQuery, selectedTurma, datePreset, startDate, endDate, selectedConvId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // 2. Fetch Conversation Messages when selected
  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/admin/messages?conversation_id=${encodeURIComponent(convId)}`, {
        cache: 'no-store'
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Falha ao carregar mensagens')
      }

      const data = await res.json()
      setMessages(data.messages || [])
    } catch (err: any) {
      console.error('[AdminChatAuditView] Erro ao carregar mensagens:', err)
      toast.error(err.message || 'Erro ao buscar mensagens da conversa.')
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const handleSelectConversation = (conv: AuditedConversation) => {
    setSelectedConvId(conv.id)
    setSelectedConv(conv)
    fetchMessages(conv.id)
  }

  // 3. Admin Intervention Message
  const handleSendIntervention = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedConvId || !interventionText.trim()) return

    setIsSendingIntervention(true)
    try {
      const res = await fetch('/api/chat/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConvId,
          content: interventionText.trim()
        })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao registrar intervenção')
      }

      toast.success('Intervenção administrativa registrada com sucesso.')
      setInterventionText('')
      // Refresh messages
      await fetchMessages(selectedConvId)
      // Refresh list snippet
      fetchConversations(true)
    } catch (err: any) {
      console.error('[AdminChatAuditView] Intervenção:', err)
      toast.error(err.message || 'Falha ao enviar intervenção.')
    } finally {
      setIsSendingIntervention(false)
    }
  }

  // 4. Save Edited Message
  const handleSaveEdit = async () => {
    if (!messageToEdit || !editContent.trim()) return

    setIsSavingEdit(true)
    try {
      const res = await fetch('/api/chat/admin/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageToEdit.id,
          new_content: editContent.trim(),
          reason: editReason.trim() || 'Moderação da Direção Escolar'
        })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao editar mensagem')
      }

      toast.success('Mensagem editada e registro de auditoria gravado com sucesso!')
      setEditModalOpen(false)
      setMessageToEdit(null)
      setEditContent('')
      setEditReason('')

      if (selectedConvId) {
        await fetchMessages(selectedConvId)
      }
      fetchConversations(true)
    } catch (err: any) {
      console.error('[AdminChatAuditView] Editar mensagem:', err)
      toast.error(err.message || 'Falha ao salvar edição.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // 5. Delete Message
  const handleDeleteMessage = async () => {
    if (!messageToDelete) return

    setIsDeletingMsg(true)
    try {
      const params = new URLSearchParams({
        message_id: messageToDelete.id,
        hard_delete: deleteMsgHard ? 'true' : 'false'
      })

      const res = await fetch(`/api/chat/admin/messages?${params.toString()}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao excluir mensagem')
      }

      toast.success(deleteMsgHard ? 'Mensagem excluída permanentemente.' : 'Mensagem ocultada pela moderação.')
      setDeleteMsgModalOpen(false)
      setMessageToDelete(null)

      if (selectedConvId) {
        await fetchMessages(selectedConvId)
      }
      fetchConversations(true)
    } catch (err: any) {
      console.error('[AdminChatAuditView] Excluir mensagem:', err)
      toast.error(err.message || 'Falha ao excluir mensagem.')
    } finally {
      setIsDeletingMsg(false)
    }
  }

  // 6. Delete Conversation
  const handleDeleteConversation = async () => {
    if (!convToDelete) return

    setIsDeletingConv(true)
    try {
      const res = await fetch(`/api/chat/admin/conversations?conversation_id=${encodeURIComponent(convToDelete.id)}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao excluir conversa')
      }

      toast.success('Conversa e histórico excluídos com sucesso.')
      setDeleteConvModalOpen(false)
      if (selectedConvId === convToDelete.id) {
        setSelectedConvId(null)
        setSelectedConv(null)
        setMessages([])
      }
      setConvToDelete(null)
      fetchConversations(true)
    } catch (err: any) {
      console.error('[AdminChatAuditView] Excluir conversa:', err)
      toast.error(err.message || 'Falha ao excluir conversa.')
    } finally {
      setIsDeletingConv(false)
    }
  }

  // Helpers
  const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return ''
    }
  }

  const formatDateHeader = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const today = new Date()
      if (date.toDateString() === today.toDateString()) return 'Hoje'
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; msgs: AuditedMessage[] }[] = []
  messages.forEach(msg => {
    const dStr = msg.created_at ? msg.created_at.split('T')[0] : 'unknown'
    const existing = groupedMessages.find(g => g.date === dStr)
    if (existing) {
      existing.msgs.push(msg)
    } else {
      groupedMessages.push({ date: dStr, msgs: [msg] })
    }
  })

  return (
    <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '16px 20px', fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)' }}>
      {/* ── TOP HEADER & MODE SWITCHER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}>
              <ShieldCheck size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Central de Moderação & Controle do Chat
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, maxWidth: 650 }}>
            Supervisão integral, histórico com valor legal, auditoria e moderação de todas as conversas escolares da instituição.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="admin-chat-mode-switcher" style={{ display: 'inline-flex', padding: 4, background: '#f1f5f9', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <button
            className="admin-chat-mode-btn"
            onClick={() => setActiveTab('moderation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s ease',
              background: activeTab === 'moderation' ? '#ffffff' : 'transparent',
              color: activeTab === 'moderation' ? '#1e40af' : '#64748b',
              boxShadow: activeTab === 'moderation' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <ShieldCheck size={16} color={activeTab === 'moderation' ? '#2563eb' : '#64748b'} />
            Auditoria Geral
          </button>
          <button
            className="admin-chat-mode-btn"
            onClick={() => setActiveTab('direct')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s ease',
              background: activeTab === 'direct' ? '#ffffff' : 'transparent',
              color: activeTab === 'direct' ? '#1e40af' : '#64748b',
              boxShadow: activeTab === 'direct' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <MessageCircle size={16} color={activeTab === 'direct' ? '#2563eb' : '#64748b'} />
            Meu Atendimento
          </button>
        </div>
      </div>

      {/* ── TAB: MEU ATENDIMENTO DIRETO ── */}
      {activeTab === 'direct' && (
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <ChatFullView />
        </div>
      )}

      {/* ── TAB: AUDITORIA & MODERAÇÃO GERAL ── */}
      {activeTab === 'moderation' && (
        <>
          {/* 1. METRICS ROW */}
          <div className="admin-chat-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* Total Conversas */}
            <div className="admin-chat-kpi-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div className="admin-chat-kpi-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} />
              </div>
              <div>
                <span className="admin-chat-kpi-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Conversas Ativas</span>
                <div className="admin-chat-kpi-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{stats.totalConversations}</div>
              </div>
            </div>

            {/* Total Mensagens */}
            <div className="admin-chat-kpi-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div className="admin-chat-kpi-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={22} />
              </div>
              <div>
                <span className="admin-chat-kpi-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Total de Mensagens</span>
                <div className="admin-chat-kpi-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{stats.totalMessages}</div>
              </div>
            </div>

            {/* Mensagens Hoje */}
            <div className="admin-chat-kpi-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div className="admin-chat-kpi-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <span className="admin-chat-kpi-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Mensagens Hoje</span>
                <div className="admin-chat-kpi-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{stats.messagesToday}</div>
              </div>
            </div>

            {/* Mídias & Arquivos */}
            <div className="admin-chat-kpi-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div className="admin-chat-kpi-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paperclip size={22} />
              </div>
              <div>
                <span className="admin-chat-kpi-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Mídias & Anexos</span>
                <div className="admin-chat-kpi-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{stats.totalMedia}</div>
              </div>
            </div>

            {/* Mensagens Editadas / Auditadas */}
            <div className="admin-chat-kpi-card admin-chat-kpi-card-span" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div className="admin-chat-kpi-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <History size={22} />
              </div>
              <div>
                <span className="admin-chat-kpi-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Mensagens Editadas</span>
                <div className="admin-chat-kpi-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{stats.totalEdited}</div>
              </div>
            </div>
          </div>

          {/* 2. ADVANCED FILTERS TOOLBAR */}
          <div className="admin-chat-filters" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              {/* Text Search */}
              <div className="admin-chat-search-box" style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Buscar participante, aluno, turma ou mensagem..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 38,
                    paddingRight: 12,
                    fontSize: 13,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
              </div>

              {/* Turma Filter */}
              <div className="admin-chat-turma-box" style={{ position: 'relative', width: 180 }}>
                <GraduationCap size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8', pointerEvents: 'none' }} />
                <select
                  value={selectedTurma}
                  onChange={e => setSelectedTurma(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 28,
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none'
                  }}
                >
                  <option value="">Todas as Turmas</option>
                  {turmas.map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nome} {t.ano ? `(${t.ano})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: 13, color: '#94a3b8', pointerEvents: 'none' }} />
              </div>

              {/* Date Presets */}
              <div className="admin-chat-presets-box" style={{ display: 'inline-flex', padding: 3, background: '#f1f5f9', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setDatePreset('all')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: datePreset === 'all' ? '#ffffff' : 'transparent',
                    color: datePreset === 'all' ? '#1e40af' : '#64748b',
                    boxShadow: datePreset === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('today')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: datePreset === 'today' ? '#ffffff' : 'transparent',
                    color: datePreset === 'today' ? '#1e40af' : '#64748b',
                    boxShadow: datePreset === 'today' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('7d')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: datePreset === '7d' ? '#ffffff' : 'transparent',
                    color: datePreset === '7d' ? '#1e40af' : '#64748b',
                    boxShadow: datePreset === '7d' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('30d')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: datePreset === '30d' ? '#ffffff' : 'transparent',
                    color: datePreset === '30d' ? '#1e40af' : '#64748b',
                    boxShadow: datePreset === '30d' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  30 Dias
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('custom')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: datePreset === 'custom' ? '#ffffff' : 'transparent',
                    color: datePreset === 'custom' ? '#1e40af' : '#64748b',
                    boxShadow: datePreset === 'custom' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Personalizado
                </button>
              </div>

              {/* Custom Date Range Pickers (if preset is custom) */}
              {datePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      height: 38,
                      padding: '0 8px',
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a'
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      height: 38,
                      padding: '0 8px',
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a'
                    }}
                  />
                </div>
              )}

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => fetchConversations(true)}
                disabled={isRefreshing}
                title="Atualizar conversas e estatísticas"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: isRefreshing ? '#2563eb' : '#475569',
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  marginLeft: 'auto'
                }}
              >
                <RefreshCw size={17} className={isRefreshing ? 'spin-animation' : ''} />
              </button>
            </div>
          </div>

          {/* 3. MASTER-DETAIL SPLIT PANE */}
          <div className="admin-chat-split-pane" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
            {/* ── LEFT PANE: CONVERSATIONS LIST ── */}
            <div className={`admin-chat-left-pane ${selectedConv ? 'has-selection-mobile-hide' : ''}`} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', overflow: 'hidden', height: 750, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Conversas Diretas ({conversations.length})
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Clique para inspecionar
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {isLoadingList && conversations.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 10 }}>
                    <RefreshCw size={24} className="spin-animation" color="#3b82f6" />
                    <span style={{ fontSize: 13 }}>Carregando conversas do colégio...</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                    <MessageSquare size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Nenhuma conversa encontrada</span>
                    <span style={{ fontSize: 12, marginTop: 4 }}>Altere os filtros de data ou busca para localizar conversas.</span>
                  </div>
                ) : (
                  conversations.map(conv => {
                    const isSelected = selectedConvId === conv.id
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          marginBottom: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                          boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.08)' : 'none',
                          position: 'relative'
                        }}
                      >
                        {/* Top: Participants info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Educator line */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {conv.educator?.user_name || 'Educador(a)'}
                              </span>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                                {conv.educator?.user_perfil || 'Colaborador'}
                              </span>
                            </div>

                            {/* Target line */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {conv.target?.user_name || 'Família/Responsável'}
                              </span>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                                {conv.target?.user_perfil || 'Responsável'}
                              </span>
                            </div>
                          </div>

                          {/* Time & message count */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              {formatTime(conv.last_message_at)}
                            </div>
                            <span style={{ display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 700, marginTop: 4 }}>
                              {conv.message_count} msg{conv.message_count === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {/* Middle: Linked Student and Turma */}
                        {(conv.aluno_nome || conv.turma_nome) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                            {conv.aluno_nome && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <GraduationCap size={12} />
                                Aluno: {conv.aluno_nome}
                              </span>
                            )}
                            {conv.turma_nome && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                                {conv.turma_nome}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Bottom: Last message preview */}
                        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: conv.last_message_text ? 'normal' : 'italic' }}>
                          {conv.last_message_text || 'Nenhuma mensagem recente'}
                        </div>

                        {/* Quick Action: Delete button on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConvToDelete(conv)
                            setDeleteConvModalOpen(true)
                          }}
                          title="Excluir conversa inteira"
                          style={{
                            position: 'absolute',
                            right: 8,
                            bottom: 8,
                            padding: 6,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            opacity: isSelected ? 1 : 0.4
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#ef4444'
                            e.currentTarget.style.background = '#fee2e2'
                            e.currentTarget.style.opacity = '1'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = '#94a3b8'
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.opacity = isSelected ? '1' : '0.4'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT PANE: AUDITED TIMELINE & CONTROL ── */}
            <div className={`admin-chat-right-pane ${!selectedConv ? 'no-selection-mobile-hide' : ''}`} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', height: 750, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!selectedConv ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: '#3b82f6' }}>
                    <ShieldCheck size={32} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#334155', margin: '0 0 6px 0' }}>
                    Auditoria & Moderação em Tempo Real
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
                    Selecione qualquer conversa direta na lista ao lado para inspecionar mensagens, emitir atas oficiais de atendimento, editar ou ocultar conteúdos inadequados.
                  </p>
                </div>
              ) : (
                <>
                  {/* Top Bar of Selected Conversation */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      {/* Mobile Back Button */}
                      <button
                        type="button"
                        onClick={() => { setSelectedConv(null); setSelectedConvId(null); }}
                        className="admin-chat-mobile-back-btn"
                        style={{
                          display: 'none',
                          alignItems: 'center',
                          gap: 6,
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1e40af',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginBottom: 8,
                          width: 'fit-content'
                        }}
                      >
                        <ChevronLeft size={16} /> Voltar à lista de conversas
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                          {selectedConv.educator?.user_name || 'Educador'} ↔ {selectedConv.target?.user_name || 'Família'}
                        </span>
                        {selectedConv.aluno_nome && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                            Aluno: {selectedConv.aluno_nome}
                          </span>
                        )}
                        {selectedConv.turma_nome && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                            {selectedConv.turma_nome}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Início: {formatDateTime(selectedConv.created_at)} • Total: {messages.length} mensagens
                      </div>
                    </div>

                    {/* Top Action Buttons: Imprimir Ata Oficial + Excluir Conversa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setAtaModalOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#1e40af',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Printer size={15} />
                        Gerar Ata Oficial
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConvToDelete(selectedConv)
                          setDeleteConvModalOpen(true)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid #fee2e2',
                          background: '#fff1f2',
                          color: '#be123c',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Trash2 size={15} />
                        Excluir Conversa
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f8fafc' }}>
                    {isLoadingMessages ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 10 }}>
                        <RefreshCw size={24} className="spin-animation" color="#3b82f6" />
                        <span style={{ fontSize: 13 }}>Carregando registros da conversa...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <MessageSquare size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
                        <span style={{ fontSize: 13 }}>Nenhuma mensagem nesta conversa.</span>
                      </div>
                    ) : (
                      groupedMessages.map(group => (
                        <div key={group.date} style={{ marginBottom: 20 }}>
                          {/* Date separator */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#e2e8f0', padding: '3px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {formatDateHeader(group.date)}
                            </span>
                          </div>

                          {/* Message bubbles */}
                          {group.msgs.map(msg => {
                            const isAdminNote = Boolean(msg.metadata?.is_admin_intervention)
                            const isDeleted = Boolean(msg.is_deleted)
                            const isEdited = Boolean(msg.is_edited)
                            const historyCount = Array.isArray(msg.metadata?.audit_history) ? msg.metadata.audit_history.length : 0

                            return (
                              <div
                                key={msg.id}
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: 14,
                                  marginBottom: 10,
                                  background: isAdminNote
                                    ? '#fdf4ff'
                                    : isDeleted
                                    ? '#f1f5f9'
                                    : '#ffffff',
                                  border: isAdminNote
                                    ? '1px solid #f0abfc'
                                    : isDeleted
                                    ? '1px dashed #cbd5e1'
                                    : '1px solid #e2e8f0',
                                  boxShadow: isDeleted ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
                                  position: 'relative'
                                }}
                              >
                                {/* Header: Sender + Time + Badges + Action Buttons */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: isAdminNote ? '#86198f' : '#0f172a' }}>
                                      {msg.sender_name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        background: isAdminNote
                                          ? '#fae8ff'
                                          : msg.sender_perfil?.toLowerCase().includes('respons')
                                          ? '#dcfce7'
                                          : '#e0e7ff',
                                        color: isAdminNote
                                          ? '#701a75'
                                          : msg.sender_perfil?.toLowerCase().includes('respons')
                                          ? '#166534'
                                          : '#3730a3'
                                      }}
                                    >
                                      {isAdminNote ? '🛡️ Intervenção da Direção' : msg.sender_perfil || 'Usuário'}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                      {formatDateTime(msg.created_at)}
                                    </span>
                                  </div>

                                  {/* Action Buttons for this Message */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {/* Edit Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMessageToEdit(msg)
                                        setEditContent(msg.content)
                                        setEditReason('')
                                        setEditModalOpen(true)
                                      }}
                                      title="Editar conteúdo da mensagem"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        border: '1px solid #cbd5e1',
                                        background: '#ffffff',
                                        color: '#334155',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Edit3 size={12} />
                                      Editar
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMessageToDelete(msg)
                                        setDeleteMsgHard(false)
                                        setDeleteMsgModalOpen(true)
                                      }}
                                      title="Ocultar ou excluir mensagem"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        border: '1px solid #fee2e2',
                                        background: '#ffffff',
                                        color: '#dc2626',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={12} />
                                      {isDeleted ? 'Excluir Definitivo' : 'Ocultar / Excluir'}
                                    </button>
                                  </div>
                                </div>

                                {/* Content Body */}
                                {isDeleted ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 12 }}>
                                    <AlertTriangle size={16} />
                                    <span>
                                      Mensagem ocultada pela moderação ({msg.deleted_by || 'Direção'} em {formatDateTime(msg.deleted_at)}).
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Text Content */}
                                    <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                      {msg.content}
                                    </div>

                                    {/* Media preview if image */}
                                    {msg.content_type === 'image' && msg.attachment_url && (
                                      <div style={{ marginTop: 8 }}>
                                        <img
                                          src={msg.attachment_url}
                                          alt="Anexo"
                                          onClick={() => setViewerItem({ url: msg.attachment_url!, type: 'image', fileName: msg.attachment_name || 'Imagem' })}
                                          style={{ maxHeight: 200, maxWidth: 300, borderRadius: 8, cursor: 'pointer', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                                        />
                                      </div>
                                    )}

                                    {/* Media preview if audio */}
                                    {msg.content_type === 'audio' && msg.attachment_url && (
                                      <div style={{ marginTop: 8 }}>
                                        <audio controls src={msg.attachment_url} style={{ height: 36, maxWidth: 280 }} />
                                      </div>
                                    )}

                                    {/* File attachment download card */}
                                    {msg.content_type === 'file' && msg.attachment_url && (
                                      <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                                        <FileText size={18} color="#2563eb" />
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                                          {msg.attachment_name || 'Documento'}
                                        </span>
                                        <a
                                          href={msg.attachment_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          download
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}
                                        >
                                          <Download size={13} />
                                          Baixar
                                        </a>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Audit Indicators & History */}
                                {isEdited && (
                                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#b45309' }}>
                                    <Edit3 size={12} />
                                    <span>
                                      Editada por {msg.edited_by || 'Administrador'} em {formatDateTime(msg.edited_at)}
                                    </span>
                                    {historyCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHistoryMessage(msg)
                                          setHistoryModalOpen(true)
                                        }}
                                        style={{
                                          marginLeft: 6,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: '#b45309',
                                          background: '#fef3c7',
                                          border: '1px solid #fde68a',
                                          borderRadius: 4,
                                          padding: '1px 6px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Ver Histórico ({historyCount})
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Bottom: Admin Intervention Input Box */}
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <form onSubmit={handleSendIntervention} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#701a75', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldAlert size={15} color="#9333ea" />
                          Intervenção Oficial da Direção Escolar
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          Será enviada e notificada com selo institucional de moderação
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Digite aqui uma orientação ou nota oficial para os participantes desta conversa..."
                          value={interventionText}
                          onChange={e => setInterventionText(e.target.value)}
                          disabled={isSendingIntervention}
                          style={{
                            flex: 1,
                            height: 42,
                            padding: '0 14px',
                            fontSize: 13,
                            borderRadius: 10,
                            border: '1px solid #f0abfc',
                            background: '#fdf4ff',
                            color: '#0f172a',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="submit"
                          disabled={isSendingIntervention || !interventionText.trim()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0 18px',
                            height: 42,
                            borderRadius: 10,
                            border: 'none',
                            background: !interventionText.trim() ? '#cbd5e1' : 'linear-gradient(135deg, #9333ea, #7e22ce)',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: !interventionText.trim() || isSendingIntervention ? 'not-allowed' : 'pointer',
                            boxShadow: !interventionText.trim() ? 'none' : '0 2px 8px rgba(147, 51, 234, 0.3)'
                          }}
                        >
                          <Send size={15} />
                          {isSendingIntervention ? 'Enviando...' : 'Intervir'}
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: EDIT MESSAGE ── */}
      {editModalOpen && messageToEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#2563eb" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Editar Mensagem (Auditoria Administrativa)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Mensagem Original Enviada por {messageToEdit.sender_name}:
                </label>
                <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: 12, color: '#64748b', maxHeight: 90, overflowY: 'auto' }}>
                  {messageToEdit.content}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Novo Conteúdo da Mensagem:
                </label>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Motivo da Edição (Ficará registrado na ata e na auditoria):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Correção de informação institucional, adequação de conduta..."
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={isSavingEdit}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editContent.trim()}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: isSavingEdit || !editContent.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AUDIT HISTORY ── */}
      {historyModalOpen && historyMessage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 580, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} color="#b45309" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Histórico de Auditoria de Versões
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, maxHeight: 400, overflowY: 'auto' }}>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Conteúdo Atual:</span>
                <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e3a8a', marginTop: 4 }}>
                  {historyMessage.content}
                </div>
              </div>

              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Edições Anteriores:</span>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(historyMessage.metadata?.audit_history || []).map((h: AuditRecord, idx: number) => (
                  <div key={idx} style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                      <span>Editado por {h.edited_by}</span>
                      <span>{formatDateTime(h.edited_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#78350f', fontStyle: 'italic', marginBottom: 4 }}>
                      Motivo: {h.reason || 'Sem motivo registrado'}
                    </div>
                    <div style={{ fontSize: 12, color: '#451a03', background: '#ffffff', padding: '6px 8px', borderRadius: 6, border: '1px solid #fde68a' }}>
                      <span style={{ fontWeight: 600 }}>Texto Anterior: </span>{h.previous_content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE MESSAGE ── */}
      {deleteMsgModalOpen && messageToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, background: '#fff1f2' }}>
              <AlertTriangle size={20} color="#dc2626" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#991b1b', margin: 0 }}>
                Moderação: Ocultar ou Excluir Mensagem
              </h3>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Escolha como deseja tratar esta mensagem enviada por <strong>{messageToDelete.sender_name}</strong>:
              </p>

              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
                &ldquo;{messageToDelete.content}&rdquo;
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="deleteType"
                    checked={!deleteMsgHard}
                    onChange={() => setDeleteMsgHard(false)}
                  />
                  <span>
                    <strong>Ocultar Mensagem (Recomendado):</strong> Substitui o conteúdo por um aviso de moderação, mantendo o registro para a auditoria.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#dc2626', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="deleteType"
                    checked={deleteMsgHard}
                    onChange={() => setDeleteMsgHard(true)}
                  />
                  <span>
                    <strong>Excluir Definitivamente:</strong> Remove a mensagem do banco de dados de forma irreversível.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteMsgModalOpen(false)}
                disabled={isDeletingMsg}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMessage}
                disabled={isDeletingMsg}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: isDeletingMsg ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeletingMsg ? 'Processando...' : deleteMsgHard ? 'Excluir Definitivamente' : 'Ocultar Mensagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONVERSATION ── */}
      {deleteConvModalOpen && convToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, background: '#fff1f2' }}>
              <AlertTriangle size={20} color="#dc2626" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#991b1b', margin: 0 }}>
                Excluir Conversa Completa
              </h3>
            </div>

            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Tem certeza que deseja excluir esta conversa entre <strong>{convToDelete.educator?.user_name}</strong> e <strong>{convToDelete.target?.user_name}</strong>?
              </p>
              <div style={{ padding: '10px 12px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 12 }}>
                ⚠️ <strong>Atenção:</strong> Todas as mensagens, anexos e recibos vinculados a esta conversa serão permanentemente apagados do sistema.
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConvModalOpen(false)}
                disabled={isDeletingConv}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                disabled={isDeletingConv}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: isDeletingConv ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeletingConv ? 'Excluindo...' : 'Sim, Excluir Conversa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ATA OFICIAL DE ATENDIMENTO (PRINTABLE) ── */}
      {ataModalOpen && selectedConv && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Top Toolbar (Don't print) */}
            <div className="no-print" style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={18} color="#2563eb" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  Ata Oficial de Atendimento e Comunicação
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} />
                  Imprimir / Salvar em PDF
                </button>
                <button
                  type="button"
                  onClick={() => setAtaModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Content */}
            <div id="printable-ata" style={{ flex: 1, overflowY: 'auto', padding: '36px 40px', background: '#ffffff', color: '#0f172a', fontFamily: 'serif' }}>
              {/* Institution Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0', fontFamily: 'sans-serif' }}>
                  Colégio Impacto
                </h2>
                <div style={{ fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Direção Pedagógica & Administrativa • Secretaria Escolar
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a8a', marginTop: 12, textTransform: 'uppercase' }}>
                  Ata de Registro de Comunicações & Atendimento Digital
                </div>
              </div>

              {/* Metadata Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', width: '25%', background: '#f8fafc' }}>Data de Emissão:</td>
                    <td style={{ padding: '6px 8px' }}>{new Date().toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', width: '25%', background: '#f8fafc' }}>ID da Conversa:</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{selectedConv.id}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: '#f8fafc' }}>Educador / Atendente:</td>
                    <td style={{ padding: '6px 8px' }}>{selectedConv.educator?.user_name} ({selectedConv.educator?.user_perfil})</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: '#f8fafc' }}>Família / Responsável:</td>
                    <td style={{ padding: '6px 8px' }}>{selectedConv.target?.user_name} ({selectedConv.target?.user_perfil})</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: '#f8fafc' }}>Aluno Vinculado:</td>
                    <td style={{ padding: '6px 8px' }}>{selectedConv.aluno_nome || 'Não especificado'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: '#f8fafc' }}>Turma:</td>
                    <td style={{ padding: '6px 8px' }}>{selectedConv.turma_nome || 'Geral'}</td>
                  </tr>
                </tbody>
              </table>

              {/* Transcript Heading */}
              <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, borderBottom: '1px solid #0f172a', paddingBottom: 4 }}>
                Transcrição Cronológica Fiel das Mensagens
              </div>

              {/* Messages Chronology */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ fontSize: 12, borderBottom: '1px dotted #cbd5e1', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 2 }}>
                      <span>
                        [{formatDateTime(msg.created_at)}] {msg.sender_name} ({msg.sender_perfil}):
                      </span>
                      {msg.is_edited && (
                        <span style={{ fontSize: 10, color: '#b45309' }}>
                          * Editada em {formatDateTime(msg.edited_at)} por {msg.edited_by}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#0f172a', paddingLeft: 12, fontStyle: msg.is_deleted ? 'italic' : 'normal' }}>
                      {msg.is_deleted ? `[MENSAGEM OCULTADA PELA MODERAÇÃO ESCOLAR EM ${formatDateTime(msg.deleted_at)}]` : msg.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signatures */}
              <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center', fontSize: 12 }}>
                <div>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: 8, fontWeight: 'bold' }}>
                    Direção Pedagógica / Administrativa
                  </div>
                  <div style={{ color: '#64748b' }}>Colégio Impacto</div>
                </div>
                <div>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: 8, fontWeight: 'bold' }}>
                    {selectedConv.target?.user_name || 'Responsável / Destinatário'}
                  </div>
                  <div style={{ color: '#64748b' }}>Assinatura do Responsável</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MEDIA VIEWER ── */}
      {viewerItem && (
        <ChatMediaViewerModal
          media={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}

      {/* Inline styles for spinner and print */}
      <style jsx global>{`
        @keyframes spinAround {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spinAround 0.8s linear infinite !important;
        }

        @media (max-width: 900px) {
          .admin-chat-split-pane {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
          }
          .admin-chat-left-pane,
          .admin-chat-right-pane {
            width: 100% !important;
            height: auto !important;
            min-height: 520px !important;
            max-height: calc(100vh - 160px) !important;
          }
          .has-selection-mobile-hide {
            display: none !important;
          }
          .no-selection-mobile-hide {
            display: none !important;
          }
          .admin-chat-mobile-back-btn {
            display: inline-flex !important;
          }
        }

        @media (max-width: 768px) {
          .admin-chat-mode-switcher {
            width: 100% !important;
            display: flex !important;
            box-sizing: border-box !important;
          }
          .admin-chat-mode-btn {
            flex: 1 1 0 !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 12px !important;
            gap: 6px !important;
            white-space: nowrap !important;
          }
          .admin-chat-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }
          .admin-chat-kpi-card {
            padding: 10px 12px !important;
            border-radius: 12px !important;
            gap: 10px !important;
          }
          .admin-chat-kpi-icon {
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
          }
          .admin-chat-kpi-icon svg {
            width: 18px !important;
            height: 18px !important;
          }
          .admin-chat-kpi-value {
            font-size: 18px !important;
            line-height: 1.1 !important;
          }
          .admin-chat-kpi-label {
            font-size: 10px !important;
          }
          .admin-chat-kpi-card-span {
            grid-column: span 2 !important;
          }
          .admin-chat-filters {
            padding: 12px !important;
            border-radius: 14px !important;
            margin-bottom: 14px !important;
          }
          .admin-chat-filters > div {
            gap: 10px !important;
          }
          .admin-chat-search-box {
            width: 100% !important;
            flex: none !important;
          }
          .admin-chat-turma-box {
            flex: 1 1 0 !important;
            width: auto !important;
            min-width: 0 !important;
          }
          .admin-chat-presets-box {
            width: 100% !important;
            display: flex !important;
            overflow-x: auto !important;
            padding: 3px !important;
          }
          .admin-chat-presets-box button {
            flex: 1 1 0 !important;
            white-space: nowrap !important;
            padding: 6px 4px !important;
            font-size: 11px !important;
            text-align: center !important;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ata, #printable-ata * {
            visibility: visible !important;
          }
          #printable-ata {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
