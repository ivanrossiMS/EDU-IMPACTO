'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface PdfCanvasViewerProps {
  pdfUrl: string
  pageNumber: number
  renderAllPages?: boolean
  zoomPercent?: number
  enableGestures?: boolean
  onZoomChange?: (newZoom: number) => void
  onPageChange?: (newPage: number) => void
  onTotalPagesLoaded?: (total: number) => void
  onTap?: () => void
  className?: string
  style?: React.CSSProperties
  footerAction?: React.ReactNode
}

export function PdfCanvasViewer({
  pdfUrl,
  pageNumber,
  renderAllPages = false,
  zoomPercent = 100,
  enableGestures = false,
  onZoomChange,
  onPageChange,
  onTotalPagesLoaded,
  onTap,
  className = '',
  style = {},
  footerAction,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentWrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const pageContainersRef = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const renderTasksRef = useRef<{ [key: number]: any }>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  const activePageRef = useRef<number>(pageNumber)
  const isMouseDownRef = useRef(false)
  const mouseStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  // 1. Carrega o documento PDF com PDF.js no cliente
  useEffect(() => {
    let isCancelled = false

    async function loadPdf() {
      if (typeof window === 'undefined') return
      try {
        setLoading(true)
        setError(null)

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
          cMapPacked: true,
        })

        const doc = await loadingTask.promise
        if (isCancelled) return

        setPdfDoc(doc)
        const count = doc.numPages || 1
        setTotalPages(count)
        if (onTotalPagesLoaded) {
          onTotalPagesLoaded(count)
        }
      } catch (err: any) {
        console.warn('[PdfCanvasViewer] Erro ao carregar PDF via Canvas:', err)
        if (!isCancelled) {
          setError(err.message || 'Falha ao carregar documento')
          setLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      isCancelled = true
    }
  }, [pdfUrl, onTotalPagesLoaded])

  // 2. Medir largura disponível no container
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth
      if (width > 0) {
        setContainerWidth(width)
      }
    }
  }, [])

  useEffect(() => {
    updateDimensions()
    const handleResize = () => updateDimensions()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateDimensions])

  // 3. Renderização nítida de páginas no Canvas
  const renderPages = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return

    // Cancela renders em andamento para evitar conflitos ao redimensionar ou trocar zoom
    Object.values(renderTasksRef.current).forEach((task: any) => {
      try {
        task?.cancel?.()
      } catch {}
    })
    renderTasksRef.current = {}

    try {
      const pagesToRender = renderAllPages
        ? Array.from({ length: totalPages }, (_, i) => i + 1)
        : [pageNumber]

      const availableWidth = containerWidth || containerRef.current.clientWidth || 380
      // Em visualização mobile, cobre 100% da lateral; em desktop, aplica margens e limita a 840px
      const isMobile = availableWidth < 600
      const baseWidth = isMobile ? availableWidth : Math.min(availableWidth - 32, 840)
      const scaleMultiplier = zoomPercent / 100
      const displayWidth = Math.round(baseWidth * scaleMultiplier)

      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1

      for (const pNum of pagesToRender) {
        const canvas = canvasRefs.current[pNum]
        if (!canvas) continue

        const page = await pdfDoc.getPage(pNum)
        const unscaledViewport = page.getViewport({ scale: 1 })
        const pageRatio = unscaledViewport.height / unscaledViewport.width
        const displayHeight = Math.round(displayWidth * pageRatio)

        // Dimensões reais do canvas na tela (estilo)
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`

        // Resolução interna em pixels (Retina)
        canvas.width = Math.round(displayWidth * dpr)
        canvas.height = Math.round(displayHeight * dpr)

        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        const effectiveScale = (displayWidth / unscaledViewport.width) * dpr
        const viewport = page.getViewport({ scale: effectiveScale })

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        const task = page.render(renderContext)
        renderTasksRef.current[pNum] = task

        await task.promise

        // Libera visualização imediata assim que a primeira página estiver pronta
        if (pNum === pagesToRender[0]) {
          setLoading(false)
        }
      }

      setLoading(false)
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('[PdfCanvasViewer] Erro na renderização:', err)
        setLoading(false)
      }
    }
  }, [pdfDoc, renderAllPages, totalPages, pageNumber, containerWidth, zoomPercent])

  useEffect(() => {
    renderPages()
  }, [renderPages])

  // 4. Salto suave para página quando solicitada externamente (ex: botões < >)
  useEffect(() => {
    if (renderAllPages && pageNumber && pageContainersRef.current[pageNumber]) {
      if (activePageRef.current !== pageNumber) {
        activePageRef.current = pageNumber
        pageContainersRef.current[pageNumber]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }
  }, [pageNumber, renderAllPages])

  // 5. Scroll Listener: Atualiza página ativa à medida que o usuário rola
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !renderAllPages || totalPages <= 1) return
    const container = containerRef.current
    const centerY = container.scrollTop + container.clientHeight / 3

    for (let p = 1; p <= totalPages; p++) {
      const el = pageContainersRef.current[p]
      if (el) {
        const top = el.offsetTop
        const bottom = top + el.offsetHeight
        if (centerY >= top && centerY <= bottom) {
          if (activePageRef.current !== p) {
            activePageRef.current = p
            onPageChange?.(p)
          }
          break
        }
      }
    }
  }, [renderAllPages, totalPages, onPageChange])

  // 6. Gestos Táteis: Pinça (Pinch-to-zoom) a 60fps, Toque Duplo e Arrasto Fluido
  useEffect(() => {
    const container = containerRef.current
    if (!container || !enableGestures) return

    let pinchStartDist = 0
    let initialZoom = zoomPercent
    let currentScaleRatio = 1
    let lastTapTime = 0
    let lastTapPos = { x: 0, y: 0 }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchStartDist = Math.hypot(dx, dy)
        initialZoom = zoomPercent
        currentScaleRatio = 1
      } else if (e.touches.length === 1) {
        const now = Date.now()
        const touch = e.touches[0]
        const timeDiff = now - lastTapTime
        const dist = Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y)

        if (timeDiff < 320 && dist < 30) {
          // Toque duplo detectado: alterna entre 100% (ajuste à tela) e 180% (leitura detalhada)
          e.preventDefault()
          const nextZoom = zoomPercent > 125 ? 100 : 180
          onZoomChange?.(nextZoom)
          lastTapTime = 0
          return
        }
        lastTapTime = now
        lastTapPos = { x: touch.clientX, y: touch.clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const currentDist = Math.hypot(dx, dy)
        currentScaleRatio = currentDist / pinchStartDist

        // Feedback visual instantâneo a 60fps usando CSS transform
        if (contentWrapperRef.current) {
          contentWrapperRef.current.style.transform = `scale(${currentScaleRatio})`
          contentWrapperRef.current.style.transformOrigin = 'center top'
          contentWrapperRef.current.style.transition = 'none'
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (pinchStartDist > 0 && e.touches.length < 2) {
        if (contentWrapperRef.current) {
          contentWrapperRef.current.style.transform = 'none'
          contentWrapperRef.current.style.transition = ''
        }

        if (Math.abs(currentScaleRatio - 1) > 0.04) {
          const computed = Math.round(initialZoom * currentScaleRatio)
          const clamped = Math.min(260, Math.max(80, computed))
          onZoomChange?.(clamped)
        }

        pinchStartDist = 0
        currentScaleRatio = 1
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [enableGestures, zoomPercent, onZoomChange])

  // 7. Arrasto com o Mouse (Desktop Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableGestures) return
    const target = e.target as HTMLElement
    if (target.tagName === 'BUTTON' || target.closest('button')) return

    isMouseDownRef.current = true
    mouseStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current?.scrollLeft || 0,
      scrollTop: containerRef.current?.scrollTop || 0,
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing'
      containerRef.current.style.userSelect = 'none'
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !containerRef.current) return
    const dx = e.clientX - mouseStartRef.current.x
    const dy = e.clientY - mouseStartRef.current.y
    containerRef.current.scrollLeft = mouseStartRef.current.scrollLeft - dx
    containerRef.current.scrollTop = mouseStartRef.current.scrollTop - dy
  }

  const handleMouseUp = () => {
    isMouseDownRef.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = enableGestures ? 'grab' : 'default'
      containerRef.current.style.userSelect = ''
    }
  }

  // Fallback caso PDF.js falhe em carregar o arquivo binário
  if (error) {
    return (
      <div
        ref={containerRef}
        onClick={onTap}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 520,
          background: '#ffffff',
          position: 'relative',
          ...style,
        }}
        className={className}
      >
        <iframe
          src={`${pdfUrl}&page=${pageNumber}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 520,
            border: 'none',
            display: 'block',
          }}
          title="Documento Oficial"
        />
      </div>
    )
  }

  const pagesArray = renderAllPages
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [pageNumber]

  return (
    <div
      ref={containerRef}
      onClick={onTap}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: renderAllPages ? '#090d16' : '#ffffff',
        overflow: enableGestures ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        cursor: onTap ? 'pointer' : enableGestures ? 'grab' : 'default',
        touchAction: enableGestures ? 'pan-x pan-y' : 'manipulation',
        ...style,
      }}
      className={className}
    >
      {/* Loading Skeleton */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: renderAllPages ? 'rgba(9, 13, 22, 0.85)' : '#ffffff',
            backdropFilter: renderAllPages ? 'blur(8px)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 10,
          }}
        >
          <RefreshCw size={28} className="animate-spin text-sky-500" />
          <span
            style={{
              fontSize: 13,
              color: renderAllPages ? '#94a3b8' : '#475569',
              fontWeight: 600,
            }}
          >
            Renderizando {renderAllPages ? `${totalPages} páginas` : `página ${pageNumber}`}...
          </span>
        </div>
      )}

      {/* Content Wrapper com suporte a CSS transform durante pinça */}
      <div
        ref={contentWrapperRef}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: renderAllPages
            ? containerWidth < 600
              ? '10px 0 32px 0'
              : '20px 16px 32px 16px'
            : '0',
          boxSizing: 'border-box',
        }}
      >
        {pagesArray.map((pNum) => (
          <div
            key={pNum}
            id={`pdf-page-${pNum}`}
            ref={(el) => {
              pageContainersRef.current[pNum] = el
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: renderAllPages ? 20 : 0,
              width: '100%',
            }}
          >
            {/* Marcador elegante entre páginas na rolagem contínua */}
            {renderAllPages && totalPages > 1 && (
              <div
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 20,
                    padding: '3px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#94a3b8',
                    letterSpacing: '0.03em',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  Página {pNum} de {totalPages}
                </span>
              </div>
            )}

            {/* Container da Página com Sombra */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: renderAllPages && containerWidth >= 600 ? 10 : 0,
                boxShadow: renderAllPages
                  ? '0 12px 40px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.4)'
                  : 'none',
                overflow: 'hidden',
                display: 'inline-block',
              }}
            >
              <canvas
                ref={(el) => {
                  canvasRefs.current[pNum] = el
                }}
                style={{
                  display: 'block',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>
        ))}

        {/* Ações ao final do documento */}
        {renderAllPages && footerAction}
      </div>
    </div>
  )
}
