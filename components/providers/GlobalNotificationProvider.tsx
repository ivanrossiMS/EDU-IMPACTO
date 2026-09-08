'use client'

/**
 * GlobalNotificationProvider.tsx
 *
 * Provedor central e global de notificações push (OneSignal) e deep linking.
 * Roda na raiz do aplicativo (app/layout.tsx), garantindo que:
 * 1. O OneSignal seja inicializado imediatamente (Capacitor nativo ou Web SDK).
 * 2. Cliques em notificações push sejam capturados em cold start (app fechado)
 *    ou resume (em segundo plano), em qualquer rota.
 * 3. O usuário seja redirecionado diretamente para o item da Agenda Digital
 *    (comunicado, momentos ou calendário), contornando a tela de escolha de módulos.
 * 4. O usuário autenticado seja sincronizado com tags e external_id no OneSignal.
 */

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

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

  // 1. Se veio targetUrl ou url direta
  const directUrl = data.targetUrl || data.url || data.launchURL
  if (directUrl && typeof directUrl === 'string') {
    let cleanUrl = directUrl
    try {
      if (cleanUrl.startsWith('http')) {
        const parsed = new URL(cleanUrl)
        cleanUrl = parsed.pathname + parsed.search
      }
    } catch {}

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
    (currentUser?.perfil && !['Família', 'Responsável', 'Aluno'].includes(currentUser.perfil) && !['Responsável', 'Aluno'].includes(currentUser?.cargo || ''))

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
  const { currentUser } = useApp()
  const currentUserRef = useRef(currentUser)

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  // Limpa rota pendente apenas quando o usuário efetivamente entra na tela de destino
  useEffect(() => {
    if (pathname && (pathname.startsWith('/agenda-digital/') || pathname.includes('/comunicados') || pathname.includes('/momentos') || pathname.includes('/calendario'))) {
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
      (window as any).__EDU_PENDING_PUSH_ROUTE__ = destination
    }

    // 2. Salvar como rota pendente resiliente em localStorage e Preferences
    try {
      localStorage.setItem(PENDING_PUSH_ROUTE_KEY, destination)
      if (Capacitor.isNativePlatform()) {
        Preferences.set({ key: PENDING_PUSH_ROUTE_KEY, value: destination }).catch(() => {})
      }
    } catch {}

    // 3. Notificar qualquer listener ativo na janela
    try {
      window.dispatchEvent(new CustomEvent('edu:navigate-push', { detail: { destination } }))
    } catch {}

    // 4. Se houver item_id de comunicado, dispara evento personalizado
    if (data.item_id && (data.type === 'comunicados' || data.type === 'comunicado' || data.rota === 'comunicados')) {
      try {
        window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id: String(data.item_id) } }))
      } catch {}
    }

    const user = currentUserRef.current
    if (user) {
      console.log(`[GlobalPush] Usuário autenticado. Navegando diretamente para ${destination}`)
      router.replace(destination)
    } else {
      console.log(`[GlobalPush] Usuário não logado. Redirecionando para login com redirect pendente.`)
      router.replace(`/login?redirect=${encodeURIComponent(destination)}`)
    }
  }

  // 1. Inicialização do OneSignal e listeners de clique
  useEffect(() => {
    if (typeof window === 'undefined') return

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) {
      console.warn('[GlobalPush] NEXT_PUBLIC_ONESIGNAL_APP_ID não configurado.')
      return
    }

    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      if (!window.__OS_GLOBAL_INIT__) {
        window.__OS_GLOBAL_INIT__ = true
        console.log('📱 [GlobalPush] Inicializando OneSignal Nativo (Capacitor)...')

        import('@onesignal/capacitor-plugin')
          .then(async ({ default: OneSignalNative }) => {
            try {
              await OneSignalNative.initialize(appId)
              window.__OS_NATIVE_READY__ = true
              ;(window as any).__OS_INIT__ = true

              // Solicitar permissão nativa de notificações (Android 13+ e iOS)
              try {
                const permResult = await OneSignalNative.Notifications.requestPermission(true)
                console.log('📱 [GlobalPush] Permissão nativa solicitada:', permResult)
                if (OneSignalNative.User?.pushSubscription?.optIn) {
                  await OneSignalNative.User.pushSubscription.optIn().catch(() => {})
                }
              } catch (permErr: any) {
                console.warn('📱 [GlobalPush] Permissão nativa:', permErr?.message)
              }

              // Listener global de clique na notificação
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
              OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
                console.log('📱 [GlobalPush] Notificação em foreground:', event)
                try {
                  window.dispatchEvent(new CustomEvent('ad:push-foreground', { detail: event }))
                } catch {}
              })

              console.log('✅ [GlobalPush] OneSignal Nativo inicializado e listeners registrados!')
            } catch (err: any) {
              console.error('❌ [GlobalPush] Erro ao inicializar OneSignal Nativo:', err)
            }
          })
          .catch(err => {
            console.error('❌ [GlobalPush] Erro ao carregar plugin nativo OneSignal:', err)
          })

        // Listener para Deep Links via Capacitor App (ex: esquemas de URL ou universal links)
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

            App.addListener('appStateChange', ({ isActive }) => {
              if (isActive) {
                console.log('📱 [GlobalPush] App voltou para o FOREGROUND')
                try {
                  window.dispatchEvent(new CustomEvent('ad:app-foreground'))
                } catch {}
              }
            }).catch(() => {})
          })
          .catch(() => {})
      }
    } else {
      // ── Web Push ────────────────────────────────────────────────────────
      if (!window.__OS_GLOBAL_INIT__) {
        if (window.location.hostname === 'localhost') {
          return
        }
        window.__OS_GLOBAL_INIT__ = true

        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async function (OneSignal: any) {
          try {
            if (!OneSignal) return
            await OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: '/' },
            })
            ;(window as any).__OS_INIT__ = true

            // Listener de clique nas notificações Web
            if (typeof OneSignal?.Notifications?.addEventListener === 'function') {
              OneSignal.Notifications.addEventListener('click', (event: any) => {
                const data = {
                  ...(event?.notification?.additionalData || {}),
                  launchURL: event?.notification?.launchURL,
                }
                handlePushClick(data)
              })
            }
            console.log('🔔 [GlobalPush] OneSignal Web inicializado com listener de clique!')
          } catch (initErr: any) {
            const msg = initErr?.message || ''
            if (!msg.includes('already initialized')) {
              console.warn('[GlobalPush] Erro inicialização Web:', initErr)
            }
          }
        })
      }
    }
  }, []) // Apenas na montagem

  // 2. Gerenciamento Global de Usuário e Tags no OneSignal
  useEffect(() => {
    if (typeof window === 'undefined') return

    const sincronizarUsuarioOneSignal = async (retryCount = 0) => {
      try {
        const isNative = Capacitor.isNativePlatform()
        let OS: any = null

        if (isNative) {
          if (!window.__OS_NATIVE_READY__) {
            if (retryCount >= 20) return
            setTimeout(() => sincronizarUsuarioOneSignal(retryCount + 1), 250)
            return
          }
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
          OS = OneSignalNative
        } else {
          OS = window.OneSignal
          if (!OS && window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function (inst: any) {
              if (inst) sincronizarUsuarioOneSignal()
            })
            return
          }
        }

        if (!OS) return

        if (currentUser?.id) {
          const userId = String(currentUser.id)
          if (window.__OS_GLOBAL_USER_ID__ !== userId) {
            try {
              if (typeof OS.login === 'function') {
                await OS.login(userId)
                window.__OS_GLOBAL_USER_ID__ = userId
                console.log(`✅ [GlobalPush] Usuário autenticado no OneSignal: ${userId}`)

                // Garantir optIn na push subscription
                if (OS.User?.pushSubscription?.optIn) {
                  await OS.User.pushSubscription.optIn().catch(() => {})
                }

                // Aliases para identificação flexível pelo backend
                if (OS.User && typeof OS.User.addAlias === 'function') {
                  if (currentUser.responsavel_id) {
                    OS.User.addAlias('responsavel_id', String(currentUser.responsavel_id)).catch(() => {})
                  }
                  if (currentUser.aluno_id) {
                    OS.User.addAlias('aluno_id', String(currentUser.aluno_id)).catch(() => {})
                  }
                  const colabId =
                    currentUser.colaborador_id ||
                    currentUser.system_user_id ||
                    currentUser.user_metadata?.colaborador_id ||
                    currentUser.user_metadata?.system_user_id
                  if (colabId) {
                    OS.User.addAlias('colaborador_id', String(colabId)).catch(() => {})
                    OS.User.addAlias('system_user_id', String(colabId)).catch(() => {})
                  }
                  const cod = (currentUser as any).codigo || currentUser.user_metadata?.codigo
                  if (cod) {
                    OS.User.addAlias('codigo', String(cod)).catch(() => {})
                  }
                  if (currentUser.email) {
                    OS.User.addAlias('email', String(currentUser.email).toLowerCase().trim()).catch(() => {})
                  }
                }
              }
            } catch (err: any) {
              console.warn('[GlobalPush] Aviso no login do OneSignal:', err?.message)
            }
          }

          // Atribuição de tags de segmentação
          try {
            const tags: Record<string, string> = {
              perfil: currentUser.perfil || '',
              cargo: currentUser.cargo || '',
            }
            if (currentUser.aluno_id) tags['aluno_id'] = String(currentUser.aluno_id)
            if (currentUser.responsavel_id) tags['responsavel_id'] = String(currentUser.responsavel_id)
            const staffId =
              currentUser.colaborador_id ||
              currentUser.system_user_id ||
              currentUser.user_metadata?.colaborador_id
            if (staffId) tags['colaborador_id'] = String(staffId)
            const codTag = (currentUser as any).codigo || currentUser.user_metadata?.codigo
            if (codTag) tags['codigo'] = String(codTag)

            if (OS.User && typeof OS.User.addTags === 'function') {
              await OS.User.addTags(tags)
            }
          } catch {}

          // Salvar estado da subscrição no window para diagnóstico rápido
          try {
            const pushSubId = OS.User?.pushSubscription?.id
            const pushOptedIn = OS.User?.pushSubscription?.optedIn
            ;(window as any).__OS_SUBSCRIPTION_STATE__ = {
              platform: isNative ? 'native' : 'web',
              userId,
              pushSubId,
              pushOptedIn,
              updatedAt: new Date().toISOString(),
            }
            console.log('📱 [GlobalPush] Status da Inscrição OneSignal:', (window as any).__OS_SUBSCRIPTION_STATE__)
          } catch {}
        } else {
          // Logout se o usuário deslogou
          if (window.__OS_GLOBAL_USER_ID__) {
            try {
              if (typeof OS.logout === 'function') {
                await OS.logout()
                window.__OS_GLOBAL_USER_ID__ = undefined
                console.log('🚪 [GlobalPush] Usuário deslogado do OneSignal')
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error('[GlobalPush] Erro ao sincronizar usuário:', err)
      }
    }

    sincronizarUsuarioOneSignal()

    // Re-sincronizar quando o app volta para o foreground
    const handleForegroundSync = () => {
      window.__OS_GLOBAL_USER_ID__ = undefined
      sincronizarUsuarioOneSignal()
    }
    window.addEventListener('ad:app-foreground', handleForegroundSync)

    return () => {
      window.removeEventListener('ad:app-foreground', handleForegroundSync)
    }
  }, [currentUser?.id, currentUser?.perfil, currentUser?.cargo])

  // Componente invisível
  return null
}
