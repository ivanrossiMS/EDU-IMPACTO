'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  DollarSign,
  Receipt,
  FileText,
  Clock,
  QrCode,
  Users,
  Lock,
  ArrowLeft,
  Loader2,
  History,
  Info
} from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'

export interface TargetResponsavel {
  id: string
  nome: string
  parentesco?: string
  email?: string
  telefone?: string
  foto?: string
  respFinanceiro?: boolean
  respPedagogico?: boolean
  isTitular?: boolean
  latestAudit?: {
    autorizadoPorNome?: string
    dataHora?: string
    acao?: string
  } | null
}

export interface AutorizacaoFinanceiraModalProps {
  isOpen: boolean
  onClose: () => void
  targetResponsavel: TargetResponsavel | null
  aluno: {
    id: string
    nome: string
  }
  titularNome: string
  currentLoggedUserName: string
  outrosAlunos?: { id: string; nome: string }[]
  historico?: any[]
  initialMode?: 'AUTORIZAR' | 'REVOGAR' | 'HISTORICO'
  onConfirm: (options: {
    acao: 'AUTORIZAR' | 'REVOGAR'
    responsavelId: string
    alunoId: string
    aplicarTodos: boolean
  }) => Promise<void>
}

export function AutorizacaoFinanceiraModal({
  isOpen,
  onClose,
  targetResponsavel,
  aluno,
  titularNome,
  currentLoggedUserName,
  outrosAlunos = [],
  historico = [],
  initialMode = 'AUTORIZAR',
  onConfirm
}: AutorizacaoFinanceiraModalProps) {
  const [mode, setMode] = useState<'AUTORIZAR' | 'REVOGAR' | 'HISTORICO'>(initialMode)
  const [aplicarTodos, setAplicarTodos] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reseta estado sempre que abrir ou mudar o responsável
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setAplicarTodos(true)
      setErrorMsg(null)
      setIsSubmitting(false)
    }
  }, [isOpen, initialMode, targetResponsavel?.id])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Trava scroll do body e html quando o modal estiver aberto para impedir rolagem vertical no fundo
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow
      const originalBodyOverscroll = document.body.style.overscrollBehavior
      const originalHtmlOverflow = document.documentElement.style.overflow

      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = originalBodyOverflow
        document.body.style.overscrollBehavior = originalBodyOverscroll
        document.documentElement.style.overflow = originalHtmlOverflow
      }
    }
  }, [isOpen])

  if (!isOpen || !targetResponsavel || !mounted || typeof document === 'undefined') return null

  const handleAction = async () => {
    if (mode !== 'AUTORIZAR' && mode !== 'REVOGAR') return
    try {
      setIsSubmitting(true)
      setErrorMsg(null)
      await onConfirm({
        acao: mode,
        responsavelId: targetResponsavel.id,
        alunoId: aluno.id,
        aplicarTodos
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao processar a autorização.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtra histórico para este responsável em específico
  const respHistory = (historico || []).filter(
    (h: any) => String(h.responsavel_id).trim() === String(targetResponsavel.id).trim()
  )

  const formatDateTime = (isoDate?: string) => {
    if (!isoDate) return 'Data não registrada'
    try {
      const d = new Date(isoDate)
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      return formatDate(isoDate)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        overflow: 'hidden'
      }}
      onClick={onClose}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault()
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 28,
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          fontFamily: 'Outfit, Inter, system-ui, sans-serif',
          margin: 'auto',
          position: 'relative'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: mode === 'REVOGAR' ? '#fff1f2' : mode === 'HISTORICO' ? '#f8fafc' : '#f0fdf4'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {mode === 'HISTORICO' ? (
              <button
                onClick={() => setMode(targetResponsavel.respFinanceiro ? 'REVOGAR' : 'AUTORIZAR')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            ) : (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: mode === 'REVOGAR' ? '#ffe4e6' : '#dcfce7',
                  color: mode === 'REVOGAR' ? '#e11d48' : '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}
              >
                {mode === 'REVOGAR' ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
              </div>
            )}

            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                {mode === 'AUTORIZAR' && 'Autorizar Acesso Financeiro'}
                {mode === 'REVOGAR' && 'Revogar Acesso Financeiro'}
                {mode === 'HISTORICO' && 'Histórico de Auditoria'}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                {mode === 'HISTORICO'
                  ? `Registros de ${targetResponsavel.nome}`
                  : `Aluno(a): ${aluno.nome}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {errorMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 14,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Card do Responsável Alvo */}
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
                color: '#475569',
                overflow: 'hidden'
              }}
            >
              {targetResponsavel.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={targetResponsavel.foto} alt={targetResponsavel.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(targetResponsavel.nome)
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                  {targetResponsavel.nome}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#e0e7ff',
                    color: '#3730a3',
                    textTransform: 'uppercase'
                  }}
                >
                  {targetResponsavel.parentesco || 'Responsável'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {targetResponsavel.email || targetResponsavel.telefone || 'Sem contato adicional'}
              </div>
            </div>

            {mode !== 'HISTORICO' && (
              <button
                type="button"
                onClick={() => setMode('HISTORICO')}
                title="Ver histórico de auditoria"
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '6px 10px',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <History size={14} /> Histórico
              </button>
            )}
          </div>

          {/* VIEW: AUTORIZAR */}
          {mode === 'AUTORIZAR' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
                  Ao ativar esta autorização, <strong>{targetResponsavel.nome}</strong> terá acesso integral para
                  consultar e acompanhar o setor financeiro de <strong>{aluno.nome}</strong> na Agenda Digital:
                </p>
              </div>

              {/* Lista de Permissões Concedidas */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {[
                  {
                    icon: <Receipt size={18} color="#059669" />,
                    title: 'Faturas e Mensalidades Escolares',
                    desc: 'Visualização de parcelas em aberto, vencimentos e histórico de pagamentos.'
                  },
                  {
                    icon: <QrCode size={18} color="#059669" />,
                    title: 'Pagamento via PIX e Código de Barras',
                    desc: 'Poderá gerar QR Code, copiar código PIX e linha digitável para efetuar pagamentos.'
                  },
                  {
                    icon: <FileText size={18} color="#059669" />,
                    title: 'Comprovantes e Declaração de IRPF',
                    desc: 'Download de recibos de quitação e declaração de pagamentos para fins fiscais.'
                  }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ marginTop: 2 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Opção para aplicar a outros filhos em comum */}
              {outrosAlunos.length > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#f1f5f9',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aplicarTodos}
                    onChange={(e) => setAplicarTodos(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: '#4f46e5' }}
                  />
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                    <div>Aplicar autorização também para os outros filhos em comum:</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                      {outrosAlunos.map((a) => a.nome).join(', ')}
                    </div>
                  </div>
                </label>
              )}

              {/* Aviso Legal e Auditoria */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10
                }}
              >
                <Info size={18} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
                  <strong>Aviso de Segurança & Conformidade (LGPD):</strong> O titular financeiro do contrato
                  continua sendo <strong>{titularNome}</strong>. Esta ação será registrada com data, horário e
                  identificação de <strong>{currentLoggedUserName}</strong> no log de auditoria oficial da escola.
                </div>
              </div>
            </div>
          )}

          {/* VIEW: REVOGAR */}
          {mode === 'REVOGAR' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}
              >
                <AlertTriangle size={20} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                  Ao confirmar a revogação, <strong>{targetResponsavel.nome}</strong> perderá imediatamente o acesso
                  às faturas, boletos, PIX e histórico financeiro de <strong>{aluno.nome}</strong>.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                  color: '#475569',
                  lineHeight: 1.4
                }}
              >
                ✓ <strong>O que NÃO muda:</strong> O acesso pedagógico (notas, frequência, comunicados) e a autorização
                para retirada do aluno na portaria permanecem inalterados.
              </div>

              {/* Opção para revogar em outros filhos em comum */}
              {outrosAlunos.length > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#f1f5f9',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aplicarTodos}
                    onChange={(e) => setAplicarTodos(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: '#e11d48' }}
                  />
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                    <div>Revogar também nos outros filhos em comum:</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                      {outrosAlunos.map((a) => a.nome).join(', ')}
                    </div>
                  </div>
                </label>
              )}

              <div style={{ fontSize: 12, color: '#64748b' }}>
                Esta revogação será registrada no histórico de auditoria por <strong>{currentLoggedUserName}</strong>.
              </div>
            </div>
          )}

          {/* VIEW: HISTÓRICO */}
          {mode === 'HISTORICO' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Linha do Tempo de Autorizações Financeiras:
              </div>

              {respHistory.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 16,
                    border: '1px dashed #cbd5e1',
                    color: '#64748b'
                  }}
                >
                  <Clock size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                    Nenhum registro de alteração recente encontrado para este responsável.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {respHistory.map((item: any, idx: number) => {
                    const isConcessao = item.acao === 'AUTORIZAR_FINANCEIRO' || item.acao === 'AUTORIZAR'
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: isConcessao ? '#f0fdf4' : '#fff1f2',
                          border: `1px solid ${isConcessao ? '#bbf7d0' : '#fecaca'}`,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isConcessao ? '#dcfce7' : '#ffe4e6',
                            color: isConcessao ? '#16a34a' : '#e11d48',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {isConcessao ? <CheckCircle2 size={16} /> : <Lock size={16} />}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isConcessao ? '#15803d' : '#991b1b' }}>
                              {isConcessao ? 'Acesso Financeiro Autorizado' : 'Acesso Financeiro Revogado'}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              {formatDateTime(item.data_hora)}
                            </span>
                          </div>

                          <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                            Ação realizada por <strong>{item.autorizado_por_nome || 'Responsável Titular'}</strong>
                          </div>

                          {item.motivo && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                              &ldquo;{item.motivo}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          {mode === 'HISTORICO' ? (
            <button
              onClick={() => setMode(targetResponsavel.respFinanceiro ? 'REVOGAR' : 'AUTORIZAR')}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Fechar Histórico
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {mode === 'REVOGAR' ? 'Manter Acesso' : 'Cancelar'}
              </button>

              <button
                type="button"
                onClick={handleAction}
                disabled={isSubmitting}
                style={{
                  padding: '10px 22px',
                  borderRadius: 12,
                  border: 'none',
                  background: mode === 'REVOGAR' ? '#e11d48' : '#16a34a',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow:
                    mode === 'REVOGAR'
                      ? '0 6px 16px rgba(225, 29, 72, 0.25)'
                      : '0 6px 16px rgba(22, 163, 74, 0.25)'
                }}
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {mode === 'AUTORIZAR' && (isSubmitting ? 'Autorizando...' : 'Confirmar e Liberar Acesso')}
                {mode === 'REVOGAR' && (isSubmitting ? 'Revogando...' : 'Confirmar Revogação')}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
