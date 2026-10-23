'use client'
import { performLogout } from "@/lib/auth/logout";

import { useApp } from '@/lib/context'
import { useState, useEffect } from 'react'
import { getInitials } from '@/lib/utils'
import { ChevronDown, LogOut, ArrowLeftRight, MonitorSmartphone, Sliders, Sparkles } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LoadingGlass } from '@/components/LoadingGlass'
import { hideSplashScreen } from '@/lib/capacitor/splash'

const SECTION_LABELS: Record<string, { title: string; subtitle: string }> = {
  '/agenda-digital/admin': { title: 'Painel de Controle', subtitle: 'Visão executiva e operacional em tempo real' },
  '/agenda-digital/admin/turmas': { title: 'Turmas & Equipes', subtitle: 'Gestão de grupos digitais e vínculos escolares' },
  '/agenda-digital/admin/pessoas': { title: 'Usuários & Famílias', subtitle: 'Gestão de acessos, responsáveis e engajamento' },
  '/agenda-digital/admin/espelhar': { title: 'Espelhar Agenda', subtitle: 'Simulação em tempo real da visão do aluno ou colaborador' },
  '/agenda-digital/admin/chat': { title: 'Chat & Moderação', subtitle: 'Auditoria e acompanhamento de canais de comunicação' },
  '/agenda-digital/admin/comunicados': { title: 'Comunicados', subtitle: 'Envio, agendamento e métricas de leitura e ciência' },
  '/agenda-digital/admin/momentos': { title: 'Galeria de Momentos', subtitle: 'Publicação e moderação de fotos e vídeos escolares' },
  '/agenda-digital/admin/calendario': { title: 'Calendário Escolar', subtitle: 'Gestão de eventos, avaliações, feriados e reuniões' },
  '/agenda-digital/admin/relatorios': { title: 'Relatórios & Formulários', subtitle: 'Templates dinâmicos, pareceres e coletas de dados' },
  '/agenda-digital/admin/cobrancas': { title: 'Cobranças & Financeiro', subtitle: 'Acompanhamento de cobranças digitais e títulos' },
  '/agenda-digital/admin/push-teste': { title: 'Simulador de Notificações', subtitle: 'Diagnóstico e teste de entrega de push por dispositivo' },
  '/agenda-digital/admin/ajustes': { title: 'Ajustes da Agenda', subtitle: 'Personalização visual, permissões e horários de atendimento' },
}

export default function AgendaDigitalAdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { currentUser, currentUserPerfil, setCurrentUser, hydrated } = useApp()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const allowed = ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master']
  const p = currentUser?.perfil
  const cargo = currentUser?.cargo
  const isAllowed = Boolean(currentUser && (allowed.includes(p as string) || allowed.includes(cargo as string)))

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) {
      router.replace('/login')
      return;
    }
    if (!isAllowed) {
      const isStaff = !['Família', 'Responsável', 'Aluno'].includes(p || '') && !['Responsável', 'Aluno'].includes(cargo || '');
      if (isStaff) {
        router.replace('/agenda-digital/colaborador/comunicados')
      } else {
        router.replace('/agenda-digital/selecionar-aluno')
      }
      return;
    }
    hideSplashScreen(300)
  }, [hydrated, currentUser, isAllowed, p, cargo, router])

  const { setLoadingPath } = useApp()
  const handleLogout = async () => {
    setLoadingPath('logout')
    await performLogout()
  }

  if (!hydrated || !isAllowed) {
    return <LoadingGlass />
  }

  const nomeUsuario = currentUser?.nome || 'Administrador'
  const initials = getInitials(nomeUsuario)
  const currentSection = SECTION_LABELS[pathname || '/agenda-digital/admin'] || {
    title: 'Agenda Digital — Admin',
    subtitle: 'Gestão completa de comunicação escolar'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-header {
            padding: 10px 14px !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            border-radius: 14px !important;
            margin-bottom: 0px !important;
          }
          .ad-admin-header-content {
            flex-direction: row !important;
            text-align: left !important;
            gap: 10px !important;
            justify-content: flex-start !important;
          }
          .ad-admin-badge-icon {
            width: 36px !important;
            height: 36px !important;
            font-size: 13px !important;
            border-radius: 10px !important;
          }
          .ad-admin-header h2 {
            font-size: 14px !important;
            font-weight: 800 !important;
            line-height: 1.2 !important;
          }
          .ad-admin-header p,
          .ad-admin-quick-topbar-links {
            display: none !important;
          }
          .ad-admin-header-actions {
            width: auto !important;
            justify-content: flex-end !important;
            margin-top: 0 !important;
          }
          .ad-admin-user-btn {
            padding: 5px 10px !important;
            gap: 6px !important;
          }
          .ad-admin-user-btn .user-subtext {
            display: none !important;
          }
          .ad-admin-layout-container {
            padding-bottom: 120px !important;
          }
        }
      `}} />

      {/* Topbar Compacta & Moderna */}
      <div className="ad-admin-header" style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 16, padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.05)'
      }}>
        <div className="ad-admin-header-content" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link href="/agenda-digital/admin" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div className="ad-admin-badge-icon" style={{
              width: 42, height: 42, fontSize: 15, fontWeight: 900,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12, boxShadow: '0 6px 16px rgba(99,102,241,0.25)', flexShrink: 0,
              fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em'
            }}>
              AD
            </div>
          </Link>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 999
              }}>
                Agenda Digital • Admin
              </span>
              <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: 'hsl(var(--text-main))' }}>
                {currentSection.title}
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSection.subtitle}
            </p>
          </div>
        </div>

        {/* Atalhos Rápidos + Usuário logado */}
        <div className="ad-admin-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div className="ad-admin-quick-topbar-links" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/agenda-digital/admin/espelhar" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderRadius: 10, background: 'hsl(var(--bg-main))',
                  border: '1px solid hsl(var(--border-subtle))',
                  color: 'hsl(var(--text-muted))', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-muted))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}
              >
                <MonitorSmartphone size={14} />
                <span>Espelhar</span>
              </button>
            </Link>
            <Link href="/agenda-digital/admin/ajustes" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderRadius: 10, background: 'hsl(var(--bg-main))',
                  border: '1px solid hsl(var(--border-subtle))',
                  color: 'hsl(var(--text-muted))', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-muted))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}
              >
                <Sliders size={14} />
                <span>Ajustes</span>
              </button>
            </Link>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="ad-admin-user-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
                borderRadius: 12, background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif'
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--gradient-primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 11, flexShrink: 0
              }}>
                {initials}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--text-main))', lineHeight: 1.2 }}>
                  {nomeUsuario.split(' ')[0]}
                </div>
                <div className="user-subtext" style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>{currentUserPerfil || 'Admin'}</div>
              </div>
              <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : '' }} />
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 12, padding: 8, minWidth: 190,
                boxShadow: '0 10px 28px rgba(0,0,0,0.14)', zIndex: 999
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{nomeUsuario}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{currentUser?.email || 'admin@escola.com'}</div>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/agenda-digital/selecionar-perfil-admin')
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                    background: 'transparent', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 8, color: '#a855f7', fontSize: 13, fontWeight: 600,
                    transition: 'background 0.15s', textAlign: 'left', marginBottom: 2
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ArrowLeftRight size={14} /> Trocar perfil
                </button>
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
