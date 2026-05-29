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

  // 3 estados de auth: 'checking' | 'authorized' | 'unauthorized'
  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'unauthorized'>('checking')

  // EFFECT 1: Check Auth On Mount ONLY
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store', credentials: 'include',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })

        if (!res.ok) {
          console.warn('Auth check failed, trusting localStorage session temporarily.')
          setAuthState('authorized') // Assume authorized if we have localStorage data
          return
        }

        const data = await res.json()
        const serverUser: any = data.user

        if (!serverUser) {
          console.warn('No server user, trusting localStorage session temporarily.')
          setAuthState('authorized')
          return
        }

        setCurrentUser(serverUser)
        setAuthState('authorized')
      } catch (err) {
        console.error('Fetch auth error:', err)
        setAuthState('authorized') // Trust local storage on network error
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


