'use client'

import { SaidaProvider } from '@/lib/saidaContext'
import { AgendaDigitalProvider, useAgendaDigital } from '@/lib/agendaDigitalContext'
import { DataProvider } from '@/lib/dataContext'
import { FormulariosProvider } from '@/lib/formulariosContext'
import { RelatoriosProvider } from '@/lib/relatoriosContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { BookHeart, LogOut, Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { useEffect, useState } from 'react'

export default function AgendaDigitalLayout({ children }: { children: React.ReactNode }) {
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
  const { bannerUrl } = useAgendaDigital()
  const { currentUser, hydrated } = useApp()
  const { perfis } = useData()
  const router = useRouter()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

  // Block access if profile doesn't have '/agenda-digital' permission
  if (hydrated && currentUser && !isFamily) {
    const userPerfilObj = (perfis || []).find(p => p.nome === currentUser.perfil)
    const userPerms = userPerfilObj?.permissoes || []
    if (!userPerms.includes('/agenda-digital')) {
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

  return (
        <div className="agenda-digital-wrapper" style={{ 
          minHeight: '100vh', 
          background: 'hsl(var(--bg-main))',
          display: 'flex',
          flexDirection: 'column'
        }}>
        <style dangerouslySetInnerHTML={{__html: `
          /* Esconde a interface do ERP */
          .sidebar { display: none !important; }
          .topbar { display: none !important; }
          .main-content { padding-left: 0 !important; }
          
          /* Estilos específicos Agenda Digital */
          .ad-navbar {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
            border-bottom: 1px solid hsl(var(--border-subtle));
            padding: 0 32px;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .ad-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: hsl(var(--text-main));
          }
          .ad-brand-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: var(--gradient-purple);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ad-banner-global {
            width: 100%;
            height: 30vw;
            min-height: 200px;
            max-height: 300px;
            position: relative;
          }
          .ad-main-global {
            flex: 1;
            padding: 32px;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            position: relative;
            z-index: 10;
          }
          @media (max-width: 768px) {
            .ad-banner-global {
              height: auto !important;
              min-height: unset !important;
              max-height: unset !important;
              background: transparent !important;
              padding: 0 !important;
            }
            @keyframes bannerPopIn {
              0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes gentleFloatBanner {
              0% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
              100% { transform: translateY(0); }
            }
            .ad-banner-global img {
               position: relative !important;
               object-fit: contain !important;
               height: auto !important;
               width: 100% !important;
               background: transparent !important;
               display: block;
               border-radius: 0 0 24px 24px !important;
               box-shadow: 0 16px 32px rgba(0,0,0,0.1) !important;
               border: none !important;
               box-sizing: border-box !important;
               animation: bannerPopIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards, gentleFloatBanner 6s ease-in-out infinite 0.8s !important;
            }
            .ad-banner-gradient {
               display: none !important;
            }
            .ad-main-global {
              padding: 0 !important;
              margin-top: 0 !important;
            }
          }
        `}} />
        
        {bannerUrl && (
          <div className="ad-banner-global">
             <img src={bannerUrl} alt="Cover Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
             <div className="ad-banner-gradient" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, hsl(var(--bg-main)), transparent)' }} />
          </div>
        )}

        <main className="ad-main-global" style={{ marginTop: bannerUrl ? '-60px' : 0 }}>
          {children}
        </main>
      </div>
  )
}
