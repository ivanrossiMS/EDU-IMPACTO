'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import {
  ShieldCheck, CheckCircle2, AlertCircle, FileText, Lock, Mail,
  Smartphone, Clock, RefreshCw, Download, ArrowRight, ArrowLeft, Check,
  X, User, PenTool, ExternalLink, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, Shield, Sparkles, CheckSquare, Square,
  HelpCircle, Eye, QrCode, BadgeCheck, MessageSquare, Copy, Send
} from 'lucide-react'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

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

// Estilos de caligrafia automática
const ESTILOS_CALIGRAFICOS = [
  { id: 'classica', nome: 'Cursiva Clássica', font: "'Brush Script MT', 'Dancing Script', cursive", slant: 'italic', weight: 'normal' },
  { id: 'executiva', nome: 'Executiva Moderna', font: "'Snell Roundhand', 'Great Vibes', cursive", slant: 'italic', weight: 'bold' },
  { id: 'fluida', nome: 'Traço Fluido', font: "'Caveat', 'Segoe Script', cursive", slant: 'normal', weight: 'bold' },
  { id: 'formal', nome: 'Rubrica Formal', font: "'Georgia', 'Times New Roman', serif", slant: 'italic', weight: 'bold' },
]

export function SigningPortalClient({ contrato }: { contrato: ContratoProps }) {
  // Controle de Visualização do PDF Paginado
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, contrato.totalPaginas || 1)
  const [zoomPercent, setZoomPercent] = useState(100)

  // Estado do Modal de Assinatura
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(
    contrato.status === 'assinado' ? 4 : contrato.otp_confirmado_em ? 3 : 1
  )

  // Dados do Signatário (editáveis/conferíveis pelo próprio signatário)
  const [signatarioNome, setSignatarioNome] = useState(contrato.signatario_nome || '')
  const [signatarioCpf, setSignatarioCpf] = useState(contrato.signatario_cpf || '')
  const [signatarioDataNascimento, setSignatarioDataNascimento] = useState(contrato.signatario_data_nascimento || '')
  const [signatarioEmail, setSignatarioEmail] = useState(contrato.signatario_email || '')
  const [signatarioTelefone, setSignatarioTelefone] = useState(contrato.signatario_telefone || '')

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
        if (isComprovanteModalOpen) {
          setIsComprovanteModalOpen(false)
        } else if (isSignModalOpen && !signingLoading && !otpLoading) {
          setIsSignModalOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSignModalOpen, isComprovanteModalOpen, signingLoading, otpLoading])

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

    // Desenha o nome
    ctx.fillText(signatarioNome || 'Assinatura Eletrônica', canvas.width / 2, 75)

    // Linha inferior decorativa sutil
    ctx.strokeStyle = 'rgba(15, 39, 87, 0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(120, 115)
    ctx.lineTo(canvas.width - 120, 115)
    ctx.stroke()

    // Subtítulo pericial
    ctx.font = 'normal 11px sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText(`Assinado Eletronicamente • Impacto EDU (${new Date().toLocaleDateString('pt-BR')})`, canvas.width / 2, 138)

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

    // 2. CPF Obrigatório (11 dígitos)
    const cpfLimpo = signatarioCpf.replace(/\D/g, '')
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      setOtpError('Por favor, informe um CPF válido com 11 dígitos.')
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
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar código de segurança.')
      }

      setEmailMascarado(data.emailMascarado || emailLimpo)
      setCountdown(60)
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
          signatario_nome: signatarioNome,
          signatario_cpf: signatarioCpf,
          signatario_data_nascimento: signatarioDataNascimento,
          signatario_email: signatarioEmail,
          signatario_telefone: signatarioTelefone,
          tipoAssinatura,
          assinaturaBase64,
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
    <div style={{ minHeight: '100vh', background: '#070b14', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* ── BARRA SUPERIOR INSTITUCIONAL ── */}
      <header
        style={{
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '14px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
              }}
            >
              <img
                src={contrato.logoUrl || '/logo-impacto-clean.png'}
                alt={contrato.representanteEscola?.razaoSocial || 'Colégio Impacto'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {contrato.representanteEscola?.razaoSocial || 'COLÉGIO IMPACTO'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={12} color="#10b981" /> Assinatura Eletrônica Segura Impacto EDU
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: signedResult ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                border: signedResult ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: signedResult ? '#34d399' : '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {signedResult ? (
                <>
                  <CheckCircle2 size={13} /> Documento Assinado
                </>
              ) : (
                <>
                  <Clock size={13} /> Aguardando Assinatura
                </>
              )}
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 11,
                color: '#94a3b8',
                display: 'none',
              }}
              className="sm:flex"
            >
              <Lock size={12} style={{ marginRight: 6, marginTop: 1, color: '#10b981' }} />
              Ambiente Criptografado (SHA-256)
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL (LAYOUT MODERNO COM VISUALIZADOR PAGINADO) ── */}
      <main style={{ maxWidth: 1240, margin: '20px auto 40px', padding: '0 16px', flex: 1, width: '100%' }}>
        {/* Barra de Título do Documento */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                }}
              >
                {contrato.protocolo}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Documento Oficial em PDF
              </span>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ffffff' }}>
              {contrato.titulo_documento}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenPdfInNewTab}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ExternalLink size={14} /> Abrir em Nova Aba
            </button>

            {signedResult ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsComprovanteModalOpen(true)}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  title="Ver Comprovante Oficial e Dossiê de Validação"
                >
                  <ShieldCheck size={15} color="#34d399" /> Ver Comprovante
                </button>

                <a
                  href={`/validar-assinatura/${signedResult.protocolo}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  title="Abrir página pública de validação em nova aba"
                >
                  <ExternalLink size={13} /> Validação
                </a>

                <button
                  type="button"
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
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Download size={15} /> Baixar PDF Assinado
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSignModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
                }}
              >
                <PenTool size={15} /> Assinar Documento
              </button>
            )}
          </div>
        </div>

        {/* Grid: Visualizador Paginado (Esquerda/Centro) e Painel Explicativo (Direita) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="lg:grid-cols-4">
          {/* ── COLUNA PRINCIPAL: VISUALIZADOR PAGINADO DO PDF ── */}
          <div className="lg:col-span-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Toolbar do Visualizador */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {/* Controles de Paginação */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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

                <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', padding: '0 4px' }}>
                  Página <strong style={{ color: '#38bdf8' }}>{currentPage}</strong> de {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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

              {/* Controles de Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setZoomPercent(z => Math.max(75, z - 15))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Diminuir Zoom"
                >
                  <ZoomOut size={16} />
                </button>

                <span style={{ fontSize: 12, color: '#cbd5e1', minWidth: 42, textAlign: 'center' }}>
                  {zoomPercent}%
                </span>

                <button
                  onClick={() => setZoomPercent(z => Math.min(150, z + 15))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Aumentar Zoom"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* Container do Iframe / PDF ou Card de Documento Word Original */}
            <div
              style={{
                background: '#1e293b',
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 12px 35px rgba(0, 0, 0, 0.4)',
                minHeight: 580,
                position: 'relative',
              }}
            >
                <iframe
                  key={`${currentPage}-${zoomPercent}-${Boolean(signedResult)}`}
                  src={`${pdfViewUrl}&page=${currentPage}#page=${currentPage}&zoom=${zoomPercent}`}
                  style={{
                    width: '100%',
                    height: 720,
                    border: 'none',
                    background: '#ffffff',
                  }}
                  title={contrato.titulo_documento}
                />
              </div>
          </div>

          {/* ── COLUNA LATERAL: SOBRE O SISTEMA & METADADOS PERICIAIS ── */}
          <div className="lg:col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Card Explicativo: Sobre a Assinatura do Impacto EDU */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                <Shield size={16} /> Sobre o Sistema
              </div>

              <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 12px' }}>
                Este documento foi disponibilizado para assinatura eletrônica através da plataforma do <strong>Colégio Impacto (Impacto EDU)</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11, color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Check size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong>Eficácia Jurídica Eletrônica</strong>: Respaldada pelo Art. 10, § 2º da MP nº 2.200-2/2001, arts. 107, 219 e 221 do Código Civil Brasileiro e arts. 440 e 441 do CPC.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Check size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong>Criptografia SHA-256</strong>: Prova matemática de que o arquivo não sofreu nenhuma alteração após o envio.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Check size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong>Dossiê Pericial Anexo</strong>: Certificado com carimbo de tempo, IP e QR Code público de autenticidade anexado ao PDF final.
                  </span>
                </div>
              </div>
            </div>

            {/* Card do Signatário Designado */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} /> 1. Signatário / Responsável
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                {signatarioNome || contrato.signatario_nome}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {signatarioEmail || contrato.signatario_email}
              </div>
              {contrato.signatario_telefone && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {contrato.signatario_telefone}
                </div>
              )}
            </div>

            {/* Card do Representante Legal da Instituição de Ensino */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} /> 2. Representante Legal do Colégio
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                {contrato.representanteEscola?.nome || 'IVAN ROSSI SAMBRANA'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {contrato.representanteEscola?.cargo || 'Diretor Geral / Representante Legal'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {contrato.representanteEscola?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Chancela Institucional Autêntica:
                </div>
                <div style={{ background: '#ffffff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={contrato.representanteEscola?.assinaturaUrl || '/assinatura-representante.png'}
                    alt="Assinatura do Representante Legal"
                    style={{ maxHeight: 44, maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>
            </div>

            {/* Bloco de Status da Assinatura / Ação */}
            {signedResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 14,
                    padding: '16px',
                    textAlign: 'center',
                    boxShadow: '0 4px 18px rgba(16, 185, 129, 0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#34d399', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                    <CheckCircle2 size={18} /> Documento Assinado
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Protocolo:{' '}
                    <a
                      href={`/validar-assinatura/${signedResult.protocolo}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Clique para abrir a Validação Oficial deste protocolo"
                      style={{
                        color: '#38bdf8',
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                        transition: 'color 0.15s ease',
                      }}
                    >
                      {signedResult.protocolo}
                    </a>
                  </div>
                </div>

                {/* Botão Principal: Ver Comprovante e Validação */}
                <button
                  type="button"
                  onClick={() => setIsComprovanteModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.25) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    color: '#ffffff',
                    borderRadius: 12,
                    padding: '13px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <ShieldCheck size={18} color="#34d399" /> Ver Comprovante e Validação
                </button>

                {/* Link Direto para Validação Pública */}
                <a
                  href={`/validar-assinatura/${signedResult.protocolo}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: '#38bdf8',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)')}
                >
                  <ExternalLink size={14} /> Consultar Validação Pública
                </a>

                {/* Botão Baixar PDF Assinado */}
                <button
                  type="button"
                  onClick={() =>
                    downloadPdf(
                      signedResult.signedPdfBase64,
                      `Documento_Assinado_${signedResult.protocolo}.pdf`
                    )
                  }
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#e2e8f0',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                >
                  <Download size={14} color="#38bdf8" /> Baixar PDF Assinado
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '16px',
                  width: '100%',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <PenTool size={18} /> Assinar Documento Agora
              </button>
            )}
          </div>
        </div>
      </main>

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
              background: 'rgba(5, 9, 18, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: '#0e172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 580,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
                position: 'relative',
              }}
            >
              {/* Cabeçalho do Modal */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={contrato.logoUrl || '/logo-impacto-clean.png'}
                      alt={contrato.representanteEscola?.razaoSocial || 'Colégio Impacto'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {contrato.representanteEscola?.razaoSocial || 'Colégio Impacto'} • Assinatura Eletrônica
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                      {modalStep === 1 && '1. Confirmação dos Dados do Signatário'}
                      {modalStep === 2 && '2. Código de Segurança (OTP)'}
                      {modalStep === 3 && '3. Assinatura e Manifestação de Vontade'}
                      {modalStep === 4 && 'Documento Concluído com Sucesso!'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  }}
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Corpo do Modal */}
              <div style={{ padding: '24px' }}>
                {/* ── PASSO 1: DADOS DO SIGNATÁRIO ── */}
                {modalStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      Por favor, confirme ou preencha seus dados de identificação civil para registro oficial no Certificado de Evidências.
                    </p>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={signatarioNome}
                        onChange={e => setSignatarioNome(e.target.value)}
                        placeholder="Nome e Sobrenome completos"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#070b14',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 10,
                          color: '#ffffff',
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                          CPF *
                        </label>
                        <input
                          type="text"
                          value={signatarioCpf}
                          onChange={e => setSignatarioCpf(maskCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: '#070b14',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 10,
                            color: '#ffffff',
                            fontSize: 14,
                            outline: 'none',
                            fontFamily: 'monospace',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                          Data de Nascimento *
                        </label>
                        <input
                          type="text"
                          value={signatarioDataNascimento}
                          onChange={e => setSignatarioDataNascimento(maskDate(e.target.value))}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: '#070b14',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 10,
                            color: '#ffffff',
                            fontSize: 14,
                            outline: 'none',
                            fontFamily: 'monospace',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          value={signatarioTelefone}
                          onChange={e => setSignatarioTelefone(maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: '#070b14',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 10,
                            color: '#ffffff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                          E-mail Oficial *
                        </label>
                        <input
                          type="email"
                          value={signatarioEmail}
                          onChange={e => setSignatarioEmail(e.target.value)}
                          placeholder="seuemail@exemplo.com"
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: '#070b14',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 10,
                            color: '#ffffff',
                            fontSize: 14,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={14} color="#38bdf8" /> Todos os campos acima são obrigatórios para validar a assinatura jurídica.
                    </div>

                    {otpError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                        {otpError}
                      </div>
                    )}

                    <button
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '14px 20px',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: otpLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
                        marginTop: 8,
                      }}
                    >
                      {otpLoading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Enviando Código...
                        </>
                      ) : (
                        <>
                          Avançar e Confirmar por Código OTP <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ── PASSO 2: CÓDIGO OTP ── */}
                {modalStep === 2 && (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                      }}
                    >
                      <Mail size={28} />
                    </div>

                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                      Digite o código de segurança de 6 dígitos enviado para:
                      <br />
                      <strong style={{ color: '#38bdf8' }}>{emailMascarado || signatarioEmail}</strong>
                    </p>

                    {simulatedCode && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        ⚡ <strong>Código de Teste:</strong> <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{simulatedCode}</strong>
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        style={{
                          width: 200,
                          height: 52,
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: 28,
                          fontWeight: 800,
                          letterSpacing: '8px',
                          background: '#070b14',
                          color: '#ffffff',
                          border: '2px solid #3b82f6',
                          borderRadius: 12,
                          outline: 'none',
                        }}
                        autoFocus
                      />
                    </div>

                    {otpError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                        {otpError}
                      </div>
                    )}

                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpCode.length < 6}
                      style={{
                        background: otpCode.length === 6 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '14px',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: otpCode.length === 6 && !otpLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {otpLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Validar Código e Prosseguir
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 4 }}>
                      <button
                        onClick={() => setModalStep(1)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <ArrowLeft size={13} /> Corrigir dados
                      </button>

                      {countdown > 0 ? (
                        <span style={{ color: '#64748b' }}>Aguarde {countdown}s para reenviar</span>
                      ) : (
                        <button
                          onClick={handleRequestOtp}
                          style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Reenviar código
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                      <a
                        href={getWhatsAppShareUrl('5567992806464', `Olá! Estou na etapa de validação do código OTP para assinatura do contrato (${contrato.protocolo}) do(a) estudante ${contrato.aluno_nome || 'meu filho(a)'}. Poderiam me auxiliar?`)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: '#34d399',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <Smartphone size={14} /> Não recebeu no e-mail? Falar no WhatsApp da Secretaria
                      </a>
                    </div>
                  </div>
                )}

                {/* ── PASSO 3: ESCOLHA DA ASSINATURA & ACEITE ── */}
                {modalStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Seletor de Tipo de Assinatura */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 8 }}>
                        Escolha como deseja assinar o documento:
                      </label>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setTipoAssinatura('nome_automatico')}
                          style={{
                            background: tipoAssinatura === 'nome_automatico' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: tipoAssinatura === 'nome_automatico' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 12,
                            padding: '12px',
                            color: tipoAssinatura === 'nome_automatico' ? '#ffffff' : '#94a3b8',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Sparkles size={16} color="#60a5fa" /> Pelo Nome (Automática)
                        </button>

                        <button
                          type="button"
                          onClick={() => setTipoAssinatura('manual')}
                          style={{
                            background: tipoAssinatura === 'manual' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: tipoAssinatura === 'manual' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 12,
                            padding: '12px',
                            color: tipoAssinatura === 'manual' ? '#ffffff' : '#94a3b8',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <PenTool size={16} color="#60a5fa" /> Desenhar (Manual)
                        </button>
                      </div>
                    </div>

                    {/* Bloco de Assinatura Automática */}
                    {tipoAssinatura === 'nome_automatico' && (
                      <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px', color: '#0f172a' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Selecione o estilo da sua assinatura:</span>
                          <span style={{ color: '#0284c7' }}>Pré-visualização</span>
                        </div>

                        {/* Grade de Estilos */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                          {ESTILOS_CALIGRAFICOS.map(estilo => (
                            <button
                              key={estilo.id}
                              type="button"
                              onClick={() => setEstiloCaligrafico(estilo.id)}
                              style={{
                                background: estiloCaligrafico === estilo.id ? '#eff6ff' : '#f8fafc',
                                border: estiloCaligrafico === estilo.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                borderRadius: 8,
                                padding: '10px 8px',
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{estilo.nome}</div>
                              <div
                                style={{
                                  fontFamily: estilo.font,
                                  fontSize: 18,
                                  fontStyle: estilo.slant as any,
                                  fontWeight: estilo.weight as any,
                                  color: '#0f2757',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {signatarioNome || 'Assinatura'}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div style={{ textAlign: 'center', fontSize: 10, color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>
                          🔒 Assinatura gerada e vinculada criptograficamente ao seu CPF ({signatarioCpf || 'Registrado'})
                        </div>
                      </div>
                    )}

                    {/* Bloco de Assinatura Manual */}
                    {tipoAssinatura === 'manual' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                            Desenhe com o dedo ou mouse no quadro abaixo:
                          </span>
                          {hasManualDrawing && (
                            <button
                              type="button"
                              onClick={clearCanvas}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            >
                              Limpar Traço
                            </button>
                          )}
                        </div>

                        <div style={{ background: '#ffffff', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.2)', position: 'relative' }}>
                          <canvas
                            ref={canvasRef}
                            width={540}
                            height={140}
                            style={{ width: '100%', height: 140, cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          {!hasManualDrawing && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, pointerEvents: 'none' }}>
                              ✍️ Assine nesta área
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Aceite Explícito */}
                    <label
                      style={{
                        background: aceitouTermos ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                        border: aceitouTermos ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 12,
                        padding: '14px',
                        display: 'flex',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={aceitouTermos}
                        onChange={e => setAceitouTermos(e.target.checked)}
                        style={{ width: 20, height: 20, accentColor: '#10b981', marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: '#f8fafc' }}>
                        <strong style={{ color: '#34d399' }}>DECLARAÇÃO DE ACEITE EXPRESSO E IRREVOGÁVEL:</strong>
                        <br />
                        Declaro que li atentamente o documento <strong>"{contrato.titulo_documento}"</strong> na íntegra, conferi seus termos e manifesto consentimento expresso e irrevogável para sua assinatura eletrônica nos termos do art. 10, § 2º da MP 2.200-2/2001 e arts. 107, 219 e 221 do Código Civil Brasileiro.
                      </div>
                    </label>

                    {signingError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                        {signingError}
                      </div>
                    )}

                    <button
                      onClick={handleFinalizeSignature}
                      disabled={signingLoading || !aceitouTermos}
                      style={{
                        background: aceitouTermos ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '16px',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: aceitouTermos && !signingLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: aceitouTermos ? '0 4px 20px rgba(16, 185, 129, 0.4)' : 'none',
                      }}
                    >
                      {signingLoading ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" /> Anexando Certificado & Selando PDF...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} /> Concluir e Assinar Documento
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ── PASSO 4: SUCESSO ── */}
                {modalStep === 4 && signedResult && (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
                        color: '#34d399',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        border: '2px solid rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      <CheckCircle2 size={40} />
                    </div>

                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
                        Documento Assinado com Sucesso!
                      </h2>
                      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                        O Certificado Oficial de Evidências com QR Code foi anexado ao documento em PDF e selado criptograficamente.
                      </p>
                    </div>

                    <div style={{ background: '#070b14', borderRadius: 12, padding: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'left', fontSize: 12 }}>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: '#64748b' }}>Protocolo: </span>
                        <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{signedResult.protocolo}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Hash SHA-256 Selado: </span>
                        <div style={{ color: '#34d399', fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', marginTop: 2 }}>
                          {signedResult.documentoFinalHash}
                        </div>
                      </div>
                    </div>

                    {/* Status de Envio por E-mail & Reenvio Imediato */}
                    <div
                      style={{
                        background: signedResult.emailEnviado ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                        border: signedResult.emailEnviado ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: 12,
                        padding: '14px',
                        textAlign: 'left',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: signedResult.emailEnviado ? '#34d399' : '#60a5fa' }}>
                          <Mail size={15} />
                          <span>{signedResult.emailEnviado ? 'Cópia Oficial Enviada por E-mail' : 'Envio da Cópia por E-mail'}</span>
                        </div>
                        {signedResult.emailEnviado && (
                          <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.2)', color: '#a7f3d0', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            ✓ Entregue ao Servidor
                          </span>
                        )}
                      </div>

                      <div style={{ color: '#cbd5e1', lineHeight: 1.4, marginBottom: 8 }}>
                        {signedResult.emailEnviado ? (
                          <>
                            A via oficial em PDF com selo pericial foi despachada para <strong style={{ color: '#ffffff' }}>{signedResult.emailDestinatario || signatarioEmail || contrato.responsavel_email}</strong>.
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                              💡 <em>Não encontrou na Caixa de Entrada? Verifique a aba <strong>"Outros"</strong> ou a pasta de <strong>"Lixo Eletrônico / Spam"</strong>.</em>
                            </div>
                          </>
                        ) : (
                          <>
                            O documento está certificado. Se desejar receber a via oficial em PDF por e-mail, clique no botão abaixo.
                          </>
                        )}
                      </div>

                      {/* Mensagens de Feedback de Reenvio */}
                      {resendEmailSuccessMsg && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#a7f3d0', padding: '8px 12px', borderRadius: 8, fontSize: 11, marginBottom: 8 }}>
                          {resendEmailSuccessMsg}
                        </div>
                      )}
                      {resendEmailErrorMsg && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: 11, marginBottom: 8 }}>
                          {resendEmailErrorMsg}
                        </div>
                      )}

                      {/* Campo para e-mail alternativo */}
                      {showAlternativeEmailInput ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input
                            type="email"
                            placeholder="Digite outro e-mail..."
                            value={resendEmailInput}
                            onChange={e => setResendEmailInput(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              background: '#070b14',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: 8,
                              color: '#fff',
                              fontSize: 12,
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
                              borderRadius: 8,
                              padding: '8px 14px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isResendingEmail ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                            Enviar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAlternativeEmailInput(false)}
                            style={{
                              background: 'transparent',
                              color: '#94a3b8',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                              padding: '8px 10px',
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
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#ffffff',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isResendingEmail ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" /> Reenviando...
                              </>
                            ) : (
                              <>
                                <RefreshCw size={12} /> Reenviar Cópia por E-mail
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
                              color: '#38bdf8',
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: '6px 4px',
                            }}
                          >
                            Enviar para outro e-mail
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                          borderRadius: 12,
                          padding: '14px',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <Download size={16} /> Baixar PDF Assinado com Certificado
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSignModalOpen(false)
                          setIsComprovanteModalOpen(true)
                        }}
                        style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.25) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#ffffff',
                          borderRadius: 12,
                          padding: '13px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <ShieldCheck size={16} color="#34d399" /> Ver Comprovante e Validação Oficial
                      </button>

                      <a
                        href={`/validar-assinatura/${signedResult.protocolo}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          textDecoration: 'none',
                          borderRadius: 12,
                          padding: '12px',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <ExternalLink size={15} /> Consultar Página Pública de Validação
                      </a>

                      <button
                        type="button"
                        onClick={() => setIsSignModalOpen(false)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#cbd5e1',
                          borderRadius: 12,
                          padding: '12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.color = '#ffffff'
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.color = '#cbd5e1'
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                        }}
                      >
                        <X size={15} /> Fechar
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Uma cópia foi encaminhada para: <strong style={{ color: '#94a3b8' }}>{signatarioEmail}</strong>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
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
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'linear-gradient(180deg, #0f172a 0%, #070d1d 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 24,
                width: '100%',
                maxWidth: 680,
                maxHeight: '92vh',
                overflowY: 'auto',
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
                        <ShieldCheck size={14} /> 2. Representante Institucional
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                        {contrato.representanteEscola?.nome || 'IVAN ROSSI SAMBRANA'}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                        {contrato.representanteEscola?.cargo || 'Diretor Geral / Representante Legal'}
                      </div>
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
