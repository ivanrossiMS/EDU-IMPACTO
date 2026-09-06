'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/lib/context'
import { resolveNotificationRoute, extractAppPath } from '@/lib/notificationRouting'
import { Capacitor } from '@capacitor/core'
import Script from 'next/script'

declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
    __OS_INIT__?: boolean
    __OS_USER_ID__?: string
    __OS_NATIVE_READY__?: boolean
    __PENDING_DEEP_LINK__?: string
  }
}

export function GlobalPushNotificationHandler() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentUser } = useApp()
  const isInitializedRef = useRef(false)

  // 1. Inicialização do OneSignal e Listeners Globais de Deep Link
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const isNative = Capacitor.isNativePlatform()
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID

    // ── NATIVO (Capacitor iOS & Android) ───────────────────────────────────
    if (isNative) {
      if (!window.__OS_INIT__) {
        window.__OS_INIT__ = true
        console.log('📱 [GlobalPush] Inicializando ambiente nativo Capacitor...')

        Promise.all([
          import('@onesignal/capacitor-plugin').catch(e => {
            console.error('[GlobalPush] Falha ao carregar @onesignal/capacitor-plugin:', e)
            return null
          }),
          import('@capacitor/app').catch(e => {
            console.error('[GlobalPush] Falha ao carregar @capacitor/app:', e)
            return null
          })
        ]).then(async ([oneSignalModule, appModule]) => {
          const OneSignalNative: any = (oneSignalModule as any)?.default || oneSignalModule
          const App: any = (appModule as any)?.App

          // A) Checagem de Launch URL a frio (quando o app foi aberto por um link)
          if (App) {
            try {
              const launch = await App.getLaunchUrl()
              if (launch?.url) {
                const parsed = extractAppPath(launch.url)
                if (parsed && parsed !== '/' && !parsed.includes('choose_system')) {
                  console.log('📱 [GlobalPush] App aberto com Launch URL:', parsed)
                  sessionStorage.setItem('pending_deep_link', parsed)
                  localStorage.setItem('pending_deep_link', parsed)
                  window.__PENDING_DEEP_LINK__ = parsed
                  window.location.replace(parsed)
                  return
                }
              }
            } catch (e) {}

            // B) Listener para quando o app é aberto por URL/deep link em background
            App.addListener('appUrlOpen', (event: any) => {
              if (event?.url) {
                const parsed = extractAppPath(event.url)
                if (parsed && parsed !== '/' && !parsed.includes('choose_system')) {
                  console.log('📱 [GlobalPush] Deep link appUrlOpen recebido:', parsed)
                  sessionStorage.setItem('pending_deep_link', parsed)
                  localStorage.setItem('pending_deep_link', parsed)
                  window.__PENDING_DEEP_LINK__ = parsed
                  window.location.replace(parsed)
                }
              }
            }).catch(() => {})

            // C) Listener para retorno do app ao primeiro plano
            App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
              if (isActive) {
                queryClient.invalidateQueries({ queryKey: ['agenda'] })
              }
            }).catch(() => {})
          }

          // D) Inicialização do OneSignal Native
          if (OneSignalNative && appId) {
            try {
              OneSignalNative.initialize(appId)
              window.__OS_NATIVE_READY__ = true

              // Pedir permissão no Android 13+ e iOS
              OneSignalNative.Notifications.requestPermission(true).catch(() => {})

              // LISTENER DE CLIQUE NATIVO (CRÍTICO: Ativo globalmente em qualquer tela!)
              OneSignalNative.Notifications.addEventListener('click', (event: any) => {
                const data = event?.notification?.additionalData || {}
                console.log('📱 [GlobalPush] Notificação nativa clicada:', data)

                const route = resolveNotificationRoute(data, event)
                if (route) {
                  console.log(`📱 [GlobalPush] Navegando diretamente para: ${route}`)
                  sessionStorage.setItem('pending_deep_link', route)
                  localStorage.setItem('pending_deep_link', route)
                  window.__PENDING_DEEP_LINK__ = route
                  window.location.replace(route)
                }
              })

              // Atualiza dados caso chegue notificação em foreground
              OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', () => {
                queryClient.invalidateQueries({ queryKey: ['agenda'] })
              })
            } catch (initNativeErr) {
              console.error('[GlobalPush] Erro ao inicializar OneSignal nativo:', initNativeErr)
            }
          }
        })
      }
      return
    }

    // ── WEB PUSH (v16) ─────────────────────────────────────────────────────
    if (!appId) return
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost) return

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        if (!OneSignal) return

        if (!window.__OS_INIT__) {
          window.__OS_INIT__ = true
          await OneSignal.init({
            appId,
            notifyButton: {
              enable: true,
              size: 'medium',
              theme: 'default',
              position: 'bottom-left',
              offset: { bottom: '24px', left: '24px' },
              colors: {
                'circle.background': '#fe5062',
                'circle.foreground': 'white',
                'badge.background': '#fe5062',
                'badge.foreground': 'white',
              },
            },
            serviceWorkerParam: { scope: '/' },
          })
          console.log('🔔 [GlobalPush] OneSignal Web inicializado com sucesso!')

          if (typeof OneSignal?.Notifications?.addEventListener === 'function') {
            OneSignal.Notifications.addEventListener('click', (event: any) => {
              const data = event?.notification?.additionalData || {}
              console.log('🔔 [GlobalPush] Notificação web clicada:', data)

              const route = resolveNotificationRoute(data, event)
              if (route) {
                console.log(`🔔 [GlobalPush] Navegando web diretamente para: ${route}`)
                sessionStorage.setItem('pending_deep_link', route)
                localStorage.setItem('pending_deep_link', route)
                window.__PENDING_DEEP_LINK__ = route
                window.location.replace(route)
              }
            })
          }
        }
      } catch (err: any) {
        const msg = err?.message || ''
        if (!msg.includes('already initialized')) {
          console.error('[GlobalPush] Erro inicialização OneSignal Web:', err)
        }
      }
    })
  }, [router, queryClient])

  // 2. Sincronização de Usuário, Aliases e Tags no OneSignal (Reage a mudanças no currentUser)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!currentUser?.id) return

    const sincronizarUsuario = async (retryCount = 0) => {
      const isNative = Capacitor.isNativePlatform()
      let OS: any = null

      if (isNative) {
        if (!window.__OS_NATIVE_READY__) {
          if (retryCount >= 20) return
          setTimeout(() => sincronizarUsuario(retryCount + 1), 250)
          return
        }
        const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin').catch(() => ({ default: null }))
        OS = OneSignalNative
      } else {
        OS = window.OneSignal
        if (!OS && window.OneSignalDeferred) {
          window.OneSignalDeferred.push(function(OneSignalInstance: any) {
            if (OneSignalInstance) sincronizarUsuario()
          })
          return
        }
      }

      if (!OS) return

      const userId = String(currentUser.id)
      if (window.__OS_USER_ID__ !== userId) {
        try {
          if (typeof OS.login === 'function') {
            await OS.login(userId)
            window.__OS_USER_ID__ = userId
            console.log(`✅ [GlobalPush] Usuário identificado no OneSignal: ${userId}`)
          }
        } catch (e) {}
      }

      // Configurar aliases para localização de alvos
      if (OS.User && typeof OS.User.addAlias === 'function') {
        try {
          const effectiveRespId = currentUser.responsavel_id || (currentUser as any)?.dados?.responsavel_id
          if (effectiveRespId) {
            OS.User.addAlias('responsavel_id', String(effectiveRespId)).catch?.(() => {})
          }
          if (currentUser.aluno_id) {
            OS.User.addAlias('aluno_id', String(currentUser.aluno_id)).catch?.(() => {})
          }
          if (currentUser.email) {
            OS.User.addAlias('email', String(currentUser.email).toLowerCase().trim()).catch?.(() => {})
          }
          const effectiveSysId =
            (currentUser as any)?.system_user_id ||
            (currentUser as any)?.system_users_id ||
            (currentUser as any)?.dados?.system_user_id ||
            (currentUser.id && String(currentUser.id).length > 20 ? currentUser.id : null)
          if (effectiveSysId) {
            OS.User.addAlias('system_user_id', String(effectiveSysId)).catch?.(() => {})
          }
        } catch (e) {}
      }

      // Configurar tags
      if (OS.User && typeof OS.User.addTags === 'function') {
        try {
          OS.User.addTags({
            perfil: currentUser.perfil || '',
            cargo: currentUser.cargo || '',
          }).catch?.(() => {})
        } catch (e) {}
      }
    }

    sincronizarUsuario()
  }, [currentUser])

  return (
    <>
      {/* Script do OneSignal Web SDK carregado após interação */}
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
    </>
  )
}
