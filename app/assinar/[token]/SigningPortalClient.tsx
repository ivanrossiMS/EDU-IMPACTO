'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import {
  ShieldCheck, CheckCircle2, AlertCircle, FileText, Lock, Mail,
  Smartphone, Clock, RefreshCw, Download, ArrowRight, ArrowLeft, Check,
  X, User, PenTool, ExternalLink, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, Shield, Sparkles, CheckSquare, Square,
  HelpCircle, Eye, QrCode, BadgeCheck, MessageSquare, Copy, Send,
  Building2, Home, Expand, Minus, Plus, Phone
} from 'lucide-react'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'
import { PdfCanvasViewer } from './PdfCanvasViewer'
import {
  formatAbbreviatedSignerName,
  formatTimestampSelo,
  validarCPF,
  formatarCPF,
  sanitizeSignerName,
  carregarFontesCaligraficas,
} from '@/lib/contracts/sealUtils'

interface ContratoProps {
  id: string
  protocolo: string
  token_assinatura: string
  titulo_documento: string
  ano_letivo: string
  signatario_nome: string
  signatario_cpf?: string
  signatario_data_nascimento?: string
  signatario_email: string
  signatario_telefone?: string
  signatario_cargo?: string
  aluno_nome?: string | null
  status: string
  documento_original_hash: string
  documento_assinado_hash?: string | null
  documento_pdf_base64?: string | null
  documento_assinado_pdf_base64?: string | null
  otp_confirmado_em?: string | null
  arquivoOriginalNome?: string
  formatoOriginal?: 'pdf' | 'docx' | 'doc'
  logoUrl?: string
  representanteEscola?: {
    nome: string
    cargo: string
    razaoSocial: string
    cnpj: string
    assinaturaUrl?: string
    representantes?: Array<{
      id?: string
      nome: string
      cargo?: string
      cpf?: string
    }>
  }
  totalPaginas: number
  dataCriacao?: string
  dataAssinatura?: string
  responsavel_email?: string | null
  evidencias?: any
  trilhaAuditoria?: Array<{
    timestamp: string
    evento: string
    descricao: string
    hash?: string
  }>
}

// Estilos de caligrafia automática (2 opções oficiais: Cursiva Clássica e Rubrica Formal)
const ESTILOS_CALIGRAFICOS = [
  { id: 'classica', nome: 'Cursiva Clássica', font: "'Dancing Script', 'Brush Script MT', 'Caveat', cursive", slant: 'normal', weight: '700' },
  { id: 'formal', nome: 'Rubrica Formal', font: "'Georgia', 'Times New Roman', serif", slant: 'italic', weight: 'bold' },
]

// Helpers de formatação e mascaramento para exibição visual limpa
function getSignerInitials(name: string): string {
  if (!name) return 'SN'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function maskEmailDisplay(email: string): string {
  if (!email || !email.includes('@')) return email || ''
  const [user, domain] = email.split('@')
  if (user.length <= 4) {
    return `${user.slice(0, 2)}•••@${domain}`
  }
  return `${user.slice(0, 4)}•••@${domain}`
}

function maskPhoneDisplay(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2)
    const end = digits.slice(-4)
    return `(${ddd}) ••••••-${end}`
  }
  return phone
}

// Componente leve de miniatura de página do PDF
function PdfThumbnailItem({
  pdfDoc,
  pageNumber,
  isActive,
  onSelect,
}: {
  pdfDoc: any
  pageNumber: number
  isActive: boolean
  onSelect: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    let isCancelled = false
    async function renderThumb() {
      if (!pdfDoc || !canvasRef.current) return
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled) return
        const viewport = page.getViewport({ scale: 1 })

        // Largura alvo da miniatura: ~114px
        const targetWidth = 114
        const scale = targetWidth / viewport.width
        const thumbViewport = page.getViewport({ scale })

        const canvas = canvasRef.current
        canvas.width = Math.round(thumbViewport.width)
        canvas.height = Math.round(thumbViewport.height)

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        await page.render({
          canvasContext: ctx,
          viewport: thumbViewport,
        }).promise

        if (!isCancelled) {
          setRendered(true)
        }
      } catch (e) {
        console.warn('Erro ao renderizar miniatura da página', pageNumber, e)
      }
    }

    renderThumb()
    return () => {
      isCancelled = true
    }
  }, [pdfDoc, pageNumber])

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
      aria-label={`Visualizar Página ${pageNumber}`}
    >
      <div
        className={`relative overflow-hidden rounded-lg bg-white transition-all ${
          isActive
            ? 'border-2 border-blue-600 ring-2 ring-blue-100 shadow-xs'
            : 'border border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
        }`}
        style={{ width: 114, minHeight: 68 }}
      >
        <canvas ref={canvasRef} className="block w-full h-auto bg-white" />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-[11px] text-slate-400 font-medium">
            Pág. {pageNumber}
          </div>
        )}
      </div>
      <span
        className={`text-xs font-semibold tracking-tight transition-colors ${
          isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
        }`}
      >
        Página {pageNumber}
      </span>
    </button>
  )
}

