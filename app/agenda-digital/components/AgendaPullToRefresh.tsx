'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCw, CheckCircle2, ArrowDown } from 'lucide-react'

interface AgendaPullToRefreshProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

const PULL_THRESHOLD = 62
const MAX_PULL_DISTANCE = 108
const REFRESH_HOLD_HEIGHT = 56
const MIN_REFRESH_DURATION_MS = 650

function triggerHaptic(type: 'light' | 'medium' | 'success') {
  if (typeof window === 'undefined') return
  import('@capacitor/haptics')
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

export function AgendaPullToRefresh({ scrollContainerRef }: AgendaPullToRefreshProps) {
  const queryClient = useQueryClient()
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const stateRef = useRef({
    startX: 0,
    startY: 0,
    gestureLock: 'none' as 'none' | 'pull' | 'ignore',
    currentPull: 0,
    crossedThreshold: false,
    isRefreshing: false,
  })

  useEffect(() => {
    stateRef.current.isRefreshing = isRefreshing
  }, [isRefreshing])

  const executeRefresh = useCallback(async () => {
    if (stateRef.current.isRefreshing) return
    stateRef.current.isRefreshing = true
    setIsRefreshing(true)
    setIsCompleted(false)
    setPullDistance(REFRESH_HOLD_HEIGHT)
    triggerHaptic('medium')

    const startTime = Date.now()

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ad:pull-to-refresh'))
        window.dispatchEvent(new CustomEvent('ad:app-foreground'))
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
        queryClient.refetchQueries({ type: 'active' }),
      ])

      const timeoutGuard = new Promise(resolve => setTimeout(resolve, 3500))
      await Promise.race([refreshWork, timeoutGuard])

      const elapsed = Date.now() - startTime
      if (elapsed < MIN_REFRESH_DURATION_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_REFRESH_DURATION_MS - elapsed))
      }

      setIsCompleted(true)
      triggerHaptic('success')
      await new Promise(resolve => setTimeout(resolve, 380))
    } finally {
      setIsRefreshing(false)
      setIsCompleted(false)
      setPullDistance(0)
      stateRef.current.currentPull = 0
      stateRef.current.isRefreshing = false
    }
  }, [queryClient])

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
        setIsPulling(false)
        setPullDistance(0)
        return
      }

      const touch = e.touches[0]
      const deltaX = touch.clientX - stateRef.current.startX
      const deltaY = touch.clientY - stateRef.current.startY

      if (stateRef.current.gestureLock === 'none') {
        if (Math.abs(deltaX) < 9 && Math.abs(deltaY) < 9) {
          return
        }
        // Se o movimento for horizontal, para baixo na página (deltaY < 0) ou se o container já rolou
        if (
          deltaY <= 0 ||
          Math.abs(deltaX) > Math.abs(deltaY) * 0.75 ||
          container.scrollTop > 1
        ) {
          stateRef.current.gestureLock = 'ignore'
          return
        }
        stateRef.current.gestureLock = 'pull'
        setIsPulling(true)
      }

      if (stateRef.current.gestureLock === 'pull') {
        if (container.scrollTop > 1) {
          stateRef.current.gestureLock = 'ignore'
          stateRef.current.currentPull = 0
          setIsPulling(false)
          setPullDistance(0)
          return
        }

        if (deltaY > 0 && e.cancelable) {
          e.preventDefault()
        }

        const effectiveDelta = Math.max(0, deltaY - 8)
        // Curva elástica suave (resistência progressiva)
        const damped = Math.min(
          MAX_PULL_DISTANCE,
          Math.round(MAX_PULL_DISTANCE * (1 - Math.exp(-effectiveDelta / 170)))
        )

        if (!stateRef.current.crossedThreshold && damped >= PULL_THRESHOLD) {
          stateRef.current.crossedThreshold = true
          triggerHaptic('light')
        } else if (stateRef.current.crossedThreshold && damped < PULL_THRESHOLD) {
          stateRef.current.crossedThreshold = false
        }

        stateRef.current.currentPull = damped
        setPullDistance(damped)
      }
    }

    const handleTouchEnd = () => {
      if (stateRef.current.gestureLock !== 'pull') {
        stateRef.current.gestureLock = 'none'
        return
      }

      const finalPull = stateRef.current.currentPull
      stateRef.current.gestureLock = 'none'
      setIsPulling(false)

      if (finalPull >= PULL_THRESHOLD && !stateRef.current.isRefreshing) {
        executeRefresh()
      } else if (!stateRef.current.isRefreshing) {
        stateRef.current.currentPull = 0
        setPullDistance(0)
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
  }, [scrollContainerRef, executeRefresh])

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD)
  const isReadyToRefresh = pullDistance >= PULL_THRESHOLD
  const isVisible = pullDistance > 4 || isRefreshing

  return (
    <div
      aria-live="polite"
      style={{
        height: isVisible ? `${pullDistance}px` : '0px',
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: isPulling ? 'none' : 'height 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        background: 'transparent',
        position: 'relative',
        zIndex: 90,
        flexShrink: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px 6px 8px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isCompleted
            ? '1px solid rgba(16, 185, 129, 0.35)'
            : isReadyToRefresh || isRefreshing
            ? '1px solid rgba(99, 102, 241, 0.35)'
            : '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(99, 102, 241, 0.08)',
          opacity: isRefreshing ? 1 : Math.min(1, Math.max(0, (pullDistance - 10) / 36)),
          transform: `scale(${isRefreshing ? 1 : 0.85 + progress * 0.15})`,
          transition: isPulling
            ? 'border-color 0.2s ease'
            : 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
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
            transition: 'all 0.2s ease',
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
            <ArrowDown
              size={14}
              strokeWidth={2.5}
              style={{
                transform: `rotate(${isReadyToRefresh ? 180 : Math.round(progress * 140)}deg)`,
                transition: isPulling ? 'transform 0.12s ease-out' : 'transform 0.25s ease',
              }}
            />
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes adPullSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `,
        }}
      />
    </div>
  )
}
