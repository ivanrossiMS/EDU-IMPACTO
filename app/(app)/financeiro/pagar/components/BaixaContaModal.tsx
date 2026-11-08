'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  X, CheckCircle2, Check, Split, QrCode, Barcode, Receipt
} from 'lucide-react'
import { formatCurrency, formatCurrencyInput, handleCurrencyInputChange } from '@/lib/utils'
import { apiFetch } from '@/lib/api/apiClient'
import {
  type ContaPagarRecord,
  type AnexoContaPagarItem,
  type MetodoPagamentoEscolarOption,
  type CaixaEscolarOption,
  resolveMetodosPagamentoEscolares,
  resolveCaixasEscolares,
  calcularValorLiquido,
} from '../types'
import { AnexosInlineSection } from './AnexosLancamentoModal'

interface BaixaContaModalProps {
  isOpen: boolean
  onClose: () => void
  targetContas: ContaPagarRecord[]
  metodosPagamento?: MetodoPagamentoEscolarOption[]
  caixasEscolares?: CaixaEscolarOption[]
  onConfirmBaixaIndividual: (payload: {
    id: string
    dataPagamento: string
    formaPagamento: string
    caixaOrigem: string
    valorPago: number
    desconto: number
    juros: number
    multa: number
    baixaParcial: boolean
    comprovanteRef: string
    observacao: string
    registrarNoCaixa: boolean
    anexosNovos?: AnexoContaPagarItem[]
    emitirRecibo?: boolean
  }) => Promise<void>
  onConfirmBaixaLote: (payload: {
    ids: string[]
    dataPagamento: string
    formaPagamento: string
    caixaOrigem: string
    observacao: string
    emitirRecibo?: boolean
  }) => Promise<void>
}

