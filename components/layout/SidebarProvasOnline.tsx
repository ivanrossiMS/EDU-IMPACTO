'use client'

import { performLogout } from "@/lib/auth/logout"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, PlusCircle, Library, FileCheck2, LogOut,
  User, Loader2, Sparkles, ChevronLeft, ChevronRight, Award,
  Clock, Shield, BookOpen, Layers, Users
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'

interface NavItem {
  label: string
  shortLabel?: string
  href: string
  icon: React.ReactNode
  badge?: string
}

export function SidebarProvasOnline() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { currentUserPerfil, currentUser } = useApp()

  const isStudent = currentUser?.cargo === 'Aluno' || currentUser?.perfil === 'Aluno' || Boolean(currentUser?.aluno_id && currentUser?.cargo !== 'Responsável')
  const isResponsible = currentUser?.cargo === 'Responsável' || currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável'
  const isTeacherOrStaff = !isStudent && !isResponsible

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await performLogout()
    } catch (e) {
      window.location.replace('/login')
    }
  }

  // Force close on mobile
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  const navItems: NavItem[] = isStudent
    ? [
        { label: 'Minhas Provas', shortLabel: 'Provas', href: '/provas-online', icon: <FileCheck2 size={20} /> },
        { label: 'Resultados & Devolutivas', shortLabel: 'Notas', href: '/provas-online?tab=publicada', icon: <Award size={20} /> },
      ]
    : isResponsible
    ? [
        { label: 'Provas do Dependente', shortLabel: 'Provas', href: '/provas-online', icon: <FileCheck2 size={20} /> },
        { label: 'Devolutivas & Notas', shortLabel: 'Boletim', href: '/provas-online?tab=publicada', icon: <Award size={20} /> },
      ]
    : [
        { label: 'Dashboard', shortLabel: 'Início', href: '/provas-online', icon: <LayoutDashboard size={20} /> },
        { label: 'Nova Avaliação', shortLabel: 'Nova', href: '/provas-online/nova', icon: <PlusCircle size={20} />, badge: 'Criar' },
      ]

  const overlay = isLoggingOut ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <Loader2 className="animate-spin" size={48} color="#0284c7" />
      <span style={{ color: '#0f172a', fontWeight: 700, letterSpacing: '0.05em' }}>Saindo...</span>
    </div>
  ) : null

  // Mobile Bottom Navigation Bar (Light clean)
  if (isMobile) {
    return (
      <>
        {overlay}
        <nav 
          aria-label="Navegação inferior móvel"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid #e2e8f0',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)'
          }}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/provas-online' && pathname.startsWith(item.href))
            return (
              <Link 
                key={item.href} 
                href={item.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  color: isActive ? '#0284c7' : '#64748b',
                  fontSize: 11,
                  fontWeight: isActive ? 800 : 600,
                  transition: 'all 0.2s',
                  padding: '4px 8px',
                  borderRadius: 10,
                  background: isActive ? '#e0f2fe' : 'transparent'
                }}
              >
                {item.icon}
                <span>{item.shortLabel || item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => router.push('/login?step=choose_system')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            <Layers size={20} />
            <span>Módulos</span>
          </button>
        </nav>
      </>
    )
  }

  // Desktop Sidebar (Clean, crisp, light)
  return (
    <>
      {overlay}
      <aside
        style={{
          width: collapsed ? 80 : 260,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100vh',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 50,
          flexShrink: 0,
          boxShadow: '2px 0 12px rgba(0, 0, 0, 0.03)'
        }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute',
            right: -12,
            top: 28,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            zIndex: 60,
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.borderColor = '#0284c7' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#cbd5e1' }}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Top Header / Brand */}
        <div>
          <div style={{
            padding: collapsed ? '24px 16px' : '24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(2, 132, 199, 0.25)',
              flexShrink: 0
            }}>
              <FileCheck2 size={22} color="#ffffff" />
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Provas Online
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Avaliações Digitais
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/provas-online' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: collapsed ? '12px' : '12px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 14,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    background: isActive ? '#f0f9ff' : 'transparent',
                    border: isActive ? '1px solid #bae6fd' : '1px solid transparent',
                    color: isActive ? '#0369a1' : '#475569'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#475569'
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <div style={{ color: isActive ? '#0284c7' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.icon}
                  </div>
                  {!collapsed && (
                    <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, letterSpacing: '-0.01em', flex: 1 }}>
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#e0f2fe',
                      color: '#0284c7',
                      border: '1px solid #bae6fd'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Bottom Section: Module Switcher & User Profile */}
        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {/* Quick Module Switcher */}
          {!collapsed && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
                Alternar Módulo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                <Link href="/dashboard" style={{ textDecoration: 'none' }} title="Gestão Escolar (ERP)">
                  <div style={{
                    height: 38,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    🏢
                  </div>
                </Link>

                <Link href="/agenda-digital" style={{ textDecoration: 'none' }} title="Agenda Digital">
                  <div style={{
                    height: 38,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#faf5ff'; e.currentTarget.style.borderColor = '#d8b4fe' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    📱
                  </div>
                </Link>

                <Link href="/gestao-pessoas" style={{ textDecoration: 'none' }} title="Gestão de Pessoas">
                  <div style={{
                    height: 38,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    👥
                  </div>
                </Link>

                <Link href="/simulados" style={{ textDecoration: 'none' }} title="Provas e Simulados">
                  <div style={{
                    height: 38,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.borderColor = '#fecdd3' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    📝
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* User Card */}
          <div style={{
            padding: collapsed ? '8px' : '10px 12px',
            borderRadius: 14,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0
              }}>
                {currentUser?.nome?.[0] || 'U'}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.nome || 'Usuário'}
                  </div>
                  <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 700 }}>
                    {currentUserPerfil || currentUser?.cargo || 'Colaborador'}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
                title="Sair do sistema"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
