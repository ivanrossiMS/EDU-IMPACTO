'use client'

/**
 * PushPermissionBanner.tsx
 *
 * Banner inteligente de solicitação de permissão de notificações do Impacto Edu.
 *
 * - Consome o hook usePushNotifications como fonte única de verdade.
 * - Não duplica chamadas nem listeners.
 * - NUNCA invoca requestPermission(true) (evitando o popup em inglês do OneSignal).
 * - No iOS Nativo, se autorizado, nunca exibe nada.
 * - Se negado no nativo, direciona para os Ajustes via ponte nativa.
 * - Compatível com iOS PWA (mostra instrução de Adicionar à Tela de Início).
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, BellOff, X, Smartphone, Settings, Shield } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Capacitor } from '@capacitor/core'

type BannerState = 'hidden' | 'prompt' | 'blocked' | 'ios-install' | 'unsupported'

const DISMISSED_BANNER_KEY = 'edu_push_dismissed_v2'

export function PushPermissionBanner() {
  const {
    isAuthorized,
    isDenied,
    isNotDetermined,
    isLoading,
    requestPermission,
    openSettings,
  } = usePushNotifications()

  const [bannerState, setBannerState] = useState<BannerState>('hidden')
  const [userDismissed, setUserDismissed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = localStorage.getItem(DISMISSED_BANNER_KEY) === 'true'
    setUserDismissed(dismissed)

    const handleReset = () => {
      setUserDismissed(false)
      try { localStorage.removeItem(DISMISSED_BANNER_KEY) } catch {}
    }
    window.addEventListener('edu:reset-push-permission', handleReset)
    return () => window.removeEventListener('edu:reset-push-permission', handleReset)
  }, [])

  useEffect(() => {
    if (userDismissed || isLoading) {
      setBannerState('hidden')
      return
    }

    if (isAuthorized) {
      setBannerState('hidden')
      return
    }

    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      if (isDenied) {
        setBannerState('blocked')
      } else if (isNotDetermined) {
        setBannerState('prompt')
      } else {
        setBannerState('hidden')
      }
      return
    }

    // ── Web / PWA Logic ─────────────────────────────────────────────────────
    if (!('Notification' in window)) {
      setBannerState('unsupported')
      return
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandaloneMode =
      ('standalone' in navigator && (navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isIOS && !isInStandaloneMode) {
      // iOS Safari não-PWA
      setBannerState('ios-install')
      return
    }

    if (isDenied) {
      setBannerState('blocked')
      return
    }

    if (isNotDetermined) {
      setBannerState('prompt')
      return
    }

    setBannerState('hidden')
  }, [userDismissed, isLoading, isAuthorized, isDenied, isNotDetermined])

  const handleActivate = async () => {
    setBannerState('hidden')
    try {
      await requestPermission()
    } catch (e: any) {
      console.error('[PushBanner] Erro ao solicitar permissão:', e?.message)
    }
  }

  const handleDismiss = () => {
    setBannerState('hidden')
    setUserDismissed(true)
    try {
      localStorage.setItem(DISMISSED_BANNER_KEY, 'true')
    } catch {}
  }

  const handleOpenSettings = async () => {
    handleDismiss()
    if (Capacitor.isNativePlatform()) {
      await openSettings()
    }
  }

  if (bannerState === 'hidden') return null

  return (
    <AnimatePresence>
      <motion.div
        key="push-banner"
        initial={{ opacity: 0, y: -60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          right: 16,
          margin: '0 auto',
          zIndex: 9999,
          maxWidth: 440,
        }}
      >
        {/* ── Prompt: Pedir permissão ─────────────────────────────────── */}
        {bannerState === 'prompt' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(79,70,229,0.15)',
              boxShadow: '0 20px 60px rgba(79,70,229,0.12), 0 4px 16px rgba(0,0,0,0.06)',
              borderRadius: 20,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />

            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 4,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, zIndex: 1, position: 'relative' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(79,70,229,0.35)',
                }}
              >
                <BellRing size={22} color="white" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Ativar notificações
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  Receba comunicados, avisos de entrada e saída, notas e comunicados escolares importantes.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, zIndex: 1, position: 'relative' }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Agora não
              </button>
              <button
                onClick={handleActivate}
                style={{
                  flex: 2,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                Ativar agora
              </button>
            </div>
          </div>
        )}

        {/* ── Bloqueado: Orientação em português ───────────────────────── */}
        {bannerState === 'blocked' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(239,68,68,0.2)',
              boxShadow: '0 20px 60px rgba(239,68,68,0.08)',
              borderRadius: 20,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
            }}
          >
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BellOff size={22} color="#ef4444" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Ativar notificações
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  As notificações do Impacto Edu estão desativadas neste aparelho. Ative-as nos Ajustes para receber comunicados e avisos.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Agora não
              </button>
              <button
                onClick={handleOpenSettings}
                style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                }}
              >
                <Settings size={14} />
                Abrir Ajustes
              </button>
            </div>
          </div>
        )}

        {/* ── iOS PWA: Adicionar à Tela de Início ──────────────────────── */}
        {bannerState === 'ios-install' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(59,130,246,0.2)',
              boxShadow: '0 20px 60px rgba(59,130,246,0.08)',
              borderRadius: 20,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
            }}
          >
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(59,130,246,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Smartphone size={22} color="#3b82f6" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Instale para receber notificações
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  No Safari, toque no ícone de compartilhamento (⬆️) e selecione{' '}
                  <strong style={{ color: '#3b82f6' }}>"Adicionar à Tela de Início"</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.2)',
                background: 'rgba(59,130,246,0.06)',
                color: '#3b82f6',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Entendi
            </button>
          </div>
        )}

        {/* ── Navegador não suporta push ───────────────────────────────── */}
        {bannerState === 'unsupported' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(100,116,139,0.2)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              borderRadius: 20,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Shield size={20} color="#94a3b8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Notificações não suportadas
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Use um navegador compatível ou o aplicativo oficial.
              </div>
            </div>
            <button
              onClick={handleDismiss}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
