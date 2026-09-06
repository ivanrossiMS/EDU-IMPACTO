'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Script from 'next/script'
import { useApp } from '@/lib/context'

declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
    __OS_INIT__?: boolean
    __OS_USER_ID__?: string
    __OS_NATIVE_READY__?: boolean
  }
}

function typeToRoute(type: string): string {
  const map: Record<string, string> = {
    comunicados: 'comunicados',
    momentos: 'momentos',
    calendario: 'calendario',
    frequencia: 'frequencia',
    ocorrencias: 'ocorrencias',
    notas: 'notas',
    cobrancas: 'financeiro',
    saida: 'portaria',
  }
  return map[type] || type || 'comunicados'
}

export function resolveNotificationRoute(data: any): string {
  if (data?.targetUrl && typeof data.targetUrl === 'string' && data.targetUrl.startsWith('/agenda-digital')) {
    return data.targetUrl
  }

  const access = data?.access || (data?.targetUrl?.includes('/colaborador') ? 'institucional' : 'familiar')
  const type = data?.type || data?.rota || 'comunicados'
  const routeSegment = typeToRoute(type)
  const itemId = data?.item_id || data?.itemId || data?.id
  const idQuery = itemId ? `?id=${itemId}` : ''

  if (access === 'institucional') {
    return `/agenda-digital/colaborador/${routeSegment}${idQuery}`
  }

  const slug = data?.aluno_id || data?.alunoId
  if (slug) {
    return `/agenda-digital/${slug}/${routeSegment}${idQuery}`
  }

  return `/agenda-digital?redirect=${routeSegment}${itemId ? `&id=${itemId}` : ''}`
}

