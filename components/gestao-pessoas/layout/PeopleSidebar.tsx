'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import {
  Users, Activity, ShieldAlert,
  ClipboardCheck, GraduationCap,
  MessageSquareWarning, Settings,
  LogOut, Home, Stethoscope
} from 'lucide-react'

const MENUS = [
  { href: '/gestao-pessoas', icon: Home, label: 'Visão Geral' },
  { href: '/gestao-pessoas/colaboradores', icon: Users, label: 'Colaboradores' },
  { href: '/gestao-pessoas/sst', icon: Stethoscope, label: 'SST e NR-01' },
  { href: '/gestao-pessoas/inventario-riscos', icon: ShieldAlert, label: 'Inventário de Riscos' },
  { href: '/gestao-pessoas/plano-acao', icon: Activity, label: 'Plano de Ação' },
  { href: '/gestao-pessoas/treinamentos', icon: GraduationCap, label: 'Treinamentos' },
  { href: '/gestao-pessoas/checklists', icon: ClipboardCheck, label: 'Checklists' },
  { href: '/gestao-pessoas/atendimentos', icon: MessageSquareWarning, label: 'Atendimentos' },
]

export function PeopleSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser } = useApp()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (e) {
      console.error('Logout error:', e)
    }
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
          onClick={() => router.push('/dashboard')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: '1px solid #1e293b', cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', color: '#e2e8f0', fontWeight: 600, marginBottom: 12, transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#334155' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = '#1e293b' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0f172a', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={16} color="#94a3b8" />
          </div>
          <span style={{ fontSize: 14 }}>Voltar ao ERP</span>
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
