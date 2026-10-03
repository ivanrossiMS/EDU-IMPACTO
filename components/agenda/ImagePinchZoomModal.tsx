'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, RotateCcw, ZoomIn } from 'lucide-react'
import Portal from '@/components/Portal'
import { triggerHaptic } from '@/lib/utils/haptics'

interface ImagePinchZoomModalProps {
  src: string
  alt?: string
  onClose: () => void
}

export function ImagePinchZoomModal({ src, alt = 'Anexo', onClose }: ImagePinchZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState(false)
  const [showHint, setShowHint] = useState(true)

  // Refs for high-performance gesture tracking without react render lag
  const scaleRef = useRef(1)
  const posRef = useRef({ x: 0, y: 0 })
  const isPinching = useRef(false)
  const isPanning = useRef(false)
  const initialPinchDist = useRef(0)
  const initialPinchScale = useRef(1)
  const startPanPos = useRef({ x: 0, y: 0 })
  const initialPanOffset = useRef({ x: 0, y: 0 })
  const lastTapTime = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-hide gesture hint after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHint(false)
    }, 3200)
    return () => clearTimeout(timer)
  }, [])

  // Lock scroll on background
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
    triggerHaptic('impactLight')
    if (scaleRef.current > 1.2) {
      scaleRef.current = 1
      posRef.current = { x: 0, y: 0 }
      setScale(1)
      setPosition({ x: 0, y: 0 })
    } else {
      const targetScale = 2.5
      const midX = window.innerWidth / 2
      const midY = window.innerHeight / 2
      const offsetX = (midX - clientX) * 1.2
      const offsetY = (midY - clientY) * 1.2

      const maxPanX = (window.innerWidth * (targetScale - 1)) / 2
      const maxPanY = (window.innerHeight * (targetScale - 1)) / 2
      const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offsetX))
      const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offsetY))

      scaleRef.current = targetScale
      posRef.current = { x: clampedX, y: clampedY }
      setScale(targetScale)
      setPosition({ x: clampedX, y: clampedY })
    }
  }, [])

  // Touch listener registration with { passive: false } for robust preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        isPinching.current = true
        isPanning.current = false
        setIsInteracting(true)
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        initialPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        initialPinchScale.current = scaleRef.current
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        const now = Date.now()
        if (now - lastTapTime.current < 300) {
          e.preventDefault()
          handleDoubleTap(t.clientX, t.clientY)
          lastTapTime.current = 0
          return
        }
        lastTapTime.current = now

        if (scaleRef.current > 1) {
          isPanning.current = true
          setIsInteracting(true)
          startPanPos.current = { x: t.clientX, y: t.clientY }
          initialPanOffset.current = { ...posRef.current }
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (isPinching.current && e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        if (initialPinchDist.current > 0) {
          const factor = dist / initialPinchDist.current
          let newScale = initialPinchScale.current * factor
          // Elastic resistance beyond 1-5x bounds
          if (newScale < 1) newScale = 1 - (1 - newScale) * 0.35
          if (newScale > 5) newScale = 5 + (newScale - 5) * 0.3
          newScale = Math.max(0.7, Math.min(newScale, 5.5))

          scaleRef.current = newScale
          setScale(newScale)
        }
      } else if (isPanning.current && e.touches.length === 1) {
        e.preventDefault()
        const t = e.touches[0]
        const dx = t.clientX - startPanPos.current.x
        const dy = t.clientY - startPanPos.current.y
        const newX = initialPanOffset.current.x + dx
        const newY = initialPanOffset.current.y + dy

        posRef.current = { x: newX, y: newY }
        setPosition({ x: newX, y: newY })
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching.current = false
      }
      if (e.touches.length === 0) {
        isPanning.current = false
        setIsInteracting(false)

        let targetScale = scaleRef.current
        if (targetScale < 1.05) {
          targetScale = 1
          posRef.current = { x: 0, y: 0 }
          setPosition({ x: 0, y: 0 })
        } else if (targetScale > 5) {
          targetScale = 5
        }

        if (targetScale > 1) {
          const maxPanX = (window.innerWidth * (targetScale - 1)) / 2
          const maxPanY = (window.innerHeight * (targetScale - 1)) / 2
          const clampedX = Math.max(-maxPanX, Math.min(maxPanX, posRef.current.x))
          const clampedY = Math.max(-maxPanY, Math.min(maxPanY, posRef.current.y))
          posRef.current = { x: clampedX, y: clampedY }
          setPosition({ x: clampedX, y: clampedY })
        }

        scaleRef.current = targetScale
        setScale(targetScale)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * -0.005
      let newScale = scaleRef.current + delta
      newScale = Math.max(1, Math.min(newScale, 5))

      scaleRef.current = newScale
      setScale(newScale)

      if (newScale === 1) {
        posRef.current = { x: 0, y: 0 }
        setPosition({ x: 0, y: 0 })
      } else {
        const maxPanX = (window.innerWidth * (newScale - 1)) / 2
        const maxPanY = (window.innerHeight * (newScale - 1)) / 2
        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, posRef.current.x))
        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, posRef.current.y))
        posRef.current = { x: clampedX, y: clampedY }
        setPosition({ x: clampedX, y: clampedY })
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [handleDoubleTap])

  // Mouse drag for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault()
      isPanning.current = true
      setIsInteracting(true)
      startPanPos.current = { x: e.clientX, y: e.clientY }
      initialPanOffset.current = { ...posRef.current }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      e.preventDefault()
      const dx = e.clientX - startPanPos.current.x
      const dy = e.clientY - startPanPos.current.y
      const newX = initialPanOffset.current.x + dx
      const newY = initialPanOffset.current.y + dy
      posRef.current = { x: newX, y: newY }
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false
      setIsInteracting(false)
      if (scaleRef.current > 1) {
        const maxPanX = (window.innerWidth * (scaleRef.current - 1)) / 2
        const maxPanY = (window.innerHeight * (scaleRef.current - 1)) / 2
        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, posRef.current.x))
        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, posRef.current.y))
        posRef.current = { x: clampedX, y: clampedY }
        setPosition({ x: clampedX, y: clampedY })
      }
    }
  }

  const zoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    triggerHaptic('selection')
    const newScale = Math.min(scaleRef.current + 0.6, 5)
    scaleRef.current = newScale
    setScale(newScale)
  }

  const zoomOut = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    triggerHaptic('selection')
    const newScale = Math.max(scaleRef.current - 0.6, 1)
    scaleRef.current = newScale
    setScale(newScale)
    if (newScale === 1) {
      posRef.current = { x: 0, y: 0 }
      setPosition({ x: 0, y: 0 })
    }
  }

  const resetZoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    triggerHaptic('impactLight')
    scaleRef.current = 1
    posRef.current = { x: 0, y: 0 }
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current && scale <= 1.05) {
      onClose()
    }
  }

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 20, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          overflow: 'hidden'
        }}
        onClick={handleBackdropClick}
      >
        {/* Top Header Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100002,
          pointerEvents: 'none'
        }}>
          {/* Helper hint or badge */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto'
                }}
              >
                <ZoomIn size={13} color="#818cf8" />
                <span>Faça pinça com 2 dedos ou toque duplo</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ flex: 1 }} />

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Fechar visualização"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'auto'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'
              e.currentTarget.style.borderColor = '#ffffff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Interactive Gesture Container */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: scale > 1 ? (isInteracting ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
              transition: isInteracting ? 'none' : 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transformOrigin: 'center center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              willChange: 'transform'
            }}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{
                maxWidth: '92vw',
                maxHeight: '84vh',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 24px 70px -10px rgba(0, 0, 0, 0.7)',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
            />
          </div>
        </div>

        {/* Floating Zoom Controls Bar */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          zIndex: 100002,
          color: '#ffffff'
        }}>
          {/* Zoom Out Button */}
          <button
            onClick={zoomOut}
            disabled={scale <= 1}
            title="Diminuir Zoom"
            aria-label="Diminuir Zoom"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: scale <= 1 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: scale <= 1 ? 'rgba(255, 255, 255, 0.35)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scale <= 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Minus size={16} />
          </button>

          {/* Current Scale Display / Reset Button */}
          <button
            onClick={resetZoom}
            title="Redefinir escala"
            aria-label="Redefinir escala"
            style={{
              minWidth: 54,
              height: 32,
              padding: '0 8px',
              borderRadius: 16,
              background: scale > 1 ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'rgba(255, 255, 255, 0.1)',
              border: scale > 1 ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.02em'
            }}
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In Button */}
          <button
            onClick={zoomIn}
            disabled={scale >= 5}
            title="Aumentar Zoom"
            aria-label="Aumentar Zoom"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: scale >= 5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: scale >= 5 ? 'rgba(255, 255, 255, 0.35)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scale >= 5 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Plus size={16} />
          </button>

          {/* Reset Icon Button (visible when zoomed) */}
          {scale > 1 && (
            <button
              onClick={resetZoom}
              title="Ajustar à tela"
              aria-label="Ajustar à tela"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </motion.div>
    </Portal>
  )
}
