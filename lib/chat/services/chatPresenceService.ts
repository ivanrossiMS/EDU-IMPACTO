// lib/chat/services/chatPresenceService.ts
// User presence (online/offline) management

import { supabase } from '@/lib/supabase'

// ─── setOnline ─────────────────────────────────────────────────────

export async function setOnline(userId: string, userName: string): Promise<void> {
  try {
    const { error } = await supabase.from('chat_presence').upsert(
      {
        user_id: userId,
        user_name: userName,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      console.error('[chatPresenceService] setOnline error:', error)
    }
  } catch (err) {
    console.error('[chatPresenceService] setOnline error:', err)
  }
}

// ─── setOffline ────────────────────────────────────────────────────

export async function setOffline(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_presence')
      .update({
        is_online: false,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('[chatPresenceService] setOffline error:', error)
    }
  } catch (err) {
    console.error('[chatPresenceService] setOffline error:', err)
  }
}

// ─── getOnlineUsers ────────────────────────────────────────────────

export async function getOnlineUsers(userIds: string[]): Promise<string[]> {
  try {
    if (userIds.length === 0) return []

    // Consider user online if updated in last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('chat_presence')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_online', true)
      .gte('updated_at', twoMinutesAgo)

    if (error) throw error

    return (data ?? []).map((p) => p.user_id as string)
  } catch (err) {
    console.error('[chatPresenceService] getOnlineUsers error:', err)
    return []
  }
}
