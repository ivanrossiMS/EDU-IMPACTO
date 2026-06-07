'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { RouteGuard } from '@/components/layout/RouteGuard'
import { useApp } from '@/lib/context'
import { DataProvider } from '@/lib/dataContext'
import { DialogProvider } from '@/lib/dialogContext'
import { AgendaDigitalProvider } from '@/lib/agendaDigitalContext'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WebVitalsReporter } from '@/lib/webVitals'

import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { Menu } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, toggleSidebar, setCurrentUser, currentUser } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()

  // 4 estados de auth: 'checking' | 'authorized' | 'unauthorized' | 'blocked'
  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'unauthorized' | 'blocked'>('checking')

  // EFFECT 1: Check Auth On Mount ONLY — SECURE VERSION
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store', credentials: 'include',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })

        // ✅ CORREÇÃO DE SEGURANÇA: Qualquer falha → redirecionar para login
        // Antes: erros de rede/4xx resultavam em setAuthState('authorized')
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            // Sessão inválida ou expirada — ir para login
            router.replace('/login')
            return
          }
          // Erro de servidor (5xx) — pode ser temporário, mostrar erro mas não autorizar
          setAuthState('unauthorized')
          router.replace('/login')
          return
        }

        const data = await res.json()
        const serverUser: any = data.user

        if (!serverUser) {
          // Resposta 200 mas sem usuário — sessão incoerente
          router.replace('/login')
          return
        }

        if (serverUser.status === 'inativo' || serverUser.status === 'bloqueado') {
          setCurrentUser(serverUser)
          setAuthState('blocked')
          return
        }

        setCurrentUser(serverUser)
        setAuthState('authorized')
      } catch (err) {
        // ✅ CORREÇÃO DE SEGURANÇA: Erro de rede → ir para login (não autorizar)
        // Antes: erro resultava em setAuthState('authorized')
        console.warn('[Auth] Network error checking session, redirecting to login.')
        router.replace('/login')
      }
    }

    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Runs ONLY on mount

  // (EFFECT 2 removido: a pedido do usuário, a navegação agora é estritamente manual via cliques no menu)

  // Enquanto verifica auth, renderiza o shell do layout com conteúdo mascarado.
  // Isso elimina o flash de tela em branco: a sidebar, topbar e estrutura ficam visíveis
  // imediatamente enquanto o fetch de auth ocorre em paralelo (~100ms).
  if (authState === 'checking') {
    return (
      <div className="app-wrapper" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {/* Sidebar fantasma com shimmer */}
        <div
          className="sidebar"
          style={{
            background: 'hsl(var(--bg-sidebar, 220 25% 9%))',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '20px 12px',
          }}
        >
          {/* Logo placeholder */}
          <div style={{ height: 52, marginBottom: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
          {/* Nav items */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 40,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                opacity: 1 - i * 0.08
              }}
            />
          ))}
        </div>

        <div className={`main-content ${sidebarCollapsed && !isMobile ? 'sidebar-collapsed' : ''}`}>
          {/* Mobile Top Bar (Checking Auth state) */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 16px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
            </div>
          )}
          {/* Conteúdo — spinner minimalista centrado */}
          <main className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: '3px solid rgba(255,255,255,0.08)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </main>
        </div>
      </div>
    )
  }

  if (authState === 'blocked') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {/* Background Effects */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '80vw', height: '80vw', maxWidth: 800, maxHeight: 800,
          background: 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 60%)',
          filter: 'blur(60px)', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px', zIndex: 0, opacity: 0.5
        }} />

        {/* Modal Content */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(17, 24, 39, 0.7)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: 24, padding: '48px 40px',
          maxWidth: 480, width: '90%', textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(220, 38, 38, 0.1)',
          animation: 'modalSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{
            width: 80, height: 80, margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(153,27,27,0.2) 100%)',
            border: '1px solid rgba(220,38,38,0.4)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(220,38,38,0.2), inset 0 0 20px rgba(220,38,38,0.2)'
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Acesso Bloqueado
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, lineHeight: 1.6, margin: '0 0 32px' }}>
            O seu perfil de acesso à plataforma foi desativado temporariamente. Entre em contato com a administração escolar para reativar sua conta.
          </p>

          <button 
            onClick={() => {
              // Sign out using the API to clear cookies
              fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
                window.location.href = '/login'
              })
            }}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 24px', fontSize: 16, fontWeight: 600,
              width: '100%', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Sair e voltar ao Login
          </button>
        </div>

        <style>{`
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(40px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    )
  }

  // Agenda Digital manages its own navigation — suppress global ERP sidebar/topbar there
  const isAgendaDigital = pathname?.startsWith('/agenda-digital')

  return (
    <DataProvider>
      <DialogProvider>
        <WebVitalsReporter />
        <div className="app-wrapper">
          {!isAgendaDigital && <Sidebar />}
          <div className={`main-content ${!isAgendaDigital && sidebarCollapsed && !isMobile ? 'sidebar-collapsed' : ''} ${isAgendaDigital ? 'agenda-digital-no-sidebar' : ''}`}>
            {isMobile && !isAgendaDigital && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                height: 60,
                padding: '0 16px',
                background: 'hsl(var(--bg-surface))',
                borderBottom: '1px solid hsl(var(--border-subtle))',
                position: 'sticky',
                top: 0,
                zIndex: 40
              }}>
                <button onClick={toggleSidebar} style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Menu size={24} />
                </button>
                <div style={{ marginLeft: 12, fontWeight: 800, fontSize: 16, color: 'hsl(var(--text-primary))' }}>Impacto Edu</div>
              </div>
            )}
            <RouteGuard>
              <AgendaDigitalProvider>
                <main className="page-content">
                  {children}
                </main>

              </AgendaDigitalProvider>
            </RouteGuard>
          </div>
        </div>
      </DialogProvider>
    </DataProvider>
  )
}


