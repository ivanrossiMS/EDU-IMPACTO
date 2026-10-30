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

export function construirChavePosicao(
  sigId: string,
  docId: string,
  paginaRelativa: number
): string {
  return `${sigId}_doc_${docId}_pag_${Math.max(1, paginaRelativa || 1)}`
}

/**
 * Calcula o tamanho ideal da caixa de assinatura (justo ao texto caligráfico + rodapé eletrônico,
 * sem sobra em branco na lateral direita, referência ~117x42pt).
 */
export function calcularDimensoesIdeaisAssinatura(nome?: string): { larguraPt: number; alturaPt: number } {
  const limpo = formatSignatureDisplayName(sanitizeSignerName(nome || ''), 28)
  const chars = Math.max(10, limpo.length)
  const larguraPt = Math.max(115, Math.min(145, Math.round(chars * 4.8 + 25)))
  return { larguraPt, alturaPt: 42 }
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
    const dim = calcularDimensoesIdeaisAssinatura(sig.nome)
    novas[sig.id] = {
      id: sig.id,
      signatarioId: sig.id,
      nome: sig.nome,
      cargo: sig.cargo,
      cpf: sig.cpf,
      tipo: sig.tipo,
      pagina: totalPags,
      xPercent: 36,
      yPercent: 82,
      larguraPt: dim.larguraPt,
      alturaPt: dim.alturaPt,
      estiloCaligrafico: sig.estiloCaligrafico || 'classica',
      assinaturaBase64: sig.assinaturaBase64 || undefined,
    }
  } else if (count === 2) {
    signatarios.forEach((sig, idx) => {
      const dim = calcularDimensoesIdeaisAssinatura(sig.nome)
      novas[sig.id] = {
        id: sig.id,
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: idx === 0 ? 12 : 58,
        yPercent: 82,
        larguraPt: dim.larguraPt,
        alturaPt: dim.alturaPt,
        estiloCaligrafico: sig.estiloCaligrafico || 'classica',
        assinaturaBase64: sig.assinaturaBase64 || undefined,
      }
    })
  } else {
    // 3 ou mais signatários: distribui em grade harmoniosa no rodapé
    signatarios.forEach((sig, idx) => {
      const linha = Math.floor(idx / 2)
      const col = idx % 2
      const dim = calcularDimensoesIdeaisAssinatura(sig.nome)
      novas[sig.id] = {
        id: sig.id,
        signatarioId: sig.id,
        nome: sig.nome,
        cargo: sig.cargo,
        cpf: sig.cpf,
        tipo: sig.tipo,
        pagina: totalPags,
        xPercent: col === 0 ? 10 : 56,
        yPercent: 72 + linha * 12,
        larguraPt: dim.larguraPt,
        alturaPt: dim.alturaPt,
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
    const totalPagsDoc = Math.max(1, d.totalPaginas || 1)
    const base = gerarPosicionamentoPadrao(signatarios, totalPagsDoc)
    const res: Record<string, PosicaoAssinatura> = {}
    for (const [_, p] of Object.entries(base)) {
      const posKey = construirChavePosicao(p.signatarioId, d.id, p.pagina)
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
      const key = construirChavePosicao(sigId, doc.id, totalPagsDoc)
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

/**
 * Gera posicionamento padrão em TODAS as páginas de cada documento.
 */
export function gerarPosicionamentoTodasPaginasDocumentos(
  signatarios: SignatarioPosicionavel[],
  documentos: Array<{ id: string; nome: string; totalPaginas: number; pdfBase64?: string }>
): Record<string, PosicaoAssinatura> {
  if (signatarios.length === 0) return {}
  const docsEfetivos =
    documentos && documentos.length > 0
      ? documentos
      : [{ id: 'doc_1', nome: 'Documento', totalPaginas: 1 }]

  const resultado: Record<string, PosicaoAssinatura> = {}
  let acumuladoPaginas = 0

  docsEfetivos.forEach((doc, idx) => {
    const docId = doc.id || `doc_${idx + 1}`
    const totalPagsDoc = Math.max(1, doc.totalPaginas || 1)
    const paginaInicioGlobal = acumuladoPaginas + 1
    acumuladoPaginas += totalPagsDoc

    for (let pagRel = 1; pagRel <= totalPagsDoc; pagRel++) {
      const paginaGlobal = paginaInicioGlobal + (pagRel - 1)
      const padrao = gerarPosicionamentoPadrao(signatarios, paginaGlobal)
      for (const [sigId, p] of Object.entries(padrao)) {
        const key = construirChavePosicao(sigId, docId, pagRel)
        resultado[key] = {
          ...p,
          id: key,
          documentoId: docId,
          documentoNome: doc.nome,
          pagina: paginaGlobal,
          paginaRelativa: pagRel,
        }
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
  totalAssinaturasNoDoc: number
  paginasComAssinatura: number[]
  contagemPorPagina: Record<number, number>
}

export interface DiagnosticoSignatarioPosicionamento {
  sig: SignatarioPosicionavel
  docsPosicionados: Array<{ id: string; nome: string; docIdx: number }>
  docsFaltantes: Array<{ id: string; nome: string; docIdx: number }>
  completoEmTodosDocs: boolean
  totalAssinaturas: number
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

export function verificarPosicaoPertenceAoDoc(
  pos: PosicaoAssinatura,
  doc: { id: string; paginaInicioGlobal?: number; paginaFimGlobal?: number },
  docIdx: number,
  totalDocs: number
): boolean {
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

export function obterPaginaRelativaNoDoc(
  pos: PosicaoAssinatura,
  doc: { id: string; totalPaginas?: number; paginaInicioGlobal?: number; paginaFimGlobal?: number },
  totalDocs: number
): number {
  if (typeof pos.paginaRelativa === 'number' && pos.paginaRelativa >= 1) {
    return pos.paginaRelativa
  }
  if (
    totalDocs > 1 &&
    typeof doc.paginaInicioGlobal === 'number' &&
    pos.pagina >= doc.paginaInicioGlobal
  ) {
    return pos.pagina - doc.paginaInicioGlobal + 1
  }
  return Math.max(1, pos.pagina || 1)
}

export function verificarPosicaoSignatarioNoDoc(
  pos: PosicaoAssinatura,
  sigId: string,
  doc: { id: string; paginaInicioGlobal?: number; paginaFimGlobal?: number },
  docIdx: number,
  totalDocs: number
): boolean {
  if (pos.signatarioId !== sigId) return false
  return verificarPosicaoPertenceAoDoc(pos, doc, docIdx, totalDocs)
}

export function verificarPosicaoSignatarioNaPagina(
  pos: PosicaoAssinatura,
  sigId: string,
  doc: { id: string; totalPaginas?: number; paginaInicioGlobal?: number; paginaFimGlobal?: number },
  docIdx: number,
  totalDocs: number,
  paginaRelativaAlvo: number
): boolean {
  if (!verificarPosicaoSignatarioNoDoc(pos, sigId, doc, docIdx, totalDocs)) return false
  return obterPaginaRelativaNoDoc(pos, doc, totalDocs) === paginaRelativaAlvo
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
    const posicoesNesteDoc = listaPosicoes.filter((p) =>
      verificarPosicaoPertenceAoDoc(p, doc, docIdx, totalDocs)
    )

    const contagemPorPagina: Record<number, number> = {}
    posicoesNesteDoc.forEach((p) => {
      const pagRel = obterPaginaRelativaNoDoc(p, doc, totalDocs)
      contagemPorPagina[pagRel] = (contagemPorPagina[pagRel] || 0) + 1
    })
    const paginasComAssinatura = Object.keys(contagemPorPagina)
      .map(Number)
      .sort((a, b) => a - b)

    signatarios.forEach((sig) => {
      const encontrado = posicoesNesteDoc.some((p) => p.signatarioId === sig.id)
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
      totalAssinaturasNoDoc: posicoesNesteDoc.length,
      paginasComAssinatura,
      contagemPorPagina,
    }
  })

  const porSignatario: DiagnosticoSignatarioPosicionamento[] = signatarios.map((sig) => {
    const docsPosicionados: Array<{ id: string; nome: string; docIdx: number }> = []
    const docsFaltantes: Array<{ id: string; nome: string; docIdx: number }> = []
    const totalAssinaturas = listaPosicoes.filter((p) => p.signatarioId === sig.id).length

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
      totalAssinaturas,
    }
  })

  const totalEsperado = totalDocs * signatarios.length
  const totalPosicionado = listaPosicoes.length
  const totalFaltante = porDocumento.reduce((acc, item) => acc + item.faltantes.length, 0)
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
  paginaInicial?: number | null
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
  paginaInicial,
}: PosicionadorAssinaturasModalProps) {
  const [numPaginasPdfCarregado, setNumPaginasPdfCarregado] = useState<number | null>(null)

  // Processa a lista de documentos calculando as faixas de páginas globais
  const docsProcessados = useMemo<DocumentoItemPosicionador[]>(() => {
    if (!documentos || documentos.length === 0) {
      const pags = Math.max(1, totalPaginas || numPaginasPdfCarregado || 1)
      return [{
        id: 'doc_1',
        nome: documentoNome || 'Documento',
        totalPaginas: pags,
        pdfBase64: pdfBase64 || '',
        paginaInicioGlobal: 1,
        paginaFimGlobal: pags,
      }]
    }
    let acumulado = 0
    return documentos.map((d, idx) => {
      const pags = Math.max(1, d.totalPaginas || (documentos.length === 1 && numPaginasPdfCarregado ? numPaginasPdfCarregado : 1))
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
  }, [documentos, documentoNome, totalPaginas, pdfBase64, numPaginasPdfCarregado])

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
  const [tamanhoPadraoPt, setTamanhoPadraoPt] = useState<{ largura: number; altura: number }>({
    largura: 117,
    altura: 42,
  })
  const [presetCustomizado, setPresetCustomizado] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(80)
  const [carregandoPdf, setCarregandoPdf] = useState<boolean>(true)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const pageWrapperRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const overlayRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const renderTasksRef = useRef<Record<number, any>>({})
  const pdfDocRef = useRef<any>(null)
  const abertoAnteriorRef = useRef<boolean>(false)
  const isProgrammaticScrollRef = useRef<boolean>(false)

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

  // Rola suavemente até uma página específica no container vertical
  const rolarParaPagina = useCallback((pNum: number, smooth = true) => {
    setPaginaAtualNoDoc(pNum)
    const wrapper = pageWrapperRefs.current[pNum]
    const container = scrollContainerRef.current
    if (wrapper && container) {
      isProgrammaticScrollRef.current = true
      const topTarget = Math.max(0, wrapper.offsetTop - 16)
      container.scrollTo({
        top: topTarget,
        behavior: smooth ? 'smooth' : 'auto',
      })
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 420)
    }
  }, [])

  // Sincroniza posições iniciais e zoom 80% ao abrir o modal
  useEffect(() => {
    if (aberto && !abertoAnteriorRef.current) {
      setPosicoes({ ...posicoesAtuais })
      setDocAtivoIndex(0)
      setZoom(80)
      setPresetCustomizado(false)
      setTamanhoPadraoPt({ largura: 117, altura: 42 })
      const pagIni = paginaInicial && paginaInicial >= 1 ? paginaInicial : 1
      setPaginaAtualNoDoc(pagIni)
      if (signatarioInicialId) {
        setSignatarioAtivoId(signatarioInicialId)
      } else if (signatarios.length > 0) {
        setSignatarioAtivoId(signatarios[0].id)
      }
      if (pagIni > 1) {
        setTimeout(() => rolarParaPagina(pagIni, false), 180)
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
    }
    abertoAnteriorRef.current = aberto
  }, [aberto, posicoesAtuais, signatarios, signatarioInicialId, paginaInicial, rolarParaPagina])

  // Ao trocar de documento, volta o scroll para o topo (Página 1)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [docAtivoIndex])

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
        if (doc?.numPages) {
          setNumPaginasPdfCarregado(doc.numPages)
        }
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

  // Renderiza TODAS as páginas do documento ativo empilhadas verticalmente para rolagem com o mouse
  const renderizarTodasPaginas = useCallback(async () => {
    if (!pdfDocRef.current) return

    try {
      Object.values(renderTasksRef.current).forEach((t) => {
        try {
          t?.cancel?.()
        } catch {}
      })
      renderTasksRef.current = {}

      const numPages = pdfDocRef.current.numPages || 1
      const availableWidth = typeof window !== 'undefined' && window.innerWidth > 960 ? window.innerWidth - 440 : 680
      const maxDisplayWidth = Math.max(320, Math.min(availableWidth, 740))
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

      for (let pNum = 1; pNum <= numPages; pNum++) {
        const page = await pdfDocRef.current.getPage(pNum)
        const canvas = canvasRefs.current[pNum]
        if (!canvas) continue
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        const unscaledViewport = page.getViewport({ scale: 1 })
        const baseScale = maxDisplayWidth / unscaledViewport.width
        const effectiveScale = baseScale * (zoom / 100)
        if (pNum === 1) {
          setCurrentScale(effectiveScale)
        }

        const viewport = page.getViewport({ scale: effectiveScale })

        canvas.width = Math.round(viewport.width * dpr)
        canvas.height = Math.round(viewport.height * dpr)
        canvas.style.width = `${Math.round(viewport.width)}px`
        canvas.style.height = `${Math.round(viewport.height)}px`

        const overlay = overlayRefs.current[pNum]
        if (overlay) {
          overlay.style.width = `${Math.round(viewport.width)}px`
          overlay.style.height = `${Math.round(viewport.height)}px`
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const task = page.render({
          canvasContext: ctx,
          viewport,
        })
        renderTasksRef.current[pNum] = task
        await task.promise
      }
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn('[PosicionadorAssinaturas] Erro no render das páginas:', e)
      }
    }
  }, [zoom])

  useEffect(() => {
    if (!carregandoPdf && pdfDocRef.current) {
      renderizarTodasPaginas()
    }
  }, [carregandoPdf, zoom, totalPaginasDocAtivo, renderizarTodasPaginas])

  // Atualiza automaticamente `paginaAtualNoDoc` conforme o usuário rola as páginas com o mouse
  const handleScrollWorkspace = useCallback(() => {
    if (isProgrammaticScrollRef.current) return
    const container = scrollContainerRef.current
    if (!container) return

    const viewCenterY = container.scrollTop + container.clientHeight * 0.38
    let melhorPagina = 1
    let menorDistancia = Infinity

    for (let pNum = 1; pNum <= totalPaginasDocAtivo; pNum++) {
      const wrapper = pageWrapperRefs.current[pNum]
      if (!wrapper) continue
      const top = wrapper.offsetTop
      const bottom = top + wrapper.offsetHeight
      if (viewCenterY >= top && viewCenterY <= bottom) {
        melhorPagina = pNum
        break
      }
      const dist = Math.min(Math.abs(viewCenterY - top), Math.abs(viewCenterY - bottom))
      if (dist < menorDistancia) {
        menorDistancia = dist
        melhorPagina = pNum
      }
    }

    setPaginaAtualNoDoc((prev) => (prev !== melhorPagina ? melhorPagina : prev))
  }, [totalPaginasDocAtivo])

  // Diagnóstico completo de validação (todos os signatários em todos os documentos)
  const diagnostico = useMemo(() => {
    return validarPosicionamentoCompleto(signatarios, docsProcessados, posicoes)
  }, [signatarios, docsProcessados, posicoes])

  // Clique no overlay de uma página específica para posicionar o signatário ativo NESTA página
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>, paginaAlvo: number) => {
    if (arrastandoId || redimensionandoId) return // Não reposiciona se acabou de arrastar ou redimensionar
    const overlayEl = overlayRefs.current[paginaAlvo]
    if (!overlayEl) return
    const sigAtivo = signatarios.find(s => s.id === signatarioAtivoId) || signatarios[0]
    if (!sigAtivo) return

    setPaginaAtualNoDoc(paginaAlvo)

    const rect = overlayEl.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top

    const posKey = construirChavePosicao(sigAtivo.id, docAtivo.id, paginaAlvo)
    const paginaGlobalAlvo = (docAtivo?.paginaInicioGlobal || 1) + (paginaAlvo - 1)

    // Verifica se já existia posição para este signatário NESTA página específica do documento ativo
    const entryExistenteNaPagina = Object.entries(posicoes).find(([_, p]) =>
      verificarPosicaoSignatarioNaPagina(
        p,
        sigAtivo.id,
        docAtivo,
        docAtivoIndex,
        docsProcessados.length,
        paginaAlvo
      )
    )
    // Herda tamanho já configurado para este signatário em outra página, ou calcula o tamanho ideal justo ao nome (~117pt)
    const entryExistenteDoSig =
      entryExistenteNaPagina ||
      Object.entries(posicoes).find(([_, p]) => p.signatarioId === sigAtivo.id)

    const dimIdeal = calcularDimensoesIdeaisAssinatura(sigAtivo.nome)
    const keyReal = entryExistenteNaPagina?.[0] || posKey
    const posExistenteNaPagina = entryExistenteNaPagina?.[1]
    const larguraPt =
      posExistenteNaPagina?.larguraPt ||
      entryExistenteDoSig?.[1]?.larguraPt ||
      (presetCustomizado ? tamanhoPadraoPt.largura : dimIdeal.larguraPt)
    const alturaPt =
      posExistenteNaPagina?.alturaPt ||
      entryExistenteDoSig?.[1]?.alturaPt ||
      (presetCustomizado ? tamanhoPadraoPt.altura : dimIdeal.alturaPt)

    const boxWidthPx = larguraPt * currentScale
    const boxHeightPx = alturaPt * currentScale

    // Calcula percentual (0 a 100%) garantindo que a caixinha não fique fora da folha
    const maxXPercent = Math.max(55, 98 - (boxWidthPx / Math.max(1, rect.width)) * 100)
    const maxYPercent = Math.max(60, 96 - (boxHeightPx / Math.max(1, rect.height)) * 100)
    const xPercent = Math.max(2, Math.min(maxXPercent, ((xPx - boxWidthPx / 2) / rect.width) * 100))
    const yPercent = Math.max(2, Math.min(maxYPercent, ((yPx - boxHeightPx / 2) / rect.height) * 100))

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
        pagina: paginaGlobalAlvo,
        paginaRelativa: paginaAlvo,
        xPercent,
        yPercent,
        larguraPt,
        alturaPt,
        estiloCaligrafico: sigAtivo.estiloCaligrafico || 'classica',
        assinaturaBase64: sigAtivo.assinaturaBase64 || undefined,
      },
    }))

    // Se este signatário ainda não estava posicionado NESTA página, avança automaticamente
    // a seleção para o próximo signatário que ainda não tem assinatura NESTA página
    if (!posExistenteNaPagina) {
      const proximoPendenteNaPagina = signatarios.find(
        s =>
          s.id !== sigAtivo.id &&
          !Object.values(posicoes).some(p =>
            verificarPosicaoSignatarioNaPagina(
              p,
              s.id,
              docAtivo,
              docAtivoIndex,
              docsProcessados.length,
              paginaAlvo
            )
          )
      )
      if (proximoPendenteNaPagina) {
        setSignatarioAtivoId(proximoPendenteNaPagina.id)
      }
    }
  }

  // Manipulação de Arrastar (Drag and drop) das caixinhas em qualquer página
  const handleMouseDownItem = (e: React.MouseEvent, posKey: string, paginaAlvo: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const item = posicoes[posKey]
    if (!item) return
    setPaginaAtualNoDoc(paginaAlvo)
    setArrastandoId(posKey)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origXPercent: item.xPercent,
      origYPercent: item.yPercent,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const overlayEl = overlayRefs.current[paginaAlvo]
      if (!dragStartRef.current || !overlayEl) return
      const rect = overlayEl.getBoundingClientRect()
      const deltaX = moveEvent.clientX - dragStartRef.current.startX
      const deltaY = moveEvent.clientY - dragStartRef.current.startY

      const deltaXPercent = (deltaX / rect.width) * 100
      const deltaYPercent = (deltaY / rect.height) * 100

      const larguraPt = item.larguraPt || 117
      const alturaPt = item.alturaPt || 42
      const boxWidthPx = larguraPt * currentScale
      const boxHeightPx = alturaPt * currentScale
      const maxXPercent = Math.max(55, 98 - (boxWidthPx / Math.max(1, rect.width)) * 100)
      const maxYPercent = Math.max(60, 96 - (boxHeightPx / Math.max(1, rect.height)) * 100)

      const newXPercent = Math.max(2, Math.min(maxXPercent, dragStartRef.current.origXPercent + deltaXPercent))
      const newYPercent = Math.max(2, Math.min(maxYPercent, dragStartRef.current.origYPercent + deltaYPercent))

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
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const item = posicoes[posKey]
    if (!item) return

    const origLargura = item.larguraPt || 117
    const origAltura = item.alturaPt || 42
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

      const newLarguraPt = Math.max(85, Math.min(320, Math.round(resizeStartRef.current.origLarguraPt + deltaWidthPt)))
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
      const curL = item.larguraPt || 117
      const curA = item.alturaPt || 42
      const ratio = curA / curL
      const newL = Math.max(85, Math.min(320, Math.round(curL + deltaPt)))
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

  // Aplica preset de tamanho para a assinatura ativa na página atual (e como padrão para novas)
  const handleAplicarPresetTamanho = (largura: number, altura: number) => {
    setPresetCustomizado(true)
    setTamanhoPadraoPt({ largura, altura })
    setPosicoes(prev => {
      const copy = { ...prev }
      const entryNaPagina = Object.entries(copy).find(([_, p]) =>
        verificarPosicaoSignatarioNaPagina(
          p,
          signatarioAtivoId,
          docAtivo,
          docAtivoIndex,
          docsProcessados.length,
          paginaAtualNoDoc
        )
      )
      if (entryNaPagina) {
        const [k, pos] = entryNaPagina
        copy[k] = { ...pos, larguraPt: largura, alturaPt: altura }
      } else {
        let atualizouDoSignatario = false
        Object.keys(copy).forEach(k => {
          if (copy[k].signatarioId === signatarioAtivoId) {
            copy[k] = { ...copy[k], larguraPt: largura, alturaPt: altura }
            atualizouDoSignatario = true
          }
        })
        if (!atualizouDoSignatario) {
          Object.keys(copy).forEach(k => {
            copy[k] = { ...copy[k], larguraPt: largura, alturaPt: altura }
          })
        }
      }
      return copy
    })
  }

  // Remove uma posição específica (de uma página específica)
  const handleRemoverPosicao = (posKey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPosicoes(prev => {
      const copy = { ...prev }
      delete copy[posKey]
      return copy
    })
  }

  // Remove todas as posições de um signatário no documento ativo
  const handleRemoverSignatarioDoDocAtivo = (sigId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPosicoes(prev => {
      const copy = { ...prev }
      Object.entries(copy).forEach(([k, p]) => {
        if (verificarPosicaoSignatarioNoDoc(p, sigId, docAtivo, docAtivoIndex, docsProcessados.length)) {
          delete copy[k]
        }
      })
      return copy
    })
  }

  // Replica a assinatura de um signatário para TODAS as páginas do documento ativo
  const handleReplicarSignatarioEmTodasPaginas = (sigId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const sig = signatarios.find(s => s.id === sigId)
    if (!sig) return
    const totalPagsDoc = Math.max(1, docAtivo.totalPaginas || 1)
    const paginaInicioGlobal = docAtivo.paginaInicioGlobal || 1

    setPosicoes(prev => {
      const copy = { ...prev }
      // Usa como referência a posição na página atual, ou qualquer página já posicionada deste signatário no doc
      const refEntryNaPagina = Object.entries(copy).find(([_, p]) =>
        verificarPosicaoSignatarioNaPagina(p, sigId, docAtivo, docAtivoIndex, docsProcessados.length, paginaAtualNoDoc)
      )
      const refEntryNoDoc =
        refEntryNaPagina ||
        Object.entries(copy).find(([_, p]) =>
          verificarPosicaoSignatarioNoDoc(p, sigId, docAtivo, docAtivoIndex, docsProcessados.length)
        )

      const padrao = gerarPosicionamentoPadrao(signatarios, 1)[sigId]
      const dimIdeal = calcularDimensoesIdeaisAssinatura(sig.nome)
      const baseX = refEntryNoDoc?.[1]?.xPercent ?? padrao?.xPercent ?? 36
      const baseY = refEntryNoDoc?.[1]?.yPercent ?? padrao?.yPercent ?? 82
      const baseL =
        refEntryNoDoc?.[1]?.larguraPt ?? (presetCustomizado ? tamanhoPadraoPt.largura : dimIdeal.larguraPt)
      const baseA =
        refEntryNoDoc?.[1]?.alturaPt ?? (presetCustomizado ? tamanhoPadraoPt.altura : dimIdeal.alturaPt)

      // Remove chaves antigas sem sufixo de página deste signatário neste doc para evitar duplicatas
      Object.entries(copy).forEach(([k, p]) => {
        if (verificarPosicaoSignatarioNoDoc(p, sigId, docAtivo, docAtivoIndex, docsProcessados.length)) {
          delete copy[k]
        }
      })

      for (let pagRel = 1; pagRel <= totalPagsDoc; pagRel++) {
        const key = construirChavePosicao(sigId, docAtivo.id, pagRel)
        const pagGlobal = paginaInicioGlobal + (pagRel - 1)
        copy[key] = {
          id: key,
          signatarioId: sig.id,
          nome: sig.nome,
          cargo: sig.cargo,
          cpf: sig.cpf,
          tipo: sig.tipo,
          documentoId: docAtivo.id,
          documentoNome: docAtivo.nome,
          pagina: pagGlobal,
          paginaRelativa: pagRel,
          xPercent: baseX,
          yPercent: baseY,
          larguraPt: baseL,
          alturaPt: baseA,
          estiloCaligrafico: sig.estiloCaligrafico || 'classica',
          assinaturaBase64: sig.assinaturaBase64 || undefined,
        }
      }
      return copy
    })

    toast.success(
      `Assinatura de "${sig.nome}" adicionada em todas as ${totalPagsDoc} páginas de "${docAtivo.nome}"!`
    )
  }

  // Auto-posiciona todos os signatários no rodapé da PÁGINA ATUAL (preservando outras páginas)
  const handleAutoPosicionarPaginaAtual = () => {
    const padrao = gerarPosicionamentoPadrao(signatarios, paginaGlobalAtual)
    if (Object.keys(padrao).length === 0) return

    setPosicoes(prev => {
      const copy = { ...prev }
      for (const [sigId, p] of Object.entries(padrao)) {
        // Remove eventual chave legada da mesma página
        const existente = Object.entries(copy).find(([_, item]) =>
          verificarPosicaoSignatarioNaPagina(item, sigId, docAtivo, docAtivoIndex, docsProcessados.length, paginaAtualNoDoc)
        )
        if (existente) {
          delete copy[existente[0]]
        }
        const key = construirChavePosicao(sigId, docAtivo.id, paginaAtualNoDoc)
        copy[key] = {
          ...p,
          id: key,
          documentoId: docAtivo.id,
          documentoNome: docAtivo.nome,
          pagina: paginaGlobalAtual,
          paginaRelativa: paginaAtualNoDoc,
          larguraPt: presetCustomizado ? tamanhoPadraoPt.largura : p.larguraPt,
          alturaPt: presetCustomizado ? tamanhoPadraoPt.altura : p.alturaPt,
        }
      }
      return copy
    })
    toast.success(`Assinaturas posicionadas no rodapé da página ${paginaAtualNoDoc}.`)
  }

  // Auto-posiciona todos os signatários no rodapé de TODAS AS PÁGINAS do documento ativo
  const handleAutoPosicionarTodasPaginasDocAtual = () => {
    const totalPagsDoc = Math.max(1, docAtivo.totalPaginas || 1)
    const paginaInicioGlobal = docAtivo.paginaInicioGlobal || 1

    setPosicoes(prev => {
      const copy = { ...prev }
      // Limpa posições anteriores deste documento para regenerar limpo em todas as páginas
      Object.entries(copy).forEach(([k, p]) => {
        if (verificarPosicaoPertenceAoDoc(p, docAtivo, docAtivoIndex, docsProcessados.length)) {
          delete copy[k]
        }
      })

      for (let pagRel = 1; pagRel <= totalPagsDoc; pagRel++) {
        const pagGlobal = paginaInicioGlobal + (pagRel - 1)
        const padrao = gerarPosicionamentoPadrao(signatarios, pagGlobal)
        for (const [sigId, p] of Object.entries(padrao)) {
          const key = construirChavePosicao(sigId, docAtivo.id, pagRel)
          copy[key] = {
            ...p,
            id: key,
            documentoId: docAtivo.id,
            documentoNome: docAtivo.nome,
            pagina: pagGlobal,
            paginaRelativa: pagRel,
            larguraPt: presetCustomizado ? tamanhoPadraoPt.largura : p.larguraPt,
            alturaPt: presetCustomizado ? tamanhoPadraoPt.altura : p.alturaPt,
          }
        }
      }
      return copy
    })
    toast.success(
      `Todas as ${signatarios.length} assinaturas posicionadas no rodapé das ${totalPagsDoc} páginas de "${docAtivo.nome}"!`
    )
  }

  // Auto-posiciona signatários no rodapé da última página do documento ativo (preservando outras páginas)
  const handleAutoPosicionarDocAtual = () => {
    const totalPagsDoc = Math.max(1, docAtivo.totalPaginas || 1)
    const paginaFimGlobal = (docAtivo.paginaInicioGlobal || 1) + totalPagsDoc - 1
    const padrao = gerarPosicionamentoPadrao(signatarios, paginaFimGlobal)

    setPosicoes(prev => {
      const copy = { ...prev }
      for (const [sigId, p] of Object.entries(padrao)) {
        const existente = Object.entries(copy).find(([_, item]) =>
          verificarPosicaoSignatarioNaPagina(item, sigId, docAtivo, docAtivoIndex, docsProcessados.length, totalPagsDoc)
        )
        if (existente) {
          delete copy[existente[0]]
        }
        const key = construirChavePosicao(sigId, docAtivo.id, totalPagsDoc)
        copy[key] = {
          ...p,
          id: key,
          documentoId: docAtivo.id,
          documentoNome: docAtivo.nome,
          pagina: paginaFimGlobal,
          paginaRelativa: totalPagsDoc,
          larguraPt: tamanhoPadraoPt.largura,
          alturaPt: tamanhoPadraoPt.altura,
        }
      }
      return copy
    })
    setPaginaAtualNoDoc(totalPagsDoc)
    toast.success(`Todas as ${signatarios.length} assinaturas posicionadas no rodapé da última página (Pág. ${totalPagsDoc}) de "${docAtivo.nome}".`)
  }

  // Auto-posiciona signatários no rodapé de TODOS os documentos
  const handleAutoPosicionarTodosOsDocumentos = () => {
    const novas = gerarPosicionamentoDocumentos(signatarios, docsProcessados)
    if (Object.keys(novas).length === 0) return
    setPosicoes(prev => ({ ...prev, ...novas }))
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
          const key = construirChavePosicao(sigFaltante.id, doc.id, totalPagsDoc)
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

  // Auto-posiciona todos os signatários no rodapé da última página (modo documento único, preservando outras páginas já assinadas)
  const handleAutoPosicionarUltimaPagina = () => {
    const totalPags = Math.max(1, totalPaginasDocAtivo || totalPaginas || pdfDocRef.current?.numPages || 1)
    const padrao = gerarPosicionamentoPadrao(signatarios, totalPags)
    if (Object.keys(padrao).length === 0) return
    setPosicoes(prev => {
      const copy = { ...prev }
      for (const [sigId, p] of Object.entries(padrao)) {
        const existente = Object.entries(copy).find(([_, item]) =>
          verificarPosicaoSignatarioNaPagina(item, sigId, docAtivo, docAtivoIndex, docsProcessados.length, totalPags)
        )
        if (existente) {
          delete copy[existente[0]]
        }
        const key = construirChavePosicao(sigId, docAtivo.id, totalPags)
        copy[key] = {
          ...p,
          id: key,
          documentoId: docAtivo.id,
          documentoNome: docAtivo.nome,
          pagina: totalPags,
          paginaRelativa: totalPags,
          larguraPt: tamanhoPadraoPt.largura,
          alturaPt: tamanhoPadraoPt.altura,
        }
      }
      return copy
    })
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

  // Confirma e salva o posicionamento definido pelo usuário
  // (Posicionamento flexível: não é obrigatório posicionar todas as assinaturas em todos os documentos ou páginas)
  const handleConfirmarESalvar = () => {
    const total = Object.keys(posicoes).length
    onSalvar(posicoes)
    onClose()
    if (total > 0) {
      toast.success(
        `${total} ${total === 1 ? 'posição de assinatura salva' : 'posições de assinaturas salvas'} com sucesso!`
      )
    } else {
      toast.info('Nenhuma assinatura posicionada manualmente. O posicionamento padrão no rodapé será utilizado se necessário.')
    }
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
  const assinaturasNaPaginaAtual = diagDocAtivo?.contagemPorPagina?.[paginaAtualNoDoc] || 0

  const sigAtivoObj = signatarios.find(s => s.id === signatarioAtivoId) || signatarios[0]
  const posAtivaNaPagina = useMemo(() => {
    if (!sigAtivoObj) return null
    const entryNaPag = Object.entries(posicoes).find(([_, p]) =>
      verificarPosicaoSignatarioNaPagina(
        p,
        sigAtivoObj.id,
        docAtivo,
        docAtivoIndex,
        docsProcessados.length,
        paginaAtualNoDoc
      )
    )
    if (entryNaPag) return entryNaPag[1]
    const entryNoDoc = Object.entries(posicoes).find(([_, p]) =>
      verificarPosicaoSignatarioNoDoc(p, sigAtivoObj.id, docAtivo, docAtivoIndex, docsProcessados.length)
    )
    return entryNoDoc?.[1] || null
  }, [posicoes, sigAtivoObj, docAtivo, docAtivoIndex, docsProcessados.length, paginaAtualNoDoc])

  const larguraAtivaPt = posAtivaNaPagina?.larguraPt || tamanhoPadraoPt.largura
  const alturaAtivaPt = posAtivaNaPagina?.alturaPt || tamanhoPadraoPt.altura

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
        {/* ── TOP HEADER (LIMPO E DIRETO) ── */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PenTool size={18} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', letterSpacing: '-0.015em' }}>
                  Posicionar Assinaturas
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: diagnostico.totalPosicionado > 0 ? '#ecfdf5' : '#f1f5f9',
                    color: diagnostico.totalPosicionado > 0 ? '#047857' : '#64748b',
                    border: diagnostico.totalPosicionado > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {diagnostico.totalPosicionado === 0
                    ? 'Nenhuma posição definida'
                    : `✓ ${diagnostico.totalPosicionado} ${diagnostico.totalPosicionado === 1 ? 'assinatura' : 'assinaturas'}`}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Selecione a pessoa ao lado e clique na folha para posicionar (opcional em cada página).
              </div>
            </div>
          </div>

          {/* Ações Rápidas Enxutas no Topo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  padding: '7px 10px',
                  borderRadius: 9,
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
                title="Limpar todas as assinaturas posicionadas"
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
                width: 34,
                height: 34,
                borderRadius: 9,
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
              title="Fechar"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ── CORPO DIVIDIDO: SIDEBAR LIMPA (ESQUERDA) + WORKSPACE DO DOCUMENTO (DIREITA) ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            minHeight: 0,
            overflow: 'hidden',
            background: '#f8fafc',
          }}
        >
          {/* ── COLUNA ESQUERDA: PAINEL ORGANIZADO E DIRETO ── */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '14px',
              gap: 16,
            }}
          >
            {/* SEÇÃO 1: DOCUMENTOS (Compacta se 1 doc, Lista enxuta se múltiplos docs) */}
            {docsProcessados.length > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Documentos ({docsProcessados.length})
                  </span>
                  <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                    Doc {docAtivoIndex + 1} de {docsProcessados.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {docsProcessados.map((doc, idx) => {
                    const isAtivo = docAtivoIndex === idx
                    const diagDoc = diagnostico.porDocumento[idx]
                    const totalAssinaturasDoc = diagDoc?.totalAssinaturasNoDoc || 0
                    const faltantesNesteDoc = diagDoc?.faltantes || []

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
                          padding: '8px 10px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: isAtivo ? '#ffffff' : '#f1f5f9',
                          border: isAtivo
                            ? '1.5px solid #2563eb'
                            : totalAssinaturasDoc > 0
                            ? '1px solid #a7f3d0'
                            : '1px solid #e2e8f0',
                          boxShadow: isAtivo ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 5,
                              background: totalAssinaturasDoc > 0 ? '#d1fae5' : isAtivo ? '#eff6ff' : '#e2e8f0',
                              color: totalAssinaturasDoc > 0 ? '#047857' : isAtivo ? '#2563eb' : '#64748b',
                              fontSize: 10.5,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {totalAssinaturasDoc > 0 ? <Check size={11} strokeWidth={3} /> : idx + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
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
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: totalAssinaturasDoc > 0 ? '#ecfdf5' : '#ffffff',
                            color: totalAssinaturasDoc > 0 ? '#047857' : '#64748b',
                            border: totalAssinaturasDoc > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                            flexShrink: 0,
                          }}
                        >
                          {totalAssinaturasDoc > 0 ? `${totalAssinaturasDoc} ✓` : `${doc.totalPaginas} pág`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FileText size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={docAtivo?.nome}
                  >
                    {docAtivo?.nome || 'Documento'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                  {totalPaginasDocAtivo} {totalPaginasDocAtivo === 1 ? 'página' : 'páginas'}
                </span>
              </div>
            )}

            {/* SEÇÃO 2: PESSOAS PARA ASSINAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pessoas para Assinar
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                  Página atual: {paginaAtualNoDoc}/{totalPaginasDocAtivo}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signatarios.map((sig) => {
                  const isAtivo = signatarioAtivoId === sig.id
                  const posEntriesNesteDoc = Object.entries(posicoes)
                    .filter(([_, p]) =>
                      verificarPosicaoSignatarioNoDoc(p, sig.id, docAtivo, docAtivoIndex, docsProcessados.length)
                    )
                    .sort(
                      (a, b) =>
                        obterPaginaRelativaNoDoc(a[1], docAtivo, docsProcessados.length) -
                        obterPaginaRelativaNoDoc(b[1], docAtivo, docsProcessados.length)
                    )

                  const posEntryNaPaginaAtual = posEntriesNesteDoc.find(
                    ([_, p]) => obterPaginaRelativaNoDoc(p, docAtivo, docsProcessados.length) === paginaAtualNoDoc
                  )
                  const posNaPaginaAtual = posEntryNaPaginaAtual?.[1]
                  const posKeyNaPaginaAtual = posEntryNaPaginaAtual?.[0]

                  const assinaEmTodasAsPaginas =
                    totalPaginasDocAtivo > 1 && posEntriesNesteDoc.length >= totalPaginasDocAtivo

                  return (
                    <div
                      key={sig.id}
                      onClick={() => setSignatarioAtivoId(sig.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: '#ffffff',
                        border: isAtivo
                          ? `2px solid ${sig.cor}`
                          : posEntriesNesteDoc.length > 0
                          ? '1px solid #cbd5e1'
                          : '1px solid #e2e8f0',
                        boxShadow: isAtivo ? `0 4px 12px ${sig.cor}1c` : '0 1px 2px rgba(15, 23, 42, 0.03)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Linha Principal: Identificação + Status na Página Atual */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: isAtivo ? sig.cor : `${sig.cor}15`,
                              color: isAtivo ? '#ffffff' : sig.cor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {sig.tipo === 'escola' ? <Building2 size={15} /> : <User size={15} />}
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
                                fontSize: 10.5,
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

                        {/* Status / Ação na Página Atual */}
                        {posNaPaginaAtual && posKeyNaPaginaAtual ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '3px 7px',
                              borderRadius: 7,
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              flexShrink: 0,
                            }}
                            title={`Posicionado na Página ${paginaAtualNoDoc}`}
                          >
                            <Check size={11} strokeWidth={3} />
                            <span>Na Pág. {paginaAtualNoDoc}</span>
                            <button
                              type="button"
                              onClick={(e) => handleRemoverPosicao(posKeyNaPaginaAtual, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                padding: '0 0 0 2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title={`Remover da Página ${paginaAtualNoDoc}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ) : isAtivo ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: sig.cor,
                              background: `${sig.cor}12`,
                              padding: '3px 8px',
                              borderRadius: 7,
                              flexShrink: 0,
                            }}
                          >
                            Clique na folha →
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: '#94a3b8',
                              flexShrink: 0,
                            }}
                          >
                            Selecionar
                          </span>
                        )}
                      </div>

                      {/* Barra Unificada de Páginas (Exibida quando o documento tem mais de 1 página) */}
                      {totalPaginasDocAtivo > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            paddingTop: 6,
                            borderTop: '1px solid #f1f5f9',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {Array.from({ length: totalPaginasDocAtivo }, (_, i) => i + 1).map((pNum) => {
                              const entryPag = posEntriesNesteDoc.find(
                                ([_, pItem]) => obterPaginaRelativaNoDoc(pItem, docAtivo, docsProcessados.length) === pNum
                              )
                              const temNaPag = Boolean(entryPag)
                              const isPagAtual = pNum === paginaAtualNoDoc

                              return (
                                <span
                                  key={pNum}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    fontSize: 10,
                                    fontWeight: temNaPag || isPagAtual ? 700 : 600,
                                    padding: '2px 6px',
                                    borderRadius: 6,
                                    background: temNaPag
                                      ? '#ecfdf5'
                                      : isPagAtual
                                      ? '#eff6ff'
                                      : '#f8fafc',
                                    color: temNaPag
                                      ? '#047857'
                                      : isPagAtual
                                      ? '#1d4ed8'
                                      : '#64748b',
                                    border: temNaPag
                                      ? '1px solid #a7f3d0'
                                      : isPagAtual
                                      ? '1px solid #93c5fd'
                                      : '1px solid #e2e8f0',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSignatarioAtivoId(sig.id)
                                      rolarParaPagina(pNum)
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'inherit',
                                      font: 'inherit',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                    title={temNaPag ? `Assinado na Página ${pNum} (clique para rolar até ela)` : `Rolar para Página ${pNum}`}
                                  >
                                    {temNaPag && <Check size={9} strokeWidth={3} />}
                                    <span>Pág. {pNum}</span>
                                  </button>
                                  {temNaPag && entryPag && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleRemoverPosicao(entryPag[0], e)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        padding: '0 0 0 2px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      }}
                                      title={`Remover assinatura da Página ${pNum}`}
                                    >
                                      <X size={9} />
                                    </button>
                                  )}
                                </span>
                              )
                            })}
                          </div>

                          {/* Botão Único de Ação Rápida para Todas as Páginas desta Pessoa */}
                          {!assinaEmTodasAsPaginas ? (
                            <button
                              type="button"
                              onClick={(e) => handleReplicarSignatarioEmTodasPaginas(sig.id, e)}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                flexShrink: 0,
                              }}
                              title={`Colocar a assinatura de ${sig.nome} em todas as ${totalPaginasDocAtivo} páginas`}
                            >
                              <Layers size={10} /> Todas as págs
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleRemoverSignatarioDoDocAtivo(sig.id, e)}
                              style={{
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                color: '#e11d48',
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                flexShrink: 0,
                              }}
                              title="Limpar todas as páginas desta pessoa"
                            >
                              <Trash2 size={9} /> Limpar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SEÇÃO 3: TAMANHO DA ASSINATURA (COMPACTO) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tamanho da Assinatura
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b' }}>
                  {larguraAtivaPt} × {alturaAtivaPt} pt
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 5,
                  background: '#ffffff',
                  padding: 4,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                }}
              >
                {[
                  { label: 'P', desc: 'Pequena', l: 100, a: 36 },
                  { label: 'M', desc: 'Ideal', l: 117, a: 42 },
                  { label: 'G', desc: 'Grande', l: 145, a: 48 },
                  { label: 'GG', desc: 'Extra', l: 175, a: 54 },
                ].map((preset) => {
                  const isPresetAtivo = Math.abs(larguraAtivaPt - preset.l) < 12
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAplicarPresetTamanho(preset.l, preset.a)}
                      style={{
                        background: isPresetAtivo ? '#eff6ff' : 'transparent',
                        border: isPresetAtivo ? '1.5px solid #2563eb' : '1px solid transparent',
                        color: isPresetAtivo ? '#1d4ed8' : '#475569',
                        borderRadius: 7,
                        padding: '5px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                      title={`${preset.desc} (${preset.l}×${preset.a} pt)`}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 800 }}>{preset.label}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.75 }}>{preset.desc}</span>
                    </button>
                  )
                })}
              </div>

              <div style={{ fontSize: 10.5, color: '#64748b', padding: '2px 2px 0', lineHeight: 1.4 }}>
                Dica: role a folha com o mouse para navegar pelas páginas e clique onde desejar assinar.
              </div>
            </div>
          </div>

          {/* ── COLUNA DIREITA: WORKSPACE CLARO COM ROLAGEM CONTÍNUA ENTRE PÁGINAS ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              background: '#f1f5f9',
            }}
          >
            {/* Barra de Ferramentas Superior do Documento (1 Linha Limpa: Pessoa Ativa + Indicador de Rolagem + Zoom) */}
            <div
              style={{
                padding: '8px 16px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexShrink: 0,
              }}
            >
              {/* Indicador de Quem Está Sendo Posicionado Agora */}
              {sigAtivoObj ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: `${sigAtivoObj.cor}12`,
                    border: `1px solid ${sigAtivoObj.cor}38`,
                    minWidth: 0,
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
                  <span
                    style={{
                      fontSize: 11.5,
                      color: '#334155',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Posicionando: <strong style={{ color: '#0f172a' }}>{sigAtivoObj.nome}</strong>
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Indicador Central de Página Atual (Rolagem com Mouse) + Troca de Arquivo quando múltiplos */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {docsProcessados.length > 1 && (
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
                      background: docAtivoIndex > 0 ? '#eff6ff' : '#f8fafc',
                      border: docAtivoIndex > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      color: docAtivoIndex > 0 ? '#1d4ed8' : '#cbd5e1',
                      cursor: docAtivoIndex <= 0 ? 'not-allowed' : 'pointer',
                      padding: '4px 9px',
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Voltar para o arquivo anterior"
                  >
                    <ChevronLeft size={13} /> Arquivo Anterior
                  </button>
                )}

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    color: '#475569',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>
                    Página {paginaAtualNoDoc} de {totalPaginasDocAtivo}
                  </span>
                  {totalPaginasDocAtivo > 1 && (
                    <span style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>
                      · Role com o mouse para ver todas as páginas
                    </span>
                  )}
                </div>

                {docsProcessados.length > 1 && (
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
                      background: docAtivoIndex < docsProcessados.length - 1 ? '#eff6ff' : '#f8fafc',
                      border: docAtivoIndex < docsProcessados.length - 1 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      color: docAtivoIndex < docsProcessados.length - 1 ? '#1d4ed8' : '#cbd5e1',
                      cursor: docAtivoIndex >= docsProcessados.length - 1 ? 'not-allowed' : 'pointer',
                      padding: '4px 9px',
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Avançar para o próximo arquivo"
                  >
                    Próximo Arquivo <ChevronRight size={13} />
                  </button>
                )}
              </div>

              {/* Controles de Zoom (Inicia em 80%) */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '3px 5px',
                  borderRadius: 9,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(50, z - 10))}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    padding: '4px 5px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Reduzir zoom"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(80)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#334155',
                    minWidth: 38,
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  title="Restaurar zoom padrão (80%)"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(150, z + 10))}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    padding: '4px 5px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Aumentar zoom"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>

            {/* ── Área de Visualização Contínua das Folhas (Rolagem Vertical com Mouse) ── */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScrollWorkspace}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                backgroundColor: '#e2e8f0',
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                padding: '24px',
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
                    Carregando páginas de {docAtivo?.nome ? `"${docAtivo.nome}"` : 'documento'}...
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
                Array.from({ length: totalPaginasDocAtivo }, (_, idxPag) => idxPag + 1).map((pNum) => {
                  const qtdNaPag = diagDocAtivo?.contagemPorPagina?.[pNum] || 0
                  const isPagFocada = paginaAtualNoDoc === pNum

                  return (
                    <div
                      key={pNum}
                      ref={(el) => {
                        pageWrapperRefs.current[pNum] = el
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {/* Etiqueta sutil de identificação da página na rolagem */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: isPagFocada ? '#1e293b' : 'rgba(255, 255, 255, 0.9)',
                          color: isPagFocada ? '#ffffff' : '#475569',
                          border: isPagFocada ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          fontSize: 11,
                          fontWeight: 700,
                          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                        }}
                      >
                        <span>
                          Página {pNum} de {totalPaginasDocAtivo}
                        </span>
                        {qtdNaPag > 0 && (
                          <span
                            style={{
                              background: '#10b981',
                              color: '#ffffff',
                              padding: '0 6px',
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            ✓ {qtdNaPag}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          position: 'relative',
                          boxShadow: isPagFocada
                            ? '0 14px 38px -4px rgba(15, 23, 42, 0.16), 0 0 0 2px rgba(37, 99, 235, 0.35)'
                            : '0 10px 28px -4px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.06)',
                          borderRadius: 6,
                          overflow: 'visible',
                          background: '#ffffff',
                        }}
                      >
                        {/* Canvas com a página renderizada do PDF */}
                        <canvas
                          ref={(el) => {
                            canvasRefs.current[pNum] = el
                          }}
                          style={{ display: 'block', borderRadius: 6 }}
                        />

                        {/* Overlay interativo com suporte a clique e arrasto nesta página */}
                        <div
                          ref={(el) => {
                            overlayRefs.current[pNum] = el
                          }}
                          onClick={(e) => handleOverlayClick(e, pNum)}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            cursor: 'crosshair',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                          }}
                        >
                          {/* Renderiza as caixas de assinaturas desta página específica */}
                          {Object.entries(posicoes)
                            .filter(([_, pos]) => {
                              if (!verificarPosicaoPertenceAoDoc(pos, docAtivo, docAtivoIndex, docsProcessados.length)) {
                                return false
                              }
                              return obterPaginaRelativaNoDoc(pos, docAtivo, docsProcessados.length) === pNum
                            })
                            .map(([posKey, pos]) => {
                              const sigInfo = signatarios.find(s => s.id === pos.signatarioId)
                              const cor = sigInfo?.cor || '#2563eb'
                              const isAtivo = signatarioAtivoId === pos.signatarioId
                              const dimIdeal = calcularDimensoesIdeaisAssinatura(pos.nome)
                              const larguraPt = pos.larguraPt || dimIdeal.larguraPt
                              const alturaPt = pos.alturaPt || dimIdeal.alturaPt
                              const boxWidthPx = Math.max(85, Math.round(larguraPt * currentScale))
                              const boxHeightPx = Math.max(28, Math.round(alturaPt * currentScale))

                              const nomeExibicao = formatSignatureDisplayName(sanitizeSignerName(pos.nome), 28)
                              const numChars = Math.max(1, nomeExibicao.length)
                              const largUtilPx = Math.max(60, boxWidthPx - 12)
                              const maxFontePorLargura = Math.floor(largUtilPx / (numChars * 0.42))
                              const maxFontePorAltura = Math.round(boxHeightPx * 0.42)
                              const baseFontSize = Math.max(9.5, Math.min(maxFontePorAltura, maxFontePorLargura, 24))

                              const textoSub = `Assinado eletronicamente ${new Date().toLocaleDateString('pt-BR')}`
                              const maxSubPorLargura = Math.floor(largUtilPx / (textoSub.length * 0.44))
                              const subFontSize = Math.max(6.2, Math.min(Math.round(boxHeightPx * 0.16), maxSubPorLargura, 9))

                              return (
                                <div
                                  key={posKey}
                                  onMouseDown={(e) => {
                                    setSignatarioAtivoId(pos.signatarioId)
                                    handleMouseDownItem(e, posKey, pNum)
                                  }}
                                  title={`${pos.nome} (${pos.cargo || 'Signatário'}) — Arraste para mover ou use o canto inferior direito para redimensionar`}
                                  style={{
                                    position: 'absolute',
                                    left: `${pos.xPercent}%`,
                                    top: `${pos.yPercent}%`,
                                    width: boxWidthPx,
                                    minHeight: boxHeightPx,
                                    padding: '4px 6px',
                                    borderRadius: 7,
                                    background: isAtivo ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.86)',
                                    backdropFilter: 'blur(4px)',
                                    WebkitBackdropFilter: 'blur(4px)',
                                    border: `${isAtivo ? '2px' : '1.5px'} dashed ${cor}`,
                                    boxShadow: isAtivo
                                      ? `0 0 0 3px ${cor}28, 0 6px 16px rgba(15, 23, 42, 0.12)`
                                      : '0 2px 6px rgba(15, 23, 42, 0.08)',
                                    cursor: redimensionandoId === posKey ? 'se-resize' : arrastandoId === posKey ? 'grabbing' : 'grab',
                                    touchAction: 'none',
                                    WebkitUserSelect: 'none',
                                    userSelect: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    transition: arrastandoId === posKey || redimensionandoId === posKey ? 'none' : 'box-shadow 0.15s ease',
                                    zIndex: isAtivo ? 50 : 20,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                                    <span
                                      style={{
                                        fontSize: 8,
                                        fontWeight: 800,
                                        color: cor,
                                        background: '#ffffff',
                                        border: `1px solid ${cor}40`,
                                        padding: '0px 4px',
                                        borderRadius: 3,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      <Move size={7} /> {pos.tipo === 'escola' ? 'Instituição' : 'Responsável'}
                                    </span>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      {totalPaginasDocAtivo > 1 && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleReplicarSignatarioEmTodasPaginas(pos.signatarioId, e)}
                                          style={{
                                            background: '#eff6ff',
                                            border: '1px solid #93c5fd',
                                            color: '#1d4ed8',
                                            cursor: 'pointer',
                                            padding: '1px 3px',
                                            borderRadius: 3,
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: 7.5,
                                            fontWeight: 700,
                                          }}
                                          title={`Replicar esta posição em todas as ${totalPaginasDocAtivo} páginas deste documento`}
                                        >
                                          <Layers size={7.5} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => handleAjustarTamanho(posKey, -10, e)}
                                        style={{
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          color: '#334155',
                                          cursor: 'pointer',
                                          padding: '1px 2px',
                                          borderRadius: 3,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                        title="Diminuir tamanho (-10pt)"
                                      >
                                        <Minus size={7.5} />
                                      </button>
                                      <span style={{ fontSize: 7.5, color: '#475569', fontWeight: 700 }}>
                                        {Math.round(larguraPt)}pt
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleAjustarTamanho(posKey, 10, e)}
                                        style={{
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          color: '#334155',
                                          cursor: 'pointer',
                                          padding: '1px 2px',
                                          borderRadius: 3,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                        title="Aumentar tamanho (+10pt)"
                                      >
                                        <Plus size={7.5} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => handleRemoverPosicao(posKey, e)}
                                        style={{
                                          background: '#fff1f2',
                                          border: '1px solid #fecdd3',
                                          color: '#e11d48',
                                          cursor: 'pointer',
                                          padding: '1px 2px',
                                          borderRadius: 3,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                        title="Remover assinatura desta página"
                                      >
                                        <X size={8.5} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Assinatura Caligráfica Justa */}
                                  <div
                                    style={{
                                      fontFamily: "'Dancing Script', 'Caveat', 'Brush Script MT', cursive, sans-serif",
                                      fontSize: baseFontSize,
                                      fontWeight: 700,
                                      color: '#0e2454',
                                      lineHeight: 1.1,
                                      paddingTop: 1,
                                      paddingLeft: 1,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      textShadow: '0 1px 2px rgba(255, 255, 255, 0.95)',
                                      WebkitUserSelect: 'none',
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
                                      paddingLeft: 1,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
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
                                      width: 13,
                                      height: 13,
                                      cursor: 'se-resize',
                                      touchAction: 'none',
                                      WebkitUserSelect: 'none',
                                      userSelect: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: cor,
                                      color: '#ffffff',
                                      borderTopLeftRadius: 4,
                                      borderBottomRightRadius: 5,
                                      zIndex: 10,
                                    }}
                                  >
                                    <svg width="7" height="7" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M7 1L1 7M7 4L4 7M7 7H7.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                    </svg>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER LIMPO E DIRETO (COM BOTÃO DE VOLTAR E AVANÇAR ARQUIVO) ── */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                color: diagnostico.totalPosicionado > 0 ? '#047857' : '#64748b',
                background: diagnostico.totalPosicionado > 0 ? '#ecfdf5' : '#f1f5f9',
                border: diagnostico.totalPosicionado > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                padding: '4px 10px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 11.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={13} />
              {diagnostico.totalPosicionado === 0
                ? 'Nenhuma assinatura posicionada'
                : `${diagnostico.totalPosicionado} ${diagnostico.totalPosicionado === 1 ? 'assinatura posicionada' : 'assinaturas posicionadas'}`}
            </span>
            <span
              style={{
                color: '#64748b',
                fontSize: 11.5,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {diagnostico.totalPosicionado > 0
                ? 'Pronto para salvar.'
                : 'Clique na folha para posicionar ou confirme para usar o rodapé padrão.'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {docsProcessados.length > 1 && docAtivoIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDocAtivoIndex(i => i - 1)
                  setPaginaAtualNoDoc(1)
                }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  padding: '8px 14px',
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
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
              >
                <ChevronLeft size={14} /> Arquivo Anterior ({docAtivoIndex}/{docsProcessados.length})
              </button>
            )}

            {docsProcessados.length > 1 && docAtivoIndex < docsProcessados.length - 1 && (
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
                  padding: '8px 14px',
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                Próximo Arquivo ({docAtivoIndex + 2}/{docsProcessados.length}) <ChevronRight size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 12,
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

            <button
              type="button"
              onClick={handleConfirmarESalvar}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 18px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.15s ease',
              }}
              title="Confirmar e salvar posições das assinaturas"
            >
              <Check size={15} strokeWidth={2.5} />
              <span>Confirmar e Salvar</span>
              {diagnostico.totalPosicionado > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                  }}
                >
                  {diagnostico.totalPosicionado}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
