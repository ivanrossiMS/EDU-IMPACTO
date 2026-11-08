'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  PieChart,
  ArrowLeftRight,
  RotateCcw,
  Lock,
  Unlock,
  Banknote,
  FileText,
  Printer,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Building2,
  Layers,
  Clock,
  Receipt,
  Edit3,
  CheckCircle2,
} from 'lucide-react'
import type { ConfigCaixa, ConfigCentroCusto } from '@/lib/dataContext'
import {
  type UnifiedMovimentacaoItem,
  type RateioCentroCustoItem,
  type ResumoSaldoCaixa,
  CATEGORIA_LEGEND_META,
  formatCurrencyBRL,
  formatDateBR,
  extractCentrosCustoOptions,
} from '../types'
import { formatCurrencyInput, handleCurrencyInputChange, parseCurrencyNumeric } from '@/lib/utils'

// ─── 1. MODAL DE RATEIO POR CENTRO DE CUSTO ──────────────────────────────────
export function RateioModal({
  open,
  item,
  centrosCusto,
  saving,
  onSaveRateio,
  onClose,
}: {
  open: boolean
  item: UnifiedMovimentacaoItem | null
  centrosCusto: ConfigCentroCusto[]
  saving: boolean
  onSaveRateio: (rateio: RateioCentroCustoItem[], centroPrincipal: string) => Promise<void>
  onClose: () => void
}) {
  const [rows, setRows] = useState<RateioCentroCustoItem[]>([])

  const opcoesCentro = useMemo(() => {
    return extractCentrosCustoOptions(centrosCusto)
  }, [centrosCusto])

  useEffect(() => {
    if (!open || !item) return
    if (item.rateio && item.rateio.length > 0) {
      setRows(item.rateio)
    } else {
      setRows([
        {
          id: `rat-init-1`,
          centroCusto:
            item.centroCusto && opcoesCentro.includes(item.centroCusto)
              ? item.centroCusto
              : opcoesCentro[0] || '',
          percentual: 100,
          valor: item.valorLiquido,
        },
      ])
    }
  }, [open, item, opcoesCentro])

  if (!open || !item) return null

  const totalValor = item.valorLiquido
  const somaPercentual = rows.reduce((s, r) => s + (Number(r.percentual) || 0), 0)
  const somaValor = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0)

  const addRow = () => {
    const restPct = Math.max(0, +(100 - somaPercentual).toFixed(2))
    const restVal = Math.max(0, +((totalValor * restPct) / 100).toFixed(2))
    setRows((prev) => [
      ...prev,
      {
        id: `rat-${Date.now()}-${prev.length}`,
        centroCusto: opcoesCentro[prev.length % opcoesCentro.length],
        percentual: restPct,
        valor: restVal,
      },
    ])
  }

  const dividirIgualmente = () => {
    if (rows.length === 0) return
    const n = rows.length
    const basePct = Math.floor((10000 / n)) / 100
    setRows((prev) =>
      prev.map((r, idx) => {
        const pct = idx === n - 1 ? +(100 - basePct * (n - 1)).toFixed(2) : basePct
        const val = idx === n - 1 ? +(totalValor - Math.round(totalValor * (basePct / 100) * 100) / 100 * (n - 1)).toFixed(2) : +((totalValor * pct) / 100).toFixed(2)
        return { ...r, percentual: pct, valor: val }
      })
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PieChart size={20} style={{ color: '#38bdf8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                Rateio por Centro de Custo — Lcto #{item.codigoLcto}
              </h3>
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {item.fornecedorNome} • Valor do Lançamento: <strong>{formatCurrencyBRL(totalValor)}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
              Distribua 100% do valor entre os Centros de Custo Escolares:
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={dividirIgualmente}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Dividir Igualmente
              </button>
              <button
                type="button"
                onClick={addRow}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Adicionar Centro</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, idx) => (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 150px auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <select
                  value={r.centroCusto}
                  onChange={(e) => {
                    const v = e.target.value
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, centroCusto: v } : x)))
                  }}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 12.5,
                  }}
                >
                  {opcoesCentro.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>

                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={r.percentual}
                    onChange={(e) => {
                      const pct = Math.max(0, Number(e.target.value) || 0)
                      const val = +((totalValor * pct) / 100).toFixed(2)
                      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, percentual: pct, valor: val } : x)))
                    }}
                    style={{
                      width: '100%',
                      height: 34,
                      padding: '0 24px 0 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12.5,
                      textAlign: 'right',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 12, color: '#64748b' }}>%</span>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInput(r.valor, false)}
                  onChange={(e) => {
                    const val = parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false))
                    const pct = totalValor > 0 ? +((val / totalValor) * 100).toFixed(2) : 0
                    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, valor: val, percentual: pct } : x)))
                  }}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                />

                <button
                  type="button"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    border: '1px solid #fecaca',
                    background: rows.length <= 1 ? '#f1f5f9' : '#fef2f2',
                    color: rows.length <= 1 ? '#94a3b8' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: Math.abs(somaPercentual - 100) <= 0.5 ? '#f0fdf4' : '#fef2f2',
              border: Math.abs(somaPercentual - 100) <= 0.5 ? '1px solid #86efac' : '1px solid #fecaca',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12.5,
              fontWeight: 700,
              color: Math.abs(somaPercentual - 100) <= 0.5 ? '#166534' : '#991b1b',
            }}
          >
            <span>Total Rateado: {somaPercentual.toFixed(2)}%</span>
            <span>
              {formatCurrencyBRL(somaValor)} de {formatCurrencyBRL(totalValor)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                onSaveRateio(
                  rows,
                  rows.length > 1 ? `Rateio (${rows.length} centros)` : rows[0]?.centroCusto || item.centroCusto
                )
              }
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {saving ? 'Salvando...' : 'Gravar Rateio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. MODAL DE TRANSFERÊNCIA ENTRE CAIXAS ──────────────────────────────────
export function TransferirValoresModal({
  open,
  selectedCaixa,
  allCaixas,
  saldoAtual,
  saldosPorCaixaMap = {},
  initialValor = null,
  saving,
  onConfirmTransfer,
  onClose,
}: {
  open: boolean
  selectedCaixa: ConfigCaixa
  allCaixas: ConfigCaixa[]
  saldoAtual: number
  saldosPorCaixaMap?: Record<string, ResumoSaldoCaixa>
  initialValor?: number | null
  saving: boolean
  onConfirmTransfer: (payload: {
    caixaOrigemId: string
    caixaDestinoId: string
    valor: number
    dataTransferencia: string
    tipoRecurso: string
    numeroDocumento: string
    observacao: string
    fecharCaixaOrigemAposTransferencia?: boolean
  }) => Promise<void>
  onClose: () => void
}) {
  const hojeISO = new Date().toISOString().slice(0, 10)
  const saldoDisponivel = Math.max(0, Math.round(Number(saldoAtual || 0) * 100) / 100)
  const isOrigemAberta = selectedCaixa.situacao === 'Aberto'
  const temSaldoPositivo = isOrigemAberta && saldoDisponivel >= 0.01

  const caixasDestinoAbertos = useMemo(
    () => allCaixas.filter((c) => c.id !== selectedCaixa.id && c.situacao === 'Aberto'),
    [allCaixas, selectedCaixa.id]
  )
  const caixasDestinoFechados = useMemo(
    () => allCaixas.filter((c) => c.id !== selectedCaixa.id && c.situacao !== 'Aberto'),
    [allCaixas, selectedCaixa.id]
  )

  const [destinoId, setDestinoId] = useState<string>(caixasDestinoAbertos[0]?.id || '')
  const [valorStr, setValorStr] = useState<string>('')
  const [dataTransferencia, setDataTransferencia] = useState<string>(hojeISO)
  const [tipoRecurso, setTipoRecurso] = useState<string>('Transferência / TED')
  const [numeroDocumento, setNumeroDocumento] = useState<string>('')
  const [observacao, setObservacao] = useState<string>('')
  const [fecharAposZerar, setFecharAposZerar] = useState<boolean>(false)
  const [hasBlurredValor, setHasBlurredValor] = useState<boolean>(false)

  useEffect(() => {
    if (!open) return
    if (caixasDestinoAbertos.length > 0) {
      setDestinoId((prev) =>
        caixasDestinoAbertos.some((c) => c.id === prev) ? prev : caixasDestinoAbertos[0].id
      )
    } else {
      setDestinoId('')
    }
    setHasBlurredValor(false)
    if (initialValor !== null && initialValor > 0) {
      const clamped = Math.min(saldoDisponivel, Math.round(initialValor * 100) / 100)
      setValorStr(clamped > 0 ? clamped.toFixed(2) : '')
      setObservacao('Transferência de saldo para fechamento de caixa (zeramento)')
    } else {
      setValorStr('')
    }
    setFecharAposZerar(false)
  }, [open, initialValor, saldoDisponivel, caixasDestinoAbertos])

  if (!open) return null

  const valorDigitado = Math.round((Number(String(valorStr).replace(',', '.')) || 0) * 100) / 100
  const excedeSaldo = valorDigitado > saldoDisponivel + 0.009
  const valorInvalidoZeroOuNegativo = valorStr.trim() !== '' && valorDigitado <= 0
  const valorValido = temSaldoPositivo && valorDigitado >= 0.01 && !excedeSaldo ? valorDigitado : 0

  const novoSaldoOrigem = Math.max(0, Math.round((saldoDisponivel - valorValido) * 100) / 100)
  const vaiZerarCaixaOrigem = temSaldoPositivo && valorValido > 0 && Math.abs(saldoDisponivel - valorValido) < 0.01

  const caixaDestinoObj = caixasDestinoAbertos.find((c) => c.id === destinoId) || null
  const resumoDestino = caixaDestinoObj
    ? saldosPorCaixaMap[caixaDestinoObj.id] || saldosPorCaixaMap[caixaDestinoObj.codigo]
    : undefined
  const saldoDestinoAtual = resumoDestino ? resumoDestino.saldoAtual : Number(caixaDestinoObj?.saldoInicial || 0)
  const novoSaldoDestino = Math.round((saldoDestinoAtual + valorValido) * 100) / 100

  const handleValorChange = (raw: string) => {
    setValorStr(handleCurrencyInputChange(raw))
  }

  const preencherPercentual = (pct: number) => {
    if (!temSaldoPositivo) return
    const calc = Math.round(saldoDisponivel * pct * 100) / 100
    setValorStr(calc.toFixed(2))
    setHasBlurredValor(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setHasBlurredValor(true)
    if (!temSaldoPositivo || !destinoId || valorValido <= 0 || excedeSaldo) return
    await onConfirmTransfer({
      caixaOrigemId: selectedCaixa.id,
      caixaDestinoId: destinoId,
      valor: valorValido,
      dataTransferencia,
      tipoRecurso,
      numeroDocumento,
      observacao,
      fecharCaixaOrigemAposTransferencia: vaiZerarCaixaOrigem && fecharAposZerar,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 660,
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(135deg, #14532d 0%, #15803d 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowLeftRight size={20} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                Transferência de Valores entre Caixas
              </h3>
              <div style={{ fontSize: 12, color: '#dcfce7' }}>
                Gera automaticamente o lançamento de saída no caixa atual e entrada no caixa destino.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Alerta se não houver saldo positivo ou caixa fechado */}
          {!temSaldoPositivo && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 12.5,
              }}
            >
              <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 800 }}>
                  {!isOrigemAberta
                    ? 'Transferência Bloqueada: Caixa de Origem Fechado'
                    : 'Transferência Bloqueada: Sem Saldo Positivo Disponível'}
                </div>
                <div style={{ marginTop: 2, color: '#7f1d1d' }}>
                  {!isOrigemAberta
                    ? 'Reabra o caixa antes de realizar transferências de valores.'
                    : `O saldo atual deste caixa é ${formatCurrencyBRL(saldoAtual)}. O sistema só permite transferir quantidades positivas disponíveis em caixa.`}
                </div>
              </div>
            </div>
          )}

          {/* Simulador Visual de Origem -> Destino */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Caixa de Origem (Saída)
              </div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, marginTop: 2 }}>
                {selectedCaixa.codigo} - {selectedCaixa.descricao}
              </div>
              <div style={{ color: '#475569', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo Disponível:</span>
                <strong style={{ color: saldoDisponivel > 0 ? '#15803d' : '#dc2626' }}>
                  {formatCurrencyBRL(saldoAtual)}
                </strong>
              </div>
              {valorValido > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px dashed #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#334155' }}>Após Transferência:</span>
                  <span
                    style={{
                      fontWeight: 900,
                      color: vaiZerarCaixaOrigem ? '#0284c7' : '#0f172a',
                    }}
                  >
                    {formatCurrencyBRL(novoSaldoOrigem)} {vaiZerarCaixaOrigem ? '(Zerado ✓)' : ''}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                Caixa de Destino (Entrada)
              </div>
              <div style={{ fontWeight: 800, color: '#14532d', fontSize: 13, marginTop: 2 }}>
                {caixaDestinoObj
                  ? `${caixaDestinoObj.codigo} - ${caixaDestinoObj.descricao}`
                  : 'Selecione um caixa aberto'}
              </div>
              <div style={{ color: '#166534', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo Atual no Destino:</span>
                <strong>{caixaDestinoObj ? formatCurrencyBRL(saldoDestinoAtual) : '—'}</strong>
              </div>
              {caixaDestinoObj && valorValido > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px dashed #86efac',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#14532d' }}>Novo Saldo no Destino:</span>
                  <span style={{ fontWeight: 900, color: '#15803d' }}>
                    {formatCurrencyBRL(novoSaldoDestino)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="trf-caixa-destino"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}
            >
              Caixa de Destino (Somente Caixas Abertos):
            </label>
            <select
              id="trf-caixa-destino"
              name="caixaDestinoId"
              required
              disabled={!temSaldoPositivo}
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                background: temSaldoPositivo ? '#ffffff' : '#f1f5f9',
              }}
            >
              {caixasDestinoAbertos.length === 0 && (
                <option value="">Nenhum outro caixa aberto disponível para receber...</option>
              )}
              {caixasDestinoAbertos.map((c) => {
                const res = saldosPorCaixaMap[c.id] || saldosPorCaixaMap[c.codigo]
                const sAt = res ? res.saldoAtual : Number(c.saldoInicial || 0)
                return (
                  <option key={c.id} value={c.id}>
                    Caixa {c.codigo} - {c.descricao} ({c.operador}) • Saldo Atual: {formatCurrencyBRL(sAt)} [Aberto]
                  </option>
                )
              })}
              {caixasDestinoFechados.map((c) => (
                <option key={c.id} value={c.id} disabled>
                  Caixa {c.codigo} - {c.descricao} ({c.operador}) [Fechado — Reabra para receber]
                </option>
              ))}
            </select>
          </div>

          {/* Valor a Transferir com Atalhos Rápidos e Trava Positiva */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <label
                htmlFor="trf-valor-input"
                style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
              >
                Valor Positivo a Transferir (Máx: {formatCurrencyBRL(saldoDisponivel)}):
              </label>
              {temSaldoPositivo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {[
                    { label: '25%', pct: 0.25 },
                    { label: '50%', pct: 0.5 },
                    { label: '100% • Zerar Caixa', pct: 1 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => preencherPercentual(btn.pct)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        border: btn.pct === 1 ? '1px solid #16a34a' : '1px solid #cbd5e1',
                        background: btn.pct === 1 ? '#dcfce7' : '#f8fafc',
                        color: btn.pct === 1 ? '#166534' : '#334155',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 12 }}>
              <div>
                <input
                  id="trf-valor-input"
                  name="valorTransferencia"
                  type="text"
                  inputMode="numeric"
                  required
                  disabled={!temSaldoPositivo}
                  value={formatCurrencyInput(valorStr)}
                  onChange={(e) => handleValorChange(e.target.value)}
                  onBlur={() => setHasBlurredValor(true)}
                  placeholder="R$ 0,00"
                  aria-describedby="trf-valor-feedback"
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border:
                      excedeSaldo || (hasBlurredValor && valorInvalidoZeroOuNegativo)
                        ? '2px solid #dc2626'
                        : '1px solid #cbd5e1',
                    background: !temSaldoPositivo
                      ? '#f1f5f9'
                      : excedeSaldo
                        ? '#fef2f2'
                        : '#ffffff',
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#0f172a',
                    textAlign: 'right',
                  }}
                />
              </div>

              <div>
                <input
                  id="trf-data-input"
                  name="dataTransferencia"
                  type="date"
                  required
                  disabled={!temSaldoPositivo}
                  value={dataTransferencia}
                  onChange={(e) => setDataTransferencia(e.target.value)}
                  aria-label="Data da Transferência"
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    background: temSaldoPositivo ? '#ffffff' : '#f1f5f9',
                  }}
                />
              </div>
            </div>

            {/* Feedback de validação do valor */}
            <div id="trf-valor-feedback" aria-live="polite" style={{ marginTop: 5 }}>
              {excedeSaldo && (
                <div
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span>
                    ✕ Valor inválido! Só é permitido transferir até o saldo positivo disponível (
                    {formatCurrencyBRL(saldoDisponivel)}).
                  </span>
                  <button
                    type="button"
                    onClick={() => setValorStr(saldoDisponivel.toFixed(2))}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #dc2626',
                      background: '#ffffff',
                      color: '#dc2626',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Usar {formatCurrencyBRL(saldoDisponivel)}
                  </button>
                </div>
              )}
              {!excedeSaldo && hasBlurredValor && valorInvalidoZeroOuNegativo && (
                <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>
                  ✕ Informe uma quantidade positiva maior que R$ 0,00 para transferir.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                htmlFor="trf-recurso"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}
              >
                Tipo de Recurso:
              </label>
              <select
                id="trf-recurso"
                name="tipoRecurso"
                disabled={!temSaldoPositivo}
                value={tipoRecurso}
                onChange={(e) => setTipoRecurso(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  background: temSaldoPositivo ? '#ffffff' : '#f1f5f9',
                }}
              >
                <option value="Transferência / TED">Transferência / TED</option>
                <option value="PIX">PIX</option>
                <option value="Dinheiro (Numerário)">Dinheiro (Numerário / Sangria)</option>
                <option value="Depósito Bancário">Depósito Bancário</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="trf-docto"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}
              >
                Nº Documento / Comprovante:
              </label>
              <input
                id="trf-docto"
                name="numeroDocumento"
                type="text"
                disabled={!temSaldoPositivo}
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Opcional"
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  background: temSaldoPositivo ? '#ffffff' : '#f1f5f9',
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="trf-obs"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}
            >
              Motivo / Observação da Transferência:
            </label>
            <input
              id="trf-obs"
              name="observacao"
              type="text"
              disabled={!temSaldoPositivo}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Suprimento de caixa, recolhimento para conta movimento..."
              style={{
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                background: temSaldoPositivo ? '#ffffff' : '#f1f5f9',
              }}
            />
          </div>

          {/* Opção inteligente para já fechar o caixa quando a transferência zerar o saldo */}
          {vaiZerarCaixaOrigem && (
            <label
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: '#f0f9ff',
                border: '1px solid #7dd3fc',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 12.5,
                color: '#0c4a6e',
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={fecharAposZerar}
                onChange={(e) => setFecharAposZerar(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#0284c7', cursor: 'pointer' }}
              />
              <span>
                Esta transferência deixará o <strong>Caixa {selectedCaixa.codigo}</strong> zerado (R$ 0,00). Deseja{' '}
                <strong>fechar o caixa automaticamente</strong> após concluir?
              </span>
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !temSaldoPositivo || !destinoId || valorValido <= 0 || excedeSaldo}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 8,
                border: 'none',
                background:
                  saving || !temSaldoPositivo || !destinoId || valorValido <= 0 || excedeSaldo
                    ? '#94a3b8'
                    : '#15803d',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor:
                  saving || !temSaldoPositivo || !destinoId || valorValido <= 0 || excedeSaldo
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {saving
                ? 'Processando...'
                : vaiZerarCaixaOrigem && fecharAposZerar
                  ? `Transferir ${formatCurrencyBRL(valorValido)} e Fechar Caixa`
                  : valorValido > 0
                    ? `Confirmar Transferência (${formatCurrencyBRL(valorValido)})`
                    : 'Confirmar Transferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 3. MODAL DE ESTORNO DE MOVIMENTAÇÃO / BAIXA ─────────────────────────────
export function EstornarMovimentacaoModal({
  open,
  item,
  saving,
  onConfirmEstorno,
  onClose,
}: {
  open: boolean
  item: UnifiedMovimentacaoItem | null
  saving: boolean
  onConfirmEstorno: (motivo: string) => Promise<void>
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (open) setMotivo('')
  }, [open])

  if (!open || !item) return null

  const meta = CATEGORIA_LEGEND_META[item.categoriaOrigem]

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #fecaca',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background: '#991b1b',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RotateCcw size={20} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              Estornar Lançamento — Lcto #{item.codigoLcto}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              fontSize: 12.5,
              color: '#7f1d1d',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              {item.fornecedorNome} — {formatCurrencyBRL(item.valorLiquido)}
            </div>
            <div>{item.descricao}</div>
            <div style={{ marginTop: 6, fontSize: 11.5 }}>
              <strong>Impacto do Estorno ({meta.label}):</strong>{' '}
              {item.categoriaOrigem === 'compromisso'
                ? 'O pagamento será desfeito no Caixa e a Conta a Pagar voltará para situação Pendente/Aberta em Contas a Pagar.'
                : item.categoriaOrigem === 'rec_aluno'
                  ? item.hasAlunoVinculado
                    ? 'O recebimento será revertido no Caixa e a parcela do aluno voltará para situação Pendente em Contas a Receber.'
                    : 'O recebimento será revertido no Caixa e o título voltará para situação Pendente em Contas a Receber.'
                  : item.categoriaOrigem === 'transf_valores'
                    ? 'A transferência será estornada tanto no caixa de origem quanto no caixa de destino.'
                    : 'O lançamento manual será estornado do livro caixa atual.'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Justificativa / Motivo do Estorno:
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Informe o motivo do estorno desta movimentação (opcional)..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onConfirmEstorno(motivo.trim() || 'Estorno confirmado pelo operador')}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 6,
                border: 'none',
                background: saving ? '#94a3b8' : '#dc2626',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Estornando...' : 'Confirmar Estorno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 4. MODAL DE RESUMO FINANCEIRO ANALÍTICO DO CAIXA ────────────────────────
export function ResumoCaixaModal({
  open,
  selectedCaixa,
  items,
  onClose,
}: {
  open: boolean
  selectedCaixa: ConfigCaixa
  items: UnifiedMovimentacaoItem[]
  onClose: () => void
}) {
  const stats = useMemo(() => {
    const saldoInicial = Number(selectedCaixa.saldoInicial || 0)
    let totalEntradas = 0
    let totalSaidas = 0
    const porRecurso = new Map<string, { entradas: number; saidas: number; count: number }>()
    const porContaPlano = new Map<string, { entradas: number; saidas: number; count: number }>()
    const porCategoria = new Map<string, { entradas: number; saidas: number; count: number }>()

    for (const item of items) {
      const isEntrada = item.tipoOperacao === 'Recebimento'
      const val = Number(item.valorLiquido || 0)
      if (isEntrada) totalEntradas += val
      else totalSaidas += val

      const rec = item.tipoRecurso || 'Outros'
      const curRec = porRecurso.get(rec) || { entradas: 0, saidas: 0, count: 0 }
      if (isEntrada) curRec.entradas += val
      else curRec.saidas += val
      curRec.count += 1
      porRecurso.set(rec, curRec)

      const cp = item.contaPlanoLabel || 'Sem Conta Plano'
      const curCp = porContaPlano.get(cp) || { entradas: 0, saidas: 0, count: 0 }
      if (isEntrada) curCp.entradas += val
      else curCp.saidas += val
      curCp.count += 1
      porContaPlano.set(cp, curCp)

      const catLabel = CATEGORIA_LEGEND_META[item.categoriaOrigem]?.label || item.categoriaOrigem
      const curCat = porCategoria.get(catLabel) || { entradas: 0, saidas: 0, count: 0 }
      if (isEntrada) curCat.entradas += val
      else curCat.saidas += val
      curCat.count += 1
      porCategoria.set(catLabel, curCat)
    }

    return {
      saldoInicial,
      totalEntradas,
      totalSaidas,
      resultadoPeriodo: totalEntradas - totalSaidas,
      saldoFinal: saldoInicial + totalEntradas - totalSaidas,
      porRecurso: Array.from(porRecurso.entries()),
      porContaPlano: Array.from(porContaPlano.entries()),
      porCategoria: Array.from(porCategoria.entries()),
    }
  }, [selectedCaixa, items])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              Resumo Financeiro do Caixa — {selectedCaixa.codigo} - {selectedCaixa.descricao}
            </h3>
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>
              Operador: {selectedCaixa.operador} • Situação: {selectedCaixa.situacao} • {items.length} lançamentos listados
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 4 KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Saldo Inicial Abertura
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {formatCurrencyBRL(stats.saldoInicial)}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Total de Entradas (+)
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#15803d', marginTop: 4 }}>
                {formatCurrencyBRL(stats.totalEntradas)}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                Total de Saídas (-)
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                {formatCurrencyBRL(stats.totalSaidas)}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                Saldo Atual Calculado
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: stats.saldoFinal >= 0 ? '#0284c7' : '#dc2626',
                  marginTop: 4,
                }}
              >
                {formatCurrencyBRL(stats.saldoFinal)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Por Tipo de Recurso */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                Posição por Tipo de Recurso / Forma de Pagto
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Recurso</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Entradas</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saídas</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.porRecurso.map(([rec, v]) => (
                    <tr key={rec} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {rec} <span style={{ color: '#64748b', fontSize: 11 }}>({v.count})</span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                        {formatCurrencyBRL(v.entradas)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                        {formatCurrencyBRL(v.saidas)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                        {formatCurrencyBRL(v.entradas - v.saidas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Por Origem */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                Posição por Origem do Lançamento
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Origem</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Entradas</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saídas</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Lctos</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.porCategoria.map(([cat, v]) => (
                    <tr key={cat} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{cat}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                        {formatCurrencyBRL(v.entradas)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                        {formatCurrencyBRL(v.saidas)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{v.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por Conta Plano */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f1f5f9', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
              Detalhamento por Conta Plano (Plano de Contas)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Conta Plano</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qtd. Lctos</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Entradas</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saídas</th>
                </tr>
              </thead>
              <tbody>
                {stats.porContaPlano.map(([cp, v]) => (
                  <tr key={cp} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{cp}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{v.count}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                      {formatCurrencyBRL(v.entradas)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      {formatCurrencyBRL(v.saidas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 5. MODAL DE FECHAR / REABRIR CAIXA E CONFERÊNCIA DE NUMERÁRIO ───────────
export function FecharReabrirCaixaModal({
  open,
  mode,
  selectedCaixa,
  saldoCalculado,
  resumoCaixa,
  saving,
  onConfirm,
  onRequestTransferToZero,
  onRequestSuprimentoToZero,
  onClose,
}: {
  open: boolean
  mode: 'fechar' | 'reabrir' | 'numerario'
  selectedCaixa: ConfigCaixa
  saldoCalculado: number
  resumoCaixa?: ResumoSaldoCaixa
  saving: boolean
  onConfirm: (payload: {
    novaSituacao?: 'Aberto' | 'Fechado'
    acaoLabel: string
    detalhes: string
    saldoInformado?: number
  }) => Promise<void>
  onRequestTransferToZero?: (valorPositivo: number) => void
  onRequestSuprimentoToZero?: (valorFaltante: number) => void
  onClose: () => void
}) {
  const [observacao, setObservacao] = useState('')
  const [cedulas, setCedulas] = useState<Record<string, number>>({
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
    '0.50': 0,
    '0.25': 0,
    '0.10': 0,
    '0.05': 0,
  })

  if (!open) return null

  const saldoArredondado = Math.round(Number(saldoCalculado || 0) * 100) / 100
  const isZerado = Math.abs(saldoArredondado) < 0.009
  const podeConfirmarFechamento = mode !== 'fechar' || isZerado

  const totalNumerarioFisico = Object.entries(cedulas).reduce(
    (acc, [valStr, qtd]) => acc + Number(valStr) * (Number(qtd) || 0),
    0
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: mode === 'numerario' ? 680 : 580,
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background:
              mode === 'fechar'
                ? isZerado
                  ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)'
                  : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                : 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mode === 'numerario' ? <Banknote size={20} /> : mode === 'fechar' ? <Lock size={20} /> : <Unlock size={20} />}
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                {mode === 'numerario'
                  ? `Conferência de Numerário — Caixa ${selectedCaixa.codigo}`
                  : mode === 'fechar'
                    ? `Fechamento de Caixa — ${selectedCaixa.codigo} - ${selectedCaixa.descricao}`
                    : `Reabertura de Caixa — ${selectedCaixa.codigo} - ${selectedCaixa.descricao}`}
              </h3>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
                {mode === 'fechar'
                  ? 'Regra de governança: o fechamento exige saldo do caixa zerado (R$ 0,00).'
                  : `Operador: ${selectedCaixa.operador}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Resumo de Movimentação do Caixa */}
          {resumoCaixa && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Abertura
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {formatCurrencyBRL(resumoCaixa.saldoInicial)}
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Entradas (+)
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                  {formatCurrencyBRL(resumoCaixa.totalEntradas)}
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9f1239', textTransform: 'uppercase' }}>
                  Saídas (-)
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e11d48', marginTop: 2 }}>
                  {formatCurrencyBRL(resumoCaixa.totalSaidas)}
                </div>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isZerado ? '#f0fdf4' : '#fef2f2',
                  border: isZerado ? '1px solid #86efac' : '1px solid #fecaca',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isZerado ? '#166534' : '#991b1b',
                    textTransform: 'uppercase',
                  }}
                >
                  Saldo Atual
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: isZerado ? '#15803d' : '#dc2626',
                    marginTop: 2,
                  }}
                >
                  {formatCurrencyBRL(saldoArredondado)}
                </div>
              </div>
            </div>
          )}

          {!resumoCaixa && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                Saldo Calculado do Caixa no Sistema:
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: isZerado ? '#15803d' : '#dc2626' }}>
                {formatCurrencyBRL(saldoArredondado)}
              </span>
            </div>
          )}

          {/* Regra de Ouro de Fechamento: SOMENTE QUANDO ESTIVER ZERADO */}
          {mode === 'fechar' && !isZerado && (
            <div
              role="alert"
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#7f1d1d',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#991b1b' }}>
                    Fechamento Bloqueado: O Caixa não está zerado ({formatCurrencyBRL(saldoArredondado)})
                  </div>
                  <div style={{ marginTop: 4, lineHeight: 1.45 }}>
                    {saldoArredondado > 0 ? (
                      <>
                        Para fechar o caixa, o saldo disponível deve ser exatamente <strong>R$ 0,00</strong>. Transfira
                        o saldo positivo de <strong>{formatCurrencyBRL(saldoArredondado)}</strong> para outro caixa
                        (Tesouraria / Conta Movimento) ou registre a saída correspondente antes de encerrar.
                      </>
                    ) : (
                      <>
                        O caixa apresenta saldo negativo de <strong>{formatCurrencyBRL(saldoArredondado)}</strong>. Para
                        fechar o caixa, regularize lançando uma entrada de suprimento de{' '}
                        <strong>{formatCurrencyBRL(Math.abs(saldoArredondado))}</strong> para zerar o saldo (R$ 0,00).
                      </>
                    )}
                  </div>
                </div>
              </div>

              {saldoArredondado > 0 && onRequestTransferToZero && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onRequestTransferToZero(saldoArredondado)
                  }}
                  style={{
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#15803d',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  <ArrowLeftRight size={15} />
                  <span>Transferir {formatCurrencyBRL(saldoArredondado)} Agora para Zerar o Caixa</span>
                </button>
              )}

              {saldoArredondado < 0 && onRequestSuprimentoToZero && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onRequestSuprimentoToZero(Math.abs(saldoArredondado))
                  }}
                  style={{
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  <Plus size={15} />
                  <span>Lançar Suprimento de {formatCurrencyBRL(Math.abs(saldoArredondado))} para Zerar o Caixa</span>
                </button>
              )}
            </div>
          )}

          {mode === 'fechar' && isZerado && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#14532d',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12.5,
              }}
            >
              <CheckCircle2 size={19} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800 }}>Caixa Zerado (R$ 0,00) — Apto para Fechamento!</div>
                <div style={{ fontSize: 11.5, color: '#166534', marginTop: 1 }}>
                  Todas as entradas e saídas estão conciliadas com saldo final zero. Confirme abaixo para encerrar o
                  caixa.
                </div>
              </div>
            </div>
          )}

          {mode === 'numerario' && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Informe a quantidade de cédulas e moedas em espécie na gaveta do caixa:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Object.keys(cedulas).map((denom) => (
                  <div
                    key={denom}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                    }}
                  >
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                      R$ {denom.replace('.', ',')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cedulas[denom] || ''}
                      placeholder="0"
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                          e.preventDefault()
                        }
                      }}
                      onChange={(e) =>
                        setCedulas((prev) => ({ ...prev, [denom]: Math.max(0, parseInt(e.target.value || '0', 10)) }))
                      }
                      style={{
                        width: '100%',
                        height: 30,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12.5,
                        background: '#ffffff',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: '#166534',
                }}
              >
                <span>Total Físico Contado em Espécie:</span>
                <span>{formatCurrencyBRL(totalNumerarioFisico)}</span>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="fechar-reabrir-obs"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}
            >
              Observações / Termo de Conferência:
            </label>
            <textarea
              id="fechar-reabrir-obs"
              name="observacao"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações de fechamento, conferência ou reabertura..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !podeConfirmarFechamento}
              onClick={() => {
                if (!podeConfirmarFechamento) return
                onConfirm({
                  novaSituacao: mode === 'fechar' ? 'Fechado' : mode === 'reabrir' ? 'Aberto' : undefined,
                  acaoLabel:
                    mode === 'fechar'
                      ? 'Fechamento de Caixa (Saldo Zerado)'
                      : mode === 'reabrir'
                        ? 'Reabertura de Caixa'
                        : 'Conferência de Numerário',
                  detalhes:
                    observacao.trim() ||
                    (mode === 'numerario'
                      ? `Numerário conferido em espécie: ${formatCurrencyBRL(totalNumerarioFisico)}`
                      : mode === 'fechar'
                        ? 'Caixa encerrado com saldo zerado (R$ 0,00).'
                        : `Caixa reaberto para operação. Saldo atual: ${formatCurrencyBRL(saldoArredondado)}`),
                  saldoInformado: mode === 'numerario' ? totalNumerarioFisico : saldoArredondado,
                })
              }}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 8,
                border: 'none',
                background: saving || !podeConfirmarFechamento ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: saving || !podeConfirmarFechamento ? 'not-allowed' : 'pointer',
              }}
            >
              {saving
                ? 'Processando...'
                : mode === 'fechar'
                  ? isZerado
                    ? 'Confirmar Fechamento do Caixa (R$ 0,00)'
                    : 'Bloqueado — Zere o Saldo Primeiro'
                  : mode === 'reabrir'
                    ? 'Confirmar Reabertura do Caixa'
                    : 'Confirmar e Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 6. MODAL FICHA DETALHADA & AUDITORIA DO LANÇAMENTO (Botão Info ⚙️) ──────
export function InfoDetalhesModal({
  open,
  item,
  onClose,
  onEdit,
  onOpenReceipt,
  onOpenRateio,
  onOpenEstorno,
}: {
  open: boolean
  item: UnifiedMovimentacaoItem | null
  onClose: () => void
  onEdit: (item: UnifiedMovimentacaoItem) => void
  onOpenReceipt: (item: UnifiedMovimentacaoItem) => void
  onOpenRateio: (item: UnifiedMovimentacaoItem) => void
  onOpenEstorno: (item: UnifiedMovimentacaoItem) => void
}) {
  if (!open || !item) return null
  const meta = CATEGORIA_LEGEND_META[item.categoriaOrigem]

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 740,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15,23,42,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                Ficha Detalhada do Lançamento — Lcto #{item.codigoLcto}
              </h3>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: meta.bgBadge,
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {meta.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
              Caixa {item.caixaCodigo} - {item.caixaDescricao} • Data: {formatDateBR(item.dataLcto)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                {item.categoriaOrigem === 'rec_aluno'
                  ? item.hasAlunoVinculado
                    ? 'ALUNO / FAVORECIDO'
                    : 'PAGADOR / FAVORECIDO'
                  : 'FORNECEDOR / FAVORECIDO'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{item.fornecedorNome}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>CONTA PLANO (PLANO DE CONTAS)</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                {item.contaPlanoLabel}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>CENTRO DE CUSTO</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                {item.centroCusto || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>TIPO / TRANSAÇÃO</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {item.tipoOperacao} • {item.tipoTransacao}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>TIPO RECURSO</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{item.tipoRecurso}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Nº DOCTO / EMISSÃO</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {item.numeroDocumento || 'S/N'} ({formatDateBR(item.emissaoDocto)})
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>VALOR LÍQUIDO</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                {formatCurrencyBRL(item.valorLiquido)}
              </div>
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12.5 }}>
            <strong>Descrição Completa:</strong> {item.descricao}
            {item.observacao && (
              <div style={{ marginTop: 4, color: '#475569' }}>
                <strong>Observação:</strong> {item.observacao}
              </div>
            )}
          </div>

          {/* Trilha de Auditoria */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              Histórico e Auditoria do Lançamento
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(item.historico || []).length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Registro liquidado pelo operador {item.operador} em {formatDateBR(item.dataLcto)}.
                </div>
              ) : (
                item.historico.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {h.acao === 'Recebimento de Título de Aluno' && !item.hasAlunoVinculado
                        ? 'Recebimento de Contas a Receber'
                        : h.acao}{' '}
                      — <span style={{ color: '#64748b', fontWeight: 500 }}>{h.usuario}</span>
                    </div>
                    {h.detalhes && <div style={{ color: '#475569', marginTop: 2 }}>{h.detalhes}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                onClose()
                onEdit(item)
              }}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: '#f59e0b',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={14} />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenReceipt(item)
              }}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Receipt size={14} />
              <span>Emitir Recibo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenRateio(item)
              }}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <PieChart size={14} />
              <span>Rateio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenEstorno(item)
              }}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              <span>Estornar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
