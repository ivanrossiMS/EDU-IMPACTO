// lib/chat/types.ts
// Tipos TypeScript completos do módulo de Chat Realtime Escolar

export type ConversationType = 'direct' | 'group' | 'broadcast'
export type ConversationStatus = 'active' | 'archived' | 'closed' | 'transferred'
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
export type MessageContentType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system'
export type ParticipantRole = 'admin' | 'moderator' | 'member' | 'observer'
export type GroupType = 'turma' | 'setor' | 'equipe' | 'geral' | 'administrativo'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type UserPerfil = 'admin' | 'colaborador' | 'familia' | 'aluno'
export type AuditAction = 
  | 'message_sent' 
  | 'message_deleted'
  | 'message_edited'
  | 'conversation_created'
  | 'conversation_archived'
  | 'conversation_closed'
  | 'conversation_transferred'
  | 'participant_added'
  | 'participant_removed'

export interface ChatConversation {
  id: string
  type: ConversationType
  title?: string
  status: ConversationStatus
  
  // Vínculos escolares
  turma_id?: string
  aluno_id?: string
  aluno?: { id: string; nome: string; foto: string | null; turma?: string }
  grupo_id?: string
  
  // Controles
  created_by: string
  updated_by?: string
  transferred_to?: string
  closed_by?: string
  
  // Configurações
  is_pinned: boolean
  is_archived?: boolean
  is_muted_global: boolean
  priority: Priority
  
  // Última mensagem (desnormalizado para performance)
  last_message_at?: string
  last_message_text?: string
  last_message_by?: string
  message_count: number
  
  created_at: string
  updated_at: string
  deleted_at?: string
  
  // Join fields (populated client-side)
  participants?: ChatParticipant[]
  unread_count?: number
  other_participant?: ChatParticipant
}

export interface ChatParticipant {
  id: string
  conversation_id: string
  user_id: string
  user_name?: string
  user_perfil?: string
  user_role: ParticipantRole
  
  last_read_at?: string
  unread_count: number
  
  is_muted: boolean
  is_pinned: boolean
  is_archived: boolean
  is_blocked: boolean
  notifications_enabled: boolean
  
  joined_at: string
  left_at?: string
  
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_name?: string
  sender_perfil?: string
  
  content?: string
  content_type: MessageContentType
  
  reply_to_id?: string
  reply_preview?: string
  reply_to?: ChatMessage // populated
  
  status: MessageStatus
  metadata?: Record<string, unknown>
  
  is_edited: boolean
  edited_at?: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
  
  created_at: string
  updated_at: string
  
  // Join fields
  attachments?: ChatAttachment[]
  read_by?: string[] // user_ids
}

export interface ChatAttachment {
  id: string
  message_id: string
  conversation_id: string
  uploaded_by: string
  
  file_name: string
  file_type: string
  file_size?: number
  file_url: string
  thumbnail_url?: string
  
  created_at: string
}

export interface ChatReadReceipt {
  id: string
  message_id: string
  conversation_id: string
  user_id: string
  read_at: string
}

export interface ChatTypingStatus {
  id: string
  conversation_id: string
  user_id: string
  user_name?: string
  is_typing: boolean
  expires_at: string
  updated_at: string
}

export interface ChatPresence {
  id: string
  user_id: string
  user_name?: string
  is_online: boolean
  last_seen_at: string
  updated_at: string
}

export interface ChatNotification {
  id: string
  user_id: string
  conversation_id?: string
  message_id?: string
  
  type: 'new_message' | 'mention' | 'system' | 'transfer' | 'archive' | 'reopen'
  title?: string
  body?: string
  sender_name?: string
  
  is_read: boolean
  read_at?: string
  
  created_at: string
}

export interface ChatGroup {
  id: string
  name: string
  description?: string
  group_type: GroupType
  
  turma_id?: string
  setor_id?: string
  
  color: string
  icon?: string
  is_active: boolean
  created_by: string
  
  created_at: string
  updated_at: string
  
  // Join fields
  members?: ChatGroupMember[]
  member_count?: number
}

export interface ChatGroupMember {
  id: string
  group_id: string
  user_id: string
  user_perfil?: string
  role: 'admin' | 'member'
  added_by?: string
  added_at: string
}

export interface ChatAuditLog {
  id: string
  actor_id: string
  actor_name?: string
  actor_perfil?: string
  
  action: AuditAction
  target_type?: string
  target_id?: string
  
  conversation_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
  
  created_at: string
}

// ──────────────────────────────────────────────────────────────
// Tipos de UI / Estado
// ──────────────────────────────────────────────────────────────

export interface ChatFilter {
  tab: 'all' | 'unread' | 'unanswered' | 'pinned' | 'archived'
  search: string
  type?: ConversationType
}

export interface NewConversationPayload {
  type: ConversationType
  title?: string
  participant_ids: string[]
  participant_names?: Record<string, string>
  participant_perfis?: Record<string, string>
  aluno_id?: string
  turma_id?: string
  grupo_id?: string
  first_message?: string
  priority?: Priority
}

export interface SendMessagePayload {
  conversation_id: string
  content: string
  content_type?: MessageContentType
  reply_to_id?: string
  attachment_urls?: string[]
}

// ──────────────────────────────────────────────────────────────
// Contexto de permissões
// ──────────────────────────────────────────────────────────────

export interface ChatPermissions {
  canViewAll: boolean         // Admin master
  canCreateConversation: boolean
  canSendMessages: boolean
  canDeleteMessages: boolean
  canArchiveConversation: boolean
  canCloseConversation: boolean
  canTransferConversation: boolean
  canManageGroups: boolean
  canViewAuditLog: boolean
  allowedGroupIds: string[]   // Grupos/turmas que pode ver
  allowedStudentIds: string[] // Alunos que pode ver (para responsáveis)
}

// ──────────────────────────────────────────────────────────────
// Realtime payload types
// ──────────────────────────────────────────────────────────────

export interface RealtimeMessagePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: ChatMessage
  old?: Partial<ChatMessage>
}

export interface RealtimeConversationPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: ChatConversation
  old?: Partial<ChatConversation>
}

export interface RealtimeTypingPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: ChatTypingStatus
}
