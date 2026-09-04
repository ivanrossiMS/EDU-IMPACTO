'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { hideSplashScreen } from '@/lib/capacitor/splash'

export default function Root() {
  const router = useRouter()
  const { currentUser, hydrated } = useApp()

  useEffect(() => {
    // Wait for AppProvider to hydrate the session from localStorage/Capacitor Preferences
    if (!hydrated) return

    // If no user is logged in, redirect to /login on the client side.
    if (!currentUser) {
      router.replace('/login')
      return
    }

    const perfil = currentUser.perfil || ''
    const cargo = currentUser.cargo || ''
    const isFamilyOrStudent = (
      perfil === 'Família' ||
      perfil === 'Responsável' ||
      perfil === 'Aluno' ||
      cargo === 'Responsável' ||
      cargo === 'Aluno'
    )

    if (isFamilyOrStudent) {
      if (cargo === 'Aluno' && currentUser.aluno_id) {
        router.replace(`/agenda-digital/${currentUser.aluno_id}/comunicados`)
        return
      }
      router.replace('/agenda-digital/selecionar-aluno')
    } else {
      router.replace('/login?step=choose_system')
    }
  }, [hydrated, currentUser, router])

  // Fallback de segurança para liberar a splash screen se a navegação demorar mais que 1.2s
  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen(300)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  // Renderiza tela de abertura elegante com a identidade do Impacto Edu
  // eliminando 100% da sensação de tela preta travada
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0A0F24',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Luz ambiente de fundo sutil */}
      <div
        style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* Ícone estilizado com pulso */}
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.2)',
          animation: 'pulseGlow 2s ease-in-out infinite',
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      </div>

      {/* Título da Aplicação */}
      <div
        style={{
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: '#ffffff',
          marginBottom: '6px',
        }}
      >
        IMPACTO EDU
      </div>

      <div
        style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.45)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '28px',
          fontWeight: 600,
        }}
      >
        Ambiente Seguro
      </div>

      {/* Indicador de carregamento linear elegante */}
      <div
        style={{
          width: '120px',
          height: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '3px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '45%',
            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
            borderRadius: '3px',
            animation: 'slideBar 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes slideBar {
          0% { left: -45%; }
          100% { left: 100%; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.04); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

