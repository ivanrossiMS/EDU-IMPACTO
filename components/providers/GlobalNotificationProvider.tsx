'use client'

/**
 * GlobalNotificationProvider.tsx
 *
 * Provedor central e global de notificações push (OneSignal) e deep linking.
 * Roda na raiz do aplicativo (app/layout.tsx), garantindo que:
 * 1. O NotificationService seja inicializado de forma controlada e segura.
 * 2. NENHUMA chamada a requestPermission(true) ocorra no startup (eliminando o popup indevido em inglês).
 * 3. Cliques em notificações push sejam capturados em cold start (app fechado)
 *    ou resume (em segundo plano), em qualquer rota.
 * 4. O usuário seja redirecionado diretamente para o item da Agenda Digital
 *    (comunicado, momentos ou calendário), contornando a tela de escolha de módulos.
 * 5. O usuário autenticado seja sincronizado com tags e external_id no OneSignal.
 * 6. Exiba o modal controlado em português caso as notificações estejam efetivamente negadas.
 */

import React, { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { notificationService } from '@/lib/notifications/notificationService'
import { NotificationPermissionModal } from '@/components/notifications/NotificationPermissionModal'

export const PENDING_PUSH_ROUTE_KEY = 'edu_pending_push_route'

declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
    __OS_GLOBAL_INIT__?: boolean
    __OS_GLOBAL_USER_ID__?: string
    __OS_NATIVE_READY__?: boolean
  }
}

/**
 * Mapeia o tipo de notificação para a rota correspondente.
 */
function mapTypeToRoute(type?: string): string {
  if (!type) return ''
  const t = String(type).toLowerCase().trim()
  const map: Record<string, string> = {
    comunicados: 'comunicados',
    comunicado: 'comunicados',
    momentos: 'momentos',
    momento: 'momentos',
    calendario: 'calendario',
    evento: 'calendario',
    eventos: 'calendario',
    frequencia: 'frequencia',
    ocorrencias: 'ocorrencias',
    ocorrencia: 'ocorrencias',
    notas: 'notas',
    nota: 'notas',
    cobrancas: 'financeiro',
    saida: 'portaria',
  }
  return map[t] || t
}

/**
 * Extrai e normaliza a rota interna a partir do payload da notificação.
 */
