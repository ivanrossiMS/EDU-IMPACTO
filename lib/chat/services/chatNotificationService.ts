// lib/chat/services/chatNotificationService.ts
// Notification operations for the chat system

import { supabase } from '@/lib/supabase'
import type { ChatNotification } from '../types'

// ─── createNotification ────────────────────────────────────────────

export async function createNotification(
  userId: string,
  conversationId: string,
  messageId: string,
  type: ChatNotification['type'],
  senderName: string,
  body: string,
): Promise<void> {
  try {
    const { error } = await supabase.from('chat_notifications').insert({
      user_id: userId,
      conversation_id: conversationId,
      message_id: messageId,
      type,
      title: senderName,
      body,
      sender_name: senderName,
      is_read: false,
    })

    if (error) {
      console.error('[chatNotificationService] createNotification error:', error)
    }
  } catch (err) {
    console.error('[chatNotificationService] createNotification error:', err)
  }
}

// ─── getUnreadNotifications ────────────────────────────────────────

export async function getUnreadNotifications(
  userId: string,
): Promise<ChatNotification[]> {
  try {
    const { data, error } = await supabase
      .from('chat_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []) as ChatNotification[]
  } catch (err) {
    console.error('[chatNotificationService] getUnreadNotifications error:', err)
    return []
  }
}

// ─── markNotificationRead ──────────────────────────────────────────

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error
  } catch (err) {
    console.error('[chatNotificationService] markNotificationRead error:', err)
  }
}

// ─── markAllNotificationsRead ──────────────────────────────────────

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
  } catch (err) {
    console.error('[chatNotificationService] markAllNotificationsRead error:', err)
  }
}

// ─── getTotalUnreadCount ───────────────────────────────────────────

export async function getTotalUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('chat_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error

    return count ?? 0
  } catch (err) {
    console.error('[chatNotificationService] getTotalUnreadCount error:', err)
    return 0
  }
}
