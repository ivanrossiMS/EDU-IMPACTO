'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, ChevronLeft, ChevronRight, Sparkles, PenTool,
  Move, Trash2, FileText, AlertCircle, RefreshCw, ZoomIn, ZoomOut,
  Maximize2, Minus, Plus
} from 'lucide-react'
import {
  formatAbbreviatedSignerName,
  sanitizeSignerName,
  formatSignatureDisplayName,
} from '@/lib/contracts/sealUtils'

export interface SignatarioPosicionavel {
  id: string
  nome: string
  cargo: string
  cpf?: string
  tipo: 'escola' | 'responsavel'
  cor: string
  estiloCaligrafico?: string | null
  assinaturaBase64?: string | null
}

export interface PosicaoAssinatura {
  signatarioId: string
  nome: string
  cargo: string
  cpf?: string
  tipo: 'escola' | 'responsavel'
  pagina: number
  xPercent: number // 0 a 100% da largura
  yPercent: number // 0 a 100% da altura a partir do topo
  larguraPt?: number
  alturaPt?: number
  estiloCaligrafico?: string | null
  assinaturaBase64?: string | null
}

export function gerarPosicionamentoPadrao(
  signatarios: SignatarioPosicionavel[],
  totalPaginas: number
): Record<string, PosicaoAssinatura> {
  const totalPags = Math.max(1, totalPaginas || 1)
  const count = signatarios.length
  if (count === 0) return {}

  const novas: Record<string, PosicaoAssinatura> = {}

  if (count === 1) {
    const sig = signatarios[0]
    novas[sig.id] = {
      signatarioId: sig.id,
      nome: sig.nome,
      cargo: sig.cargo,
      cpf: sig.cpf,
      tipo: sig.tipo,
      pagina: totalPags,
      xPercent: 32,
      yPercent: 82,
      larguraPt: 160,
      alturaPt: 44,
      estiloCaligrafico: sig.estiloCaligrafico || 'classica',
      assinaturaBase64: sig.assinaturaBase64 || undefined,
    }
  } else if (count === 2) {
    signatarios.forEach((sig, idx) => {
      novas[sig.id] = {
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: idx === 0 ? 8 : 54,
        yPercent: 82,
        larguraPt: 160,
        alturaPt: 44,
        estiloCaligrafico: sig.estiloCaligrafico || 'classica',
        assinaturaBase64: sig.assinaturaBase64 || undefined,
      }
    })
  } else {
    // 3 ou mais signatários: distribui em grade harmoniosa no rodapé
    signatarios.forEach((sig, idx) => {
      const linha = Math.floor(idx / 2)
      const col = idx % 2
      novas[sig.id] = {
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: col === 0 ? 8 : 54,
        yPercent: 72 + linha * 12,
        larguraPt: 160,
        alturaPt: 44,
        estiloCaligrafico: sig.estiloCaligrafico || 'classica',
        assinaturaBase64: sig.assinaturaBase64 || undefined,
      }
    })
  }

  return novas
}

interface PosicionadorAssinaturasModalProps {
  aberto: boolean
  onClose: () => void
  pdfUrl?: string | null
  pdfBase64?: string | null
  totalPaginas: number
  documentoNome?: string
  signatarios: SignatarioPosicionavel[]
  posicoesAtuais: Record<string, PosicaoAssinatura>
  onSalvar: (novasPosicoes: Record<string, PosicaoAssinatura>) => void
}