export function resolveDestinationFromPayload(data: any, currentUser?: any): string {
  if (!data) return ''

  // 1. Se veio route, targetUrl ou url direta
  const directUrl = data.route || data.targetUrl || data.url || data.launchURL
  if (directUrl && typeof directUrl === 'string') {
    let cleanUrl = directUrl.trim()
    try {
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        const parsed = new URL(cleanUrl)
        cleanUrl = parsed.pathname + parsed.search
      } else if (cleanUrl.includes('://')) {
        // Schemes customizados (ex: impactoedu://agenda-digital/...)
        cleanUrl = '/' + cleanUrl.replace(/^[a-zA-Z0-9._-]+:\/*/, '')
      }
    } catch {}

    if (!cleanUrl.startsWith('/')) {
      cleanUrl = '/' + cleanUrl
    }

    if (data.item_id && !cleanUrl.includes('id=')) {
      cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + `id=${encodeURIComponent(data.item_id)}`
    }
    return cleanUrl
  }

  // 2. Resolver por tipo / rota
  const rota = mapTypeToRoute(data.rota || data.type)
  if (!rota) return ''

  const isColab =
    data.perfil_destino === 'colaborador' ||
    data.isColab === true ||
    (currentUser?.perfil &&
      !['Família', 'Responsável', 'Aluno'].includes(currentUser.perfil) &&
      !['Responsável', 'Aluno'].includes(currentUser?.cargo || ''))

  let destination = ''
  if (isColab) {
    destination = `/agenda-digital/colaborador/${rota}`
  } else {
    const slug = data.aluno_id || currentUser?.aluno_id
    if (slug) {
      destination = `/agenda-digital/${slug}/${rota}`
    } else {
      destination = `/agenda-digital?redirect=${rota}`
    }
  }

  if (data.item_id && !destination.includes('id=')) {
    destination += (destination.includes('?') ? '&' : '?') + `id=${encodeURIComponent(data.item_id)}`
  }

  return destination
}

export function GlobalNotificationProvider() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, hydrated } = useApp()
  const currentUserRef = useRef(currentUser)
  const hydratedRef = useRef(hydrated)

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    hydratedRef.current = hydrated
  }, [hydrated])

  // Limpa rota pendente apenas quando o usuário entra na tela de destino
  useEffect(() => {
    if (
      pathname &&
      (pathname.startsWith('/agenda-digital/') ||
        pathname.includes('/comunicados') ||
        pathname.includes('/momentos') ||
        pathname.includes('/calendario'))
    ) {
      if (typeof window !== 'undefined') {
        delete (window as any).__EDU_PENDING_PUSH_ROUTE__
      }
      try {
        localStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
        if (Capacitor.isNativePlatform()) {
          Preferences.remove({ key: PENDING_PUSH_ROUTE_KEY }).catch(() => {})
        }
      } catch {}
    }
  }, [pathname])

  // Função central para executar ou salvar a navegação de push
  const handlePushClick = (data: any) => {
    console.log('[GlobalPush] Notificação clicada com dados:', data)
    const destination = resolveDestinationFromPayload(data, currentUserRef.current)

    if (!destination) {
      console.warn('[GlobalPush] Não foi possível resolver a rota de destino da notificação:', data)
      return
    }

    console.log(`[GlobalPush] Destino resolvido → ${destination}`)

    // 1. Armazenar em memória global síncrona
    if (typeof window !== 'undefined') {
      ;(window as any).__EDU_PENDING_PUSH_ROUTE__ = destination
    }

    // 2. Salvar como rota pendente resiliente em localStorage e Preferences
    try {
      localStorage.setItem(PENDING_PUSH_ROUTE_KEY, destination)
      if (Capacitor.isNativePlatform()) {
        Preferences.set({ key: PENDING_PUSH_ROUTE_KEY, value: destination }).catch(() => {})
      }
    } catch {}

    // 3. Notificar listeners ativos na janela
    try {
      window.dispatchEvent(new CustomEvent('edu:navigate-push', { detail: { destination } }))
    } catch {}

    // 4. Se houver item_id de comunicado, dispara evento personalizado
    if (
      data.item_id &&
      (data.type === 'comunicados' || data.type === 'comunicado' || data.rota === 'comunicados')
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent('ad:open-comunicado', { detail: { id: String(data.item_id) } })
        )
      } catch {}
    }

    const user = currentUserRef.current
    const isHydrated = hydratedRef.current

    if (user) {
      console.log(`[GlobalPush] Usuário autenticado. Navegando para ${destination}`)
      router.replace(destination)
    } else if (isHydrated) {
      console.log(`[GlobalPush] Usuário não logado. Redirecionando para login com redirect pendente.`)
      router.replace(`/login?redirect=${encodeURIComponent(destination)}`)
    } else {
      console.log(`[GlobalPush] App hidratando sessão no cold start. Rota salva: ${destination}`)
    }
  }

  // 1. Inicialização segura via NotificationService e listeners de clique
  useEffect(() => {
    if (typeof window === 'undefined') return

    const init = async () => {
      await notificationService.initialize()

      const isNative = Capacitor.isNativePlatform()

      if (isNative) {
        try {
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')

          // Listener de clique nas notificações
          OneSignalNative.Notifications.addEventListener('click', (event: any) => {
            const notif = event?.notification || {}
            const addData = notif.additionalData || {}
            const launchURL = notif.launchURL || event?.result?.url
            const data = {
              ...addData,
              launchURL,
              url: addData.url || addData.targetUrl || launchURL,
              targetUrl: addData.targetUrl || addData.url || launchURL,
            }
            handlePushClick(data)
          })

          // Foreground notification listener
          OneSignalNative.Notifications.addEventListener(
            'foregroundWillDisplay',
            (event: any) => {
              console.log('📱 [GlobalPush] Notificação recebida em foreground:', event)
              try {
                window.dispatchEvent(new CustomEvent('ad:push-foreground', { detail: event }))
              } catch {}
            }
          )
        } catch (err) {
          console.error('[GlobalPush] Erro ao registrar listeners de clique:', err)
        }

        // Listener para Deep Links via Capacitor App (esquemas customizados)
        import('@capacitor/app')
          .then(({ App }) => {
            App.addListener('appUrlOpen', (event: any) => {
              console.log('📱 [GlobalPush] appUrlOpen recebido:', event?.url)
              if (event?.url) {
                try {
                  const parsed = new URL(event.url)
                  const path = parsed.pathname + parsed.search
                  if (path && path !== '/') {
                    handlePushClick({ targetUrl: path })
                  }
                } catch {}
              }
            }).catch(() => {})
          })
          .catch(() => {})
      } else {
        // Web Push Click Listener
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push((OneSignal: any) => {
          if (typeof OneSignal?.Notifications?.addEventListener === 'function') {
            OneSignal.Notifications.addEventListener('click', (event: any) => {
              const data = {
                ...(event?.notification?.additionalData || {}),
                launchURL: event?.notification?.launchURL,
              }
              handlePushClick(data)
            })
          }
        })
      }
    }

    init()
  }, []) // Montagem única

  // 2. Gerenciamento Global de Usuário no OneSignal via NotificationService
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (currentUser?.id) {
      notificationService.syncUser(currentUser).catch(err => {
        console.warn('[GlobalPush] Aviso na sincronização do usuário:', err)
      })
    } else {
      notificationService.clearUser().catch(err => {
        console.warn('[GlobalPush] Aviso no logout do usuário:', err)
      })
    }
  }, [currentUser?.id, currentUser?.perfil, currentUser?.cargo])

  return <NotificationPermissionModal />
}
