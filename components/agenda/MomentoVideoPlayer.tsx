'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Play, Maximize2, Video as VideoIcon, Loader2 } from 'lucide-react'
import { extractVideoThumbnail } from '@/lib/mediaCompressor'

// Cache em memória durante a sessão para evitar re-extrair thumbnails da mesma URL repetidamente
const videoPosterCache = new Map<string, string>()

interface MomentoVideoPlayerProps {
  src: string
  poster?: string | null
  style?: React.CSSProperties
  className?: string
  isProtected?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
  onClick?: (e: React.MouseEvent) => void
  onExpand?: () => void
  objectFit?: 'contain' | 'cover'
  autoPlay?: boolean
  controls?: boolean
  showExpandButton?: boolean
}

export function MomentoVideoPlayer({
  src,
  poster,
  style,
  className,
  isProtected,
  onContextMenu,
  onClick,
  onExpand,
  objectFit = 'contain',
  autoPlay = false,
  controls = true,
  showExpandButton = true,
}: MomentoVideoPlayerProps) {
  const [effectivePoster, setEffectivePoster] = useState<string | null>(() => {
    if (poster && typeof poster === 'string' && poster.trim()) return poster.trim()
    if (src && videoPosterCache.has(src)) return videoPosterCache.get(src)!
    return null
  })

  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [hasStarted, setHasStarted] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Extrair thumbnail dinâmico do vídeo se não houver poster pré-existente
  useEffect(() => {
    if (poster && typeof poster === 'string' && poster.trim()) {
      setEffectivePoster(poster.trim())
      return
    }

    if (!src) return

    if (videoPosterCache.has(src)) {
      setEffectivePoster(videoPosterCache.get(src)!)
      return
    }

    let isMounted = true
    setIsExtracting(true)

    extractVideoThumbnail(src, 0.5)
      .then(({ thumbnailUrl }) => {
        if (!isMounted) return
        if (thumbnailUrl) {
          videoPosterCache.set(src, thumbnailUrl)
          setEffectivePoster(thumbnailUrl)
        }
      })
      .catch((err) => {
        console.warn('[MomentoVideoPlayer] Falha ao extrair capa do vídeo:', err)
      })
      .finally(() => {
        if (isMounted) setIsExtracting(false)
      })

    return () => {
      isMounted = false
    }
  }, [src, poster])

  // Normalizar src com fragmento #t=0.001 para que o decodificador nativo (Safari/Chrome/iOS) não fique preto
  const videoSrc = (() => {
    if (!src) return ''
    if (src.includes('#')) return src
    return `${src}#t=0.001`
  })()

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setIsPlaying(true)
      }).catch((err) => {
        console.warn('[MomentoVideoPlayer] Autoplay bloqueado pelo navegador:', err)
      })
    }
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onExpand) {
      onExpand()
    }
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        overflow: 'hidden',
        userSelect: 'none',
        ...style,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Elemento de Vídeo com poster e preload inteligente */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={effectivePoster || undefined}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
          backgroundColor: '#000000',
        }}
        controls={isPlaying || controls}
        controlsList={isProtected ? 'nodownload' : undefined}
        playsInline
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true)
          setHasStarted(true)
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setHasStarted(false)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isPlaying && videoRef.current) {
            videoRef.current.play().then(() => {
              setIsPlaying(true)
              setHasStarted(true)
            }).catch(() => {})
          }
        }}
      />

      {/* Camada de Capa / Poster com Botão de Play Central quando não estiver reproduzindo */}
      {!isPlaying && (
        <div
          onClick={handlePlayClick}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: effectivePoster && !hasStarted ? 'transparent' : 'rgba(0,0,0,0.3)',
            cursor: 'pointer',
            zIndex: 4,
            transition: 'background 0.2s',
          }}
        >
          {/* Se tiver poster carregado e o vídeo ainda não começou, renderiza imagem de fundo */}
          {effectivePoster && !hasStarted && (
            <img
              src={effectivePoster}
              alt="Capa do Vídeo"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}

          {/* Botão de Play Flutuante Ultra Moderno com Glassmorphism */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.12)'
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.7)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.4)'
            }}
            title="Reproduzir Vídeo"
          >
            <Play size={28} color="#ffffff" fill="#ffffff" style={{ marginLeft: 3 }} />
          </div>

          {/* Badge Indicador de Vídeo no canto inferior esquerdo */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'none',
            }}
          >
            <VideoIcon size={13} color="#a5b4fc" />
            <span>VÍDEO</span>
            {isExtracting && <Loader2 size={11} className="animate-spin" color="#a5b4fc" />}
          </div>
        </div>
      )}

      {/* Botão de Expandir no canto superior direito */}
      {showExpandButton && onExpand && (
        <button
          type="button"
          onClick={handleExpandClick}
          title="Expandir Vídeo"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 6,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.9)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'
          }}
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  )
}
