import { supabase } from '@/lib/supabase'
import type { 
  ChatConversation, 
  NewConversationPayload, 
  ChatFilter, 
  ChatParticipant 
} from '../types'

export const chatService = {
  async createConversation(payload: NewConversationPayload, currentUserId: string, currentUserPerfil: string): Promise<ChatConversation> {
    try {
      // 1. Create conversation
      const { data: conv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          type: payload.type,
          title: payload.title,
          status: 'active',
          turma_id: payload.turma_id,
          aluno_id: payload.aluno_id,
          grupo_id: payload.grupo_id,
          created_by: currentUserId,
          priority: payload.priority || 'normal',
          last_message_text: payload.first_message || null,
          last_message_by: payload.first_message ? currentUserId : null,
          last_message_at: payload.first_message ? new Date().toISOString() : null,
          message_count: payload.first_message ? 1 : 0
        })
        .select()
        .single()

      if (convError) throw convError

      // 2. Add participants (including creator)
      const participantIds = Array.from(new Set([...payload.participant_ids, currentUserId]))
      
      const participantsToInsert = participantIds.map(userId => ({
        conversation_id: conv.id,
        user_id: userId,
        user_name: payload.participant_names?.[userId] || (userId === currentUserId ? 'Você' : 'Usuário'),
        user_perfil: payload.participant_perfis?.[userId] || (userId === currentUserId ? currentUserPerfil : null),
        user_role: userId === currentUserId ? 'admin' : 'member',
        unread_count: userId === currentUserId ? 0 : (payload.first_message ? 1 : 0)
      }))

      const { error: partError } = await supabase
        .from('chat_participants')
        .insert(participantsToInsert)

      if (partError) throw partError

      // 3. Insert first message if provided
      if (payload.first_message) {
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          sender_id: currentUserId,
          content: payload.first_message,
          content_type: 'text',
          status: 'sent'
        })
      }

      // 4. Audit log
      await supabase.from('chat_audit_logs').insert({
        actor_id: currentUserId,
        action: 'conversation_created',
        conversation_id: conv.id,
        target_type: 'conversation',
        target_id: conv.id
      })

      return conv as ChatConversation
    } catch (error) {
      console.error('Error creating conversation:', error)
      throw error
    }
  },

  async getConversations(userId: string, filter?: ChatFilter): Promise<ChatConversation[]> {
    try {
      // Get conversations where user is a participant
      let query = supabase
        .from('chat_participants')
        .select(`
          unread_count,
          is_pinned,
          is_archived,
          conversation_id,
          chat_conversations (
            *,
            chat_participants (
              user_id,
              user_name,
              is_archived,
              left_at
            )
          )
        `)
        .eq('user_id', userId)
        .is('left_at', null)

      const { data, error } = await query

      if (error) throw error

      // Transform
      let conversations = data.map((p: any) => {
        const conv = p.chat_conversations
        if (!conv) return null
        
        conv.unread_count = p.unread_count
        conv.is_pinned = p.is_pinned
        conv.is_archived = p.is_archived
        
        // Populate other_participant for direct chats
        if (conv.type === 'direct' && conv.chat_participants) {
          const other = conv.chat_participants.find((cp: any) => cp.user_id !== userId && !cp.left_at)
          if (other) {
            conv.other_participant = {
              user_id: other.user_id,
              user_name: other.user_name || conv.title,
              user_perfil: other.user_perfil
            } as any
          }
        }
        
        // Remove nested participants to avoid bloat if not needed
        delete conv.chat_participants
        
        return conv as ChatConversation
      }).filter(c => c !== null) // Filter out nulls if join failed

      if (filter?.type) {
         conversations = conversations.filter(c => c.type === filter.type)
      }

      if (filter?.tab === 'unanswered') {
         conversations = conversations.filter(c => c.last_message_by !== userId)
      }

      // Sort: pinned first, then by last message
      conversations.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        
        const dateA = a.last_message_at || a.created_at
        const dateB = b.last_message_at || b.created_at
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })

      // LIMIT CONVERSATIONS TO AVOID BROWSER THROTTLING AND TIMEOUTS
      conversations = conversations.slice(0, 100)

      // Collect aluno_ids ONLY from the sliced conversations
      const alunoIds = new Set<string>()
      conversations.forEach(conv => {
        if (conv.aluno_id) {
          alunoIds.add(conv.aluno_id)
        }
      })

      // Fetch alunos data manually via API to bypass RLS restrictions
      if (alunoIds.size > 0) {
        try {
          const idsArray = Array.from(alunoIds)
          const alunosResults = []
          
          // Lote de requisições para evitar exaurir conexões do browser
          const chunkSize = 5
          for (let i = 0; i < idsArray.length; i += chunkSize) {
            const chunk = idsArray.slice(i, i + chunkSize)
            const chunkPromises = chunk.map(id => 
              fetch(`/api/alunos?id=${id}&limit=1`, { signal: AbortSignal.timeout(5000) })
                .then(r => r.json())
                .catch(() => null)
            )
            const results = await Promise.all(chunkPromises)
            alunosResults.push(...results)
          }
          
          const alunosMap = new Map()
          alunosResults.forEach(res => {
            // Em caso de retorno ser um array de busca paginada
            const studentData = res?.data?.[0] || res?.data || res
            if (studentData && studentData.id) {
              alunosMap.set(String(studentData.id), studentData)
            }
          })
          
          conversations.forEach(conv => {
            if (conv.aluno_id && alunosMap.has(String(conv.aluno_id))) {
              conv.aluno = alunosMap.get(String(conv.aluno_id))
            }
          })
        } catch (err) {
          console.error("Failed to fetch alunos info", err)
        }
      }

      return conversations
    } catch (error) {
      console.error('Error fetching conversations:', error)
      return []
    }
  },

  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    await supabase
      .from('chat_participants')
      .update({ is_archived: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
  },

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // Soft delete or remove participant
    await supabase
      .from('chat_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
  },

  async closeConversation(conversationId: string, userId: string): Promise<void> {
    await supabase
      .from('chat_conversations')
      .update({ status: 'closed', closed_by: userId })
      .eq('id', conversationId)
  },

  async pinConversation(conversationId: string, userId: string, pinned: boolean): Promise<void> {
    await supabase
      .from('chat_participants')
      .update({ is_pinned: pinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
  },

  async markAllRead(conversationId: string, userId: string): Promise<void> {
    await supabase
      .from('chat_participants')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
  }
}
