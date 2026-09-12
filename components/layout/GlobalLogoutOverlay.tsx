'use client'

import React, { useEffect, useState } from 'react'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'
import { useApp } from '@/lib/context'

export function GlobalLogoutOverlay() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { loadingPath } = useApp()

  useEffect(() => {
    const handleLogout = () => {
      setIsLoggingOut(true)
    }
    window.addEventListener('edu:logout-start', handleLogout)
    return () => {
      window.removeEventListener('edu:logout-start', handleLogout)
    }
  }, [])

  if (isLoggingOut || loadingPath === 'logout') {
    return (
      <AppLoadingScreen
        statusText="Encerrando sessão com segurança..."
        subtitle="Conectando escola e família"
      />
    )
  }

  return null
}
