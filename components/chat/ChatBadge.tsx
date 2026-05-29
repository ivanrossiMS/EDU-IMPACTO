'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ChatBadgeProps {
  count: number
  max?: number
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { minWidth: 16, height: 16, fontSize: 9, padding: '0 4px' },
  md: { minWidth: 20, height: 20, fontSize: 11, padding: '0 6px' },
  lg: { minWidth: 24, height: 24, fontSize: 12, padding: '0 8px' },
}

export function ChatBadge({ count, max = 99, pulse = false, size = 'md' }: ChatBadgeProps) {
  if (count <= 0) return null

  const { minWidth, height, fontSize, padding } = sizeMap[size]
  const displayCount = count > max ? `${max}+` : String(count)

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={displayCount}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth,
          height,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#fff',
          fontSize,
          fontWeight: 700,
          padding,
          lineHeight: 1,
          boxShadow: pulse && count > 0
            ? '0 0 0 0 rgba(239,68,68,0.7)'
            : '0 2px 6px rgba(239,68,68,0.4)',
          flexShrink: 0,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          animation: pulse && count > 0 ? 'badgePulse 1.8s ease-in-out infinite' : undefined,
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes badgePulse {
              0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.6); }
              70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0);   }
              100% { box-shadow: 0 0 0 0   rgba(239,68,68,0);   }
            }
          `
        }} />
        {displayCount}
      </motion.span>
    </AnimatePresence>
  )
}
