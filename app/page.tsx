'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { hideSplashScreen } from '@/lib/capacitor/splash'

import { PENDING_PUSH_ROUTE_KEY } from '@/components/providers/GlobalNotificationProvider'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'

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

      const perfil = currentUser.perfil || ''
      const cargo = currentUser.cargo || ''
      const isAdmin = ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master'].includes(perfil) ||
                      ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master'].includes(cargo)

      const isFamilyOrStudent = (
        perfil === 'Família' ||
        perfil === 'Responsável' ||
        perfil === 'Aluno' ||
        cargo === 'Responsável' ||
        cargo === 'Aluno'
      )

      if (isFamilyOrStudent) {
        if (cargo === 'Aluno' && currentUser.aluno_id) {
          router.replace(`/agenda-digital/${currentUser.aluno_id}/comunicados`)
          return
        }
        router.replace('/agenda-digital/selecionar-aluno')
      } else if (isAdmin) {
        if (perfil === 'Diretor Geral' || cargo === 'Administrador Master' || perfil === 'Administrador') {
          router.replace('/agenda-digital/selecionar-perfil-admin')
        } else {
          router.replace('/agenda-digital/admin')
        }
      } else {
        // Colaborador (Secretária, Professor, Coordenador, Financeiro, etc.):
        if (currentUser.hasDualRole || currentUser.responsavel_id) {
          router.replace('/agenda-digital/selecionar-aluno')
        } else {
          router.replace('/agenda-digital/colaborador/comunicados')
        }
      }
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

