'use client'
// Layout da Agenda Digital com Sidebar Moderna

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { SaidaProvider } from '@/lib/saidaContext'
import { AgendaDigitalProvider, useAgendaDigital } from '@/lib/agendaDigitalContext'
import { DataProvider } from '@/lib/dataContext'
import { FormulariosProvider } from '@/lib/formulariosContext'
import { RelatoriosProvider } from '@/lib/relatoriosContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useRouter, usePathname } from 'next/navigation'
import { ADSidebar } from './components/Sidebar'
import FloatingChat from '@/components/FloatingChat'

export default function AgendaDigitalLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  if (!hydrated) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }} />

  // Família não precisa carregar os dados massivos globais do ERP
  if (isFamily) {
    return (
      <FormulariosProvider>
        <SaidaProvider>
          <AgendaDigitalProvider>
            <AgendaDigitalLayoutInner>
              {children}
            </AgendaDigitalLayoutInner>
          </AgendaDigitalProvider>
        </SaidaProvider>
      </FormulariosProvider>
    )
  }

  return (
    <DataProvider>
      <FormulariosProvider>
        <RelatoriosProvider>
          <SaidaProvider>
            <AgendaDigitalProvider>
              <AgendaDigitalLayoutInner>
                {children}
              </AgendaDigitalLayoutInner>
            </AgendaDigitalProvider>
          </SaidaProvider>
        </RelatoriosProvider>
      </FormulariosProvider>
    </DataProvider>
  )
}

function AgendaDigitalLayoutInner({ children }: { children: React.ReactNode }) {
  const { bannerUrl, adLoading } = useAgendaDigital()
  const { currentUser, hydrated } = useApp()
  const { perfis } = useData()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  
  const isSelectStudent = pathname?.includes('/agenda-digital/selecionar-aluno')
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  // Block access if profile doesn't have '/agenda-digital' permission
  if (hydrated && currentUser && !isFamily) {
    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    const userPerms = userPerfilObj?.permissoes || []
    if (!userPerms.includes('/agenda-digital') && !userPerms.includes('agenda-digital') && !pathname?.includes('/agenda-digital/colaborador')) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg, #08101e 0%, #090d1f 50%, #0a0e1c 100%)',
          textAlign: 'center', gap: 16,
        }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase' }}>ERRO 403 · ACESSO RESTRITO</p>
          <h1 style={{ fontSize: 32, fontWeight: 200, color: 'white', margin: 0 }}>Acesso Negado</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 400, margin: 0 }}>A Agenda Digital foi restrita para o seu perfil. Consulte o Diretor Geral.</p>
          <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '12px 28px', background: 'rgba(59,130,246,0.9)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar ao Hub
          </button>
        </div>
      )
    }
  }

  if (!mounted) return <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }} />

  return (
    <div className="agenda-digital-wrapper" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'hsl(var(--bg-main))' }}>
        <style dangerouslySetInnerHTML={{__html: `
          /* Esconde a interface do ERP */
          .sidebar { display: none !important; }
          .topbar { display: none !important; }
          .main-content { padding-left: 0 !important; }
          
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          .ad-main-scroll {
            flex: 1;
            overflow-y: auto;
            position: relative;
            background: #f8fafc;
          }

          .ad-content-inner {
            padding: 32px;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            position: relative;
            z-index: 10;
          }

          .ad-banner-global {
            width: 100%;
            height: 240px;
            position: relative;
          }

          .ad-content-inner.ad-has-banner {
            margin-top: -80px;
          }

          .ad-fin-sticky-footer {
            bottom: 32px !important;
          }

          @media (max-width: 1024px) {
            .ad-sidebar-container { display: none; }
          }
          
          @media (max-width: 768px) {
            .ad-banner-global {
              position: relative !important;
              width: 100vw !important;
              height: auto !important;
              background: transparent;
              margin: 0 !important;
              padding: 0 !important;
            }
            .ad-banner-global img {
              display: block !important;
              width: 100vw !important;
              height: auto !important;
              max-height: 350px !important;
              object-fit: contain !important;
              object-position: top center !important;
              margin: 0 !important;
            }
            .ad-fin-sticky-footer {
              bottom: 95px !important;
              z-index: 9998 !important;
            }
            .ad-content-inner {
              padding: 16px !important;
            }
            .ad-content-inner.ad-has-banner {
              margin-top: 0 !important;
            }
          }
        `}} />
        
        {!isSelectStudent && !adLoading && (
          <div className="ad-sidebar-container">
            <ADSidebar />
          </div>
        )}

        <div className="ad-main-scroll no-scrollbar">
          {bannerUrl && (
            <div className="ad-banner-global">
              <Image src={bannerUrl} alt="Cover Banner" fill style={{ objectFit: 'cover', objectPosition: 'center' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #f8fafc, transparent)' }} />
            </div>
          )}

          <main className={`ad-content-inner ${bannerUrl ? 'ad-has-banner' : ''}`}>
            {children}
          </main>
          <FloatingChat />
        </div>
    </div>
  )
}
