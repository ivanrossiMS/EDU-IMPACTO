'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useApp, ModuleTransitionState } from '@/lib/context'

function isRouteMatching(currentPath: string | null, targetHref: string): boolean {
  if (!currentPath || !targetHref) return false
  const cleanTarget = targetHref.split('?')[0].split('#')[0]
  if (currentPath === cleanTarget) return true
  if (cleanTarget !== '/' && currentPath.startsWith(cleanTarget + '/')) return true
  if (cleanTarget === '/dashboard' && (currentPath === '/dashboard' || currentPath.startsWith('/dashboard/'))) return true
  if (cleanTarget === '/login' && currentPath.startsWith('/login')) return true
  return false
}

export function GlobalModuleTransitionOverlay() {
  const pathname = usePathname()
  const { moduleTransition, finishModuleTransition } = useApp()
  const [activeTransition, setActiveTransition] = useState<ModuleTransitionState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const startTimeRef = useRef<number>(0)
  const targetHrefRef = useRef<string>('')
  const sourcePathRef = useRef<string>('')
  const failsafeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Listen to context changes
  useEffect(() => {
    if (moduleTransition) {
      startTimeRef.current = Date.now()
      targetHrefRef.current = moduleTransition.targetHref
      sourcePathRef.current = pathname || ''
      setActiveTransition(moduleTransition)
      setIsLoading(true)
    }
  }, [moduleTransition, pathname])

  // Listen to window custom events for decoupled triggering
  useEffect(() => {
    const handleTransitionStart = (e: any) => {
      const detail = e.detail as ModuleTransitionState | undefined
      if (detail) {
        startTimeRef.current = Date.now()
        targetHrefRef.current = detail.targetHref
        sourcePathRef.current = pathname || ''
        setActiveTransition(detail)
        setIsLoading(true)
      }
    }

    const handleTransitionFinish = () => {
      setIsLoading(false)
    }

    window.addEventListener('edu:module-transition-start', handleTransitionStart)
    window.addEventListener('edu:module-transition-finish', handleTransitionFinish)

    return () => {
      window.removeEventListener('edu:module-transition-start', handleTransitionStart)
      window.removeEventListener('edu:module-transition-finish', handleTransitionFinish)
    }
  }, [pathname])

  // Failsafe timeout: never blocks the user longer than 5 seconds under any circumstance
  useEffect(() => {
    if (isLoading) {
      if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current)
      failsafeTimeoutRef.current = setTimeout(() => {
        setIsLoading(false)
      }, 5000)
    }
    return () => {
      if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current)
    }
  }, [isLoading])

  // Monitor pathname changes to detect when target route has entered
  useEffect(() => {
    if (!isLoading || !targetHrefRef.current) return

    const hasNavigated = pathname !== sourcePathRef.current
    if (hasNavigated && isRouteMatching(pathname, targetHrefRef.current)) {
      setIsLoading(false)
    }
  }, [pathname, isLoading])

  const handleFinished = useCallback(() => {
    setActiveTransition(null)
    targetHrefRef.current = ''
    sourcePathRef.current = ''
    finishModuleTransition()
  }, [finishModuleTransition])

  if (!activeTransition) {
    return null
  }

  return (
    <AgendaLuxuryLoader
      isLoading={isLoading}
      subtitle={activeTransition.subtitle || activeTransition.title.toUpperCase()}
      statusText={activeTransition.statusText || `Acessando ${activeTransition.title}...`}
      minDisplayTimeMs={650}
      onFinished={handleFinished}
    />
  )
}
