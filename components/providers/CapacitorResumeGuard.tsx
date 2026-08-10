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

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

const LOGOUT_FLAG = 'edu-logout-pending'

export function CapacitorResumeGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ao montar: verificar se havia um logout pendente (app foi fechado durante logout)
    const logoutPending = localStorage.getItem(LOGOUT_FLAG)
    if (logoutPending) {
      localStorage.removeItem(LOGOUT_FLAG)
      if (window.location.pathname !== '/login') {
        console.log('[CapacitorResumeGuard] Logout pendente — redirecionando para /login')
        window.location.replace('/login')
      }
      return
    }

    // No Capacitor nativo, registrar listener para quando o app volta ao primeiro plano
    if (!Capacitor.isNativePlatform()) return

    let removeListener: (() => void) | null = null

    // Importar App dinamicamente para não quebrar SSR
    import('@capacitor/app').then(({ App }) => {
      App.addListener('resume', () => {
        const pending = localStorage.getItem(LOGOUT_FLAG)
        if (pending) {
          localStorage.removeItem(LOGOUT_FLAG)
          if (window.location.pathname !== '/login') {
            console.log('[CapacitorResumeGuard] App retomado — reload para /login')
            window.location.replace('/login')
          }
        }
      }).then((handle) => {
        removeListener = () => handle.remove()
      }).catch(() => {})
    }).catch(() => {})

    return () => {
      if (removeListener) removeListener()
    }
  }, [])

  // Componente invisível — só registra listeners
  return null
}
