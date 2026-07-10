'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FloatingWhatsApp } from '@/components/FloatingWhatsApp'
import { LoadingGlass } from '@/components/LoadingGlass'
import { UserAvatar } from '@/components/UserAvatar'
import React, { useState, useEffect } from 'react'
import { 
  Bell, MessageSquare, Image as ImageIcon, Calendar, 
  UserCog, Users, X, LogOut, Briefcase, ShieldCheck, CheckCircle2, FileText
} from 'lucide-react'

export default function AgendaDigitalColaboradorLayout({ 
  children
}: { 
  children: React.ReactNode 
}) {
  const { currentUser, hydrated, setCurrentUser, setLoadingPath } = useApp()
  const { adConfig, setAdLoading } = useAgendaDigital();
  const pathname = usePathname()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hydrated || !currentUser) return
    setIsLoading(false)
  }, [hydrated, currentUser])

  useEffect(() => {
    if (setAdLoading) setAdLoading(isLoading);
    return () => { if (setAdLoading) setAdLoading(false); }
  }, [isLoading, setAdLoading]);

  const formatName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length <= 2) return fullName;
    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1).map(p => p.length > 2 ? p[0] + '.' : p).join(' ');
    return `${first} ${middle} ${last}`;
  }

  const navItems = [
    { label: 'Comunicados', href: '/agenda-digital/colaborador/comunicados', icon: <Bell size={18} /> },

    { label: 'Mídia', href: '/agenda-digital/colaborador/momentos', icon: <ImageIcon size={18} /> },
    { label: 'Calendário', href: '/agenda-digital/colaborador/calendario', icon: <Calendar size={18} /> },
    { label: 'Meu Perfil', href: '/agenda-digital/colaborador/perfil', icon: <UserCog size={18} /> },
  ]

  if (isLoading || !currentUser || currentUser.cargo === 'Aluno') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '80vh', width: '100%', gap: '24px', fontFamily: 'system-ui, sans-serif'
      }}>
         <LoadingGlass />
      </div>
    )
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0px;
          align-items: start;
          position: relative;
          z-index: 2;
        }

        .ad-premium-card-wrapper {
          margin-top: -40px;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        .ad-premium-card {
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 12px 40px rgba(15, 12, 36, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.04);
          padding: 24px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: center;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ad-premium-card:hover {
          transform: translateY(-5px) scale(1.005);
          box-shadow: 0 30px 60px rgba(59, 130, 246, 0.12), 0 10px 20px rgba(0, 0, 0, 0.04);
          border-color: rgba(59, 130, 246, 0.2);
        }

        @keyframes neonSlide {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .ad-premium-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6, #6366f1, #2dd4bf, #3b82f6);
          background-size: 200% 100%;
          animation: neonSlide 3s linear infinite;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6), inset 0 0 8px rgba(99, 102, 241, 0.4);
        }

        .ad-mini-cards-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .ad-mini-card {
          background: #f8fafc;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ad-mini-card:hover {
          background: #ffffff;
          border-color: rgba(59, 130, 246, 0.22);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.06);
          transform: translateY(-2px);
        }

        .ad-right-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ad-btn-side {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          height: 30px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
        }

        .ad-btn-side:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }

        .ad-btn-side.logout {
          border-color: #fecaca;
          color: #ef4444;
        }

        .ad-btn-side.logout:hover {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        @media (max-width: 1200px) {
          .ad-premium-card {
            grid-template-columns: 1fr;
            gap: 28px;
          }
        }
        
        @media (max-width: 640px) {
          .ad-premium-card-wrapper {
            margin-top: -30px !important;
          }
          .ad-main-grid {
            margin-top: 8px !important;
          }
          .ad-premium-card {
            padding: 14px 12px 10px 12px !important;
            border-radius: 20px !important;
            gap: 8px !important;
            position: relative !important;
            overflow: visible !important;
          }
          .ad-premium-card-avatar {
            width: 86px !important;
            height: 86px !important;
            border-radius: 20px !important;
          }
          .ad-premium-student-name {
            font-size: 16px !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
          }
          .ad-premium-card-header-flex {
            gap: 12px !important;
          }
          .ad-mini-cards-grid {
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: 4px !important;
            overflow-x: auto !important;
            padding-bottom: 2px !important;
          }
          .ad-mini-card {
            display: flex !important;
            flex-direction: column !important;
            padding: 6px !important;
            gap: 2px !important;
            align-items: center !important;
            flex: 1 !important;
            min-width: 0 !important;
          }
          .ad-mini-card-icon-desktop {
            display: none !important;
          }
          .ad-mini-card-icon-mobile {
            display: inline-flex !important;
          }
          .ad-mini-card-label {
            font-size: 10px !important;
            margin-bottom: 0 !important;
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
          }
          .ad-mini-card-value {
            width: 100% !important;
            font-size: 10px !important;
            text-align: center !important;
            justify-content: center !important;
          }
          .ad-right-section {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            min-width: 0 !important;
            width: 100% !important;
            margin-top: 4px !important;
            z-index: 1 !important;
            height: auto !important;
            flex-direction: row !important;
            justify-content: space-between !important;
          }
          .ad-right-section > div {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .ad-right-section > div > a, .ad-right-section > div > button {
            flex: 1 !important;
            width: 100% !important;
          }
          .ad-mini-cards-grid {
            flex-wrap: nowrap !important;
            gap: 4px !important;
            justify-content: space-between !important;
            width: 100% !important;
            margin-top: 4px !important;
          }
          .ad-mini-card {
            padding: 6px !important;
            gap: 4px !important;
            border-radius: 8px !important;
            flex: 1 !important;
            min-width: 0 !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .ad-mini-card > div:first-child {
            width: 20px !important;
            height: 20px !important;
          }
          .ad-mini-card > div:first-child svg {
            width: 10px !important;
            height: 10px !important;
          }
          .ad-mini-card-label {
            font-size: 7px !important;
            margin-bottom: 0 !important;
          }
          .ad-mini-card-value {
            font-size: 9px !important;
            flex-direction: column !important;
            gap: 2px !important;
          }
          .ad-mini-card-value span {
            font-size: 7px !important;
            padding: 1px 4px !important;
          }
        }
        
        .ad-content-page-area {
          padding-bottom: 80px !important;
        }
      `}} />

      {/* Dynamic Header floating profile card */}
      <div className="ad-premium-card-wrapper">
        <div className="ad-premium-card">
          {/* AREA 1: PERFIL COLABORADOR (À esquerda) */}
          <div className="ad-premium-card-header-flex" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <div className="ad-premium-card-avatar" style={{ 
              width: 96, 
              height: 96, 
              borderRadius: 24, 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontWeight: 900, 
              fontSize: 30, 
              fontFamily: 'Outfit, sans-serif',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <UserAvatar 
                userId={currentUser?.id} 
                name={currentUser?.nome || 'Colaborador'} 
                fotoUrl={currentUser?.foto}
                size={96}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0 }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1, maxWidth: '100%' }}>
              <h2 className="ad-premium-student-name" style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span style={{ whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatName(currentUser.nome)}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }}><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </h2>

              {/* Row of 3 mini cards */}
              <div className="ad-mini-cards-grid" style={{ marginTop: 0 }}>
                {/* Mini Card 1: Cargo */}
                <div className="ad-mini-card">
                  <div className="ad-mini-card-icon-desktop" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={14} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#3b82f6' }}><Briefcase size={10} /></span>
                      Cargo
                    </div>
                    <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#1e293b', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentUser.cargo || currentUser.perfil}
                    </div>
                  </div>
                </div>

                {/* Mini Card 2: Acesso */}
                <div className="ad-mini-card">
                  <div className="ad-mini-card-icon-desktop" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={14} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#8b5cf6' }}><ShieldCheck size={10} /></span>
                      Acesso
                    </div>
                    <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#1e293b', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Institucional
                    </div>
                  </div>
                </div>

                {/* Mini Card 3: Status */}
                <div className="ad-mini-card">
                  <div className="ad-mini-card-icon-desktop" style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={14} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ad-mini-card-label" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="ad-mini-card-icon-mobile" style={{ display: 'none', color: '#10b981' }}><CheckCircle2 size={10} /></span>
                      Status
                    </div>
                    <div className="ad-mini-card-value" style={{ fontSize: 12, color: '#10b981', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Ativo
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AREA 3: AÇÕES LATERAIS (À direita) */}
          <div className="ad-right-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '180px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <button 
                onClick={() => router.push('/agenda-digital/selecionar-aluno')}
                className="ad-btn-side" 
                style={{ width: '100%', height: 36, fontSize: 12, borderRadius: 12 }}
              >
                <Users size={14} /> Voltar p/ Seleção
              </button>
              <button 
                onClick={() => { 
                  setLoadingPath('logout')
                  setCurrentUser(null); 
                  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); 
                  window.location.href = '/login'; 
                }} 
                className="ad-btn-side logout" style={{ width: '100%', height: 36, fontSize: 12, borderRadius: 12 }}
              >
                <LogOut size={14} /> Sair da Conta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid containing Page Content */}
      <div className="ad-main-grid" style={{ marginTop: 24 }}>
        {/* Page Content Area */}
        <div className="ad-content-page-area" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
    </>
  )
}
