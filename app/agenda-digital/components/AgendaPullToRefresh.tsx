'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCw, CheckCircle2, ArrowDown } from 'lucide-react'

interface AgendaPullToRefreshProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

const PULL_THRESHOLD = 62
const MAX_PULL_DISTANCE = 108
const REFRESH_HOLD_Y = 14
const MIN_REFRESH_DURATION_MS = 600

const PULL_REFRESH_STYLES = `
  @keyframes adPullSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`

let hapticsModulePromise: Promise<typeof import('@capacitor/haptics')> | null = null
function triggerHaptic(type: 'light' | 'medium' | 'success') {
  if (typeof window === 'undefined') return
  if (!hapticsModulePromise) {
    hapticsModulePromise = import('@capacitor/haptics')
  }
  hapticsModulePromise
    .then(({ Haptics, ImpactStyle, NotificationType }) => {
      if (type === 'success') {
        Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      } else {
        Haptics.impact({
          style: type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
        }).catch(() => {})
      }
    })
    .catch(() => {})
}

type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'completed'

export function AgendaPullToRefresh({ scrollContainerRef }: AgendaPullToRefreshProps) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<PullPhase>('idle')

  const pillRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const phaseRef = useRef<PullPhase>('idle')
  phaseRef.current = phase

  const stateRef = useRef({
    startX: 0,
    startY: 0,
    gestureLock: 'none' as 'none' | 'pull' | 'ignore',
    currentPull: 0,
    crossedThreshold: false,
    isRefreshing: false,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const applyPillTransform = useCallback((damped: number, animated: boolean) => {
    const pill = pillRef.current
    if (!pill) return
    pill.style.transition = animated
      ? 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease'
      : 'none'
    if (damped <= 4) {
      pill.style.opacity = '0'
      pill.style.transform = 'translate3d(0, -44px, 0) scale(0.88)'
      return
    }
    const progress = Math.min(1, damped / PULL_THRESHOLD)
    const opacity = Math.min(1, Math.max(0, (damped - 8) / 34))
    const translateY = Math.round(damped * 0.65 - 32)
    const scale = (0.88 + progress * 0.12).toFixed(3)
    pill.style.opacity = String(opacity)
    pill.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`

    const arrow = arrowRef.current
    if (arrow) {
      arrow.style.transform = `rotate(${damped >= PULL_THRESHOLD ? 180 : Math.round(progress * 140)}deg)`
    }
  }, [])

  const executeRefresh = useCallback(async () => {
    if (stateRef.current.isRefreshing) return
    stateRef.current.isRefreshing = true
    setPhase('refreshing')
    if (pillRef.current) {
      pillRef.current.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease'
      pillRef.current.style.opacity = '1'
      pillRef.current.style.transform = `translate3d(0, ${REFRESH_HOLD_Y}px, 0) scale(1)`
    }
    triggerHaptic('medium')

    const startTime = Date.now()

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ad:pull-to-refresh'))
      }

      const refreshWork = Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['agenda'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['frequencias-aluno'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['portaria-eventos-aluno'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['saida-calls-aluno'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['boletins'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['ocorrencias'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['ocorrencias-familia'], refetchType: 'active' }),
      ])

      const timeoutGuard = new Promise(resolve => setTimeout(resolve, 3500))
      await Promise.race([refreshWork, timeoutGuard])

      const elapsed = Date.now() - startTime
      if (elapsed < MIN_REFRESH_DURATION_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_REFRESH_DURATION_MS - elapsed))
      }

      if (!mountedRef.current) return
      setPhase('completed')
      triggerHaptic('success')
      await new Promise(resolve => setTimeout(resolve, 360))
    } finally {
      stateRef.current.currentPull = 0
      stateRef.current.isRefreshing = false
      if (mountedRef.current) {
        setPhase('idle')
        applyPillTransform(0, true)
      }
    }
  }, [queryClient, applyPillTransform])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const canStartPullFromTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      if (!container.contains(target)) return false
      if (document.body.style.overflow === 'hidden') return false

      let el: HTMLElement | null = target
      while (el && el !== container) {
        if (
          el.getAttribute('role') === 'dialog' ||
          el.getAttribute('data-no-pull-refresh') === 'true' ||
          el.classList.contains('ad-modal-container')
        ) {
          return false
        }
        if (el.scrollTop > 0) {
          return false
        }
        el = el.parentElement
      }
      return true
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (stateRef.current.isRefreshing || e.touches.length !== 1) {
        stateRef.current.gestureLock = 'ignore'
        return
      }

      if (container.scrollTop > 1 || !canStartPullFromTarget(e.target)) {
        stateRef.current.gestureLock = 'ignore'
        return
      }

      const touch = e.touches[0]
      stateRef.current.startX = touch.clientX
      stateRef.current.startY = touch.clientY
      stateRef.current.gestureLock = 'none'
      stateRef.current.currentPull = 0
      stateRef.current.crossedThreshold = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (stateRef.current.isRefreshing || stateRef.current.gestureLock === 'ignore') {
        return
      }

      if (e.touches.length !== 1) {
        stateRef.current.gestureLock = 'ignore'
        applyPillTransform(0, true)
        if (phaseRef.current !== 'idle') setPhase('idle')
        return
      }

      const touch = e.touches[0]
      const deltaX = touch.clientX - stateRef.current.startX
      const deltaY = touch.clientY - stateRef.current.startY

      if (stateRef.current.gestureLock === 'none') {
        if (Math.abs(deltaX) < 9 && Math.abs(deltaY) < 9) {
          return
        }
        if (
          deltaY <= 0 ||
          Math.abs(deltaX) > Math.abs(deltaY) * 0.75 ||
          container.scrollTop > 1
        ) {
          stateRef.current.gestureLock = 'ignore'
          return
        }
        stateRef.current.gestureLock = 'pull'
        setPhase('pulling')
      }

      if (stateRef.current.gestureLock === 'pull') {
        if (container.scrollTop > 1) {
          stateRef.current.gestureLock = 'ignore'
          stateRef.current.currentPull = 0
          applyPillTransform(0, true)
          setPhase('idle')
          return
        }

        if (deltaY > 0 && e.cancelable) {
          e.preventDefault()
        }

        const effectiveDelta = Math.max(0, deltaY - 8)
        const damped = Math.min(
          MAX_PULL_DISTANCE,
          Math.round(MAX_PULL_DISTANCE * (1 - Math.exp(-effectiveDelta / 170)))
        )

        if (!stateRef.current.crossedThreshold && damped >= PULL_THRESHOLD) {
          stateRef.current.crossedThreshold = true
          triggerHaptic('light')
          setPhase('ready')
        } else if (stateRef.current.crossedThreshold && damped < PULL_THRESHOLD) {
          stateRef.current.crossedThreshold = false
          setPhase('pulling')
        }

        stateRef.current.currentPull = damped
        applyPillTransform(damped, false)
      }
    }

    const handleTouchEnd = () => {
      if (stateRef.current.gestureLock !== 'pull') {
        stateRef.current.gestureLock = 'none'
        return
      }

      const finalPull = stateRef.current.currentPull
      stateRef.current.gestureLock = 'none'

      if (finalPull >= PULL_THRESHOLD && !stateRef.current.isRefreshing) {
        executeRefresh()
      } else if (!stateRef.current.isRefreshing) {
        stateRef.current.currentPull = 0
        applyPillTransform(0, true)
        setPhase('idle')
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [scrollContainerRef, executeRefresh, applyPillTransform])

  const isCompleted = phase === 'completed'
  const isRefreshing = phase === 'refreshing'
  const isReadyToRefresh = phase === 'ready'

  return (
    <div
      aria-live="polite"
      style={{
        height: 0,
        overflow: 'visible',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        position: 'sticky',
        top: 6,
        zIndex: 90,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        ref={pillRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px 6px 8px',
          borderRadius: 999,
          background: '#ffffff',
          border: isCompleted
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : isReadyToRefresh || isRefreshing
            ? '1px solid rgba(99, 102, 241, 0.4)'
            : '1px solid rgba(226, 232, 240, 0.95)',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.14)',
          opacity: 0,
          transform: 'translate3d(0, -44px, 0) scale(0.88)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isCompleted
              ? 'rgba(16, 185, 129, 0.14)'
              : isReadyToRefresh || isRefreshing
              ? 'rgba(99, 102, 241, 0.14)'
              : 'rgba(148, 163, 184, 0.14)',
            color: isCompleted
              ? '#059669'
              : isReadyToRefresh || isRefreshing
              ? 'var(--ad-accent-primary, #4f46e5)'
              : '#64748b',
            flexShrink: 0,
          }}
        >
          {isCompleted ? (
            <CheckCircle2 size={15} strokeWidth={2.5} />
          ) : isRefreshing ? (
            <RotateCw
              size={14}
              strokeWidth={2.5}
              style={{ animation: 'adPullSpin 0.75s linear infinite' }}
            />
          ) : (
            <div ref={arrowRef} style={{ display: 'flex', transition: 'transform 0.12s ease-out' }}>
              <ArrowDown size={14} strokeWidth={2.5} />
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: isCompleted
              ? '#065f46'
              : isReadyToRefresh || isRefreshing
              ? '#1e1b4b'
              : '#475569',
            whiteSpace: 'nowrap',
          }}
        >
          {isCompleted
            ? 'Agenda atualizada!'
            : isRefreshing
            ? 'Atualizando agenda...'
            : isReadyToRefresh
            ? 'Solte para atualizar'
            : 'Puxe para atualizar'}
        </span>
      </div>
      <style dangerouslySetInnerHTML={{ __html: PULL_REFRESH_STYLES }} />
    </div>
  )
}
