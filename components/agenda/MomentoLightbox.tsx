'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ShieldAlert
} from 'lucide-react'
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection'
import { PrivacyProtectionModal } from './PrivacyProtectionModal'

export interface MomentoLightboxMedia {
  url: string
  type?: 'image' | 'video' | string
}

export interface MomentoLightboxProps {
  isOpen: boolean
  onClose: () => void
  media: MomentoLightboxMedia[]
  initialIndex?: number
  author?: string
  description?: string
}

export function MomentoLightbox({
  isOpen,
  onClose,
  media,
  initialIndex = 0,
  author,
  description
}: MomentoLightboxProps) {
  const [mounted, setMounted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Zoom & Pan states
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Proteção contra capturas de tela, gravações e prints
  const {
    isModalOpen: isPrivacyModalOpen,
    closeModal: closePrivacyModal,
    triggerModal: triggerPrivacyModal,
    handleContextMenu,
    handleDragStart
  } = useScreenshotProtection({ enabled: isOpen, autoEnablePrivacyScreen: true })

  // Drag tracking refs
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionStartRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)
  const lastTapRef = useRef<number>(0)
  const initialPinchDistRef = useRef<number | null>(null)
  const initialScaleRef = useRef<number>(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mount handling for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, (media?.length || 1) - 1)))
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen, initialIndex, media?.length])

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  // Reset zoom when active item changes
  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const goToPrev = useCallback(() => {
    if (!media || media.length <= 1) return
    resetZoom()
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : media.length - 1))
  }, [media, resetZoom])

  const goToNext = useCallback(() => {
    if (!media || media.length <= 1) return
    resetZoom()
    setCurrentIndex(prev => (prev < media.length - 1 ? prev + 1 : 0))
  }, [media, resetZoom])

  // Zoom helpers
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(5, Number((prev + 0.5).toFixed(2))))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(2)))
      if (next === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }, [])

  const handleToggleZoom = useCallback(() => {
    if (scale > 1) {
      resetZoom()
    } else {
      setScale(2.5)
      setPosition({ x: 0, y: 0 })
    }
  }, [scale, resetZoom])

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        handleZoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        handleZoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, goToPrev, goToNext, handleZoomIn, handleZoomOut, resetZoom])

  // Current item details
  const currentItem = media && media.length > 0 ? media[currentIndex] : null
  const isVideo = !!currentItem && (currentItem.type === 'video' || !!currentItem.url.match(/\.(mp4|webm|mov)$/i))

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isVideo) return
    e.preventDefault()
    e.stopPropagation()

    const zoomFactor = -e.deltaY * 0.002
    setScale(prev => {
      const next = Math.min(5, Math.max(1, Number((prev + zoomFactor).toFixed(2))))
      if (next === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }, [isVideo])

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isVideo) return
    if (scale <= 1 && e.button !== 0) return
    e.preventDefault()

    setIsDragging(true)
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    positionStartRef.current = { ...position }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true
    }

    // Only allow panning if zoomed in
    if (scale > 1) {
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy
      })
    }
  }, [isDragging, scale])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
    }
  }, [isDragging])

  // Global mouse up / move while dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Touch handlers for mobile (pinch-to-zoom & pan & double-tap)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isVideo) return

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const now = Date.now()
      // Detect double tap
      if (now - lastTapRef.current < 300) {
        handleToggleZoom()
        lastTapRef.current = 0
        return
      }
      lastTapRef.current = now

      setIsDragging(true)
      hasMovedRef.current = false
      dragStartRef.current = { x: touch.clientX, y: touch.clientY }
      positionStartRef.current = { ...position }
    } else if (e.touches.length === 2) {
      // 2 fingers pinch
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      initialPinchDistRef.current = dist
      initialScaleRef.current = scale
      setIsDragging(false)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isVideo) return

    if (e.touches.length === 1 && isDragging && scale > 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - dragStartRef.current.x
      const dy = touch.clientY - dragStartRef.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true
      }
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy
      })
    } else if (e.touches.length === 2 && initialPinchDistRef.current) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      const ratio = currentDist / initialPinchDistRef.current
      const newScale = Math.min(5, Math.max(1, Number((initialScaleRef.current * ratio).toFixed(2))))
      setScale(newScale)
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false)
      initialPinchDistRef.current = null
    } else if (e.touches.length === 1) {
      initialPinchDistRef.current = null
      const touch = e.touches[0]
      dragStartRef.current = { x: touch.clientX, y: touch.clientY }
      positionStartRef.current = { ...position }
    }
  }

  if (!mounted || !isOpen || !currentItem) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999999,
          background: 'rgba(5, 5, 12, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none'
        }}
        onClick={() => {
          // If clicked backdrop without dragging, close
          if (!hasMovedRef.current) {
            onClose()
          }
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            pointerEvents: 'none'
          }}
        >
          {/* Details / Author */}
          <div style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
            {author && (
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                {author}
              </div>
            )}
            {media.length > 1 && (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                Foto {currentIndex + 1} de {media.length}
              </div>
            )}
          </div>

          {/* Action buttons on top right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
            {/* SELO / BOTÃO DE AMBIENTE PROTEGIDO */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                triggerPrivacyModal()
              }}
              title="Informações de Privacidade e Proteção contra Prints"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 40,
                padding: '0 14px',
                borderRadius: 20,
                background: 'rgba(99, 102, 241, 0.22)',
                border: '1px solid rgba(165, 180, 252, 0.35)',
                color: '#e0e7ff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.38)'
                e.currentTarget.style.transform = 'scale(1.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.22)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <ShieldAlert size={16} color="#a5b4fc" />
              <span className="hidden sm:inline">Ambiente Protegido</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              title="Fechar (Esc)"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* NAVIGATION PREV BUTTON */}
        {media.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goToPrev()
            }}
            title="Anterior (Seta Esquerda)"
            style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
            }}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* NAVIGATION NEXT BUTTON */}
        {media.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            title="Próxima (Seta Direita)"
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
            }}
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* MAIN VIEWPORT / MEDIA CONTAINER */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          onDoubleClick={(e) => {
            e.stopPropagation()
            handleToggleZoom()
          }}
          onClick={(e) => {
            // Stop closing backdrop click when interacting directly with media area
            e.stopPropagation()
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: isVideo ? 'default' : scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
        >
          {isVideo ? (
            <video
              src={currentItem.url}
              controls
              controlsList="nodownload"
              autoPlay
              playsInline
              onContextMenu={handleContextMenu}
              style={{
                maxWidth: '92vw',
                maxHeight: '85vh',
                borderRadius: 16,
                boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                outline: 'none',
                zIndex: 2
              }}
            />
          ) : (
            <div
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'center center',
                willChange: 'transform',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: '92vw',
                maxHeight: '82vh',
                zIndex: 2
              }}
            >
              <img
                src={currentItem.url}
                alt={description || 'Momento'}
                draggable={false}
                onDragStart={handleDragStart}
                onContextMenu={handleContextMenu}
                style={{
                  maxWidth: '92vw',
                  maxHeight: '82vh',
                  objectFit: 'contain',
                  borderRadius: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                  pointerEvents: 'none', // Let container receive mouse and touch events
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none'
                }}
              />
            </div>
          )}
        </div>

        {/* FLOATING ZOOM TOOLBAR (Bottom Center) */}
        {!isVideo && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: media.length > 1 ? 70 : 32,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 30,
              background: 'rgba(15, 23, 42, 0.82)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.2)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              zIndex: 10,
              transition: 'all 0.2s ease'
            }}
          >
            {/* Zoom Out */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              title="Reduzir zoom (-)"
              style={{
                background: 'none',
                border: 'none',
                color: scale <= 1 ? 'rgba(255,255,255,0.25)' : '#fff',
                padding: 6,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: scale <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (scale > 1) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
              }}
            >
              <ZoomOut size={18} />
            </button>

            {/* Percentage Display & quick toggle */}
            <button
              onClick={handleToggleZoom}
              title="Clique para alternar zoom (100% / 250%)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                minWidth: 54,
                textAlign: 'center',
                transition: 'all 0.15s ease',
                fontVariantNumeric: 'tabular-nums'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              {Math.round(scale * 100)}%
            </button>

            {/* Zoom In */}
            <button
              onClick={handleZoomIn}
              disabled={scale >= 5}
              title="Aumentar zoom (+)"
              style={{
                background: 'none',
                border: 'none',
                color: scale >= 5 ? 'rgba(255,255,255,0.25)' : '#fff',
                padding: 6,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: scale >= 5 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (scale < 5) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
              }}
            >
              <ZoomIn size={18} />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

            {/* Reset */}
            <button
              onClick={resetZoom}
              disabled={scale === 1 && position.x === 0 && position.y === 0}
              title="Redefinir tamanho original (0)"
              style={{
                background: 'none',
                border: 'none',
                color: scale === 1 && position.x === 0 && position.y === 0 ? 'rgba(255,255,255,0.25)' : '#38bdf8',
                padding: 6,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: scale === 1 && position.x === 0 && position.y === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (scale !== 1 || position.x !== 0 || position.y !== 0) {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        )}

        {/* DOTS PAGINATION (Bottom) */}
        {media.length > 1 && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 24,
              display: 'flex',
              gap: 8,
              zIndex: 10,
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            {media.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  resetZoom()
                  setCurrentIndex(idx)
                }}
                title={`Ir para foto ${idx + 1}`}
                style={{
                  width: idx === currentIndex ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: idx === currentIndex ? '#6366f1' : 'rgba(255,255,255,0.3)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: idx === currentIndex ? '0 0 10px rgba(99,102,241,0.6)' : 'none'
                }}
              />
            ))}
          </div>
        )}

        {/* MODAL ULTRA MODERNO DE PRIVACIDADE CONTRA PRINTS */}
        <PrivacyProtectionModal
          isOpen={isPrivacyModalOpen}
          onClose={closePrivacyModal}
        />
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
