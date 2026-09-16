'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const { currentUser, hydrated } = useApp()
  const [isReady, setIsReady] = useState(false)
  const [targetRoute, setTargetRoute] = useState<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const hasTriggeredReadyRef = useRef(false)

  // 1. Libera imediatamente a splash screen nativa para evitar telas pretas/brancas
  useEffect(() => {
    hideSplashScreen(250)
  }, [])

  // 2. Gerenciamento do ciclo de resolução da sessão e prontidão real
  useEffect(() => {
    // Escuta evento de navegação por push disparado pelo OneSignal durante o cold start
    const handlePushEvent = (e: any) => {
      const dest = e?.detail?.destination
      if (dest) {
        console.log('[Root] Evento edu:navigate-push recebido em cold start:', dest)
        triggerReadyTransition(dest)
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

    const triggerReadyTransition = (destination: string) => {
      if (hasTriggeredReadyRef.current) return
      hasTriggeredReadyRef.current = true

      // Pré-carrega ativamente os chunks da rota de destino
      try {
        router.prefetch(destination)
      } catch {}

      // Mantém tempo mínimo estético (~700ms) para apresentação elegante sem criar espera artificial
      const elapsed = Date.now() - startTimeRef.current
      const delay = Math.max(0, 750 - elapsed)

      setTimeout(() => {
        if (!isSubscribed) return
        setTargetRoute(destination)
        setIsReady(true)
      }, delay)
    }

    const checkPendingPushAndRoute = async () => {
      // Se estiver em ambiente nativo, concede janela de espera ativa (até 800ms)
      // para o OneSignal descarregar o clique de notificação em cold start
      let pendingPushRoute = typeof window !== 'undefined'
        ? ((window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY))
        : null

      if (!pendingPushRoute && Capacitor.isNativePlatform()) {
        for (let i = 0; i < 8; i++) {
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
          triggerReadyTransition(pendingPushRoute)
          return
        } else {
          triggerReadyTransition(`/login?redirect=${encodeURIComponent(pendingPushRoute)}`)
          return
        }
      }

      // Se nenhum usuário estiver logado, redireciona para o login
      if (!currentUser) {
        triggerReadyTransition('/login')
        return
      }

      // 1. Família / Aluno / Responsável têm exclusivamente acesso à Agenda Digital
      if (isFamilyOrStudent(currentUser)) {
        const dest = getAgendaDigitalDestination(currentUser)
        triggerReadyTransition(dest)
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
      triggerReadyTransition(initialRoute)
    }

    checkPendingPushAndRoute()

    return () => {
      isSubscribed = false
      window.removeEventListener('edu:navigate-push', handlePushEvent)
    }
  }, [hydrated, currentUser, router])

  // Fallback de segurança para liberar a splash screen nativa em caso extremo
  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen(300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  // Renderiza tela de abertura moderna e animada fiel ao design de referência
  return (
    <AppLoadingScreen
      isReady={isReady}
      onFinish={() => {
        if (targetRoute) {
          router.replace(targetRoute)
        }
      }}
      onRetry={() => {
        window.location.reload()
      }}
    />
  )
}


