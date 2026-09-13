'use client'

/**
 * CapacitorResumeGuard — Correção definitiva para tela escura no iOS após logout
 *
 * PROBLEMA RAIZ:
 * No Capacitor iOS, quando window.location.replace('/login') é chamado e o usuário
 * fecha o app logo depois, o iOS salva um snapshot visual da WebView em estado de
 * transição (tela escura). Ao reabrir o app, o iOS RESTAURA esse snapshot e pode
 * não recarregar a página automaticamente se o WKWebView ainda estiver em memória.
 *
 * SOLUÇÃO:
 * 1. O performLogout() seta a flag 'edu-logout-pending' no localStorage.
 * 2. Este componente, ao montar (toda vez que o app carrega), verifica essa flag.
 * 3. Se a flag existir, remove ela e força window.location.replace('/login').
 * 4. Também registra o listener de 'resume' do Capacitor — quando o app volta
 *    ao primeiro plano com a flag, força o reload imediato.
 */

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import {
  refreshSessionCentralized,
  isSessionExpiredOrExpiringSoon,
  getSessionFromStorageTiers
} from '@/lib/auth/secureSession'

const LOGOUT_FLAG = 'edu-logout-pending'

export function CapacitorResumeGuard() {
  const lastCheckRef = useRef<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Ao montar: verificar se havia um logout pendente (app foi fechado durante logout)
    const logoutPending = localStorage.getItem(LOGOUT_FLAG)
    if (logoutPending) {
      localStorage.removeItem(LOGOUT_FLAG)
      if (window.location.pathname !== '/login') {
        console.log('[CapacitorResumeGuard] Logout pendente — redirecionando para /login')
        window.location.replace('/login')
      }
      return
    }

    // Função para verificar se a sessão necessita de renovação proativa
    const checkAndFreshenSession = async (reason: string) => {
      const now = Date.now()
      // Throttle: não verificar mais de uma vez a cada 10 segundos
      if (now - lastCheckRef.current < 10000) return
      lastCheckRef.current = now

      // Não tentar se estiver offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      try {
        const stored = await getSessionFromStorageTiers()
        if (stored && isSessionExpiredOrExpiringSoon(stored, 300)) {
          console.log(`[CapacitorResumeGuard] Token expirado ou próximo do vencimento (${reason}). Renovando proativamente...`)
          await refreshSessionCentralized(supabase)
        }
      } catch (e) {
        console.warn('[CapacitorResumeGuard] Aviso ao renovar em primeiro plano:', e)
      }
    }

    // 2. Listener para reconexão de internet (online)
    const handleOnline = () => {
      console.log('[CapacitorResumeGuard] Conexão com a internet restabelecida.')
      checkAndFreshenSession('reconexão online')
    }
    window.addEventListener('online', handleOnline)

    // 3. Listener para mudança de visibilidade da aba/webview
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const pending = localStorage.getItem(LOGOUT_FLAG)
        if (pending) {
          localStorage.removeItem(LOGOUT_FLAG)
          window.location.replace('/login')
          return
        }
        checkAndFreshenSession('retorno ao primeiro plano (visibility)')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 4. Listener nativo do Capacitor App Resume (iOS / Android)
    let removeAppListener: (() => void) | null = null

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('resume', () => {
          const pending = localStorage.getItem(LOGOUT_FLAG)
          if (pending) {
            localStorage.removeItem(LOGOUT_FLAG)
            if (window.location.pathname !== '/login') {
              console.log('[CapacitorResumeGuard] App retomado com logout pendente — reload para /login')
              window.location.replace('/login')
            }
            return
          }
          checkAndFreshenSession('retorno nativo (app resume)')
        }).then((handle) => {
          removeAppListener = () => handle.remove()
        }).catch(() => {})
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (removeAppListener) removeAppListener()
    }
  }, [])

  return null
}
