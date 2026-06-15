'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function GlobalNavigationLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)

  // Desativa o loading quando a rota muda
  useEffect(() => {
    setIsNavigating(false)
  }, [pathname, searchParams])

  // Intercepta cliques em links globais para ativar o loading
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignora se for clique com botão direito, ctrl+click, etc.
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      
      if (anchor && anchor.href) {
        // Ignorar se abrir numa nova janela
        if (anchor.target === '_blank') return
        
        // Ignorar se for link externo
        if (!anchor.href.startsWith(window.location.origin)) return
        
        // Ignorar se for o mesmo caminho e pesquisa (apenas uma hash anchor)
        const currentUrl = window.location.pathname + window.location.search
        const linkUrl = new URL(anchor.href)
        const newUrl = linkUrl.pathname + linkUrl.search
        
        if (currentUrl === newUrl && linkUrl.hash) return

        // Ativa o loading
        setIsNavigating(true)
      }
    }

    document.addEventListener('click', handleClick)
    
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [])

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)', // Overlay de vidro muito leve
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              width: 90,
              height: 90,
              borderRadius: 28,
              background: 'rgba(255, 255, 255, 0.6)', // Fundo de vidro do icone
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <Loader2 size={40} color="#6366f1" className="animate-spin" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
