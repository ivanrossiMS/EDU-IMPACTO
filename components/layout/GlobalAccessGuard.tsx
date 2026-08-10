'use client'

import { performLogout } from "@/lib/auth/logout";
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useEffect } from 'react'

function AccessDeniedPage({ pathname }: { pathname: string }) {
  const router = useRouter()
  const { currentUser } = useApp()

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
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      <div style={{
        position: 'absolute',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        filter: 'blur(40px)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '48px 32px', maxWidth: 560,
      }}>
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.2)', animation: 'pulse 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.3)' }} />
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
            border: '1px solid rgba(239,68,68,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'monospace' }}>
          ERRO 403 · ACESSO RESTRITO
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 200, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.95)', margin: '0 0 12px', lineHeight: 1.2 }}>Acesso Negado</h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: '0 0 8px', fontWeight: 300 }}>
          Você não tem permissão para acessar esta página.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, margin: '0 0 36px', fontFamily: 'monospace' }}>{pathname}</p>

        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent)', marginBottom: 36 }} />

        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '14px 20px', marginBottom: 36, display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
            Esta página foi desativada ou restrita no seu perfil de acesso. Entre em contato com o <strong style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Diretor Geral</strong> para solicitar permissão.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {currentUser && (
            <button
              onClick={() => router.back()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(37,99,235,0.9) 100%)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 24px rgba(59,130,246,0.3)', transition: 'all 0.2s ease' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Voltar
            </button>
          )}

          <button
            onClick={async () => {
              try { await performLogout() } catch { window.location.replace('/login') }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
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

export function GlobalAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { currentUser, hydrated } = useApp()
  const router = useRouter()

  // Redirect root path based on user role once hydrated
  useEffect(() => {
    if (hydrated && currentUser && pathname === '/') {
      const isFamilyOrStudent = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
      if (isFamilyOrStudent) {
        router.replace('/agenda-digital')
      } else {
        router.replace('/login?step=choose_system')
      }
    }
  }, [hydrated, currentUser, pathname, router])

  const isFamilyOrStudent = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
  const isAllowedPath =
    pathname === '/' ||
    pathname.startsWith('/agenda-digital') ||
    pathname === '/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/esqueci-senha') ||
    pathname.startsWith('/atualizar-senha') ||
    pathname.startsWith('/guia-seguranca')

  const isDenied = hydrated && isFamilyOrStudent && !isAllowedPath

  // SPLASH SCREEN REMOVED: The web splash (ImpactoLoader + AnimatePresence) caused
  // the dark screen to persist forever on Capacitor iOS WKWebView because
  // AnimatePresence without a 'motion' component's 'exit' prop never removes the element.
  // The iOS native splash (SplashScreen plugin, backgroundColor #0A0F24) and the
  // dark body background (#0A0F24 in layout.tsx + globals.css) prevent any white flash.
  if (isDenied) {
    return <AccessDeniedPage pathname={pathname} />
  }

  return <>{children}</>
}
