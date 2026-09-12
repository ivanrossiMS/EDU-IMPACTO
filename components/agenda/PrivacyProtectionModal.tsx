'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldAlert, 
  CameraOff, 
  VideoOff, 
  Lock, 
  X, 
  CheckCircle2,
  Sparkles
} from 'lucide-react'

export interface PrivacyProtectionModalProps {
  isOpen: boolean
  onClose: () => void
  customMessage?: string
}

export function PrivacyProtectionModal({
  isOpen,
  onClose,
  customMessage
}: PrivacyProtectionModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fechar com tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999, // Sobrepõe tudo, inclusive o Lightbox
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflow: 'hidden'
          }}
        >
          {/* BACKDROP COM EFEITO BLUR PROFUNDO */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.88) 0%, rgba(3, 7, 18, 0.96) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
          />

          {/* CARD ULTRA MODERNO GLASSMORPHISM */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ 
              type: 'spring', 
              damping: 26, 
              stiffness: 350 
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 460,
              background: 'linear-gradient(160deg, rgba(26, 32, 53, 0.85) 0%, rgba(13, 17, 30, 0.94) 100%)',
              borderRadius: 28,
              border: '1px solid rgba(147, 197, 253, 0.2)',
              boxShadow: '0 30px 80px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              color: '#ffffff',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {/* LUZ AMBIENTAL DE FUNDO */}
            <div
              style={{
                position: 'absolute',
                top: -80,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 220,
                height: 180,
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(236, 72, 153, 0.15) 50%, transparent 75%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
                zIndex: 0
              }}
            />

            {/* BOTÃO FECHAR SUPERIOR */}
            <button
              onClick={onClose}
              title="Fechar"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 2
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
              }}
            >
              <X size={18} />
            </button>

            {/* ÍCONE DE ESCUDO LUMINOSO */}
            <div style={{ position: 'relative', marginBottom: 20, zIndex: 1 }}>
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(236, 72, 153, 0.25))',
                  border: '1.5px solid rgba(165, 180, 252, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.4), inset 0 2px 10px rgba(255, 255, 255, 0.3)'
                }}
              >
                <ShieldAlert size={38} color="#818cf8" />
              </div>

              {/* Mini Badge Lock sobre o Escudo */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: '2px solid #0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(239, 68, 68, 0.5)'
                }}
              >
                <Lock size={14} color="#ffffff" />
              </div>
            </div>

            {/* STATUS PILL */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(129, 140, 248, 0.3)',
                marginBottom: 12,
                zIndex: 1
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8'
                }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#93c5fd'
                }}
              >
                Segurança & Privacidade LGPD
              </span>
            </div>

            {/* TÍTULO */}
            <h3
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: 10,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                zIndex: 1
              }}
            >
              Conteúdo Protegido
            </h3>

            {/* MENSAGEM PRINCIPAL SOLICITADA */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 16,
                width: '100%',
                zIndex: 1
              }}
            >
              <p
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: '#fca5a5',
                  lineHeight: 1.45,
                  margin: 0
                }}
              >
                {customMessage || 'Por questões de privacidade, não é possível salvar, tirar print ou salvar fotos e vídeos.'}
              </p>
            </div>

            {/* DESCRIÇÃO DE CONTEXTO ESCOLAR */}
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.65)',
                lineHeight: 1.5,
                margin: '0 0 20px 0',
                zIndex: 1
              }}
            >
              Para resguardar a imagem e a segurança dos alunos e da comunidade escolar, as mídias deste ambiente possuem proteção contra captura de tela, gravação e distribuição externa.
            </p>

            {/* MINI BADGES DE RECURSOS DE SEGURANÇA */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                width: '100%',
                marginBottom: 22,
                zIndex: 1
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '10px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CameraOff size={18} color="#f87171" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  Sem Prints
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '10px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <VideoOff size={18} color="#fbbf24" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  Sem Gravação
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '10px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CheckCircle2 size={18} color="#34d399" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  LGPD Ativa
                </span>
              </div>
            </div>

            {/* BOTÃO DE AÇÃO PRINCIPAL */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                  try {
                    navigator.vibrate(20)
                  } catch {}
                }
                onClose()
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                border: '1px solid rgba(199, 210, 254, 0.3)',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(79, 70, 229, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 14px 30px rgba(79, 70, 229, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(79, 70, 229, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
              }}
            >
              <span>Entendi e estou ciente</span>
              <Sparkles size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
