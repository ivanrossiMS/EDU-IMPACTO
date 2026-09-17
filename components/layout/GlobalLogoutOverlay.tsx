'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'
import { useApp } from '@/lib/context'
import { useIsMobileVersion } from '@/lib/utils/isMobileVersion'

export function GlobalLogoutOverlay() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isCleanupDone, setIsCleanupDone] = useState(false)
  const { loadingPath, setLoadingPath } = useApp()
  const isNavigatingRef = useRef(false)
  const isMobile = useIsMobileVersion()

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

  // Fallback de segurança: se o cleanup demorar mais de 1.8s, libera a transição
  useEffect(() => {
    if (isLoggingOut && !isCleanupDone) {
      const timeout = setTimeout(() => {
        setIsCleanupDone(true)
      }, 1800)
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

  // No desktop: assim que o cleanup for concluído, redireciona imediatamente
  useEffect(() => {
    if (!isMobile && (isLoggingOut || loadingPath === 'logout') && isCleanupDone) {
      handleLogoutFinished()
    }
  }, [isMobile, isLoggingOut, loadingPath, isCleanupDone, handleLogoutFinished])

  const isActive = isLoggingOut || loadingPath === 'logout'

  if (!isActive) {
    return null
  }

  // Versão Mobile (Capacitor iOS/Android ou PWA):
  // Exibe a tela de carregamento do app com transição suave
  if (isMobile) {
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

  // Versão Desktop:
  // Overlay protetor instantâneo em tela cheia (#0A0F24) com spinner moderno e sutil.
  // Garante que o usuário nunca visualize desmonte de layout, sidebars isoladas ou spinners de página.
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#0A0F24',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        animation: 'eduFadeIn 0.15s ease-out forwards',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: '3px solid rgba(255, 255, 255, 0.12)',
          borderTopColor: '#3b82f6',
          animation: 'eduSpin 0.75s linear infinite',
        }}
      />
      <div
        style={{
          color: '#e2e8f0',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '0.01em',
        }}
      >
        Encerrando sessão com segurança...
      </div>
      <style>{`
        @keyframes eduSpin { 100% { transform: rotate(360deg); } }
        @keyframes eduFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
