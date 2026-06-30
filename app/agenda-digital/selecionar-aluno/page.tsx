'use client'
import { useData } from '@/lib/dataContext'
import { memo, useCallback } from 'react'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Bell, AlertTriangle, Calendar, ChevronRight, Users, Briefcase, ShieldAlert, Sparkles, Loader2, LogOut } from 'lucide-react'
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

const SELECTOR_STYLES = `
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
        .delay-3 { animation-delay: 0.3s; }

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
          fontWeight: 900;
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
          fontSize: 22px;
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
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
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

        .unread-indicator-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #eef2ff;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .dark .unread-indicator-badge {
          background: rgba(79, 70, 229, 0.2);
          color: #818cf8;
        }

        .badge-count-bubble {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 800;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid white;
        }
        .dark .badge-count-bubble {
          border-color: #1e293b;
        }

        .pending-warning-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #fffbeb;
          color: #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dark .pending-warning-badge {
          background: rgba(217, 119, 6, 0.2);
          color: #fbbf24;
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
          color: #6366f1;
          background: rgba(99, 102, 241, 0.05);
          border-color: rgba(99, 102, 241, 0.2);
        }
        .portal-modern-card.collaborator-theme:hover .chevron-circle-btn {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.2);
        }

        /* Empty state styling */
        .empty-results-card {
          padding: 48px 32px;
          text-align: center;
          background: rgba(255, 255, 255, 0.45);
          border: 1px dashed rgba(0, 0, 0, 0.1);
          border-radius: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .dark .empty-results-card {
          background: rgba(30, 41, 59, 0.2);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .empty-icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #f43f5e;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(244, 63, 94, 0.05);
        }

        .premium-logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 16px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-weight: 700;
          font-size: 14px;
          border: 1px solid rgba(239, 68, 68, 0.2);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          margin-left: auto;
        }
        .premium-logout-btn:hover {
          background: #ef4444;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.25);
        }
        .dark .premium-logout-btn {
          background: rgba(248, 113, 113, 0.1);
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.2);
        }
        .dark .premium-logout-btn:hover {
          background: #f87171;
          color: #0f172a;
        }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
          .premium-selector-container::before {
            display: none !important;
          }
          .premium-selector-container {
            padding: 24px 12px 64px 12px;
            gap: 28px;
            width: 100%;
            box-sizing: border-box;
          }
          .premium-welcome-card {
            padding: 20px;
            gap: 14px;
            border-radius: 24px;
            margin-top: 48px;
          }
          .premium-logout-btn {
            padding: 10px 12px;
            border-radius: 12px;
          }
          .premium-logout-text {
            display: none;
          }
          .welcome-avatar-wrapper {
            width: 64px;
            height: 64px;
          }
          .welcome-greeting {
            font-size: 22px;
          }
          .welcome-tagline {
            font-size: 13px;
          }
          .portal-sections-grid {
            gap: 28px;
            width: 100%;
            box-sizing: border-box;
          }
          .portal-modern-card {
            padding: 12px 14px;
            gap: 12px;
            border-radius: 20px;
            width: 100%;
            box-sizing: border-box;
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
          .unread-indicator-badge, .pending-warning-badge, .chevron-circle-btn {
            width: 28px !important;
            height: 28px !important;
            border-radius: 8px !important;
          }
          .unread-indicator-badge svg, .pending-warning-badge svg, .chevron-circle-btn svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
`;

