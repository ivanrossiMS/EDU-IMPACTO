'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'
import { useApp } from '@/lib/context'

export function GlobalLogoutOverlay() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isCleanupDone, setIsCleanupDone] = useState(false)
  const { loadingPath, setLoadingPath } = useApp()
  const isNavigatingRef = useRef(false)

  useEffect(() => {
    const handleLogoutStart = () => {
      isNavigatingRef.current = false
      setIsLoggingOut(true)
      setIsCleanupDone(false)
    }

    const handleLogoutReady = () => {
      setIsCleanupDone(true)
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
      setIsLoggingOut(true)
    }
  }, [loadingPath])

  // Fallback de segurança: se o cleanup demorar mais de 5.5s, libera a transição
  useEffect(() => {
    if (isLoggingOut && !isCleanupDone) {
      const timeout = setTimeout(() => {
        setIsCleanupDone(true)
      }, 5500)
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

    setIsLoggingOut(false)
    setIsCleanupDone(false)
    setLoadingPath(null)

    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      } else {
        window.location.reload()
      }
    }
  }, [setLoadingPath])

  if (isLoggingOut || loadingPath === 'logout') {
    return (
      <AppLoadingScreen
        mode="app"
        isReady={isCleanupDone}
        onReadyComplete={handleLogoutFinished}
        statusText="Encerrando sessão com segurança..."
        subtitle="Conectando escola e família"
      />
    )
  }

  return null
}
