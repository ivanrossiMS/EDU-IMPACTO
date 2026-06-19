'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { PremiumLoader } from '@/components/PremiumLoader'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

function AccessDeniedPage({ pathname, isFamilyOrStudent }: { pathname: string, isFamilyOrStudent?: boolean }) {
  const router = useRouter()
  const { currentUser, setCurrentUser } = useApp()
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

        {/* Shield icon */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            border: '1px solid rgba(239,68,68,0.2)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '1px solid rgba(239,68,68,0.3)',
          }} />
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

        <div style={{
          width: '100%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent)',
          marginBottom: 36,
        }} />

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

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {currentUser && (
            <button
              onClick={() => router.push(isFamilyOrStudent ? '/agenda-digital' : '/dashboard')}
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
              {isFamilyOrStudent ? 'Voltar para a Agenda Digital' : 'Voltar ao Hub Executivo'}
            </button>
          )}

          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' })
                setCurrentUser?.(null)
                window.location.href = '/login'
              } catch (err) {
                window.location.href = '/login'
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 28px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
              color: '#ef4444',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.15)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair do Sistema
          </button>
        </div>
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

function ModernSplashScreen({ isFading }: { isFading: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#0A0F24',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: isFading ? 0 : 1,
      transition: 'opacity 0.5s ease',
      pointerEvents: isFading ? 'none' : 'auto'
    }}>
      {/* Background Orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '20%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(121,40,202,0.15) 0%, transparent 70%)',
        filter: 'blur(40px)', animation: 'float 6s infinite ease-in-out'
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '20%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        filter: 'blur(40px)', animation: 'float 8s infinite ease-in-out reverse'
      }} />

      {/* Glassmorphism Container */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: 140, height: 140,
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 30,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulseGlow 2s infinite alternate'
      }}>
        {/* Animated Rings */}
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 32,
          border: '2px solid transparent',
          borderTopColor: '#3b82f6', borderBottomColor: '#7928ca',
          animation: 'spin 1.5s linear infinite'
        }} />
        <div style={{
          position: 'absolute', inset: 8, borderRadius: 22,
          border: '2px solid transparent',
          borderLeftColor: '#00d2ff', borderRightColor: '#ff0080',
          animation: 'spin 2s linear infinite reverse', opacity: 0.7
        }} />
        
        {/* Central Logo */}
        <img src="/logo-impacto.png" alt="Impacto Edu" style={{ width: 60, height: 60, objectFit: 'contain', animation: 'float 3s infinite ease-in-out' }} />
      </div>

      <div style={{ marginTop: 40, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
         <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'white', letterSpacing: '0.05em' }}>IMPACTO EDU</h1>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Educação que transforma</p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 20px rgba(59,130,246,0.1); }
          100% { box-shadow: 0 0 40px rgba(121,40,202,0.3); }
        }
      `}</style>
    </div>
  )
}

export function GlobalAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { currentUser, hydrated } = useApp()
  const router = useRouter()

  const [showSplash, setShowSplash] = useState(true)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenSplash = sessionStorage.getItem('edu_has_seen_splash')
      if (hasSeenSplash) {
        setShowSplash(false)
        return
      }
      sessionStorage.setItem('edu_has_seen_splash', 'true')
    }

    const timer = setTimeout(() => {
      setIsFading(true)
      setTimeout(() => setShowSplash(false), 500)
    }, 1800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (hydrated && currentUser && pathname === '/') {
      const isFamilyOrStudent = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
      if (isFamilyOrStudent) {
        router.replace('/agenda-digital')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [hydrated, currentUser, pathname, router])

  if (!hydrated) {
    return (
      <>
        <AnimatePresence>
          {showSplash && <PremiumLoader key="global-loader" />}
        </AnimatePresence>
      </>
    )
  }

  const isFamilyOrStudent = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  if (isFamilyOrStudent) {
    const isAllowedPath = pathname === '/' || pathname.startsWith('/agenda-digital') || pathname === '/login' || pathname.startsWith('/api') || pathname.startsWith('/esqueci-senha') || pathname.startsWith('/atualizar-senha')
    if (!isAllowedPath) {
      return (
        <>
          <AnimatePresence>
            {showSplash && <PremiumLoader key="global-loader" />}
          </AnimatePresence>
          <AccessDeniedPage pathname={pathname} isFamilyOrStudent={true} />
        </>
      )
    }
    if (pathname === '/') {
      return (
        <>
          <AnimatePresence>
            {showSplash && <PremiumLoader key="global-loader" />}
          </AnimatePresence>
        </>
      )
    }
  }

  if (currentUser && pathname === '/') {
    return (
      <>
        <AnimatePresence>
          {showSplash && <PremiumLoader key="global-loader" />}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && <PremiumLoader key="global-loader" />}
      </AnimatePresence>
      {children}
    </>
  )
}
