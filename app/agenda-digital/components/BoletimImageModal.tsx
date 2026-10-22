'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Share2, X, CheckCircle2, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { GeneratedBoletimImage } from './boletimImageGenerator'

interface BoletimImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageData: GeneratedBoletimImage | null
  isGenerating?: boolean
}

export function BoletimImageModal({
  isOpen,
  onClose,
  imageData,
  isGenerating = false,
}: BoletimImageModalProps) {
  const [mounted, setMounted] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setSavedSuccess(false)
      setIsSharing(false)
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || typeof document === 'undefined') return null

  const handleSaveToDevice = async () => {
    if (!imageData) return

    try {
      const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.())

      // Em WebViews nativas do Capacitor no iOS, <a download> com blob pode ser ignorado;
      // acionamos o download padrão e, se em Capacitor iOS, oferecemos o Share Sheet nativo que possui "Salvar Imagem" (Rolo da Câmera)
      const url = URL.createObjectURL(imageData.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = imageData.fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
        URL.revokeObjectURL(url)
      }, 2000)

      if (isCapacitorNative && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          const file = new File([imageData.blob], imageData.fileName, { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: imageData.title,
            })
          }
        } catch (capErr: any) {
          if (capErr?.name === 'AbortError') return
        }
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3500)
      toast.success('Boletim em imagem salvo no celular!')
    } catch (err) {
      console.error('Erro ao salvar imagem do boletim:', err)
      toast.error('Não foi possível salvar a imagem automaticamente. Pressione e segure na imagem para salvar.')
    }
  }

  const handleShareImage = async () => {
    if (!imageData || isSharing) return
    setIsSharing(true)

    try {
      const file = new File([imageData.blob], imageData.fileName, {
        type: 'image/png',
        lastModified: Date.now(),
      })

      // 1. Web Share API nativa com suporte a arquivo de imagem (iOS Safari, Android Chrome, macOS)
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const canShareFiles =
          typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true

        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: imageData.title,
            text: imageData.shareText,
          })
          toast.success('Boletim compartilhado com sucesso!')
          return
        }
      }

      // 2. Fallback: Copiar imagem para a área de transferência + baixar imagem
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': imageData.blob }),
          ])
          toast.success('Imagem do boletim copiada! Cole no WhatsApp ou onde desejar.')
          return
        } catch {
          // Prossegue para download direto
        }
      }

      await handleSaveToDevice()
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Usuário cancelou o menu de compartilhamento nativo
        return
      }
      console.warn('Compartilhamento nativo indisponível, salvando imagem:', err)
      await handleSaveToDevice()
    } finally {
      setIsSharing(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
            boxSizing: 'border-box',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90dvh',
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    flexShrink: 0,
                  }}
                >
                  <ImageIcon size={19} strokeWidth={2.3} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#0f172a',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    Boletim em Imagem
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: 12,
                      color: '#64748b',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Pronto para salvar no celular ou compartilhar
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={17} strokeWidth={2.4} />
              </button>
            </div>

            {/* Preview Body */}
            <div
              style={{
                padding: '14px 16px',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: '#f1f5f9',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {isGenerating || !imageData ? (
                <div
                  style={{
                    padding: '64px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    color: '#475569',
                  }}
                >
                  <Loader2 size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    Gerando imagem do boletim em alta definição...
                  </span>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageData.dataUrl}
                      alt={imageData.title}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        userSelect: 'auto',
                        WebkitTouchCallout: 'default',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11.5,
                      color: '#64748b',
                      fontWeight: 600,
                      textAlign: 'center',
                      padding: '2px 8px',
                    }}
                  >
                    <Sparkles size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>
                      Toque nos botões abaixo ou segure na imagem para salvar nas Fotos
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div
              style={{
                padding: '14px 16px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleSaveToDevice}
                disabled={isGenerating || !imageData}
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: savedSuccess ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
                  background: savedSuccess ? '#ecfdf5' : '#f8fafc',
                  color: savedSuccess ? '#047857' : '#0f172a',
                  fontWeight: 800,
                  fontSize: 13.5,
                  fontFamily: 'Outfit, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: isGenerating || !imageData ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                }}
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 size={17} color="#059669" strokeWidth={2.5} />
                    <span>Salvo!</span>
                  </>
                ) : (
                  <>
                    <Download size={17} color="#2563eb" strokeWidth={2.4} />
                    <span>Salvar Imagem</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareImage}
                disabled={isGenerating || !imageData || isSharing}
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13.5,
                  fontFamily: 'Outfit, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: isGenerating || !imageData || isSharing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 6px 16px rgba(37, 99, 235, 0.28)',
                }}
              >
                <Share2 size={17} strokeWidth={2.4} />
                <span>Compartilhar</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
