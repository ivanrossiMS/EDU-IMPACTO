'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Layers, Settings, FileText, Library, ChevronLeft, ChevronRight, PenTool, LogOut, User, Activity, Sparkles, Loader2
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  groupId?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/simulados', icon: <LayoutDashboard size={18} /> },
  { label: 'Gerenciar Simulados', href: '/simulados/gerenciamento', icon: <PenTool size={18} />, groupId: 'simulados' },
  { label: 'Meus Simulados', href: '/simulados/lista', icon: <FileText size={18} />, groupId: 'simulados' },
  { label: 'Gerenciar Provas', href: '/provas/gerenciamento', icon: <PenTool size={18} />, groupId: 'provas' },
  { label: 'Minhas Provas', href: '/provas/lista', icon: <FileText size={18} />, groupId: 'provas' },
  { label: 'Gerenciar Redação ENEM', href: '/redacao-enem/gerenciamento', icon: <PenTool size={18} />, groupId: 'redacao' },
  { label: 'Minhas Redações ENEM', href: '/redacao-enem/lista', icon: <FileText size={18} />, groupId: 'redacao' },
  { label: 'Banco de Questões', href: '/simulados/banco', icon: <Library size={18} /> },
  { label: 'Configurações', href: '/simulados/configuracoes', icon: <Settings size={18} /> },
]

