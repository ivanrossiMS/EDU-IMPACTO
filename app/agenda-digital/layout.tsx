'use client'
// Layout da Agenda Digital com Sidebar Moderna

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { SaidaProvider } from '@/lib/saidaContext'
import { AgendaDigitalProvider, useAgendaDigital } from '@/lib/agendaDigitalContext'
import { DataProvider } from '@/lib/dataContext'
import { FormulariosProvider } from '@/lib/formulariosContext'
import { RelatoriosProvider } from '@/lib/relatoriosContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useRouter, usePathname } from 'next/navigation'
import { ADSidebar } from './components/Sidebar'
import { FloatingWhatsApp } from '@/components/FloatingWhatsApp'
import { AgendaRealtimeProvider } from './components/AgendaRealtimeProvider'
import { Loader2 } from 'lucide-react'
import { hideSplashScreen } from '@/lib/capacitor/splash'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { useIsFetching } from '@tanstack/react-query'



export default function AgendaDigitalLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  if (!hydrated) {
    return <AgendaLuxuryLoader isLoading={true} statusText="Iniciando Agenda Digital..." />
  }

  // Família não precisa carregar os dados massivos globais do ERP
  if (isFamily) {
    return (
      <FormulariosProvider>
        <SaidaProvider enabled={true}>
          <AgendaDigitalProvider isFamily={isFamily}>
            <AgendaDigitalLayoutInner>
              {children}
            </AgendaDigitalLayoutInner>
          </AgendaDigitalProvider>
        </SaidaProvider>
      </FormulariosProvider>
    )
  }

  return (
    <DataProvider>
      <FormulariosProvider>
        <RelatoriosProvider>
          <SaidaProvider enabled={true}>
            <AgendaDigitalProvider isFamily={isFamily}>
              <AgendaDigitalLayoutInner>
                {children}
              </AgendaDigitalLayoutInner>
            </AgendaDigitalProvider>
          </SaidaProvider>
        </RelatoriosProvider>
      </FormulariosProvider>
    </DataProvider>
  )
}

