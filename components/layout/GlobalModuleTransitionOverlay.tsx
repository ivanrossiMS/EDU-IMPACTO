'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useIsFetching } from '@tanstack/react-query'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useApp, ModuleTransitionState } from '@/lib/context'
import {
  ensureFetchTrackerInstalled,
  subscribeToNetworkActivity,
  getActiveApiRequestsCount,
  getLastApiRequestEndTime,
  isIntermediateRedirectRoute,
  isMainContentStillLoading,
  setGlobalNavOverlayActive,
} from '@/lib/navigation/pageReadiness'

function isRouteMatching(currentPath: string | null, targetHref: string): boolean {
  if (!currentPath || !targetHref) return false
  const cleanTarget = targetHref.split('?')[0].split('#')[0]
  if (currentPath === cleanTarget) return true
  if (cleanTarget !== '/' && currentPath.startsWith(cleanTarget + '/')) return true
  if (cleanTarget === '/dashboard' && (currentPath === '/dashboard' || currentPath.startsWith('/dashboard/'))) return true
  if (cleanTarget === '/login' && currentPath.startsWith('/login')) return true
  return false
}

const MAX_WAIT_ROUTE_CHANGE_MS = 18000
const MAX_WAIT_AFTER_ROUTE_ENTER_MS = 8000
const MIN_SETTLE_AFTER_ENTER_MS = 240
const NETWORK_QUIET_WINDOW_MS = 160

export function GlobalModuleTransitionOverlay() {
  const pathname = usePathname()
  const isFetchingReactQuery = useIsFetching()
  const { moduleTransition, finishModuleTransition } = useApp()
  const [activeTransition, setActiveTransition] = useState<ModuleTransitionState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const startTimeRef = useRef<number>(0)
  const targetHrefRef = useRef<string>('')
  const sourcePathRef = useRef<string>('')
  const hasRouteEnteredRef = useRef<boolean>(false)
  const routeEnteredAtRef = useRef<number>(0)
  const lastObservedPathRef = useRef<string>('')
  const isFetchingRef = useRef<number>(isFetchingReactQuery)
  isFetchingRef.current = isFetchingReactQuery

  useEffect(() => {
    ensureFetchTrackerInstalled()
  }, [])

  useEffect(() => {
    setGlobalNavOverlayActive(Boolean(activeTransition && isLoading))
  }, [activeTransition, isLoading])

  // Listen to context changes
  useEffect(() => {
    if (moduleTransition) {
      startTimeRef.current = Date.now()
      targetHrefRef.current = moduleTransition.targetHref
      sourcePathRef.current = pathname || ''
      lastObservedPathRef.current = pathname || ''
      hasRouteEnteredRef.current = false
      routeEnteredAtRef.current = 0
      setActiveTransition(moduleTransition)
      setIsLoading(true)
      setGlobalNavOverlayActive(true)
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
        lastObservedPathRef.current = pathname || ''
        hasRouteEnteredRef.current = false
        routeEnteredAtRef.current = 0
        setActiveTransition(detail)
        setIsLoading(true)
        setGlobalNavOverlayActive(true)
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

  // Monitor pathname changes to detect when target route has entered
  useEffect(() => {
    if (!isLoading || !targetHrefRef.current) return

    const hasNavigated = pathname !== sourcePathRef.current
    if (hasNavigated && isRouteMatching(pathname, targetHrefRef.current)) {
      if (isIntermediateRedirectRoute(pathname)) {
        lastObservedPathRef.current = pathname || ''
        return
      }
      if (!hasRouteEnteredRef.current || pathname !== lastObservedPathRef.current) {
        hasRouteEnteredRef.current = true
        routeEnteredAtRef.current = Date.now()
        lastObservedPathRef.current = pathname || ''
      }
    }
  }, [pathname, isLoading])

  // Wait for full page readiness (APIs + React Query + DOM skeletons/spinners) after target route enters
  useEffect(() => {
    if (!isLoading) return

    const evaluateReadiness = () => {
      const now = Date.now()
      const totalElapsed = now - startTimeRef.current

      if (totalElapsed >= MAX_WAIT_ROUTE_CHANGE_MS) {
        setIsLoading(false)
        return
      }

      if (!hasRouteEnteredRef.current) {
        return
      }

      const elapsedSinceEnter = now - routeEnteredAtRef.current
      if (elapsedSinceEnter < MIN_SETTLE_AFTER_ENTER_MS) {
        return
      }

      if (elapsedSinceEnter >= MAX_WAIT_AFTER_ROUTE_ENTER_MS) {
        setIsLoading(false)
        return
      }

      if (getActiveApiRequestsCount() > 0 || isFetchingRef.current > 0) {
        return
      }

      const timeSinceLastApi = now - getLastApiRequestEndTime()
      if (getLastApiRequestEndTime() > startTimeRef.current && timeSinceLastApi < NETWORK_QUIET_WINDOW_MS) {
        return
      }

      if (isMainContentStillLoading()) {
        return
      }

      setIsLoading(false)
    }

    const unsubscribe = subscribeToNetworkActivity(evaluateReadiness)
    const interval = setInterval(evaluateReadiness, 60)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [isLoading])

  const handleFinished = useCallback(() => {
    setActiveTransition(null)
    setGlobalNavOverlayActive(false)
    targetHrefRef.current = ''
    sourcePathRef.current = ''
    lastObservedPathRef.current = ''
    hasRouteEnteredRef.current = false
    routeEnteredAtRef.current = 0
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
      maxDisplayTimeMs={MAX_WAIT_ROUTE_CHANGE_MS}
      onFinished={handleFinished}
    />
  )
}
