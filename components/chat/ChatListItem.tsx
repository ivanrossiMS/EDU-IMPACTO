'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Pin } from 'lucide-react'
import type { ChatConversation } from '@/lib/chat/types'
import { ChatBadge } from './ChatBadge'
import { UserAvatar } from '../UserAvatar'

interface ChatListItemProps {
  conversation: ChatConversation
  isActive: boolean
  onClick: () => void
  currentUserId: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  normal: 'transparent',
  low: 'transparent',
}

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899',
]
function avatarColor(name?: string): string {
  if (!name) return AVATAR_COLORS[0]
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
}
function timeAgo(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'agora'
    if (min < 60) return `${min}m`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h`
    const day = Math.floor(hr / 24)
    if (day < 7) return `${day}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

export function ChatListItem({
  conversation,
  isActive,
  onClick,
  currentUserId,
}: ChatListItemProps) {
  const unread = conversation.unread_count ?? 0
  const isUnread = unread > 0
  const displayName = conversation.title
    || conversation.other_participant?.user_name
    || (conversation.aluno?.nome ?? 'Conversa')

  const lastMsg = conversation.last_message_text ?? ''
  const priorityColor = PRIORITY_COLORS[conversation.priority] ?? 'transparent'

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: isActive
          ? 'linear-gradient(90deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.05) 100%)'
          : 'transparent',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.18s',
        position: 'relative',
        marginBottom: 2,
        borderLeft: `3px solid ${isActive ? '#6366f1' : priorityColor}`,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'hsl(var(--bg-elevated))'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, boxShadow: isActive ? '0 0 0 2px #6366f1' : 'none', borderRadius: '50%', transition: 'box-shadow 0.2s' }}>
          <UserAvatar 
            name={displayName} 
            userId={conversation.other_participant?.user_id || undefined} 
            fotoUrl={conversation.aluno?.foto || undefined}
            size={44} 
          />
        </div>
        {/* Online dot */}
        <div style={{
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#22c55e',
          border: '2px solid hsl(var(--bg-surface))',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 13.5,
            fontWeight: isUnread ? 700 : 500,
            color: 'hsl(var(--text-primary))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {displayName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {conversation.is_pinned && (
              <Pin size={10} style={{ color: '#6366f1', transform: 'rotate(45deg)' }} />
            )}
            <span style={{
              fontSize: 11,
              color: 'hsl(var(--text-muted))',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {timeAgo(conversation.last_message_at)}
            </span>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{
            fontSize: 12,
            color: isUnread ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-muted))',
            fontWeight: isUnread ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            lineClamp: 1,
          }}>
            {lastMsg || 'Nenhuma mensagem ainda'}
          </span>
          <div style={{ flexShrink: 0 }}>
            <ChatBadge count={unread} pulse={unread > 0} size="sm" />
          </div>
        </div>
      </div>
    </motion.button>
  )
}
