'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Download, Maximize2, Loader2 } from 'lucide-react'
import { formatFileSize } from '@/lib/mediaCompressor'
import { downloadMediaFile } from './ChatMediaViewerModal'

interface PdfBubbleCardProps {
  url: string
  fileName?: string
  fileSize?: number
  onClick: () => void
}

// Cache global de miniaturas da 1ª página do PDF em memória durante a sessão
const pdfThumbnailCache = new Map<string, string>()

export function PdfBubbleCard({
  url,
  fileName = 'Documento.pdf',
  fileSize,
  onClick
}: PdfBubbleCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(pdfThumbnailCache.get(url) || null)
  const [isLoading, setIsLoading] = useState(!pdfThumbnailCache.has(url))

  useEffect(() => {
    if (pdfThumbnailCache.has(url)) {
      setThumbnail(pdfThumbnailCache.get(url)!)
      setIsLoading(false)
      return
    }

    let isCancelled = false
    setIsLoading(true)

    async function loadPdfFirstPage() {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
          cMapPacked: true
        })

        const pdf = await loadingTask.promise
        if (isCancelled) return

        const page = await pdf.getPage(1)
        if (isCancelled) return

        const initialViewport = page.getViewport({ scale: 1.0 })
        const targetWidth = 360
        const scale = targetWidth / initialViewport.width
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d', { alpha: false })

        if (!ctx) throw new Error('Canvas context unavailable')

        await (page.render as any)({
          canvasContext: ctx,
          canvas,
          viewport
        }).promise

        if (isCancelled) return

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        pdfThumbnailCache.set(url, dataUrl)
        setThumbnail(dataUrl)
        setIsLoading(false)
      } catch (err) {
        console.warn('[PdfBubbleCard] Não foi possível renderizar a 1ª página do PDF:', err)
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPdfFirstPage()

    return () => {
      isCancelled = true
    }
  }, [url])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 290,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: isHovered 
          ? '0 6px 16px -2px rgba(0,0,0,0.14)' 
          : '0 2px 6px -1px rgba(0,0,0,0.08)',
        marginBottom: 4,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Imagem da 1ª Página do PDF ou Skeleton de Carregamento */}
      <div
        style={{
          width: '100%',
          height: 170,
          background: '#f1f5f9',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        {thumbnail ? (
          <>
            <img
              src={thumbnail}
              alt={fileName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top',
                display: 'block'
              }}
            />
            {/* Selo PDF no topo esquerdo */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'rgba(220, 38, 38, 0.92)',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(4px)'
              }}
            >
              <FileText size={11} strokeWidth={2.5} />
              <span>PDF</span>
            </div>

            {/* Overlay hover para expandir */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isHovered ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.18s ease'
              }}
            >
              <div
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'scale(1)' : 'scale(0.92)',
                  transition: 'all 0.18s ease',
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                <Maximize2 size={13} strokeWidth={2.5} />
                <span>Expandir PDF</span>
              </div>
            </div>
          </>
        ) : isLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: '#64748b',
              fontSize: 11.5,
              fontWeight: 600
            }}
          >
            <Loader2 size={22} className="animate-spin" color="#dc2626" />
            <span>Gerando prévia do PDF...</span>
          </div>
        ) : (
          // Fallback caso não seja possível extrair miniatura do PDF
          <div
            style={{
              width: '84%',
              height: '88%',
              background: '#ffffff',
              borderRadius: '6px 6px 0 0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: 26,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px'
              }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.5px' }}>PDF</span>
              <FileText size={12} />
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, background: '#fafafa' }}>
              <div style={{ height: 6, width: '70%', background: '#cbd5e1', borderRadius: 3 }} />
              <div style={{ height: 4, width: '100%', background: '#e2e8f0', borderRadius: 2 }} />
              <div style={{ height: 4, width: '90%', background: '#e2e8f0', borderRadius: 2 }} />
              <div style={{ height: 4, width: '60%', background: '#e2e8f0', borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* 2. Barra inferior com Nome, Tamanho e Botão Baixar */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#ffffff'
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <FileText size={16} strokeWidth={2.2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={fileName}
          >
            {fileName}
          </div>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
            {formatFileSize(fileSize)}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            downloadMediaFile(url, fileName)
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#f1f5f9',
            border: 'none',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e2e8f0'
            e.currentTarget.style.color = '#0f172a'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f1f5f9'
            e.currentTarget.style.color = '#475569'
          }}
          title="Baixar PDF"
        >
          <Download size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
