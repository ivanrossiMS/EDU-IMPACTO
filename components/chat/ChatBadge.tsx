'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/lib/chatStore'

interface ChatBadgeProps {
  count?: number
  className?: string
  style?: React.CSSProperties
}

export function ChatBadge({ count, className, style }: ChatBadgeProps) {
  const storeCount = useChatStore((s) => s.unreadTotal)
  const displayCount = count !== undefined ? count : storeCount

  if (!displayCount || displayCount <= 0) return null

  return (
    <AnimatePresence>
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 9999,
          background: '#25d366', // Verde WhatsApp
          color: '#ffffff',
          fontSize: 10.5,
          fontWeight: 800,
          lineHeight: 1,
          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.4)',
          letterSpacing: '-0.02em',
          ...style
        }}
      >
        {displayCount > 99 ? '99+' : displayCount}
      </motion.span>
    </AnimatePresence>
  )
}
