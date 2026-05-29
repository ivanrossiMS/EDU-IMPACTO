// lib/chat/services/chatAuditService.ts
// Audit log operations for the chat system

import { supabase } from '@/lib/supabase'
import type { ChatAuditLog, AuditAction } from '../types'

// ─── log ───────────────────────────────────────────────────────────

export async function log(
  actorId: string,
  actorName: string,
  actorPerfil: string,
  action: AuditAction,
  conversationId?: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from('chat_audit_logs').insert({
      actor_id: actorId,
      actor_name: actorName || null,
      actor_perfil: actorPerfil || null,
      action,
      conversation_id: conversationId ?? null,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      metadata: metadata ?? null,
    })

    if (error) {
      console.error('[chatAuditService] log insert error:', error)
    }
  } catch (err) {
    console.error('[chatAuditService] log error:', err)
  }
}

// ─── getAuditLogs ──────────────────────────────────────────────────

export interface AuditLogFilters {
  conversationId?: string
  actorId?: string
  action?: AuditAction
  from?: string // ISO date
  to?: string   // ISO date
  limit?: number
}

export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<ChatAuditLog[]> {
  try {
    let query = supabase
      .from('chat_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100)

    if (filters.conversationId) {
      query = query.eq('conversation_id', filters.conversationId)
    }

    if (filters.actorId) {
      query = query.eq('actor_id', filters.actorId)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.from) {
      query = query.gte('created_at', filters.from)
    }

    if (filters.to) {
      query = query.lte('created_at', filters.to)
    }

    const { data, error } = await query

    if (error) throw error

    return (data ?? []) as ChatAuditLog[]
  } catch (err) {
    console.error('[chatAuditService] getAuditLogs error:', err)
    return []
  }
}
