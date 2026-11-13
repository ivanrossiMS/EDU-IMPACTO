'use client'
import { performLogout } from "@/lib/auth/logout";

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Layers, Settings, FileText, Library, ChevronLeft, ChevronRight, PenTool, LogOut, User, Activity, Loader2, Upload, FolderArchive, Sparkles, Grid, UserCircle
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'
import { TrocarModuloModal } from '@/components/layout/TrocarModuloModal'
import { UserAvatar } from '@/components/UserAvatar'

interface NavItem {
  label: string
  shortLabel?: string
  profLabel?: string
  href: string
  icon: React.ReactNode
  section: 'Principal' | 'Fluxos de Upload' | 'Acervo' | 'Sistema'
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Início', href: '/simulados', icon: <LayoutDashboard size={18} />, section: 'Principal' },
  { label: 'Provas via Upload', shortLabel: 'Provas', profLabel: 'Minhas Provas', href: '/simulados/provas-upload', icon: <FileText size={18} />, section: 'Fluxos de Upload' },
  { label: 'Simulados via Upload', shortLabel: 'Simulados', profLabel: 'Meus Simulados', href: '/simulados/simulados-upload', icon: <BookOpen size={18} />, section: 'Fluxos de Upload' },
  { label: 'Redação via Upload', shortLabel: 'Redações', profLabel: 'Minhas Redações', href: '/simulados/redacao-upload', icon: <PenTool size={18} />, section: 'Fluxos de Upload' },
  { label: 'Arquivo Adaptadas', shortLabel: 'Adaptadas', href: '/simulados/arquivo-adaptadas', icon: <FolderArchive size={18} />, section: 'Acervo' },
  { label: 'Banco de Questões', shortLabel: 'Banco', href: '/simulados/banco', icon: <Library size={18} />, section: 'Acervo' },
  { label: 'Configurações', shortLabel: 'Config', href: '/simulados/configuracoes', icon: <Settings size={18} />, section: 'Sistema' },
  { label: 'Ajuda', shortLabel: 'Ajuda', href: '/ajuda', icon: <Sparkles size={18} />, section: 'Sistema' },
]

