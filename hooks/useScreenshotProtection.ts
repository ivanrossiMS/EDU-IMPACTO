'use client'

import { useState, useEffect, useCallback } from 'react'
import { PrivacyScreen } from '@capacitor-community/privacy-screen'

interface UseScreenshotProtectionOptions {
  enabled?: boolean
  autoEnablePrivacyScreen?: boolean
}

export function useScreenshotProtection(options: UseScreenshotProtectionOptions = {}) {
  const { enabled = true, autoEnablePrivacyScreen = true } = options
  const [isModalOpen, setIsModalOpen] = useState(false)

  const triggerModal = useCallback(() => {
    // Feedback háptico em smartphones compatíveis
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40])
      } catch {
        // Ignora erros caso não permitido pelo browser
      }
    }
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Gerenciamento do PrivacyScreen no Capacitor (iOS & Android)
  useEffect(() => {
    if (!enabled || !autoEnablePrivacyScreen) return

    let isScreenProtected = false
    const enablePrivacy = async () => {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          await PrivacyScreen.enable()
          isScreenProtected = true
        } catch (err) {
          console.warn('[useScreenshotProtection] Falha ao habilitar PrivacyScreen:', err)
        }
      }
    }

    enablePrivacy()

    return () => {
      if (isScreenProtected) {
        PrivacyScreen.disable().catch(err => {
          console.warn('[useScreenshotProtection] Falha ao desabilitar PrivacyScreen:', err)
        })
      }
    }
  }, [enabled, autoEnablePrivacyScreen])

  // Listeners nativos do Capacitor (iOS e Android custom event)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let pluginListenerHandle: { remove: () => void } | null = null
    let recordingListenerHandle: { remove: () => void } | null = null

    const setupNativeListeners = async () => {
      if ((window as any).Capacitor?.isNativePlatform?.()) {
        try {
          // iOS: notificação de screenshot tirado
          pluginListenerHandle = await PrivacyScreen.addListener('screenshotTaken', () => {
            triggerModal()
          })

          // iOS: notificação de gravação de tela iniciada
          recordingListenerHandle = await PrivacyScreen.addListener('screenRecordingStarted', () => {
            triggerModal()
          })
        } catch (err) {
          console.warn('[useScreenshotProtection] Erro ao registrar listeners nativos:', err)
        }
      }
    }

    setupNativeListeners()

    // Listener customizado vindo do Android MainActivity.java (Android 14+ ScreenCaptureCallback)
    const handleAndroidScreenshot = () => {
      triggerModal()
    }
    window.addEventListener('impacto:screenshot-attempt', handleAndroidScreenshot)

    return () => {
      if (pluginListenerHandle) {
        pluginListenerHandle.remove()
      }
      if (recordingListenerHandle) {
        recordingListenerHandle.remove()
      }
      window.removeEventListener('impacto:screenshot-attempt', handleAndroidScreenshot)
    }
  }, [enabled, triggerModal])

  // Listeners de atalhos de teclado e navegador (Web / Desktop)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Tecla PrintScreen (PrtScn)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerModal()
        // Limpar clipboard caso permitido
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText('').catch(() => {})
        }
      }

      // 2. Atalhos de Impressão (Ctrl + P / Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        e.stopPropagation()
        triggerModal()
      }

      // 3. Atalhos macOS de captura de tela (Cmd + Shift + 3, 4, 5)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        triggerModal()
      }

      // 4. Atalhos Windows Snipping Tool (Win + Shift + S ou Ctrl + Shift + S)
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        triggerModal()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerModal()
      }
    }

    // 5. Evento do Navegador 'beforeprint'
    const handleBeforePrint = (e: Event) => {
      e.preventDefault()
      triggerModal()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('beforeprint', handleBeforePrint)

    // Detecção de print media query change
    const mediaQueryList = window.matchMedia?.('print')
    const handleMediaPrint = (mql: MediaQueryListEvent) => {
      if (mql.matches) {
        triggerModal()
      }
    }
    if (mediaQueryList?.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaPrint)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('beforeprint', handleBeforePrint)
      if (mediaQueryList?.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMediaPrint)
      }
    }
  }, [enabled, triggerModal])

  // Handler para bloquear clique com botão direito (Salvar imagem como...)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    triggerModal()
  }, [triggerModal])

  // Handler para bloquear arrastar e soltar fotos/vídeos para a área de trabalho
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    triggerModal()
  }, [triggerModal])

  return {
    isModalOpen,
    setIsModalOpen,
    triggerModal,
    closeModal,
    handleContextMenu,
    handleDragStart
  }
}
