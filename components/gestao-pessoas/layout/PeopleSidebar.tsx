'use client'
import { performLogout } from "@/lib/auth/logout";

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import {
  Users, Activity, ShieldAlert,
  ClipboardCheck, GraduationCap,
  MessageSquareWarning, Settings,
  LogOut, Home, Stethoscope, Heart, PieChart, Grid
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const MENUS = [
  { href: '/gestao-pessoas', icon: Home, label: 'Visão Geral' },
  { href: '/gestao-pessoas/saude-mental', icon: Heart, label: 'Bem-Estar' },
  { href: '/gestao-pessoas/denuncias', icon: ShieldAlert, label: 'Canal de Denúncias' },
  { href: '/gestao-pessoas/pesquisa-clima', icon: PieChart, label: 'Pesquisa de Clima' },
  { href: '/gestao-pessoas/colaboradores', icon: Users, label: 'Colaboradores' },
  { href: '/gestao-pessoas/sst', icon: Stethoscope, label: 'SST e NR-01' },
  { href: '/gestao-pessoas/treinamentos', icon: GraduationCap, label: 'Treinamentos' },
  { href: '/gestao-pessoas/atendimentos', icon: MessageSquareWarning, label: 'Atendimentos' },
]

export function PeopleSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser } = useApp()
  const isMobile = useIsMobile()

  const handleLogout = async () => {
    try {
      await performLogout()
      router.push('/login')
    } catch (e) {
      console.error('Logout error:', e)
    }
  }

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
          borderTop: '1px solid #1e293b',
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
        {MENUS.map(m => {
          const isActive = pathname === m.href || (m.href !== '/gestao-pessoas' && pathname?.startsWith(m.href))
          return (
            <button
              key={m.href}
              onClick={() => router.push(m.href)}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: 4, 
                flexShrink: 0, 
                minWidth: 60,
                cursor: 'pointer'
              }}
            >
              <div style={{
                color: isActive ? '#38bdf8' : '#94a3b8',
                padding: '6px 14px',
                borderRadius: 16,
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(56, 189, 248, 0.3)' : 'none'
              }}>
                <m.icon size={18} />
              </div>
              <span style={{ fontSize: 10, color: isActive ? '#38bdf8' : '#94a3b8', fontWeight: isActive ? 700 : 500, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                {m.label === 'Visão Geral' ? 'Início' : m.label}
              </span>
            </button>
          )
        })}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', flexShrink: 0, margin: '0 4px' }} />

        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            minWidth: 60,
            cursor: 'pointer'
          }}
        >
          <div style={{ padding: '6px 14px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <Grid size={18} />
          </div>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Módulos</span>
        </button>

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
            color: '#f87171',
            minWidth: 60,
            cursor: 'pointer'
          }}
        >
          <div style={{ padding: '6px 14px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <LogOut size={18} />
          </div>
          <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>Sair</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ 
      width: 280, 
      background: '#020617', // Slate 950
      borderRight: '1px solid #1e293b', // Slate 800
      display: 'flex', 
      flexDirection: 'column',
      padding: '32px 20px',
      boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
      zIndex: 10
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16, padding: '0 8px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #38bdf8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(56, 189, 248, 0.3)' }}>
          <Users size={24} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.03em', fontFamily: "'Outfit', sans-serif" }}>Gestão Pessoas</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em' }}>IMPACTO EDU</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MENUS.map(m => {
          const isActive = pathname === m.href || (m.href !== '/gestao-pessoas' && pathname?.startsWith(m.href))
          return (
            <button
              key={m.href}
              onClick={() => router.push(m.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => { 
                if(!isActive) {
                  e.currentTarget.style.color = '#e2e8f0'; 
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={e => { 
                if(!isActive) {
                  e.currentTarget.style.color = '#94a3b8'; 
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 20, borderRadius: '0 4px 4px 0', background: '#38bdf8', boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)' }} />
              )}
              <m.icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#38bdf8' : '#64748b' }} />
              <span style={{ fontSize: 14 }}>{m.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer / User */}
      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #1e293b' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: '1px solid #1e293b', cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', color: '#e2e8f0', fontWeight: 600, marginBottom: 12, transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#334155' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = '#1e293b' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0f172a', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Grid size={16} color="#94a3b8" />
          </div>
          <span style={{ fontSize: 14 }}>Trocar de Módulo</span>
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#f87171', fontWeight: 600, transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut size={20} />
          <span style={{ fontSize: 14 }}>Sair do Sistema</span>
        </button>
      </div>
    </div>
  )
}
