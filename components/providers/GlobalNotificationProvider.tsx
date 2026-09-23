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

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { notificationService } from '@/lib/notifications/notificationService'
import { triggerHaptic } from '@/lib/utils/haptics'
import { X } from 'lucide-react'

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
 * Extrai e normaliza a rota interna a partir do payload da notificação,
 * garantindo que rotas genéricas de alunos sejam reescritas com o ID do aluno.
 */
export function resolveDestinationFromPayload(data: any, currentUser?: any): string {
  if (!data) return ''

  const rawPerfil = (currentUser?.perfil || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const rawCargo = (currentUser?.cargo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isFamilyUser = rawPerfil === 'familia' || rawPerfil === 'responsavel' || rawPerfil === 'aluno' || rawCargo === 'responsavel' || rawCargo === 'aluno'

  const isColab =
    data.perfil_destino === 'colaborador' ||
    data.isColab === true ||
    (!isFamilyUser && Boolean(currentUser?.perfil || currentUser?.cargo))

  const candidateAlunoId =
    data.aluno_id ||
    data.metadata?.aluno_id ||
    data.student_id ||
    data.targetAlunoId ||
    (!isColab ? currentUser?.aluno_id : '')

  const rawItemId =
    data.item_id ||
    data.metadata?.item_id ||
    data.id ||
    data.comunicado_id ||
    data.momento_id ||
    data.ocorrencia_id ||
    data.nota_id

  // 1. Se veio route, targetUrl ou url direta
  const directUrl = data.route || data.targetUrl || data.target_url || data.url || data.launchURL
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

    // Se a URL direta for genérica sem aluno_id (ex: /agenda-digital/frequencia, /agenda-digital/comunicados)
    // e tivermos candidateAlunoId (e não for colaborador), REESCREVE diretamente para a rota do aluno!
    const genericMatch = cleanUrl.match(/^\/agenda-digital\/(comunicados|momentos|calendario|frequencia|ocorrencias|notas|financeiro|portaria)(\?.*)?$/)
    if (genericMatch && candidateAlunoId && !isColab) {
      const moduleName = genericMatch[1]
      const existingQuery = genericMatch[2] || ''
      cleanUrl = `/agenda-digital/${candidateAlunoId}/${moduleName}${existingQuery}`
    } else if (genericMatch && isColab) {
      const moduleName = genericMatch[1]
      const existingQuery = genericMatch[2] || ''
      cleanUrl = `/agenda-digital/colaborador/${moduleName}${existingQuery}`
    }

    if (rawItemId && !cleanUrl.includes('id=')) {
      cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + `id=${encodeURIComponent(String(rawItemId))}`
    }
    return cleanUrl
  }

  // 2. Resolver por tipo / rota
  const rota = mapTypeToRoute(data.rota || data.type)
  if (!rota) return ''

  let destination = ''
  if (isColab) {
    destination = `/agenda-digital/colaborador/${rota}`
  } else {
    const slug = candidateAlunoId
    if (slug) {
      destination = `/agenda-digital/${slug}/${rota}`
    } else {
      destination = `/agenda-digital?redirect=${rota}`
    }
  }

  if (rawItemId && !destination.includes('id=')) {
    destination += (destination.includes('?') ? '&' : '?') + `id=${encodeURIComponent(String(rawItemId))}`
  }

  return destination
}

export interface ForegroundPushBanner {
  id: string
  title: string
  body: string
  data: any
  time?: string
  icon?: string
}

/**
 * Sintetiza um som nítido e harmônico de notificação em primeiro plano via Web Audio API.
 * Funciona de forma resiliente tanto na Web quanto dentro do WebView do Capacitor (iOS e Android).
 */
function playForegroundChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const t = ctx.currentTime
    // Sino harmônico elegante em 2 tons: E5 (659Hz) -> A5 (880Hz)
    const notes = [
      { freq: 659.25, time: 0, dur: 0.28 },
      { freq: 880.00, time: 0.12, dur: 0.45 },
    ]
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + time)
      gain.gain.setValueAtTime(0.001, t + time)
      gain.gain.exponentialRampToValueAtTime(0.28, t + time + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + time + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t + time)
      osc.stop(t + time + dur + 0.05)
    })
    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 1000)
  } catch (e) {
    console.warn('[GlobalPush] Não foi possível reproduzir som foreground:', e)
  }
}

