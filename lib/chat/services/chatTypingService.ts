// lib/chat/services/chatTypingService.ts
// Typing status broadcast and management

import { supabase } from '@/lib/supabase'

// Typing expiry duration in seconds
const TYPING_EXPIRY_SECONDS = 5

// ─── setTyping ─────────────────────────────────────────────────────

export async function setTyping(
  conversationId: string,
  userId: string,
  userName: string,
): Promise<void> {
  try {
    const expiresAt = new Date(
      Date.now() + TYPING_EXPIRY_SECONDS * 1000,
    ).toISOString()

    const { error } = await supabase.from('chat_typing_status').upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        user_name: userName,
        is_typing: true,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    )

    if (error) {
      console.error('[chatTypingService] setTyping error:', error)
    }
  } catch (err) {
    console.error('[chatTypingService] setTyping error:', err)
  }
}

// ─── clearTyping ───────────────────────────────────────────────────

export async function clearTyping(
  conversationId: string,
  userId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_typing_status')
      .update({
        is_typing: false,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    if (error) {
      console.error('[chatTypingService] clearTyping error:', error)
    }
  } catch (err) {
    console.error('[chatTypingService] clearTyping error:', err)
  }
}