export function SigningPortalClient({ contrato }: { contrato: ContratoProps }) {
  // Controle de Visualização do PDF Paginado
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(Math.max(1, contrato.totalPaginas || 1))
  const [zoomPercent, setZoomPercent] = useState(75)
  const [loadedPdfDoc, setLoadedPdfDoc] = useState<any>(null)

  // Estado do Modal de Assinatura
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(
    contrato.status === 'assinado' ? 4 : contrato.otp_confirmado_em ? 3 : 1
  )

  // Dados do Signatário (editáveis/conferíveis pelo próprio signatário)
  const [signatarioNome, setSignatarioNome] = useState(sanitizeSignerName(contrato.signatario_nome || ''))
  const [signatarioCpf, setSignatarioCpf] = useState(formatarCPF(contrato.signatario_cpf || ''))
  const [signatarioDataNascimento, setSignatarioDataNascimento] = useState(contrato.signatario_data_nascimento || '')
  const [signatarioEmail, setSignatarioEmail] = useState(contrato.signatario_email || '')
  const [signatarioTelefone, setSignatarioTelefone] = useState(contrato.signatario_telefone || '')

  // Validação dinâmica do cálculo de CPF (Módulo 11 da Receita Federal)
  const cpfLimpo = (signatarioCpf || '').replace(/\D/g, '')
  const isCpfCompleto = cpfLimpo.length === 11
  const isCpfValido = isCpfCompleto && validarCPF(cpfLimpo)

  // Estados do OTP
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [emailMascarado, setEmailMascarado] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null)

  // Modo de Assinatura: 'nome_automatico' ou 'manual'
  const [tipoAssinatura, setTipoAssinatura] = useState<'nome_automatico' | 'manual'>('nome_automatico')
  const [estiloCaligrafico, setEstiloCaligrafico] = useState(ESTILOS_CALIGRAFICOS[0].id)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [signingLoading, setSigningLoading] = useState(false)
  const [signingError, setSigningError] = useState<string | null>(null)

  // Canvas da Assinatura Manual
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const [hasManualDrawing, setHasManualDrawing] = useState(false)

  // Resultado da Assinatura
  const [signedResult, setSignedResult] = useState<{
    protocolo: string
    documentoFinalHash: string
    validationUrl: string
    signedPdfBase64: string
    emailEnviado?: boolean
    emailDestinatario?: string
    emailErro?: string
  } | null>(
    contrato.status === 'assinado' && (contrato.documento_assinado_hash || contrato.protocolo)
      ? {
          protocolo: contrato.protocolo,
          documentoFinalHash: contrato.documento_assinado_hash || '11E89A8221E9E7A3448902650D76E9396BBD0FFC250C48E726821D66B132BD4D',
          validationUrl: `/validar-assinatura/${contrato.protocolo}`,
          signedPdfBase64: contrato.documento_assinado_pdf_base64 || '',
          emailEnviado: Boolean(contrato.evidencias?.emailCopiaEnviado || contrato.evidencias?.ultimoReenvioMessageId),
          emailDestinatario: contrato.evidencias?.emailCopiaDestinatario || contrato.evidencias?.ultimoReenvioEmailDestino || contrato.responsavel_email,
        }
      : null
  )

  // Estado de Reenvio de E-mail da Cópia Oficial
  const [resendEmailInput, setResendEmailInput] = useState('')
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const [resendEmailSuccessMsg, setResendEmailSuccessMsg] = useState<string | null>(null)
  const [resendEmailErrorMsg, setResendEmailErrorMsg] = useState<string | null>(null)
  const [showAlternativeEmailInput, setShowAlternativeEmailInput] = useState(false)

  // Estados para Mobile, Montagem e Zoom Lightbox
  const [mounted, setMounted] = useState(false)
  const [viewerWidth, setViewerWidth] = useState(0)
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false)
  const [zoomModalScale, setZoomModalScale] = useState(130)
  const viewerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    carregarFontesCaligraficas()
    const handleResize = () => {
      if (viewerRef.current) {
        setViewerWidth(viewerRef.current.clientWidth)
      } else if (typeof window !== 'undefined') {
        setViewerWidth(window.innerWidth - 32)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Estado do Modal de Comprovante e Validação Oficial
  const [isComprovanteModalOpen, setIsComprovanteModalOpen] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [copiadoProtocolo, setCopiadoProtocolo] = useState(false)
  const [copiadoLinkValidacao, setCopiadoLinkValidacao] = useState(false)

  // Gerar QR Code para validação pública oficial instantânea
  useEffect(() => {
    const proto = signedResult?.protocolo || contrato.protocolo
    if (proto && typeof window !== 'undefined') {
      const fullValidationUrl = `${window.location.origin}/validar-assinatura/${proto}`
      QRCode.toDataURL(fullValidationUrl, {
        width: 240,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.warn('Erro ao gerar QR Code:', err))
    }
  }, [signedResult?.protocolo, contrato.protocolo])

  // Countdown timer para reenvio de OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Fechar modais com a tecla ESC quando não estiver em processo de carregamento
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomModalOpen) {
          setIsZoomModalOpen(false)
        } else if (isComprovanteModalOpen) {
          setIsComprovanteModalOpen(false)
        } else if (isSignModalOpen && !signingLoading && !otpLoading) {
          setIsSignModalOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSignModalOpen, isComprovanteModalOpen, isZoomModalOpen, signingLoading, otpLoading])

  // Trava com precisão a rolagem da tela de fundo quando qualquer modal estiver aberto (iOS/Android/Desktop)
  const isAnyModalOpen = isSignModalOpen || isZoomModalOpen || isComprovanteModalOpen
  useEffect(() => {
    if (!isAnyModalOpen) return

    const scrollY = window.scrollY
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyWidth = document.body.style.width
    const originalDocOverflow = document.documentElement.style.overflow

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.documentElement.style.overflow = originalDocOverflow
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalBodyPosition
      document.body.style.top = originalBodyTop
      document.body.style.width = originalBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [isAnyModalOpen])

  // Inicializa o canvas de desenho manual quando ativado
  useEffect(() => {
    if (tipoAssinatura === 'manual' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#0f2757'
        ctx.lineWidth = 2.8
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
    }
  }, [tipoAssinatura, isSignModalOpen, modalStep])

  // Máscaras de digitação
  const maskCpf = (v: string) => {
    return v
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14)
  }

  const maskDate = (v: string) => {
    return v
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 10)
  }

  const maskPhone = (v: string) => {
    return v
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
      .slice(0, 15)
  }

  // Funções do Canvas de Assinatura Manual
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    isDrawingRef.current = true
    setHasManualDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    if ('touches' in e) e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasManualDrawing(false)
  }

  // Gera imagem PNG da assinatura automática baseada no nome
  const generateAutomaticSignatureImage = (): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // Fundo transparente
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const estilo = ESTILOS_CALIGRAFICOS.find(e => e.id === estiloCaligrafico) || ESTILOS_CALIGRAFICOS[0]
    ctx.fillStyle = '#0f2757'
    ctx.font = `${estilo.slant} ${estilo.weight} 46px ${estilo.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Desenha o nome puramente, sem linha embaixo e sem texto de rodapé
    const nomeLimpo = sanitizeSignerName(signatarioNome) || 'Assinatura Eletrônica'
    ctx.fillText(nomeLimpo, canvas.width / 2, canvas.height / 2)

    return canvas.toDataURL('image/png')
  }

  // URL direta da rota de streaming do PDF
  const pdfViewUrl = `/api/matriculas/digital/pdf/${contrato.token_assinatura}?v=${signedResult ? 'assinado' : 'original'}&t=${signedResult ? '1' : '0'}`

  // Abrir PDF em nova aba via Rota de API oficial
  const handleOpenPdfInNewTab = () => {
    window.open(pdfViewUrl, '_blank')
  }

  // Enviar código OTP com validação estrita de TODOS os campos obrigatórios
  const handleRequestOtp = async () => {
    // 1. Nome Completo Obrigatório
    const nomeLimpo = signatarioNome.trim()
    if (!nomeLimpo || nomeLimpo.split(/\s+/).length < 2) {
      setOtpError('Por favor, informe seu Nome Completo (nome e sobrenome).')
      return
    }

    // 2. CPF Obrigatório e Cálculo Oficial Válido (Módulo 11)
    const cpfLimpo = signatarioCpf.replace(/\D/g, '')
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      setOtpError('Por favor, informe seu CPF completo com 11 dígitos.')
      return
    }
    if (!validarCPF(cpfLimpo)) {
      setOtpError('O CPF informado é inválido. Por favor, confira os números digitados antes de prosseguir.')
      return
    }

    // 3. Data de Nascimento Obrigatória
    const dataNascLimpa = signatarioDataNascimento.trim()
    if (!dataNascLimpa || dataNascLimpa.length !== 10) {
      setOtpError('Por favor, informe sua Data de Nascimento completa (DD/MM/AAAA).')
      return
    }
    const [diaStr, mesStr, anoStr] = dataNascLimpa.split('/')
    const dia = parseInt(diaStr, 10)
    const mes = parseInt(mesStr, 10)
    const ano = parseInt(anoStr, 10)
    const anoAtual = new Date().getFullYear()
    if (isNaN(dia) || isNaN(mes) || isNaN(ano) || dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1920 || ano > anoAtual) {
      setOtpError('Por favor, informe uma Data de Nascimento válida no formato DD/MM/AAAA.')
      return
    }

    // 4. Telefone / WhatsApp Obrigatório (com DDD, mín 10 dígitos)
    const telLimpo = signatarioTelefone.replace(/\D/g, '')
    if (!telLimpo || telLimpo.length < 10) {
      setOtpError('Por favor, informe seu Telefone / WhatsApp com DDD (mínimo 10 dígitos).')
      return
    }

    // 5. E-mail Obrigatório e Válido
    const emailLimpo = signatarioEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailLimpo || !emailRegex.test(emailLimpo)) {
      setOtpError('Por favor, informe um endereço de E-mail válido.')
      return
    }

    setOtpLoading(true)
    setOtpError(null)

    try {
      const res = await fetch('/api/matriculas/digital/enviar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_assinatura: contrato.token_assinatura,
          email_destinatario: emailLimpo,
          nome_destinatario: nomeLimpo,
          cpf_destinatario: cpfLimpo,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar código de segurança.')
      }

      setEmailMascarado(data.emailMascarado || emailLimpo)
      setOtpCode('')
      setCountdown(45)
      if (data.codigoSimulado) {
        setSimulatedCode(data.codigoSimulado)
      }
      setModalStep(2)
    } catch (err: any) {
      setOtpError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  // Verificar código OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      setOtpError('Digite o código numérico completo de 6 dígitos.')
      return
    }

    setOtpLoading(true)
    setOtpError(null)

    try {
      const res = await fetch('/api/matriculas/digital/verificar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_assinatura: contrato.token_assinatura,
          codigo: otpCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Código incorreto ou expirado.')
      }

      contrato.otp_confirmado_em = data.confirmadoEm || new Date().toISOString()
      setModalStep(3)
    } catch (err: any) {
      setOtpError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  // Finalizar Assinatura
  const handleFinalizeSignature = async () => {
    if (!aceitouTermos) {
      setSigningError('Você precisa marcar a declaração explícita de aceite e ciência.')
      return
    }

    const cpfLimpoFinal = (signatarioCpf || '').replace(/\D/g, '')
    if (!validarCPF(cpfLimpoFinal)) {
      setSigningError('O CPF do signatário é inválido. Por favor, retorne e corrija seu CPF.')
      return
    }

    setSigningLoading(true)
    setSigningError(null)

    try {
      let assinaturaBase64: string | null = null

      if (tipoAssinatura === 'manual') {
        if (canvasRef.current && hasManualDrawing) {
          assinaturaBase64 = canvasRef.current.toDataURL('image/png')
        }
      } else {
        // Gera imagem da assinatura caligráfica
        assinaturaBase64 = generateAutomaticSignatureImage()
      }

      // Identificação pericial concisa do dispositivo e navegador
      const ua = navigator.userAgent
      let friendlyBrowser = 'Navegador Web Seguro'
      if (ua.includes('Edg/')) friendlyBrowser = 'Microsoft Edge'
      else if (ua.includes('Chrome/') || ua.includes('CriOS/')) friendlyBrowser = 'Google Chrome'
      else if (ua.includes('Safari/')) friendlyBrowser = 'Apple Safari'
      else if (ua.includes('Firefox/')) friendlyBrowser = 'Mozilla Firefox'

      let friendlyOs = 'Sistema Operacional Seguro'
      if (ua.includes('Macintosh') || ua.includes('Mac OS')) friendlyOs = 'macOS (Apple)'
      else if (ua.includes('iPhone') || ua.includes('iPad')) friendlyOs = 'iOS (Apple)'
      else if (ua.includes('Windows')) friendlyOs = 'Windows'
      else if (ua.includes('Android')) friendlyOs = 'Android'

      const clientInfo = {
        browser: friendlyBrowser,
        os: friendlyOs,
        device: window.innerWidth < 768 ? 'Smartphone' : 'Computador Desktop',
        userAgent: ua,
        screen: `${window.screen.width}x${window.screen.height}`,
      }

      const res = await fetch('/api/matriculas/digital/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_assinatura: contrato.token_assinatura,
          signatario_nome: sanitizeSignerName(signatarioNome),
          signatario_cpf: signatarioCpf,
          signatario_data_nascimento: signatarioDataNascimento,
          signatario_email: signatarioEmail,
          signatario_telefone: signatarioTelefone,
          tipoAssinatura,
          estiloCaligrafico,
          assinaturaBase64,
          otp_codigo: otpCode || undefined,
          aceiteTexto: `Declaro ter lido atentamente o documento "${contrato.titulo_documento}" na íntegra, concordando com todas as suas cláusulas e manifestando livre consentimento para sua assinatura eletrônica nos termos do art. 10, § 2º da MP nº 2.200-2/2001 e arts. 107, 219 e 221 do Código Civil Brasileiro.`,
          clientInfo,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar assinatura eletrônica.')
      }

      setSignedResult({
        protocolo: data.protocolo,
        documentoFinalHash: data.documentoFinalHash,
        validationUrl: data.validationUrl,
        signedPdfBase64: data.signedPdfBase64,
        emailEnviado: data.emailEnviado,
        emailDestinatario: data.emailDestinatario,
        emailErro: data.emailErro,
      })
      setModalStep(4)
    } catch (err: any) {
      setSigningError(err.message)
    } finally {
      setSigningLoading(false)
    }
  }

  // Reenvio da via assinada do contrato por e-mail sob demanda
  const handleResendContractEmail = async (emailToUse?: string) => {
    setIsResendingEmail(true)
    setResendEmailSuccessMsg(null)
    setResendEmailErrorMsg(null)
    try {
      const targetEmail = (emailToUse || resendEmailInput || signedResult?.emailDestinatario || signatarioEmail || contrato.responsavel_email || '').trim()
      if (!targetEmail || !targetEmail.includes('@')) {
        throw new Error('Informe um endereço de e-mail válido para envio.')
      }
      const res = await fetch('/api/matriculas/digital/reenviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_assinatura: contrato.token_assinatura,
          email_destinatario: targetEmail,
          atualizar_email_cadastro: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao reenviar e-mail.')
      }
      setResendEmailSuccessMsg(`Cópia enviada com sucesso para ${targetEmail}!`)
      if (signedResult) {
        setSignedResult({
          ...signedResult,
          emailEnviado: true,
          emailDestinatario: targetEmail,
        })
      }
      setShowAlternativeEmailInput(false)
    } catch (err: any) {
      setResendEmailErrorMsg(err.message || 'Erro de conexão ao reenviar e-mail.')
    } finally {
      setIsResendingEmail(false)
    }
  }

  // Download do PDF de forma nativa e eficiente compatível com Safari e todos os navegadores
  const downloadPdf = (source?: string | null, filename?: string) => {
    const proto = signedResult?.protocolo || contrato.protocolo || 'Oficial'
    const defaultFilename = `Documento_Assinado_${proto}.pdf`
    const finalName = filename || defaultFilename
    const downloadLink = document.createElement('a')
    if (source && source.startsWith('data:')) {
      downloadLink.href = source
    } else {
      downloadLink.href = `/api/matriculas/digital/pdf/${contrato.token_assinatura}?v=assinado&download=1`
    }
    downloadLink.download = finalName
    document.body.appendChild(downloadLink)
    downloadLink.click()
    setTimeout(() => {
      try {
        document.body.removeChild(downloadLink)
      } catch {}
    }, 200)
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#14213D] flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <style>{`
        @font-face {
          font-family: 'Dancing Script';
          src: url('/fonts/DancingScript-Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      {/* ── CABEÇALHO COMPACTO E ELEGANTE ── */}
      <div className="max-w-[1480px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <header className="bg-white border border-slate-200/80 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
          {/* Logo + Nome do Colégio + Assinatura eletrônica */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center p-0.5 overflow-hidden">
              <img
                src={contrato.logoUrl || '/logo-impacto-clean.png'}
                alt={contrato.representanteEscola?.razaoSocial || 'Colégio Impacto'}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-bold text-base text-[#14213D] leading-tight">
                Colégio Impacto
              </div>
              <div className="text-xs text-slate-500 font-normal">
                Assinatura eletrônica
              </div>
            </div>
          </div>

          {/* Ambiente Seguro com Escudo */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50/70 border border-slate-200/60 rounded-full px-3 py-1">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            <span>Ambiente seguro</span>
          </div>
        </header>

        {/* ── INTRODUÇÃO E BREADCRUMB ── */}
        <div className="mt-5 mb-5">
          {/* Breadcrumb discreto */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1.5" aria-label="Navegação">
            <Home size={13} className="text-slate-400" />
            <ChevronRight size={12} className="text-slate-300" />
            <span>Documentos</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-700 font-semibold">Assinatura</span>
          </nav>

          <h1 className="text-2xl sm:text-[28px] font-bold text-[#14213D] tracking-tight m-0">
            Revise e assine seu documento
          </h1>
          <p className="text-sm text-slate-500 mt-1 mb-0 font-normal">
            Confira o documento e os dados antes de assinar.
          </p>
        </div>

        {/* ── ÁREA PRINCIPAL EM DUAS COLUNAS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">
          {/* ── COLUNA ESQUERDA: DOCUMENTO (~66% / 8 colunas) ── */}
          <section className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
            {/* Cabeçalho do Painel do Documento */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {/* Ícone Vermelho de PDF */}
                <div className="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <FileText size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#14213D] truncate m-0 leading-tight">
                    {contrato.titulo_documento || 'Documento para assinatura'}
                  </h2>
                  <div className="text-xs text-slate-500 font-normal truncate mt-0.5">
                    {contrato.protocolo} • PDF • {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                  </div>
                </div>
              </div>

              {/* Ação discreta "Abrir em nova aba" */}
              <button
                type="button"
                onClick={handleOpenPdfInNewTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs cursor-pointer"
                title="Abrir documento PDF em nova aba do navegador"
              >
                <ExternalLink size={13} className="text-slate-500" />
                <span>Abrir em nova aba</span>
              </button>
            </div>

            {/* Barra de Ferramentas Compacta */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/80 text-slate-700 text-xs font-medium">
              {/* Controles de Paginação: Anterior, 1 de N, Próxima */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-md hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-slate-700"
                  title="Página Anterior"
                  aria-label="Página Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-slate-700 px-1 select-none">
                  {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-md hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-slate-700"
                  title="Próxima Página"
                  aria-label="Próxima Página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Controles de Zoom, Ajuste e Expansão */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setZoomPercent(z => Math.max(40, z - 10))}
                    className="p-1 hover:text-blue-600 transition cursor-pointer text-slate-600"
                    title="Diminuir Zoom (-)"
                    aria-label="Diminuir Zoom"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-xs font-semibold text-slate-700 min-w-[38px] text-center select-none">
                    {zoomPercent}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomPercent(z => Math.min(180, z + 10))}
                    className="p-1 hover:text-blue-600 transition cursor-pointer text-slate-600"
                    title="Aumentar Zoom (+)"
                    aria-label="Aumentar Zoom"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => setZoomPercent(75)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-medium transition shadow-2xs cursor-pointer"
                  title="Ajustar à página"
                >
                  <Maximize2 size={13} className="text-slate-500" />
                  <span className="hidden sm:inline">Ajustar à página</span>
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(true)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 transition shadow-2xs cursor-pointer"
                  title="Visualização ampliada / tela cheia"
                  aria-label="Visualização ampliada"
                >
                  <Expand size={14} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Visualizador de PDF com Proporção Original */}
            <div
              ref={viewerRef}
              suppressHydrationWarning
              className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3 sm:p-5 flex items-center justify-center min-h-[460px] sm:min-h-[520px] overflow-auto relative"
            >
              <PdfCanvasViewer
                pdfUrl={pdfViewUrl}
                pageNumber={currentPage}
                zoomPercent={zoomPercent}
                enableGestures={true}
                onZoomChange={setZoomPercent}
                containerBackground="#F8FAFC"
                onTotalPagesLoaded={setTotalPages}
                onPdfDocLoaded={setLoadedPdfDoc}
              />
            </div>

            {/* Faixa de Miniaturas (Bottom Strip) */}
            <div className="flex items-center gap-3 overflow-x-auto py-2 pt-3 border-t border-slate-100 scrollbar-thin">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => (
                <PdfThumbnailItem
                  key={pNum}
                  pdfDoc={loadedPdfDoc}
                  pageNumber={pNum}
                  isActive={currentPage === pNum}
                  onSelect={() => setCurrentPage(pNum)}
                />
              ))}
            </div>
          </section>

          {/* ── COLUNA DIREITA: RESUMO DA ASSINATURA (~34% / 4 colunas) ── */}
          <aside className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4 sm:gap-5 sticky top-6">
            {/* Topo: Título + Badge de Status */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#14213D] m-0">
                Resumo da assinatura
              </h2>

              {signedResult || contrato.status === 'assinado' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-xs font-semibold">
                  <CheckCircle2 size={13} className="text-[#047857]" />
                  <span>Documento assinado</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF7E6] border border-[#FFE7BA] text-[#A85D00] text-xs font-semibold">
                  <Clock size={13} className="text-[#A85D00]" />
                  <span>Aguardando assinatura</span>
                </div>
              )}
            </div>

            {/* Card 1: Signatário / Responsável */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={13} className="text-blue-600" />
                  Signatário / Responsável
                </span>
                {signedResult || contrato.status === 'assinado' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    Assinado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/80 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                    <Clock size={11} className="text-amber-600" />
                    Pendente
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 bg-white border border-slate-200/70 rounded-lg p-3 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-[#E0F2FE] text-[#1D4ED8] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                  {getSignerInitials(signatarioNome || contrato.signatario_nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#14213D] truncate">
                    {signatarioNome || contrato.signatario_nome || 'Signatário Principal'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 truncate">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {maskEmailDisplay(signatarioEmail || contrato.signatario_email || '')}
                    </span>
                  </div>
                  {(signatarioTelefone || contrato.signatario_telefone) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 truncate">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      <span>
                        {maskPhoneDisplay(signatarioTelefone || contrato.signatario_telefone || '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Representante do Colégio & Chancela */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-blue-600" />
                  Representante do Colégio
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  Autenticado
                </span>
              </div>

              {contrato.representanteEscola?.representantes && contrato.representanteEscola.representantes.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-bold text-[#14213D] uppercase tracking-wide">
                    {contrato.representanteEscola.representantes.length} Representantes da Instituição:
                  </div>
                  {contrato.representanteEscola.representantes.map((rep: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 bg-white border border-slate-200/70 rounded-lg p-2.5 shadow-2xs">
                      <div className="w-7 h-7 rounded-full bg-[#EFF6FF] border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 size={13} className="text-[#2563EB]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#14213D] uppercase truncate">
                          {rep.nome}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {rep.cargo}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-[11px] text-slate-500 px-1 truncate">
                    {contrato.representanteEscola?.razaoSocial || 'Colégio Impacto Ltda'}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-white border border-slate-200/70 rounded-lg p-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-[#2563EB]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#14213D] uppercase truncate">
                      {contrato.representanteEscola?.nome || 'IVAN ROSSI SAMBRANA'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {contrato.representanteEscola?.cargo || 'Representante legal / Diretor'}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {contrato.representanteEscola?.razaoSocial || 'Colégio Impacto Ltda'}
                    </div>
                  </div>
                </div>
              )}

              {/* Chancela Institucional */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Chancela Institucional
                </span>
                <div className="border border-dashed border-slate-200 rounded-lg p-2 bg-white flex items-center justify-center h-20 overflow-hidden shadow-2xs">
                  <img
                    src={contrato.representanteEscola?.assinaturaUrl || '/assinatura-representante.png'}
                    alt="Chancela Institucional"
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Ação Principal */}
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 text-center m-0 font-normal">
                Após revisar, clique abaixo para continuar.
              </p>

              {signedResult || contrato.status === 'assinado' ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadPdf(
                        signedResult?.signedPdfBase64,
                        `Documento_Assinado_${signedResult?.protocolo || contrato.protocolo}.pdf`
                      )
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm py-3.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download size={16} /> Baixar documento assinado
                  </button>

                  <a
                    href={`/validar-assinatura/${encodeURIComponent(signedResult?.protocolo || contrato.protocolo || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-medium text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer no-underline"
                  >
                    <ShieldCheck size={15} className="text-emerald-600" /> Ver comprovante e validação
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(true)}
                  className="w-full bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm py-3.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
                >
                  <PenTool size={16} /> Assinar documento
                </button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock size={12} className="text-slate-400" />
                <span>Assinatura eletrônica segura</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── MODAL ULTRA MODERNO DE ASSINATURA ── */}
      <AnimatePresence>
        {isSignModalOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget && !signingLoading && !otpLoading) {
                setIsSignModalOpen(false)
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(8px, 2.5vw, 16px)',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 20,
                width: '100%',
                maxWidth: 490,
                maxHeight: '92vh',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)',
                position: 'relative',
                boxSizing: 'border-box',
              }}
            >
              {/* Cabeçalho do Modal */}
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #091a3c 0%, #1e3a8a 100%)',
                  borderTopLeftRadius: 19,
                  borderTopRightRadius: 19,
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <img
                      src={contrato.logoUrl || '/logo-impacto-clean.png'}
                      alt={contrato.representanteEscola?.razaoSocial || 'Logo'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
                      Assinatura Eletrônica Jurídica
                    </div>
                    <div
                      style={{
                        fontSize: 'clamp(12.5px, 3.5vw, 14.5px)',
                        fontWeight: 800,
                        color: '#ffffff',
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}
                      title={
                        modalStep === 1 ? '1. Confirmação dos Dados do Signatário' :
                        modalStep === 2 ? '2. Código de Segurança (OTP)' :
                        modalStep === 3 ? '3. Assinatura e Manifestação de Vontade' :
                        'Documento Concluído com Sucesso!'
                      }
                    >
                      {modalStep === 1 && '1. Confirmação dos Dados'}
                      {modalStep === 2 && '2. Código de Segurança (OTP)'}
                      {modalStep === 3 && '3. Assinatura e Manifestação'}
                      {modalStep === 4 && '4. Documento Concluído!'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.color = '#e2e8f0'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }}
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Barra de Progresso / Stepper Leve e Moderno */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '6px 8px',
                  gap: 4,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {[
                  { step: 1, label: 'Dados' },
                  { step: 2, label: 'Código' },
                  { step: 3, label: 'Assinatura' },
                  { step: 4, label: 'Concluído' },
                ].map((item) => {
                  const isPassed = modalStep > item.step
                  const isCurrent = modalStep === item.step
                  return (
                    <div
                      key={item.step}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '4px 2px',
                        borderRadius: 6,
                        background: isCurrent
                          ? '#eff6ff'
                          : isPassed
                          ? '#ecfdf5'
                          : 'transparent',
                        border: isCurrent
                          ? '1px solid #bfdbfe'
                          : isPassed
                          ? '1px solid #a7f3d0'
                          : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 800,
                          background: isCurrent
                            ? '#2563eb'
                            : isPassed
                            ? '#10b981'
                            : '#cbd5e1',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        {isPassed ? '✓' : item.step}
                      </div>
                      <span
                        style={{
                          fontSize: 'clamp(9px, 2.4vw, 11px)',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent
                            ? '#1d4ed8'
                            : isPassed
                            ? '#047857'
                            : '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Corpo do Modal */}
              <div style={{ padding: 'clamp(12px, 3.5vw, 18px)' }}>
                {/* ── PASSO 1: DADOS DO SIGNATÁRIO ── */}
                {modalStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                      Confirme os dados cadastrais que serão vinculados à sua chave de assinatura jurídica:
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={signatarioNome}
                        onChange={e => setSignatarioNome(e.target.value)}
                        placeholder="Nome completo do signatário"
                        style={{
                          width: '100%',
                          height: 38,
                          padding: '8px 12px',
                          background: '#f8fafc',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: 8,
                          color: '#0f172a',
                          fontSize: 13,
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onFocus={e => {
                          e.currentTarget.style.background = '#ffffff'
                          e.currentTarget.style.borderColor = '#2563eb'
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                        }}
                        onBlur={e => {
                          e.currentTarget.style.background = '#f8fafc'
                          e.currentTarget.style.borderColor = '#cbd5e1'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                            CPF *
                          </label>
                          {isCpfCompleto && !isCpfValido && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#b91c1c',
                                background: '#fee2e2',
                                padding: '1px 6px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                border: '1px solid #fecaca',
                              }}
                            >
                              ✕ CPF Inválido
                            </span>
                          )}
                        </div>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={signatarioCpf}
                            onChange={e => {
                              setSignatarioCpf(maskCpf(e.target.value))
                              if (otpError) setOtpError(null)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleRequestOtp()
                              }
                            }}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            style={{
                              width: '100%',
                              height: 38,
                              padding: '8px 10px',
                              paddingRight: isCpfCompleto && !isCpfValido ? 28 : 10,
                              background: '#f8fafc',
                              border: `1.5px solid ${
                                isCpfCompleto && !isCpfValido ? '#ef4444' : '#cbd5e1'
                              }`,
                              borderRadius: 8,
                              color: '#0f172a',
                              fontSize: 12.5,
                              outline: 'none',
                              fontFamily: 'monospace',
                              boxShadow: isCpfCompleto && !isCpfValido ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                            onFocus={e => {
                              if (!(isCpfCompleto && !isCpfValido)) {
                                e.currentTarget.style.background = '#ffffff'
                                e.currentTarget.style.borderColor = '#2563eb'
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                              }
                            }}
                            onBlur={e => {
                              if (!(isCpfCompleto && !isCpfValido)) {
                                e.currentTarget.style.background = '#f8fafc'
                                e.currentTarget.style.borderColor = '#cbd5e1'
                                e.currentTarget.style.boxShadow = 'none'
                              }
                            }}
                          />
                          {isCpfCompleto && !isCpfValido && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                pointerEvents: 'none',
                              }}
                            >
                              <AlertCircle size={15} color="#ef4444" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                          Data de Nascimento *
                        </label>
                        <input
                          type="text"
                          value={signatarioDataNascimento}
                          onChange={e => setSignatarioDataNascimento(maskDate(e.target.value))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleRequestOtp()
                            }
                          }}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '8px 10px',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 8,
                            color: '#0f172a',
                            fontSize: 12.5,
                            outline: 'none',
                            fontFamily: 'monospace',
                            transition: 'all 0.15s ease',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.background = '#ffffff'
                            e.currentTarget.style.borderColor = '#2563eb'
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                          }}
                          onBlur={e => {
                            e.currentTarget.style.background = '#f8fafc'
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          value={signatarioTelefone}
                          onChange={e => setSignatarioTelefone(maskPhone(e.target.value))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleRequestOtp()
                            }
                          }}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '8px 10px',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 8,
                            color: '#0f172a',
                            fontSize: 12.5,
                            outline: 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.background = '#ffffff'
                            e.currentTarget.style.borderColor = '#2563eb'
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                          }}
                          onBlur={e => {
                            e.currentTarget.style.background = '#f8fafc'
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                          E-mail Oficial *
                        </label>
                        <input
                          type="email"
                          value={signatarioEmail}
                          onChange={e => setSignatarioEmail(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleRequestOtp()
                            }
                          }}
                          placeholder="seuemail@exemplo.com"
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '8px 10px',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 8,
                            color: '#0f172a',
                            fontSize: 12.5,
                            outline: 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.background = '#ffffff'
                            e.currentTarget.style.borderColor = '#2563eb'
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                          }}
                          onBlur={e => {
                            e.currentTarget.style.background = '#f8fafc'
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#0369a1', background: '#f0f9ff', padding: '8px 12px', borderRadius: 8, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.35 }}>
                      <ShieldCheck size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                      <span>Campos protegidos e validados conforme a legislação de assinatura eletrônica (MP 2.200-2).</span>
                    </div>

                    {otpError && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{otpError}</span>
                      </div>
                    )}

                    <button
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '11px 16px',
                        fontSize: 13.5,
                        fontWeight: 700,
                        cursor: otpLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 3px 12px rgba(37, 99, 235, 0.25)',
                        marginTop: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {otpLoading ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" /> Enviando Código...
                        </>
                      ) : (
                        <>
                          Avançar para o Código de Segurança <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ── PASSO 2: CÓDIGO OTP ── */}
                {modalStep === 2 && (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1.5px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
                      }}
                    >
                      <Mail size={24} />
                    </div>

                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                        Digite o Código de Segurança
                      </div>
                      <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        Enviamos um código de 6 dígitos para o e-mail:
                        <br />
                        <span style={{ color: '#0284c7', fontWeight: 700, background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: 6, display: 'inline-block', marginTop: 4 }}>
                          {emailMascarado || signatarioEmail}
                        </span>
                      </p>
                    </div>

                    {simulatedCode && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '7px 12px', fontSize: 11.5 }}>
                        ⚡ <strong>Código de Teste:</strong> <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{simulatedCode}</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        style={{
                          width: 200,
                          height: 48,
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: 24,
                          fontWeight: 800,
                          letterSpacing: '8px',
                          background: '#f8fafc',
                          color: '#0f172a',
                          border: '2px solid #2563eb',
                          borderRadius: 10,
                          outline: 'none',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
                        }}
                        autoFocus
                      />
                    </div>

                    {otpError && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{otpError}</span>
                      </div>
                    )}

                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpCode.length < 6}
                      style={{
                        background: otpCode.length === 6 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f1f5f9',
                        color: otpCode.length === 6 ? '#ffffff' : '#64748b',
                        border: otpCode.length === 6 ? 'none' : '1.5px solid #cbd5e1',
                        borderRadius: 10,
                        padding: '12px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: otpCode.length === 6 && !otpLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: otpCode.length === 6 ? '0 3px 12px rgba(16, 185, 129, 0.25)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {otpLoading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Validar Código e Prosseguir
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, marginTop: 2 }}>
                      <button
                        onClick={() => setModalStep(1)}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, padding: 0 }}
                      >
                        <ArrowLeft size={13} /> Corrigir dados
                      </button>

                      {countdown > 0 ? (
                        <span style={{ color: '#64748b' }}>Aguarde {countdown}s para reenviar</span>
                      ) : (
                        <button
                          onClick={handleRequestOtp}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Reenviar código
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                      <a
                        href={getWhatsAppShareUrl('5567992806464', `Olá! Estou na etapa de validação do código OTP para assinatura do contrato (${contrato.protocolo}) do(a) estudante ${contrato.aluno_nome || 'meu filho(a)'}. Poderiam me auxiliar?`)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: '#15803d',
                          fontSize: 11.5,
                          fontWeight: 600,
                          textDecoration: 'none',
                          background: '#f0fdf4',
                          padding: '7px 12px',
                          borderRadius: 8,
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <Smartphone size={13} /> Não recebeu no e-mail? Falar no WhatsApp da Secretaria
                      </a>
                    </div>
                  </div>
                )}

                {/* ── PASSO 3: ESCOLHA DA ASSINATURA & ACEITE ── */}
                {modalStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Seletor Segmented iOS-style */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                        Modo de Assinatura:
                      </label>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 4,
                          background: '#f1f5f9',
                          padding: 3,
                          borderRadius: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setTipoAssinatura('nome_automatico')}
                          style={{
                            background: tipoAssinatura === 'nome_automatico' ? '#ffffff' : 'transparent',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 10px',
                            color: tipoAssinatura === 'nome_automatico' ? '#1d4ed8' : '#64748b',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            boxShadow: tipoAssinatura === 'nome_automatico' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Sparkles size={14} color={tipoAssinatura === 'nome_automatico' ? '#2563eb' : '#64748b'} />
                          Pelo Nome (Digital)
                        </button>

                        <button
                          type="button"
                          onClick={() => setTipoAssinatura('manual')}
                          style={{
                            background: tipoAssinatura === 'manual' ? '#ffffff' : 'transparent',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 10px',
                            color: tipoAssinatura === 'manual' ? '#1d4ed8' : '#64748b',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            boxShadow: tipoAssinatura === 'manual' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <PenTool size={14} color={tipoAssinatura === 'manual' ? '#2563eb' : '#64748b'} />
                          Desenhar (Manual)
                        </button>
                      </div>
                    </div>

                    {/* Bloco de Assinatura Automática */}
                    {tipoAssinatura === 'nome_automatico' && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 10px', minWidth: 0, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                          <span>Escolha a Caligrafia:</span>
                          <span style={{ color: '#0284c7' }}>Pré-visualização</span>
                        </div>

                        {/* Grade de Estilos com proteção estrita contra overflow */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                          {ESTILOS_CALIGRAFICOS.map(estilo => (
                            <button
                              key={estilo.id}
                              type="button"
                              onClick={() => setEstiloCaligrafico(estilo.id)}
                              title={signatarioNome || 'Assinatura'}
                              style={{
                                background: '#ffffff',
                                border: estiloCaligrafico === estilo.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                borderRadius: 8,
                                padding: '8px 4px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                boxShadow: estiloCaligrafico === estilo.id ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
                                transition: 'all 0.15s ease',
                                width: '100%',
                                minWidth: 0,
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', maxWidth: '100%' }}>
                                {estilo.nome}
                              </div>
                              <div
                                style={{
                                  fontFamily: estilo.font,
                                  fontSize: 'clamp(14px, 3.8vw, 17px)',
                                  fontStyle: estilo.slant as any,
                                  fontWeight: estilo.weight as any,
                                  color: '#0f2757',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  width: '100%',
                                  maxWidth: '100%',
                                  lineHeight: 1.2,
                                  padding: '0 2px',
                                }}
                              >
                                {formatAbbreviatedSignerName(signatarioNome) || signatarioNome || 'Assinatura'}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div style={{ textAlign: 'center', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          🔒 Vinculada criptograficamente ao CPF {signatarioCpf || 'Registrado'}
                        </div>
                      </div>
                    )}

                    {/* Bloco de Assinatura Manual */}
                    {tipoAssinatura === 'manual' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>
                            Desenhe com o dedo ou mouse:
                          </span>
                          {hasManualDrawing && (
                            <button
                              type="button"
                              onClick={clearCanvas}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                            >
                              Limpar Traço
                            </button>
                          )}
                        </div>

                        <div style={{ background: '#ffffff', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #cbd5e1', position: 'relative' }}>
                          <canvas
                            ref={canvasRef}
                            width={500}
                            height={120}
                            style={{ width: '100%', height: 120, cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          {!hasManualDrawing && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12.5, pointerEvents: 'none' }}>
                              ✍️ Assine nesta área
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Selo Oficial Preview */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                          <BadgeCheck size={14} color="#0284c7" />
                          <span>Selo Aposto nos Arquivos</span>
                        </div>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: '#10b981', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: 999 }}>
                          MP 2.200-2
                        </span>
                      </div>

                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderLeft: '3px solid #10b981',
                          borderRadius: 8,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="QR Code"
                            style={{ width: 40, height: 40, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 4, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <QrCode size={18} color="#64748b" />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div
                            style={{
                              fontFamily: estiloCaligrafico === 'formal'
                                ? "'Georgia', 'Times New Roman', serif"
                                : "'Dancing Script', 'Brush Script MT', 'Caveat', cursive",
                              fontStyle: estiloCaligrafico === 'formal' ? 'italic' : 'normal',
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#0f2757',
                              lineHeight: 1.2,
                            }}
                          >
                            {formatAbbreviatedSignerName(signatarioNome || contrato.signatario_nome)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Check size={12} strokeWidth={3} /> assinado eletronicamente
                          </div>
                          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span>{formatTimestampSelo(new Date().toISOString())}</span>
                            <span>•</span>
                            <span>Prot: {contrato.protocolo}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Aceite Explícito */}
                    <label
                      style={{
                        background: aceitouTermos ? '#f0fdf4' : '#f8fafc',
                        border: aceitouTermos ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        gap: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={aceitouTermos}
                        onChange={e => setAceitouTermos(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#10b981', marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ fontSize: 11.5, lineHeight: 1.4, color: '#1e293b' }}>
                        <strong style={{ color: '#15803d' }}>DECLARAÇÃO DE ACEITE EXPRESSO:</strong>
                        <br />
                        Li o documento <strong>"{contrato.titulo_documento}"</strong> na íntegra e manifesto consentimento expresso e irrevogável para assinatura eletrônica nos termos da MP 2.200-2/2001 e Código Civil.
                      </div>
                    </label>

                    {signingError && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{signingError}</span>
                      </div>
                    )}

                    <button
                      onClick={handleFinalizeSignature}
                      disabled={signingLoading || !aceitouTermos}
                      style={{
                        background: aceitouTermos ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f1f5f9',
                        color: aceitouTermos ? '#ffffff' : '#64748b',
                        border: aceitouTermos ? 'none' : '1.5px solid #cbd5e1',
                        borderRadius: 10,
                        padding: '13px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: aceitouTermos && !signingLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: aceitouTermos ? '0 3px 14px rgba(16, 185, 129, 0.25)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {signingLoading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Anexando Certificado & Selando PDF...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} /> Concluir e Assinar Documento
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ── PASSO 4: SUCESSO & RECIBO DIGITAL ── */}
                {modalStep === 4 && signedResult && (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Hero Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          background: '#ecfdf5',
                          color: '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '3px solid #a7f3d0',
                          boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.08)',
                        }}
                      >
                        <CheckCircle2 size={32} strokeWidth={2.5} />
                      </div>

                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.02em' }}>
                          Documento Concluído com Sucesso!
                        </h2>
                        <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                          Autenticado e certificado digitalmente nos termos da MP 2.200-2/2001.
                        </p>
                      </div>
                    </div>

                    {/* Cartão de Certificado Unificado (Protocolo + Selo) */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '12px 14px',
                        textAlign: 'left',
                      }}
                    >
                      {/* Linha de Topo: Protocolo + Badge Oficial */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Protocolo:</span>
                          <span style={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>
                            {signedResult.protocolo}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            padding: '2px 8px',
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Check size={11} strokeWidth={3} /> Autenticado
                        </span>
                      </div>

                      {/* Linha do Meio: Assinatura e Carimbo de Tempo */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                        <div>
                          <div style={{ fontSize: 9.5, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                            Signatário Certificado
                          </div>
                          <div
                            style={{
                              fontFamily: estiloCaligrafico === 'formal'
                                ? "'Georgia', 'Times New Roman', serif"
                                : "'Dancing Script', 'Brush Script MT', 'Caveat', cursive",
                              fontStyle: estiloCaligrafico === 'formal' ? 'italic' : 'normal',
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#0f2757',
                              lineHeight: 1.2,
                              marginTop: 1,
                            }}
                          >
                            {formatAbbreviatedSignerName(signatarioNome || contrato.signatario_nome)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                            <Check size={12} strokeWidth={3} /> selado no PDF
                          </div>
                          <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
                            {formatTimestampSelo(new Date().toISOString())}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notificação por E-mail */}
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 12,
                        padding: '12px 14px',
                        textAlign: 'left',
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#15803d' }}>
                          <Mail size={14} />
                          <span>Cópia Oficial Enviada por E-mail</span>
                        </div>
                        {signedResult.emailEnviado && (
                          <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 999, fontWeight: 700 }}>
                            ✓ Entregue
                          </span>
                        )}
                      </div>

                      <div style={{ color: '#334155', lineHeight: 1.4 }}>
                        {signedResult.emailEnviado ? (
                          <>
                            A via oficial em PDF foi despachada para <strong style={{ color: '#0f172a' }}>{signedResult.emailDestinatario || signatarioEmail || contrato.responsavel_email}</strong>.
                            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3 }}>
                              💡 <em>Não encontrou na Caixa de Entrada? Verifique a pasta de <strong>"Spam"</strong> ou <strong>"Lixo Eletrônico"</strong>.</em>
                            </div>
                          </>
                        ) : (
                          <>
                            O documento está certificado. Se desejar receber a via oficial por e-mail, utilize as opções abaixo.
                          </>
                        )}
                      </div>

                      {/* Mensagens de Feedback */}
                      {resendEmailSuccessMsg && (
                        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 6 }}>
                          {resendEmailSuccessMsg}
                        </div>
                      )}
                      {resendEmailErrorMsg && (
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 6 }}>
                          {resendEmailErrorMsg}
                        </div>
                      )}

                      {/* Alternativa de e-mail */}
                      {showAlternativeEmailInput ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <input
                            type="email"
                            placeholder="Digite outro e-mail..."
                            value={resendEmailInput}
                            onChange={e => setResendEmailInput(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              color: '#0f172a',
                              fontSize: 11.5,
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            disabled={isResendingEmail}
                            onClick={() => handleResendContractEmail(resendEmailInput)}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isResendingEmail ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                            Enviar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAlternativeEmailInput(false)}
                            style={{
                              background: 'transparent',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              padding: '6px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            disabled={isResendingEmail}
                            onClick={() => handleResendContractEmail()}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: '#1e293b',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            {isResendingEmail ? (
                              <>
                                <RefreshCw size={11} className="animate-spin" /> Reenviando...
                              </>
                            ) : (
                              <>
                                <RefreshCw size={11} /> Reenviar Cópia por E-mail
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResendEmailInput(signedResult.emailDestinatario || signatarioEmail || contrato.responsavel_email || '')
                              setShowAlternativeEmailInput(true)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#0284c7',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: '4px',
                            }}
                          >
                            Enviar para outro e-mail
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                      <button
                        onClick={() =>
                          downloadPdf(
                            signedResult.signedPdfBase64,
                            `Documento_Assinado_${signedResult.protocolo}.pdf`
                          )
                        }
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 10,
                          padding: '13px',
                          fontSize: 13.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: '0 3px 12px rgba(16, 185, 129, 0.25)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Download size={16} /> Baixar PDF Assinado com Certificado
                      </button>

                      <a
                        href={`/validar-assinatura/${encodeURIComponent(signedResult?.protocolo || contrato.protocolo || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#1e293b',
                          borderRadius: 10,
                          padding: '11px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = '#f8fafc'
                          e.currentTarget.style.borderColor = '#cbd5e1'
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = '#ffffff'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                        }}
                      >
                        <ShieldCheck size={15} color="#059669" /> Ver Comprovante e Validação Oficial
                      </a>

                      <button
                        type="button"
                        onClick={() => setIsSignModalOpen(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '6px',
                        }}
                      >
                        Fechar Janela
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL ULTRA MODERNO DE ZOOM & VISUALIZAÇÃO AMPLIADA DO PDF ── */}
      <AnimatePresence>
        {isZoomModalOpen && (
          <div
            onClick={e => {
              if (e.target === e.currentTarget) {
                setIsZoomModalOpen(false)
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 115,
              background: 'rgba(3, 7, 18, 0.94)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              overscrollBehavior: 'contain',
              touchAction: 'pan-x pan-y',
            }}
          >
            {/* Barra Superior / Header do Zoom */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, #0f172a 0%, #0b1329 100%)',
                flexShrink: 0,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* Informações do Documento & Paginação */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: currentPage <= 1 ? '#475569' : '#e2e8f0',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                    title="Página Anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', padding: '0 4px' }}>
                    <strong style={{ color: '#38bdf8' }}>{currentPage}</strong> / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: currentPage >= totalPages ? '#475569' : '#e2e8f0',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                    title="Próxima Página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="hidden sm:block" style={{ fontSize: 12, color: '#94a3b8', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {contrato.titulo_documento}
                </div>
              </div>

              {/* Controles de Nível de Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '2px 6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setZoomModalScale(z => Math.max(75, z - 20))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Reduzir Zoom (-)"
                  >
                    <ZoomOut size={16} />
                  </button>

                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', minWidth: 44, textAlign: 'center', fontFamily: 'monospace' }}>
                    {zoomModalScale}%
                  </span>

                  <button
                    type="button"
                    onClick={() => setZoomModalScale(z => Math.min(250, z + 20))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Ampliar Zoom (+)"
                  >
                    <ZoomIn size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomModalScale(100)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      marginLeft: 4,
                    }}
                    title="Redefinir para 100%"
                  >
                    100%
                  </button>
                </div>

                {/* Botão Fechar no Canto Superior */}
                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  }}
                  title="Fechar visualização ampliada"
                  aria-label="Fechar"
                >
                  <X size={18} />
                  <span className="hidden sm:inline">Fechar</span>
                </button>
              </div>
            </div>

            {/* Área de Visualização do Documento com Rolagem Contínua e Gestos Fluidos */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PdfCanvasViewer
                pdfUrl={pdfViewUrl}
                pageNumber={currentPage}
                renderAllPages={true}
                zoomPercent={zoomModalScale}
                enableGestures={true}
                onZoomChange={setZoomModalScale}
                onPageChange={setCurrentPage}
                footerAction={
                  <div
                    style={{
                      margin: '28px 0 44px 0',
                      padding: '24px 20px',
                      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(11, 19, 41, 0.96) 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 16,
                      maxWidth: 580,
                      width: '100%',
                      textAlign: 'center',
                      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
                      <CheckCircle2 size={20} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                        Fim do Documento Oficial
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, maxWidth: 440, lineHeight: 1.5 }}>
                      Você visualizou todas as {totalPages} páginas deste contrato.
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: 6 }}>
                      {!signedResult && contrato.status !== 'assinado' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsZoomModalOpen(false)
                            setIsSignModalOpen(true)
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: 12,
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 13,
                            padding: '12px 22px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 6px 20px rgba(2, 132, 199, 0.4)',
                          }}
                        >
                          <PenTool size={16} /> Assinar Documento Agora
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            downloadPdf(
                              signedResult?.signedPdfBase64 || null,
                              `Documento_Assinado_${contrato.protocolo}.pdf`
                            )
                          }
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            border: '1px solid rgba(52, 211, 153, 0.4)',
                            borderRadius: 12,
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 13,
                            padding: '12px 22px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 6px 20px rgba(5, 150, 105, 0.4)',
                          }}
                        >
                          <Download size={16} /> Baixar PDF Assinado
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsZoomModalOpen(false)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: 12,
                          color: '#e2e8f0',
                          fontWeight: 700,
                          fontSize: 13,
                          padding: '12px 18px',
                          cursor: 'pointer',
                        }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL ULTRA MODERNO DE COMPROVANTE & VALIDAÇÃO OFICIAL ── */}
      <AnimatePresence>
        {isComprovanteModalOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsComprovanteModalOpen(false)
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 110,
              background: 'rgba(3, 7, 18, 0.88)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(180deg, #0f172a 0%, #070d1d 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 24,
                width: '100%',
                maxWidth: 680,
                maxHeight: '92vh',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
                position: 'relative',
              }}
            >
              {/* Cabeçalho do Modal */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.7)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: '#34d399',
                    }}
                  >
                    <BadgeCheck size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      ICP-Brasil MP 2.200-2/2001 • Arts. 107, 219 e 221 do CC
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                      Certificado de Autenticidade & Validação Digital
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsComprovanteModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 10,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  }}
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Conteúdo do Dossiê */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Selo Principal de Validação */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 95, 70, 0.12) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: 16,
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                      <CheckCircle2 size={13} /> Documento 100% Autêntico e Assinado
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                      {contrato.titulo_documento}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      Ano Letivo: <strong style={{ color: '#e2e8f0' }}>{contrato.ano_letivo}</strong>
                      {contrato.aluno_nome && (
                        <span> • Aluno: <strong style={{ color: '#38bdf8' }}>{contrato.aluno_nome}</strong></span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      textAlign: 'right',
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                      Protocolo Oficial
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <a
                        href={`/validar-assinatura/${signedResult?.protocolo || contrato.protocolo}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir página oficial de validação deste protocolo"
                        style={{
                          color: '#38bdf8',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 14,
                          textDecoration: 'underline',
                          textUnderlineOffset: 2,
                        }}
                      >
                        {signedResult?.protocolo || contrato.protocolo}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const p = signedResult?.protocolo || contrato.protocolo
                          navigator.clipboard.writeText(p)
                          setCopiadoProtocolo(true)
                          setTimeout(() => setCopiadoProtocolo(false), 2000)
                        }}
                        style={{
                          background: copiadoProtocolo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          border: copiadoProtocolo ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                          color: copiadoProtocolo ? '#34d399' : '#cbd5e1',
                          borderRadius: 6,
                          padding: '3px 6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                        title="Copiar Protocolo"
                      >
                        {copiadoProtocolo ? <Check size={12} /> : <Copy size={12} />}
                        {copiadoProtocolo ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Signatários Certificados */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Signatários Certificados
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {/* Signatário 1 */}
                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                        <User size={14} /> 1. Signatário / Responsável
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                        {signatarioNome || contrato.signatario_nome}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                        CPF: <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{signatarioCpf || contrato.signatario_cpf || 'Registrado'}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        E-mail: {signatarioEmail || contrato.signatario_email}
                      </div>
                      <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        <ShieldCheck size={13} /> Autenticação OTP via E-mail / Celular Concluída
                      </div>
                    </div>

                    {/* Signatário 2 - Escola */}
                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                        <ShieldCheck size={14} /> 2. {contrato.representanteEscola?.representantes && contrato.representanteEscola.representantes.length > 1 ? `${contrato.representanteEscola.representantes.length} Representantes Institucionais` : 'Representante Institucional'}
                      </div>
                      {contrato.representanteEscola?.representantes && contrato.representanteEscola.representantes.length > 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                          {contrato.representanteEscola.representantes.map((rep: any, idx: number) => (
                            <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{rep.nome}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{rep.cargo}{rep.cpf ? ` • CPF: ${rep.cpf}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                            {contrato.representanteEscola?.nome || 'IVAN ROSSI SAMBRANA'}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                            {contrato.representanteEscola?.cargo || 'Diretor Geral / Representante Legal'}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {contrato.representanteEscola?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'}
                        <br />
                        CNPJ: {contrato.representanteEscola?.cnpj || '04.395.789/0001-88'}
                      </div>
                      <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        <BadgeCheck size={13} /> Chancela Institucional Autêntica
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloco de Integridade Criptográfica (SHA-256) & QR Code */}
                <div
                  style={{
                    background: '#070c18',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 16,
                    padding: '18px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 18,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                      Auditoria Criptográfica & Integridade
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Hash SHA-256 do Documento Original:</div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all', marginTop: 2 }}>
                        {contrato.documento_original_hash || 'Registrado'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Hash SHA-256 Selado Pós-Assinatura:</div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#34d399', wordBreak: 'break-all', marginTop: 2, fontWeight: 700 }}>
                        {signedResult?.documentoFinalHash || contrato.documento_assinado_hash || 'Pendente'}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} color="#94a3b8" />
                      <span>Data de Conclusão: <strong style={{ color: '#e2e8f0' }}>{contrato.dataAssinatura ? new Date(contrato.dataAssinatura).toLocaleString('pt-BR') : 'Concluído'}</strong></span>
                    </div>
                  </div>

                  {/* QR Code Interativo */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {qrCodeDataUrl ? (
                      <div style={{ background: '#ffffff', borderRadius: 12, padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', marginBottom: 8 }}>
                        <img src={qrCodeDataUrl} alt="QR Code de Validação" style={{ width: 130, height: 130, display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ width: 130, height: 130, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <QrCode size={40} color="#94a3b8" />
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
                      QR Code de Validação Pública
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, maxWidth: 220 }}>
                      Aponte a câmera de qualquer celular para validar este documento instantaneamente.
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Comprovante */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {/* Abrir Validação Pública */}
                    <a
                      href={`/validar-assinatura/${signedResult?.protocolo || contrato.protocolo}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '13px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ExternalLink size={16} /> Abrir Validação Pública Oficial
                    </a>

                    {/* Baixar PDF Assinado */}
                    <button
                      type="button"
                      onClick={() =>
                        downloadPdf(
                          signedResult?.signedPdfBase64,
                          `Documento_Assinado_${signedResult?.protocolo || contrato.protocolo}.pdf`
                        )
                      }
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '13px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Download size={16} /> Baixar PDF com Certificado
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Copiar Link de Validação */}
                    <button
                      type="button"
                      onClick={() => {
                        const proto = signedResult?.protocolo || contrato.protocolo
                        const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/validar-assinatura/${proto}`
                        navigator.clipboard.writeText(link)
                        setCopiadoLinkValidacao(true)
                        setTimeout(() => setCopiadoLinkValidacao(false), 2500)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: copiadoLinkValidacao ? '#34d399' : '#e2e8f0',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiadoLinkValidacao ? <Check size={14} /> : <Copy size={14} />}
                      {copiadoLinkValidacao ? 'Link Copiado!' : 'Copiar Link de Validação'}
                    </button>

                    {/* Compartilhar no WhatsApp */}
                    <a
                      href={getWhatsAppShareUrl(
                        '',
                        `Segue o comprovante e link oficial de validação do documento "${contrato.titulo_documento}" assinado eletronicamente no Colégio Impacto:\n\nProtocolo: ${signedResult?.protocolo || contrato.protocolo}\nValidação Oficial: ${typeof window !== 'undefined' ? window.location.origin : ''}/validar-assinatura/${signedResult?.protocolo || contrato.protocolo}`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <MessageSquare size={14} /> Compartilhar no WhatsApp
                    </a>
                  </div>

                  {/* Reenviar Cópia Oficial por E-mail no Comprovante */}
                  <div style={{ marginTop: 4 }}>
                    {resendEmailSuccessMsg && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#a7f3d0', padding: '8px 12px', borderRadius: 8, fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
                        {resendEmailSuccessMsg}
                      </div>
                    )}
                    {resendEmailErrorMsg && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
                        {resendEmailErrorMsg}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isResendingEmail}
                      onClick={() => handleResendContractEmail()}
                      style={{
                        width: '100%',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        color: '#60a5fa',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isResendingEmail ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Reenviando cópia oficial por e-mail...
                        </>
                      ) : (
                        <>
                          <Mail size={14} /> Reenviar Cópia em PDF para meu E-mail
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