export function GlobalNotificationProvider() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, hydrated } = useApp()
  const currentUserRef = useRef(currentUser)
  const hydratedRef = useRef(hydrated)
  const wasLoggedInRef = useRef(false)

  // ── Estado do Banner Flutuante de Notificação Push em Primeiro Plano (In-App Push) ──
  const [activeBanner, setActiveBanner] = useState<ForegroundPushBanner | null>(null)
  const [isDismissing, setIsDismissing] = useState(false)
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedIdRef = useRef<string>('')
  const touchStartYRef = useRef<number | null>(null)

  const dismissBanner = useCallback(() => {
    setIsDismissing(true)
    setTimeout(() => {
      setActiveBanner(null)
      setIsDismissing(false)
    }, 280)
  }, [])

  const showForegroundPushBanner = useCallback((banner: ForegroundPushBanner) => {
    if (!banner || !banner.title) return
    const bannerId = banner.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    if (bannerId && bannerId === lastProcessedIdRef.current) return
    lastProcessedIdRef.current = bannerId

    // 1. Vibração háptica tátil no dispositivo móvel (iOS e Android via Capacitor Haptics)
    triggerHaptic('success').catch(() => {})

    // 2. Chime de notificação nítido via Web Audio API
    playForegroundChime()

    // 3. Atualizar estado do banner flutuante
    setIsDismissing(false)
    setActiveBanner(banner)

    // 4. Limpar timer anterior e agendar auto-dismiss após 6.5s
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
    }
    dismissTimerRef.current = setTimeout(() => {
      dismissBanner()
    }, 6500)
  }, [dismissBanner])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return
    const currentY = e.touches[0].clientY
    if (touchStartYRef.current - currentY > 25) {
      touchStartYRef.current = null
      dismissBanner()
    }
  }

  const onTouchEnd = () => {
    touchStartYRef.current = null
  }

  useEffect(() => {
    currentUserRef.current = currentUser
    if (currentUser?.id) {
      wasLoggedInRef.current = true
    }
  }, [currentUser])

  useEffect(() => {
    hydratedRef.current = hydrated
  }, [hydrated])

  // Limpa rota pendente APENAS quando o usuário efetivamente entra no módulo final de destino.
  // NUNCA limpa na tela intermediária de seleção de aluno (/agenda-digital/selecionar-aluno) ou na raiz (/agenda-digital).
  useEffect(() => {
    if (!pathname) return
    if (
      pathname === '/agenda-digital' ||
      pathname.includes('/selecionar-aluno') ||
      pathname.includes('/selecionar-perfil-admin')
    ) {
      return
    }

    if (
      pathname.includes('/comunicados') ||
      pathname.includes('/momentos') ||
      pathname.includes('/calendario') ||
      pathname.includes('/frequencia') ||
      pathname.includes('/ocorrencias') ||
      pathname.includes('/notas') ||
      pathname.includes('/financeiro')
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

  // ── Executar navegação para rota pendente assim que a sessão hidratar ──
  useEffect(() => {
    if (!hydrated || !currentUser) return

    const checkAndNavigatePendingRoute = async () => {
      let pendingRoute =
        (typeof window !== 'undefined' ? (window as any).__EDU_PENDING_PUSH_ROUTE__ : null) ||
        localStorage.getItem(PENDING_PUSH_ROUTE_KEY)

      if (!pendingRoute && Capacitor.isNativePlatform()) {
        try {
          const { value } = await Preferences.get({ key: PENDING_PUSH_ROUTE_KEY })
          if (value) pendingRoute = value
        } catch {}
      }

      if (pendingRoute && typeof pendingRoute === 'string') {
        let dest = pendingRoute.trim()
        try {
          if (dest.startsWith('http://') || dest.startsWith('https://')) {
            const parsed = new URL(dest)
            dest = parsed.pathname + parsed.search
          } else if (dest.includes('://')) {
            dest = '/' + dest.replace(/^[a-zA-Z0-9._-]+:\/*/, '')
          }
        } catch {}
        if (!dest.startsWith('/')) dest = '/' + dest

        if (
          pathname === dest ||
          (pathname && dest.startsWith(pathname) && pathname !== '/agenda-digital/selecionar-aluno')
        ) {
          return
        }

        console.log(`🚀 [GlobalPush] Sessão hidratada! Navegando diretamente para rota pendente: ${dest}`)

        if (dest.includes('id=')) {
          const comId = dest.split('id=')[1]?.split('&')[0]
          if (comId) {
            setTimeout(() => {
              try {
                window.dispatchEvent(
                  new CustomEvent('ad:open-comunicado', { detail: { id: decodeURIComponent(comId) } })
                )
              } catch {}
            }, 300)
          }
        }

        if (typeof window !== 'undefined') {
          const curPath = window.location.pathname
          if (curPath === '/' || curPath.includes('/selecionar-aluno') || curPath === '/agenda-digital') {
            console.log(`🚀 [GlobalPush] Forçando navegação imediata via window.location: ${dest}`)
            window.location.href = dest
            return
          }
        }

        router.replace(dest)
      }
    }

    checkAndNavigatePendingRoute()
  }, [hydrated, currentUser?.id, pathname, router])

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
      if (typeof window !== 'undefined') {
        const curPath = window.location.pathname
        if (curPath === '/' || curPath.includes('/selecionar-aluno') || curPath === '/agenda-digital') {
          console.log(`[GlobalPush] Tela de seleção ou splash detectada. Forçando carregamento imediato: ${destination}`)
          window.location.href = destination
          return
        }
      }
      router.replace(destination)
    } else if (isHydrated) {
      console.log(`[GlobalPush] Usuário não logado. Redirecionando para login com redirect pendente.`)
      if (typeof window !== 'undefined') {
        window.location.href = `/login?redirect=${encodeURIComponent(destination)}`
        return
      }
      router.replace(`/login?redirect=${encodeURIComponent(destination)}`)
    } else {
      console.log(`[GlobalPush] App hidratando sessão no cold start. Rota salva: ${destination}`)
    }
  }

  // 1. Inicialização segura via NotificationService e listeners de clique IMEDIATOS
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      // REGISTRO IMEDIATO: não espera o initialize assíncrono para plugar o listener de clique!
      // Isso garante que cold-start taps enfileirados pelo OneSignal nativo sejam recebidos instantaneamente.
      import('@onesignal/capacitor-plugin')
        .then(({ default: OneSignalNative }) => {
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

          OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
            console.log('📱 [GlobalPush] Notificação recebida em foreground:', event)
            try {
              const notif = (typeof event?.getNotification === 'function' ? event.getNotification() : null) || event?.notification || event || {}
              const title = notif.title || 'Nova Notificação'
              const body = notif.body || ''
              const addData = notif.additionalData || {}
              const launchURL = notif.launchURL || addData.launchURL || addData.url || addData.targetUrl || ''
              const payloadData = {
                ...addData,
                launchURL,
                url: addData.url || addData.targetUrl || launchURL,
                targetUrl: addData.targetUrl || addData.url || launchURL,
              }

              showForegroundPushBanner({
                id: notif.notificationId || String(Date.now()),
                title,
                body,
                data: payloadData,
                time: 'Agora'
              })

              window.dispatchEvent(new CustomEvent('ad:push-foreground', { detail: event }))
            } catch (fgErr) {
              console.warn('[GlobalPush] Erro ao processar foreground notification:', fgErr)
            }
          })
        })
        .catch(err => {
          console.error('[GlobalPush] Erro ao registrar listeners de clique:', err)
        })

      // Listener para Deep Links via Capacitor App (esquemas customizados)
      import('@capacitor/app')
        .then(({ App }) => {
          App.addListener('appUrlOpen', (event: any) => {
            console.log('📱 [GlobalPush] appUrlOpen recebido:', event?.url)
            if (event?.url) {
              const raw = String(event.url).trim()
              const cleanPath = '/' + raw.replace(/^[a-zA-Z0-9._-]+:\/*/, '')
              if (cleanPath && cleanPath !== '/') {
                handlePushClick({ targetUrl: cleanPath })
              }
            }
          }).catch(() => {})
        })
        .catch(() => {})
    } else {
      // Web Push Click & Foreground Listener
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

          OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
            console.log('🌐 [WebPush] Notificação recebida em foreground:', event)
            try {
              const notif = event?.notification || {}
              showForegroundPushBanner({
                id: notif.notificationId || String(Date.now()),
                title: notif.title || 'Nova Notificação',
                body: notif.body || '',
                data: {
                  ...(notif.additionalData || {}),
                  launchURL: notif.launchURL,
                },
                time: 'Agora'
              })
            } catch {}
          })
        }
      })
    }

    // Inicialização segura do serviço em segundo plano (sem solicitar permissões fora da Agenda Digital)
    notificationService.initialize().catch(err => {
      console.warn('[GlobalPush] Aviso na inicialização do serviço:', err)
    })
  }, [showForegroundPushBanner])

  // 2. Gerenciamento Global de Usuário no OneSignal via NotificationService
  useEffect(() => {
    if (typeof window === 'undefined') return

    // CRÍTICO: NUNCA deslogar ou sincronizar antes de a sessão estar completamente hidratada do armazenamento local!
    // Sem essa verificação, no startup currentUser é temporariamente null e disparava OneSignal.logout(),
    // desconectando o aparelho do usuário no OneSignal em todo início ou reinício do app.
    if (!hydrated) return

    if (currentUser?.id) {
      wasLoggedInRef.current = true
      // Sincroniza imediatamente sem debounce (a serialização interna do notificationService
      // já impede corridas, garantindo que navegações rápidas não cancelem a sincronização).
      notificationService.syncUser(currentUser).catch(err => {
        console.warn('[GlobalPush] Aviso na sincronização do usuário:', err)
      })

      // Retry de segurança após 3 segundos para garantir que tokens assíncronos do APNs sejam vinculados
      const retryTimer = setTimeout(() => {
        notificationService.syncUser(currentUser).catch(() => {})
      }, 3000)

      return () => clearTimeout(retryTimer)
    } else if (wasLoggedInRef.current) {
      // Apenas executa clearUser se o usuário estava anteriormente logado nesta sessão e deslogou.
      // Isso evita que visitantes ou usuários recém-abertos no /login fiquem limpando em loop.
      wasLoggedInRef.current = false
      notificationService.clearUser().catch(err => {
        console.warn('[GlobalPush] Aviso no logout do usuário:', err)
      })
    }
  }, [hydrated, currentUser?.id, currentUser?.perfil, currentUser?.cargo])

  return (
    <>
      {activeBanner && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999999,
            pointerEvents: 'none',
            padding: '0 14px',
            animation: isDismissing
              ? 'pushBannerSlideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards'
              : 'pushBannerSlideDown 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div
            onClick={() => {
              dismissBanner()
              handlePushClick(activeBanner.data)
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseEnter={() => {
              if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
            }}
            onMouseLeave={() => {
              if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
              dismissTimerRef.current = setTimeout(dismissBanner, 4000)
            }}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: 440,
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: 18,
              padding: '12px 14px',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              cursor: 'pointer',
              userSelect: 'none',
              touchAction: 'pan-y',
            }}
          >
            {/* Header da notificação: Ícone + App Nome + Hora + Botão Fechar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <img
                  src="/logo-impacto.png"
                  alt="Impacto EDU"
                  width={20}
                  height={20}
                  style={{ borderRadius: 5, objectFit: 'contain' }}
                  onError={(e: any) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Impacto EDU
                </span>
                <span style={{ fontSize: 10, color: '#64748b' }}>•</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                  {activeBanner.time || 'Agora'}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  dismissBanner()
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s, color 0.2s',
                }}
                title="Fechar"
              >
                <X size={13} />
              </button>
            </div>

            {/* Conteúdo: Título e Mensagem */}
            <div style={{ paddingLeft: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3, marginBottom: 2 }}>
                {activeBanner.title}
              </div>
              {activeBanner.body && (
                <div style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#cbd5e1',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {activeBanner.body}
                </div>
              )}
            </div>

            {/* Barra indicadora inferior sutil para arrastar ou tocar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Injeção de keyframes para animações fluidas */}
      <style jsx global>{`
        @keyframes pushBannerSlideDown {
          0% {
            transform: translateY(-120%) scale(0.95);
            opacity: 0;
          }
          60% {
            transform: translateY(4px) scale(1.01);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes pushBannerSlideUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-120%) scale(0.95);
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}

