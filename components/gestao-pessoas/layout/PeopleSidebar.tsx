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
      background: '#ffffff', 
      borderRight: '1px solid #e2e8f0',
      display: 'flex', 
      flexDirection: 'column',
      padding: '32px 20px',
      boxShadow: '4px 0 24px rgba(0, 0, 0, 0.02)',
      zIndex: 10
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16, padding: '0 8px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}>
          <Users size={24} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', fontFamily: "'Outfit', sans-serif" }}>Gestão Pessoas</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>IMPACTO EDU</div>
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
                background: isActive ? '#f0f9ff' : 'transparent',
                color: isActive ? '#0284c7' : '#475569',
                fontWeight: isActive ? 700 : 600,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => { 
                if(!isActive) {
                  e.currentTarget.style.color = '#0f172a'; 
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={e => { 
                if(!isActive) {
                  e.currentTarget.style.color = '#475569'; 
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 20, borderRadius: '0 4px 4px 0', background: '#0284c7' }} />
              )}
              <m.icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#0284c7' : '#94a3b8' }} />
              <span style={{ fontSize: 14 }}>{m.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer / User */}
      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: '#f8fafc', color: '#0f172a', fontWeight: 700, marginBottom: 12, transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <Settings size={16} color="#475569" />
          </div>
          <span style={{ fontSize: 14 }}>Voltar ao ERP</span>
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#ef4444', fontWeight: 600, transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut size={20} />
          <span style={{ fontSize: 14 }}>Sair do Sistema</span>
        </button>
      </div>
    </div>
  )
}
