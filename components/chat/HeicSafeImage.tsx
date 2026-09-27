'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Image as ImageIcon, Loader2, Download } from 'lucide-react'

interface HeicSafeImageProps {
  src: string
  alt?: string
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
}

export function HeicSafeImage({
  src,
  alt = 'Foto',
  style,
  className,
  onClick
}: HeicSafeImageProps) {
  const isHeic = /\.(heic|heif)(\?|$)/i.test(src)
  const [useFallbackDirectSrc, setUseFallbackDirectSrc] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const imgRef = useRef<HTMLImageElement>(null)

  const resolvedSrc = isHeic && !useFallbackDirectSrc
    ? `/api/chat/media/preview?url=${encodeURIComponent(src)}`
    : src

  useEffect(() => {
    setHasError(false)
    setIsLoading(true)
    setUseFallbackDirectSrc(false)
  }, [src])

  // Checagem imediata caso a imagem já esteja no cache do navegador ou já tenha completado o decode
  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    if (img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoading(false)
        setHasError(false)
      } else {
        if (isHeic && !useFallbackDirectSrc) {
          setUseFallbackDirectSrc(true)
        } else {
          setIsLoading(false)
          setHasError(true)
        }
      }
    }
  }, [resolvedSrc, isHeic, useFallbackDirectSrc])

  // Timeout de segurança: nunca deixa o usuário preso em "Carregando imagem..."
  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => {
      if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
        setIsLoading(false)
      } else if (isHeic && !useFallbackDirectSrc) {
        // Tenta fallback direto (ex: Safari nativo suporta HEIC)
        setUseFallbackDirectSrc(true)
      } else {
        // Revela a imagem mesmo assim para o navegador tentar renderizar diretamente
        setIsLoading(false)
      }
    }, 6000)
    return () => clearTimeout(timer)
  }, [isLoading, isHeic, useFallbackDirectSrc])

  if (hasError) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: 10, 
          padding: '10px 14px', 
          background: '#f8fafc', 
          borderRadius: 8, 
          border: '1px solid #e2e8f0',
          color: '#0f172a',
          margin: '4px 0',
          cursor: onClick ? 'pointer' : 'default'
        }}
        className={className}
        onClick={onClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImageIcon size={20} color="#059669" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{alt || 'Foto (Anexo)'}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Clique para visualizar e salvar</div>
          </div>
        </div>
        <Download size={16} color="#64748b" />
      </div>
    )
  }

  return (
    <div 
      style={{ 
        position: 'relative', 
        display: 'block', 
        width: '100%', 
        overflow: 'hidden',
        borderRadius: (style?.borderRadius as any) || 8 
      }}
    >
      {isLoading && (
        <div 
          style={{ 
            ...style, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#f1f5f9', 
            minHeight: 180, 
            color: '#64748b', 
            fontSize: 12, 
            gap: 8,
            borderRadius: (style?.borderRadius as any) || 8
          }}
          className={className}
        >
          <Loader2 size={20} className="animate-spin" color="#059669" />
          <span style={{ fontWeight: 600 }}>Carregando imagem...</span>
        </div>
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        style={{
          ...style,
          display: style?.display || 'block',
          position: isLoading ? 'absolute' : 'relative',
          top: isLoading ? 0 : undefined,
          left: isLoading ? 0 : undefined,
          opacity: isLoading ? 0 : 1,
          pointerEvents: isLoading ? 'none' : (style?.pointerEvents as any || 'auto'),
          transition: 'opacity 0.2s ease-in-out'
        }}
        className={className}
        onClick={onClick}
        onLoad={() => {
          setIsLoading(false)
          setHasError(false)
        }}
        onError={() => {
          if (isHeic && !useFallbackDirectSrc) {
            setUseFallbackDirectSrc(true)
          } else {
            setIsLoading(false)
            setHasError(true)
          }
        }}
      />
    </div>
  )
}
