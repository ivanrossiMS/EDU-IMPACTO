'use client'

import { motion } from 'framer-motion'
import { ChevronRight, Info, Archive, X, MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ChatConversation, ChatParticipant } from '@/lib/chat/types'
import { UserAvatar } from '../UserAvatar'

interface ChatHeaderProps {
  conversation: ChatConversation | null
  participants: ChatParticipant[]
  onToggleDetails: () => void
  onArchive: () => void
  onClose: () => void
  isDetailsOpen: boolean
  currentUserName: string
  onDelete?: () => void
}

function avatarColor(name?: string): string {
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}
function initials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

const TYPE_LABELS: Record<string, string> = {
  direct: 'Conversa direta',
  group: 'Grupo',
  broadcast: 'Comunicado',
}
const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  archived: '#f59e0b',
  closed: '#ef4444',
  transferred: '#6366f1',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  archived: 'Arquivada',
  closed: 'Encerrada',
  transferred: 'Transferida',
}

export function ChatHeader({
  conversation,
  participants,
  onToggleDetails,
  onArchive,
  onClose,
  isDetailsOpen,
  currentUserName,
  onDelete,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (!conversation) return null

  const otherParticipant = participants.find(p => p.user_name !== currentUserName)
  const displayName = conversation.aluno 
    ? conversation.aluno.nome 
    : (conversation.title || otherParticipant?.user_name || 'Conversa')
    
  const subtitle = conversation.aluno
    ? (otherParticipant?.user_name || 'Responsável')
    : TYPE_LABELS[conversation.type] || ''

  return (
    <div style={{
      position: 'relative',
      background: 'hsl(var(--bg-surface))',
      borderBottom: '1px solid hsl(var(--border-subtle))',
      flexShrink: 0,
    }}>
      {/* Gradient top accent */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: 'var(--gradient-primary)',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px 12px',
      }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'relative', zIndex: 1, borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <UserAvatar 
              name={displayName} 
              userId={conversation.aluno_id || otherParticipant?.user_id || undefined} 
              fotoUrl={conversation.aluno?.foto || undefined}
              size={42} 
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

        {/* Name + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: 'hsl(var(--text-primary))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}>
              {displayName}
            </h3>
            {/* Status badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              background: `${STATUS_COLORS[conversation.status]}18`,
              color: STATUS_COLORS[conversation.status],
              border: `1px solid ${STATUS_COLORS[conversation.status]}30`,
              flexShrink: 0,
            }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: STATUS_COLORS[conversation.status],
              }} />
              {STATUS_LABELS[conversation.status]}
            </span>
          </div>
          {subtitle && (
            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'hsl(var(--text-muted))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Info / Details toggle */}
          <HeaderIconBtn
            title={isDetailsOpen ? 'Fechar detalhes' : 'Detalhes'}
            active={isDetailsOpen}
            onClick={onToggleDetails}
          >
            <Info size={18} />
            {isDetailsOpen && <ChevronRight size={14} style={{ marginLeft: -2 }} />}
          </HeaderIconBtn>

          {/* Archive */}
          <HeaderIconBtn title="Arquivar conversa" onClick={onArchive}>
            <Archive size={18} />
          </HeaderIconBtn>

          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <HeaderIconBtn title="Mais opções" onClick={() => setMenuOpen(v => !v)}>
              <MoreVertical size={18} />
            </HeaderIconBtn>
            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-default))',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    padding: 6,
                    minWidth: 180,
                    zIndex: 50,
                  }}
                >
                  <DropdownItem
                    icon={<Archive size={14} />}
                    label="Arquivar"
                    onClick={() => { onArchive(); setMenuOpen(false) }}
                  />
                  <DropdownItem
                    icon={<X size={14} />}
                    label="Encerrar conversa"
                    danger
                    onClick={() => { onClose(); setMenuOpen(false) }}
                  />
                  {onDelete && (
                    <DropdownItem
                      icon={<Trash2 size={14} />}
                      label="Excluir conversa"
                      danger
                      onClick={() => { onDelete(); setMenuOpen(false) }}
                    />
                  )}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderIconBtn({
  children, title, onClick, active,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 10px',
        borderRadius: 10,
        border: 'none',
        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
        color: active ? '#6366f1' : 'hsl(var(--text-muted))',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontSize: 13,
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement
        if (!active) {
          b.style.background = 'hsl(var(--bg-elevated))'
          b.style.color = 'hsl(var(--text-primary))'
        }
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement
        b.style.background = active ? 'rgba(99,102,241,0.12)' : 'transparent'
        b.style.color = active ? '#6366f1' : 'hsl(var(--text-muted))'
      }}
    >
      {children}
    </button>
  )
}

function DropdownItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: danger ? '#f87171' : 'hsl(var(--text-secondary))',
        cursor: 'pointer',
        fontSize: 13,
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background =
          danger ? 'rgba(239,68,68,0.1)' : 'hsl(var(--bg-hover))'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
