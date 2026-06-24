'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Layers, Settings, FileText, CheckSquare, Library, Shield, ChevronLeft, ChevronRight, Menu, PenTool
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/simulados', icon: <LayoutDashboard size={18} /> },
  { label: 'Simulados & Provas', href: '/simulados/gerenciamento', icon: <PenTool size={18} /> },
  { label: 'Bimestres', href: '/simulados/cadastros/bimestres', icon: <Layers size={18} /> },
  { label: 'Disciplinas', href: '/simulados/cadastros/disciplinas', icon: <BookOpen size={18} /> },
  { label: 'Professores', href: '/simulados/cadastros/professores', icon: <Users size={18} /> },
  { label: 'Permissões', href: '/simulados/permissoes', icon: <Shield size={18} /> },
  { label: 'Logs & Auditoria', href: '/simulados/logs', icon: <CheckSquare size={18} /> },
  { label: 'Voltar ao ERP', href: '/dashboard', icon: <ChevronLeft size={18} /> },
]

export function SidebarSimulados() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)

  // Force close on mobile default
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  return (
    <div 
      className={`sidebar-simulados ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? 80 : 280,
        height: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: isMobile ? 'fixed' : 'relative',
        zIndex: 50,
        flexShrink: 0
      }}
    >
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f43f5e, #be123c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(244,63,94,0.3)' }}>
              <PenTool size={20} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, color: 'white', fontSize: 18, lineHeight: 1 }}>SIMULADOS</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.05em' }}>Módulo de Provas</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f43f5e, #be123c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PenTool size={20} color="white" />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }} className="no-scrollbar">
        {NAV_ITEMS.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/dashboard' && pathname?.startsWith(item.href))
          const isBack = item.href === '/dashboard'

          return (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', marginTop: isBack ? 'auto' : 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 14,
                padding: collapsed ? '12px 0' : '12px 16px',
                borderRadius: 12,
                background: isActive ? 'rgba(244,63,94,0.1)' : 'transparent',
                color: isActive ? '#fb7185' : 'rgba(255,255,255,0.6)',
                transition: 'all 0.2s',
                border: isActive ? '1px solid rgba(244,63,94,0.2)' : '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.color = 'white'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }
              }}
              >
                {item.icon}
                {!collapsed && (
                  <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Recolher menu"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
