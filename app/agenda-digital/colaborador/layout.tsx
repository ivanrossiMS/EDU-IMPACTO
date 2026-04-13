'use client'

import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Bell, MessageSquare, Image as ImageIcon, Calendar, 
  BarChart2, UserCog, LogOut, ArrowLeft
} from 'lucide-react'

export default function AgendaDigitalColaboradorLayout({ 
  children
}: { 
  children: React.ReactNode 
}) {
  const { currentUser, setCurrentUser } = useApp()
  const pathname = usePathname()

  const navItems = [
    { label: 'Comunicados', href: `/agenda-digital/colaborador/comunicados`, icon: <Bell size={18} /> },
    { label: 'Conversas', href: `/agenda-digital/colaborador/conversas`, icon: <MessageSquare size={18} /> },
    { label: 'Momentos', href: `/agenda-digital/colaborador/momentos`, icon: <ImageIcon size={18} /> },
    { label: 'Calendário', href: `/agenda-digital/colaborador/calendario`, icon: <Calendar size={18} /> },
    { label: 'Meu Perfil', href: `/agenda-digital/colaborador/perfil`, icon: <UserCog size={18} /> },
  ]

  if (!currentUser || (currentUser.cargo === 'Aluno')) return null

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-main-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 32px;
          align-items: start;
        }
        .ad-student-banner {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 24px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .ad-banner-actions {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .ad-mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        /* Somente Modificacoes Mobile, intocavel no Desktop */
        @media (max-width: 768px) {
          .ad-main-grid {
            grid-template-columns: 1fr !important;
            gap: 0px !important;
          }
          .ad-banner {
            height: 250px !important;
          }
          .agenda-digital-wrapper {
            padding-bottom: 80px !important;
            background: #ffffff !important;
          }
          .ad-student-banner {
            flex-direction: column !important;
            align-items: center !important;
            padding: 0 16px 0 16px !important;
            gap: 4px !important;
            border: none !important;
            border-radius: 0 !important;
            border-bottom: none !important;
            background: transparent !important;
            margin-top: 0 !important;
            box-shadow: none !important;
            position: relative;
            z-index: 20;
          }
          @keyframes popUpPulseAvatar {
            0% { transform: scale(0.5) translateY(20px); opacity: 0; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
            70% { transform: scale(1.05) translateY(-2px); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          }
          @keyframes premiumFloat {
            0% { transform: translateY(0px); box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0 rgba(59, 130, 246, 0.3); }
            50% { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.15), 0 0 0 8px rgba(59, 130, 246, 0); }
            100% { transform: translateY(0px); box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0 rgba(59, 130, 246, 0); }
          }
          .ad-banner-avatar-wrapper {
            margin-top: -40px !important;
            border: 3px solid #ffffff !important;
            width: 64px !important;
            height: 64px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
            background: #ffffff !important;
            animation: popUpPulseAvatar 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, premiumFloat 4s ease-in-out infinite 0.8s !important;
          }
          .ad-banner-left {
            width: 100% !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 4px !important;
          }
          .ad-student-name {
            font-size: 16px !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            font-weight: 800 !important;
          }
          .ad-student-details {
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          .ad-banner-actions {
            width: 100% !important;
            flex-direction: column !important;
            align-items: center !important;
            border: 1px solid rgba(0,0,0,0.06) !important;
            border-radius: 12px !important;
            background: linear-gradient(180deg, #ffffff, rgba(59,130,246,0.04)) !important;
            padding: 12px 14px !important;
            margin-top: 4px !important;
            gap: 10px !important;
            text-align: center !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.03) !important;
          }
          .ad-banner-actions .btn {
            height: 26px !important;
            min-height: 26px !important;
            font-size: 10px !important;
            border-radius: 6px !important;
            padding: 0 12px !important;
          }
          .ad-banner-actions .btn svg {
            width: 14px !important;
            height: 14px !important;
          }
          .ad-banner-actions-right {
            align-items: center !important;
            text-align: center !important;
          }
          .ad-banner-actions-right > div:first-child {
            font-size: 8px !important;
            margin-bottom: 0 !important;
            letter-spacing: 0.5px !important;
          }
          .ad-banner-btn-group {
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 10px !important;
            margin-top: 0 !important;
            width: 100% !important;
          }
          .ad-page-header h2 {
            font-size: 18px !important;
            margin-bottom: 0px !important;
          }
        }
      `}} />

      {/* Top Banner specific to the staff */}
      <div className="ad-student-banner">
        <div className="ad-banner-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar ad-banner-avatar-wrapper" style={{ width: 64, height: 64, fontSize: 24, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'transform 0.3s ease' }}
               onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} >
             {getInitials(currentUser.nome || 'Colaborador')}
          </div>
          <div>
            <div className="ad-student-name" style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              {currentUser.nome}
            </div>
            <div className="ad-student-details" style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>
              Acesso Institucional • {currentUser.cargo || currentUser.perfil}
            </div>
          </div>
        </div>

        <div className="ad-banner-actions">
          <div className="ad-banner-btn-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/agenda-digital/selecionar-aluno" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', cursor: 'pointer' }}>
                <ArrowLeft size={16} />
                <span style={{ whiteSpace: 'nowrap' }}>Voltar p/ Seleção</span>
              </button>
            </Link>
            <button 
              onClick={async () => { 
                setCurrentUser(null); 
                await fetch('/api/auth/logout', { method: 'POST' }); 
                window.location.href = '/login'; 
              }} 
              className="btn btn-secondary btn-sm" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#ef4444', cursor: 'pointer' }}
            >
              <LogOut size={16} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area with Navigation */}
      <div className="ad-main-grid">
        {/* Sub-NavigationBar (Desktop Side, Mobile Bottom conceptual) */}
        <nav className="ad-mobile-nav">
          {navItems.map(item => {
            const isActive = pathname.includes(item.href)
            return (
              <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
                <div 
                  className="ad-mobile-nav-item"
                  style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: isActive ? '#3b82f6' : 'hsl(var(--text-secondary))',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                  e.currentTarget.style.color = '#3b82f6'
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                  }
                }}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Page Content */}
        <div style={{ minHeight: 400 }}>
          {children}
        </div>
      </div>
    </div>
    </>
  )
}
