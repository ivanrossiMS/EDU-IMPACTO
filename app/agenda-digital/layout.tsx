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
import { FloatingChat } from '@/components/chat/FloatingChat'
import { AgendaRealtimeProvider } from './components/AgendaRealtimeProvider'
import { AgendaPullToRefresh } from './components/AgendaPullToRefresh'
import { Loader2 } from 'lucide-react'
import { hideSplashScreen } from '@/lib/capacitor/splash'
import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { isGlobalNavOverlayActive } from '@/lib/navigation/pageReadiness'



export default function AgendaDigitalLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated, loadingPath, moduleTransition } = useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  if (!hydrated && loadingPath !== 'logout' && !moduleTransition) {
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
  const { bannerUrl, adLoading, isLoaded, pageLoading, pageLoadingLabel, adConfig } = useAgendaDigital()
  const { currentUser, hydrated, loadingPath, setLoadingPath, moduleTransition } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const mainScrollRef = React.useRef<HTMLDivElement>(null)

  // 'checking' = aguardando dados reais do Supabase
  // 'allowed'  = usuário tem acesso
  // 'denied'   = usuário não tem acesso
  const [accessState, setAccessState] = React.useState<'checking' | 'allowed' | 'denied'>('checking')
  const [initialReady, setInitialReady] = React.useState(false)

  const isSelectStudent = pathname?.includes('/agenda-digital/selecionar-aluno') || pathname?.includes('/agenda-digital/selecionar-perfil-admin')
  const isIndexPage = pathname === '/agenda-digital'
  const isRouterPage = isSelectStudent || isIndexPage

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (loadingPath !== 'logout') {
      setLoadingPath(null)
    }
  }, [pathname, loadingPath, setLoadingPath])

  // Monitor de prontidão inicial (sem delay artificial de 350ms)
  React.useEffect(() => {
    if (accessState === 'allowed' && hydrated && mounted) {
      setInitialReady(true)
    }
  }, [accessState, hydrated, mounted])

  // Failsafe de segurança para o boot inicial: nunca trava a abertura inicial por mais de 6s
  const [bootFailsafeReached, setBootFailsafeReached] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setBootFailsafeReached(true)
      setInitialReady(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

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
      if (loadingPath !== 'logout') {
        router.replace('/login')
      }
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

    // Se perfis ainda está carregando na rede, libera imediatamente para colaboradores autenticados
    // e reavalia assim que a lista de perfis chegar (evitando segurar o loader de tela cheia)
    if (perfisLoading && (!perfis || perfis.length === 0)) {
      setAccessState('allowed')
      clearTimeout(emergencyTimer)
      return
    }

    // Encontrar o perfil real do usuário na lista do Supabase
    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)

    // Se o perfil não foi encontrado na lista, por padrão libera para funcionários internos
    const hasAccess = userPerfilObj ? !userPerfilObj.bloqueadoAgendaDigital : true
    setAccessState(hasAccess ? 'allowed' : 'denied')

    clearTimeout(emergencyTimer)
    return () => clearTimeout(emergencyTimer)
  }, [hydrated, currentUser, isFamily, pathname, perfisLoading, perfis, loadingPath])

  React.useEffect(() => {
    if (accessState === 'allowed' || bootFailsafeReached) {
      hideSplashScreen(300)
    }
  }, [accessState, bootFailsafeReached])

  // Acesso negado — somente após verificação completa com dados reais
  if (accessState === 'denied' && loadingPath !== 'logout') {
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

  const isInitialBootLoading = !bootFailsafeReached && (
    !mounted ||
    !hydrated ||
    accessState === 'checking' ||
    !initialReady
  )

  const isMasterLoading =
    loadingPath !== 'logout' &&
    !isGlobalNavOverlayActive() && (
      isInitialBootLoading ||
      Boolean(pageLoading) ||
      Boolean(adLoading)
    )

  const currentStatusText =
    !hydrated || !mounted ? 'Iniciando Agenda Digital...' :
    accessState === 'checking' ? 'Verificando permissões e dados...' :
    pageLoading && pageLoadingLabel ? pageLoadingLabel :
    'Carregando página e dados...'

  const personalizacao = (adConfig as any)?.personalizacao || {}
  const temaMesh = personalizacao.temaMesh || 'padrao'
  const corPrimaria = personalizacao.corPrimaria || '#4f46e5'
  const exibirBanner = personalizacao.exibirBanner !== false
  const ajusteBanner = personalizacao.ajusteBanner || 'cover'
  const alturaBanner = personalizacao.alturaBanner || 'padrao'
  const bannerMaxHeightDesktop = alturaBanner === 'compacto' ? '240px' : alturaBanner === 'expandido' ? '440px' : '360px'

  const meshMap: Record<string, string> = {
    padrao: 'radial-gradient(ellipse at top right, rgba(216, 180, 254, 0.45) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(186, 230, 253, 0.45) 0%, transparent 70%)',
    oceano: 'radial-gradient(ellipse at top right, rgba(147, 197, 253, 0.48) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(103, 232, 249, 0.42) 0%, transparent 70%)',
    esmeralda: 'radial-gradient(ellipse at top right, rgba(110, 231, 183, 0.42) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(153, 246, 228, 0.42) 0%, transparent 70%)',
    cosmos: 'radial-gradient(ellipse at top right, rgba(196, 181, 253, 0.5) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(249, 168, 212, 0.42) 0%, transparent 70%)',
    solar: 'radial-gradient(ellipse at top right, rgba(253, 230, 138, 0.48) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(254, 215, 170, 0.45) 0%, transparent 70%)',
    neutro: 'radial-gradient(ellipse at top right, rgba(226, 232, 240, 0.65) 0%, transparent 70%), radial-gradient(ellipse at bottom left, rgba(241, 245, 249, 0.65) 0%, transparent 70%)'
  }
  const activeMesh = meshMap[temaMesh] || meshMap.padrao

  return (
    <>

      <div className="agenda-digital-wrapper ad-mesh-bg" style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --ad-bg-mesh: ${activeMesh};
            --ad-bg-color: #ffffff;
            --ad-accent-primary: ${corPrimaria};
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

          .ad-mobile-status-bar {
            display: none;
          }

          .ad-main-scroll {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            overscroll-behavior-y: contain;
            position: relative;
            background: transparent;
            min-width: 0;
            width: 100%;
          }

          .ad-content-inner {
            padding: 32px;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            position: relative;
            z-index: 10;
            box-sizing: border-box;
            min-width: 0;
          }

          .ad-banner-global {
            width: 100%;
            position: relative;
            display: block;
            flex-shrink: 0;
            background: #0A0F24;
            overflow: hidden;
            aspect-ratio: 1600 / 400;
            min-height: 110px;
            max-height: ${bannerMaxHeightDesktop};
          }

          .ad-banner-global img,
          .ad-banner-img {
            display: block;
            width: 100%;
            height: 100%;
            aspect-ratio: 1600 / 400;
            min-height: 110px;
            max-height: ${bannerMaxHeightDesktop};
            object-fit: ${ajusteBanner};
            margin: 0;
            transform: translateZ(0);
            backface-visibility: hidden;
          }

          .ad-banner-skeleton {
            background: linear-gradient(90deg, #090e24 0%, #151e3f 50%, #090e24 100%) !important;
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
            .ad-mobile-status-bar {
              display: block;
              position: sticky;
              top: 0;
              left: 0;
              right: 0;
              width: 100%;
              height: env(safe-area-inset-top, 0px);
              min-height: env(safe-area-inset-top, 0px);
              background: #0A0F24 !important;
              z-index: 100;
              flex-shrink: 0;
            }

            .ad-banner-global {
              position: relative !important;
              width: 100% !important;
              height: auto !important;
              aspect-ratio: 1600 / 400 !important;
              min-height: 105px !important;
              max-height: 260px !important;
              background: #0A0F24 !important;
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
              object-fit: ${ajusteBanner} !important;
              margin: 0 !important;
            }

            .ad-content-inner {
              padding: 16px !important;
              padding-top: 16px !important;
              padding-bottom: 100px !important;
              box-sizing: border-box !important;
              max-width: 100% !important;
              min-width: 0 !important;
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

        <div ref={mainScrollRef} className="ad-main-scroll no-scrollbar">
          <div className="ad-mobile-status-bar" />
          <AgendaPullToRefresh scrollContainerRef={mainScrollRef} />
          {exibirBanner && bannerUrl ? (
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
          ) : exibirBanner && !isLoaded ? (
            <div className="ad-banner-global ad-banner-skeleton" />
          ) : null}

          <main className={`ad-content-inner ${exibirBanner && (bannerUrl || !isLoaded) ? 'ad-has-banner' : ''}`}>
            {children}
          </main>

        </div>
        
        <FloatingChat />
        <AgendaRealtimeProvider />
        <AgendaLuxuryLoader isLoading={isMasterLoading && !moduleTransition} statusText={currentStatusText} />
      </div>
    </>
  )
}
