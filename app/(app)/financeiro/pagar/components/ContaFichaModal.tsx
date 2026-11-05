'use client'

import React from 'react'
import {
  X, Printer, CheckCircle2, Edit3, RotateCcw, Split, Clock
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  STATUS_CONTA_PAGAR_CONFIG,
  PRIORIDADE_CONTA_PAGAR_CONFIG,
  openPrintOrdemPagamento,
} from '../types'

interface ContaFichaModalProps {
  conta: ContaPagarRecord | null
  onClose: () => void
  onEdit: (conta: ContaPagarRecord) => void
  onBaixar: (conta: ContaPagarRecord) => void
  onReverterBaixa: (conta: ContaPagarRecord) => void
}

export function ContaFichaModal({
  conta,
  onClose,
  onEdit,
  onBaixar,
  onReverterBaixa,
}: ContaFichaModalProps) {
  if (!conta) return null

  const stCfg = STATUS_CONTA_PAGAR_CONFIG[conta.status] || STATUS_CONTA_PAGAR_CONFIG.pendente
  const prioCfg = PRIORIDADE_CONTA_PAGAR_CONFIG[conta.prioridade] || PRIORIDADE_CONTA_PAGAR_CONFIG.media

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-conta-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1120,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 800,
                  color: stCfg.color,
                  background: stCfg.bg,
                  border: `1px solid ${stCfg.border}`,
                }}
              >
                {stCfg.label}
              </span>
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  color: prioCfg.color,
                  background: prioCfg.bg,
                }}
              >
                Prioridade {prioCfg.label}
              </span>
              <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 800, fontFamily: 'monospace' }}>
                {conta.codigo || conta.id}
              </span>
            </div>
            <h2 id="ficha-conta-title" style={{ margin: '6px 0 0', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
              {conta.descricao}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar dossiê"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Cards de Valores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Valor Bruto</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{formatCurrency(conta.valorBase)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 10, color: '#b45309', textTransform: 'uppercase', fontWeight: 700 }}>Descontos / Retenções</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
                - {formatCurrency((conta.desconto || 0) + (conta.retencaoImpostos || 0))}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3' }}>
              <div style={{ fontSize: 10, color: '#be123c', textTransform: 'uppercase', fontWeight: 700 }}>Juros & Multa</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#be123c', marginTop: 4 }}>
                + {formatCurrency((conta.juros || 0) + (conta.multa || 0))}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 10, color: '#047857', textTransform: 'uppercase', fontWeight: 800 }}>Valor Líquido</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#047857', marginTop: 4 }}>{formatCurrency(conta.valor)}</div>
            </div>
          </div>

          {/* Metadados do Credor e Classificação */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              padding: 16,
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Fornecedor / Beneficiário</div>
              <div style={{ color: '#0f172a', fontWeight: 800, fontSize: 14, marginTop: 2 }}>{conta.fornecedorNome}</div>
              {conta.fornecedorDocumento && <div style={{ color: '#475569', marginTop: 2 }}>CNPJ/CPF: {conta.fornecedorDocumento}</div>}
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Classificação Orçamentária</div>
              <div style={{ color: '#0369a1', fontWeight: 800, marginTop: 2 }}>{conta.categoria}</div>
              <div style={{ color: '#475569', marginTop: 2 }}>Segmento: {conta.centroCusto}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Datas e Competência</div>
              <div style={{ color: '#0f172a', marginTop: 2 }}>
                Vencimento: <strong>{conta.vencimento?.split('-').reverse().join('/')}</strong> • Competência: <strong>{conta.competencia}</strong>
              </div>
              {conta.dataPagamento && (
                <div style={{ color: '#047857', fontWeight: 700, marginTop: 2 }}>
                  Pago em: {conta.dataPagamento.split('-').reverse().join('/')} ({conta.caixaOrigem || conta.formaPagamento})
                </div>
              )}
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Documento Fiscal & Pagamento</div>
              <div style={{ color: '#0f172a', marginTop: 2 }}>
                {conta.tipoDocumento || 'Doc'}: <strong>{conta.numeroDocumento || 'S/N'}</strong> • Forma: <strong>{conta.formaPagamento}</strong>
              </div>
              {conta.chavePix && <div style={{ color: '#0369a1', fontWeight: 700, marginTop: 2 }}>PIX: {conta.chavePix}</div>}
            </div>
          </div>

          {/* Rateio de Centro de Custo */}
          {conta.rateio && conta.rateio.length > 0 && (
            <div style={{ padding: 14, borderRadius: 14, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0369a1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Split size={14} /> Rateio Contábil por Segmento Escolar
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {conta.rateio.map((r, i) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: '#ffffff', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>{r.centroCusto}</div>
                    <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 800, marginTop: 2 }}>
                      {r.percentual}% • {formatCurrency(r.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trilha de Auditoria (Histórico) */}
          {conta.historico && conta.historico.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> Trilha de Auditoria e Histórico do Título
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conta.historico.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderLeft: '3px solid #0284c7',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: 700 }}>
                      <span>{h.acao}</span>
                      <span style={{ color: '#64748b', fontSize: 11 }}>
                        {new Date(h.data).toLocaleString('pt-BR')} • {h.usuario}
                      </span>
                    </div>
                    {h.detalhes && <div style={{ color: '#475569', marginTop: 3 }}>{h.detalhes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => openPrintOrdemPagamento(conta)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 10,
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} />
            Imprimir Ordem de Pagamento (OP)
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                onClose()
                onEdit(conta)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={14} />
              Editar
            </button>

            {conta.status === 'pago' ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onReverterBaixa(conta)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
                Estornar Baixa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onBaixar(conta)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={14} />
                Dar Baixa ({formatCurrency(conta.valor)})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
