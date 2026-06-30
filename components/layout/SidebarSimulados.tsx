'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Layers, Settings, FileText, Library, ChevronLeft, ChevronRight, PenTool, LogOut, User, Activity, Sparkles
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
  { label: 'Gerenciar Simulados', href: '/simulados/gerenciamento', icon: <PenTool size={18} /> },
  { label: 'Meus Simulados', href: '/simulados/lista', icon: <FileText size={18} /> },
  { label: 'Gerenciar Provas', href: '/provas/gerenciamento', icon: <PenTool size={18} /> },
  { label: 'Minhas Provas', href: '/provas/lista', icon: <FileText size={18} /> },
  { label: 'Banco de Questões', href: '/simulados/banco', icon: <Library size={18} /> },
  { label: 'Bimestres', href: '/simulados/cadastros/bimestres', icon: <Layers size={18} /> },
  { label: 'Disciplinas', href: '/simulados/cadastros/disciplinas', icon: <BookOpen size={18} /> },
  { label: 'Professores', href: '/simulados/cadastros/professores', icon: <Users size={18} /> },
  { label: 'Configurações', href: '/simulados/configuracoes', icon: <Settings size={18} /> },
  { label: 'Voltar ao ERP', href: '/login?step=choose_system', icon: <ChevronLeft size={18} /> },
  { label: 'Trocar Sistema', href: '/login?step=choose_system', icon: <ChevronLeft size={18} /> },
]

export function SidebarSimulados() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const { currentUserPerfil, setCurrentUserPerfil, currentUser, setCurrentUser } = useApp()

  const isProfessor = currentUserPerfil === 'Professor'

  const activeNavItems = NAV_ITEMS.filter(item => {
    if (isProfessor) {
      return ['Dashboard', 'Meus Simulados', 'Minhas Provas', 'Gerenciar Provas', 'Trocar Sistema'].includes(item.label)
    }
    return item.label !== 'Trocar Sistema'
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
          <div style={{ padding: '8px 16px', borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <LogOut size={18} />
          </div>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Sair</span>
        </button>
      </div>
    )
  }

  return (
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
        {activeNavItems.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== '/simulados' && item.href !== '/login?step=choose_system' && pathname?.startsWith(item.href))
          const isBack = item.href === '/login?step=choose_system'

          return (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', marginTop: isBack && idx === activeNavItems.length - 2 ? 'auto' : 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 16,
                padding: collapsed ? '12px 0' : '14px 18px',
                borderRadius: 16,
                background: isActive ? 'linear-gradient(90deg, rgba(244,63,94,0.1) 0%, rgba(244,63,94,0.02) 100%)' : 'transparent',
                color: isActive ? '#fb7185' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive ? '1px solid rgba(244,63,94,0.2)' : '1px solid transparent',
                position: 'relative',
                overflow: 'hidden'
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
          marginTop: activeNavItems.some(i => i.href === '/login?step=choose_system') ? 16 : 'auto',
          marginBottom: 16,
          padding: collapsed ? '12px 0' : '16px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 14,
          transition: 'all 0.3s'
        }}>
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

        {/* Botão Sair */}
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
            gap: 16,
            padding: collapsed ? '14px 0' : '14px 18px',
            borderRadius: 16,
            background: 'rgba(239,68,68,0.05)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.1)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(239,68,68,0.4)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.05)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.1)'
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <LogOut size={20} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Encerrar Sessão
              </motion.span>
            )}
          </AnimatePresence>
        </button>
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
  )
}