export function SidebarSimulados() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isTrocarModuloOpen, setIsTrocarModuloOpen] = useState(false)
  const { currentUserPerfil, setCurrentUserPerfil, currentUser, setCurrentUser } = useApp()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await performLogout()
    } catch (e) {
      window.location.replace('/login')
    }
  }

  const overlay = isLoggingOut ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <Loader2 className="animate-spin" size={48} color="#3b82f6" />
      <span style={{ color: 'white', fontWeight: 600, letterSpacing: '0.05em' }}>Saindo...</span>
    </div>
  ) : null;

  const isProfessor = currentUserPerfil === 'Professor' || currentUser?.cargo?.toLowerCase()?.includes('prof') || currentUser?.perfil?.toLowerCase()?.includes('prof')
  const isAdmin = [
    'Direção',
    'Administrador',
    'Diretor Geral',
    'Administrador Master'
  ].includes(currentUserPerfil || '') || [
    'Direção',
    'Administrador',
    'Diretor Geral',
    'Administrador Master'
  ].includes(currentUser?.perfil || '') || [
    'Direção',
    'Administrador',
    'Diretor Geral',
    'Administrador Master'
  ].includes(currentUser?.cargo || '')

  const showProfileButton = true
  const isPerfilActive = pathname === '/simulados/perfil'

  const activeNavItems = NAV_ITEMS.filter(item => {
    if (isProfessor) {
      return ['Dashboard', 'Provas via Upload', 'Simulados via Upload', 'Redação via Upload', 'Ajuda'].includes(item.label)
    }
    return true
  }).map(item => {
    if (isProfessor) {
      if (item.label === 'Provas via Upload') return { ...item, label: 'Minhas Provas', shortLabel: 'Minhas Provas' }
      if (item.label === 'Simulados via Upload') return { ...item, label: 'Meus Simulados', shortLabel: 'Meus Simulados' }
      if (item.label === 'Redação via Upload') return { ...item, label: 'Minhas Redações', shortLabel: 'Redações' }
    }
    return item
  })

  // Force close on mobile default
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  if (isMobile) {
    const mobileNavItems = activeNavItems.filter(item => item.label !== 'Banco de Questões')

    return (
      <>
      {overlay}
      <nav 
        aria-label="Navegação inferior móvel"
        className="no-scrollbar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(2, 6, 23, 0.97) 100%)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          paddingLeft: 12,
          paddingRight: 12,
          gap: 6,
          zIndex: 9999,
          overflowX: 'auto',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth'
        }}
      >
        {mobileNavItems.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/login?step=choose_system' && pathname?.startsWith(item.href))
          const displayLabel = item.shortLabel || (item.label === 'Dashboard' ? 'Início' : item.label)
          return (
            <Link 
              key={idx} 
              href={item.href} 
              style={{ 
                textDecoration: 'none', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 4, 
                flexShrink: 0, 
                minWidth: 62,
                padding: '4px 6px',
                borderRadius: 14,
                position: 'relative'
              }}
            >
              <motion.div 
                whileTap={{ scale: 0.9 }}
                style={{
                  color: isActive ? '#ff4d6d' : 'rgba(255,255,255,0.48)',
                  padding: '7px 15px',
                  borderRadius: 16,
                  background: isActive ? 'linear-gradient(135deg, rgba(244,63,94,0.22) 0%, rgba(225,29,72,0.1) 100%)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive ? '1px solid rgba(244,63,94,0.4)' : '1px solid rgba(255,255,255,0.03)',
                  boxShadow: isActive ? '0 0 18px rgba(244,63,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none'
                }}
              >
                {item.icon}
                {isActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: -3,
                      width: 14,
                      height: 3,
                      borderRadius: 2,
                      background: '#f43f5e',
                      boxShadow: '0 0 10px #f43f5e'
                    }}
                  />
                )}
              </motion.div>
              <span style={{ 
                fontSize: 10.5, 
                color: isActive ? '#ff4d6d' : 'rgba(255,255,255,0.5)', 
                fontWeight: isActive ? 700 : 500, 
                letterSpacing: isActive ? '-0.01em' : '0',
                transition: 'all 0.2s', 
                whiteSpace: 'nowrap',
                textShadow: isActive ? '0 0 10px rgba(244,63,94,0.3)' : 'none'
              }}>
                {displayLabel}
              </span>
            </Link>
          )
        })}

        <div style={{ width: 1, height: 26, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%)', flexShrink: 0, margin: '0 4px' }} />

        {/* Botão Perfil (Mobile) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.push('/simulados/perfil')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: isPerfilActive ? '#c084fc' : '#a855f7',
            minWidth: 62,
            padding: '4px 6px',
            borderRadius: 14,
            cursor: 'pointer'
          }}
        >
          <div style={{ 
            padding: '7px 15px', 
            borderRadius: 16, 
            background: isPerfilActive ? 'rgba(168, 85, 247, 0.22)' : 'rgba(168, 85, 247, 0.08)',
            border: isPerfilActive ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(168, 85, 247, 0.2)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#a855f7'
          }}>
             <UserCircle size={20} />
          </div>
          <span style={{ fontSize: 10.5, color: isPerfilActive ? '#c084fc' : '#a855f7', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>Perfil</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsTrocarModuloOpen(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#06b6d4',
            minWidth: 62,
            padding: '4px 6px',
            borderRadius: 14,
            cursor: 'pointer'
          }}
        >
          <div style={{ 
            padding: '7px 15px', 
            borderRadius: 16, 
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#06b6d4'
          }}>
             <Grid size={20} />
          </div>
          <span style={{ fontSize: 10.5, color: '#06b6d4', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>Módulos</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#ef4444',
            minWidth: 62,
            padding: '4px 6px',
            borderRadius: 14,
            cursor: 'pointer'
          }}
        >
          <div style={{ 
            padding: '7px 15px', 
            borderRadius: 16, 
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ef4444'
          }}>
             <LogOut size={20} />
          </div>
          <span style={{ fontSize: 10.5, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>Sair</span>
        </motion.button>
      </nav>
      </>
    )
  }

  return (
    <>
    {overlay}
    <motion.div 
      animate={{ width: collapsed ? 84 : 272 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        height: '100dvh',
        background: 'linear-gradient(180deg, #0b1120 0%, #030712 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 50,
        flexShrink: 0,
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)'
      }}
    >
      {/* Decorative Glow */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, background: 'radial-gradient(circle at 30% 0%, rgba(244,63,94,0.14) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />

      {/* Header + Integrated Collapse Toggle */}
      <div style={{ padding: collapsed ? '20px 14px 16px' : '22px 16px 18px 20px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div key="expanded-brand" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -4px rgba(244,63,94,0.5)', flexShrink: 0 }}>
                <Activity size={19} color="white" strokeWidth={2.5} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, color: 'white', fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Provas & Simulados
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', fontWeight: 600, letterSpacing: '0.06em', marginTop: 2, textTransform: 'uppercase' }}>
                  Sistema de Provas
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed-brand"
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expandir menu"
              aria-label="Expandir menu"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -4px rgba(244,63,94,0.5)', border: 'none', cursor: 'pointer' }}
            >
              <Activity size={19} color="white" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
            }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }} className="no-scrollbar">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expandir menu"
            aria-label="Expandir menu"
            style={{
              width: '100%',
              padding: '8px 0',
              marginBottom: 6,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={16} />
          </button>
        )}

        {activeNavItems.map((item, idx, arr) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/login?step=choose_system' && pathname?.startsWith(item.href))
          const showSectionHeader = !collapsed && (idx === 0 || arr[idx - 1].section !== item.section)

          return (
            <div key={item.href} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {showSectionHeader && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(148, 163, 184, 0.52)',
                  padding: idx === 0 ? '2px 12px 4px' : '12px 12px 4px',
                  userSelect: 'none'
                }}>
                  {item.section}
                </div>
              )}

              <Link href={item.href} title={collapsed ? item.label : undefined} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 12,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: 12,
                  background: isActive ? 'linear-gradient(90deg, rgba(244,63,94,0.14) 0%, rgba(244,63,94,0.03) 100%)' : 'transparent',
                  color: isActive ? '#fda4af' : 'rgba(226,232,240,0.65)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive ? '1px solid rgba(244,63,94,0.24)' : '1px solid transparent',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.045)'
                    e.currentTarget.style.color = '#ffffff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(226,232,240,0.65)'
                  }
                }}
                >
                  {isActive && !collapsed && (
                    <motion.div layoutId="activeNavIndicator" style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: '#f43f5e', borderRadius: '0 4px 4px 0', boxShadow: '0 0 10px rgba(244,63,94,0.55)' }} />
                  )}
                  
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#fb7185' : 'inherit' }}>
                    {item.icon}
                  </div>
                  
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', zIndex: 1, letterSpacing: '-0.01em' }}>
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            </div>
          )
        })}

        {/* User Profile Frame */}
        <div style={{
          marginTop: 'auto',
          marginBottom: 16,
          padding: '0 8px',
          transition: 'all 0.3s'
        }}>
          {/* User Card */}
          <div 
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: collapsed ? '10px 6px' : '12px 12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Top row: Avatar + Name/Role + Notification */}
            <div 
              onClick={() => router.push('/simulados/perfil')}
              title="Acessar meu perfil"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                justifyContent: collapsed ? 'center' : 'flex-start',
                cursor: 'pointer',
                borderRadius: 12,
                padding: '2px',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <UserAvatar 
                  key={currentUser?.foto || 'default'}
                  userId={currentUser?.id} 
                  name={currentUser?.nome || 'Usuário'} 
                  fotoUrl={currentUser?.foto}
                  size={collapsed ? 36 : 40} 
                  style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }} 
                />
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '2px solid #060814', boxShadow: '0 0 8px #10b981' }} />
              </div>
              
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                    {currentUser?.nome || 'Usuário'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.cargo || currentUser?.perfil || 'Colaborador'}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Row: Meu Perfil, Trocar Módulo, Sair - DENTRO DO CARD */}
            {!collapsed ? (
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: showProfileButton ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
                  gap: 4, 
                  background: 'rgba(0, 0, 0, 0.22)',
                  padding: '3px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                {/* 1. Meu Perfil */}
                {showProfileButton && (
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(168, 85, 247, 0.18)', color: '#ffffff' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      router.push('/simulados/perfil');
                    }}
                    title="Meu Perfil"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '6px 4px',
                      borderRadius: 9,
                      background: isPerfilActive ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
                      border: isPerfilActive ? '1px solid rgba(168, 85, 247, 0.45)' : 'none',
                      color: isPerfilActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: isPerfilActive ? 700 : 600,
                      letterSpacing: '0.01em',
                      boxShadow: isPerfilActive ? '0 0 10px rgba(168, 85, 247, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <UserCircle size={14} color="#a855f7" style={{ filter: 'drop-shadow(0 0 5px rgba(168, 85, 247, 0.4))', flexShrink: 0 }} />
                    <span>Perfil</span>
                  </motion.button>
                )}

                {/* 2. Trocar Módulo */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(6, 182, 212, 0.16)', color: '#ffffff' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsTrocarModuloOpen(true)}
                  title="Trocar Módulo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '6px 4px',
                    borderRadius: 9,
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LayoutDashboard size={14} color="#06b6d4" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.4))', flexShrink: 0 }} />
                  <span>Módulos</span>
                </motion.button>

                {/* 3. Sair */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(244, 63, 94, 0.16)', color: '#ffffff' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLogout}
                  title="Sair do sistema"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '6px 4px',
                    borderRadius: 9,
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LogOut size={14} color="#f43f5e" style={{ filter: 'drop-shadow(0 0 5px rgba(244, 63, 94, 0.4))', flexShrink: 0 }} />
                  <span>Sair</span>
                </motion.button>
              </div>
            ) : (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 5, 
                  background: 'rgba(0, 0, 0, 0.22)',
                  padding: '3px',
                  borderRadius: 10,
                  width: '100%' 
                }}
              >
                {showProfileButton && (
                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(168, 85, 247, 0.25)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/simulados/perfil')}
                    title="Meu Perfil"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: isPerfilActive ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                      border: isPerfilActive ? '1px solid rgba(168, 85, 247, 0.45)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#a855f7',
                      boxShadow: isPerfilActive ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none'
                    }}
                  >
                    <UserCircle size={15} />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(6, 182, 212, 0.18)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsTrocarModuloOpen(true)}
                  title="Trocar Módulo"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#06b6d4'
                  }}
                >
                  <LayoutDashboard size={15} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(244, 63, 94, 0.18)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  title="Sair"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#f43f5e'
                  }}
                >
                  <LogOut size={15} />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </motion.div>

    <TrocarModuloModal 
      isOpen={isTrocarModuloOpen} 
      onClose={() => setIsTrocarModuloOpen(false)} 
    />
    </>
  )
}
