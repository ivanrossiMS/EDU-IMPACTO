'use client'

import React, { useState, useEffect } from 'react'
import { SidebarSimulados } from '@/components/layout/SidebarSimulados'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { DataProvider, useData } from '@/lib/dataContext'

export default function SimuladosLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp()
  const router = useRouter()
  const pathname = usePathname()

  if (!hydrated) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-app))' }} />

  // Se for a rota de impressão (PDF), não renderiza a sidebar nem formatação extra
  const isPrintView = pathname?.includes('/imprimir') || pathname?.includes('/gabarito')

  if (isPrintView) {
    return <>{children}</>
  }

  return (
    <DataProvider>
      <SimuladosLayoutInner>
        {children}
      </SimuladosLayoutInner>
    </DataProvider>
  )
}

function SimuladosLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated, loadingPath, setLoadingPath } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)

  const [accessState, setAccessState] = React.useState<'checking' | 'allowed' | 'denied'>('checking')
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    setLoadingPath(null)
  }, [pathname, setLoadingPath])

  React.useEffect(() => {
    if (!hydrated) return

    // Timeout de emergência: se após 1.5s o acesso não foi resolvido, libera para funcionários internos
    const emergencyTimer = setTimeout(() => {
      setAccessState(prev => {
        if (prev !== 'checking') return prev
        const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
        return isFamily ? 'denied' : 'allowed'
      })
    }, 1500)

    if (!currentUser) {
      return () => clearTimeout(emergencyTimer)
    }

    // Alunos e Familiares não têm acesso ao painel admin de simulados
    const isFamily = currentUser.perfil === 'Família' || currentUser.cargo === 'Aluno' || currentUser.cargo === 'Responsável'
    if (isFamily) {
      setAccessState('denied')
      clearTimeout(emergencyTimer)
      return
    }

    if (perfisLoading) return

    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    const hasAccess = userPerfilObj ? !userPerfilObj.bloqueadoSimulados : true
    setAccessState(hasAccess ? 'allowed' : 'denied')

    clearTimeout(emergencyTimer)
    return () => clearTimeout(emergencyTimer)
  }, [hydrated, currentUser, pathname, perfisLoading, perfis])

  if (accessState === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0F24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#f43f5e',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (accessState === 'denied') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🚫</span>
        </div>
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase' }}>ERRO 403 · ACESSO RESTRITO</p>
        <h1 style={{ fontSize: 32, fontWeight: 200, color: 'white', margin: 0 }}>Acesso Negado</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 400, margin: 0 }}>Você não possui acesso ao Módulo de Simulados.</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '12px 28px', background: 'rgba(16,185,129,0.9)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Voltar
        </button>
      </div>
    )
  }

  if (!mounted) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-app))' }} />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'hsl(var(--bg-app))' }}>
      <SidebarSimulados />
      <div
        style={{
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          background: 'hsl(var(--bg-app))'
        }}
        className="no-scrollbar"
      >
        <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', minHeight: '100vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 95px)' }} className="simulados-content">
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .simulados-content * { box-sizing: border-box; }
        .simulados-content img { height: auto; max-width: 100%; }
        .simulados-content p, .simulados-content span, .simulados-content h1, .simulados-content h2, .simulados-content h3, .simulados-content h4 { overflow-wrap: break-word; }
      `}} />
    </div>
  )
}
