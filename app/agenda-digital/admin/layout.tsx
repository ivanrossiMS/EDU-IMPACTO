'use client'

import { useApp } from '@/lib/context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, Users, BookOpen, Bell, MessageSquare, Image as ImageIcon, 
  Calendar, FileText, BadgeDollarSign, Settings, FormInput, LogOut
} from 'lucide-react'

export default function AgendaDigitalAdminLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const pathname = usePathname()
  const { currentUserPerfil, setCurrentUser } = useApp()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setCurrentUser(null)
      window.location.href = '/login'
    } catch (e) {
      console.error(e)
      window.location.href = '/login'
    }
  }

  const navItems = [
    { label: 'Dashboard', href: '/agenda-digital/admin', icon: <BarChart3 size={18} />, exact: true },
    { label: 'Turmas', href: '/agenda-digital/admin/turmas', icon: <BookOpen size={18} />, exact: false },
    { label: 'Pessoas', href: '/agenda-digital/admin/pessoas', icon: <Users size={18} />, exact: false },
    { label: 'Comunicados', href: '/agenda-digital/admin/comunicados', icon: <Bell size={18} />, exact: false },
    { label: 'Conversas', href: '/agenda-digital/admin/conversas', icon: <MessageSquare size={18} />, exact: false },
    { label: 'Momentos', href: '/agenda-digital/admin/momentos', icon: <ImageIcon size={18} />, exact: false },
    { label: 'Calendário', href: '/agenda-digital/admin/calendario', icon: <Calendar size={18} />, exact: false },
    { label: 'Relatórios', href: '/agenda-digital/admin/relatorios', icon: <FileText size={18} />, exact: false },
    { label: 'Cobranças', href: '/agenda-digital/admin/cobrancas', icon: <BadgeDollarSign size={18} />, exact: false },
    { label: 'Formulários', href: '/agenda-digital/admin/formularios', icon: <FormInput size={18} />, exact: false },
    { label: 'Ajustes', href: '/agenda-digital/admin/ajustes', icon: <Settings size={18} />, exact: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-layout-container {
             display: flex !important;
             flex-direction: column !important;
             gap: 20px !important;
          }
          .ad-admin-header {
             padding: 16px 20px !important;
             flex-direction: column !important;
             align-items: center !important;
             text-align: center !important;
          }
          .ad-admin-header-content {
             flex-direction: column !important;
             text-align: center !important;
             gap: 12px !important;
             justify-content: center !important;
          }
          .ad-admin-header .avatar {
             width: 56px !important;
             height: 56px !important;
             font-size: 20px !important;
          }
          .ad-admin-header h2 {
             font-size: 20px !important;
             letter-spacing: -0.02em !important;
          }
          .ad-admin-header p {
             font-size: 13px !important;
             line-height: 1.4 !important;
             padding: 0 8px !important;
          }
          .ad-admin-header-actions {
             width: 100% !important;
             justify-content: center !important;
             margin-top: 12px !important;
          }

          .ad-admin-nav {
             position: fixed !important;
             bottom: 0 !important;
             left: 0 !important;
             right: 0 !important;
             z-index: 100 !important;
             display: flex !important;
             flex-direction: row !important;
             overflow-x: auto !important;
             white-space: nowrap !important;
             justify-content: flex-start !important;
             gap: 4px !important;
             padding: 12px 16px env(safe-area-inset-bottom, 16px) !important;
             background: rgba(255,255,255,0.85) !important;
             backdrop-filter: blur(12px) !important;
             -webkit-backdrop-filter: blur(12px) !important;
             border-top: 1px solid rgba(0,0,0,0.08) !important;
             box-shadow: 0 -4px 20px rgba(0,0,0,0.05) !important;
             margin: 0 !important;
             scrollbar-width: none;
             border-radius: 24px 24px 0 0 !important;
          }

          /* --- GLOBAL AUTO-MOBILE FIXES FOR ALL ADMIN SUBPAGES --- */
          .ad-admin-page-container {
            padding: 0 20px !important;
            max-width: 480px !important;
            margin: 0 auto !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          
          /* Auto-stack internal grids on mobile */
          .ad-mobile-optimized *[style*="display: grid"][style*="minmax("],
          .ad-mobile-optimized *[style*="display: grid"][style*="1fr 1fr"],
          .ad-mobile-optimized *[style*="display: grid"][style*="300px"] {
             grid-template-columns: 1fr !important;
             gap: 16px !important;
          }

          /* General flex row header actions reset */
          .ad-mobile-optimized > div:first-child {
             flex-direction: column !important;
             text-align: center !important;
             align-items: stretch !important;
             gap: 12px !important;
          }

          /* Safe default headers */
          .ad-mobile-optimized h2 {
             font-size: 22px !important;
             line-height: 1.2 !important;
             text-align: center !important;
          }
          .ad-mobile-optimized p {
             font-size: 13px !important;
             text-align: center !important;
          }

          /* Improve lists & button areas */
          .ad-mobile-optimized .btn {
             width: 100% !important;
             justify-content: center !important;
             font-size: 13px !important;
          }
          
          /* Fix sidebars/menus */
          .ad-mobile-optimized *[style*="width: 260"],
          .ad-mobile-optimized *[style*="width: 320"] {
             width: 100% !important;
             border-right: none !important;
             border-bottom: 1px solid hsl(var(--border-subtle)) !important;
             flex-direction: row !important;
             overflow-x: auto !important;
          }
          /* Fix Flex Row layout columns to stack */
          .ad-mobile-optimized *[style*="background: hsl(var(--bg-surface))"][style*="display: flex"] {
             flex-direction: column !important;
          }
          :root[data-theme="dark"] .ad-admin-nav {
             background: rgba(20,20,20,0.85) !important;
             border-top: 1px solid rgba(255,255,255,0.08) !important;
          }
          .ad-admin-nav::-webkit-scrollbar {
             display: none;
          }
          .ad-admin-nav a div {
             flex-direction: column !important;
             padding: 8px 12px !important;
             font-size: 10px !important;
             flex-shrink: 0 !important;
             gap: 4px !important;
             justify-content: center !important;
             align-items: center !important;
             border-radius: 12px !important;
          }
          .ad-admin-nav a div svg {
             width: 20px !important;
             height: 20px !important;
          }
          .ad-admin-layout-container {
             padding-bottom: 90px !important; /* Spacing for the bottom nav */
          }
          @keyframes premiumFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          .avatar-animated {
             animation: premiumFloat 4s ease-in-out infinite !important;
          }
        }
      `}} />
      {/* Top Banner specific to Admin */}
      <div className="ad-admin-header" style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 16,
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24
      }}>
        <div className="ad-admin-header-content" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar avatar-animated" style={{ width: 64, height: 64, fontSize: 24, background: 'var(--gradient-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, boxShadow: '0 8px 20px rgba(139,92,246,0.3)', flexShrink: 0 }}>
            AD
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, padding: 0 }}>
              Administração - Agenda Digital
            </h2>
            <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', margin: '4px 0 0 0', padding: 0 }}>
              Gestão de comunicação e acompanhamento escolar • {currentUserPerfil}
            </p>
          </div>
        </div>
        
        <div className="ad-admin-header-actions" style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={handleLogout}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
              e.currentTarget.style.transform = ''
            }}
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content Area with Navigation */}
      <div className="ad-admin-layout-container" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Sub-NavigationBar (Desktop Side) */}
        <nav className="ad-admin-nav" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {navItems.map(item => {
            const isActive = item.exact 
              ? pathname === item.href 
              : pathname.startsWith(item.href)

            return (
              <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                  e.currentTarget.style.color = 'hsl(var(--primary))'
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
  )
}
