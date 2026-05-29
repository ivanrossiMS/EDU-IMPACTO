'use client'

// lib/chat/useChatRealtime.ts
// Central realtime manager — subscribes to all relevant tables for a user
// and dispatches events via callbacks. Properly cleans up on unmount.

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  ChatMessage,
  ChatConversation,
  ChatTypingStatus,
  ChatPresence,
} from './types'

export interface ChatRealtimeCallbacks {
  onNewMessage?: (message: ChatMessage) => void
  onMessageUpdated?: (message: ChatMessage) => void
  onConversationUpdate?: (conversation: ChatConversation) => void
  onConversationInsert?: (conversation: ChatConversation) => void
  onTyping?: (status: ChatTypingStatus) => void
  onPresence?: (presence: ChatPresence) => void
}

interface UseChatRealtimeOptions {
  userId: string | null | undefined
  conversationId?: string | null
  callbacks: ChatRealtimeCallbacks
}

export function useChatRealtime({
  userId,
  conversationId,
  callbacks,
}: UseChatRealtimeOptions) {
  // Keep callbacks stable without stale closures
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // ── Conversation-level realtime (all conversations for user) ───

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`realtime:conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
        },
        (payload) => {
          callbacksRef.current.onConversationInsert?.(
            payload.new as ChatConversation,
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
        },
        (payload) => {
          callbacksRef.current.onConversationUpdate?.(
            payload.new as ChatConversation,
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_presence',
        },
        (payload) => {
          callbacksRef.current.onPresence?.(payload.new as ChatPresence)
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  // ── Message & typing realtime (scoped to one conversation) ─────

  useEffect(() => {
    if (!userId || !conversationId) return

    const channel = supabase
      .channel(`realtime:messages:${conversationId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callbacksRef.current.onNewMessage?.(payload.new as ChatMessage)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callbacksRef.current.onMessageUpdated?.(payload.new as ChatMessage)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_typing_status',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callbacksRef.current.onTyping?.(payload.new as ChatTypingStatus)
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId, conversationId])
}
