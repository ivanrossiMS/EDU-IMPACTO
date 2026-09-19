'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useApp } from '@/lib/context'

export function GlobalLogoutOverlay() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isCleanupDone, setIsCleanupDone] = useState(false)
  const { loadingPath } = useApp()
  const isNavigatingRef = useRef(false)

  const logoutStartTimeRef = useRef<number>(0)

  useEffect(() => {
    const handleLogoutStart = () => {
      logoutStartTimeRef.current = Date.now()
      isNavigatingRef.current = false
      setIsLoggingOut(true)
      setIsCleanupDone(false)
    }

    const handleLogoutReady = () => {
      // Garante um tempo mínimo de exibição suave (500ms) para não haver piscar
      // de tela se a limpeza for ultrarrápida, mantendo transição elegante.
      const elapsed = Date.now() - (logoutStartTimeRef.current || Date.now())
      const minDisplayTime = 500
      const remainingTime = Math.max(0, minDisplayTime - elapsed)

      if (remainingTime > 0) {
        setTimeout(() => {
          setIsCleanupDone(true)
        }, remainingTime)
      } else {
        setIsCleanupDone(true)
      }
    }

    window.addEventListener('edu:logout-start', handleLogoutStart)
    window.addEventListener('edu:logout-ready', handleLogoutReady)

    return () => {
      window.removeEventListener('edu:logout-start', handleLogoutStart)
      window.removeEventListener('edu:logout-ready', handleLogoutReady)
    }
  }, [])

  // Se loadingPath for 'logout' (disparado por sidebars e layouts)
  useEffect(() => {
    if (loadingPath === 'logout') {
      if (!logoutStartTimeRef.current) {
        logoutStartTimeRef.current = Date.now()
      }
      setIsLoggingOut(true)
    }
  }, [loadingPath])

  // Fallback de segurança: se o cleanup demorar mais de 2.0s, libera a transição
  useEffect(() => {
    if (isLoggingOut && !isCleanupDone) {
      const timeout = setTimeout(() => {
        setIsCleanupDone(true)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [isLoggingOut, isCleanupDone])

  const handleLogoutFinished = useCallback(() => {
    if (isNavigatingRef.current) return
    isNavigatingRef.current = true

    // Registra que o usuário acabou de ver a animação de logout
    // para não repetir a animação imediatamente na tela de login
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('edu_just_logged_out', '1')
        ;(window as any).__EDU_JUST_LOGGED_OUT__ = true
      } catch (_) {}
    }

    // ATENÇÃO: O overlay deve permanecer ativo desfocando a tela até que
    // o navegador conclua o carregamento da rota /login e desmonte o DOM atual.
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      } else {
        window.location.reload()
      }
    }
  }, [])

  // Assim que o cleanup for concluído, redireciona imediatamente para o login
  useEffect(() => {
    if ((isLoggingOut || loadingPath === 'logout') && isCleanupDone) {
      handleLogoutFinished()
    }
  }, [isLoggingOut, loadingPath, isCleanupDone, handleLogoutFinished])

  const isActive = isLoggingOut || loadingPath === 'logout'

  if (!isActive) {
    return null
  }

  // Animação padrão de carregamento da logo no meio embaçando o fundo (frosted glass blur),
  // sem tela escura opaca, com transição de saída protegida até o carregamento do login.
  return (
    <AgendaLuxuryLoader
      isLoading={true}
      statusText="Encerrando sessão com segurança..."
      preventExit={true}
    />
  )
}

