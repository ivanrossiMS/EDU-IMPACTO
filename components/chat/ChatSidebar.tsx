'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, MessageSquarePlus, X } from 'lucide-react'
import { useDebounce } from 'use-debounce'
import type { ChatConversation, ChatFilter, ChatPermissions } from '@/lib/chat/types'
import { ChatListItem } from './ChatListItem'
import { ChatBadge } from './ChatBadge'

interface ChatSidebarProps {
  conversations: ChatConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  filter: ChatFilter
  onFilterChange: (f: ChatFilter) => void
  isLoading: boolean
  permissions: ChatPermissions
  currentUserId: string
  onNewConversation: () => void
}

const TABS: { key: ChatFilter['tab']; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'unanswered', label: 'Pendentes' },
  { key: 'pinned', label: 'Fixadas' },
  { key: 'archived', label: 'Arquivadas' },
]

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  filter,
  onFilterChange,
  isLoading,
  permissions,
  currentUserId,
  onNewConversation,
}: ChatSidebarProps) {
  const [rawSearch, setRawSearch] = useState(filter.search)
  const [debouncedSearch] = useDebounce(rawSearch, 280)

  const handleSearchChange = useCallback((val: string) => {
    setRawSearch(val)
    onFilterChange({ ...filter, search: val })
  }, [filter, onFilterChange])

  const handleTabChange = useCallback((tab: ChatFilter['tab']) => {
    onFilterChange({ ...filter, tab })
  }, [filter, onFilterChange])

  // Apply local filters
  const filtered = useMemo(() => {
    let list = conversations
    if (filter.tab === 'unread')     list = list.filter(c => (c.unread_count ?? 0) > 0)
    if (filter.tab === 'pinned')     list = list.filter(c => c.is_pinned)
    if (filter.tab === 'archived')   list = list.filter(c => c.status === 'archived')
    if (filter.tab !== 'archived')   list = list.filter(c => c.status !== 'archived')
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(c =>
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.last_message_text ?? '').toLowerCase().includes(q) ||
        (c.aluno?.nome ?? '').toLowerCase().includes(q) ||
        (c.other_participant?.user_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [conversations, filter.tab, debouncedSearch])

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_count ?? 0), 0),
    [conversations]
  )

  return (
    <div style={{
      width: 320,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'hsl(var(--bg-surface))',
      borderRight: '1px solid hsl(var(--border-subtle))',
      flexShrink: 0,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 16px 0',
        background: 'hsl(var(--bg-surface))',
        borderBottom: '1px solid hsl(var(--border-subtle))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}>
              <MessageSquarePlus size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Mensagens
              </h2>
              {totalUnread > 0 && (
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  {totalUnread} não {totalUnread === 1 ? 'lida' : 'lidas'}
                </span>
              )}
            </div>
          </div>

          {/* New conversation button */}
          {permissions.canCreateConversation && (
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={onNewConversation}
              title="Nova conversa"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: 'none',
                background: 'var(--gradient-primary)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
              }}
            >
              <Plus size={18} />
            </motion.button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={rawSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar conversas…"
            style={{
              width: '100%',
              padding: '9px 36px 9px 36px',
              borderRadius: 12,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              color: 'hsl(var(--text-primary))',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {rawSearch && (
            <button
              onClick={() => handleSearchChange('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'hsl(var(--text-muted))',
                padding: 2,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <FilterTab
              key={tab.key}
              label={tab.label}
              active={filter.tab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              count={tab.key === 'unread' ? totalUnread : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── Conversation list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', scrollbarWidth: 'thin' }}>
        {isLoading ? (
          <SidebarSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyFilterState tab={filter.tab} search={debouncedSearch} />
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(conv => (
              <ChatListItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onClick={() => onSelect(conv.id)}
                currentUserId={currentUserId}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function FilterTab({
  label, active, onClick, count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        color: active ? '#6366f1' : 'hsl(var(--text-muted))',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        paddingBottom: 10,
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <ChatBadge count={count} size="sm" />
      )}
      {active && (
        <motion.div
          layoutId="sidebarTabIndicator"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 4,
            right: 4,
            height: 2,
            borderRadius: 1,
            background: 'var(--gradient-primary)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  )
}

function SidebarSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            marginBottom: 4,
          }}
        >
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: '60%', height: 13, borderRadius: 6, marginBottom: 7 }} />
            <div className="skeleton" style={{ width: '80%', height: 11, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </>
  )
}

function EmptyFilterState({ tab, search }: { tab: string; search: string }) {
  if (search) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', color: 'hsl(var(--text-muted))' }}>
        <Search size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Nenhum resultado</p>
        <p style={{ fontSize: 12 }}>Nenhuma conversa com "{search}"</p>
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'hsl(var(--text-muted))' }}>
      <MessageSquarePlus size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
        {tab === 'pinned' ? 'Nenhuma fixada' :
         tab === 'unread' ? 'Tudo lido!' :
         tab === 'archived' ? 'Nenhuma arquivada' :
         'Nenhuma conversa'}
      </p>
      <p style={{ fontSize: 12 }}>
        {tab === 'all' ? 'Inicie uma nova conversa.' : 'Mude o filtro para ver mais.'}
      </p>
    </div>
  )
}