const StudentCard = memo(({ student, loadingCardId, redirectTarget, getForwardParams, setLoadingCardId }: any) => {
  const pendingAlerts = student.pendenciasAtrasadas || 0;
  
  let rawName = student.turmaNome || student.turma || 'S/T'
  const nomeTurma = rawName.split('-')[0].trim()
  const anoLetivo = student.anoLetivo || new Date().getFullYear()

  const s = student.status?.toLowerCase();
  const isInativo = s === 'inativo' || s === 'cancelado' || s === 'transferido' || student.dados?.ativo === 'Não' || student.dados?.ativo === false;

  const content = (
    <>
      <div className="card-avatar-container">
        {student.foto ? (
          <img src={student.foto} alt={student.nome} className="card-avatar-img" />
        ) : (
          getInitials(student.nome)
        )}
      </div>

      <div className="card-info">
        <h3 className="card-title">{formatShortName(student.nome)}</h3>
        <div className="card-subtitle">
          {isInativo ? (
            <span style={{ color: '#ef4444', fontWeight: 800 }}>Aluno Inativo</span>
          ) : (
            <>
              <span style={{ color: 'hsl(var(--primary))', fontWeight: 800 }}>Turma {nomeTurma}</span>
              <span className="card-dot-separator" />
              <span>{anoLetivo}</span>
            </>
          )}
        </div>
      </div>

      <div className="card-actions-wrapper">
        {isInativo ? (
          <div className="inactive-badge" title="Aluno Inativo">
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px' }}>INATIVO</span>
          </div>
        ) : (
          <>
            <div className="unread-indicator-badge">
              <Bell size={18} />
              <span className="badge-count-bubble">2</span>
            </div>

            {pendingAlerts > 0 && (
              <div className="pending-warning-badge" title={`${pendingAlerts} Ocorrências ou pendências`}>
                <AlertTriangle size={18} />
              </div>
            )}

            <div className="chevron-circle-btn">
              {loadingCardId === student.id ? (
                <Loader2 size={18} strokeWidth={2.5} className="animate-spin" style={{ color: '#6366f1' }} />
              ) : (
                <ChevronRight size={18} strokeWidth={2.5} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )

  if (isInativo) {
    return (
      <div className="portal-modern-card disabled-card">
        {content}
      </div>
    )
  }

  return (
    <Link href={`/agenda-digital/${student.id}/${redirectTarget}${getForwardParams()}`} onClick={() => setLoadingCardId(student.id)} className="portal-modern-card">
      {content}
    </Link>
  )
})

function SelecionarAlunoContent() {
  const { turmas = [] } = useData();
  const { currentUser, hydrated } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || 'comunicados'

  const getForwardParams = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const p = new URLSearchParams(window.location.search)
    p.delete('redirect')
    const str = p.toString()
    return str ? `?${str}` : ''
  }, [])

  // ─── Fast-path data fetching with localStorage cache to eliminate empty-state flash ───
  const [meusAlunos, setMeusAlunos] = useState<any[]>([])
  // Track whether we've completed at least one successful fetch
  const [hasFetched, setHasFetched] = useState(false)
  const isStillLoading = !hydrated || !hasFetched || (currentUser === undefined)

  const [loadingCardId, setLoadingCardId] = useState<string | null>(null)

  // 1. Obter metadados do responsável autenticado
  const respId = (currentUser as any)?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || '';
  const emailBusca = (currentUser?.email || '').toLowerCase().trim();
  const nomeBusca = (currentUser?.nome || '').toLowerCase().trim();

  useEffect(() => {
    if (!hydrated || !currentUser) return;

    const cacheKey = `edu-meus-alunos-${respId || emailBusca}`;

    // Step 1: Serve from localStorage cache INSTANTLY (zero latency)
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          setMeusAlunos(data);
          setHasFetched(true); // Show data immediately, no spinner
        }
      }
    } catch (_) {}

    // Step 2: Always fire a fresh network request in background
    const url = `/api/agenda/meus-alunos?respId=${encodeURIComponent(respId)}&email=${encodeURIComponent(emailBusca)}&nome=${encodeURIComponent(nomeBusca)}`;

    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data)) return;
        setMeusAlunos(data);
        setHasFetched(true);
        // Update localStorage cache with fresh data
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(() => {
        setHasFetched(true); // Even on error, stop the spinner
      });
  }, [hydrated, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirecionamento de alunos normais
  useEffect(() => {
    if (currentUser && currentUser.perfil === 'Aluno') {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('edu-current-user')
        if (stored) {
          const u = JSON.parse(stored)
          if (u && u.perfilReal !== 'Família' && u.perfilReal !== 'Responsável' && !u.hasDualRole && u.perfil === 'Aluno') {
            setTimeout(() => { window.location.href = `/agenda-digital/aluno/${redirectTarget}` }, 50)
            return
          }
        }
      }
      if (currentUser.id) {
        setTimeout(() => { window.location.href = `/agenda-digital/aluno/${redirectTarget}` }, 50)
      }
    }
  }, [isStillLoading, currentUser, redirectTarget])

  const firstName = currentUser?.nome ? currentUser.nome.split(' ')[0] : 'Responsável';

  return (
    <>
      <div className="premium-selector-container">
        {/* Dynamic styles block for modern theme design */}
      <style dangerouslySetInnerHTML={{__html: SELECTOR_STYLES}} />

      {/* Full-screen Loading Overlay */}
      {loadingCardId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, animation: 'revealUp 0.3s ease-out' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', animation: 'orbRotate 1s linear infinite' }} />
          <p style={{ color: '#0f172a', fontSize: 18, fontWeight: 800 }}>Entrando...</p>
        </div>
      )}

      {/* Header section */}
      <header className="premium-welcome-card animate-reveal">
        <Sparkles className="welcome-sparkle" size={24} />
        <div className="welcome-avatar-wrapper">
          <div className="welcome-avatar-glow" />
          {currentUser?.foto ? (
            <img src={currentUser.foto} alt="Mascot Avatar" className="welcome-avatar-img" />
          ) : (
            <div className="welcome-initials">
              {getInitials(currentUser?.nome || 'User')}
            </div>
          )}
        </div>
        <div className="welcome-content">
          <h1 className="welcome-greeting">
            Olá, {firstName}!
          </h1>
          <p className="welcome-tagline">
            Seja bem-vindo(a) à Agenda Digital do Impacto. Selecione um perfil para gerenciar comunicados e relatórios.
          </p>
        </div>
      </header>

      {/* Main content Area */}
      <main className="portal-sections-grid">
        {/* SECTION 1: COLABORADOR / STAFF (Somente visível se o usuário for colaborador) */}
        {currentUser && currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável' && currentUser.cargo !== 'Aluno' && (
          <section className="animate-reveal delay-1">
            <div className="portal-section-header">
              <h2 className="portal-section-title">
                <Briefcase size={16} strokeWidth={2.5} style={{ color: 'hsl(var(--primary))' }} />
                Acesso Institucional
              </h2>
              <span className="portal-section-badge" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
                Colaborador
              </span>
            </div>

            <div className="cards-column">
              <Link 
                href={`/agenda-digital/colaborador/${redirectTarget}${getForwardParams()}`} 
                onClick={() => setLoadingCardId('colaborador')}
                className="portal-modern-card collaborator-theme"
              >
                <div className="card-avatar-container collaborator-avatar" style={{ padding: 0 }}>
                  {currentUser.foto ? (
                    <img src={currentUser.foto} alt={currentUser.nome} className="card-avatar-img" />
                  ) : (
                    getInitials(currentUser.nome || 'Colaborador')
                  )}
                </div>

                <div className="card-info">
                  <h3 className="card-title">{formatShortName(currentUser.nome)}</h3>
                  <div className="card-subtitle">
                    <span style={{ color: '#3b82f6', fontWeight: 800 }}>Acesso da Equipe</span>
                    <span className="card-dot-separator" />
                    <span>{currentUser.cargo || currentUser.perfil}</span>
                  </div>
                </div>

                <div className="card-actions-wrapper">
                  <div className="chevron-circle-btn">
                    {loadingCardId === 'colaborador' ? (
                      <Loader2 size={18} strokeWidth={2.5} className="animate-spin" style={{ color: '#3b82f6' }} />
                    ) : (
                      <ChevronRight size={18} strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* SECTION 2: ESTUDANTES / FAMÍLIA */}
        <section className="animate-reveal delay-2">
          <div className="portal-section-header">
            <h2 className="portal-section-title">
              <Users size={16} strokeWidth={2.5} style={{ color: 'hsl(var(--primary))' }} />
              Acesso Familiar
            </h2>
            {meusAlunos.length > 0 && (
              <span className="portal-section-badge">
                {meusAlunos.length} Aluno{meusAlunos.length !== 1 && 's'}
              </span>
            )}
          </div>

          <div className="cards-column">
            {isStillLoading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1', animation: 'orbRotate 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, fontWeight: 500, margin: 0 }}>Procurando alunos vinculados...</p>
              </div>
            ) : meusAlunos.length === 0 ? (
              <div className="empty-results-card">
                <div className="empty-icon-circle">
                  <AlertTriangle size={32} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 4px', color: 'hsl(var(--text-main))' }}>Nenhum aluno encontrado</h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                  Certifique-se de que sua conta de e-mail ou CPF esteja corretamente associada ao cadastro de seus filhos na secretaria da escola.
                </p>
              </div>
            ) : (
              meusAlunos.map((student) => (
                <StudentCard 
                  key={student.id} 
                  student={student} 
                  loadingCardId={loadingCardId} 
                  redirectTarget={redirectTarget} 
                  getForwardParams={getForwardParams} 
                  setLoadingCardId={setLoadingCardId} 
                />
              ))
            )}
          </div>
        </section>
      </main>

      <footer style={{ marginTop: 40, display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 760, padding: '0 20px', paddingBottom: 40, position: 'relative', zIndex: 10 }}>
        <button 
          onClick={async (e) => {
            const btn = e.currentTarget;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<span style="display:flex;align-items:center;gap:8px;"><svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saindo...</span>';
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';

            // 1. Limpa todos os caches locais que podem causar resíduos visuais
            localStorage.clear();
            sessionStorage.clear();

            // 2. Aciona a API de logout no servidor (mata os cookies HTTPOnly)
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } catch (err) {}

            // 3. Força o redirecionamento instantâneo para a página inicial de login
            window.location.href = '/login';
          }}
          className="premium-logout-btn"
          style={{ width: '100%', maxWidth: 320, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 16, background: '#fff', border: '1.5px solid #ffe4e6', color: '#f43f5e', fontSize: 16, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(244,63,94,0.08)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fff1f2';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(244,63,94,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(244,63,94,0.08)';
          }}
        >
          <LogOut size={20} strokeWidth={2.5} />
          <span>Sair com segurança</span>
        </button>
      </footer>
    </div>
    </>
  )
}

export default function SelecionarAluno() {
  return (
    <Suspense fallback={<LoadingGlass />}>
      <SelecionarAlunoContent />
    </Suspense>
  )
}
