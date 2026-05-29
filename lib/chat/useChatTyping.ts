'use client'

// lib/chat/useChatTyping.ts
// Tracks and broadcasts typing status in the current conversation
// Debounces auto-stop after 3s of inactivity

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { setTyping, clearTyping } from './services/chatTypingService'
import type { ChatTypingStatus } from './types'

const TYPING_DEBOUNCE_MS = 3000

export function useChatTyping(conversationId: string | null) {
  const { currentUser } = useApp()

  const [typingUsers, setTypingUsers] = useState<
    Array<{ user_id: string; user_name: string }>
  >([])

  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Start typing broadcast ─────────────────────────────────────

  const startTyping = useCallback(async () => {
    if (!conversationId || !currentUser) return

    // Clear any pending stop timer
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
    }

    // Only broadcast if not already flagged as typing
    if (!isTypingRef.current) {
      isTypingRef.current = true
      await setTyping(conversationId, currentUser.id, currentUser.nome).catch(
        () => null,
      )
    }

    // Auto-stop after debounce
    stopTimerRef.current = setTimeout(async () => {
      isTypingRef.current = false
      if (conversationId && currentUser) {
        await clearTyping(conversationId, currentUser.id).catch(() => null)
      }
    }, TYPING_DEBOUNCE_MS)
  }, [conversationId, currentUser])

  // ── Stop typing broadcast ──────────────────────────────────────

  const stopTyping = useCallback(async () => {
    if (!conversationId || !currentUser) return

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }

    if (isTypingRef.current) {
      isTypingRef.current = false
      await clearTyping(conversationId, currentUser.id).catch(() => null)
    }
  }, [conversationId, currentUser])

  // ── Cleanup on unmount or conversation change ──────────────────

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      // Clear typing when leaving conversation
      if (conversationId && currentUser && isTypingRef.current) {
        clearTyping(conversationId, currentUser.id).catch(() => null)
        isTypingRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // ── Listen for others typing ───────────────────────────────────

  useEffect(() => {
    if (!conversationId || !currentUser?.id) return

    // Reset typing users when switching conversations
    setTypingUsers([])

    const channel = supabase
      .channel(`typing:conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_typing_status',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const status = payload.new as ChatTypingStatus

          // Ignore own typing events
          if (status.user_id === currentUser.id) return

          const now = new Date().getTime()
          const expiresAt = new Date(status.expires_at).getTime()
          const isActive = status.is_typing && expiresAt > now

          setTypingUsers((prev) => {
            if (isActive) {
              // Add or update
              const exists = prev.some((u) => u.user_id === status.user_id)
              if (exists) {
                return prev.map((u) =>
                  u.user_id === status.user_id
                    ? { user_id: status.user_id, user_name: status.user_name ?? '' }
                    : u,
                )
              }
              return [
                ...prev,
                {
                  user_id: status.user_id,
                  user_name: status.user_name ?? '',
                },
              ]
            } else {
              // Remove from list
              return prev.filter((u) => u.user_id !== status.user_id)
            }
          })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [conversationId, currentUser?.id])

  return {
    typingUsers,
    startTyping,
    stopTyping,
  }
}
