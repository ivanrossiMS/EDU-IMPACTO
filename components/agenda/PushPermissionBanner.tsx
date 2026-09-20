'use client'

/**
 * PushPermissionBanner.tsx
 *
 * Banner flutuante inteligente e elegante para ativação de notificações push do Impacto Edu.
 * Exibido exclusivamente na Agenda Digital.
 *
 * - Fonte única de verdade: hook usePushNotifications().
 * - Não duplica chamadas nem listeners.
 * - Suporte completo multiplataforma:
 *   1. iOS Nativo (Capacitor): Dispara diálogo nativo do sistema ou abre Ajustes do app via ponte Swift.
 *   2. Android Nativo (Capacitor): Dispara permissão de runtime ou abre Ajustes de notificação via Intent Android.
 *   3. Navegador Web (Chrome/Safari/Edge/Firefox): Aciona permissão nativa web com feedback visual de ativação,
 *      ou guia interativo ilustrado passo a passo caso as notificações estejam bloqueadas pelo usuário.
 *   4. iOS Safari (PWA): Instrução para "Adicionar à Tela de Início".
 * - Detecção automática ao focar a aba/retornar do background (revalidação imediata).
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BellRing,
  BellOff,
  X,
  Smartphone,
  Settings,
  Shield,
  Loader2,
  RefreshCw,
  HelpCircle,
  Lock,
} from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'

type BannerState = 'hidden' | 'prompt' | 'blocked' | 'ios-install' | 'unsupported'

const DISMISSED_BANNER_KEY = 'edu_push_dismissed_v2'
const DISMISSED_SESSION_KEY = 'edu_push_dismissed_session'

export function PushPermissionBanner() {
  const {
    isAuthorized,
    isDenied,
    isNotDetermined,
    isLoading,
    requestPermission,
    openSettings,
    refresh,
  } = usePushNotifications()

  const [bannerState, setBannerState] = useState<BannerState>('hidden')
  const [userDismissed, setUserDismissed] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [showWebGuide, setShowWebGuide] = useState(false)

  // Inicialização de estado de dispensa
  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissedSession = sessionStorage.getItem(DISMISSED_SESSION_KEY) === 'true'
    const dismissedLocal = localStorage.getItem(DISMISSED_BANNER_KEY) === 'true'
    setUserDismissed(dismissedSession || dismissedLocal)

    const handleReset = () => {
      setUserDismissed(false)
      setShowWebGuide(false)
      try {
        localStorage.removeItem(DISMISSED_BANNER_KEY)
        sessionStorage.removeItem(DISMISSED_SESSION_KEY)
      } catch {}
    }
    window.addEventListener('edu:reset-push-permission', handleReset)
    return () => window.removeEventListener('edu:reset-push-permission', handleReset)
  }, [])

  // Revalidação em foco/visibilidade (detecta quando o usuário volta dos Ajustes ou das configurações do site)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleRecheck = () => {
      refresh().catch(() => {})
    }
    window.addEventListener('focus', handleRecheck)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleRecheck()
      }
    })
    return () => {
      window.removeEventListener('focus', handleRecheck)
      document.removeEventListener('visibilitychange', handleRecheck)
    }
  }, [refresh])

  // Avaliação de exibição do banner
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

    // ── Lógica Web / PWA ──────────────────────────────────────────────────
    if (!('Notification' in window)) {
      setBannerState('unsupported')
      return
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandaloneMode =
      ('standalone' in navigator && (navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isIOS && !isInStandaloneMode) {
      // iOS Safari não-PWA requer Adicionar à Tela de Início
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
    setIsActivating(true)
    try {
      const accepted = await requestPermission()
      if (accepted) {
        toast.success('Notificações ativadas com sucesso!')
        setBannerState('hidden')
      } else {
        await refresh()
      }
    } catch (e: any) {
      console.error('[PushBanner] Erro ao solicitar permissão:', e?.message)
    } finally {
      setIsActivating(false)
    }
  }

  const handleDismiss = () => {
    setBannerState('hidden')
    setUserDismissed(true)
    try {
      localStorage.setItem(DISMISSED_BANNER_KEY, 'true')
      sessionStorage.setItem(DISMISSED_SESSION_KEY, 'true')
    } catch {}
  }

  const handleOpenSettings = async () => {
    if (Capacitor.isNativePlatform()) {
      handleDismiss()
      await openSettings()
    } else {
      setShowWebGuide(prev => !prev)
      toast.info('Para ativar: clique no cadeado ao lado do endereço do site e permita as notificações.')
    }
  }

  if (bannerState === 'hidden') return null

  const isNative = Capacitor.isNativePlatform()

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
        {/* ── Prompt: Pedir permissão inicial ─────────────────────────── */}
        {bannerState === 'prompt' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.96)',
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
                  Receba comunicados, avisos de entrada e saída, notas e informativos escolares importantes.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, zIndex: 1, position: 'relative' }}>
              <button
                onClick={handleDismiss}
                disabled={isActivating}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Agora não
              </button>
              <button
                onClick={handleActivate}
                disabled={isActivating}
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
                  transition: 'all 0.2s',
                  opacity: isActivating ? 0.8 : 1,
                }}
              >
                {isActivating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Ativando...
                  </>
                ) : (
                  'Ativar agora'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Bloqueado: Orientação Multiplataforma (Nativo vs Navegador) ── */}
        {bannerState === 'blocked' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.96)',
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
                  {isNative
                    ? 'As notificações do Impacto Edu estão desativadas neste aparelho. Ative-as nos Ajustes para receber comunicados e avisos.'
                    : 'As notificações estão desativadas neste navegador. Ative as permissões deste site para receber comunicados e avisos.'}
                </div>
              </div>
            </div>

            {/* Passo a passo visual quando no navegador web */}
            {!isNative && showWebGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 14,
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  color: '#334155',
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: '#0f172a',
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Lock size={14} color="#ef4444" /> Como ativar no navegador:
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>
                    Clique no ícone de <strong>ajustes ou cadeado</strong> (🔒) ao lado da barra de endereço acima.
                  </li>
                  <li>
                    Altere a permissão de <strong>Notificações</strong> para <strong>Permitir</strong>.
                  </li>
                  <li>
                    Clique em <strong>Recarregar página</strong> abaixo para concluir.
                  </li>
                </ol>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={13} />
                    Recarregar página
                  </button>
                </div>
              </motion.div>
            )}

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
                {isNative ? (
                  <>
                    <Settings size={14} />
                    Abrir Ajustes
                  </>
                ) : (
                  <>
                    <HelpCircle size={14} />
                    {showWebGuide ? 'Fechar ajuda' : 'Como ativar'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── iOS PWA: Adicionar à Tela de Início ──────────────────────── */}
        {bannerState === 'ios-install' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.96)',
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
              background: 'rgba(255,255,255,0.96)',
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
