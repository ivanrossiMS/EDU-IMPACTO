'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  MessageSquareOff,
  Users,
  Building2,
  Check,
  Phone,
  ArrowRight
} from 'lucide-react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { getSecretariaWhatsApp } from '@/lib/whatsapp'

export interface ColabChatNoticeModalProps {
  isOpen: boolean
  onClose: () => void
  colaboradorNome?: string
  alunoNome?: string
  whatsappUrl?: string
  whatsappLabel?: string
  onOpenTurmaGroup?: () => void
}

export function ColabChatNoticeModal({
  isOpen,
  onClose,
  colaboradorNome,
  alunoNome,
  whatsappUrl,
  whatsappLabel,
  onOpenTurmaGroup
}: ColabChatNoticeModalProps) {
  const { adConfig } = useAgendaDigital()
  const secWa = getSecretariaWhatsApp(adConfig?.contatosWhatsapp)

  const effectiveWhatsappUrl = whatsappUrl || secWa?.url
  const effectiveWhatsappLabel = whatsappLabel || secWa?.label || 'Falar com a Secretaria (Auxiliadora) no WhatsApp'

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}
      >
        {/* Backdrop com blur escuro sofisticado */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.68)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
        />

        {/* Card do Modal */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 65px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8)',
            overflow: 'hidden',
            zIndex: 1
          }}
        >
          {/* Barra gradiente decorativa superior */}
          <div
            style={{
              height: 5,
              background: 'linear-gradient(90deg, #f97316 0%, #ef4444 50%, #8b5cf6 100%)'
            }}
          />

          {/* Botão de Fechar no canto superior */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar aviso"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#e2e8f0'
              e.currentTarget.style.color = '#0f172a'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9'
              e.currentTarget.style.color = '#64748b'
            }}
          >
            <X size={16} />
          </button>

          {/* Conteúdo Principal */}
          <div style={{ padding: '28px 24px 24px' }}>
            {/* Ícone com anel duplo e sombra suave */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.15))',
                  border: '1.5px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 18px -4px rgba(239, 68, 68, 0.4)',
                    color: '#ffffff'
                  }}
                >
                  <MessageSquareOff size={22} strokeWidth={2.2} />
                </div>
              </div>
            </div>

            {/* Tag / Chip Institucional */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#991b1b',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#dc2626'
                  }}
                />
                Canal Temporariamente Pausado
              </span>
            </div>

            {/* Título Principal */}
            <h3
              style={{
                fontSize: 19,
                fontWeight: 800,
                textAlign: 'center',
                margin: '0 0 8px 0',
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.3
              }}
            >
              Conversas com Colaboradores Desativadas
            </h3>

            {/* Mensagem explicativa */}
            <p
              style={{
                fontSize: 13.5,
                textAlign: 'center',
                color: '#475569',
                margin: '0 0 20px 0',
                lineHeight: 1.55
              }}
            >
              {colaboradorNome ? (
                <>
                  O envio de mensagens diretas para <strong>{colaboradorNome}</strong> e demais educadores está temporariamente desativado pela administração da escola.
                </>
              ) : (
                <>
                  O envio de mensagens diretas entre familiares e colaboradores está temporariamente desativado pela administração da escola.
                </>
              )}
            </p>

            {/* Caixa com Destaques Informativos */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 20
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1
                  }}
                >
                  <Users size={15} />
                </div>
                <div>
                  <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 2px 0', color: '#0f172a' }}>
                    Mural da Turma Disponível
                  </h4>
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                    Os recados, avisos e comunicados da equipe pedagógica continuam disponíveis para consulta no mural oficial da turma.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: '#fef3c7',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1
                  }}
                >
                  <Building2 size={15} />
                </div>
                <div>
                  <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 2px 0', color: '#0f172a' }}>
                    Atendimento da Secretaria
                  </h4>
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                    Para solicitações urgentes, autorizações ou setor administrativo, contate a recepção da escola.
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Botão Secundário WhatsApp (se disponível) */}
              {effectiveWhatsappUrl && (
                <a
                  href={effectiveWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    minHeight: 42,
                    height: 'auto',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    color: '#065f46',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                >
                  <Phone size={15} color="#059669" style={{ flexShrink: 0 }} />
                  <span>{effectiveWhatsappLabel}</span>
                </a>
              )}

              {/* Botão Secundário: Ir para Grupo da Turma (se fornecido) */}
              {onOpenTurmaGroup && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenTurmaGroup()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    height: 42,
                    borderRadius: 12,
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users size={15} />
                  <span>Acessar Mural da Turma</span>
                  <ArrowRight size={14} />
                </button>
              )}

              {/* Botão Primário: Entendi */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Check size={17} strokeWidth={2.5} />
                <span>Entendi</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
