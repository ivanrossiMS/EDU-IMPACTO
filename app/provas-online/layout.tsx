'use client'

import React, { useState, useEffect } from 'react'
import { SidebarProvasOnline } from '@/components/layout/SidebarProvasOnline'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { DataProvider, useData } from '@/lib/dataContext'

export default function ProvasOnlineLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp()
  const pathname = usePathname()

  if (!hydrated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#0284c7',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Na tela de execução da prova (/provas-online/fazer) e de impressão de caderno (/imprimir), suprime a sidebar para foco total e área limpa
  const isExamRoom = pathname?.includes('/provas-online/fazer')
  const isPrintPage = pathname?.includes('/imprimir')

  if (isExamRoom || isPrintPage) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        {children}
      </div>
    )
  }

  return (
    <DataProvider>
      <ProvasOnlineLayoutInner>
        {children}
      </ProvasOnlineLayoutInner>
    </DataProvider>
  )
}

function ProvasOnlineLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated, setLoadingPath } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking')

  useEffect(() => {
    setMounted(true)
    const originalBodyBg = document.body.style.backgroundColor
    const originalBodyColor = document.body.style.color
    const originalHtmlBg = document.documentElement.style.backgroundColor
    const originalHtmlColor = document.documentElement.style.color

    document.body.style.backgroundColor = '#f8fafc'
    document.body.style.color = '#0f172a'
    document.documentElement.style.backgroundColor = '#f8fafc'
    document.documentElement.style.color = '#0f172a'

    return () => {
      document.body.style.backgroundColor = originalBodyBg
      document.body.style.color = originalBodyColor
      document.documentElement.style.backgroundColor = originalHtmlBg
      document.documentElement.style.color = originalHtmlColor
    }
  }, [])

  useEffect(() => {
    setLoadingPath(null)
  }, [pathname, setLoadingPath])

  useEffect(() => {
    if (!hydrated) return

    // Timeout de emergência para nunca travar tela de carregamento
    const emergencyTimer = setTimeout(() => {
      setAccessState(prev => (prev === 'checking' ? 'allowed' : prev))
    }, 1500)

    if (!currentUser) {
      return () => clearTimeout(emergencyTimer)
    }

    // Alunos e Responsáveis têm acesso garantido à sua visão individual
    const isStudent = currentUser.cargo === 'Aluno' || currentUser.perfil === 'Aluno' || Boolean(currentUser.aluno_id && currentUser.cargo !== 'Responsável')
    const isResponsible = currentUser.cargo === 'Responsável' || currentUser.perfil === 'Família' || currentUser.perfil === 'Responsável'

    if (isStudent || isResponsible) {
      setAccessState('allowed')
      clearTimeout(emergencyTimer)
      return
    }

    if (perfisLoading) return

    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    const isBlocked = userPerfilObj?.bloqueadoProvasOnline === true
    setAccessState(isBlocked ? 'denied' : 'allowed')

    clearTimeout(emergencyTimer)
    return () => clearTimeout(emergencyTimer)
  }, [hydrated, currentUser, pathname, perfisLoading, perfis])

  if (accessState === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#0284c7',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (accessState === 'denied') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        textAlign: 'center',
        padding: 24,
        gap: 16,
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32
        }}>
          🚫
        </div>
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: '#dc2626', textTransform: 'uppercase' }}>
          ERRO 403 · ACESSO RESTRITO
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0 }}>
          Módulo Bloqueado
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
          Seu perfil não possui autorização para acessar o módulo de Provas Online. Entre em contato com a coordenação ou direção pedagógica.
        </p>
        <button
          onClick={() => router.push('/login?step=choose_system')}
          style={{
            marginTop: 12,
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            border: 'none',
            borderRadius: 12,
            color: 'white',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)'
          }}
        >
          ← Alternar Módulo
        </button>
      </div>
    )
  }

  if (!mounted) {
    return <div style={{ minHeight: '100vh', background: '#f8fafc' }} />
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#f8fafc',
      color: '#0f172a'
    }}>
      <SidebarProvasOnline />
      <main
        style={{
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
        }}
        className="no-scrollbar"
      >
        <div style={{
          maxWidth: 1440,
          margin: '0 auto',
          width: '100%',
          minHeight: '100vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)'
        }}>
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Força light theme total em Provas Online */
        html, body {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }

        /* Suprime qualquer barra global do ERP que tente vazar */
        .sidebar:not(aside) { display: none !important; }
        .topbar { display: none !important; }

        /* Ajustes em inputs e selects para garantir contraste impecável */
        input:not([type="checkbox"]):not([type="radio"]), select, textarea {
          color: #0f172a !important;
        }
        input::placeholder, textarea::placeholder {
          color: #94a3b8 !important;
        }
      `}} />
    </div>
  )
}
