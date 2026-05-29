'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ChatTypingIndicatorProps {
  typingUsers: { user_name?: string }[]
}

export function ChatTypingIndicator({ typingUsers }: ChatTypingIndicatorProps) {
  if (!typingUsers || typingUsers.length === 0) return null

  const label = (() => {
    const names = typingUsers.map(u => u.user_name || 'Alguém')
    if (names.length === 1) return `${names[0]} está digitando`
    if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando`
    return `${names[0]} e mais ${names.length - 1} estão digitando`
  })()

  return (
    <AnimatePresence>
      <motion.div
        key="typing"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px 8px',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes typingBounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30%            { transform: translateY(-4px); opacity: 1; }
            }
            .typing-dot {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: hsl(var(--text-muted));
              display: inline-block;
              animation: typingBounce 1.2s ease-in-out infinite;
            }
            .typing-dot:nth-child(2) { animation-delay: 0.15s; }
            .typing-dot:nth-child(3) { animation-delay: 0.30s; }
          `
        }} />
        {/* Bubble containing dots */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: '14px 14px 14px 2px',
          padding: '7px 10px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
          {label}…
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
