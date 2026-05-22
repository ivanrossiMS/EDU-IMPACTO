'use client'

import { useApp } from '@/lib/context'
import { useState } from 'react'
import { getInitials } from '@/lib/utils'
import { ChevronDown, LogOut } from 'lucide-react'

export default function AgendaDigitalAdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { currentUser, currentUserPerfil, setCurrentUser } = useApp()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setCurrentUser(null)
      window.location.href = '/login'
    } catch (e) {
      window.location.href = '/login'
    }
  }

  const nomeUsuario = currentUser?.nome || 'Administrador'
  const initials = getInitials(nomeUsuario)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-header {
            padding: 16px 20px !important; flex-direction: column !important;
            align-items: center !important; text-align: center !important;
          }
          .ad-admin-header-content { flex-direction: column !important; text-align: center !important; gap: 12px !important; justify-content: center !important; }
          .ad-admin-header h2 { font-size: 18px !important; }
          .ad-admin-header p { font-size: 12px !important; }
          .ad-admin-header-actions { width: 100% !important; justify-content: center !important; margin-top: 12px !important; }
          .ad-admin-layout-container {
            padding-bottom: 24px !important;
          }
        }
        @keyframes premiumFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}} />

      {/* Header */}
      <div className="ad-admin-header" style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 16, padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24
      }}>
        <div className="ad-admin-header-content" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, fontSize: 20, fontWeight: 900,
            background: 'var(--gradient-purple)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 16, boxShadow: '0 8px 20px rgba(139,92,246,0.3)', flexShrink: 0,
            animation: 'premiumFloat 4s ease-in-out infinite', fontFamily: 'Outfit, sans-serif'
          }}>
            AD
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
              Agenda Digital — Admin
            </h2>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>
              Gestão completa de comunicação escolar
            </p>
          </div>
        </div>

        {/* Usuário logado + logout */}
        <div className="ad-admin-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                borderRadius: 12, background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif'
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--gradient-primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 12, flexShrink: 0
              }}>
                {initials}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-main))', lineHeight: 1.2 }}>
                  {nomeUsuario.split(' ')[0]}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{currentUserPerfil || 'Admin'}</div>
              </div>
              <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : '' }} />
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 12, padding: 8, minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 999
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{nomeUsuario}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{currentUser?.email || 'admin@escola.com'}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                    background: 'transparent', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, fontWeight: 600,
                    transition: 'background 0.15s', textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} /> Sair da sessão
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Limpo */}
      <div className="ad-admin-layout-container">
        {children}
      </div>

      {/* Fechar menu ao clicar fora */}
      {showUserMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  )
}
