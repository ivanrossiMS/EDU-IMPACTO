'use client'

// lib/chat/useChatBadges.ts
// Global unread badge management — polls + realtime updates

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

const POLL_INTERVAL_MS = 30_000 // 30 seconds

interface BadgeState {
  totalUnread: number
  unreadByConversation: Record<string, number>
}

export function useChatBadges() {
  const { currentUser } = useApp()

  const [totalUnread, setTotalUnread] = useState(0)
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch unread counts ────────────────────────────────────────

  const fetchBadges = useCallback(async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select('conversation_id, unread_count')
        .eq('user_id', currentUser.id)
        .gt('unread_count', 0)
        .is('left_at', null)

      if (error) throw error

      const byConv: Record<string, number> = {}
      let total = 0

      for (const row of data ?? []) {
        const count = (row.unread_count as number) ?? 0
        byConv[row.conversation_id as string] = count
        total += count
      }

      setUnreadByConversation(byConv)
      setTotalUnread(total)
    } catch (err) {
      console.error('[useChatBadges] fetchBadges error:', err)
    }
  }, [currentUser?.id])

  // ── Initial + poll ─────────────────────────────────────────────

  useEffect(() => {
    fetchBadges()

    pollRef.current = setInterval(fetchBadges, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchBadges])

  // ── Realtime subscription on participants table ─────────────────

  useEffect(() => {
    if (!currentUser?.id) return

    const channel = supabase
      .channel(`badges:participant:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          // Refetch on any participant row update
          fetchBadges()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          fetchBadges()
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [currentUser?.id, fetchBadges])

  // ── Optimistic badge mutation helpers ──────────────────────────

  const decrementBadge = useCallback((conversationId: string) => {
    setUnreadByConversation((prev) => {
      const current = prev[conversationId] ?? 0
      const next = Math.max(0, current - 1)
      const updated = { ...prev, [conversationId]: next }
      const newTotal = Object.values(updated).reduce((s, v) => s + v, 0)
      setTotalUnread(newTotal)
      return updated
    })
  }, [])

  const clearBadge = useCallback((conversationId: string) => {
    setUnreadByConversation((prev) => {
      const updated = { ...prev, [conversationId]: 0 }
      const newTotal = Object.values(updated).reduce((s, v) => s + v, 0)
      setTotalUnread(newTotal)
      return updated
    })
  }, [])

  return {
    totalUnread,
    unreadByConversation,
    decrementBadge,
    clearBadge,
    refresh: fetchBadges,
  }
}
