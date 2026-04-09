'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { ALL_NAV_GROUPS } from './Sidebar'
import { useEffect, useState } from 'react'

const toSlug = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-')

// Pages that are always accessible (never blocked)
const ALWAYS_ACCESSIBLE = ['/dashboard', '/alertas', '/tarefas', '/calendario']

function AccessDeniedPage({ pathname }: { pathname: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #08101e 0%, #090d1f 50%, #0a0e1c 100%)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Glow orbs */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
        top: '30%',
        left: '30%',
        filter: 'blur(60px)',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 32px',
        maxWidth: 560,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Shield icon with animated ring */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          {/* Outer pulse ring */}
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            border: '1px solid rgba(239,68,68,0.2)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          {/* Middle ring */}
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '1px solid rgba(239,68,68,0.3)',
          }} />
          {/* Icon container */}
          <div style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
            border: '1px solid rgba(239,68,68,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Error code */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'rgba(239,68,68,0.7)',
          textTransform: 'uppercase',
          marginBottom: 12,
          fontFamily: 'monospace',
        }}>
          ERRO 403 · ACESSO RESTRITO
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 36,
          fontWeight: 200,
          letterSpacing: '-0.02em',
          color: 'rgba(255,255,255,0.95)',
          margin: '0 0 12px',
          lineHeight: 1.2,
        }}>
          Acesso Negado
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 15,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.7,
          margin: '0 0 8px',
          fontWeight: 300,
        }}>
          Você não tem permissão para acessar esta página.
        </p>
        <p style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.25)',
          lineHeight: 1.6,
          margin: '0 0 36px',
          fontFamily: 'monospace',
        }}>
          {pathname}
        </p>

        {/* Divider */}
        <div style={{
          width: '100%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent)',
          marginBottom: 36,
        }} />

        {/* Info box */}
        <div style={{
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 12,
          padding: '14px 20px',
          marginBottom: 36,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          textAlign: 'left',
          width: '100%',
        }}>
          <div style={{ marginTop: 1, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
            Esta página foi desativada ou restrita no seu perfil de acesso. Entre em contato com o <strong style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Diretor Geral</strong> para solicitar permissão.
          </p>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 28px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(37,99,235,0.9) 100%)',
            border: 'none',
            borderRadius: 10,
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
            boxShadow: '0 4px 24px rgba(59,130,246,0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(59,130,246,0.4)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(59,130,246,0.3)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar ao Hub Executivo
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { perfis } = useData()
  const { currentUserPerfil, hydrated } = useApp()

  // ── Wait for localStorage hydration ───────────────────────────────────────
  // Before hydration, currentUserPerfil = 'Diretor Geral' (false default).
  // We MUST wait to avoid incorrectly granting/denying access.
  if (!hydrated) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'linear-gradient(160deg, #08101e 0%, #090d1f 50%, #0a0e1c 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: 'rgba(59,130,246,0.7)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const userPerfilObj = (perfis || []).find(p => p.nome === currentUserPerfil)
  const userPerms = userPerfilObj?.permissoes || []

  // ── Step 1: Collect ALL protected hrefs from sidebar definition ────────────
  const protectedRoutes: string[] = []

  for (const g of ALL_NAV_GROUPS) {
    if (g.title === 'Principal') continue
    if (g.href) protectedRoutes.push(g.href)
    for (const item of g.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.href) protectedRoutes.push(child.href)
        }
      } else if (item.href) {
        protectedRoutes.push(item.href)
      }
    }
  }

  // ── Step 2: Find the BEST (most specific = longest) matching route ─────────
  const matchedRoute = protectedRoutes
    .filter(route =>
      pathname === route ||
      pathname.startsWith(route + '/')
    )
    .sort((a, b) => b.length - a.length)[0]

  // ── Step 3: If route is protected and not in permissions → deny ───────────
  if (matchedRoute && !userPerms.includes(matchedRoute)) {
    return <AccessDeniedPage pathname={pathname} />
  }

  return <>{children}</>
}