export function SidebarSimulados() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { currentUserPerfil, setCurrentUserPerfil, currentUser, setCurrentUser } = useApp()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch(e) {}
    setCurrentUserPerfil('');
    setCurrentUser(null);
    window.location.href = '/login';
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

  const isProfessor = currentUserPerfil === 'Professor'

  const activeNavItems = NAV_ITEMS.filter(item => {
    if (isProfessor) {
      return ['Dashboard', 'Meus Simulados', 'Minhas Provas', 'Gerenciar Provas', 'Minhas Redações ENEM'].includes(item.label)
    }
    return true
  }).map(item => {
    if (!isProfessor) {
      if (item.label === 'Meus Simulados') return { ...item, label: 'Todos Simulados' }
      if (item.label === 'Minhas Provas') return { ...item, label: 'Todas Provas' }
      if (item.label === 'Minhas Redações ENEM') return { ...item, label: 'Todas Redações ENEM' }
    }
    return item;
  })

  // Force close on mobile default
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  if (isMobile) {
    return (
      <>
      {overlay}
      <div 
        className="no-scrollbar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 70,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 12px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          gap: 16,
          zIndex: 100,
          overflowX: 'auto',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.5)'
        }}
      >
        {activeNavItems.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/login?step=choose_system' && pathname?.startsWith(item.href))
          return (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 60 }}>
              <div style={{
                color: isActive ? '#f43f5e' : 'rgba(255,255,255,0.5)',
                padding: '8px 16px',
                borderRadius: 100,
                background: isActive ? 'rgba(244,63,94,0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(244,63,94,0.3), 0 4px 10px rgba(244,63,94,0.2)' : 'none'
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 10, color: isActive ? '#f43f5e' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 700 : 500, transition: 'all 0.2s' }}>
                {item.label === 'Dashboard' ? 'Início' : item.label === 'Voltar ao ERP' ? 'Seleção' : item.label === 'Trocar Sistema' ? 'Seleção' : item.label}
              </span>
            </Link>
          )
        })}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', flexShrink: 0, margin: '0 4px' }} />

        <button
          onClick={handleLogout}
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
          <div style={{ padding: '8px 16px', borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <LogOut size={18} />
          </div>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Sair</span>
        </button>
      </div>
      </>
    )
  }

  return (
    <>
    {overlay}
    <motion.div 
      animate={{ width: collapsed ? 88 : 280 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        height: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 50,
        flexShrink: 0,
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)'
      }}
    >
      {/* Decorative Glow */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: 'radial-gradient(circle at 50% 0%, rgba(244,63,94,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />

      <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(244,63,94,0.5)' }}>
                <Activity size={22} color="white" strokeWidth={2.5} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, color: 'white', fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1 }}>SIMULADOS</span>
                  <Sparkles size={14} color="#f43f5e" />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.05em', marginTop: 4, textTransform: 'uppercase' }}>Sistema de Provas</div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(244,63,94,0.5)' }}>
              <Activity size={22} color="white" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }} className="no-scrollbar">
        {activeNavItems.map((item, idx, arr) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/login?step=choose_system' && pathname?.startsWith(item.href))
          const isBack = item.href === '/login?step=choose_system'

          const hasPrevInGroup = item.groupId && arr[idx - 1]?.groupId === item.groupId
          const isChild = hasPrevInGroup

          return (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', marginTop: isBack && idx === activeNavItems.length - 2 ? 'auto' : (isChild ? -6 : 0) }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 16,
                padding: collapsed ? '10px 0' : (isChild ? '10px 18px 10px 42px' : '10px 18px'),
                borderRadius: 14,
                background: isActive ? 'linear-gradient(90deg, rgba(244,63,94,0.1) 0%, rgba(244,63,94,0.02) 100%)' : 'transparent',
                color: isActive ? '#fb7185' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive ? '1px solid rgba(244,63,94,0.2)' : '1px solid transparent',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.transform = 'translateX(4px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                  e.currentTarget.style.transform = 'translateX(0)'
                }
              }}
              >
                {!collapsed && isChild && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: 27,
                    width: 11,
                    height: 31,
                    borderLeft: `1.5px solid ${isActive ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderBottom: `1.5px solid ${isActive ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderBottomLeftRadius: 10,
                    pointerEvents: 'none',
                    zIndex: 0,
                    transition: 'all 0.3s ease'
                  }} />
                )}

                {isActive && !collapsed && (
                  <motion.div layoutId="activeNavIndicator" style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3, background: '#f43f5e', borderRadius: '0 4px 4px 0', boxShadow: '0 0 10px rgba(244,63,94,0.5)' }} />
                )}
                
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', zIndex: 1, letterSpacing: '-0.01em' }}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          )
        })}

        {/* User Profile Frame */}
        <div style={{
          marginTop: 'auto',
          marginBottom: 16,
          padding: collapsed ? '12px 0' : '16px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'stretch',
          gap: 14,
          transition: 'all 0.3s'
        }}>
          {/* User Info (Icon + Name) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 14 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}>
              <User size={20} strokeWidth={2.5} />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', letterSpacing: '-0.01em' }}>
                    {currentUser?.nome || 'Usuário'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {currentUserPerfil || 'Admin'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons inside Card */}
          <AnimatePresence>
            {!collapsed ? (
              <motion.div key="expanded" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => window.location.href = '/login?step=choose_system'}
                  style={{
                    width: '100%', height: 34, borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(121, 40, 202, 0.15))',
                    border: '1px solid rgba(0, 210, 255, 0.3)',
                    color: '#00D2FF', fontSize: 11, fontWeight: 700, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 15px rgba(0, 210, 255, 0.1)',
                    position: 'relative', overflow: 'hidden', textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 210, 255, 0.25), rgba(121, 40, 202, 0.25))';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 210, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(121, 40, 202, 0.15))';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 210, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <LayoutDashboard size={14} style={{ zIndex: 1 }} />
                  <span style={{ zIndex: 1 }}>Trocar de Módulo</span>
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', height: 34, borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444', fontSize: 11, fontWeight: 700, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                  }}
                >
                  <LogOut size={14} /> Sair
                </button>
              </motion.div>
            ) : (
              <motion.div key="collapsed" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', width: '100%', padding: '0 8px' }}>
                <button
                  title="Trocar de Módulo"
                  onClick={() => window.location.href = '/login?step=choose_system'}
                  style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(121, 40, 202, 0.15))', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D2FF', cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 210, 255, 0.25), rgba(121, 40, 202, 0.25))' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(121, 40, 202, 0.15))' }}
                >
                  <LayoutDashboard size={18} />
                </button>
                <button
                  title="Sair"
                  onClick={handleLogout}
                  style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                >
                  <LogOut size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
          }}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </motion.div>
    </>
  )
}
