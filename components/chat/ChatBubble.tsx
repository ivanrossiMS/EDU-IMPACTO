'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, CheckCheck, Clock, AlertCircle, CornerUpLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ChatMessage } from '@/lib/chat/types'

interface ChatBubbleProps {
  message: ChatMessage
  isMine: boolean
  showSender?: boolean
  onReply: (msg: ChatMessage) => void
  onDelete: (msgId: string) => void
  canDelete?: boolean
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function StatusIcon({ status }: { status: ChatMessage['status'] }) {
  const props = { size: 13, strokeWidth: 2.5 }
  if (status === 'sending')   return <Clock {...props} style={{ color: 'rgba(255,255,255,0.5)' }} />
  if (status === 'sent')      return <Check {...props} style={{ color: 'rgba(255,255,255,0.6)' }} />
  if (status === 'delivered') return <CheckCheck {...props} style={{ color: 'rgba(255,255,255,0.6)' }} />
  if (status === 'read')      return <CheckCheck {...props} style={{ color: '#93c5fd' }} />
  if (status === 'failed')    return <AlertCircle {...props} style={{ color: '#f87171' }} />
  return null
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

export function ChatBubble({
  message,
  isMine,
  showSender = false,
  onReply,
  onDelete,
  canDelete = false,
}: ChatBubbleProps) {
  const [hovered, setHovered] = useState(false)

  const isDeleted = message.is_deleted
  const hasReply = !!message.reply_to_id
  const senderName = message.sender_name || 'Usuário'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: '2px 16px',
        position: 'relative',
      }}
    >
      {/* Avatar (other side only) */}
      {!isMine && (
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: avatarColor(senderName),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          marginBottom: 2,
        }}>
          {initials(senderName)}
        </div>
      )}

      {/* Bubble group */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        maxWidth: 'min(72%, 520px)',
        gap: 2,
      }}>
        {/* Sender name (group) */}
        {showSender && !isMine && !isDeleted && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: avatarColor(senderName),
            paddingLeft: 12,
            marginBottom: 1,
          }}>
            {senderName}
          </span>
        )}

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-end' }}>
          {/* Action buttons (hover) */}
          <AnimatePresence>
            {hovered && !isDeleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute',
                  [isMine ? 'left' : 'right']: 'calc(100% + 6px)',
                  bottom: 0,
                  display: 'flex',
                  gap: 4,
                  zIndex: 10,
                }}
              >
                <ActionBtn title="Responder" onClick={() => onReply(message)}>
                  <CornerUpLeft size={13} />
                </ActionBtn>
                {canDelete && (
                  <ActionBtn title="Apagar" onClick={() => onDelete(message.id)} danger>
                    <Trash2 size={13} />
                  </ActionBtn>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bubble */}
          <div style={{
            padding: isDeleted ? '8px 14px' : '9px 14px',
            borderRadius: isMine
              ? '18px 4px 18px 18px'
              : '4px 18px 18px 18px',
            background: isDeleted
              ? 'hsl(var(--bg-elevated))'
              : isMine
                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                : 'hsl(var(--bg-elevated))',
            border: isDeleted
              ? '1px dashed hsl(var(--border-default))'
              : isMine
                ? 'none'
                : '1px solid hsl(var(--border-subtle))',
            boxShadow: isDeleted ? 'none' : 'var(--shadow-sm)',
            maxWidth: '100%',
          }}>
            {/* Reply quoted box */}
            {hasReply && !isDeleted && (
              <div style={{
                borderLeft: '3px solid rgba(255,255,255,0.4)',
                paddingLeft: 8,
                marginBottom: 6,
                opacity: 0.75,
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isMine ? 'rgba(255,255,255,0.9)' : '#6366f1',
                  marginBottom: 2,
                }}>
                  {message.reply_to?.sender_name || 'Mensagem'}
                </div>
                <div style={{
                  fontSize: 12,
                  color: isMine ? 'rgba(255,255,255,0.75)' : 'hsl(var(--text-muted))',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineClamp: 2,
                }}>
                  {message.reply_preview || message.reply_to?.content || '…'}
                </div>
              </div>
            )}

            {/* Content */}
            {isDeleted ? (
              <span style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'hsl(var(--text-muted))',
              }}>
                🚫 Mensagem apagada
              </span>
            ) : (
              <p style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: isMine ? '#fff' : 'hsl(var(--text-primary))',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}>
                {message.content}
              </p>
            )}

            {/* Footer: time + status */}
            {!isDeleted && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                marginTop: 4,
              }}>
                {message.is_edited && (
                  <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : 'hsl(var(--text-muted))' }}>
                    editado
                  </span>
                )}
                <span style={{
                  fontSize: 11,
                  color: isMine ? 'rgba(255,255,255,0.6)' : 'hsl(var(--text-muted))',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatTime(message.created_at)}
                </span>
                {isMine && <StatusIcon status={message.status} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ActionBtn({
  children, title, onClick, danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid hsl(var(--border-subtle))',
        background: 'hsl(var(--bg-surface))',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: danger ? '#f87171' : 'hsl(var(--text-secondary))',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        const btn = e.currentTarget as HTMLButtonElement
        btn.style.background = danger ? 'rgba(239,68,68,0.1)' : 'hsl(var(--bg-elevated))'
        btn.style.borderColor = danger ? 'rgba(239,68,68,0.3)' : 'hsl(var(--border-default))'
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement
        btn.style.background = 'hsl(var(--bg-surface))'
        btn.style.borderColor = 'hsl(var(--border-subtle))'
      }}
    >
      {children}
    </button>
  )
}
