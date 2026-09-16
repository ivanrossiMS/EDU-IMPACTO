'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { hideSplashScreen } from '@/lib/capacitor/splash'

import { PENDING_PUSH_ROUTE_KEY } from '@/components/providers/GlobalNotificationProvider'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'
import {
  isFamilyOrStudent,
  getAgendaDigitalDestination,
  getInitialRouteForUser,
  fetchPerfisWithCache
} from '@/lib/auth/moduleRouting'

export default function Root() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, hydrated } = useApp()

  const [targetRoute, setTargetRoute] = useState<string | null>(null)
  const isRedirectingRef = useRef(false)

  const isDemoMode = searchParams?.get('demo') === 'true'

  // 1. Libera imediatamente a splash screen nativa para exibir a tela cinematográfica web
  useEffect(() => {
    hideSplashScreen(150)
  }, [])

  // 2. Gerenciamento do ciclo de resolução da sessão e cálculo da rota de destino
  useEffect(() => {
    if (isDemoMode) return

    // Escuta evento de navegação por push disparado pelo OneSignal durante o cold start
    const handlePushEvent = (e: any) => {
      const dest = e?.detail?.destination
      if (dest) {
        console.log('[Root] Evento edu:navigate-push recebido em cold start:', dest)
        setTargetRoute(dest)
      }
    }
    window.addEventListener('edu:navigate-push', handlePushEvent)

    // Aguarda o AppProvider hidratar a sessão a partir do armazenamento seguro
    if (!hydrated) {
      return () => {
        window.removeEventListener('edu:navigate-push', handlePushEvent)
      }
    }

    let isSubscribed = true

    const resolveDestination = async () => {
      // Se estiver em ambiente nativo, concede pequena janela de espera ativa (até 500ms)
      // para o OneSignal descarregar o clique de notificação em cold start
      let pendingPushRoute = typeof window !== 'undefined'
        ? ((window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY))
        : null

      if (!pendingPushRoute && Capacitor.isNativePlatform()) {
        for (let i = 0; i < 5; i++) {
          if (!isSubscribed) return
          await new Promise(r => setTimeout(r, 100))
          pendingPushRoute = (window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY)
          if (pendingPushRoute) break
          try {
            const { value } = await Preferences.get({ key: PENDING_PUSH_ROUTE_KEY })
            if (value) {
              pendingPushRoute = value
              break
            }
          } catch {}
        }
      }

      if (!isSubscribed) return

      // Se houver notificação pendente que o usuário clicou:
      if (pendingPushRoute) {
        console.log('[Root] Notificação pendente detectada:', pendingPushRoute)
        if (currentUser) {
          setTargetRoute(pendingPushRoute)
          return
        } else {
          setTargetRoute(`/login?redirect=${encodeURIComponent(pendingPushRoute)}`)
          return
        }
      }

      // Se nenhum usuário estiver logado, direciona para o login
      if (!currentUser) {
        setTargetRoute('/login')
        return
      }

      // 1. Família / Aluno / Responsável têm exclusivamente acesso à Agenda Digital
      if (isFamilyOrStudent(currentUser)) {
        const dest = getAgendaDigitalDestination(currentUser)
        setTargetRoute(dest)
        return
      }

      // 2. Colaborador / Administrador / Professor / etc.
      // Carrega perfis (com cache local instantâneo) para verificar os módulos habilitados
      let userPerfilObj: any = null
      try {
        const perfisList = await fetchPerfisWithCache(1500)
        if (!isSubscribed) return
        const targetPerfilName = currentUser.perfil || currentUser.cargo || ''
        userPerfilObj = (perfisList || []).find(p => p.nome === targetPerfilName) || null
      } catch (err) {
        console.warn('[Root] Falha ao resolver perfil com cache:', err)
      }

      if (!isSubscribed) return

      // Determina a rota correta do perfil
      const initialRoute = getInitialRouteForUser(currentUser, userPerfilObj)
      console.log('[Root] Rota inicial resolvida para o perfil:', initialRoute)
      setTargetRoute(initialRoute)
    }

    resolveDestination()

    return () => {
      isSubscribed = false
      window.removeEventListener('edu:navigate-push', handlePushEvent)
    }
  }, [hydrated, currentUser, isDemoMode])

  // Executa o redirecionamento com segurança garantindo que só ocorra uma vez
  const handleTransitionComplete = useCallback(() => {
    if (isRedirectingRef.current || !targetRoute) return
    isRedirectingRef.current = true
    router.replace(targetRoute)
  }, [targetRoute, router])

  // Fallback de segurança: se a rota foi calculada mas por qualquer motivo a animação
  // demorar mais de 3.8s para chamar o callback, executa o redirecionamento forçado
  useEffect(() => {
    if (!targetRoute) return
    const fallbackTimer = setTimeout(() => {
      handleTransitionComplete()
    }, 3800)
    return () => clearTimeout(fallbackTimer)
  }, [targetRoute, handleTransitionComplete])

  // Fallback de segurança para liberar a splash screen nativa do Capacitor em caso extremo
  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen(300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AppLoadingScreen
      mode={isDemoMode ? 'demo' : 'app'}
      isReady={!!targetRoute}
      onReadyComplete={handleTransitionComplete}
    />
  )
}
