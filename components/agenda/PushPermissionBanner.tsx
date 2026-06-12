'use client'

/**
 * PushPermissionBanner.tsx
 * 
 * Banner inteligente de solicitação de permissão de notificações.
 * 
 * Comportamentos:
 * - Só aparece 5s após a página carregar (não é invasivo)
 * - Não aparece se o usuário já concedeu permissão
 * - Não aparece se o usuário dispensou (salvo no localStorage)
 * - Se bloqueado, mostra orientação de como reativar
 * - Compatível com iOS PWA (mostra instrução de instalação)
 * - Se o navegador não suporta push, exibe mensagem específica
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { Bell, BellOff, BellRing, X, Smartphone, Settings, Shield } from 'lucide-react'

type PermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported' | 'ios-pwa'
type BannerState = 'hidden' | 'prompt' | 'blocked' | 'ios-install' | 'unsupported'

export function PushPermissionBanner() {
  const [bannerState, setBannerState] = useState<BannerState>('hidden')
  const [isCheckingOS, setIsCheckingOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkPermission = async () => {
      setIsCheckingOS(true)

      // Verifica se o usuário já dispensou o banner
      const dismissed = localStorage.getItem('edu_push_dismissed_v2')
      if (dismissed === 'true') return

      let isNative = false
      try {
        isNative = Capacitor.isNativePlatform()
      } catch {}

      if (isNative) {
        try {
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
          const hasPerm = await OneSignalNative.Notifications.hasPermission()
          if (hasPerm) return // Já tem permissão
          
          const canRequest = await OneSignalNative.Notifications.canRequestPermission()
          if (!hasPerm && !canRequest) {
             setBannerState('blocked')
             return
          }
        } catch (e) {
          console.error('[PushBanner] Erro ao verificar permissão nativa', e)
        }
        setBannerState('prompt')
        return
      }

      // Verifica suporte geral a notificações
      if (!('Notification' in window)) {
        setBannerState('unsupported')
        return
      }

      // Detecta iOS — suporte apenas via PWA (Safari 16.4+)
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isInStandaloneMode =
        ('standalone' in navigator && (navigator as any).standalone === true) ||
        window.matchMedia('(display-mode: standalone)').matches

      if (isIOS && !isInStandaloneMode) {
        // iOS no Safari normal não suporta push — orientar a instalar como PWA
        setBannerState('ios-install')
        return
      }

      // Verifica a permissão atual
      const permission = Notification.permission

      if (permission === 'granted') {
        // Já tem permissão — não mostrar nada
        return
      }

      if (permission === 'denied') {
        // Bloqueado — mostrar instrução de como reativar
        setBannerState('blocked')
        return
      }

      // 'default' — ainda não perguntou — mostrar banner de ativação
      setBannerState('prompt')
    }

    // Aguardar 5 segundos antes de exibir (não invasivo)
    const timer = setTimeout(checkPermission, 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleActivate = async () => {
    setBannerState('hidden')
    try {
      let isNative = false
      try {
        isNative = Capacitor.isNativePlatform()
      } catch {}

      if (isNative) {
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
        await OneSignalNative.Notifications.requestPermission(true)
        console.log('✅ [PushBanner] Permissão solicitada via API nativa')
        return
      }

      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        // Vai direto para o prompt nativo do navegador, pulando o Slidedown do OneSignal
        if (OneSignal.Notifications?.requestPermission) {
          await OneSignal.Notifications.requestPermission()
        } else {
          const result = await Notification.requestPermission()
          if (result === 'granted') {
            console.log('✅ [PushBanner] Permissão concedida via API nativa')
          }
        }
      })
    } catch (e: any) {
      console.error('[PushBanner] Erro ao solicitar permissão:', e?.message)
    }
  }

  const handleDismiss = () => {
    setBannerState('hidden')
    localStorage.setItem('edu_push_dismissed_v2', 'true')
  }

  const handleOpenSettings = () => {
    // Instrução para o usuário abrir as configurações do navegador
    // Não é possível abrir automaticamente por segurança
    setBannerState('hidden')
    localStorage.setItem('edu_push_dismissed_v2', 'true')
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
          <div style={{
            background: 'rgba(255,255,255,0.92)',
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
          }}>
            {/* Fundo decorativo */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, zIndex: 1, position: 'relative' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 6px 16px rgba(79,70,229,0.35)',
              }}>
                <BellRing size={22} color="white" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Ativar notificações
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  Receba avisos instantâneos de comunicados, faltas, notas e novidades da escola.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, zIndex: 1, position: 'relative' }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Agora não
              </button>
              <button
                onClick={handleActivate}
                style={{
                  flex: 2, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                Ativar agora
              </button>
            </div>
          </div>
        )}

        {/* ── Bloqueado: Como reativar ─────────────────────────────────── */}
        {bannerState === 'blocked' && (
          <div style={{
            background: 'rgba(255,255,255,0.92)',
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
          }}>
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <BellOff size={22} color="#ef4444" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Notificações bloqueadas
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  Para reativar, clique no cadeado ou ícone <strong>(ⓘ)</strong> na barra de endereços e
                  habilite <strong>Notificações</strong> para este site.
                </div>
              </div>
            </div>

            <button
              onClick={handleOpenSettings}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.05)',
                color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Settings size={14} />
              Entendi
            </button>
          </div>
        )}

        {/* ── iOS: Instalar como PWA ───────────────────────────────────── */}
        {bannerState === 'ios-install' && (
          <div style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 20px 60px rgba(59,130,246,0.08)',
            borderRadius: 20,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
          }}>
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'rgba(59,130,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Smartphone size={22} color="#3b82f6" />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Instale como app para receber alertas
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  No iPhone, toque em{' '}
                  <strong style={{ color: '#3b82f6' }}>Compartilhar</strong> (ícone ⬆️) e depois em{' '}
                  <strong style={{ color: '#3b82f6' }}>"Adicionar à Tela de Início"</strong>.
                  Reabra o app instalado para ativar notificações.
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.2)',
                background: 'rgba(59,130,246,0.06)',
                color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Entendi
            </button>
          </div>
        )}

        {/* ── Navegador não suporta push ───────────────────────────────── */}
        {bannerState === 'unsupported' && (
          <div style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100,116,139,0.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            borderRadius: 20,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} color="#94a3b8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Notificações não suportadas
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Use Chrome ou Firefox para ativar alertas em tempo real.
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
