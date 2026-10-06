'use client'

import { performLogout } from "@/lib/auth/logout"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, PlusCircle, Library, FileCheck2, LogOut,
  User, Loader2, Sparkles, ChevronLeft, ChevronRight, Award,
  Clock, Shield, BookOpen, Layers, Users, Activity, CheckSquare
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'
import { TrocarModuloModal } from '@/components/layout/TrocarModuloModal'

interface NavItem {
  label: string
  shortLabel?: string
  href: string
  icon: React.ReactNode
  badge?: string
  badgeColor?: 'blue' | 'green' | 'amber'
  isLivePulse?: boolean
}

export function SidebarProvasOnline() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isTrocarModuloOpen, setIsTrocarModuloOpen] = useState(false)
  const { currentUserPerfil, currentUser } = useApp()

  const isStudent = currentUser?.cargo === 'Aluno' || currentUser?.perfil === 'Aluno' || Boolean(currentUser?.aluno_id && currentUser?.cargo !== 'Responsável')
  const isResponsible = (currentUser?.cargo === 'Responsável' || currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável') && !isStudent
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

  const [liveCount, setLiveCount] = useState(0)
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0)

  useEffect(() => {
    if (isStudent || isResponsible) return
    let isCancelled = false
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/provas-online')
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data) && !isCancelled) {
          const live = data.filter((p: any) => p.status === 'em_aplicacao' || (p.stats && p.stats.emAndamento > 0)).length
          const pending = data.reduce((acc: number, p: any) => acc + (p.stats?.correcaoPendente || 0), 0)
          setLiveCount(live)
          setPendingCorrectionsCount(pending)
        }
      } catch (e) {
        // silent
      }
    }
    fetchCounts()
    const timer = setInterval(fetchCounts, 30000)
    return () => {
      isCancelled = true
      clearInterval(timer)
    }
  }, [isStudent, isResponsible])

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
        {
          label: 'Supervisão',
          shortLabel: 'Supervisão',
          href: '/provas-online/supervisao',
          icon: <Activity size={20} className={liveCount > 0 ? 'text-emerald-400' : ''} />,
          badge: liveCount > 0 ? `${liveCount} ao vivo` : undefined,
          badgeColor: 'green',
          isLivePulse: liveCount > 0
        },
        {
          label: 'Corrigir',
          shortLabel: 'Corrigir',
          href: '/provas-online/corrigir',
          icon: <CheckSquare size={20} className={pendingCorrectionsCount > 0 ? 'text-amber-400' : ''} />,
          badge: pendingCorrectionsCount > 0 ? String(pendingCorrectionsCount) : undefined,
          badgeColor: 'amber'
        },
        { label: 'Nova Avaliação', shortLabel: 'Nova', href: '/provas-online/nova', icon: <PlusCircle size={20} />, badge: 'Criar' },
      ]

  const overlay = isLoggingOut ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <Loader2 className="animate-spin" size={48} color="#38bdf8" />
      <span style={{ color: '#ffffff', fontWeight: 700, letterSpacing: '0.05em' }}>Saindo...</span>
    </div>
  ) : null

  // Mobile Bottom Navigation Bar (Ultra-modern dark gradient frosted glass)
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
            background: 'linear-gradient(180deg, rgba(13, 21, 39, 0.95) 0%, rgba(5, 8, 17, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px)',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)'
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
                  gap: 3,
                  textDecoration: 'none',
                  color: isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.55)',
                  fontSize: 10,
                  fontWeight: isActive ? 800 : 600,
                  transition: 'all 0.2s',
                  padding: '5px 8px',
                  borderRadius: 12,
                  background: isActive ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(2, 132, 199, 0.1) 100%)' : 'transparent',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 16px rgba(14, 165, 233, 0.25)' : 'none',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                  {item.badge && (
                    <span style={{
                      position: 'absolute',
                      top: -6,
                      right: -10,
                      fontSize: 9,
                      fontWeight: 900,
                      padding: '1px 5px',
                      borderRadius: 99,
                      background: item.badgeColor === 'amber' ? '#f59e0b' : item.badgeColor === 'green' ? '#10b981' : '#0284c7',
                      color: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      lineHeight: 1
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span style={{ whiteSpace: 'nowrap' }}>{item.shortLabel || item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setIsTrocarModuloOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px'
            }}
          >
            <Layers size={20} />
            <span>Módulos</span>
          </button>
        </nav>
      </>
    )
  }

  // Desktop Sidebar (Ultra modern gradient)
  return (
    <>
      {overlay}
      <aside
        style={{
          width: collapsed ? 80 : 260,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100vh',
          background: 'linear-gradient(175deg, #090e1c 0%, #0c162c 45%, #050812 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 50,
          flexShrink: 0,
          boxShadow: '4px 0 28px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Subtle luminous ambient glow at top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: 'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.18) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none'
        }} />

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
            background: '#0c162c',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 60,
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.borderColor = '#38bdf8' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)' }}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Top Header / Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            padding: collapsed ? '24px 16px' : '24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px -2px rgba(2, 132, 199, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
              flexShrink: 0
            }}>
              <FileCheck2 size={22} color="#ffffff" />
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  Provas Online
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
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
                    background: isActive ? 'linear-gradient(90deg, rgba(14, 165, 233, 0.2) 0%, rgba(14, 165, 233, 0.05) 100%)' : 'transparent',
                    border: isActive ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                    color: isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
                    boxShadow: isActive ? '0 0 18px rgba(14, 165, 233, 0.15)' : 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.color = '#ffffff'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)'
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <div style={{ color: isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                      background: item.badgeColor === 'green' ? 'rgba(16, 185, 129, 0.2)' : item.badgeColor === 'amber' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(14, 165, 233, 0.2)',
                      color: item.badgeColor === 'green' ? '#34d399' : item.badgeColor === 'amber' ? '#fbbf24' : '#38bdf8',
                      border: `1px solid ${item.badgeColor === 'green' ? 'rgba(52, 211, 153, 0.4)' : item.badgeColor === 'amber' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}>
                      {item.isLivePulse && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} className="animate-pulse" />
                      )}
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
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          zIndex: 1
        }}>
          {/* Quick Module Switcher */}
          {!collapsed ? (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setIsTrocarModuloOpen(true)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.16)'
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)'
                }}
              >
                <Layers size={16} />
                <span>Trocar Módulo</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <button
                type="button"
                title="Trocar Módulo"
                onClick={() => setIsTrocarModuloOpen(true)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.16)'
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)'
                }}
              >
                <Layers size={18} />
              </button>
            </div>
          )}

          {/* User Card */}
          <div style={{
            padding: collapsed ? '8px' : '10px 12px',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
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
                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
              }}>
                {currentUser?.nome?.[0] || 'U'}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.nome || 'Usuário'}
                  </div>
                  <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
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
                  color: 'rgba(255, 255, 255, 0.45)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'; e.currentTarget.style.background = 'transparent' }}
                title="Sair do sistema"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <TrocarModuloModal 
        isOpen={isTrocarModuloOpen} 
        onClose={() => setIsTrocarModuloOpen(false)} 
      />
    </>
  )
}
