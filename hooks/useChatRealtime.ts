'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useChatStore } from '@/lib/chatStore'
import { appendCachedMessage, updateCachedMessage, removeCachedMessage } from '@/lib/chatMessagesCache'
import { playWhatsAppReceiveSound } from '@/lib/chatAudio'
import { useApp } from '@/lib/context'
import { toast } from 'sonner'

// Module-level singleton state for Supabase Realtime channel
let activeChannel: any = null
let subscriberCount = 0
let currentChannelName = ''

const globalChatContext = {
  myUserId: '',
  alunoId: '',
  isModalOpen: false,
  activeConvId: '',
  openConversationModal: (_conv: any) => {}
}

export function useChatRealtime(alunoId?: string) {
  const { currentUser } = useApp()
  const { activeConversation, isModalOpen, setUnreadTotal, openConversationModal } = useChatStore()

  const myUserId = alunoId || currentUser?.id || ''

  useEffect(() => {
    globalChatContext.myUserId = myUserId
    globalChatContext.alunoId = alunoId || ''
    globalChatContext.isModalOpen = isModalOpen
    globalChatContext.activeConvId = activeConversation?.id || ''
    globalChatContext.openConversationModal = openConversationModal
  }, [myUserId, alunoId, isModalOpen, activeConversation?.id, openConversationModal])

  // 1. Carregar contagem inicial de não lidos e ouvir eventos de sincronização
  useEffect(() => {
    if (!currentUser) return

    const fetchUnread = async () => {
      try {
        const queryParams = new URLSearchParams()
        if (alunoId) queryParams.set('aluno_id', alunoId)
        if (currentUser.id) queryParams.set('user_id', currentUser.id)

        const res = await fetch(`/api/chat/unread-count?${queryParams.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setUnreadTotal(data.total || 0)
        }
      } catch (_) {}
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)

    const handleUnreadSync = () => {
      fetchUnread()
    }

    window.addEventListener('chat:unread-changed', handleUnreadSync)
    window.addEventListener('chat:conversation-updated', handleUnreadSync)

    return () => {
      clearInterval(interval)
      window.removeEventListener('chat:unread-changed', handleUnreadSync)
      window.removeEventListener('chat:conversation-updated', handleUnreadSync)
    }
  }, [currentUser, alunoId, setUnreadTotal])

  // 2. Ouvinte Realtime Supabase (Singleton com Reference Counting e Nome Único)
  useEffect(() => {
    if (!currentUser) return

    subscriberCount += 1

    if (!activeChannel) {
      currentChannelName = `chat_global_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const channel = supabase
        .channel(currentChannelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
          },
          (payload: any) => {
            const newMsg = payload.new
            if (!newMsg) return

            // Atualiza cache em segundo plano para abertura em 0ms
            if (newMsg.conversation_id) {
              appendCachedMessage(newMsg.conversation_id, newMsg)
            }

            // Ignorar mensagens enviadas por mim mesmo
            if (newMsg.sender_id === globalChatContext.myUserId) return

            // Se a conversa atual está aberta com esse chat:
            if (globalChatContext.isModalOpen && globalChatContext.activeConvId === newMsg.conversation_id) {
              const activeConv = useChatStore.getState().activeConversation
              if (activeConv?.hasLeft) return

              playWhatsAppReceiveSound()
              // Disparar evento para o modal ativo adicionar na lista instantaneamente
              window.dispatchEvent(new CustomEvent('chat:message-received', { detail: newMsg }))
              // Marcar como lida
              fetch('/api/chat/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  conversation_id: newMsg.conversation_id, 
                  user_id: globalChatContext.myUserId,
                  aluno_id: globalChatContext.alunoId || undefined
                })
              }).catch(() => {})
            } else {
              // Disparar evento para atualizar a lista de conversas e contagem oficial
              window.dispatchEvent(new CustomEvent('chat:conversation-updated', { detail: newMsg }))
              window.dispatchEvent(new CustomEvent('chat:unread-changed'))
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages'
          },
          (payload: any) => {
            const updatedMsg = payload.new
            if (!updatedMsg) return

            if (updatedMsg.conversation_id) {
              if (updatedMsg.is_deleted) {
                removeCachedMessage(updatedMsg.conversation_id, updatedMsg.id)
              } else {
                updateCachedMessage(updatedMsg.conversation_id, updatedMsg)
              }
            }

            if (updatedMsg.is_deleted) {
              window.dispatchEvent(new CustomEvent('chat:message-deleted', { detail: updatedMsg }))
              window.dispatchEvent(new CustomEvent('chat:conversation-updated', { detail: updatedMsg }))
            } else {
              window.dispatchEvent(new CustomEvent('chat:message-updated', { detail: updatedMsg }))
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'chat_messages'
          },
          (payload: any) => {
            const deletedMsg = payload.old
            if (!deletedMsg) return

            if (deletedMsg.conversation_id) {
              removeCachedMessage(deletedMsg.conversation_id, deletedMsg.id)
            }

            window.dispatchEvent(new CustomEvent('chat:message-deleted', { detail: deletedMsg }))
            window.dispatchEvent(new CustomEvent('chat:conversation-updated', { detail: deletedMsg }))
          }
        )
        .subscribe()

      activeChannel = channel
    }

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0 && activeChannel) {
        supabase.removeChannel(activeChannel)
        activeChannel = null
        currentChannelName = ''
      }
    }
  }, [currentUser])
}
