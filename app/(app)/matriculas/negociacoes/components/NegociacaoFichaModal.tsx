'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Printer, Copy, Check, ShieldCheck, User, Users, Phone,
  Calendar, CreditCard, BookOpen, Handshake, Sparkles, Clock,
  CheckCircle2, AlertCircle, Edit3, MessageCircle, FileText, ArrowRight
} from 'lucide-react'
import {
  NegociacaoMatriculaRecord,
  MODALIDADE_ISAAC_CONFIG,
  STATUS_NEGOCIACAO_CONFIG,
  fmtCurrency,
  fmtDate,
  fmtDateTime,
  buildResumoNegociacaoTexto,
} from '../types'

interface NegociacaoFichaModalProps {
  negociacao: NegociacaoMatriculaRecord | null
  onClose: () => void
  onEdit: (neg: NegociacaoMatriculaRecord) => void
  onUpdateStatus: (
    id: string,
    status: NegociacaoMatriculaRecord['status'],
    obsOperacional?: string,
    acaoLabel?: string
  ) => Promise<void>
  currentUserName: string
}

export function NegociacaoFichaModal({
  negociacao,
  onClose,
  onEdit,
  onUpdateStatus,
  currentUserName,
}: NegociacaoFichaModalProps) {
  const [copied, setCopied] = useState(false)
  const [notaOp, setNotaOp] = useState(negociacao?.observacoesOperacionais || '')
  const [savingNota, setSavingNota] = useState(false)

  if (!negociacao) return null

  const modCfg = MODALIDADE_ISAAC_CONFIG[negociacao.modalidadeIsaac] || MODALIDADE_ISAAC_CONFIG.no_isaac
  const statusCfg = STATUS_NEGOCIACAO_CONFIG[negociacao.status] || STATUS_NEGOCIACAO_CONFIG.autorizado

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildResumoNegociacaoTexto(negociacao))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  const handlePrintFicha = () => {
    document.body.classList.add('printing-ficha-negociacao')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('printing-ficha-negociacao')
    }, 600)
  }

  const handleSaveNota = async () => {
    setSavingNota(true)
    try {
      await onUpdateStatus(
        negociacao.id,
        negociacao.status,
        notaOp,
        `Nota operacional atualizada por ${currentUserName}`
      )
    } finally {
      setSavingNota(false)
    }
  }

  const cleanPhone = (negociacao.responsavelTelefone || '').replace(/\D/g, '')
  const whatsappUrl = cleanPhone
    ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(buildResumoNegociacaoTexto(negociacao))}`
    : null

  return (
    <AnimatePresence>
      <div
        className="negociacao-ficha-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9990,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        <motion.div
          id="ficha-negociacao-printable"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 880,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #cbd5e1',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            color: '#0f172a',
          }}
        >
          {/* Top Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1e3a8a 100%)',
              padding: '22px 28px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              borderBottom: '1px solid #1e293b',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    color: '#f8fafc',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontFamily: 'monospace',
                    letterSpacing: '0.04em',
                  }}
                >
                  {negociacao.protocolo}
                </span>
                <span
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}
                >
                  ANO LETIVO {negociacao.anoLetivo}
                </span>
                <span
                  style={{
                    background: modCfg.bg,
                    border: `1px solid ${modCfg.border}`,
                    color: modCfg.color,
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}
                >
                  ● {modCfg.shortLabel}
                </span>
                <span
                  style={{
                    background: statusCfg.bg,
                    border: `1px solid ${statusCfg.border}`,
                    color: statusCfg.color,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}
                >
                  {statusCfg.label}
                </span>
              </div>

              <h2 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                Termo de Autorização de Negociação Comercial
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Autorizado por <strong style={{ color: '#ffffff' }}>{negociacao.autorizadoPor}</strong> ({negociacao.meioAutorizacao}) em{' '}
                <strong style={{ color: '#ffffff' }}>{fmtDate(negociacao.dataAutorizacao)}</strong>
                {negociacao.validadeNegociacao ? ` · Válido até ${fmtDate(negociacao.validadeNegociacao)}` : ''}
              </p>
            </div>

            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: copied ? '#10b981' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar Resumo'}
              </button>

              <button
                onClick={handlePrintFicha}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Printer size={14} />
                Imprimir Ficha
              </button>

              <button
                onClick={onClose}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Identificação de Aluno(s) e Responsável */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {/* Card Aluno(s) */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} color="#2563eb" />
                    Estudante(s) Beneficiado(s)
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: negociacao.vinculadoErp ? '#dbeafe' : '#f1f5f9',
                      color: negociacao.vinculadoErp ? '#1d4ed8' : '#475569',
                    }}
                  >
                    {negociacao.vinculadoErp ? '✓ Cadastrado no ERP' : '✎ Digitado Manualmente'}
                  </span>
                </div>

                {Array.isArray(negociacao.alunos) && negociacao.alunos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {negociacao.alunos.map((al, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{al.nome || 'Aluno sem nome'}</div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                            {al.serieTurma || negociacao.serieTurma || 'Série não informada'}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: al.tipoAluno === 'novo' ? '#fef3c7' : '#e0e7ff',
                            color: al.tipoAluno === 'novo' ? '#b45309' : '#3730a3',
                          }}
                        >
                          {al.tipoAluno === 'novo' ? 'Aluno Novo' : 'Veterano'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{negociacao.alunoNome}</div>
                    <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginTop: 2 }}>{negociacao.serieTurma}</div>
                  </div>
                )}
              </div>

              {/* Card Responsável */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} color="#059669" />
                      Responsável pela Negociação
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#d1fae5',
                        color: '#065f46',
                      }}
                    >
                      {negociacao.responsavelParentesco || 'Responsável'}
                    </span>
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
                    {negociacao.responsavelNome || 'Não informado'}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                    {negociacao.responsavelTelefone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={13} color="#059669" />
                        {negociacao.responsavelTelefone}
                      </span>
                    )}
                    {negociacao.responsavelCpf && (
                      <span>CPF: <strong>{negociacao.responsavelCpf}</strong></span>
                    )}
                  </div>
                </div>

                {whatsappUrl && (
                  <div className="no-print" style={{ marginTop: 12 }}>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#ecfdf5',
                        border: '1px solid #6ee7b7',
                        color: '#047857',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        textDecoration: 'none',
                      }}
                    >
                      <MessageCircle size={14} />
                      Enviar Resumo no WhatsApp do Responsável
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Condições Autorizadas pela Direção */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="#2563eb" />
                Condições Financeiras Autorizadas pela Direção
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {/* Matrícula */}
                {negociacao.temMatricula && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #bfdbfe',
                      borderRadius: 16,
                      padding: 16,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#1e40af', textTransform: 'uppercase' }}>
                        🎒 Matrícula / Rematrícula {negociacao.anoLetivo}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: negociacao.canalMatricula === 'no_isaac' ? '#f5f3ff' : '#ecfdf5',
                          color: negociacao.canalMatricula === 'no_isaac' ? '#6d28d9' : '#047857',
                          border: `1px solid ${negociacao.canalMatricula === 'no_isaac' ? '#c4b5fd' : '#6ee7b7'}`,
                        }}
                      >
                        {negociacao.canalMatricula === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      {negociacao.valorTabelaMatricula > negociacao.valorAutorizadoMatricula && (
                        <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                          {fmtCurrency(negociacao.valorTabelaMatricula)}
                        </span>
                      )}
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                        {fmtCurrency(negociacao.valorAutorizadoMatricula)}
                      </span>
                      {negociacao.descontoMatriculaPct > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 6 }}>
                          -{negociacao.descontoMatriculaPct.toFixed(1)}% OFF
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                      Forma: {negociacao.formaPagamentoMatricula}
                      {negociacao.parcelasMatricula > 1
                        ? ` em ${negociacao.parcelasMatricula}x de ${fmtCurrency(negociacao.valorAutorizadoMatricula / negociacao.parcelasMatricula)}`
                        : ' (À vista)'}
                    </div>
                    {negociacao.detalheMatricula && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Obs: {negociacao.detalheMatricula}
                      </div>
                    )}
                  </div>
                )}

                {/* Mensalidade */}
                {negociacao.temMensalidade && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #a7f3d0',
                      borderRadius: 16,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#065f46', textTransform: 'uppercase' }}>
                        📅 Mensalidades {negociacao.anoLetivo} ({negociacao.qtdParcelasMensalidade}x)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: negociacao.canalMensalidade === 'no_isaac' ? '#f5f3ff' : '#ecfdf5',
                          color: negociacao.canalMensalidade === 'no_isaac' ? '#6d28d9' : '#047857',
                          border: `1px solid ${negociacao.canalMensalidade === 'no_isaac' ? '#c4b5fd' : '#6ee7b7'}`,
                        }}
                      >
                        {negociacao.canalMensalidade === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      {negociacao.valorTabelaMensalidade > negociacao.valorAutorizadoMensalidade && (
                        <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                          {fmtCurrency(negociacao.valorTabelaMensalidade)}
                        </span>
                      )}
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                        {fmtCurrency(negociacao.valorAutorizadoMensalidade)}
                        <small style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>/mês</small>
                      </span>
                      {negociacao.descontoMensalidadePct > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 6 }}>
                          -{negociacao.descontoMensalidadePct.toFixed(1)}% OFF
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                      Vencimento todo dia {negociacao.diaVencimentoMensalidade} · Total Anual:{' '}
                      {fmtCurrency(negociacao.valorAutorizadoMensalidade * negociacao.qtdParcelasMensalidade)}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Regra: {negociacao.condicaoMensalidade}
                    </div>
                  </div>
                )}

                {/* Parcelamento Especial */}
                {negociacao.temParcelamentoEspecial && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #ddd6fe',
                      borderRadius: 16,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#5b21b6', textTransform: 'uppercase' }}>
                        💳 Parcelamento / Acordo Especial
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: negociacao.canalParcelamento === 'no_isaac' ? '#f5f3ff' : '#ecfdf5',
                          color: negociacao.canalParcelamento === 'no_isaac' ? '#6d28d9' : '#047857',
                          border: `1px solid ${negociacao.canalParcelamento === 'no_isaac' ? '#c4b5fd' : '#6ee7b7'}`,
                        }}
                      >
                        {negociacao.canalParcelamento === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                      {negociacao.descricaoParcelamento || 'Parcelamento Especial Autorizado'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      {negociacao.valorOriginalParcelamento > negociacao.valorAutorizadoParcelamento && (
                        <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                          {fmtCurrency(negociacao.valorOriginalParcelamento)}
                        </span>
                      )}
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                        {fmtCurrency(negociacao.valorAutorizadoParcelamento)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                      {negociacao.entradaParcelamento > 0 && `Entrada ${fmtCurrency(negociacao.entradaParcelamento)} + `}
                      {negociacao.qtdParcelasEspecial}x de{' '}
                      {fmtCurrency(
                        Math.max(0, negociacao.valorAutorizadoParcelamento - (negociacao.entradaParcelamento || 0)) /
                          Math.max(1, negociacao.qtdParcelasEspecial)
                      )}{' '}
                      ({negociacao.formaPagamentoParcelamento})
                    </div>
                  </div>
                )}

                {/* Material Didático */}
                {negociacao.temMaterial && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #fde68a',
                      borderRadius: 16,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#92400e', textTransform: 'uppercase' }}>
                        📚 Material Didático / Serviços
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: negociacao.canalMaterial === 'no_isaac' ? '#f5f3ff' : '#ecfdf5',
                          color: negociacao.canalMaterial === 'no_isaac' ? '#6d28d9' : '#047857',
                          border: `1px solid ${negociacao.canalMaterial === 'no_isaac' ? '#c4b5fd' : '#6ee7b7'}`,
                        }}
                      >
                        {negociacao.canalMaterial === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                      {negociacao.descricaoMaterial || 'Material Didático 2027'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      {negociacao.valorTabelaMaterial > negociacao.valorAutorizadoMaterial && (
                        <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                          {fmtCurrency(negociacao.valorTabelaMaterial)}
                        </span>
                      )}
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                        {fmtCurrency(negociacao.valorAutorizadoMaterial)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                      {negociacao.parcelasMaterial}x de{' '}
                      {fmtCurrency(negociacao.valorAutorizadoMaterial / Math.max(1, negociacao.parcelasMaterial))} (
                      {negociacao.formaPagamentoMaterial})
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Observações da Direção */}
            {negociacao.observacoesDirecao && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', marginBottom: 4 }}>
                  📌 Observações e Orientações da Direção
                </div>
                <div style={{ fontSize: 13, color: '#78350f', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {negociacao.observacoesDirecao}
                </div>
              </div>
            )}

            {/* Controle Operacional dos Colaboradores (No-Print) */}
            <div
              className="no-print"
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 16,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
                  ⚙️ Acompanhamento Operacional (Secretaria & Financeiro)
                </span>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['autorizado', 'lancado', 'concluido', 'cancelado'] as const).map(st => {
                    const cfg = STATUS_NEGOCIACAO_CONFIG[st]
                    const isCurrent = negociacao.status === st
                    return (
                      <button
                        key={st}
                        onClick={() => onUpdateStatus(negociacao.id, st, notaOp)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: isCurrent ? cfg.dot : '#ffffff',
                          color: isCurrent ? '#ffffff' : cfg.color,
                          border: `1px solid ${isCurrent ? cfg.dot : cfg.border}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        {cfg.shortLabel}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={notaOp}
                  onChange={e => setNotaOp(e.target.value)}
                  placeholder="Ex: Desconto lançado no isaac em 28/10 por Maria; 1ª parcela paga na maquininha..."
                  style={{
                    flex: 1,
                    minWidth: 240,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 13,
                    color: '#0f172a',
                    fontWeight: 600,
                  }}
                />
                <button
                  onClick={handleSaveNota}
                  disabled={savingNota}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingNota ? 'Salvando...' : 'Salvar Anotação'}
                </button>
              </div>

              {/* Histórico Recente */}
              {Array.isArray(negociacao.historico) && negociacao.historico.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>
                    Histórico de Auditoria:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 110, overflowY: 'auto' }}>
                    {negociacao.historico.slice(0, 6).map(h => (
                      <div key={h.id} style={{ fontSize: 11, color: '#475569', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{fmtDateTime(h.dataHora)}</span>
                        <strong>{h.usuario}:</strong>
                        <span>{h.acao}</span>
                        {h.detalhe && <span style={{ color: '#64748b' }}>— {h.detalhe}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assinaturas no Modo Impressão */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 32,
                marginTop: 16,
                paddingTop: 20,
                borderTop: '1px dashed #cbd5e1',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #334155', height: 28, marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{negociacao.autorizadoPor}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Direção · Colégio Impacto</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #334155', height: 28, marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  {negociacao.responsavelNome || 'Responsável Financeiro'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Ciente das condições autorizadas</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="no-print"
            style={{
              padding: '16px 28px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}
          >
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Registrado por <strong>{negociacao.registradoPor}</strong> · Última atualização: {fmtDateTime(negociacao.updatedAt)}
            </span>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  onClose()
                  onEdit(negociacao)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={14} />
                Editar Negociação
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
