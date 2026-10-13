'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle, ExternalLink, RotateCcw } from 'lucide-react'

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
  onPdfDocLoaded?: (doc: any) => void
  containerBackground?: string
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
  onPdfDocLoaded,
  containerBackground,
  onTap,
  className = '',
  style = {},
  footerAction,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentWrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageContainersRef = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const renderTasksRef = useRef<{ [key: number]: any }>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [reloadKey, setReloadKey] = useState(0)

  const activePageRef = useRef<number>(pageNumber)
  const isMouseDownRef = useRef(false)
  const mouseStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const isTouchPanningRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  // 1. Carrega o documento PDF com PDF.js usando dados binários via fetch para máxima estabilidade
  useEffect(() => {
    let isCancelled = false

    async function loadPdf() {
      if (typeof window === 'undefined') return
      try {
        setLoading(true)
        setError(null)

        const origin = window.location.origin

        // Baixa o binário primeiro via fetch padrão da janela (mais confiável com cookies e CSP)
        const res = await fetch(pdfUrl, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Não foi possível carregar o PDF (HTTP ${res.status})`)
        }
        const buffer = await res.arrayBuffer()
        const data = new Uint8Array(buffer)

        // @ts-ignore
        const pdfjs: any = await import('pdfjs-dist/build/pdf.min.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`

        const loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: `${origin}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${origin}/standard_fonts/`,
        })

        const doc = await loadingTask.promise
        if (isCancelled) return

        setPdfDoc(doc)
        const count = doc.numPages || 1
        setTotalPages(count)
        onTotalPagesLoaded?.(count)
        onPdfDocLoaded?.(doc)
        setLoading(false)
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
  }, [pdfUrl, reloadKey, onTotalPagesLoaded, onPdfDocLoaded])

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

  // Calcula displayWidth considerando mobile, desktop e percentual de zoom
  const availableWidth = containerWidth || containerRef.current?.clientWidth || 380
  const isMobile = availableWidth < 600
  const baseWidth = isMobile ? availableWidth - 16 : Math.min(availableWidth - 32, 840)
  const scaleMultiplier = Math.max(0.4, (zoomPercent || 100) / 100)
  const displayWidth = Math.max(200, Math.round(baseWidth * scaleMultiplier))
  const isOverflowingX = displayWidth > availableWidth

  // 3. Renderização nítida de páginas no Canvas com transição suave sem tela branca
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

      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1

      for (const pNum of pagesToRender) {
        const canvas = renderAllPages ? canvasRefs.current[pNum] : singleCanvasRef.current
        if (!canvas) continue

        const page = await pdfDoc.getPage(pNum)
        const unscaledViewport = page.getViewport({ scale: 1 })
        const pageRatio = unscaledViewport.height / unscaledViewport.width
        const displayHeight = Math.round(displayWidth * pageRatio)

        // 1º Passo: Ajusta estilo CSS imediatamente para feedback instantâneo de zoom sem flicker
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`

        const targetInternalWidth = Math.round(displayWidth * dpr)
        const targetInternalHeight = Math.round(displayHeight * dpr)

        // 2º Passo: Renderiza em offscreen canvas para não deixar o canvas visível em branco
        const offscreen = document.createElement('canvas')
        offscreen.width = targetInternalWidth
        offscreen.height = targetInternalHeight
        const offCtx = offscreen.getContext('2d')
        if (!offCtx) continue

        const effectiveScale = (displayWidth / unscaledViewport.width) * dpr
        const viewport = page.getViewport({ scale: effectiveScale })

        const task = page.render({
          canvasContext: offCtx,
          viewport,
        })
        renderTasksRef.current[pNum] = task

        await task.promise

        // 3º Passo: Transfere o bitmap nítido para o canvas principal
        canvas.width = targetInternalWidth
        canvas.height = targetInternalHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(offscreen, 0, 0)

        if (pNum === pagesToRender[0]) {
          setLoading(false)
        }
      }

      setLoading(false)
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('[PdfCanvasViewer] Erro na renderização do canvas:', err)
        setLoading(false)
      }
    }
  }, [pdfDoc, renderAllPages, totalPages, pageNumber, displayWidth])

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

  // 6. Gestos Táteis: Pinça (Pinch-to-zoom), Toque Duplo e Panning 1-Dedo Fluido no Mobile
  useEffect(() => {
    const container = containerRef.current
    if (!container || !enableGestures) return

    let pinchStartDist = 0
    let pinchCenter = { x: 0, y: 0 }
    let initialZoom = zoomPercent
    let currentScaleRatio = 1
    let lastTapTime = 0
    let lastTapPos = { x: 0, y: 0 }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinça com 2 dedos: bloqueia scroll nativo temporariamente
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        pinchStartDist = Math.hypot(dx, dy)
        pinchCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        }
        initialZoom = zoomPercent
        currentScaleRatio = 1
        isTouchPanningRef.current = false
      } else if (e.touches.length === 1) {
        const touch = e.touches[0]
        const now = Date.now()
        const timeDiff = now - lastTapTime
        const dist = Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y)

        if (timeDiff < 320 && dist < 30) {
          // Toque duplo: alterna entre 100% (ajustar) e 170% (detalhe)
          e.preventDefault()
          const nextZoom = zoomPercent > 125 ? 100 : 170
          onZoomChange?.(nextZoom)
          lastTapTime = 0
          return
        }
        lastTapTime = now
        lastTapPos = { x: touch.clientX, y: touch.clientY }

        // Inicia rastreamento de arrasto tátil com 1 dedo
        isTouchPanningRef.current = true
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const currentDist = Math.hypot(dx, dy)
        currentScaleRatio = currentDist / pinchStartDist

        // Feedback visual a 60fps usando CSS transform instantâneo
        if (contentWrapperRef.current) {
          contentWrapperRef.current.style.transform = `scale(${currentScaleRatio})`
          contentWrapperRef.current.style.transformOrigin = `${pinchCenter.x}px ${pinchCenter.y}px`
          contentWrapperRef.current.style.transition = 'none'
        }
      } else if (e.touches.length === 1 && isTouchPanningRef.current && isOverflowingX) {
        // Se a página está ampliada além da tela, permite pan horizontal e vertical fluido com 1 dedo
        const touch = e.touches[0]
        const dx = touch.clientX - touchStartRef.current.x
        const dy = touch.clientY - touchStartRef.current.y

        // Se o usuário está arrastando horizontalmente com documento ampliado, intercepta para pan contínuo
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          container.scrollLeft = touchStartRef.current.scrollLeft - dx
          container.scrollTop = touchStartRef.current.scrollTop - dy
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
          const clamped = Math.min(260, Math.max(60, computed))
          onZoomChange?.(clamped)
        }

        pinchStartDist = 0
        currentScaleRatio = 1
      }

      if (e.touches.length === 0) {
        isTouchPanningRef.current = false
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: false })
    container.addEventListener('touchcancel', onTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enableGestures, zoomPercent, isOverflowingX, onZoomChange])

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

  // Fallback seguro caso ocorra erro ao carregar o arquivo binário
  if (error) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 460,
          background: renderAllPages ? '#090d16' : '#ffffff',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          ...style,
        }}
        className={className}
      >
        <div
          style={{
            maxWidth: 440,
            width: '100%',
            background: renderAllPages ? 'rgba(15, 23, 42, 0.9)' : '#f8fafc',
            border: renderAllPages ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '24px 20px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <AlertCircle size={26} />
          </div>
          <h4
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: renderAllPages ? '#ffffff' : '#0f172a',
              margin: '0 0 6px',
            }}
          >
            Não foi possível exibir o documento
          </h4>
          <p
            style={{
              fontSize: 12.5,
              color: renderAllPages ? '#94a3b8' : '#64748b',
              margin: '0 0 18px',
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setReloadKey(k => k + 1)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} /> Tentar Carregar Novamente
            </button>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: renderAllPages ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                border: renderAllPages ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                color: renderAllPages ? '#e2e8f0' : '#1e293b',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={15} /> Abrir PDF em Nova Aba
            </a>
          </div>
        </div>
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
        background: renderAllPages ? '#090d16' : (containerBackground || 'transparent'),
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOverflowingX ? 'flex-start' : 'center',
        justifyContent: 'flex-start',
        cursor: onTap ? 'pointer' : enableGestures ? 'grab' : 'default',
        touchAction: enableGestures ? 'pan-x pan-y' : 'manipulation',
        boxSizing: 'border-box',
        ...style,
      }}
      className={className}
    >
      {/* Loading Skeleton inicial */}
      {loading && !pdfDoc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: renderAllPages ? 'rgba(9, 13, 22, 0.9)' : 'rgba(248, 250, 252, 0.94)',
            backdropFilter: renderAllPages ? 'blur(8px)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 10,
          }}
        >
          <RefreshCw size={28} className="animate-spin text-blue-600" />
          <span
            style={{
              fontSize: 13,
              color: renderAllPages ? '#94a3b8' : '#64748b',
              fontWeight: 600,
            }}
          >
            Carregando documento...
          </span>
        </div>
      )}

      {/* Content Wrapper com suporte a CSS transform durante pinça e pan horizontal irrestrito */}
      <div
        ref={contentWrapperRef}
        style={{
          minWidth: '100%',
          width: 'max-content',
          margin: isOverflowingX ? '0' : '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: renderAllPages
            ? isMobile
              ? '14px 10px 44px 10px'
              : '20px 16px 44px 16px'
            : '0',
          boxSizing: 'border-box',
        }}
      >
        {pagesArray.map((pNum) => (
          <div
            key={renderAllPages ? pNum : 'single-view'}
            id={`pdf-page-${pNum}`}
            ref={(el) => {
              pageContainersRef.current[pNum] = el
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: renderAllPages ? 20 : 0,
              width: 'fit-content',
              minWidth: '100%',
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
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 20,
                    padding: '3px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#94a3b8',
                    letterSpacing: '0.03em',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    userSelect: 'none',
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
                borderRadius: renderAllPages && (containerWidth || 0) >= 600 ? 10 : 4,
                boxShadow: renderAllPages
                  ? '0 12px 40px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.4)'
                  : '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
                border: renderAllPages ? 'none' : '1px solid rgba(226, 232, 240, 0.8)',
                overflow: 'hidden',
                display: 'inline-block',
                width: 'fit-content',
              }}
            >
              <canvas
                ref={(el) => {
                  if (renderAllPages) {
                    canvasRefs.current[pNum] = el
                  } else {
                    singleCanvasRef.current = el
                  }
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
