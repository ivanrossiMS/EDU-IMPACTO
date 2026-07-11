'use client'
import { performLogout } from "@/lib/auth/logout";
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronRight, Briefcase, Sparkles, Shield, LayoutDashboard, Loader2, Target, Settings, Building, Bell, LogOut, ArrowLeft } from 'lucide-react'
import { LoadingGlass } from '@/components/LoadingGlass'

// Helper function to abbreviate Portuguese surnames to fit single line
function formatShortName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  
  const connectors = ['de', 'da', 'do', 'dos', 'das', 'e'];
  
  let firstName = parts[0];
  let startIndex = 1;
  
  if (parts[1] && !connectors.includes(parts[1].toLowerCase()) && parts[1][0] === parts[1][0].toUpperCase()) {
    firstName = `${parts[0]} ${parts[1]}`;
    startIndex = 2;
  }
  
  const lastName = parts[parts.length - 1];
  
  const middleInitials: string[] = [];
  for (let i = startIndex; i < parts.length - 1; i++) {
    const part = parts[i];
    if (connectors.includes(part.toLowerCase())) {
      continue;
    }
    if (part.length > 0) {
      middleInitials.push(`${part[0].toUpperCase()}.`);
    }
  }
  
  if (middleInitials.length > 0) {
    return `${firstName} ${middleInitials.join(' ')} ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}

function SelecionarPerfilAdminContent() {
  const { currentUser, setCurrentUser } = useApp()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || 'comunicados'

  const firstName = currentUser?.nome ? currentUser.nome.split(' ')[0] : 'Administrador';

  return (
    <>
      <div className="premium-selector-container">
        {/* Dynamic styles block for modern theme design */}
        <style dangerouslySetInnerHTML={{__html: `
        /* Make parent wrappers transparent so portal background shows through */
        .ad-main-scroll {
          background: transparent !important;
        }

        .premium-selector-container {
          max-width: 800px;
          width: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 40px 24px 80px 24px;
          font-family: 'Outfit', 'Inter', sans-serif;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          gap: 36px;
          position: relative;
          z-index: 1;
        }

        /* Animations */
        @keyframes revealUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 20px 4px rgba(99, 102, 241, 0.15); }
        }

        .animate-reveal {
          animation: revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }

        /* Premium Welcome Header Card */
        .premium-welcome-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.4) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 32px;
          padding: 32px;
          display: flex;
          align-items: center;
          gap: 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          position: relative;
          overflow: hidden;
          margin-top: 24px;
        }

        .dark .premium-welcome-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.5) 100%);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .welcome-avatar-wrapper {
          position: relative;
          width: 96px;
          height: 96px;
          flex-shrink: 0;
          animation: avatarPulse 4s ease-in-out infinite;
        }

        .welcome-avatar-glow {
          position: absolute;
          inset: -4px;
          border-radius: 28px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          padding: 2px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.85;
        }

        .welcome-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 26px;
          object-fit: cover;
          border: 2px solid white;
          background: white;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }
        .dark .welcome-avatar-img {
          border-color: #1e293b;
          background: #1e293b;
        }

        .welcome-initials {
          width: 100%;
          height: 100%;
          border-radius: 26px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-size: 32px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
        }
        .dark .welcome-initials {
          border-color: #1e293b;
        }

        .welcome-content {
          flex: 1;
        }

        .welcome-greeting {
          font-size: 32px;
          font-weight: 900;
          margin: 0 0 6px;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #0f172a;
        }
        .dark .welcome-greeting {
          color: #f8fafc;
        }

        .welcome-tagline {
          font-size: 15px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
          font-weight: 500;
        }
        .dark .welcome-tagline {
          color: #94a3b8;
        }

        .welcome-sparkle {
          position: absolute;
          top: 16px;
          right: 16px;
          color: rgba(99, 102, 241, 0.35);
          animation: orbRotate 6s linear infinite;
        }

        /* Portal Sections Grid Layout */
        .portal-sections-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 36px;
          width: 100%;
          box-sizing: border-box;
        }

        .portal-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 8px;
        }

        .portal-section-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dark .portal-section-title {
          color: #94a3b8;
        }

        .portal-section-badge {
          font-size: 12px;
          font-weight: 700;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.08);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(99, 102, 241, 0.12);
        }

        .cards-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Glassmorphic Interactive Cards */
        .portal-modern-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 24px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          text-decoration: none !important;
          width: 100%;
          box-sizing: border-box;
        }

        .dark .portal-modern-card {
          background: rgba(30, 41, 59, 0.45);
          border-color: rgba(255, 255, 255, 0.05);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .portal-modern-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
          pointer-events: none;
        }

        .portal-modern-card:hover {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: 0 16px 36px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        .dark .portal-modern-card:hover {
          border-color: rgba(139, 92, 246, 0.3);
          box-shadow: 0 16px 36px rgba(139, 92, 246, 0.15);
        }

        .portal-modern-card:hover::before {
          transform: translateX(100%);
        }

        /* Avatar styling inside card */
        .card-avatar-container {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 22px;
          flex-shrink: 0;
          box-shadow: 0 6px 16px rgba(168, 85, 247, 0.2);
          transition: transform 0.3s;
        }
        .portal-modern-card:hover .card-avatar-container {
          transform: scale(1.05);
        }

        .card-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Admin/Master Card Specifics */
        .portal-modern-card.admin-theme {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 243, 255, 0.7) 100%);
          border-color: rgba(139, 92, 246, 0.25);
        }
        .dark .portal-modern-card.admin-theme {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
          border-color: rgba(139, 92, 246, 0.12);
        }
        .portal-modern-card.admin-theme:hover {
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 16px 36px rgba(139, 92, 246, 0.12);
        }

        .card-avatar-container.admin-avatar {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          box-shadow: 0 6px 16px rgba(139, 92, 246, 0.2);
        }

        /* Collaborator Card Specifics */
        .portal-modern-card.collaborator-theme {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 246, 255, 0.7) 100%);
          border-color: rgba(59, 130, 246, 0.25);
        }
        .dark .portal-modern-card.collaborator-theme {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
          border-color: rgba(59, 130, 246, 0.12);
        }
        .portal-modern-card.collaborator-theme:hover {
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 16px 36px rgba(59, 130, 246, 0.12);
        }

        .card-avatar-container.collaborator-avatar {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.2);
        }

        /* Card Content layout */
        .card-info {
          flex: 1;
          min-width: 0;
        }

        .card-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dark .card-title {
          color: #f8fafc;
        }

        .card-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dark .card-subtitle {
          color: #94a3b8;
        }

        .card-dot-separator {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #cbd5e1;
          display: inline-block;
        }
        .dark .card-dot-separator {
          background: #475569;
        }

        /* Badges & Indicators */
        .card-actions-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .chevron-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          background: rgba(0, 0, 0, 0.02);
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.35s;
        }
        .dark .chevron-circle-btn {
          border-color: rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
        }
        .portal-modern-card:hover .chevron-circle-btn {
          transform: translateX(4px);
        }
        .portal-modern-card.admin-theme:hover .chevron-circle-btn {
          color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
          border-color: rgba(139, 92, 246, 0.2);
        }
        .portal-modern-card.collaborator-theme:hover .chevron-circle-btn {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.2);
        }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
          .premium-selector-container {
            padding: 24px 12px 64px 12px;
            gap: 28px;
          }
          .premium-welcome-card {
            padding: 20px;
            gap: 18px;
            border-radius: 24px;
            margin-top: 48px;
          }
          .welcome-avatar-wrapper {
            width: 72px;
            height: 72px;
          }
          .welcome-greeting {
            font-size: 24px;
          }
          .welcome-tagline {
            font-size: 13px;
          }
          .portal-sections-grid {
            gap: 28px;
          }
          .portal-modern-card {
            padding: 12px 14px;
            gap: 12px;
            border-radius: 20px;
          }
          .card-avatar-container {
            width: 52px;
            height: 52px;
            border-radius: 14px;
          }
          .card-title {
            font-size: 16px;
          }
          .card-subtitle {
            font-size: 12px;
          }
          .card-actions-wrapper {
            gap: 8px !important;
          }
          .chevron-circle-btn {
            width: 28px !important;
            height: 28px !important;
            border-radius: 8px !important;
          }
          .chevron-circle-btn svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
      `}} />

      {/* Header section */}
      <header className="premium-welcome-card animate-reveal">
        <Sparkles className="welcome-sparkle" size={24} />
        <div className="welcome-avatar-wrapper">
          <div className="welcome-avatar-glow" />
          {currentUser?.foto ? (
            <img src={currentUser.foto} alt="Avatar" className="welcome-avatar-img" />
          ) : (
            <div className="welcome-initials">
              {getInitials(currentUser?.nome || 'Admin')}
            </div>
          )}
        </div>
        <div className="welcome-content">
          <h1 className="welcome-greeting">
            Olá, {firstName}!
          </h1>
          <p className="welcome-tagline">
            Seja bem-vindo(a) à Agenda Digital do Impacto. Selecione o ambiente de acesso desejado para continuar.
          </p>
        </div>
      </header>

      {/* Main content Area */}
      <main className="portal-sections-grid">
        {/* SECTION 1: ADMIN MASTER */}
        {['Administrador', 'Diretor Geral', 'Administrador Master'].includes(currentUser?.perfil || '') && (
          <section className="animate-reveal delay-1">
            <div className="portal-section-header">
              <h2 className="portal-section-title">
                <Shield size={16} strokeWidth={2.5} style={{ color: '#8b5cf6' }} />
                Acesso Administração
              </h2>
              <span className="portal-section-badge" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)', borderColor: 'rgba(139, 92, 246, 0.15)' }}>
                Master
              </span>
            </div>

            <div className="cards-column">
              <Link href={`/agenda-digital/admin/${redirectTarget}`} className="portal-modern-card admin-theme">
                <div className="card-avatar-container admin-avatar">
                  <LayoutDashboard size={28} color="white" />
                </div>

                <div className="card-info">
                  <h3 className="card-title">Gestão Geral da Agenda</h3>
                  <div className="card-subtitle">
                    <span style={{ color: '#8b5cf6', fontWeight: 800 }}>Acesso Irrestrito</span>
                    <span className="card-dot-separator" />
                    <span>Painel de Controle</span>
                  </div>
                </div>

                <div className="card-actions-wrapper">
                  <div className="chevron-circle-btn">
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* SECTION 2: COLABORADOR / STAFF */}
        <section className="animate-reveal delay-2">
          <div className="portal-section-header">
            <h2 className="portal-section-title">
              <Briefcase size={16} strokeWidth={2.5} style={{ color: '#3b82f6' }} />
              Acesso Institucional
            </h2>
            <span className="portal-section-badge" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
              Colaborador
            </span>
          </div>

          <div className="cards-column">
            <Link href={`/agenda-digital/colaborador/${redirectTarget}`} className="portal-modern-card collaborator-theme">
              <div className="card-avatar-container collaborator-avatar" style={{ padding: 0 }}>
                {currentUser?.foto ? (
                  <img src={currentUser.foto} alt={currentUser.nome} className="card-avatar-img" />
                ) : (
                  getInitials(currentUser?.nome || 'Colaborador')
                )}
              </div>

              <div className="card-info">
                <h3 className="card-title">{formatShortName(currentUser?.nome || 'Colaborador')}</h3>
                <div className="card-subtitle">
                  <span style={{ color: '#3b82f6', fontWeight: 800 }}>Acesso da Equipe</span>
                  <span className="card-dot-separator" />
                  <span>{currentUser?.cargo || currentUser?.perfil || 'Membro da Equipe'}</span>
                </div>
              </div>

              <div className="card-actions-wrapper">
                <div className="chevron-circle-btn">
                  <ChevronRight size={18} strokeWidth={2.5} />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* LOGOUT BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }} className="animate-reveal delay-2">
          <button 
            onClick={() => window.location.href = '/login?step=choose_system'}
            className="back-button-modern"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span>Trocar Módulo</span>
          </button>
          <button
            onClick={async () => {
              try {
                await performLogout();
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.signOut();
                setCurrentUser(null);
                const { removeSettingAsync } = await import('@/lib/context');
                await removeSettingAsync('currentUser');
                await removeSettingAsync('activeModule');
                window.location.href = '/login';
              } catch (err) {
                window.location.href = '/login';
              }
            }}
            className="logout-button-modern"
          >
            <LogOut size={18} strokeWidth={2.5} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .back-button-modern {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 28px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 100px;
          color: #6366f1;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .back-button-modern:hover {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15);
        }

        .back-button-modern:active {
          transform: translateY(1px);
        }

        .dark .back-button-modern {
          background: rgba(99, 102, 241, 0.1);
          border-color: rgba(99, 102, 241, 0.3);
          color: #818cf8;
        }

        .dark .back-button-modern:hover {
          background: rgba(99, 102, 241, 0.2);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
        }

        .logout-button-modern {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 28px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 100px;
          color: #ef4444;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.0);
        }

        .logout-button-modern:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.15);
        }

        .logout-button-modern:active {
          transform: translateY(1px);
        }

        .dark .logout-button-modern {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .dark .logout-button-modern:hover {
          background: rgba(239, 68, 68, 0.2);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2);
        }
      `}} />
    </div>
    </>
  )
}

export default function SelecionarPerfilAdmin() {
  return (
    <Suspense fallback={<LoadingGlass />}>
      <SelecionarPerfilAdminContent />
    </Suspense>
  )
}
