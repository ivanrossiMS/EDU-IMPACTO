'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  BookHeart,
  Users,
  ClipboardPenLine,
  Laptop,
  Landmark,
  X,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface TrocarModuloModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ModuloItem {
  id: string
  href: string
  title: string
  tag: string
  description: string
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>
  gradient: string
  glowColor: string
  borderColor: string
  badgeColor: string
  blockedKey?: string
}

export function TrocarModuloModal({ isOpen, onClose }: TrocarModuloModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUserPerfil, currentUser, startModuleTransition } = useApp()
  const { perfis } = useData()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const isMobile = useIsMobile(768)

  // Listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Reset navigating state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNavigatingId(null)
    }
  }, [isOpen])

  // Resolve user permissions
  const normalize = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const activePerfilName = currentUserPerfil || currentUser?.perfil || currentUser?.cargo || ''
  const userPerfilObj = (perfis || []).find((p: any) =>
    p.nome === activePerfilName ||
    normalize(p.nome) === normalize(activePerfilName) ||
    (currentUser?.perfil && (p.nome === currentUser.perfil || normalize(p.nome) === normalize(currentUser.perfil))) ||
    (currentUser?.cargo && (p.nome === currentUser.cargo || normalize(p.nome) === normalize(currentUser.cargo)))
  )

  const isStudentUser =
    currentUser?.perfil === 'Aluno' ||
    currentUser?.cargo === 'Aluno' ||
    currentUser?.perfil === 'Responsável' ||
    currentUser?.cargo === 'Responsável' ||
    Boolean(currentUser?.aluno_id && currentUser?.cargo !== 'Responsável')

  const modulos: ModuloItem[] = [
    {
      id: 'gestao-escolar',
      href: '/dashboard',
      title: 'Gestão Escolar',
      tag: 'ERP Principal',
      description: 'Matrículas, turmas, acadêmico, pedagógico, relatórios e financeiro institucional.',
      icon: Building2,
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      glowColor: 'rgba(59, 130, 246, 0.45)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      badgeColor: '#3b82f6',
      blockedKey: 'bloqueadoGestaoEscolar'
    },
    {
      id: 'agenda-digital',
      href: '/agenda-digital',
      title: 'Agenda Digital',
      tag: 'Comunicação Diária',
      description: 'Mural de comunicados, recados escolares, fotos, eventos e rotina diária dos alunos.',
      icon: BookHeart,
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      borderColor: 'rgba(168, 85, 247, 0.4)',
      badgeColor: '#a855f7',
      blockedKey: 'bloqueadoAgendaDigital'
    },
    {
      id: 'gestao-pessoas',
      href: '/gestao-pessoas',
      title: 'Gestão de Pessoas',
      tag: 'RH, DP & Segurança',
      description: 'Controle de colaboradores, folha de pagamento, ponto, medicina ocupacional e NR-01.',
      icon: Users,
      gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      borderColor: 'rgba(16, 185, 129, 0.4)',
      badgeColor: '#10b981',
      blockedKey: 'bloqueadoGestaoPessoas'
    },
    {
      id: 'simulados',
      href: '/simulados',
      title: 'Simulados e Provas',
      tag: 'Banco BNCC & IA',
      description: 'Criação de avaliações com IA, banco com milhares de questões e diagramação em PDF.',
      icon: ClipboardPenLine,
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
      glowColor: 'rgba(244, 63, 94, 0.45)',
      borderColor: 'rgba(244, 63, 94, 0.4)',
      badgeColor: '#f43f5e',
      blockedKey: 'bloqueadoSimulados'
    },
    {
      id: 'provas-online',
      href: '/provas-online',
      title: 'Provas Online',
      tag: 'Avaliações Digitais',
      description: 'Aplicação remota em tempo real, monitoramento antifraude e correção automática instantânea.',
      icon: Laptop,
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      borderColor: 'rgba(6, 182, 212, 0.4)',
      badgeColor: '#06b6d4',
      blockedKey: 'bloqueadoProvasOnline'
    },
    {
      id: 'credimpacto',
      href: '/credimpacto',
      title: 'CredImpacto',
      tag: 'Crédito Consignado CLT',
      description: 'Empréstimos consignados em folha, simulações salariais e contratos com assinatura digital.',
      icon: Landmark,
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      glowColor: 'rgba(5, 150, 105, 0.45)',
      borderColor: 'rgba(5, 150, 105, 0.4)',
      badgeColor: '#059669',
      blockedKey: 'bloqueadoCredImpacto'
    }
  ]

  // Check which module is current
  const isModuleActive = (item: ModuloItem) => {
    if (item.id === 'gestao-escolar') {
      return (
        pathname === '/dashboard' ||
        pathname?.startsWith('/dashboard') ||
        pathname?.startsWith('/matriculas') ||
        pathname?.startsWith('/academico') ||
        pathname?.startsWith('/financeiro') ||
        pathname?.startsWith('/configuracoes') ||
        pathname?.startsWith('/comunicacao') ||
        pathname?.startsWith('/tarefas') ||
        pathname?.startsWith('/calendario')
      )
    }
    return pathname?.startsWith(item.href)
  }

  // Check if blocked
  const isModuleBlocked = (item: ModuloItem) => {
    if (isStudentUser && !['agenda-digital', 'provas-online'].includes(item.id)) {
      return true
    }
    if (item.blockedKey && userPerfilObj && (userPerfilObj as any)[item.blockedKey]) {
      return true
    }
    return false
  }

  // Pre-carrega em background as rotas dos módulos quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      modulos.forEach(m => {
        if (!isModuleBlocked(m) && !isModuleActive(m)) {
          try {
            router.prefetch(m.href)
          } catch (_) {}
        }
      })
      try {
        router.prefetch('/login?step=choose_system')
      } catch (_) {}
    }
  }, [isOpen, router])

  const handleSelectModule = (item: ModuloItem) => {
    if (isModuleBlocked(item)) return

    if (isModuleActive(item)) {
      onClose()
      return
    }

    setNavigatingId(item.id)

    // Ativa imediatamente a animação de carregamento luxuosa que permanece até entrar na página
    startModuleTransition({
      targetHref: item.href,
      title: item.title,
      subtitle: item.tag || item.title.toUpperCase(),
      statusText: `Acessando ${item.title}...`,
      id: item.id
    })

    onClose()
    router.push(item.href)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="trocar-modulo-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 10px))',
            paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
            paddingLeft: 'max(12px, calc(env(safe-area-inset-left, 0px) + 10px))',
            paddingRight: 'max(12px, calc(env(safe-area-inset-right, 0px) + 10px))',
            overflow: 'hidden'
          }}
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(4, 7, 18, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 960,
              maxHeight: '100%',
              borderRadius: isMobile ? 24 : 32,
              background: 'linear-gradient(165deg, rgba(17, 24, 43, 0.96) 0%, rgba(9, 13, 27, 0.99) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 50px rgba(0, 210, 255, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Glow Orbs */}
            <div
              style={{
                position: 'absolute',
                top: -100,
                left: -100,
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 210, 255, 0.15) 0%, transparent 70%)',
                filter: 'blur(50px)',
                pointerEvents: 'none'
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -100,
                right: -100,
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(121, 40, 202, 0.18) 0%, transparent 70%)',
                filter: 'blur(50px)',
                pointerEvents: 'none'
              }}
            />

            {/* Pinned/Sticky Header Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: isMobile ? '16px 16px 14px' : '26px 32px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                background: 'rgba(17, 24, 43, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                position: 'relative',
                zIndex: 10,
                flexShrink: 0
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Pill Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: isMobile ? '3px 10px' : '4px 12px',
                    borderRadius: 20,
                    background: 'rgba(0, 210, 255, 0.08)',
                    border: '1px solid rgba(0, 210, 255, 0.22)',
                    marginBottom: isMobile ? 8 : 10
                  }}
                >
                  <Sparkles size={isMobile ? 11 : 13} color="#00D2FF" style={{ filter: 'drop-shadow(0 0 6px #00D2FF)' }} />
                  <span
                    style={{
                      fontSize: isMobile ? 9.5 : 10.5,
                      fontWeight: 800,
                      color: '#00D2FF',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase'
                    }}
                  >
                    Ecossistema Impacto EDU
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h2
                  style={{
                    fontSize: isMobile ? 20 : 26,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1.2
                  }}
                >
                  <span>Módulos do Sistema</span>
                </h2>
                <p
                  style={{
                    fontSize: isMobile ? 12 : 13.5,
                    color: 'rgba(255, 255, 255, 0.6)',
                    margin: isMobile ? '4px 0 0 0' : '6px 0 0 0',
                    lineHeight: 1.4
                  }}
                >
                  {isMobile
                    ? 'Alterne com rapidez entre os ambientes integrados da instituição.'
                    : 'Alterne instantaneamente entre os ambientes e plataformas integradas da sua instituição.'}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? 0 : 8,
                  width: isMobile ? 38 : 'auto',
                  height: isMobile ? 38 : 'auto',
                  padding: isMobile ? 0 : '8px 14px',
                  borderRadius: isMobile ? 12 : 16,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                }}
              >
                {!isMobile && (
                  <>
                    <span>Fechar</span>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.08)',
                        fontSize: 10,
                        fontWeight: 800,
                        color: 'rgba(255, 255, 255, 0.5)'
                      }}
                    >
                      ESC
                    </span>
                  </>
                )}
                <X size={isMobile ? 18 : 15} />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div
              className="custom-module-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                padding: isMobile ? '14px 14px 20px' : '22px 32px 28px',
                position: 'relative',
                zIndex: 2
              }}
            >
              {/* Modules Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(270px, 1fr))',
                  gap: isMobile ? 12 : 16
                }}
              >
                {modulos.map((item, index) => {
                  const isActive = isModuleActive(item)
                  const isBlocked = isModuleBlocked(item)
                  const IconComp = item.icon

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                      whileHover={isBlocked ? {} : { scale: 1.015, y: -2 }}
                      whileTap={isBlocked ? {} : { scale: 0.98 }}
                      onClick={() => handleSelectModule(item)}
                      style={{
                        position: 'relative',
                        borderRadius: isMobile ? 18 : 22,
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        background: isActive
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: isActive
                          ? `1.5px solid ${item.borderColor}`
                          : '1px solid rgba(255, 255, 255, 0.07)',
                        boxShadow: isActive
                          ? `0 12px 30px -8px ${item.glowColor}, inset 0 0 16px rgba(255, 255, 255, 0.04)`
                          : '0 4px 14px rgba(0, 0, 0, 0.2)',
                        cursor: isBlocked ? 'not-allowed' : 'pointer',
                        opacity: isBlocked ? 0.45 : 1,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: isMobile ? 10 : 14
                      }}
                      onMouseEnter={(e) => {
                        if (!isBlocked && !isActive) {
                          e.currentTarget.style.borderColor = item.borderColor
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                          e.currentTarget.style.boxShadow = `0 10px 28px -6px ${item.glowColor}`
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isBlocked && !isActive) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)'
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.2)'
                        }
                      }}
                    >
                      {/* Top Highlight Specular sheen */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '40%',
                          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
                          pointerEvents: 'none'
                        }}
                      />

                      {/* Top Row: Icon + Badges */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        {/* Icon */}
                        <div
                          style={{
                            position: 'relative',
                            width: isMobile ? 44 : 52,
                            height: isMobile ? 44 : 52,
                            borderRadius: isMobile ? 14 : 18,
                            background: item.gradient,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 8px 20px -4px ${item.glowColor}`,
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}
                        >
                          {/* Specular gloss on icon */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '50%',
                              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 100%)',
                              borderRadius: '16px 16px 0 0',
                              pointerEvents: 'none'
                            }}
                          />
                          <IconComp size={isMobile ? 21 : 24} color="#ffffff" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isActive ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: isMobile ? '3px 8px' : '4px 10px',
                                borderRadius: 12,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)'
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: '#10b981',
                                  boxShadow: '0 0 8px #10b981'
                                }}
                              />
                              <span style={{ fontSize: isMobile ? 9.5 : 10, fontWeight: 800, color: '#10b981', letterSpacing: '0.04em' }}>
                                MÓDULO ATUAL
                              </span>
                            </div>
                          ) : isBlocked ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: isMobile ? '3px 8px' : '4px 9px',
                                borderRadius: 12,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)'
                              }}
                            >
                              <Lock size={10} color="#ef4444" />
                              <span style={{ fontSize: isMobile ? 9.5 : 10, fontWeight: 700, color: '#ef4444' }}>RESTRITO</span>
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: isMobile ? '3px 8px' : '3px 8px',
                                borderRadius: 10,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                fontSize: isMobile ? 9.5 : 10,
                                fontWeight: 700,
                                color: 'rgba(255, 255, 255, 0.55)',
                                letterSpacing: '0.02em'
                              }}
                            >
                              {item.tag}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div>
                        <h3
                          style={{
                            fontSize: isMobile ? 15.5 : 17,
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: isMobile ? '0 0 4px 0' : '0 0 6px 0',
                            letterSpacing: '-0.01em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span>{item.title}</span>
                        </h3>
                        <p
                          style={{
                            fontSize: isMobile ? 11.5 : 12,
                            color: 'rgba(255, 255, 255, 0.55)',
                            margin: 0,
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.description}
                        </p>
                      </div>

                      {/* Bottom Action Footer */}
                      <div
                        style={{
                          paddingTop: isMobile ? 8 : 10,
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: isMobile ? 2 : 4
                        }}
                      >
                        <span
                          style={{
                            fontSize: isMobile ? 10.5 : 11,
                            fontWeight: 700,
                            color: isActive
                              ? '#10b981'
                              : isBlocked
                              ? 'rgba(255, 255, 255, 0.3)'
                              : item.badgeColor,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 size={13} />
                              <span>Em Uso</span>
                            </>
                          ) : isBlocked ? (
                            <span>Sem Permissão</span>
                          ) : navigatingId === item.id ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Acessando...</span>
                            </>
                          ) : (
                            <>
                              <span>Acessar Módulo</span>
                              <ArrowRight size={13} />
                            </>
                          )}
                        </span>

                        {navigatingId === item.id && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={10} className="animate-spin" />
                            <span>Carregando...</span>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Bottom Modal Bar */}
              <div
                style={{
                  marginTop: isMobile ? 16 : 24,
                  paddingTop: isMobile ? 14 : 18,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 12,
                  position: 'relative',
                  zIndex: 2
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: 8 }}>
                  <Layers size={14} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: isMobile ? 11 : 12, color: 'rgba(255, 255, 255, 0.45)', textAlign: isMobile ? 'center' : 'left' }}>
                    Acesso rápido sincronizado • Colégio Impacto
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      startModuleTransition({
                        targetHref: '/login',
                        title: 'Seleção de Módulos',
                        subtitle: 'ECOSSISTEMA IMPACTO EDU',
                        statusText: 'Acessando tela de seleção completa...',
                        id: 'choose_system'
                      })
                      onClose()
                      router.push('/login?step=choose_system')
                    }}
                    style={{
                      background: 'rgba(0, 210, 255, 0.08)',
                      border: '1px solid rgba(0, 210, 255, 0.25)',
                      color: '#00D2FF',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 10,
                      transition: 'all 0.2s',
                      width: isMobile ? '100%' : 'auto'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 210, 255, 0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 210, 255, 0.08)')}
                  >
                    <span>Ver tela de seleção completa</span>
                    <ExternalLink size={13} />
                  </button>

                  {isMobile && (
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.75)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 14px',
                        borderRadius: 10,
                        width: '100%'
                      }}
                    >
                      Fechar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <style jsx>{`
            .custom-module-scrollbar::-webkit-scrollbar {
              width: 5px;
            }
            .custom-module-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-module-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.15);
              border-radius: 9999px;
            }
            .custom-module-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.25);
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  )
}
