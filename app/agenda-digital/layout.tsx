'use client'

import { SaidaProvider } from '@/lib/saidaContext'
import { AgendaDigitalProvider, useAgendaDigital } from '@/lib/agendaDigitalContext'
import { DataProvider } from '@/lib/dataContext'
import { FormulariosProvider } from '@/lib/formulariosContext'
import { RelatoriosProvider } from '@/lib/relatoriosContext'
import { useApp } from '@/lib/context'
import { BookHeart, LogOut, Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getInitials } from '@/lib/utils'

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
  const { currentUser } = useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'

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
