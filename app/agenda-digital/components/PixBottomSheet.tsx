'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import {
  X,
  Copy,
  CheckCircle2,
  Smartphone,
  ExternalLink,
  Clock,
  ShieldCheck,
  QrCode,
  Sparkles,
  AlertCircle,
  Receipt,
  FileText,
  HelpCircle,
  ArrowRight
} from 'lucide-react'

interface PixBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  pixCode?: string | null
  boletoUrl?: string | null
  checkoutUrl?: string | null
  valor: string
  descricao: string
  vencimento: string
  aluno: string
  isLoading?: boolean
  error?: string | null
}

export function PixBottomSheet({
  isOpen,
  onClose,
  pixCode,
  boletoUrl,
  checkoutUrl,
  valor,
  descricao,
  vencimento,
  aluno,
  isLoading = false,
  error = null,
}: PixBottomSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Portal mount check
  useEffect(() => {
    setMounted(true)
  }, [])

  // Gerar QR Code localmente via pacote 'qrcode'
  useEffect(() => {
    if (!pixCode) {
      setQrDataUrl(null)
      return
    }

    let isSubscribed = true
    QRCode.toDataURL(pixCode, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url: string) => {
        if (isSubscribed) setQrDataUrl(url)
      })
      .catch((err: any) => {
        console.error('[QRCode error]', err)
      })

    return () => {
      isSubscribed = false
    }
  }, [pixCode])

  // Fechar no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Bloquear scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleCopy = async () => {
    if (!pixCode) return
    try {
      await navigator.clipboard.writeText(pixCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 3500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = pixCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 3500)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            fontFamily: 'Outfit, Inter, system-ui, sans-serif',
          }}
        >
          {/* Backdrop Escuro Completo com Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 1,
            }}
          />

          {/* Modal Centralizado / Bottom Sheet em Mobile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              maxWidth: 520,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 28,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 16px rgba(2, 132, 199, 0.25)',
                    color: '#ffffff',
                  }}
                >
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Pagamento Instantâneo Pix
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
                    Conciliação automática em segundos
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0'
                  e.currentTarget.style.color = '#0f172a'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc'
                  e.currentTarget.style.color = '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '24px' }}>
              {/* Card Resumo do Boleto/Fatura */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 20,
                  padding: '16px 20px',
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>
                    Fatura Selecionada
                  </div>
                  <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 800, marginTop: 2, lineHeight: 1.3 }}>
                    {descricao}
                  </div>
                  {aluno && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 600 }}>
                      Aluno(a): <span style={{ color: '#0f172a' }}>{aluno}</span>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>
                    Valor Total
                  </div>
                  <div style={{ fontSize: 24, color: '#0284c7', fontWeight: 900, marginTop: 2, letterSpacing: '-0.03em' }}>
                    {valor}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 3, fontWeight: 600 }}>
                    <Clock size={12} color="#0284c7" />
                    Vence {formatDate(vencimento)}
                  </div>
                </div>
              </div>

              {/* Estado: Carregando */}
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      border: '3.5px solid #e2e8f0',
                      borderTopColor: '#0284c7',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 16px',
                    }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Gerando QR Code Pix...</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Estado: Erro ou Sem QR Code no Retorno */}
              {error && !isLoading && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 18,
                    padding: '16px 20px',
                    color: '#991b1b',
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontWeight: 800 }}>
                    <AlertCircle size={16} color="#dc2626" />
                    <span>Aviso de Cobrança</span>
                  </div>
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              )}

              {/* QR Code e Código Pix quando disponível */}
              {!isLoading && pixCode && (
                <>
                  {/* Container do QR Code */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        padding: 12,
                        background: '#ffffff',
                        borderRadius: 22,
                        border: '1.5px solid #e2e8f0',
                        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.06)',
                      }}
                    >
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Code Pix"
                          width={220}
                          height={220}
                          style={{ display: 'block', borderRadius: 12 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 220,
                            height: 220,
                            background: '#f8fafc',
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                          }}
                        >
                          <QrCode size={48} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
                      <QrCode size={14} color="#0284c7" />
                      Abra o app do seu banco e escaneie o código
                    </div>
                  </div>

                  {/* Caixa Copia e Cola */}
                  <div
                    style={{
                      background: '#f0f9ff',
                      border: '1.5px solid #bae6fd',
                      borderRadius: 18,
                      padding: '14px 18px',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Pix Copia e Cola
                      </span>
                      <span style={{ fontSize: 11, color: '#0284c7', fontWeight: 700 }}>Toque abaixo para copiar</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#334155',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        lineHeight: 1.4,
                        maxHeight: 52,
                        overflow: 'hidden',
                        userSelect: 'all',
                      }}
                    >
                      {pixCode}
                    </div>
                  </div>

                  {/* Botão de Copiar com Animação */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCopy}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: 16,
                      border: 'none',
                      background: copied
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      color: '#ffffff',
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      boxShadow: copied
                        ? '0 8px 20px rgba(16, 185, 129, 0.3)'
                        : '0 8px 20px rgba(2, 132, 199, 0.3)',
                      transition: 'all 0.3s ease',
                      marginBottom: 12,
                    }}
                  >
                    {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    {copied ? 'Código Pix Copiado com Sucesso!' : 'Copiar Código Pix'}
                  </motion.button>
                </>
              )}

              {/* Botão de Pagamento Direto Oficial do Isaac (quando disponível via active_receivables) */}
              {checkoutUrl && !isLoading && (
                <div style={{ marginBottom: 14 }}>
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '16px 18px',
                      borderRadius: 16,
                      border: 'none',
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      color: '#ffffff',
                      fontSize: 15,
                      fontWeight: 800,
                      textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <Smartphone size={18} />
                    Pagar Fatura Direto no isaac (Pix / Cartão)
                  </a>
                </div>
              )}

              {/* Quando o Pix direto não está no payload e não há checkoutUrl, oferecer acesso ao portal */}
              {!isLoading && !pixCode && !checkoutUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <a
                    href="https://meu.olaisaac.io/auth"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '15px 18px',
                      borderRadius: 16,
                      border: 'none',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                      fontSize: 14.5,
                      fontWeight: 800,
                      textDecoration: 'none',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <ExternalLink size={16} />
                    Acessar Portal isaac (meu.olaisaac.io)
                  </a>
                </div>
              )}

              {/* Botão Boleto Bancário se disponível */}
              {boletoUrl && !isLoading && (
                <a
                  href={boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '13px 16px',
                    borderRadius: 14,
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: 13.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginBottom: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <FileText size={15} color="#64748b" />
                  Visualizar Boleto Bancário em PDF
                </a>
              )}

              {/* Rodapé de Segurança */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 14,
                  fontSize: 12,
                  color: '#64748b',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={15} color="#10b981" />
                <span>Pagamento seguro com baixa imediata processado pelo isaac.</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
