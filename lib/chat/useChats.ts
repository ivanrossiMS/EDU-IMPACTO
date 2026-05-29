'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { chatService } from './services/chatService'
import type { ChatConversation, ChatFilter } from './types'

export function useChats(currentUserId: string | undefined) {
  const [allConversations, setAllConversations] = useState<ChatConversation[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [counts, setCounts] = useState({ all: 0, unread: 0, pinned: 0, archived: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<ChatFilter>({ tab: 'all', search: '' })

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return
    setIsLoading(true)
    const data = await chatService.getConversations(currentUserId, filter)
    
    setAllConversations(data)
    
    // Compute counts
    const activeData = data.filter(c => !c.is_archived)
    setCounts({
      all: activeData.length,
      unread: activeData.filter(c => (c.unread_count || 0) > 0).length,
      pinned: activeData.filter(c => c.is_pinned).length,
      archived: data.filter(c => c.is_archived).length
    })

    // Apply tab filter
    let filtered = data
    if (filter.tab === 'archived') {
      filtered = data.filter(c => c.is_archived)
    } else {
      filtered = activeData
      if (filter.tab === 'unread') {
        filtered = filtered.filter(c => (c.unread_count || 0) > 0)
      } else if (filter.tab === 'pinned') {
        filtered = filtered.filter(c => c.is_pinned)
      }
    }

    // Apply local search filter if present
    if (filter.search) {
      filtered = filtered.filter(c => c.title?.toLowerCase().includes(filter.search.toLowerCase()))
    }
      
    setConversations(filtered)
    setIsLoading(false)
  }, [currentUserId, filter])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!currentUserId) return

    // Realtime subscription for conversation updates
    const channelId = `user_conversations_${currentUserId}_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations',
      }, (payload) => {
        // Quick reload on any conversation change (can be optimized to in-place updates)
        loadConversations()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${currentUserId}`
      }, (payload) => {
        // Reload on participant changes (e.g. unread count update)
        loadConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, loadConversations])

  const archiveConversation = async (id: string) => {
    if (!currentUserId) return
    await chatService.archiveConversation(id, currentUserId)
    setConversations(prev => prev.filter(c => c.id !== id))
  }

  const pinConversation = async (id: string, pinned: boolean) => {
    if (!currentUserId) return
    await chatService.pinConversation(id, currentUserId, pinned)
    loadConversations()
  }

  const deleteConversation = async (id: string) => {
    if (!currentUserId) return
    await chatService.deleteConversation(id, currentUserId)
    setConversations(prev => prev.filter(c => c.id !== id))
  }

  return {
    conversations,
    counts,
    isLoading,
    filter,
    setFilter,
    archiveConversation,
    deleteConversation,
    pinConversation,
    refresh: loadConversations
  }
}