function AgendaDigitalLayoutInner({ children }: { children: React.ReactNode }) {
  const { bannerUrl, adLoading, isLoaded, pageLoading, pageLoadingLabel } = useAgendaDigital()
  const isFetchingQueries = useIsFetching({ queryKey: ['agenda'] })
  const { currentUser, hydrated, loadingPath, setLoadingPath } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)

  // 'checking' = aguardando dados reais do Supabase
  // 'allowed'  = usuário tem acesso
  // 'denied'   = usuário não tem acesso
  const [accessState, setAccessState] = React.useState<'checking' | 'allowed' | 'denied'>('checking')

  const [routeNavigating, setRouteNavigating] = React.useState(false)
  const [navTargetLabel, setNavTargetLabel] = React.useState('Carregando página e dados...')
  const targetPathRef = React.useRef<string | null>(null)
  const currentPathRef = React.useRef(pathname)
  const [initialReady, setInitialReady] = React.useState(false)

  const isSelectStudent = pathname?.includes('/agenda-digital/selecionar-aluno') || pathname?.includes('/agenda-digital/selecionar-perfil-admin')
  const isIndexPage = pathname === '/agenda-digital'
  const isRouterPage = isSelectStudent || isIndexPage

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    setLoadingPath(null)
  }, [pathname, setLoadingPath])

  // 1. Interceptar cliques em links da Agenda Digital para saltar o loader na tela imediatamente (0ms de latência)
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (
        anchor.target === '_blank' ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return
      }

      if (href.startsWith('/agenda-digital')) {
        const currentPath = window.location.pathname
        let url: URL
        try {
          url = new URL(href, window.location.origin)
        } catch {
          return
        }

        if (url.pathname !== currentPath) {
          targetPathRef.current = url.pathname
          setRouteNavigating(true)

          if (href.includes('comunicados')) setNavTargetLabel('Carregando comunicados...')
          else if (href.includes('momentos')) setNavTargetLabel('Carregando galeria e mídia...')
          else if (href.includes('calendario')) setNavTargetLabel('Carregando calendário escolar...')
          else if (href.includes('financeiro')) setNavTargetLabel('Carregando dados financeiros...')
          else if (href.includes('frequencia')) setNavTargetLabel('Carregando frequência...')
          else if (href.includes('notas')) setNavTargetLabel('Carregando boletim escolar...')
          else if (href.includes('ocorrencias')) setNavTargetLabel('Carregando ocorrências...')
          else if (href.includes('turmas')) setNavTargetLabel('Carregando turmas e alunos...')
          else if (href.includes('pessoas')) setNavTargetLabel('Carregando usuários...')
          else if (href.includes('cobrancas')) setNavTargetLabel('Carregando cobranças...')
          else if (href.includes('relatorios')) setNavTargetLabel('Carregando relatórios...')
          else if (href.includes('ajustes')) setNavTargetLabel('Carregando configurações...')
          else setNavTargetLabel('Carregando página e dados...')
        }
      }
    }

    const handlePopState = () => {
      setRouteNavigating(true)
      setNavTargetLabel('Carregando página e dados...')
    }

    document.addEventListener('click', handleGlobalClick, true)
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.removeEventListener('click', handleGlobalClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // 2. Transição ao trocar pathname
  React.useEffect(() => {
    if (currentPathRef.current !== pathname) {
      currentPathRef.current = pathname
      setRouteNavigating(true)
      targetPathRef.current = null

      const timer = setTimeout(() => {
        setRouteNavigating(false)
      }, 650)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // 3. Monitor de prontidão inicial
  React.useEffect(() => {
    if (accessState === 'allowed' && hydrated && mounted) {
      const timer = setTimeout(() => {
        setInitialReady(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [accessState, hydrated, mounted])

  // 4. Resolver routeNavigating quando estabilizar
  React.useEffect(() => {
    if (routeNavigating && !targetPathRef.current && isFetchingQueries === 0) {
      const settleTimer = setTimeout(() => {
        setRouteNavigating(false)
      }, 450)
      return () => clearTimeout(settleTimer)
    }
  }, [routeNavigating, isFetchingQueries])

  // 5. Failsafe de segurança: nunca trava a tela por mais de 6.5s
  React.useEffect(() => {
    if (routeNavigating) {
      const emergencyDismiss = setTimeout(() => {
        setRouteNavigating(false)
        targetPathRef.current = null
      }, 6500)
      return () => clearTimeout(emergencyDismiss)
    }
  }, [routeNavigating])

  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  // Verificação de acesso via useEffect — NUNCA durante render síncrono
  // Isso elimina o flash de "Acesso Negado" para usuários com permissão
  React.useEffect(() => {
    if (!hydrated) return

    const emergencyTimer = setTimeout(() => {
      setAccessState(prev => {
        if (prev !== 'checking') return prev
        return 'allowed'
      })
    }, 1500)

    if (!currentUser) {
      clearTimeout(emergencyTimer)
      router.replace('/login')
      return
    }

    // Alunos/familiares só têm acesso a rotas comuns da agenda. Bloqueia se for /colaborador ou /admin.
    if (isFamily) {
      if (pathname?.includes('/agenda-digital/colaborador') || pathname?.includes('/agenda-digital/admin')) {
        setAccessState('denied')
      } else {
        setAccessState('allowed')
      }
      clearTimeout(emergencyTimer)
      return
    }

    // Páginas de seleção de perfil ou aluno nunca devem ser bloqueadas
    if (isRouterPage) {
      setAccessState('allowed')
      clearTimeout(emergencyTimer)
      return
    }

    if (perfisLoading) return

    // Encontrar o perfil real do usuário na lista do Supabase
    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)

    // Se o perfil não foi encontrado na lista, por padrão libera para funcionários internos
    const hasAccess = userPerfilObj ? !userPerfilObj.bloqueadoAgendaDigital : true
    setAccessState(hasAccess ? 'allowed' : 'denied')

    clearTimeout(emergencyTimer)
    return () => clearTimeout(emergencyTimer)
  }, [hydrated, currentUser, isFamily, pathname, perfisLoading, perfis])

  React.useEffect(() => {
    if (accessState === 'allowed') {
      hideSplashScreen(300)
    }
  }, [accessState])

  // Acesso negado — somente após verificação completa com dados reais
  if (accessState === 'denied') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #08101e 0%, #090d1f 50%, #0a0e1c 100%)',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase' }}>ERRO 403 · ACESSO RESTRITO</p>
        <h1 style={{ fontSize: 32, fontWeight: 200, color: 'white', margin: 0 }}>Acesso Negado</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 400, margin: 0 }}>A Agenda Digital foi restrita para o seu perfil. Consulte o Diretor Geral.</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '12px 28px', background: 'rgba(59,130,246,0.9)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Voltar ao Hub
        </button>
      </div>
    )
  }

  const isMasterLoading =
    !mounted ||
    !hydrated ||
    accessState === 'checking' ||
    !initialReady ||
    routeNavigating ||
    Boolean(pageLoading) ||
    Boolean(adLoading)

  const currentStatusText =
    !hydrated || !mounted ? 'Iniciando Agenda Digital...' :
    accessState === 'checking' ? 'Verificando permissões e dados...' :
    pageLoading && pageLoadingLabel ? pageLoadingLabel :
    routeNavigating ? navTargetLabel :
    'Carregando página e dados...'

  return (
    <>

      <div className="agenda-digital-wrapper ad-mesh-bg" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --ad-bg-mesh: radial-gradient(ellipse at top right, rgba(216, 180, 254, 0.45) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(186, 230, 253, 0.45) 0%, transparent 70%);
            --ad-bg-color: #ffffff;
          }
          .ad-mesh-bg {
            background-color: var(--ad-bg-color) !important;
            background-image: var(--ad-bg-mesh) !important;
            background-attachment: fixed !important;
          }
          
          /* Esconde a interface do ERP */
          .sidebar { display: none !important; }
          .topbar { display: none !important; }
          .main-content { padding-left: 0 !important; }
          
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          .ad-main-scroll {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            background: transparent;
          }

          .ad-content-inner {
            padding: 32px;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            position: relative;
            z-index: 10;
          }

          .ad-banner-global {
            width: 100%;
            position: relative;
            display: block;
            flex-shrink: 0;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
            overflow: hidden;
            aspect-ratio: 1600 / 400;
            min-height: 110px;
            max-height: 360px;
          }

          .ad-banner-global img,
          .ad-banner-img {
            display: block;
            width: 100%;
            height: 100%;
            aspect-ratio: 1600 / 400;
            min-height: 110px;
            max-height: 360px;
            object-fit: cover;
            margin: 0;
            transform: translateZ(0);
            backface-visibility: hidden;
          }

          .ad-banner-skeleton {
            background: linear-gradient(90deg, rgba(226, 232, 240, 0.4) 0%, rgba(241, 245, 249, 0.8) 50%, rgba(226, 232, 240, 0.4) 100%);
            background-size: 200% 100%;
            animation: adBannerShimmer 1.5s infinite ease-in-out;
          }

          @keyframes adBannerShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }

          .ad-content-inner.ad-has-banner {
            margin-top: 0px;
            padding-top: 0px !important;
          }


          @media (max-width: 1024px) {
            /* .ad-sidebar-container handled by component logic */
          }
          
          @media (max-width: 768px) {
            .ad-banner-global {
              position: relative !important;
              width: 100% !important;
              height: auto !important;
              aspect-ratio: 1600 / 400 !important;
              min-height: 105px !important;
              max-height: 260px !important;
              background: transparent;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }
            .ad-banner-global img,
            .ad-banner-img {
              display: block !important;
              width: 100% !important;
              height: 100% !important;
              aspect-ratio: 1600 / 400 !important;
              min-height: 105px !important;
              max-height: 260px !important;
              object-fit: cover !important;
              margin: 0 !important;
            }

            .ad-content-inner {
              padding: 16px !important;
              padding-top: calc(16px + env(safe-area-inset-top, 0px)) !important;
              padding-bottom: 100px !important;
            }
            .ad-content-inner.ad-has-banner {
              margin-top: 0px !important;
              padding-top: 0px !important;
            }
          }
        `}} />
        
        {!isRouterPage && (
          <div className="ad-sidebar-container">
            <ADSidebar />
          </div>
        )}

        <div className="ad-main-scroll no-scrollbar">
          {bannerUrl ? (
            <div className="ad-banner-global">
              <img 
                src={bannerUrl} 
                alt="Cover Banner" 
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="ad-banner-img"
              />
            </div>
          ) : !isLoaded ? (
            <div className="ad-banner-global ad-banner-skeleton" />
          ) : null}

          <main className={`ad-content-inner ${bannerUrl || !isLoaded ? 'ad-has-banner' : ''}`}>
            {children}
          </main>

        </div>
        
        <FloatingWhatsApp />
        <AgendaRealtimeProvider />
        <AgendaLuxuryLoader isLoading={isMasterLoading} statusText={currentStatusText} />
      </div>
    </>
  )
}
