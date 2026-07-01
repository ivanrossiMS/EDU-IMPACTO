'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ImpactoLoader } from '@/components/ui/ImpactoLoader'

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
        
        if (currentUrl === newUrl) return;

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ zIndex: 99999, position: 'relative' }}
        >
          <ImpactoLoader />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
