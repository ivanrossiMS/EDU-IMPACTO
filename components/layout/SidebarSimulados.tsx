'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Layers, Settings, FileText, CheckSquare, Library, Shield, ChevronLeft, ChevronRight, Menu, PenTool, LogOut, User
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/simulados', icon: <LayoutDashboard size={18} /> },
  { label: 'Gerenciamento', href: '/simulados/gerenciamento', icon: <PenTool size={18} /> },
  { label: 'Simulados', href: '/simulados/lista', icon: <FileText size={18} /> },
  { label: 'Bimestres', href: '/simulados/cadastros/bimestres', icon: <Layers size={18} /> },
  { label: 'Disciplinas', href: '/simulados/cadastros/disciplinas', icon: <BookOpen size={18} /> },
  { label: 'Professores', href: '/simulados/cadastros/professores', icon: <Users size={18} /> },
  { label: 'Configurações', href: '/simulados/configuracoes', icon: <Settings size={18} /> },
  { label: 'Voltar ao ERP', href: '/dashboard', icon: <ChevronLeft size={18} /> },
]

export function SidebarSimulados() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const { currentUserPerfil, setCurrentUserPerfil, currentUser, setCurrentUser } = useApp()

  const isProfessor = currentUserPerfil === 'Professor'

  const activeNavItems = NAV_ITEMS.filter(item => {
    if (isProfessor) {
      return ['Dashboard', 'Simulados', 'Voltar ao ERP'].includes(item.label)
    }
    return true
  })

  // Force close on mobile default
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  if (isMobile) {
    return (
      <div 
        className="no-scrollbar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 70,
          background: 'linear-gradient(180deg, #0f172a 0%, #060b14 100%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 12px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          gap: 16,
          zIndex: 100,
          overflowX: 'auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
        }}
      >
        {activeNavItems.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 60 }}>
              <div style={{
                color: isActive ? '#fb7185' : 'rgba(255,255,255,0.5)',
                padding: '6px 14px',
                borderRadius: 16,
                background: isActive ? 'rgba(244,63,94,0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(244,63,94,0.3)' : 'none'
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 10, color: isActive ? '#fb7185' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 700 : 500, transition: 'all 0.2s' }}>
                {item.label === 'Dashboard' ? 'Início' : item.label === 'Voltar ao ERP' ? 'ERP' : item.label}
              </span>
            </Link>
          )
        })}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', flexShrink: 0, margin: '0 4px' }} />

        <button
          onClick={() => {
            setCurrentUserPerfil('');
            setCurrentUser(null);
            window.location.href = '/login';
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#ef4444',
            minWidth: 60,
            cursor: 'pointer'
          }}
        >
          <div style={{ padding: '6px 14px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <LogOut size={18} />
          </div>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Sair</span>
        </button>
      </div>
    )
  }

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
        {activeNavItems.map((item, idx) => {
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

        {/* User Profile Frame */}
        <div style={{
          marginTop: 'auto',
          marginBottom: '16px',
          padding: collapsed ? '12px 0' : '12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
          }}>
            <User size={18} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'white', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser?.nome || 'Usuário'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                {currentUserPerfil || 'Admin'}
              </div>
            </div>
          )}
        </div>

        {/* Botão Sair - Ultra Moderno */}
        <button
          onClick={() => {
            setCurrentUserPerfil('');
            setCurrentUser(null);
            window.location.href = '/login';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 14,
            padding: collapsed ? '12px 0' : '12px 16px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.1))',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 4px 12px rgba(239,68,68,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.2))'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(239,68,68,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.1))'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.1)'
          }}
        >
          <LogOut size={18} />
          {!collapsed && <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>Sair da Conta</span>}
        </button>
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
