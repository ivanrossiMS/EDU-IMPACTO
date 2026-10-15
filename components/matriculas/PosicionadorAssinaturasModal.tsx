'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Sparkles, PenTool, Move, Trash2, FileText, AlertCircle, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Minus, Plus, Building2, User,
  CheckCircle2, RotateCcw, MousePointerClick, Layers, Lock, AlertTriangle, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
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
  id?: string // Identificador único da posição (ex: `${sigId}_doc_${docId}`)
  signatarioId: string
  nome: string
  cargo: string
  cpf?: string
  tipo: 'escola' | 'responsavel'
  pagina: number // Página global no pacote PDF consolidado (1 a totalPaginasPacote)
  paginaRelativa?: number // Página relativa dentro deste documento específico (1 a totalPaginasDoc)
  documentoId?: string // ID do documento ao qual pertence
  documentoNome?: string // Nome do arquivo do documento
  xPercent: number // 0 a 100% da largura
  yPercent: number // 0 a 100% da altura a partir do topo
  larguraPt?: number
  alturaPt?: number
  estiloCaligrafico?: string | null
  assinaturaBase64?: string | null
}

export interface DocumentoItemPosicionador {
  id: string
  nome: string
  totalPaginas: number
  pdfBase64: string
  tamanhoFormatado?: string
  formatoOriginal?: string
  paginaInicioGlobal?: number // 1-indexed start page in unified package
  paginaFimGlobal?: number // 1-indexed end page in unified package
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
      id: sig.id,
      signatarioId: sig.id,
      nome: sig.nome,
      cargo: sig.cargo,
      cpf: sig.cpf,
      tipo: sig.tipo,
      pagina: totalPags,
      xPercent: 30,
      yPercent: 82,
      larguraPt: 190,
      alturaPt: 45,
      estiloCaligrafico: sig.estiloCaligrafico || 'classica',
      assinaturaBase64: sig.assinaturaBase64 || undefined,
    }
  } else if (count === 2) {
    signatarios.forEach((sig, idx) => {
      novas[sig.id] = {
        id: sig.id,
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: idx === 0 ? 6 : 52,
        yPercent: 82,
        larguraPt: 190,
        alturaPt: 45,
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
        id: sig.id,
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: col === 0 ? 6 : 52,
        yPercent: 72 + linha * 12,
        larguraPt: 190,
        alturaPt: 45,
        estiloCaligrafico: sig.estiloCaligrafico || 'classica',
        assinaturaBase64: sig.assinaturaBase64 || undefined,
      }
    })
  }

  return novas
}

/**
 * Gera posicionamento padrão para múltiplos documentos:
 * Posiciona os signatários no rodapé da ÚLTIMA página de CADA documento.
 */
export function gerarPosicionamentoDocumentos(
  signatarios: SignatarioPosicionavel[],
  documentos: Array<{ id: string; nome: string; totalPaginas: number; pdfBase64?: string }>
): Record<string, PosicaoAssinatura> {
  if (signatarios.length === 0) return {}
  if (!documentos || documentos.length === 0) {
    return gerarPosicionamentoPadrao(signatarios, 1)
  }
  if (documentos.length === 1) {
    const d = documentos[0]
    const base = gerarPosicionamentoPadrao(signatarios, d.totalPaginas || 1)
    const res: Record<string, PosicaoAssinatura> = {}
    for (const [_, p] of Object.entries(base)) {
      const posKey = `${p.signatarioId}_doc_${d.id}`
      res[posKey] = {
        ...p,
        id: posKey,
        documentoId: d.id,
        documentoNome: d.nome,
        paginaRelativa: p.pagina,
      }
    }
    return res
  }

  // Múltiplos documentos: posiciona os signatários no rodapé da ÚLTIMA página de CADA documento
  const resultado: Record<string, PosicaoAssinatura> = {}
  let acumuladoPaginas = 0

  documentos.forEach((doc) => {
    const totalPagsDoc = Math.max(1, doc.totalPaginas || 1)
    const paginaFimGlobal = acumuladoPaginas + totalPagsDoc
    acumuladoPaginas = paginaFimGlobal

    // Gera o layout padrão para a última página deste documento no pacote consolidado
    const padrao = gerarPosicionamentoPadrao(signatarios, paginaFimGlobal)

    for (const [sigId, p] of Object.entries(padrao)) {
      const key = `${sigId}_doc_${doc.id}`
      resultado[key] = {
        ...p,
        id: key,
        documentoId: doc.id,
        documentoNome: doc.nome,
        pagina: paginaFimGlobal,
        paginaRelativa: totalPagsDoc,
      }
    }
  })

  return resultado
}

export interface DiagnosticoDocumentoPosicionamento {
  doc: {
    id: string
    nome: string
    totalPaginas: number
    paginaInicioGlobal?: number
    paginaFimGlobal?: number
  }
  docIdx: number
  posicionados: SignatarioPosicionavel[]
  faltantes: SignatarioPosicionavel[]
  completo: boolean
}

export interface DiagnosticoSignatarioPosicionamento {
  sig: SignatarioPosicionavel
  docsPosicionados: Array<{ id: string; nome: string; docIdx: number }>
  docsFaltantes: Array<{ id: string; nome: string; docIdx: number }>
  completoEmTodosDocs: boolean
}

export interface ResultadoValidacaoPosicionamento {
  porDocumento: DiagnosticoDocumentoPosicionamento[]
  porSignatario: DiagnosticoSignatarioPosicionamento[]
  totalDocumentos: number
  totalSignatarios: number
  totalEsperado: number
  totalPosicionado: number
  totalFaltante: number
  docsCompletosCount: number
  docsIncompletos: DiagnosticoDocumentoPosicionamento[]
  sigsCompletosEmTodosDocsCount: number
  sigsComAlgumaPosicaoCount: number
  tudoPosicionado: boolean
}

export function verificarPosicaoSignatarioNoDoc(
  pos: PosicaoAssinatura,
  sigId: string,
  doc: { id: string; paginaInicioGlobal?: number; paginaFimGlobal?: number },
  docIdx: number,
  totalDocs: number
): boolean {
  if (pos.signatarioId !== sigId) return false
  if (pos.documentoId) {
    return pos.documentoId === doc.id
  }
  if (totalDocs <= 1) return true
  if (
    typeof doc.paginaInicioGlobal === 'number' &&
    typeof doc.paginaFimGlobal === 'number' &&
    pos.pagina >= doc.paginaInicioGlobal &&
    pos.pagina <= doc.paginaFimGlobal
  ) {
    return true
  }
  return docIdx === 0
}