export function PosicionadorAssinaturasModal({
  aberto,
  onClose,
  pdfUrl,
  pdfBase64,
  totalPaginas,
  documentoNome = 'Documento para Assinatura',
  signatarios,
  posicoesAtuais,
  onSalvar,
}: PosicionadorAssinaturasModalProps) {
  const [paginaAtual, setPaginaAtual] = useState<number>(1)
  const [signatarioAtivoId, setSignatarioAtivoId] = useState<string>(signatarios[0]?.id || '')
  const [posicoes, setPosicoes] = useState<Record<string, PosicaoAssinatura>>({})
  const [zoom, setZoom] = useState<number>(100)
  const [carregandoPdf, setCarregandoPdf] = useState<boolean>(true)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  // Estado para arrastar (drag and drop) das caixinhas de assinatura
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const dragStartRef = useRef<{ startX: number; startY: number; origXPercent: number; origYPercent: number } | null>(null)

  // Escala atual do PDF (pixels por ponto)
  const [currentScale, setCurrentScale] = useState<number>(1.0)

  // Estado para redimensionamento das caixinhas
  const [redimensionandoId, setRedimensionandoId] = useState<string | null>(null)
  const resizeStartRef = useRef<{
    startX: number
    startY: number
    origLarguraPt: number
    origAlturaPt: number
  } | null>(null)

  // Sincroniza posições iniciais ao abrir
  useEffect(() => {
    if (aberto) {
      setPosicoes({ ...posicoesAtuais })
      setPaginaAtual(1)
      if (signatarios.length > 0 && !signatarioAtivoId) {
        setSignatarioAtivoId(signatarios[0].id)
      }
    }
  }, [aberto, posicoesAtuais, signatarios])

  // Carrega PDF usando PDF.js
  useEffect(() => {
    if (!aberto) return
    let isCancelled = false

    async function carregarDocumentoPdf() {
      if (typeof window === 'undefined') return
      try {
        setCarregandoPdf(true)
        setErroPdf(null)

        const origin = window.location.origin

        let data: Uint8Array | null = null
        if (pdfBase64) {
          const raw = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
          const bin = atob(raw)
          data = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) {
            data[i] = bin.charCodeAt(i)
          }
        } else if (pdfUrl) {
          const res = await fetch(pdfUrl)
          if (!res.ok) throw new Error(`Falha HTTP ${res.status} ao carregar PDF`)
          const buf = await res.arrayBuffer()
          data = new Uint8Array(buf)
        }

        if (!data) {
          throw new Error('Nenhum dado binário de PDF disponível para prévia')
        }

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

        pdfDocRef.current = doc
        setCarregandoPdf(false)
      } catch (err: any) {
        console.warn('[PosicionadorAssinaturas] Erro ao carregar PDF:', err)
        if (!isCancelled) {
          setErroPdf(err.message || 'Não foi possível carregar a visualização da página')
          setCarregandoPdf(false)
        }
      }
    }

    carregarDocumentoPdf()

    return () => {
      isCancelled = true
    }
  }, [aberto, pdfBase64, pdfUrl])

  // Renderiza a página atual no canvas
  const renderizarPagina = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel?.()
        } catch {}
      }

      const page = await pdfDocRef.current.getPage(paginaAtual)
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const unscaledViewport = page.getViewport({ scale: 1 })
      const maxDisplayWidth = Math.min(window.innerWidth - 80, 800)
      const baseScale = maxDisplayWidth / unscaledViewport.width
      const effectiveScale = baseScale * (zoom / 100)
      setCurrentScale(effectiveScale)

      const viewport = page.getViewport({ scale: effectiveScale })
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

      canvas.width = Math.round(viewport.width * dpr)
      canvas.height = Math.round(viewport.height * dpr)
      canvas.style.width = `${Math.round(viewport.width)}px`
      canvas.style.height = `${Math.round(viewport.height)}px`

      if (overlayRef.current) {
        overlayRef.current.style.width = `${Math.round(viewport.width)}px`
        overlayRef.current.style.height = `${Math.round(viewport.height)}px`
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const task = page.render({
        canvasContext: ctx,
        viewport,
      })
      renderTaskRef.current = task
      await task.promise
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn('[PosicionadorAssinaturas] Erro no render da página:', e)
      }
    }
  }, [paginaAtual, zoom])

  useEffect(() => {
    if (!carregandoPdf && pdfDocRef.current) {
      renderizarPagina()
    }
  }, [carregandoPdf, paginaAtual, zoom, renderizarPagina])

  // Clique no overlay da página para posicionar o signatário ativo
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (arrastandoId) return // Não reposiciona se acabou de arrastar
    if (!overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top

    // Calcula percentual (0 a 100%) garantindo que a caixinha não fique fora
    const xPercent = Math.max(2, Math.min(75, (xPx / rect.width) * 100))
    const yPercent = Math.max(2, Math.min(92, (yPx / rect.height) * 100))

    const signatarioAlvo = signatarios.find(s => s.id === signatarioAtivoId) || signatarios[0]
    if (!signatarioAlvo) return

    setPosicoes(prev => ({
      ...prev,
      [signatarioAlvo.id]: {
        signatarioId: signatarioAlvo.id,
        nome: signatarioAlvo.nome,
        cargo: signatarioAlvo.cargo,
        cpf: signatarioAlvo.cpf,
        tipo: signatarioAlvo.tipo,
        pagina: paginaAtual,
        xPercent,
        yPercent,
        estiloCaligrafico: signatarioAlvo.estiloCaligrafico || 'classica',
        larguraPt: 160,
        alturaPt: 44,
        assinaturaBase64: signatarioAlvo.assinaturaBase64 || undefined,
      },
    }))

    // Avança automaticamente para o próximo signatário que ainda não tem posição
    const proximoSemPosicao = signatarios.find(s => s.id !== signatarioAlvo.id && !posicoes[s.id])
    if (proximoSemPosicao) {
      setSignatarioAtivoId(proximoSemPosicao.id)
    }
  }

  // Manipulação de Arrastar (Drag and drop) das caixinhas
  const handleMouseDownItem = (e: React.MouseEvent, sigId: string) => {
    e.stopPropagation()
    const item = posicoes[sigId]
    if (!item) return
    setArrastandoId(sigId)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origXPercent: item.xPercent,
      origYPercent: item.yPercent,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current || !overlayRef.current) return
      const rect = overlayRef.current.getBoundingClientRect()
      const deltaX = moveEvent.clientX - dragStartRef.current.startX
      const deltaY = moveEvent.clientY - dragStartRef.current.startY

      const deltaXPercent = (deltaX / rect.width) * 100
      const deltaYPercent = (deltaY / rect.height) * 100

      const newXPercent = Math.max(2, Math.min(75, dragStartRef.current.origXPercent + deltaXPercent))
      const newYPercent = Math.max(2, Math.min(92, dragStartRef.current.origYPercent + deltaYPercent))

      setPosicoes(prev => ({
        ...prev,
        [sigId]: {
          ...prev[sigId],
          xPercent: newXPercent,
          yPercent: newYPercent,
        },
      }))
    }

    const handleMouseUp = () => {
      setTimeout(() => setArrastandoId(null), 50)
      dragStartRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Redimensionamento interativo da caixinha (arrasto do canto inferior direito)
  const handleMouseDownResize = (e: React.MouseEvent, sigId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const item = posicoes[sigId]
    if (!item) return

    const origLargura = item.larguraPt || 160
    const origAltura = item.alturaPt || 44
    setRedimensionandoId(sigId)
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLarguraPt: origLargura,
      origAlturaPt: origAltura,
    }

    const scale = currentScale || 1.0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return
      const deltaX = moveEvent.clientX - resizeStartRef.current.startX
      const deltaY = moveEvent.clientY - resizeStartRef.current.startY

      const deltaWidthPt = deltaX / scale
      const deltaHeightPt = deltaY / scale

      const newLarguraPt = Math.max(90, Math.min(320, Math.round(resizeStartRef.current.origLarguraPt + deltaWidthPt)))
      const newAlturaPt = Math.max(26, Math.min(80, Math.round(resizeStartRef.current.origAlturaPt + deltaHeightPt)))

      setPosicoes(prev => ({
        ...prev,
        [sigId]: {
          ...prev[sigId],
          larguraPt: newLarguraPt,
          alturaPt: newAlturaPt,
        },
      }))
    }

    const handleMouseUp = () => {
      setTimeout(() => setRedimensionandoId(null), 50)
      resizeStartRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Ajuste rápido de tamanho (+ / -)
  const handleAjustarTamanho = (sigId: string, deltaPt: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setPosicoes(prev => {
      const item = prev[sigId]
      if (!item) return prev
      const curL = item.larguraPt || 160
      const curA = item.alturaPt || 44
      const ratio = curA / curL
      const newL = Math.max(90, Math.min(320, Math.round(curL + deltaPt)))
      const newA = Math.max(26, Math.min(80, Math.round(curA + deltaPt * ratio)))
      return {
        ...prev,
        [sigId]: {
          ...item,
          larguraPt: newL,
          alturaPt: newA,
        },
      }
    })
  }

  // Aplica preset de tamanho para a assinatura ativa ou todas
  const handleAplicarPresetTamanho = (largura: number, altura: number) => {
    setPosicoes(prev => {
      const copy = { ...prev }
      const alvoId = signatarioAtivoId && copy[signatarioAtivoId] ? signatarioAtivoId : null
      if (alvoId) {
        copy[alvoId] = { ...copy[alvoId], larguraPt: largura, alturaPt: altura }
      } else {
        Object.keys(copy).forEach(k => {
          copy[k] = { ...copy[k], larguraPt: largura, alturaPt: altura }
        })
      }
      return copy
    })
  }

  // Remove a posição de um signatário
  const handleRemoverPosicao = (sigId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPosicoes(prev => {
      const copy = { ...prev }
      delete copy[sigId]
      return copy
    })
  }

  // Auto-posiciona todos os signatários no rodapé da última página
  const handleAutoPosicionarUltimaPagina = () => {
    const totalPags = Math.max(1, totalPaginas || pdfDocRef.current?.numPages || 1)
    const novas = gerarPosicionamentoPadrao(signatarios, totalPags)
    if (Object.keys(novas).length === 0) return
    setPosicoes(novas)
    setPaginaAtual(totalPags)
  }

  // Contagem de signatários posicionados
  const totalPosicionados = signatarios.filter(s => Boolean(posicoes[s.id])).length
  const todosPosicionados = totalPosicionados === signatarios.length && signatarios.length > 0

  if (!aberto) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(10, 15, 30, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '100%',
          maxWidth: 1120,
          height: '92vh',
          background: '#0b1120',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* ── Top Header do Posicionador ── */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PenTool size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Posicionar Assinaturas das Pessoas</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: todosPosicionados ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: todosPosicionados ? '#34d399' : '#fbbf24',
                    border: todosPosicionados ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  }}
                >
                  {todosPosicionados
                    ? `✓ Todas as ${signatarios.length} assinaturas posicionadas`
                    : `${totalPosicionados} de ${signatarios.length} posicionadas`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Clique na pessoa desejada e depois clique no documento para fixar sua assinatura. Você também pode arrastar a caixa.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleAutoPosicionarUltimaPagina}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontSize: 11,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Posiciona automaticamente todos os signatários lado a lado no rodapé da última página"
            >
              <Sparkles size={12} /> Auto-Posicionar no Rodapé
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#cbd5e1',
                padding: '7px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Barra de Signatários Selecionáveis ── */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pessoas para Assinar:
            </span>
            {signatarios.map(sig => {
              const isAtivo = signatarioAtivoId === sig.id
              const pos = posicoes[sig.id]
              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => setSignatarioAtivoId(sig.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: isAtivo ? 700 : 500,
                    border: isAtivo
                      ? `2px solid ${sig.cor}`
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isAtivo
                      ? `${sig.cor}22`
                      : 'rgba(255, 255, 255, 0.04)',
                    color: isAtivo ? '#ffffff' : '#cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: sig.cor,
                    }}
                  />
                  <span>{sig.nome}</span>
                  <span style={{ fontSize: 9.5, opacity: 0.75 }}>({sig.cargo.split('/')[0].trim()})</span>
                  {pos ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.2)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      Pág {pos.pagina}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 9,
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.15)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      Pendente
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Controles de Navegação de Página e Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: paginaAtual <= 1 ? '#475569' : '#e2e8f0',
                  cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 11.5, color: '#f1f5f9', fontWeight: 600 }}>
                Página {paginaAtual} de {Math.max(1, totalPaginas || pdfDocRef.current?.numPages || 1)}
              </span>
              <button
                type="button"
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas || pdfDocRef.current?.numPages || 1, p + 1))}
                disabled={paginaAtual >= (totalPaginas || pdfDocRef.current?.numPages || 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: paginaAtual >= (totalPaginas || pdfDocRef.current?.numPages || 1) ? '#475569' : '#e2e8f0',
                  cursor: paginaAtual >= (totalPaginas || pdfDocRef.current?.numPages || 1) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(60, z - 10))}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Reduzir zoom"
              >
                <ZoomOut size={13} />
              </button>
              <span style={{ fontSize: 10.5, color: '#94a3b8', minWidth: 34, textAlign: 'center' }}>{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(140, z + 10))}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Aumentar zoom"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Presets rápidos de tamanho da assinatura */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: 8 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Tam:</span>
              {[
                { label: 'P', l: 120, a: 34, title: 'Tamanho Pequeno (120x34 pt)' },
                { label: 'M', l: 160, a: 44, title: 'Tamanho Médio / Padrão (160x44 pt)' },
                { label: 'G', l: 200, a: 54, title: 'Tamanho Grande (200x54 pt)' },
                { label: 'GG', l: 250, a: 66, title: 'Tamanho Extra Grande (250x66 pt)' },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleAplicarPresetTamanho(preset.l, preset.a)}
                  title={preset.title}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#e2e8f0',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Área de Visualização e Posicionamento do Documento (Canvas + Overlay Interativo) ── */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#090d16',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '24px',
            position: 'relative',
          }}
        >
          {carregandoPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#94a3b8', marginTop: 100 }}>
              <RefreshCw size={24} className="animate-spin" color="#38bdf8" />
              <span style={{ fontSize: 12 }}>Renderizando página do documento...</span>
            </div>
          ) : erroPdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '16px 20px', borderRadius: 12, marginTop: 100 }}>
              <AlertCircle size={20} />
              <span>{erroPdf}</span>
            </div>
          ) : (
            <div
              style={{
                position: 'relative',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                borderRadius: 4,
                overflow: 'visible',
                background: '#ffffff',
              }}
            >
              {/* Canvas com a página renderizada do PDF */}
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4 }} />

              {/* Overlay interativo com suporte a clique e arrasto */}
              <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor: 'crosshair',
                  userSelect: 'none',
                }}
              >
                {/* Renderiza as caixas de assinaturas desta página */}
                {Object.values(posicoes)
                  .filter(pos => pos.pagina === paginaAtual)
                  .map(pos => {
                    const sigInfo = signatarios.find(s => s.id === pos.signatarioId)
                    const cor = sigInfo?.cor || '#2563eb'
                    const isAtivo = signatarioAtivoId === pos.signatarioId
                    const larguraPt = pos.larguraPt || 160
                    const alturaPt = pos.alturaPt || 44
                    const boxWidthPx = Math.max(90, Math.round(larguraPt * currentScale))
                    const boxHeightPx = Math.max(28, Math.round(alturaPt * currentScale))
                    const baseFontSize = Math.max(13, Math.min(32, Math.round(boxHeightPx * 0.38)))
                    const subFontSize = Math.max(7, Math.min(10, Math.round(boxHeightPx * 0.16)))

                    return (
                      <div
                        key={pos.signatarioId}
                        onMouseDown={(e) => handleMouseDownItem(e, pos.signatarioId)}
                        title={`${pos.nome} (${pos.cargo || 'Signatário'}) - Arraste para mover ou use o canto para redimensionar`}
                        style={{
                          position: 'absolute',
                          left: `${pos.xPercent}%`,
                          top: `${pos.yPercent}%`,
                          width: boxWidthPx,
                          minHeight: boxHeightPx,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.75)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          border: `1.5px dashed ${cor}`,
                          boxShadow: isAtivo ? `0 0 0 3px ${cor}44, 0 6px 16px rgba(0,0,0,0.12)` : '0 2px 8px rgba(0,0,0,0.08)',
                          cursor: redimensionandoId === pos.signatarioId ? 'se-resize' : 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 2,
                          transition: arrastandoId === pos.signatarioId || redimensionandoId === pos.signatarioId ? 'none' : 'box-shadow 0.15s ease',
                          zIndex: isAtivo ? 50 : 20,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 800,
                              color: cor,
                              background: 'rgba(255, 255, 255, 0.90)',
                              border: `1px solid ${cor}33`,
                              padding: '1px 4px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '50%',
                            }}
                          >
                            <Move size={7} /> {pos.tipo === 'escola' ? 'Instituição' : 'Responsável'}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* Steppers de redimensionamento rápido */}
                            <button
                              type="button"
                              onClick={(e) => handleAjustarTamanho(pos.signatarioId, -15, e)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.9)',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                cursor: 'pointer',
                                padding: '1px 3px',
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: 9,
                              }}
                              title="Diminuir tamanho (-15pt)"
                            >
                              <Minus size={8} />
                            </button>
                            <span style={{ fontSize: 8, color: '#64748b', fontWeight: 700 }}>
                              {Math.round(larguraPt)}pt
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleAjustarTamanho(pos.signatarioId, 15, e)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.9)',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                cursor: 'pointer',
                                padding: '1px 3px',
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: 9,
                              }}
                              title="Aumentar tamanho (+15pt)"
                            >
                              <Plus size={8} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleRemoverPosicao(pos.signatarioId, e)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.85)',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '2px',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 2,
                              }}
                              title="Remover assinatura desta página"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Apenas a Assinatura (sem nome por extenso e sem cargo/função) */}
                        <div
                          style={{
                            fontFamily: "'Dancing Script', 'Caveat', 'Brush Script MT', cursive, sans-serif",
                            fontSize: baseFontSize,
                            fontWeight: 700,
                            color: '#0e2454',
                            lineHeight: 1.15,
                            paddingTop: 1,
                            paddingLeft: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textShadow: '0 1px 2px rgba(255, 255, 255, 0.95)',
                            userSelect: 'none',
                          }}
                        >
                          {formatSignatureDisplayName(sanitizeSignerName(pos.nome), 28)}
                        </div>
                        <div
                          style={{
                            fontSize: subFontSize,
                            color: '#64748b',
                            fontWeight: 500,
                            marginTop: 1,
                            paddingLeft: 2,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Assinado eletronicamente {new Date().toLocaleDateString('pt-BR')}
                        </div>

                        {/* Alça interativa de redimensionamento (arrastar para aumentar/diminuir) */}
                        <div
                          onMouseDown={(e) => handleMouseDownResize(e, pos.signatarioId)}
                          title="Clique e arraste para redimensionar livremente"
                          style={{
                            position: 'absolute',
                            right: -1,
                            bottom: -1,
                            width: 14,
                            height: 14,
                            cursor: 'se-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: cor,
                            color: '#ffffff',
                            borderTopLeftRadius: 4,
                            borderBottomRightRadius: 6,
                            opacity: 0.9,
                            zIndex: 10,
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 1L1 7M7 4L4 7M7 7H7.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer com Ações e Confirmação ── */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
            <span style={{ color: todosPosicionados ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
              {totalPosicionados} de {signatarios.length} pessoas posicionadas
            </span>
            <span>• As assinaturas serão inseridas exatamente nestas posições, sem a rubrica no rodapé.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => {
                onSalvar(posicoes)
                onClose()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Check size={15} strokeWidth={2.5} /> Confirmar e Salvar Posições
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
