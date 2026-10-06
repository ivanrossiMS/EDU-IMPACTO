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
  Layers
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'

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
  const { currentUserPerfil, currentUser } = useApp()
  const { perfis } = useData()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

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

  const handleSelectModule = (item: ModuloItem) => {
    if (isModuleBlocked(item)) return

    if (isModuleActive(item)) {
      onClose()
      return
    }

    setNavigatingId(item.id)
    onClose()
    router.push(item.href)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto'
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
              backgroundColor: 'rgba(4, 7, 18, 0.82)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 960,
              borderRadius: 32,
              background: 'linear-gradient(165deg, rgba(17, 24, 43, 0.95) 0%, rgba(9, 13, 27, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(0, 210, 255, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
              padding: '32px',
              overflow: 'hidden',
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

            {/* Header Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 28,
                position: 'relative',
                zIndex: 2
              }}
            >
              <div>
                {/* Pill Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: 'rgba(0, 210, 255, 0.08)',
                    border: '1px solid rgba(0, 210, 255, 0.22)',
                    marginBottom: 12
                  }}
                >
                  <Sparkles size={13} color="#00D2FF" style={{ filter: 'drop-shadow(0 0 6px #00D2FF)' }} />
                  <span
                    style={{
                      fontSize: 10.5,
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
                    fontSize: 26,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <span>Módulos do Sistema</span>
                </h2>
                <p
                  style={{
                    fontSize: 13.5,
                    color: 'rgba(255, 255, 255, 0.6)',
                    margin: '6px 0 0 0',
                    lineHeight: 1.4
                  }}
                >
                  Alterne instantaneamente entre os ambientes e plataformas integradas da sua instituição.
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
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 12,
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                  e.currentTarget.style.color = '#ffffff'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
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
                <X size={15} />
              </button>
            </div>

            {/* Modules Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
                gap: 16,
                position: 'relative',
                zIndex: 2
              }}
            >
              {modulos.map((item, index) => {
                const isActive = isModuleActive(item)
                const isBlocked = isModuleBlocked(item)
                const IconComp = item.icon

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                    whileHover={isBlocked ? {} : { scale: 1.02, y: -2 }}
                    whileTap={isBlocked ? {} : { scale: 0.98 }}
                    onClick={() => handleSelectModule(item)}
                    style={{
                      position: 'relative',
                      borderRadius: 22,
                      padding: '20px',
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
                      gap: 14
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      {/* Icon */}
                      <div
                        style={{
                          position: 'relative',
                          width: 52,
                          height: 52,
                          borderRadius: 18,
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
                        <IconComp size={24} color="#ffffff" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isActive ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 12,
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)'
                            }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 8px #10b981'
                              }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: '0.04em' }}>
                              MÓDULO ATUAL
                            </span>
                          </div>
                        ) : isBlocked ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 9px',
                              borderRadius: 12,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)'
                            }}
                          >
                            <Lock size={11} color="#ef4444" />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>RESTRITO</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '3px 8px',
                              borderRadius: 10,
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'rgba(255, 255, 255, 0.5)',
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
                          fontSize: 17,
                          fontWeight: 700,
                          color: '#ffffff',
                          margin: '0 0 6px 0',
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
                          fontSize: 12,
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
                        paddingTop: 10,
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 4
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
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
                        ) : (
                          <>
                            <span>Acessar Módulo</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </span>

                      {navigatingId === item.id && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Carregando...</span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Bottom Modal Bar */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                position: 'relative',
                zIndex: 2
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={15} color="rgba(255,255,255,0.4)" />
                <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.45)' }}>
                  Acesso rápido sincronizado • Colégio Impacto
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  router.push('/login?step=choose_system')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#00D2FF',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 8,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <span>Ver tela de seleção completa</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
