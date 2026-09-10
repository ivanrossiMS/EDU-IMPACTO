'use client'

import { useEffect } from 'react'
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

  useEffect(() => {
    // Escuta evento de navegação por push disparado pelo OneSignal durante o cold start
    const handlePushEvent = (e: any) => {
      const dest = e?.detail?.destination
      if (dest) {
        console.log('[Root] Evento edu:navigate-push recebido em cold start:', dest)
        router.replace(dest)
      }
    }
    window.addEventListener('edu:navigate-push', handlePushEvent)

    // Wait for AppProvider to hydrate the session from localStorage/Capacitor Preferences
    if (!hydrated) {
      return () => {
        window.removeEventListener('edu:navigate-push', handlePushEvent)
      }
    }

    let isSubscribed = true

    const checkPendingPushAndRoute = async () => {
      // Se estiver em ambiente nativo, concede janela de espera ativa (até 1000ms)
      // para o OneSignal descarregar o clique de notificação em cold start
      let pendingPushRoute = typeof window !== 'undefined'
        ? ((window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY))
        : null

      if (!pendingPushRoute && Capacitor.isNativePlatform()) {
        for (let i = 0; i < 10; i++) {
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
          console.log('[Root] Usuário autenticado. Redirecionando direto para o item da notificação:', pendingPushRoute)
          router.replace(pendingPushRoute)
          return
        } else {
          console.log('[Root] Usuário deslogado. Enviando para login com redirect:', pendingPushRoute)
          router.replace(`/login?redirect=${encodeURIComponent(pendingPushRoute)}`)
          return
        }
      }

      // If no user is logged in, redirect to /login on the client side.
      if (!currentUser) {
        router.replace('/login')
        return
      }

      // 1. Família / Aluno / Responsável têm exclusivamente acesso à Agenda Digital
      if (isFamilyOrStudent(currentUser)) {
        const dest = getAgendaDigitalDestination(currentUser)
        router.replace(dest)
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

      // Determina a rota correta:
      // - Se o perfil tiver APENAS a Agenda Digital liberada: vai direto para ela.
      // - Se tiver APENAS 1 outro módulo liberado (ex: ERP): vai direto para ele.
      // - Se tiver MÚLTIPLOS módulos: vai para a tela de escolha (/login?step=choose_system).
      const initialRoute = getInitialRouteForUser(currentUser, userPerfilObj)
      console.log('[Root] Rota inicial resolvida para o perfil:', initialRoute)
      router.replace(initialRoute)
    }

    checkPendingPushAndRoute()

    return () => {
      isSubscribed = false
      window.removeEventListener('edu:navigate-push', handlePushEvent)
    }
  }, [hydrated, currentUser, router])

  // Fallback de segurança para liberar a splash screen em caso extremo (ex: 4s sem resposta)
  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen(300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  // Renderiza tela de abertura ultra moderna e animada com a identidade visual do Impacto Edu
  return <AppLoadingScreen />
}