export function validarPosicionamentoCompleto(
  signatarios: SignatarioPosicionavel[],
  documentos: Array<{
    id: string
    nome: string
    totalPaginas: number
    paginaInicioGlobal?: number
    paginaFimGlobal?: number
  }>,
  posicoes: Record<string, PosicaoAssinatura>
): ResultadoValidacaoPosicionamento {
  const listaPosicoes = Object.values(posicoes || {})
  const totalDocs = documentos.length

  const porDocumento: DiagnosticoDocumentoPosicionamento[] = documentos.map((doc, docIdx) => {
    const posicionados: SignatarioPosicionavel[] = []
    const faltantes: SignatarioPosicionavel[] = []

    signatarios.forEach((sig) => {
      const encontrado = listaPosicoes.some((p) =>
        verificarPosicaoSignatarioNoDoc(p, sig.id, doc, docIdx, totalDocs)
      )
      if (encontrado) {
        posicionados.push(sig)
      } else {
        faltantes.push(sig)
      }
    })

    return {
      doc,
      docIdx,
      posicionados,
      faltantes,
      completo: signatarios.length > 0 && faltantes.length === 0,
    }
  })

  const porSignatario: DiagnosticoSignatarioPosicionamento[] = signatarios.map((sig) => {
    const docsPosicionados: Array<{ id: string; nome: string; docIdx: number }> = []
    const docsFaltantes: Array<{ id: string; nome: string; docIdx: number }> = []

    documentos.forEach((doc, docIdx) => {
      const encontrado = listaPosicoes.some((p) =>
        verificarPosicaoSignatarioNoDoc(p, sig.id, doc, docIdx, totalDocs)
      )
      if (encontrado) {
        docsPosicionados.push({ id: doc.id, nome: doc.nome, docIdx })
      } else {
        docsFaltantes.push({ id: doc.id, nome: doc.nome, docIdx })
      }
    })

    return {
      sig,
      docsPosicionados,
      docsFaltantes,
      completoEmTodosDocs: totalDocs > 0 && docsFaltantes.length === 0,
    }
  })

  const totalEsperado = totalDocs * signatarios.length
  const totalPosicionado = porDocumento.reduce((acc, item) => acc + item.posicionados.length, 0)
  const totalFaltante = Math.max(0, totalEsperado - totalPosicionado)
  const docsIncompletos = porDocumento.filter((d) => !d.completo)
  const docsCompletosCount = porDocumento.length - docsIncompletos.length
  const sigsCompletosEmTodosDocsCount = porSignatario.filter((s) => s.completoEmTodosDocs).length
  const sigsComAlgumaPosicaoCount = porSignatario.filter((s) => s.docsPosicionados.length > 0).length
  const tudoPosicionado =
    signatarios.length > 0 &&
    totalDocs > 0 &&
    totalFaltante === 0 &&
    docsIncompletos.length === 0

  return {
    porDocumento,
    porSignatario,
    totalDocumentos: totalDocs,
    totalSignatarios: signatarios.length,
    totalEsperado,
    totalPosicionado,
    totalFaltante,
    docsCompletosCount,
    docsIncompletos,
    sigsCompletosEmTodosDocsCount,
    sigsComAlgumaPosicaoCount,
    tudoPosicionado,
  }
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
  documentos?: DocumentoItemPosicionador[]
  signatarioInicialId?: string | null
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
  documentos,
  signatarioInicialId,
}: PosicionadorAssinaturasModalProps) {
  // Processa a lista de documentos calculando as faixas de páginas globais
  const docsProcessados = useMemo<DocumentoItemPosicionador[]>(() => {
    if (!documentos || documentos.length === 0) {
      return [{
        id: 'doc_1',
        nome: documentoNome || 'Documento',
        totalPaginas: Math.max(1, totalPaginas || 1),
        pdfBase64: pdfBase64 || '',
        paginaInicioGlobal: 1,
        paginaFimGlobal: Math.max(1, totalPaginas || 1),
      }]
    }
    let acumulado = 0
    return documentos.map((d, idx) => {
      const pags = Math.max(1, d.totalPaginas || 1)
      const start = acumulado + 1
      const end = acumulado + pags
      acumulado = end
      return {
        ...d,
        id: d.id || `doc_${idx + 1}`,
        totalPaginas: pags,
        paginaInicioGlobal: start,
        paginaFimGlobal: end,
      }
    })
  }, [documentos, documentoNome, totalPaginas, pdfBase64])

  const totalPaginasPacote = useMemo(() => {
    return docsProcessados.reduce((acc, d) => acc + (d.totalPaginas || 1), 0)
  }, [docsProcessados])

  // Estado do documento ativo e da página atual no documento ativo
  const [docAtivoIndex, setDocAtivoIndex] = useState<number>(0)
  const [paginaAtualNoDoc, setPaginaAtualNoDoc] = useState<number>(1)
  const docAtivo = docsProcessados[docAtivoIndex] || docsProcessados[0]
  const totalPaginasDocAtivo = Math.max(1, docAtivo?.totalPaginas || 1)
  const paginaGlobalAtual = (docAtivo?.paginaInicioGlobal || 1) + (paginaAtualNoDoc - 1)

  const [signatarioAtivoId, setSignatarioAtivoId] = useState<string>(signatarios[0]?.id || '')
  const [posicoes, setPosicoes] = useState<Record<string, PosicaoAssinatura>>({})
  const [zoom, setZoom] = useState<number>(100)
  const [carregandoPdf, setCarregandoPdf] = useState<boolean>(true)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const [tentouSalvarIncompleto, setTentouSalvarIncompleto] = useState<boolean>(false)
  const [shakeTrigger, setShakeTrigger] = useState<number>(0)

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
      setDocAtivoIndex(0)
      setPaginaAtualNoDoc(1)
      setTentouSalvarIncompleto(false)
      if (signatarioInicialId) {
        setSignatarioAtivoId(signatarioInicialId)
      } else if (signatarios.length > 0 && !signatarioAtivoId) {
        setSignatarioAtivoId(signatarios[0].id)
      }
    }
  }, [aberto, posicoesAtuais, signatarios, signatarioInicialId])

  // PDF binário a ser exibido para o documento ativo
  const activePdfBase64 = docAtivo?.pdfBase64 || pdfBase64
  const activePdfUrl = !activePdfBase64 ? pdfUrl : null

  // Carrega PDF do documento ativo usando PDF.js
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

        if (activePdfBase64) {
          const raw = activePdfBase64.replace(/^data:[^;]+;base64,/, '')
          const bin = atob(raw)
          data = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) {
            data[i] = bin.charCodeAt(i)
          }
        } else if (activePdfUrl) {
          const res = await fetch(activePdfUrl)
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
  }, [aberto, activePdfBase64, activePdfUrl])

  // Renderiza a página atual no canvas
  const renderizarPagina = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel?.()
        } catch {}
      }

      const numPages = pdfDocRef.current.numPages || 1
      const safePageNum = Math.max(1, Math.min(paginaAtualNoDoc, numPages))
      const page = await pdfDocRef.current.getPage(safePageNum)
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const unscaledViewport = page.getViewport({ scale: 1 })
      const availableWidth = window.innerWidth > 960 ? window.innerWidth - 440 : window.innerWidth - 64
      const maxDisplayWidth = Math.max(320, Math.min(availableWidth, 740))
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
  }, [paginaAtualNoDoc, zoom])

  useEffect(() => {
    if (!carregandoPdf && pdfDocRef.current) {
      renderizarPagina()
    }
  }, [carregandoPdf, paginaAtualNoDoc, zoom, renderizarPagina])

  // Diagnóstico completo de validação (todos os signatários em todos os documentos)
  const diagnostico = useMemo(() => {
    return validarPosicionamentoCompleto(signatarios, docsProcessados, posicoes)
  }, [signatarios, docsProcessados, posicoes])

  // Limpa o estado de alerta de tentativa inválida assim que tudo estiver posicionado
  useEffect(() => {
    if (diagnostico.tudoPosicionado && tentouSalvarIncompleto) {
      setTentouSalvarIncompleto(false)
    }
  }, [diagnostico.tudoPosicionado, tentouSalvarIncompleto])

  // Clique no overlay da página para posicionar o signatário ativo
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (arrastandoId || redimensionandoId) return // Não reposiciona se acabou de arrastar ou redimensionar
    if (!overlayRef.current) return
    const sigAtivo = signatarios.find(s => s.id === signatarioAtivoId) || signatarios[0]
    if (!sigAtivo) return

    const rect = overlayRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top

    const posKey = docsProcessados.length > 1
      ? `${sigAtivo.id}_doc_${docAtivo.id}`
      : sigAtivo.id

    // Verifica se já existia posição para este signatário neste documento
    const entryExistenteNoDoc = Object.entries(posicoes).find(([_, p]) =>
      verificarPosicaoSignatarioNoDoc(p, sigAtivo.id, docAtivo, docAtivoIndex, docsProcessados.length)
    )
    const keyReal = entryExistenteNoDoc?.[0] || posKey
    const posExistente = entryExistenteNoDoc?.[1] || posicoes[posKey]
    const larguraPt = posExistente?.larguraPt || 190
    const alturaPt = posExistente?.alturaPt || 45

    const boxWidthPx = larguraPt * currentScale
    const boxHeightPx = alturaPt * currentScale

    // Calcula percentual (0 a 100%) garantindo que a caixinha não fique fora
    const xPercent = Math.max(2, Math.min(85, ((xPx - boxWidthPx / 2) / rect.width) * 100))
    const yPercent = Math.max(2, Math.min(92, ((yPx - boxHeightPx / 2) / rect.height) * 100))

    setPosicoes(prev => ({
      ...prev,
      [keyReal]: {
        id: keyReal,
        signatarioId: sigAtivo.id,
        nome: sigAtivo.nome,
        cargo: sigAtivo.cargo,
        cpf: sigAtivo.cpf,
        tipo: sigAtivo.tipo,
        documentoId: docAtivo.id,
        documentoNome: docAtivo.nome,
        pagina: paginaGlobalAtual,
        paginaRelativa: paginaAtualNoDoc,
        xPercent,
        yPercent,
        larguraPt,
        alturaPt,
        estiloCaligrafico: sigAtivo.estiloCaligrafico || 'classica',
        assinaturaBase64: sigAtivo.assinaturaBase64 || undefined,
      },
    }))

    // Se este signatário ainda não estava posicionado neste documento, avança automaticamente
    // a seleção para o próximo signatário pendente neste mesmo documento para agilizar os cliques
    if (!posExistente) {
      const diagDocAtual = diagnostico.porDocumento[docAtivoIndex]
      const proximoPendenteNoDoc = diagDocAtual?.faltantes.find(f => f.id !== sigAtivo.id)
      if (proximoPendenteNoDoc) {
        setSignatarioAtivoId(proximoPendenteNoDoc.id)
      }
    }
  }

  // Manipulação de Arrastar (Drag and drop) das caixinhas
  const handleMouseDownItem = (e: React.MouseEvent, posKey: string) => {
    e.stopPropagation()
    const item = posicoes[posKey]
    if (!item) return
    setArrastandoId(posKey)
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
        [posKey]: {
          ...prev[posKey],
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
  const handleMouseDownResize = (e: React.MouseEvent, posKey: string) => {
    e.stopPropagation()
    e.preventDefault()
    const item = posicoes[posKey]
    if (!item) return

    const origLargura = item.larguraPt || 190
    const origAltura = item.alturaPt || 45
    setRedimensionandoId(posKey)
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
        [posKey]: {
          ...prev[posKey],
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
  const handleAjustarTamanho = (posKey: string, deltaPt: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setPosicoes(prev => {
      const item = prev[posKey]
      if (!item) return prev
      const curL = item.larguraPt || 190
      const curA = item.alturaPt || 45
      const ratio = curA / curL
      const newL = Math.max(90, Math.min(320, Math.round(curL + deltaPt)))
      const newA = Math.max(26, Math.min(80, Math.round(curA + deltaPt * ratio)))
      return {
        ...prev,
        [posKey]: {
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
      const keyAtivo = docsProcessados.length > 1
        ? `${signatarioAtivoId}_doc_${docAtivo.id}`
        : signatarioAtivoId
      if (copy[keyAtivo]) {
        copy[keyAtivo] = { ...copy[keyAtivo], larguraPt: largura, alturaPt: altura }
      } else {
        Object.keys(copy).forEach(k => {
          copy[k] = { ...copy[k], larguraPt: largura, alturaPt: altura }
        })
      }
      return copy
    })
  }

  // Remove a posição de um signatário
  const handleRemoverPosicao = (posKey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPosicoes(prev => {
      const copy = { ...prev }
      delete copy[posKey]
      return copy
    })
  }

  // Auto-posiciona signatários no rodapé do documento ativo
  const handleAutoPosicionarDocAtual = () => {
    const totalPagsDoc = Math.max(1, docAtivo.totalPaginas || 1)
    const paginaFimGlobal = (docAtivo.paginaInicioGlobal || 1) + totalPagsDoc - 1
    const padrao = gerarPosicionamentoPadrao(signatarios, paginaFimGlobal)

    setPosicoes(prev => {
      const copy = { ...prev }
      for (const [sigId, p] of Object.entries(padrao)) {
        const key = docsProcessados.length > 1 ? `${sigId}_doc_${docAtivo.id}` : sigId
        copy[key] = {
          ...p,
          id: key,
          documentoId: docAtivo.id,
          documentoNome: docAtivo.nome,
          pagina: paginaFimGlobal,
          paginaRelativa: totalPagsDoc,
        }
      }
      return copy
    })
    setPaginaAtualNoDoc(totalPagsDoc)
    toast.success(`Todas as ${signatarios.length} assinaturas posicionadas no rodapé de "${docAtivo.nome}".`)
  }

  // Auto-posiciona signatários no rodapé de TODOS os documentos
  const handleAutoPosicionarTodosOsDocumentos = () => {
    const novas = gerarPosicionamentoDocumentos(signatarios, docsProcessados)
    if (Object.keys(novas).length === 0) return
    setPosicoes(novas)
    setPaginaAtualNoDoc(Math.max(1, docAtivo.totalPaginas || 1))
    toast.success(
      `Todas as ${signatarios.length} assinaturas foram posicionadas nos ${docsProcessados.length} documentos!`
    )
  }

  // Auto-posiciona APENAS as assinaturas que ainda estão faltando (preservando as já posicionadas manualmente)
  const handleAutoPosicionarPendentes = () => {
    if (diagnostico.tudoPosicionado) return
    const qtdFaltantes = diagnostico.totalFaltante

    setPosicoes(prev => {
      const copy = { ...prev }
      diagnostico.docsIncompletos.forEach((diagDoc) => {
        const doc = diagDoc.doc
        const totalPagsDoc = Math.max(1, doc.totalPaginas || 1)
        const paginaFimGlobal = (doc.paginaInicioGlobal || 1) + totalPagsDoc - 1
        const padrao = gerarPosicionamentoPadrao(signatarios, paginaFimGlobal)

        diagDoc.faltantes.forEach((sigFaltante) => {
          const p = padrao[sigFaltante.id]
          if (!p) return
          const key = docsProcessados.length > 1 ? `${sigFaltante.id}_doc_${doc.id}` : sigFaltante.id
          copy[key] = {
            ...p,
            id: key,
            documentoId: doc.id,
            documentoNome: doc.nome,
            pagina: paginaFimGlobal,
            paginaRelativa: totalPagsDoc,
          }
        })
      })
      return copy
    })

    setPaginaAtualNoDoc(Math.max(1, docAtivo.totalPaginas || 1))
    toast.success(
      `${qtdFaltantes} ${qtdFaltantes === 1 ? 'assinatura pendente foi posicionada' : 'assinaturas pendentes foram posicionadas'} automaticamente no rodapé!`
    )
  }

  // Auto-posiciona todos os signatários no rodapé da última página (modo documento único)
  const handleAutoPosicionarUltimaPagina = () => {
    const totalPags = Math.max(1, totalPaginas || pdfDocRef.current?.numPages || 1)
    const padrao = gerarPosicionamentoPadrao(signatarios, totalPags)
    if (Object.keys(padrao).length === 0) return
    const novas: Record<string, PosicaoAssinatura> = {}
    for (const [sigId, p] of Object.entries(padrao)) {
      novas[sigId] = {
        ...p,
        id: sigId,
        documentoId: docAtivo.id,
        documentoNome: docAtivo.nome,
        pagina: totalPags,
        paginaRelativa: totalPags,
      }
    }
    setPosicoes(novas)
    setPaginaAtualNoDoc(totalPags)
    toast.success(`Todas as ${signatarios.length} assinaturas posicionadas no rodapé da página ${totalPags}.`)
  }

  // Navega diretamente para uma pendência específica (ou para a primeira pendência encontrada)
  const handleIrParaPendencia = (targetDocIdx?: number, targetSigId?: string) => {
    const diagDocAtual = diagnostico.porDocumento[docAtivoIndex]
    const docDestino =
      typeof targetDocIdx === 'number'
        ? diagnostico.porDocumento[targetDocIdx]
        : diagDocAtual && !diagDocAtual.completo
        ? diagDocAtual
        : diagnostico.docsIncompletos[0]

    if (!docDestino) return

    const sigDestinoId = targetSigId || docDestino.faltantes[0]?.id || signatarioAtivoId
    if (docDestino.docIdx !== docAtivoIndex) {
      setDocAtivoIndex(docDestino.docIdx)
      setPaginaAtualNoDoc(Math.max(1, docDestino.doc.totalPaginas || 1))
    }
    if (sigDestinoId) {
      setSignatarioAtivoId(sigDestinoId)
    }
  }

  // Validação estrita antes de confirmar e salvar
  const handleConfirmarESalvar = () => {
    if (!diagnostico.tudoPosicionado) {
      setTentouSalvarIncompleto(true)
      setShakeTrigger(prev => prev + 1)

      const diagDocAtual = diagnostico.porDocumento[docAtivoIndex]
      const alvoDocDiag = diagDocAtual && !diagDocAtual.completo
        ? diagDocAtual
        : diagnostico.docsIncompletos[0]

      if (alvoDocDiag) {
        if (alvoDocDiag.docIdx !== docAtivoIndex) {
          setDocAtivoIndex(alvoDocDiag.docIdx)
          setPaginaAtualNoDoc(Math.max(1, alvoDocDiag.doc.totalPaginas || 1))
        }
        if (alvoDocDiag.faltantes[0]) {
          setSignatarioAtivoId(alvoDocDiag.faltantes[0].id)
        }
      }

      if (docsProcessados.length > 1) {
        const resumoDocs = diagnostico.docsIncompletos
          .map(d => `Doc ${d.docIdx + 1} (faltam ${d.faltantes.length})`)
          .join(', ')
        toast.warning(
          `Ação bloqueada: posicione todas as assinaturas em todos os documentos! Faltam ${diagnostico.totalFaltante} de ${diagnostico.totalEsperado} assinaturas (${resumoDocs}).`,
          { duration: 6000 }
        )
      } else {
        const nomesFaltantes = alvoDocDiag
          ? alvoDocDiag.faltantes.map(f => f.nome.split(' ')[0]).join(', ')
          : ''
        toast.warning(
          `Ação bloqueada: posicione todas as ${signatarios.length} assinaturas antes de salvar! Faltam ${diagnostico.totalFaltante}: ${nomesFaltantes}.`,
          { duration: 5500 }
        )
      }
      return
    }

    onSalvar(posicoes)
    onClose()
  }

  // Navegação entre páginas com transição contínua entre múltiplos documentos
  const handlePaginaAnterior = () => {
    if (paginaAtualNoDoc > 1) {
      setPaginaAtualNoDoc(p => p - 1)
    } else if (docAtivoIndex > 0) {
      // Volta para a última página do documento anterior
      const prevDoc = docsProcessados[docAtivoIndex - 1]
      setDocAtivoIndex(i => i - 1)
      setPaginaAtualNoDoc(Math.max(1, prevDoc.totalPaginas || 1))
    }
  }

  const handleProximaPagina = () => {
    if (paginaAtualNoDoc < totalPaginasDocAtivo) {
      setPaginaAtualNoDoc(p => p + 1)
    } else if (docAtivoIndex < docsProcessados.length - 1) {
      // Avança para a primeira página do próximo documento
      setDocAtivoIndex(i => i + 1)
      setPaginaAtualNoDoc(1)
    }
  }

  const todosPosicionados = diagnostico.tudoPosicionado
  const diagDocAtivo = diagnostico.porDocumento[docAtivoIndex]
  const assinaturasNoDocAtivo = diagDocAtivo?.posicionados.length || 0

  const sigAtivoObj = signatarios.find(s => s.id === signatarioAtivoId) || signatarios[0]
  const keyAtivoNoDoc = docsProcessados.length > 1 && sigAtivoObj
    ? `${sigAtivoObj.id}_doc_${docAtivo.id}`
    : sigAtivoObj?.id || ''
  const larguraAtivaPt = posicoes[keyAtivoNoDoc]?.larguraPt || 190

  if (!aberto) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overscrollBehavior: 'contain',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 1280,
          height: '92vh',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* ── TOP HEADER (LIGHT & CLEAN) ── */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: '1px solid #a7f3d0',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.12)',
              }}
            >
              <PenTool size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.015em' }}>
                  Posicionar Assinaturas das Pessoas
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: todosPosicionados
                      ? '#ecfdf5'
                      : tentouSalvarIncompleto
                      ? '#fef2f2'
                      : '#fffbeb',
                    color: todosPosicionados
                      ? '#047857'
                      : tentouSalvarIncompleto
                      ? '#b91c1c'
                      : '#b45309',
                    border: todosPosicionados
                      ? '1px solid #a7f3d0'
                      : tentouSalvarIncompleto
                      ? '1px solid #fca5a5'
                      : '1px solid #fde68a',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {todosPosicionados ? (
                    <>
                      <CheckCircle2 size={12} /> Todas as {signatarios.length} pessoas posicionadas
                      {docsProcessados.length > 1 && ` em todos os ${docsProcessados.length} docs`}
                    </>
                  ) : docsProcessados.length > 1 ? (
                    <>
                      <AlertTriangle size={12} /> {diagnostico.sigsCompletosEmTodosDocsCount} de {signatarios.length} pessoas completas • {diagnostico.totalPosicionado}/{diagnostico.totalEsperado} posições
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} /> {diagnostico.totalPosicionado} de {signatarios.length} posicionadas
                    </>
                  )}
                </span>
                {docsProcessados.length > 1 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: todosPosicionados ? '#ecfdf5' : '#eff6ff',
                      color: todosPosicionados ? '#047857' : '#1d4ed8',
                      border: todosPosicionados ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Layers size={11} /> {diagnostico.docsCompletosCount} de {docsProcessados.length} documentos concluídos
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {docsProcessados.length > 1
                  ? 'Obrigatório: todas as pessoas listadas precisam ter sua assinatura posicionada em cada um dos documentos anexados.'
                  : 'Obrigatório: todas as pessoas listadas precisam ter sua assinatura posicionada no documento para confirmar e salvar.'}
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida no Topo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!todosPosicionados && diagnostico.totalPosicionado > 0 && (
              <button
                type="button"
                onClick={handleAutoPosicionarPendentes}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '8px 13px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(245, 158, 11, 0.12)',
                }}
                title="Preenche automaticamente no rodapé apenas as assinaturas que ainda estão faltando, mantendo intactas as que você já posicionou"
              >
                <Sparkles size={14} color="#d97706" /> Completar Pendentes ({diagnostico.totalFaltante})
              </button>
            )}

            {docsProcessados.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={handleAutoPosicionarDocAtual}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#1e293b',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 13px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff'
                    e.currentTarget.style.borderColor = '#93c5fd'
                    e.currentTarget.style.color = '#1d4ed8'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#cbd5e1'
                    e.currentTarget.style.color = '#1e293b'
                  }}
                  title="Posiciona automaticamente todos os signatários no rodapé da última página deste documento"
                >
                  <Sparkles size={14} color="#2563eb" /> Auto-Posicionar neste Doc
                </button>
                <button
                  type="button"
                  onClick={handleAutoPosicionarTodosOsDocumentos}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1px solid #93c5fd',
                    color: '#1d4ed8',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.10)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                  }}
                  title="Posiciona automaticamente todos os signatários no rodapé da última página de CADA um dos documentos"
                >
                  <Sparkles size={14} color="#1d4ed8" /> Auto-Posicionar em Todos os Docs
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAutoPosicionarUltimaPagina}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1px solid #93c5fd',
                  color: '#1d4ed8',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.10)',
                }}
                title="Posiciona automaticamente todos os signatários lado a lado no rodapé da última página"
              >
                <Sparkles size={14} color="#1d4ed8" /> Auto-Posicionar no Rodapé
              </button>
            )}

            {Object.keys(posicoes).length > 0 && (
              <button
                type="button"
                onClick={() => setPosicoes({})}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '8px 11px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2'
                  e.currentTarget.style.borderColor = '#fecaca'
                  e.currentTarget.style.color = '#dc2626'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.color = '#64748b'
                }}
                title="Limpar todas as marcações de assinatura"
              >
                <RotateCcw size={13} /> Limpar
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
                width: 36,
                height: 36,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9'
                e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.color = '#475569'
              }}
              title="Fechar posicionador"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── CORPO DIVIDIDO: SIDEBAR DIDÁTICA (ESQUERDA) + WORKSPACE DO DOCUMENTO (DIREITA) ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            minHeight: 0,
            overflow: 'hidden',
            background: '#f8fafc',
          }}
        >
          {/* ── COLUNA ESQUERDA: PAINEL DIDÁTICO PASSO A PASSO ── */}
          <div
            style={{
              width: 340,
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '16px',
              gap: 18,
            }}
          >
            {/* PASSO 1: SELEÇÃO DE DOCUMENTOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    1
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {docsProcessados.length > 1 ? `Escolha o Documento (${docsProcessados.length})` : 'Documento Atual'}
                  </span>
                </div>

                {docsProcessados.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (docAtivoIndex > 0) {
                          setDocAtivoIndex(i => i - 1)
                          setPaginaAtualNoDoc(1)
                        }
                      }}
                      disabled={docAtivoIndex <= 0}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: docAtivoIndex <= 0 ? '#cbd5e1' : '#334155',
                        padding: '3px 7px',
                        borderRadius: 6,
                        cursor: docAtivoIndex <= 0 ? 'not-allowed' : 'pointer',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      title="Documento anterior"
                    >
                      <ChevronLeft size={12} /> Ant
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (docAtivoIndex < docsProcessados.length - 1) {
                          setDocAtivoIndex(i => i + 1)
                          setPaginaAtualNoDoc(1)
                        }
                      }}
                      disabled={docAtivoIndex >= docsProcessados.length - 1}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: docAtivoIndex >= docsProcessados.length - 1 ? '#cbd5e1' : '#334155',
                        padding: '3px 7px',
                        borderRadius: 6,
                        cursor: docAtivoIndex >= docsProcessados.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      title="Próximo documento"
                    >
                      Próx <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docsProcessados.map((doc, idx) => {
                  const isAtivo = docAtivoIndex === idx
                  const diagDoc = diagnostico.porDocumento[idx]
                  const sigsNesteDoc = diagDoc?.posicionados.length || 0
                  const faltantesNesteDoc = diagDoc?.faltantes || []
                  const completoNesteDoc = Boolean(diagDoc?.completo)
                  const destacarAlertaDoc = tentouSalvarIncompleto && !completoNesteDoc

                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        if (docAtivoIndex !== idx) {
                          setDocAtivoIndex(idx)
                          setPaginaAtualNoDoc(1)
                          if (faltantesNesteDoc.length > 0 && !faltantesNesteDoc.some(f => f.id === signatarioAtivoId)) {
                            setSignatarioAtivoId(faltantesNesteDoc[0].id)
                          }
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: isAtivo
                          ? '#ffffff'
                          : destacarAlertaDoc
                          ? '#fff1f2'
                          : '#f1f5f9',
                        border: isAtivo
                          ? '2px solid #2563eb'
                          : destacarAlertaDoc
                          ? '1.5px solid #fca5a5'
                          : completoNesteDoc
                          ? '1px solid #a7f3d0'
                          : '1px solid #e2e8f0',
                        boxShadow: isAtivo
                          ? '0 4px 12px rgba(37, 99, 235, 0.08)'
                          : destacarAlertaDoc
                          ? '0 2px 8px rgba(225, 29, 72, 0.08)'
                          : 'none',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: completoNesteDoc
                                ? '#d1fae5'
                                : isAtivo
                                ? '#eff6ff'
                                : destacarAlertaDoc
                                ? '#ffe4e6'
                                : '#e2e8f0',
                              color: completoNesteDoc
                                ? '#047857'
                                : isAtivo
                                ? '#2563eb'
                                : destacarAlertaDoc
                                ? '#be123c'
                                : '#475569',
                              fontSize: 11,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {completoNesteDoc ? <Check size={12} strokeWidth={3} /> : idx + 1}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isAtivo ? 700 : 600,
                              color: isAtivo ? '#0f172a' : '#334155',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={doc.nome}
                          >
                            {doc.nome}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingLeft: 29 }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                          {doc.totalPaginas} {doc.totalPaginas === 1 ? 'página' : 'páginas'}
                        </span>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: completoNesteDoc
                              ? '#ecfdf5'
                              : destacarAlertaDoc
                              ? '#fef2f2'
                              : sigsNesteDoc > 0
                              ? '#eff6ff'
                              : '#fffbeb',
                            color: completoNesteDoc
                              ? '#047857'
                              : destacarAlertaDoc
                              ? '#b91c1c'
                              : sigsNesteDoc > 0
                              ? '#1d4ed8'
                              : '#b45309',
                            border: completoNesteDoc
                              ? '1px solid #a7f3d0'
                              : destacarAlertaDoc
                              ? '1px solid #fca5a5'
                              : sigsNesteDoc > 0
                              ? '1px solid #bfdbfe'
                              : '1px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          {completoNesteDoc
                            ? `✓ ${sigsNesteDoc}/${signatarios.length} assinaturas`
                            : `${sigsNesteDoc}/${signatarios.length} assinaturas (faltam ${faltantesNesteDoc.length})`}
                        </span>
                      </div>

                      {!completoNesteDoc && faltantesNesteDoc.length > 0 && (
                        <div
                          style={{
                            paddingLeft: 29,
                            fontSize: 10,
                            color: destacarAlertaDoc ? '#be123c' : '#b45309',
                            fontWeight: 600,
                            lineHeight: 1.35,
                          }}
                        >
                          Faltam: {faltantesNesteDoc.map(f => f.nome.split(' ')[0]).join(', ')}
                        </div>
                      )}

                      {isAtivo && doc.totalPaginas > 1 && paginaAtualNoDoc !== doc.totalPaginas && (
                        <div style={{ paddingLeft: 29, paddingTop: 2 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPaginaAtualNoDoc(doc.totalPaginas)
                            }}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Ir para última página (Pág. {doc.totalPaginas}) <ChevronsRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PASSO 2: PESSOAS PARA ASSINAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    2
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Pessoas para Assinar
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: assinaturasNoDocAtivo === signatarios.length && signatarios.length > 0 ? '#047857' : '#b45309',
                  }}
                >
                  {assinaturasNoDocAtivo}/{signatarios.length} neste doc
                </span>
              </div>

              <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                Escolha a pessoa abaixo e <strong>clique na folha ao lado</strong> onde ela deve assinar:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signatarios.map((sig, sigIdx) => {
                  const isAtivo = signatarioAtivoId === sig.id
                  const posEntryNesteDoc = Object.entries(posicoes).find(([_, p]) =>
                    verificarPosicaoSignatarioNoDoc(p, sig.id, docAtivo, docAtivoIndex, docsProcessados.length)
                  )
                  const posNesteDoc = posEntryNesteDoc?.[1]
                  const posKeyNesteDoc = posEntryNesteDoc?.[0]
                  const diagSig = diagnostico.porSignatario[sigIdx]
                  const docsPosicionadosCount = diagSig?.docsPosicionados.length || 0
                  const docsFaltantesSig = diagSig?.docsFaltantes || []
                  const completoEmTodosDocsSig = Boolean(diagSig?.completoEmTodosDocs)
                  const destacarAlertaSig = tentouSalvarIncompleto && (!posNesteDoc || !completoEmTodosDocsSig)

                  return (
                    <div
                      key={sig.id}
                      onClick={() => setSignatarioAtivoId(sig.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: destacarAlertaSig && !posNesteDoc ? '#fff1f2' : '#ffffff',
                        border: isAtivo
                          ? `2px solid ${sig.cor}`
                          : destacarAlertaSig
                          ? '1.5px solid #fca5a5'
                          : posNesteDoc && completoEmTodosDocsSig
                          ? '1px solid #a7f3d0'
                          : '1px solid #e2e8f0',
                        boxShadow: isAtivo ? `0 4px 14px ${sig.cor}22` : '0 1px 2px rgba(15, 23, 42, 0.03)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            background: `${sig.cor}15`,
                            border: `1.5px solid ${sig.cor}44`,
                            color: sig.cor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {sig.tipo === 'escola' ? <Building2 size={16} /> : <User size={16} />}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={sig.nome}
                          >
                            {sig.nome}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {sig.cargo}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                        {posNesteDoc ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSignatarioAtivoId(sig.id)
                                setPaginaAtualNoDoc(posNesteDoc.paginaRelativa || posNesteDoc.pagina)
                              }}
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#047857',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                padding: '2px 8px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Clique para ir até a página onde esta assinatura está posicionada"
                            >
                              <Check size={11} strokeWidth={3} /> Neste doc • Pág. {posNesteDoc.paginaRelativa || posNesteDoc.pagina}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {docsProcessados.length > 1 && (
                                completoEmTodosDocsSig ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: '#047857',
                                      background: '#ecfdf5',
                                      border: '1px solid #a7f3d0',
                                      padding: '1px 6px',
                                      borderRadius: 999,
                                      fontWeight: 700,
                                    }}
                                  >
                                    ✓ {docsPosicionadosCount}/{docsProcessados.length} docs
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (docsFaltantesSig[0]) {
                                        handleIrParaPendencia(docsFaltantesSig[0].docIdx, sig.id)
                                      }
                                    }}
                                    style={{
                                      fontSize: 10,
                                      color: '#b45309',
                                      background: '#fffbeb',
                                      border: '1px solid #fde68a',
                                      padding: '2px 6px',
                                      borderRadius: 6,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                    title={`Falta posicionar nos documentos: ${docsFaltantesSig.map(d => `Doc ${d.docIdx + 1}`).join(', ')}. Clique para ir até lá.`}
                                  >
                                    Falta em {docsFaltantesSig.length} doc(s) →
                                  </button>
                                )
                              )}
                              {posKeyNesteDoc && (
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoverPosicao(posKeyNesteDoc, e)}
                                  style={{
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    color: '#e11d48',
                                    padding: '3px 6px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  title="Remover assinatura deste documento"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 4, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: destacarAlertaSig ? '#b91c1c' : '#b45309',
                                background: destacarAlertaSig ? '#fef2f2' : '#fffbeb',
                                border: destacarAlertaSig ? '1px solid #fca5a5' : '1px solid #fde68a',
                                padding: '2px 8px',
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <AlertTriangle size={11} /> Pendente neste doc
                              {docsProcessados.length > 1 && ` (${docsPosicionadosCount}/${docsProcessados.length})`}
                            </span>
                            {isAtivo ? (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: sig.cor,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <MousePointerClick size={12} /> Clique na folha →
                              </span>
                            ) : (
                              <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 500 }}>
                                Clique para selecionar
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PASSO 3: TAMANHO DA ASSINATURA & DICAS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  3
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Tamanho da Assinatura
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  background: '#ffffff',
                  padding: 6,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              >
                {[
                  { label: 'P', desc: 'Pequena', l: 140, a: 36 },
                  { label: 'M', desc: 'Média', l: 190, a: 46 },
                  { label: 'G', desc: 'Grande', l: 230, a: 52 },
                  { label: 'GG', desc: 'Extra', l: 270, a: 60 },
                ].map((preset) => {
                  const isPresetAtivo = Math.abs(larguraAtivaPt - preset.l) < 20
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAplicarPresetTamanho(preset.l, preset.a)}
                      style={{
                        background: isPresetAtivo ? '#eff6ff' : '#f8fafc',
                        border: isPresetAtivo ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        color: isPresetAtivo ? '#1d4ed8' : '#334155',
                        borderRadius: 8,
                        padding: '6px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.15s ease',
                      }}
                      title={`Definir tamanho ${preset.desc} (${preset.l}x${preset.a} pt)`}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{preset.label}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.8 }}>{preset.desc}</span>
                    </button>
                  )
                })}
              </div>

              {/* Card Didático de Ajuda Rápida */}
              <div
                style={{
                  marginTop: 4,
                  padding: '12px',
                  borderRadius: 12,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e3a8a',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 11.5, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MousePointerClick size={14} /> Como manusear facilmente:
                </div>
                <div style={{ fontSize: 11, color: '#1e40af' }}>
                  • <strong>Inserir:</strong> Selecione a pessoa no Passo 2 e clique no local desejado da folha.<br />
                  • <strong>Mover:</strong> Arraste a caixa da assinatura livremente.<br />
                  • <strong>Ajustar:</strong> Arraste o canto inferior direito da caixa ou use os botões <strong>−</strong> e <strong>+</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* ── COLUNA DIREITA: WORKSPACE CLARO DO DOCUMENTO PDF ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              background: '#f1f5f9',
            }}
          >
            {/* Barra de Ferramentas Superior do Documento (Navegação de Página + Indicador Ativo + Zoom) */}
            <div
              style={{
                padding: '10px 20px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* Indicador de Quem Está Sendo Posicionado Agora */}
              {sigAtivoObj && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: `${sigAtivoObj.cor}12`,
                    border: `1px solid ${sigAtivoObj.cor}40`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: sigAtivoObj.cor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>
                    Posicionando: <strong style={{ color: '#0f172a' }}>{sigAtivoObj.nome}</strong>
                  </span>
                </div>
              )}

              {/* Controles Centrais de Navegação de Página + Botão Rápido Última Página */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    padding: '3px 6px',
                    borderRadius: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPaginaAtualNoDoc(1)}
                    disabled={paginaAtualNoDoc <= 1}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: paginaAtualNoDoc <= 1 ? '#cbd5e1' : '#334155',
                      cursor: paginaAtualNoDoc <= 1 ? 'not-allowed' : 'pointer',
                      padding: '4px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Primeira página deste documento"
                  >
                    <ChevronsLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={handlePaginaAnterior}
                    disabled={paginaAtualNoDoc <= 1 && docAtivoIndex <= 0}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: paginaAtualNoDoc <= 1 && docAtivoIndex <= 0 ? '#cbd5e1' : '#0f172a',
                      cursor: paginaAtualNoDoc <= 1 && docAtivoIndex <= 0 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: 7,
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Página anterior"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  {/* Seletor Direto de Página */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 6px' }}>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Pág.</span>
                    <select
                      value={paginaAtualNoDoc}
                      onChange={(e) => setPaginaAtualNoDoc(Number(e.target.value))}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      {Array.from({ length: totalPaginasDocAtivo }, (_, i) => i + 1).map((pNum) => (
                        <option key={pNum} value={pNum}>
                          {pNum}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                      de {totalPaginasDocAtivo}
                    </span>
                    {docsProcessados.length > 1 && (
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                        (Pacote {paginaGlobalAtual}/{totalPaginasPacote})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleProximaPagina}
                    disabled={paginaAtualNoDoc >= totalPaginasDocAtivo && docAtivoIndex >= docsProcessados.length - 1}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: paginaAtualNoDoc >= totalPaginasDocAtivo && docAtivoIndex >= docsProcessados.length - 1 ? '#cbd5e1' : '#0f172a',
                      cursor: paginaAtualNoDoc >= totalPaginasDocAtivo && docAtivoIndex >= docsProcessados.length - 1 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: 7,
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Próxima página"
                  >
                    Próxima <ChevronRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaginaAtualNoDoc(totalPaginasDocAtivo)}
                    disabled={paginaAtualNoDoc >= totalPaginasDocAtivo}
                    style={{
                      background: paginaAtualNoDoc < totalPaginasDocAtivo ? '#eff6ff' : 'transparent',
                      border: paginaAtualNoDoc < totalPaginasDocAtivo ? '1px solid #bfdbfe' : 'none',
                      color: paginaAtualNoDoc >= totalPaginasDocAtivo ? '#cbd5e1' : '#1d4ed8',
                      cursor: paginaAtualNoDoc >= totalPaginasDocAtivo ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Ir direto para a última página deste documento"
                  >
                    Última Pág. <ChevronsRight size={14} />
                  </button>
                </div>
              </div>

              {/* Controles de Zoom */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: '3px 6px',
                  borderRadius: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(60, z - 10))}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    padding: '4px 6px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Reduzir zoom"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#334155',
                    minWidth: 42,
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  title="Clique para restaurar zoom em 100%"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(140, z + 10))}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    padding: '4px 6px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Aumentar zoom"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* ── Área de Visualização da Folha (Fundo Claro de Estúdio, Sem Cores Dark) ── */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                backgroundColor: '#e2e8f0',
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '28px 24px',
                position: 'relative',
              }}
            >
              {carregandoPdf ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    color: '#334155',
                    background: '#ffffff',
                    padding: '28px 36px',
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)',
                    marginTop: 80,
                  }}
                >
                  <RefreshCw size={26} className="animate-spin" color="#2563eb" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Carregando página de {docAtivo?.nome ? `"${docAtivo.nome}"` : 'documento'}...
                  </span>
                </div>
              ) : erroPdf ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#dc2626',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    padding: '16px 22px',
                    borderRadius: 12,
                    marginTop: 80,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <AlertCircle size={20} />
                  <span>{erroPdf}</span>
                </div>
              ) : (
                <div
                  style={{
                    position: 'relative',
                    boxShadow: '0 12px 36px -4px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.06)',
                    borderRadius: 6,
                    overflow: 'visible',
                    background: '#ffffff',
                  }}
                >
                  {/* Canvas com a página renderizada do PDF */}
                  <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />

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
                    {Object.entries(posicoes)
                      .filter(([_, pos]) => {
                        if (docsProcessados.length > 1) {
                          if (pos.documentoId && pos.documentoId !== docAtivo.id) return false
                          if (pos.documentoId === docAtivo.id) {
                            return (pos.paginaRelativa || 1) === paginaAtualNoDoc
                          }
                          return pos.pagina === paginaGlobalAtual
                        }
                        return pos.pagina === paginaAtualNoDoc
                      })
                      .map(([posKey, pos]) => {
                        const sigInfo = signatarios.find(s => s.id === pos.signatarioId)
                        const cor = sigInfo?.cor || '#2563eb'
                        const isAtivo = signatarioAtivoId === pos.signatarioId
                        const larguraPt = pos.larguraPt || 190
                        const alturaPt = pos.alturaPt || 45
                        const boxWidthPx = Math.max(90, Math.round(larguraPt * currentScale))
                        const boxHeightPx = Math.max(28, Math.round(alturaPt * currentScale))

                        const nomeExibicao = formatSignatureDisplayName(sanitizeSignerName(pos.nome), 28)
                        const numChars = Math.max(1, nomeExibicao.length)
                        const largUtilPx = Math.max(60, boxWidthPx - 16)
                        const maxFontePorLargura = Math.floor(largUtilPx / (numChars * 0.46))
                        const maxFontePorAltura = Math.round(boxHeightPx * 0.38)
                        const baseFontSize = Math.max(9.5, Math.min(maxFontePorAltura, maxFontePorLargura, 26))

                        const textoSub = `Assinado eletronicamente ${new Date().toLocaleDateString('pt-BR')}`
                        const maxSubPorLargura = Math.floor(largUtilPx / (textoSub.length * 0.48))
                        const subFontSize = Math.max(6.5, Math.min(Math.round(boxHeightPx * 0.16), maxSubPorLargura, 9.5))

                        return (
                          <div
                            key={posKey}
                            onMouseDown={(e) => {
                              setSignatarioAtivoId(pos.signatarioId)
                              handleMouseDownItem(e, posKey)
                            }}
                            title={`${pos.nome} (${pos.cargo || 'Signatário'}) — Arraste para mover ou use o canto inferior direito para redimensionar`}
                            style={{
                              position: 'absolute',
                              left: `${pos.xPercent}%`,
                              top: `${pos.yPercent}%`,
                              width: boxWidthPx,
                              minHeight: boxHeightPx,
                              padding: '5px 8px',
                              borderRadius: 8,
                              background: isAtivo ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.84)',
                              backdropFilter: 'blur(4px)',
                              WebkitBackdropFilter: 'blur(4px)',
                              border: `${isAtivo ? '2px' : '1.5px'} dashed ${cor}`,
                              boxShadow: isAtivo
                                ? `0 0 0 3px ${cor}30, 0 8px 20px rgba(15, 23, 42, 0.14)`
                                : '0 2px 8px rgba(15, 23, 42, 0.08)',
                              cursor: redimensionandoId === posKey ? 'se-resize' : 'grab',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 2,
                              transition: arrastandoId === posKey || redimensionandoId === posKey ? 'none' : 'box-shadow 0.15s ease',
                              zIndex: isAtivo ? 50 : 20,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: 800,
                                  color: cor,
                                  background: '#ffffff',
                                  border: `1px solid ${cor}40`,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '58%',
                                }}
                              >
                                <Move size={7} /> {pos.tipo === 'escola' ? 'Instituição' : 'Responsável'}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  type="button"
                                  onClick={(e) => handleAjustarTamanho(posKey, -15, e)}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
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
                                <span style={{ fontSize: 8, color: '#475569', fontWeight: 700 }}>
                                  {Math.round(larguraPt)}pt
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleAjustarTamanho(posKey, 15, e)}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
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
                                  onClick={(e) => handleRemoverPosicao(posKey, e)}
                                  style={{
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    color: '#e11d48',
                                    cursor: 'pointer',
                                    padding: '1px 3px',
                                    borderRadius: 3,
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginLeft: 2,
                                  }}
                                  title="Remover assinatura desta página"
                                >
                                  <X size={9} />
                                </button>
                              </div>
                            </div>

                            {/* Assinatura Caligráfica */}
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
                                overflow: 'visible',
                                textShadow: '0 1px 2px rgba(255, 255, 255, 0.95)',
                                userSelect: 'none',
                              }}
                            >
                              {nomeExibicao}
                            </div>
                            <div
                              style={{
                                fontSize: subFontSize,
                                color: '#475569',
                                fontWeight: 600,
                                marginTop: 1,
                                paddingLeft: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'visible',
                              }}
                            >
                              {textoSub}
                            </div>

                            {/* Alça interativa de redimensionamento */}
                            <div
                              onMouseDown={(e) => handleMouseDownResize(e, posKey)}
                              title="Clique e arraste para redimensionar livremente"
                              style={{
                                position: 'absolute',
                                right: -1,
                                bottom: -1,
                                width: 15,
                                height: 15,
                                cursor: 'se-resize',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: cor,
                                color: '#ffffff',
                                borderTopLeftRadius: 5,
                                borderBottomRightRadius: 6,
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
          </div>
        </div>

        {/* ── BANNER DE AVISO DETALHADO DE PENDÊNCIAS (QUANDO INCOMPLETO) ── */}
        <AnimatePresence>
          {!todosPosicionados && tentouSalvarIncompleto && (
            <motion.div
              key={`alerta-incompleto-${shakeTrigger}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, x: [0, -7, 7, -5, 5, -2, 2, 0] }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35 }}
              role="alert"
              aria-live="assertive"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(90deg, #fef2f2 0%, #fffbeb 100%)',
                borderTop: '1.5px solid #fca5a5',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#991b1b', fontSize: 12.5, fontWeight: 700 }}>
                  <AlertCircle size={17} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>
                    Atenção: Só é permitido confirmar e salvar após posicionar <strong>todas as {signatarios.length} assinaturas</strong> em{' '}
                    <strong>{docsProcessados.length > 1 ? `todos os ${docsProcessados.length} documentos` : 'todo o documento'}</strong>!{' '}
                    <span style={{ color: '#b45309', fontWeight: 800 }}>
                      (Faltam {diagnostico.totalFaltante} de {diagnostico.totalEsperado} posições)
                    </span>
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleIrParaPendencia()}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      padding: '5px 11px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    Ir para próxima pendência <ArrowRight size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoPosicionarPendentes}
                    style={{
                      background: '#dc2626',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                    }}
                  >
                    <Sparkles size={12} /> Auto-Posicionar {diagnostico.totalFaltante} Pendente(s) no Rodapé
                  </button>
                </div>
              </div>

              {/* Detalhamento de quais documentos e pessoas estão pendentes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7f1d1d' }}>Pendências por documento:</span>
                {diagnostico.docsIncompletos.map((d) => {
                  const isDocAtual = d.docIdx === docAtivoIndex
                  const nomesCurto = d.faltantes.map(f => f.nome.split(' ')[0]).join(', ')
                  return (
                    <button
                      key={d.doc.id}
                      type="button"
                      onClick={() => handleIrParaPendencia(d.docIdx, d.faltantes[0]?.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: isDocAtual ? '#fee2e2' : '#ffffff',
                        color: '#991b1b',
                        border: isDocAtual ? '1.5px solid #ef4444' : '1px solid #fecaca',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title={`Clique para ir ao Documento ${d.docIdx + 1} (${d.doc.nome}) — Faltam: ${d.faltantes.map(f => f.nome).join(', ')}`}
                    >
                      <span>
                        Doc {d.docIdx + 1}: faltam {d.faltantes.length}/{signatarios.length} ({nomesCurto})
                      </span>
                      <ArrowRight size={10} />
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FOOTER CLARO COM RESUMO E CONFIRMAÇÃO ── */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#475569', flexWrap: 'wrap' }}>
            <span
              style={{
                color: todosPosicionados
                  ? '#047857'
                  : tentouSalvarIncompleto
                  ? '#b91c1c'
                  : '#b45309',
                background: todosPosicionados
                  ? '#ecfdf5'
                  : tentouSalvarIncompleto
                  ? '#fef2f2'
                  : '#fffbeb',
                border: todosPosicionados
                  ? '1px solid #a7f3d0'
                  : tentouSalvarIncompleto
                  ? '1px solid #fca5a5'
                  : '1px solid #fde68a',
                padding: '4px 10px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {todosPosicionados ? (
                <>
                  <CheckCircle2 size={13} />
                  {signatarios.length} de {signatarios.length} pessoas posicionadas
                  {docsProcessados.length > 1 && ` • ${diagnostico.totalPosicionado}/${diagnostico.totalEsperado} posições em ${docsProcessados.length} documentos`}
                </>
              ) : (
                <>
                  <AlertTriangle size={13} />
                  {diagnostico.sigsCompletosEmTodosDocsCount} de {signatarios.length} pessoas posicionadas
                  {docsProcessados.length > 1
                    ? ` • ${diagnostico.totalPosicionado}/${diagnostico.totalEsperado} posições em ${docsProcessados.length} documentos (faltam ${diagnostico.totalFaltante})`
                    : ` (faltam ${diagnostico.totalFaltante})`}
                </>
              )}
            </span>
            <span style={{ color: todosPosicionados ? '#047857' : '#64748b', fontSize: 12, fontWeight: todosPosicionados ? 600 : 400 }}>
              {todosPosicionados
                ? 'Tudo pronto! Todas as assinaturas foram posicionadas em todos os documentos.'
                : docsProcessados.length > 1
                ? `Posicione todas as ${signatarios.length} pessoas nos ${docsProcessados.length} documentos para liberar a confirmação.`
                : `Posicione todas as ${signatarios.length} pessoas na folha para liberar a confirmação.`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {docsProcessados.length > 1 && (!todosPosicionados && diagnostico.docsIncompletos.some(d => d.docIdx !== docAtivoIndex) ? (
              <button
                type="button"
                onClick={() => {
                  const proxIncompleto =
                    diagnostico.docsIncompletos.find(d => d.docIdx > docAtivoIndex) ||
                    diagnostico.docsIncompletos.find(d => d.docIdx !== docAtivoIndex)
                  if (proxIncompleto) {
                    handleIrParaPendencia(proxIncompleto.docIdx, proxIncompleto.faltantes[0]?.id)
                  }
                }}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  color: '#1d4ed8',
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Avançar para o próximo documento que ainda possui assinaturas pendentes"
              >
                {(() => {
                  const prox =
                    diagnostico.docsIncompletos.find(d => d.docIdx > docAtivoIndex) ||
                    diagnostico.docsIncompletos.find(d => d.docIdx !== docAtivoIndex)
                  return prox
                    ? `Próximo Documento (${prox.docIdx + 1}/${docsProcessados.length}) • Faltam ${prox.faltantes.length}`
                    : `Próximo Documento (${docAtivoIndex + 2}/${docsProcessados.length})`
                })()}{' '}
                <ChevronRight size={15} />
              </button>
            ) : docAtivoIndex < docsProcessados.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setDocAtivoIndex(i => i + 1)
                  setPaginaAtualNoDoc(1)
                }}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Próximo Documento ({docAtivoIndex + 2}/{docsProcessados.length}) <ChevronRight size={15} />
              </button>
            ) : null)}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '9px 18px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.color = '#475569'
              }}
            >
              Cancelar
            </button>

            <motion.button
              key={`btn-salvar-${shakeTrigger}`}
              type="button"
              aria-disabled={!todosPosicionados}
              onClick={handleConfirmarESalvar}
              animate={
                !todosPosicionados && shakeTrigger > 0
                  ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.35 }}
              title={
                todosPosicionados
                  ? 'Confirmar e salvar todas as posições definidas'
                  : `Bloqueado: Posicione todas as assinaturas em todos os documentos antes de salvar (faltam ${diagnostico.totalFaltante} de ${diagnostico.totalEsperado})`
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: todosPosicionados
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : tentouSalvarIncompleto
                  ? '#fef2f2'
                  : '#f1f5f9',
                border: todosPosicionados
                  ? 'none'
                  : tentouSalvarIncompleto
                  ? '1.5px solid #fca5a5'
                  : '1.5px solid #cbd5e1',
                color: todosPosicionados
                  ? '#ffffff'
                  : tentouSalvarIncompleto
                  ? '#b91c1c'
                  : '#64748b',
                padding: '9px 20px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: todosPosicionados ? 'pointer' : 'not-allowed',
                boxShadow: todosPosicionados
                  ? '0 4px 12px rgba(16, 185, 129, 0.30)'
                  : 'none',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {todosPosicionados ? (
                <>
                  <Check size={16} strokeWidth={2.5} /> Confirmar e Salvar Posições
                </>
              ) : (
                <>
                  <Lock size={15} strokeWidth={2.2} />
                  <span>Confirmar e Salvar Posições</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: tentouSalvarIncompleto ? '#fee2e2' : '#e2e8f0',
                      color: tentouSalvarIncompleto ? '#991b1b' : '#475569',
                    }}
                  >
                    Faltam {diagnostico.totalFaltante}
                  </span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
