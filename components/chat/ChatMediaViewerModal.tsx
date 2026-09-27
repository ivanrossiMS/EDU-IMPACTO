'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileText, Image as ImageIcon, Video as VideoIcon, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { HeicSafeImage } from './HeicSafeImage'
import { formatFileSize } from '@/lib/mediaCompressor'

export interface ChatMediaItem {
  type: 'image' | 'video' | 'pdf' | 'file'
  url: string
  fileName: string
  fileSize?: number
}

interface ChatMediaViewerModalProps {
  media: ChatMediaItem | null
  onClose: () => void
}

/**
 * Função utilitária para forçar o download seguro do arquivo no dispositivo do usuário
 */
export async function downloadMediaFile(url: string, fileName: string) {
  try {
    toast.loading('Salvando arquivo...', { id: 'download-media' })
    const isHeic = /\.(heic|heif)(\?|$)/i.test(url)
    const targetUrl = isHeic ? `/api/chat/media/preview?url=${encodeURIComponent(url)}` : url
    const targetFileName = isHeic ? fileName.replace(/\.(heic|heif)$/i, '.jpg') : (fileName || 'arquivo')

    const res = await fetch(targetUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = targetFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    toast.success('Arquivo salvo com sucesso!', { id: 'download-media' })
  } catch {
    // Fallback: abre diretamente no navegador com atributo download
    toast.dismiss('download-media')
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'arquivo'
    a.target = '_blank'
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

export function ChatMediaViewerModal({ media, onClose }: ChatMediaViewerModalProps) {
  useEffect(() => {
    if (!media) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [media, onClose])

  if (!media) return null

  const isPdf = media.type === 'pdf' || /\.pdf(\?|$)/i.test(media.url) || media.fileName.toLowerCase().endsWith('.pdf')
  const isVideo = media.type === 'video' || /\.(mov|mp4|webm|m4v|3gp|mkv)(\?|$)/i.test(media.url)
  const isImage = !isPdf && !isVideo && (media.type === 'image' || /\.(jpg|jpeg|png|webp|heic|heif|gif)(\?|$)/i.test(media.url))

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120000,
          background: 'rgba(11, 20, 26, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 0
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* Barra Superior com Título, Botão de Download e Fechar */}
        <div
          style={{
            width: '100%',
            height: 60,
            background: 'rgba(15, 23, 42, 0.75)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            color: '#ffffff',
            flexShrink: 0,
            zIndex: 10
          }}
        >
          {/* Informações do Arquivo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isPdf ? '#ef4444' : isVideo ? '#7c3aed' : '#059669',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isPdf ? <FileText size={17} /> : isVideo ? <VideoIcon size={17} /> : <ImageIcon size={17} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(400px, 50vw)' }}>
                {media.fileName || (isPdf ? 'Documento PDF' : isVideo ? 'Vídeo' : 'Foto')}
              </div>
              {media.fileSize ? (
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {formatFileSize(media.fileSize)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Botões de Ação: Download & Fechar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Botão de Fazer Download */}
            <button
              type="button"
              onClick={() => downloadMediaFile(media.url, media.fileName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 10px rgba(5, 150, 105, 0.4)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#047857'}
              onMouseLeave={e => e.currentTarget.style.background = '#059669'}
              title="Salvar no dispositivo"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>Salvar</span>
            </button>

            {/* Botão de Fechar */}
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '8px 14px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'}
              title="Fechar (ESC)"
            >
              <X size={16} strokeWidth={2.5} />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* Área Central Expandida */}
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflow: 'hidden'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          {/* 1. SE FOR PDF */}
          {isPdf && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 'min(94vw, 980px)',
                height: '84vh',
                background: '#ffffff',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <iframe
                src={`${media.url}#toolbar=1&navpanes=1`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={media.fileName}
              />
            </motion.div>
          )}

          {/* 2. SE FOR VÍDEO */}
          {isVideo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                maxWidth: '92vw',
                maxHeight: '84vh',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                background: '#000000'
              }}
            >
              <video
                src={media.url}
                controls
                autoPlay
                playsInline
                style={{
                  maxWidth: '92vw',
                  maxHeight: '84vh',
                  display: 'block',
                  background: '#000000'
                }}
              />
            </motion.div>
          )}

          {/* 3. SE FOR IMAGEM */}
          {isImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: '92vw',
                maxHeight: '84vh'
              }}
            >
              <HeicSafeImage
                src={media.url}
                alt={media.fileName}
                style={{
                  maxWidth: '92vw',
                  maxHeight: '84vh',
                  objectFit: 'contain',
                  borderRadius: 12,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                }}
              />
            </motion.div>
          )}

          {/* 4. SE FOR OUTRO TIPO DE DOCUMENTO */}
          {!isPdf && !isVideo && !isImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: '#ffffff',
                borderRadius: 18,
                padding: '32px 40px',
                textAlign: 'center',
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <FileText size={32} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
                {media.fileName}
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px 0' }}>
                {media.fileSize ? formatFileSize(media.fileSize) : 'Arquivo anexado'}
              </p>
              <button
                type="button"
                onClick={() => downloadMediaFile(media.url, media.fileName)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Download size={18} />
                Baixar Arquivo
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </AnimatePresence>
  )
}
