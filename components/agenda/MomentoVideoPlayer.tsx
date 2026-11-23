'use client'

import React, { useState, useEffect, useRef, useId } from 'react'
import { Play, Maximize2, Video as VideoIcon, Loader2, RotateCcw } from 'lucide-react'
import { extractVideoThumbnail } from '@/lib/mediaCompressor'

// Cache em memória durante a sessão para evitar re-extrair thumbnails da mesma URL repetidamente
const videoPosterCache = new Map<string, string>()

const VIDEO_PLAY_EVENT = 'ad:momento-video-play'

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
  const playerId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [effectivePoster, setEffectivePoster] = useState<string | null>(() => {
    if (poster && typeof poster === 'string' && poster.trim()) return poster.trim()
    if (src && videoPosterCache.has(src)) return videoPosterCache.get(src)!
    return null
  })

  const [isNearViewport, setIsNearViewport] = useState(autoPlay)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [hasStarted, setHasStarted] = useState(autoPlay)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Reinicia estados quando a URL do vídeo muda
  useEffect(() => {
    setHasStarted(autoPlay)
    setIsPlaying(autoPlay)
    setIsBuffering(false)
    setHasError(false)
    if (poster && typeof poster === 'string' && poster.trim()) {
      setEffectivePoster(poster.trim())
    } else if (src && videoPosterCache.has(src)) {
      setEffectivePoster(videoPosterCache.get(src)!)
    } else {
      setEffectivePoster(null)
    }
  }, [src, poster, autoPlay])

  // Observa proximidade do viewport para adiar extração de capa e pré-carregamento até o vídeo ficar visível
  useEffect(() => {
    if (isNearViewport) return
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsNearViewport(true)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isNearViewport])

  // Pausa automaticamente este vídeo se outro player ou o Lightbox começar a reproduzir
  useEffect(() => {
    const handleOtherVideoPlay = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail
      if (detail?.id !== playerId && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
      }
    }
    window.addEventListener(VIDEO_PLAY_EVENT, handleOtherVideoPlay)
    return () => window.removeEventListener(VIDEO_PLAY_EVENT, handleOtherVideoPlay)
  }, [playerId])

  // Extrair thumbnail dinâmico apenas quando o card entrar na tela e não houver poster pré-existente
  useEffect(() => {
    if (!isNearViewport) return
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
  }, [src, poster, isNearViewport])

  // Usa #t=0.001 apenas se não houver poster para ajudar Safari/iOS a exibir o primeiro frame sem prejudicar seek
  const videoSrc = (() => {
    if (!src) return ''
    if (effectivePoster || hasStarted || src.includes('#')) return src
    return `${src}#t=0.001`
  })()

  const startPlayback = () => {
    const vid = videoRef.current
    if (!vid) return
    setHasError(false)
    setIsNearViewport(true)
    setHasStarted(true)
    setIsBuffering(true)
    window.dispatchEvent(new CustomEvent(VIDEO_PLAY_EVENT, { detail: { id: playerId } }))
    vid.play().then(() => {
      setIsPlaying(true)
      setIsBuffering(false)
    }).catch((err) => {
      setIsBuffering(false)
      console.warn('[MomentoVideoPlayer] Autoplay bloqueado pelo navegador:', err)
    })
  }

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    startPlayback()
  }

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const vid = videoRef.current
    if (!vid) return
    setHasError(false)
    setIsBuffering(true)
    vid.load()
    startPlayback()
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
    if (onExpand) {
      onExpand()
    }
  }

  // Sem poster prévio, carrega apenas metadados quando visível; com poster, adia rede até clicar em Play
  const preloadMode: 'none' | 'metadata' | 'auto' = hasStarted
    ? 'auto'
    : (isNearViewport && !effectivePoster ? 'metadata' : 'none')

  return (
    <div
      ref={containerRef}
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
      {/* Elemento de Vídeo com lazy-loading nativo, dimensões explícitas e controle de banda */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={isNearViewport && effectivePoster ? effectivePoster : undefined}
        width={1280}
        height={720}
        {...({ loading: autoPlay ? undefined : 'lazy' } as any)}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
          backgroundColor: '#000000',
        }}
        controls={hasStarted && controls}
        controlsList={isProtected ? 'nodownload' : undefined}
        playsInline
        autoPlay={autoPlay}
        preload={preloadMode}
        onPlay={() => {
          window.dispatchEvent(new CustomEvent(VIDEO_PLAY_EVENT, { detail: { id: playerId } }))
          setIsPlaying(true)
          setHasStarted(true)
          setHasError(false)
        }}
        onPlaying={() => {
          setIsPlaying(true)
          setHasStarted(true)
          setIsBuffering(false)
        }}
        onWaiting={() => {
          if (hasStarted) setIsBuffering(true)
        }}
        onCanPlay={() => {
          setIsBuffering(false)
        }}
        onPause={() => {
          setIsPlaying(false)
          setIsBuffering(false)
        }}
        onEnded={() => {
          setIsPlaying(false)
          setHasStarted(false)
          setIsBuffering(false)
        }}
        onError={() => {
          setIsBuffering(false)
          setIsPlaying(false)
          setHasError(true)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!hasStarted) {
            startPlayback()
          }
        }}
      />

      {/* Indicador discreto de buffering durante carregamento da mídia */}
      {hasStarted && isBuffering && !hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 5,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Loader2 size={16} className="animate-spin" color="#a5b4fc" />
            <span>Carregando vídeo...</span>
          </div>
        </div>
      )}

      {/* Recuperação amigável se houver falha de rede durante reprodução */}
      {hasError && (
        <div
          onClick={handleRetryClick}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#f8fafc',
            zIndex: 7,
            cursor: 'pointer',
            padding: 16,
            textAlign: 'center',
          }}
        >
          <RotateCcw size={24} color="#a5b4fc" />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            Não foi possível carregar o vídeo. Toque para tentar novamente.
          </span>
        </div>
      )}

      {/* Camada de Capa / Poster com Botão de Play Central (exibida apenas antes de iniciar ou após finalizar) */}
      {!hasStarted && !hasError && (
        <div
          onClick={handlePlayClick}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: effectivePoster ? 'transparent' : 'rgba(0,0,0,0.3)',
            cursor: 'pointer',
            zIndex: 4,
            transition: 'background 0.2s',
          }}
        >
          {effectivePoster && (
            <img
              src={effectivePoster}
              alt="Capa do Vídeo"
              loading="lazy"
              decoding="async"
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
