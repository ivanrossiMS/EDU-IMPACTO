'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { DataProvider, useData } from '@/lib/dataContext'
import { PeopleSidebar } from '@/components/gestao-pessoas/layout/PeopleSidebar'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

export default function GestaoPessoasLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp()
  const router = useRouter()
  const pathname = usePathname()

  if (!hydrated) return <div style={{ minHeight: '100vh', background: '#0A0F24' }} />

  return (
    <DataProvider>
      <GestaoPessoasLayoutInner>
        {children}
      </GestaoPessoasLayoutInner>
    </DataProvider>
  )
}

function GestaoPessoasLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated, loadingPath, setLoadingPath, setCurrentUser } = useApp()
  const { perfis, perfisLoading } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = React.useState(false)

  const [accessState, setAccessState] = React.useState<'checking' | 'allowed' | 'denied'>('checking')
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    setLoadingPath(null)
  }, [pathname, setLoadingPath])

  // Se currentUser for null no mount, tenta restaurar via /api/auth/me
  React.useEffect(() => {
    if (hydrated && !currentUser) {
      fetch('/api/auth/me', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) {
            setCurrentUser(data.user)
          } else {
            router.replace('/login')
          }
        })
        .catch(() => {
          // Em caso de erro de rede, permite acesso a usuários locais ou redireciona
        })
    }
  }, [hydrated, currentUser, setCurrentUser, router])

  // Checagem principal de permissões com timeout de emergência (1.5s)
  React.useEffect(() => {
    if (!hydrated) return

    // Timeout de emergência: se após 1.5s o acesso não foi resolvido (ex: perfis travado),
    // libera o acesso para funcionários internos e nega para família/alunos.
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

    // Alunos e Familiares não têm acesso a Gestão de Pessoas
    const isFamily = currentUser.perfil === 'Família' || currentUser.cargo === 'Aluno' || currentUser.cargo === 'Responsável'
    if (isFamily) {
      setAccessState('denied')
      clearTimeout(emergencyTimer)
      return
    }

    if (perfisLoading) return

    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    
    // Se o perfil não foi encontrado na tabela, por padrão PERMITE acesso a funcionários internos (exceto rotas restritas)
    const hasAccess = userPerfilObj ? !userPerfilObj.bloqueadoGestaoPessoas : true
    
    const isAdmin = currentUser.cargo === 'Administrador Master' || currentUser.perfil === 'Administrador' || currentUser.perfil === 'Diretor Geral'
    const restrictedPaths = ['/gestao-pessoas/colaboradores', '/gestao-pessoas/sst']
    const isTryingToAccessRestricted = restrictedPaths.some(p => pathname.startsWith(p))

    if (hasAccess) {
      if (!isAdmin && isTryingToAccessRestricted) {
        setAccessState('denied')
      } else {
        setAccessState('allowed')
      }
    } else {
      setAccessState('denied')
    }

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
          borderTopColor: '#10b981',
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
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 400, margin: 0 }}>Você não possui acesso ao Módulo de Gestão de Pessoas.</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '12px 28px', background: 'rgba(16,185,129,0.9)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Voltar
        </button>
      </div>
    )
  }

  if (!mounted) return <div style={{ minHeight: '100vh', background: '#0A0F24' }} />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f8fafc' }}>
      <PeopleSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: isMobile ? 80 : 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

