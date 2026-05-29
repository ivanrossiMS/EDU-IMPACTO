'use client'
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import FloatingChatPanel from './FloatingChatPanel'

export default function FloatingChatButton() {
  const { currentUser, hydrated } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const currentId = currentUser?.aluno_id || currentUser?.responsavel_id || currentUser?.id
    if (!hydrated || !currentId) return

    let mounted = true

    // Initial fetch
    const fetchBadge = async () => {
      const { data, error } = await supabase
        .from('chat_participants')
        .select('unread_count')
        .eq('user_id', currentId)
        .is('left_at', null)

      if (mounted && data) {
        const total = data.reduce((acc, p) => acc + (p.unread_count || 0), 0)
        setUnreadCount(total)
      }
    }

    fetchBadge()

    // Realtime sub
    const channel = supabase.channel(`badge_${currentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${currentId}`
      }, () => {
        fetchBadge()
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [hydrated, currentUser?.id, currentUser?.aluno_id, currentUser?.responsavel_id])

  if (!hydrated || !currentUser) return null

  return (
    <>
      {/* O Painel fica condicionalmente renderizado, mas o estado de abertura é controlado aqui */}
      <AnimatePresence>
        {isOpen && <FloatingChatPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? 'close' : 'open'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
          </motion.div>
        </AnimatePresence>

        {/* Badge */}
        {!isOpen && unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="chat-badge-pulse"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: 'white',
              fontSize: 12,
              fontWeight: 'bold',
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          .chat-badge-pulse::before {
            content: '';
            position: absolute;
            left: 0; top: 0; right: 0; bottom: 0;
            border-radius: 10px;
            border: 2px solid #ef4444;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          }
        `}} />
      </motion.button>
    </>
  )
}
