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

  if (!hydrated) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }} />

  return (
    <DataProvider>
      <GestaoPessoasLayoutInner>
        {children}
      </GestaoPessoasLayoutInner>
    </DataProvider>
  )
}

function GestaoPessoasLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated, loadingPath, setLoadingPath } = useApp()
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

  React.useEffect(() => {
    if (!hydrated || !currentUser) return

    // Alunos e Familiares não têm acesso a Gestão de Pessoas
    const isFamily = currentUser.perfil === 'Família' || currentUser.cargo === 'Aluno' || currentUser.cargo === 'Responsável'
    if (isFamily) {
      setAccessState('denied')
      return
    }

    if (perfisLoading) return

    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    if (!userPerfilObj) {
      // Falha silenciosa ou admin mestre
      if (currentUser.cargo === 'Administrador Master') {
        setAccessState('allowed')
        return
      }
      return
    }

    const hasAccess = !userPerfilObj.bloqueadoGestaoPessoas
    
    const isAdmin = currentUser.cargo === 'Administrador Master' || currentUser.perfil === 'Administrador'
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

  }, [hydrated, currentUser, pathname, perfisLoading, perfis])

  if (accessState === 'checking') return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }} />

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

  if (!mounted) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }} />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f8fafc' }}>
      <PeopleSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Aqui poderia entrar um PeopleTopBar no futuro */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: isMobile ? 80 : 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