export function BaixaContaModal({
  isOpen,
  onClose,
  targetContas,
  metodosPagamento,
  caixasEscolares,
  onConfirmBaixaIndividual,
  onConfirmBaixaLote,
}: BaixaContaModalProps) {
  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const isLote = targetContas.length > 1
  const single = targetContas[0] || null

  const metodosAtivos = useMemo(
    () => resolveMetodosPagamentoEscolares(metodosPagamento, false),
    [metodosPagamento]
  )

  const [dbCaixasRaw, setDbCaixasRaw] = useState<any[] | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    apiFetch('/api/configuracoes?chave=cfgCaixas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json) return
        if (Array.isArray(json.valor)) {
          setDbCaixasRaw(json.valor)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen])

  const caixasAbertos = useMemo(
    () => resolveCaixasEscolares(dbCaixasRaw !== null ? dbCaixasRaw : caixasEscolares, true),
    [dbCaixasRaw, caixasEscolares]
  )

  const [dataPagamento, setDataPagamento] = useState(hojeStr)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [caixaOrigem, setCaixaOrigem] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [juros, setJuros] = useState('0')
  const [multa, setMulta] = useState('0')
  const [baixaParcial, setBaixaParcial] = useState(false)
  const [valorPagoParcial, setValorPagoParcial] = useState('0')
  const [comprovanteRef, setComprovanteRef] = useState('')
  const [observacao, setObservacao] = useState('')
  const [registrarNoCaixa, setRegistrarNoCaixa] = useState(true)
  const [emitirRecibo, setEmitirRecibo] = useState(false)
  const [anexosBaixa, setAnexosBaixa] = useState<AnexoContaPagarItem[]>([])
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setDataPagamento(hojeStr)
    setBaixaParcial(false)
    setComprovanteRef('')
    setObservacao('')
    setRegistrarNoCaixa(true)
    setEmitirRecibo(false)
    setAnexosBaixa([])
    setValidationError('')

    // Inicia sem caixa e sem método pré-selecionados para obrigar seleção explícita na baixa
    setCaixaOrigem('')
    setFormaPagamento('')

    if (single && !isLote) {
      setDesconto(String(single.desconto ?? 0))
      setJuros(String(single.juros ?? 0))
      setMulta(String(single.multa ?? 0))
      setValorPagoParcial(String(single.valor ?? 0))
    }
  }, [isOpen, single, isLote, hojeStr])

  const selectedMetodoObj = useMemo(
    () => metodosAtivos.find((m) => m.nome === formaPagamento) || null,
    [metodosAtivos, formaPagamento]
  )

  const numDesconto = Math.max(0, Number(String(desconto).replace(',', '.')) || 0)
  const numJuros = Math.max(0, Number(String(juros).replace(',', '.')) || 0)
  const numMulta = Math.max(0, Number(String(multa).replace(',', '.')) || 0)

  const valorLiquidoSingle = useMemo(() => {
    if (!single) return 0
    return calcularValorLiquido(single.valorBase, numDesconto, numJuros, numMulta, single.retencaoImpostos)
  }, [single, numDesconto, numJuros, numMulta])

  const totalLote = useMemo(
    () => targetContas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    [targetContas]
  )

  const valorEfetivo = useMemo(() => {
    if (isLote) return totalLote
    if (baixaParcial) {
      return Math.max(0, Math.min(valorLiquidoSingle, Number(String(valorPagoParcial).replace(',', '.')) || 0))
    }
    return valorLiquidoSingle
  }, [isLote, totalLote, baixaParcial, valorPagoParcial, valorLiquidoSingle])

  const saldoResidualParcial = useMemo(() => {
    if (isLote || !baixaParcial) return 0
    return Math.max(0, Math.round((valorLiquidoSingle - valorEfetivo) * 100) / 100)
  }, [isLote, baixaParcial, valorLiquidoSingle, valorEfetivo])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targetContas.length === 0) return
    if (!caixaOrigem.trim()) {
      setValidationError('Selecione obrigatoriamente a Conta Bancária / Caixa para realizar a baixa.')
      return
    }
    if (!formaPagamento.trim()) {
      setValidationError('Selecione obrigatoriamente o Método de Pagamento abaixo.')
      return
    }
    setValidationError('')
    setSubmitting(true)
    try {
      if (isLote) {
        await onConfirmBaixaLote({
          ids: targetContas.map((c) => c.id),
          dataPagamento,
          formaPagamento,
          caixaOrigem,
          observacao,
          emitirRecibo,
        })
      } else if (single) {
        await onConfirmBaixaIndividual({
          id: single.id,
          dataPagamento,
          formaPagamento,
          caixaOrigem,
          valorPago: valorEfetivo,
          desconto: numDesconto,
          juros: numJuros,
          multa: numMulta,
          baixaParcial: baixaParcial && saldoResidualParcial > 0.01,
          comprovanteRef,
          observacao,
          registrarNoCaixa,
          anexosNovos: anexosBaixa,
          emitirRecibo,
        })
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || targetContas.length === 0) return null

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-baixa-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1150,
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
          maxWidth: 640,
          maxHeight: '92vh',
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ecfdf5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#047857',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 id="modal-baixa-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#064e3b' }}>
                {isLote ? `Liquidação em Lote (${targetContas.length} Títulos)` : 'Liquidar / Dar Baixa em Conta a Pagar'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#047857' }}>
                {isLote
                  ? 'Baixa simultânea de múltiplos compromissos autorizados pela tesouraria'
                  : `${single?.fornecedorNome} • Vencimento: ${single?.vencimento?.split('-').reverse().join('/')}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de baixa"
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Resumo do Título ou Lote */}
            {!isLote && single ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{single.descricao}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Categoria: <strong style={{ color: '#334155' }}>{single.categoria}</strong> • Segmento:{' '}
                  <strong style={{ color: '#334155' }}>{single.centroCusto}</strong>
                </div>

                {/* Atalhos PIX / Linha Digitável */}
                {(single.chavePix || single.linhaDigitavel) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {single.chavePix && (
                      <button
                        type="button"
                        onClick={() => handleCopy(single.chavePix!, 'pix')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          color: '#0369a1',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedField === 'pix' ? <Check size={13} /> : <QrCode size={13} />}
                        {copiedField === 'pix' ? 'Chave PIX Copiada!' : `Copiar PIX: ${single.chavePix}`}
                      </button>
                    )}
                    {single.linhaDigitavel && (
                      <button
                        type="button"
                        onClick={() => handleCopy(single.linhaDigitavel!, 'boleto')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#f5f3ff',
                          border: '1px solid #ddd6fe',
                          color: '#6d28d9',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedField === 'boleto' ? <Check size={13} /> : <Barcode size={13} />}
                        {copiedField === 'boleto' ? 'Linha Digitável Copiada!' : 'Copiar Linha Digitável'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  maxHeight: 140,
                  overflowY: 'auto',
                }}
              >
                {targetContas.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      {c.descricao} <span style={{ color: '#64748b' }}>({c.fornecedorNome})</span>
                    </span>
                    <strong style={{ color: '#047857' }}>{formatCurrency(c.valor)}</strong>
                  </div>
                ))}
              </div>
            )}

            {validationError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                ⚠ {validationError}
              </div>
            )}

            {/* Linha 1: Data do Pagamento + Conta Bancária / Caixa (2 colunas amplas e organizadas) */}
            <div style={{ display: 'grid', gridTemplateColumns: '185px 1fr', gap: 14, alignItems: 'start' }}>
              <div>
                <label htmlFor="bx-data-pagto" style={labelStyle}>
                  Data do Pagamento <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="bx-data-pagto"
                  type="date"
                  required
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  style={{ ...inputStyle, height: 42 }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'nowrap',
                  }}
                >
                  <label htmlFor="bx-caixa-origem" style={{ ...labelStyle, marginBottom: 0 }}>
                    Conta Bancária / Caixa <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <Link
                    href="/configuracoes/financeiro/caixas"
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#0284c7',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Configurar Caixas
                  </Link>
                </div>
                <select
                  id="bx-caixa-origem"
                  required
                  value={caixaOrigem}
                  onChange={(e) => {
                    setCaixaOrigem(e.target.value)
                    setValidationError('')
                  }}
                  style={{
                    ...inputStyle,
                    height: 42,
                    borderColor: !caixaOrigem ? '#f59e0b' : '#cbd5e1',
                    background: !caixaOrigem ? '#fffbeb' : '#ffffff',
                    fontWeight: caixaOrigem ? 700 : 500,
                  }}
                >
                  <option value="">
                    {caixasAbertos.length === 0
                      ? 'Nenhum caixa aberto cadastrado — clique em + Configurar Caixas'
                      : 'Selecione obrigatoriamente o caixa...'}
                  </option>
                  {caixasAbertos.map((cx) => (
                    <option key={cx.id} value={cx.value}>
                      {cx.label}
                      {cx.operador ? ` (${cx.operador})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seleção Única e Obrigatória do Método de Pagamento */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: formaPagamento ? '#f8fafc' : '#fffbeb',
                border: formaPagamento ? '1px solid #e2e8f0' : '1px solid #fde68a',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 9,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                    Método de Pagamento <span style={{ color: '#dc2626' }}>*</span> ({metodosAtivos.length} ativos)
                  </span>
                  {!formaPagamento && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: '#b45309',
                        background: '#fef3c7',
                        border: '1px solid #fcd34d',
                        padding: '1px 7px',
                        borderRadius: 999,
                      }}
                    >
                      Obrigatório selecionar
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedMetodoObj && (
                    <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>
                      {selectedMetodoObj.codigo} •{' '}
                      {selectedMetodoObj.diasCompensacao === 0
                        ? 'Compensação Imediata'
                        : `${selectedMetodoObj.diasCompensacao}d úteis`}{' '}
                      {selectedMetodoObj.taxaPercentual > 0
                        ? `• Taxa ${selectedMetodoObj.taxaPercentual}%`
                        : '• Isento de Taxa'}
                    </span>
                  )}
                  <Link
                    href="/configuracoes/financeiro/metodos-pagamento"
                    style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textDecoration: 'none' }}
                  >
                    + Configurar
                  </Link>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {metodosAtivos.map((mp) => {
                  const active = formaPagamento === mp.nome
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => {
                        setFormaPagamento(mp.nome)
                        setValidationError('')
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: active ? '1.5px solid #059669' : '1px solid #cbd5e1',
                        background: active ? '#ecfdf5' : '#ffffff',
                        color: active ? '#047857' : '#334155',
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
                        cursor: 'pointer',
                        boxShadow: active ? '0 2px 6px rgba(5, 150, 105, 0.12)' : 'none',
                      }}
                    >
                      {mp.nome}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ajustes de Desconto, Juros, Multa e Baixa Parcial (para título individual) */}
            {!isLote && single && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <label htmlFor="bx-desconto" style={labelStyle}>Desconto Obtido (R$)</label>
                    <input
                      id="bx-desconto"
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(desconto, false)}
                      onChange={(e) => setDesconto(handleCurrencyInputChange(e.target.value, false))}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="bx-juros" style={labelStyle}>Juros por Atraso (R$)</label>
                    <input
                      id="bx-juros"
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(juros, false)}
                      onChange={(e) => setJuros(handleCurrencyInputChange(e.target.value, false))}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="bx-multa" style={labelStyle}>Multa (R$)</label>
                    <input
                      id="bx-multa"
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(multa, false)}
                      onChange={(e) => setMulta(handleCurrencyInputChange(e.target.value, false))}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                </div>

                {/* Opção de Baixa Parcial com desmembramento de saldo */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: baixaParcial ? '#fffbeb' : '#f8fafc',
                    border: baixaParcial ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label
                      htmlFor="bx-parcial-toggle"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0f172a' }}
                    >
                      <input
                        id="bx-parcial-toggle"
                        type="checkbox"
                        checked={baixaParcial}
                        onChange={(e) => {
                          setBaixaParcial(e.target.checked)
                          if (e.target.checked) setValorPagoParcial(String(Math.round((valorLiquidoSingle / 2) * 100) / 100))
                        }}
                      />
                      <Split size={14} color="#d97706" />
                      Realizar Pagamento Parcial (desmembrar saldo remanescente automaticamente)
                    </label>
                  </div>

                  {baixaParcial && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, alignItems: 'end' }}>
                      <div>
                        <label htmlFor="bx-valor-parcial" style={labelStyle}>Valor Pago Agora (R$)</label>
                        <input
                          id="bx-valor-parcial"
                          type="text"
                          inputMode="numeric"
                          value={formatCurrencyInput(valorPagoParcial)}
                          onChange={(e) => setValorPagoParcial(handleCurrencyInputChange(e.target.value))}
                          placeholder="R$ 0,00"
                          style={{ ...inputStyle, borderColor: '#f59e0b', fontWeight: 800, textAlign: 'right' }}
                        />
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: '#fef3c7',
                          border: '1px solid #fde68a',
                          fontSize: 12,
                          color: '#92400e',
                        }}
                      >
                        Novo título residual automático:{' '}
                        <strong style={{ color: '#78350f', fontSize: 14 }}>{formatCurrency(saldoResidualParcial)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="bx-comprovante" style={labelStyle}>Nº Autenticação Bancária / Comprovante</label>
                    <input
                      id="bx-comprovante"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={comprovanteRef}
                      onChange={(e) => setComprovanteRef(e.target.value)}
                      placeholder="Ex: E9040088820261104..."
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="bx-obs" style={labelStyle}>Observação da Baixa</label>
                    <input
                      id="bx-obs"
                      type="text"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Ex: Pago via PIX corporativo Banco do Brasil"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Anexar Comprovante ou Tirar Foto do Pagamento */}
                <AnexosInlineSection
                  anexos={anexosBaixa}
                  onChange={(novos) => setAnexosBaixa(novos)}
                  codigoLancamento={single.codigo || single.id}
                  categoriaPadrao="comprovante"
                  compact
                  tituloSecao="Anexar Comprovante ou Tirar Foto do Recibo"
                />
              </>
            )}

            {/* Opção de Emitir Recibo Oficial Automaticamente */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: emitirRecibo ? '#f0fdf4' : '#f8fafc',
                border: emitirRecibo ? '1px solid #86efac' : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <label
                htmlFor="bx-emitir-recibo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#064e3b',
                }}
              >
                <input
                  id="bx-emitir-recibo"
                  type="checkbox"
                  checked={emitirRecibo}
                  onChange={(e) => setEmitirRecibo(e.target.checked)}
                />
                <Receipt size={15} color="#059669" />
                Emitir Recibo de Pagamento & Quitação automaticamente após confirmar a baixa
              </label>
            </div>
          </div>

          {/* Footer com Valor Exato no Botão de Submissão */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 600 }}>Desembolso Efetivo de Caixa</span>
              <strong style={{ fontSize: 18, color: '#047857', fontWeight: 900 }}>
                {formatCurrency(valorEfetivo)}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || valorEfetivo <= 0}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: '0 6px 16px rgba(5, 150, 105, 0.25)',
                }}
              >
                {submitting
                  ? 'Processando Pagamento...'
                  : `Confirmar Pagamento de ${formatCurrency(valorEfetivo)}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
