'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { RouteGuard } from '@/components/layout/RouteGuard'
import { useApp } from '@/lib/context'
import { DataProvider } from '@/lib/dataContext'
import { DialogProvider } from '@/lib/dialogContext'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WebVitalsReporter } from '@/lib/webVitals'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setCurrentUser, currentUser } = useApp()
  const router = useRouter()
  const pathname = usePathname()

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
          setCurrentUser(null)
          console.error('Would have redirected to login, dropping to unauth.')
          setAuthState('unauthorized')
          return
        }

        const data = await res.json()
        const serverUser: any = data.user

        if (!serverUser) {
          setCurrentUser(null)
          console.error('Would have redirected to login, dropping to unauth.')
          setAuthState('unauthorized')
          return
        }

        setCurrentUser(serverUser)
        setAuthState('authorized')
      } catch (err) {
        console.error('Fetch auth error:', err)
        setAuthState('unauthorized')
      }
    }

    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Runs ONLY on mount

  // EFFECT 2: Check RBAC when pathname or authState changes
  useEffect(() => {
    if (authState !== 'authorized' || !currentUser) return

    const p = currentUser.perfil
    const cargo = currentUser.cargo

    // ── RBAC: Políticas de redirecionamento por perfil ──────────────
    if (p === 'Família' || cargo === 'Aluno' || cargo === 'Responsável' || p === 'Aluno') {
      if (!pathname.startsWith('/agenda-digital')) {
        router.replace('/agenda-digital')
        return
      }
    }

    if (p === 'Professor') {
      if (
        !pathname.startsWith('/professor') &&
        !pathname.startsWith('/academico') &&
        !pathname.startsWith('/dashboard') &&
        !pathname.startsWith('/agenda-digital')
      ) {
        router.replace('/dashboard')
        return
      }
    }

    if (['Financeiro', 'Tesouraria'].includes(p) && pathname.startsWith('/academico')) {
      router.replace('/financeiro')
      return
    }

    if (['Secretaria', 'Acadêmico'].includes(p) && pathname.startsWith('/financeiro')) {
      router.replace('/academico')
      return
    }
  }, [pathname, authState, currentUser, router])

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

        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Topbar fantasma */}
          <div
            className="topbar"
            style={{ background: 'hsl(var(--bg-topbar, 220 25% 9%))', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}
          >
            <div style={{ flex: 1, height: 20, maxWidth: 280, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
            <div style={{ height: 36, width: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          </div>

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

  return (
    <DataProvider>
      <DialogProvider>
        <WebVitalsReporter />
        <div className="app-wrapper">
          <Sidebar />
          <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Topbar />
            <RouteGuard>
              <main className="page-content">
                {children}
              </main>
            </RouteGuard>
          </div>
        </div>
      </DialogProvider>
    </DataProvider>
  )
}


