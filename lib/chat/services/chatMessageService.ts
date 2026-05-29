import { supabase } from '@/lib/supabase'
import type { ChatMessage, SendMessagePayload } from '../types'

export const chatMessageService = {
  async getMessages(conversationId: string, page = 0, pageSize = 30): Promise<{ messages: ChatMessage[], hasMore: boolean }> {
    try {
      const from = page * pageSize
      const to = from + pageSize - 1

      const { data, error, count } = await supabase
        .from('chat_messages')
        .select('*, attachments:chat_attachments(*)', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      const hasMore = count ? (from + data.length) < count : false
      
      // Reverse to chronological order for UI
      return { 
        messages: (data as ChatMessage[]).reverse(), 
        hasMore 
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      return { messages: [], hasMore: false }
    }
  },

  async sendMessage(payload: SendMessagePayload, currentUserId: string): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: payload.conversation_id,
          sender_id: currentUserId,
          content: payload.content,
          content_type: payload.content_type || 'text',
          reply_to_id: payload.reply_to_id,
          status: 'sent'
        })
        .select()
        .single()

      if (error) throw error
      
      // The database trigger will automatically update conversation last_message
      // and increment unread_counts for other participants

      return data as ChatMessage
    } catch (error) {
      console.error('Error sending message:', error)
      return null
    }
  },

  async deleteMessage(messageId: string, currentUserId: string): Promise<void> {
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single()

    await supabase
      .from('chat_messages')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId 
      })
      .eq('id', messageId)

    // Update conversation's last message to the new latest message
    if (msg?.conversation_id) {
      const { data: latestMsg } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', msg.conversation_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      await supabase
        .from('chat_conversations')
        .update({
          last_message_text: latestMsg ? latestMsg.content : null,
          last_message_at: latestMsg ? latestMsg.created_at : null,
          last_message_by: latestMsg ? latestMsg.sender_id : null
        })
        .eq('id', msg.conversation_id)
    }
  }
}
