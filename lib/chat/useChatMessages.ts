'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { chatMessageService } from './services/chatMessageService'
import type { ChatMessage } from './types'

export function useChatMessages(conversationId: string | null, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const loadMessages = useCallback(async (pageNum = 0, append = false) => {
    if (!conversationId) return
    
    setIsLoading(true)
    const { messages: newMessages, hasMore: more } = await chatMessageService.getMessages(conversationId, pageNum)
    
    setMessages(prev => append ? [...newMessages, ...prev] : newMessages)
    setHasMore(more)
    setPage(pageNum)
    setIsLoading(false)
  }, [conversationId])

  // Initial load
  useEffect(() => {
    if (conversationId) {
      setMessages([])
      loadMessages(0, false)
    }
  }, [conversationId, loadMessages])

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return

    const channelId = `conversation_${conversationId}_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const newMessage = payload.new as ChatMessage
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMessage.id)) return prev
          return [...prev, newMessage]
        })

        // Mark as read if the message is from someone else
        if (currentUserId && newMessage.sender_id !== currentUserId) {
          supabase
            .from('chat_participants')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', currentUserId)
            .then()
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const updatedMessage = payload.new as ChatMessage
        if (updatedMessage.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== updatedMessage.id))
        } else {
          setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m))
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadMessages(page + 1, true)
    }
  }

  const sendMessage = async (content: string, contentType: any = 'text', replyToId?: string) => {
    if (!conversationId || !currentUserId) return null
    
    // Optimistic UI update could be added here
    const msg = await chatMessageService.sendMessage({
      conversation_id: conversationId,
      content,
      content_type: contentType,
      reply_to_id: replyToId
    }, currentUserId)

    return msg
  }

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage
  }
}
