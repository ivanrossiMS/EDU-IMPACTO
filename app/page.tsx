'use client'

import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { hideSplashScreen } from '@/lib/capacitor/splash'
import { PENDING_PUSH_ROUTE_KEY } from '@/components/providers/GlobalNotificationProvider'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { AppLoadingScreen } from '@/components/AppLoadingScreen'
import { useIsMobileVersion } from '@/lib/utils/isMobileVersion'
import { startupDiagnostics } from '@/lib/diagnostics/startupDiagnostics'
import {
  isFamilyOrStudent,
  getAgendaDigitalDestination,
  getInitialRouteForUser,
  fetchPerfisWithCache
} from '@/lib/auth/moduleRouting'

function RootInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, hydrated } = useApp()
  const isMobile = useIsMobileVersion()

  const [targetRoute, setTargetRoute] = useState<string | null>(null)
  const [showEmergencyRecovery, setShowEmergencyRecovery] = useState(false)
  const isRedirectingRef = useRef(false)

  const isDemoMode = searchParams?.get('demo') === 'true'

  // 1. Libera a splash screen nativa para exibir a tela cinematográfica web
  useEffect(() => {
    startupDiagnostics.recordMilestone('root_page_mount')
    hideSplashScreen(150)
  }, [])

  // Executa o redirecionamento com segurança garantindo que só ocorra uma vez
  const handleTransitionComplete = useCallback(() => {
    if (isRedirectingRef.current || !targetRoute) return
    isRedirectingRef.current = true

    startupDiagnostics.markUsable(targetRoute)

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('edu_splash_shown', '1')
        ;(window as any).__EDU_SPLASH_SHOWN__ = true
      } catch (_) {}
    }
    router.replace(targetRoute)
  }, [targetRoute, router])

  // 2. Gerenciamento do ciclo de resolução da sessão e cálculo da rota de destino
  useEffect(() => {
    if (isDemoMode) return

    // Escuta evento de navegação por push disparado pelo OneSignal durante o cold start
    const handlePushEvent = (e: any) => {
      const dest = e?.detail?.destination
      if (dest) {
        startupDiagnostics.recordMilestone('push_event_received_cold_start', { dest })
        console.log('[Root] Evento edu:navigate-push recebido em cold start:', dest)
        isRedirectingRef.current = false
        setTargetRoute(dest)
        router.replace(dest)
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
      startupDiagnostics.recordMilestone('resolve_destination_start', { hasUser: Boolean(currentUser) })

      // Se estiver em ambiente nativo, concede janela de espera ativa (até 800ms)
      // para o OneSignal descarregar o clique de notificação em cold start
      let pendingPushRoute: string | null = null
      if (typeof window !== 'undefined') {
        try {
          pendingPushRoute = (window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY)
        } catch {}
      }

      if (!pendingPushRoute && Capacitor.isNativePlatform()) {
        for (let i = 0; i < 8; i++) {
          if (!isSubscribed) return
          await new Promise(r => setTimeout(r, 100))
          try {
            pendingPushRoute = (window as any).__EDU_PENDING_PUSH_ROUTE__ || localStorage.getItem(PENDING_PUSH_ROUTE_KEY)
            if (pendingPushRoute) break
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
        let cleanDest = pendingPushRoute.trim()
        if (cleanDest.startsWith('http://') || cleanDest.startsWith('https://')) {
          try {
            const p = new URL(cleanDest)
            cleanDest = p.pathname + p.search
          } catch {}
        }
        if (currentUser) {
          startupDiagnostics.recordMilestone('resolved_to_pending_push', { cleanDest })
          setTargetRoute(cleanDest)
          if (typeof window !== 'undefined') {
            try {
              delete (window as any).__EDU_PENDING_PUSH_ROUTE__
              localStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
              if (Capacitor.isNativePlatform()) {
                Preferences.remove({ key: PENDING_PUSH_ROUTE_KEY }).catch(() => {})
              }
            } catch {}
          }
          router.replace(cleanDest)
          return
        } else {
          setTargetRoute(`/login?redirect=${encodeURIComponent(cleanDest)}`)
          return
        }
      }

      // Se nenhum usuário estiver logado, direciona para o login
      if (!currentUser) {
        startupDiagnostics.recordMilestone('resolved_to_login')
        setTargetRoute('/login')
        return
      }

      // 1. Família / Aluno / Responsável têm exclusivamente acesso à Agenda Digital
      if (isFamilyOrStudent(currentUser)) {
        const dest = getAgendaDigitalDestination(currentUser)
        startupDiagnostics.recordMilestone('resolved_to_agenda_family', { dest })
        setTargetRoute(dest)
        return
      }

      // 2. Colaborador / Administrador / Professor / etc.
      let userPerfilObj: any = null
      try {
        const perfisList = await fetchPerfisWithCache(1200)
        if (!isSubscribed) return
        const targetPerfilName = currentUser.perfil || currentUser.cargo || ''
        userPerfilObj = (perfisList || []).find(p => p.nome === targetPerfilName) || null
      } catch (err) {
        startupDiagnostics.recordError('perfis_resolve_root', err)
        console.warn('[Root] Falha ao resolver perfil com cache:', err)
      }

      if (!isSubscribed) return

      // Determina a rota correta do perfil
      const initialRoute = getInitialRouteForUser(currentUser, userPerfilObj)
      startupDiagnostics.recordMilestone('resolved_to_profile_route', { initialRoute })
      console.log('[Root] Rota inicial resolvida para o perfil:', initialRoute)
      setTargetRoute(initialRoute)
    }

    resolveDestination().catch(err => {
      startupDiagnostics.recordError('resolve_destination_exception', err)
      console.error('[Root] Erro inesperado ao resolver destino:', err)
      // Em caso de falha grave, fallback seguro para o login
      if (isSubscribed) {
        setTargetRoute('/login')
      }
    })

    return () => {
      isSubscribed = false
      window.removeEventListener('edu:navigate-push', handlePushEvent)
    }
  }, [hydrated, currentUser, isDemoMode, router])

  // 3. Failsafe Mestre 1: Se após 4.2s nenhuma rota foi determinada (ex: lentidão de storage/rede),
  // calcula rota de emergência para NUNCA travar a tela
  useEffect(() => {
    if (targetRoute || isDemoMode) return

    const masterTimeout = setTimeout(() => {
      if (!targetRoute) {
        startupDiagnostics.recordMilestone('master_failsafe_timeout_triggered')
        console.warn('[Root] Failsafe acionado: calculando rota de contingência...')
        if (currentUser) {
          if (isFamilyOrStudent(currentUser)) {
            setTargetRoute(getAgendaDigitalDestination(currentUser))
          } else {
            setTargetRoute('/login?step=choose_system')
          }
        } else {
          setTargetRoute('/login')
        }
      }
    }, 4200)

    return () => clearTimeout(masterTimeout)
  }, [targetRoute, currentUser, isDemoMode])

  // 4. Failsafe Mestre 2: Se após 7s a transição ainda não tiver sido concluída, exibe tela de contingência
  useEffect(() => {
    if (isDemoMode) return
    const recoveryTimer = setTimeout(() => {
      if (!isRedirectingRef.current) {
        startupDiagnostics.recordMilestone('emergency_recovery_ui_displayed')
        setShowEmergencyRecovery(true)
      }
    }, 7000)

    return () => clearTimeout(recoveryTimer)
  }, [isDemoMode])

  // No desktop (fora do modo demo), executa redirecionamento imediato sem aguardar animação da splash
  useEffect(() => {
    if (!isMobile && !isDemoMode && targetRoute) {
      handleTransitionComplete()
    }
  }, [isMobile, isDemoMode, targetRoute, handleTransitionComplete])

  // Fallback de segurança: se a rota foi calculada mas por qualquer motivo a animação
  // demorar mais de 3.5s para chamar o callback, executa o redirecionamento forçado
  useEffect(() => {
    if (!targetRoute) return
    const fallbackTimer = setTimeout(() => {
      handleTransitionComplete()
    }, 3500)
    return () => clearTimeout(fallbackTimer)
  }, [targetRoute, handleTransitionComplete])

  // Fallback de segurança para liberar a splash screen nativa do Capacitor em caso extremo
  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen(300)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  // ── Tela de Contingência contra Tela Branca (exibida se ultrapassar 7s de bloqueio) ──
  if (showEmergencyRecovery) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0A0F24',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 999999999,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 36, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '36px 24px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Abertura em Andamento
          </h2>

          <p style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.6, margin: '0 0 24px' }}>
            A conexão com o servidor está levando mais tempo que o esperado. Deseja tentar novamente ou acessar diretamente?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => {
                setShowEmergencyRecovery(false)
                isRedirectingRef.current = false
                if (targetRoute) {
                  router.replace(targetRoute)
                } else if (currentUser) {
                  router.replace(isFamilyOrStudent(currentUser) ? getAgendaDigitalDestination(currentUser) : '/login?step=choose_system')
                } else {
                  router.replace('/login')
                }
              }}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
              }}
            >
              Continuar para o Sistema
            </button>

            <button
              onClick={() => {
                router.replace('/login')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ir para o Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No desktop fora do modo demo: exibe shell escuro com spinner moderno em vez de retornar null (evitando tela branca)
  if (!isMobile && !isDemoMode) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0A0F24',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          color: '#ffffff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#3b82f6',
            animation: 'spinDesktop 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <style>{`@keyframes spinDesktop { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <AppLoadingScreen
      mode={isDemoMode ? 'demo' : 'app'}
      isReady={!!targetRoute}
      onReadyComplete={handleTransitionComplete}
    />
  )
}

// Export default envolve RootInner em Suspense com fallback escuro garantido.
export default function Root() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#0A0F24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        />
      }
    >
      <RootInner />
    </Suspense>
  )
}