export function GlobalPushNotificationManager() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentUser } = useApp()
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID

  // 1. Inicialização do OneSignal (Nativo ou Web)
  useEffect(() => {
    if (typeof window === 'undefined' || !appId) return

    const initOneSignal = async () => {
      try {
        let isNative = false
        try {
          isNative = !!(window as any).Capacitor?.isNativePlatform()
        } catch {}

        if (isNative) {
          if (!window.__OS_INIT__) {
            window.__OS_INIT__ = true
            console.log('📱 [GlobalPush] Inicializando OneSignal nativo (Capacitor)...')
            try {
              const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
              OneSignalNative.initialize(appId)
              window.__OS_NATIVE_READY__ = true

              try {
                await OneSignalNative.Notifications.requestPermission(true)
              } catch (permErr: any) {
                console.warn('📱 [GlobalPush] Aviso permissão nativa:', permErr?.message)
              }

              // Listener de clique no push nativo
              OneSignalNative.Notifications.addEventListener('click', (event: any) => {
                const data = event?.notification?.additionalData || {}
                console.log('📱 [GlobalPush] Notificação nativa clicada:', data)
                const route = resolveNotificationRoute(data)
                if (route) {
                  console.log(`📱 [GlobalPush] Redirecionando para: ${route}`)
                  router.push(route)
                }
              })

              OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', () => {
                queryClient.invalidateQueries({ queryKey: ['agenda'] })
              })

              import('@capacitor/app').then(({ App }) => {
                App.addListener('appStateChange', ({ isActive }) => {
                  if (isActive) {
                    queryClient.invalidateQueries({ queryKey: ['agenda'] })
                  }
                })
              }).catch(() => {})
            } catch (nativeErr: any) {
              console.error('📱 [GlobalPush] Erro no plugin nativo:', nativeErr)
            }
          }
          return
        }

        // Web Push (v16)
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async function (OneSignal: any) {
          try {
            if (!OneSignal) return
            if (!window.__OS_INIT__) {
              if (window.location.hostname === 'localhost') {
                return
              }
              window.__OS_INIT__ = true
              try {
                await OneSignal.init({
                  appId,
                  allowLocalhostAsSecureOrigin: true,
                  notifyButton: {
                    enable: true,
                    size: 'medium',
                    position: 'bottom-right',
                    offset: { bottom: '80px', right: '20px' },
                    colors: {
                      'circle.background': '#4f46e5',
                      'circle.foreground': 'white',
                      'badge.background': '#fe5062',
                      'badge.foreground': 'white',
                    },
                  },
                  serviceWorkerParam: { scope: '/' },
                })
                console.log('🔔 [GlobalPush] OneSignal Web inicializado!')

                if (typeof OneSignal?.Notifications?.addEventListener === 'function') {
                  OneSignal.Notifications.addEventListener('click', (event: any) => {
                    const data = event?.notification?.additionalData || {}
                    console.log('🔔 [GlobalPush] Notificação web clicada:', data)
                    const route = resolveNotificationRoute(data)
                    if (route) {
                      console.log(`🔔 [GlobalPush] Redirecionando para: ${route}`)
                      router.push(route)
                    }
                  })
                }
              } catch (initErr: any) {
                const msg = initErr?.message || ''
                if (!msg.includes('already initialized') && !msg.includes('Timeout')) {
                  console.error('[GlobalPush] Erro inicialização web:', initErr)
                  window.__OS_INIT__ = false
                }
              }
            }
          } catch (e: any) {
            console.error('[GlobalPush] Erro interno listener web:', e)
          }
        })
      } catch (err: any) {
        console.error('[GlobalPush] Falha crítica inicialização:', err)
      }
    }

    const timer = setTimeout(initOneSignal, 500)
    return () => clearTimeout(timer)
  }, [appId, queryClient, router])

  // 2. Gerenciamento de Usuário, Aliases e Tags no OneSignal
  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncUserWithOneSignal = async (retry = 0) => {
      try {
        let isNative = false
        try {
          isNative = !!(window as any).Capacitor?.isNativePlatform()
        } catch {}

        let OS: any = null
        if (isNative) {
          if (!window.__OS_NATIVE_READY__) {
            if (retry >= 25) return
            setTimeout(() => syncUserWithOneSignal(retry + 1), 200)
            return
          }
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
          OS = OneSignalNative
        } else {
          OS = window.OneSignal
          if (!OS && window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function (inst: any) {
              if (inst) syncUserWithOneSignal()
            })
            return
          }
        }

        if (!OS) return

        if (currentUser?.id) {
          const userId = String(currentUser.id)

          if (window.__OS_USER_ID__ !== userId) {
            if (typeof OS.login === 'function') {
              await OS.login(userId)
              window.__OS_USER_ID__ = userId
              console.log(`✅ [GlobalPush] OneSignal identificado como: ${userId}`)
            }
          }

          // Aliases para permitir envio por qualquer ID (duplo papel)
          if (OS.User && typeof OS.User.addAlias === 'function') {
            try {
              if (currentUser.responsavel_id) {
                OS.User.addAlias('responsavel_id', String(currentUser.responsavel_id))?.catch?.(() => {})
              }
              if (currentUser.colaborador_id) {
                OS.User.addAlias('colaborador_id', String(currentUser.colaborador_id))?.catch?.(() => {})
              }
              if (currentUser.aluno_id) {
                OS.User.addAlias('aluno_id', String(currentUser.aluno_id))?.catch?.(() => {})
              }
              if (currentUser.email) {
                OS.User.addAlias('email', String(currentUser.email).toLowerCase().trim())?.catch?.(() => {})
              }
            } catch {}
          }

          // Tags de segmentação
          if (OS.User && typeof OS.User.addTags === 'function') {
            try {
              const tags: Record<string, string> = {
                perfil: currentUser.perfil || '',
                cargo: currentUser.cargo || '',
                has_dual_role: currentUser.hasDualRole ? 'true' : 'false',
              }
              if (currentUser.responsavel_id) tags['responsavel_id'] = String(currentUser.responsavel_id)
              if (currentUser.colaborador_id) tags['colaborador_id'] = String(currentUser.colaborador_id)
              if (currentUser.aluno_id) tags['aluno_id'] = String(currentUser.aluno_id)
              await OS.User.addTags(tags)
            } catch {}
          }
        } else {
          if (window.__OS_USER_ID__) {
            if (typeof OS.logout === 'function') {
              await OS.logout()
              window.__OS_USER_ID__ = undefined
              console.log('🚪 [GlobalPush] Usuário deslogado do Push')
            }
          }
        }
      } catch (err: any) {
        console.warn('[GlobalPush] Erro ao sincronizar usuário:', err?.message)
      }
    }

    syncUserWithOneSignal()
  }, [
    currentUser?.id,
    currentUser?.email,
    currentUser?.responsavel_id,
    currentUser?.colaborador_id,
    currentUser?.aluno_id,
    currentUser?.hasDualRole,
    currentUser?.perfil,
    currentUser?.cargo,
  ])

  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
    </>
  )
}
